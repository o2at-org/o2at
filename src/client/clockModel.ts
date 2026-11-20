export type SourceMode = 'elastic' | 'common-reference' | 'independent-fixed';
export type PlaybackState = 'OPEN' | 'CLOCK_VALID' | 'PREFILL' | 'RUNNING' | 'HOLDOVER' | 'MUTE_ABORT';

export interface ClockScenario {
  mode: SourceMode;
  groupRate: number;
  ppm: number;
  bufferGroups: number;
  initialOccupancyGroups: number;
  holdoverSeconds: number;
}
export interface ClockResult {
  state: PlaybackState;
  producerRate: number;
  receiverRate: number;
  occupancyGroups: number;
  occupancyPercent: number;
  upstreamBacklogGroups: number;
  reason: string;
}

export function ratesFor(s: ClockScenario) {
  const receiverRate = s.groupRate;
  const ppm = s.mode === 'independent-fixed' ? s.ppm : 0;
  const producerRate = receiverRate * (1 + ppm / 1_000_000);
  return { producerRate, receiverRate, ppm };
}

export function simulateClock(s: ClockScenario, elapsedSeconds: number, referenceLostAfterSeconds?: number): ClockResult {
  if (!(s.groupRate > 0) || !(s.bufferGroups > 0) || !Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new RangeError('Rates, buffer size and elapsed time must be valid positive values.');
  }
  const { producerRate, receiverRate, ppm } = ratesFor(s);
  const drift = (producerRate - receiverRate) * elapsedSeconds;
  const rawOccupancy = s.initialOccupancyGroups + drift;
  const occupancyGroups = Math.min(s.bufferGroups, Math.max(0, rawOccupancy));
  const occupancyPercent = occupancyGroups / s.bufferGroups * 100;
  const referenceLost = referenceLostAfterSeconds !== undefined && elapsedSeconds >= referenceLostAfterSeconds;
  const holdoverExpired = referenceLost && elapsedSeconds - referenceLostAfterSeconds! > s.holdoverSeconds;
  const outOfBuffer = rawOccupancy < 0 || rawOccupancy > s.bufferGroups;
  const state: PlaybackState = outOfBuffer || (referenceLost && holdoverExpired) ? 'MUTE_ABORT' : referenceLost ? 'HOLDOVER' : 'RUNNING';
  const reason = outOfBuffer
    ? rawOccupancy < 0 ? 'Would underflow: local mute or abort is required.' : 'Would exceed FIFO capacity: local mute or abort is required.'
    : referenceLost && holdoverExpired ? 'Declared holdover bound expired; local mute or abort is required.'
      : referenceLost ? 'Reference loss is inside the declared holdover interval.'
        : ppm === 0 ? 'No sustained rate drift in this idealised scenario.'
          : 'Sustained rate mismatch moves FIFO occupancy; credits do not alter a fixed producer clock.';
  return {
    state,
    producerRate,
    receiverRate,
    occupancyGroups,
    occupancyPercent,
    upstreamBacklogGroups: Math.max(0, drift),
    reason,
  };
}

export function secondsToMargin(groupRate: number, marginMs: number, ppm: number): number {
  if (!(groupRate > 0) || !(marginMs > 0) || ppm === 0) return Infinity;
  const marginGroups = groupRate * marginMs / 1000;
  const driftGroupsPerSecond = groupRate * Math.abs(ppm) / 1_000_000;
  return marginGroups / driftGroupsPerSecond;
}

export class CumulativeCredit {
  grantEndGroup: number;
  sentEndGroup: number;
  consumedEndGroup: number;
  constructor(initialGrantEnd = 0, initialSentEnd = 0, initialConsumedEnd = 0) {
    this.grantEndGroup = initialGrantEnd;
    this.sentEndGroup = initialSentEnd;
    this.consumedEndGroup = initialConsumedEnd;
  }
  applyGrant(grantEndGroup: number): 'advanced' | 'duplicate' | 'stale' {
    if (!Number.isSafeInteger(grantEndGroup) || grantEndGroup < 0) throw new RangeError('Grant must be a non-negative group counter.');
    if (grantEndGroup === this.grantEndGroup) return 'duplicate';
    if (grantEndGroup < this.grantEndGroup) return 'stale';
    this.grantEndGroup = grantEndGroup;
    return 'advanced';
  }
  canSend(packetGroups: number): boolean {
    const packetEnd = this.sentEndGroup + packetGroups;
    return Number.isSafeInteger(packetGroups) && packetGroups > 0 && Number.isSafeInteger(packetEnd) && packetEnd <= this.grantEndGroup;
  }
  send(packetGroups: number): void {
    if (!this.canSend(packetGroups)) throw new RangeError('Packet exceeds cumulative grant_end_group.');
    this.sentEndGroup += packetGroups;
  }
  consume(throughGroup: number): void {
    if (!Number.isSafeInteger(throughGroup) || throughGroup < this.consumedEndGroup || throughGroup > this.sentEndGroup) {
      throw new RangeError('Consumption must be monotonic and cannot pass sent data.');
    }
    this.consumedEndGroup = throughGroup;
  }
}

export class SeededJitter {
  private state: number;
  constructor(seed: number) { this.state = (seed >>> 0) || 1; }
  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    return (this.state >>> 0) / 0x1_0000_0000;
  }
}

export function packetTimes(count: number, intervalMs: number, jitterPercent: number, seed: number): number[] {
  if (!Number.isInteger(count) || count < 0 || !(intervalMs > 0) || jitterPercent < 0 || jitterPercent > 100) throw new RangeError('Invalid packet timeline parameters.');
  const rng = new SeededJitter(seed);
  const times: number[] = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    const factor = 1 + ((rng.next() * 2) - 1) * jitterPercent / 100;
    t += intervalMs * factor;
    times.push(t);
  }
  return times;
}

export function packetArrivesBeforeDeadline(arrivalSeconds: number, consumeDeadlineSeconds: number): boolean {
  return Number.isFinite(arrivalSeconds) && Number.isFinite(consumeDeadlineSeconds) && arrivalSeconds <= consumeDeadlineSeconds;
}
