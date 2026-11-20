export type AudioFormat = 'pcm' | 'dsd';
export interface BandwidthInput {
  format: AudioFormat;
  rateHz: number;
  channels: number;
  linkGbps: 1 | 10;
  vlan: boolean;
  packetTargetUs: number;
  admissionPercent: 80 | 85;
}
export interface BandwidthResult {
  groupsPerPacket: number;
  payloadBytes: number;
  wireBytes: number;
  groupRateNumerator: bigint;
  groupRateDenominator: bigint;
  rawAudioBpsNumerator: bigint;
  rawAudioBpsDenominator: bigint;
  occupiedBpsNumerator: bigint;
  occupiedBpsDenominator: bigint;
  rawAudioBps: number;
  occupiedBps: number;
  packetIntervalUs: number;
  utilisationPercent: number;
  admissionPass: boolean;
  atLeastOneGroupOverTarget: boolean;
  headroomBps: number;
  macCapacityBps: number;
  unusedMacCapacityBps: number;
  protocolHeaderBytes: number;
  ethernetOverheadBytes: number;
}

export function occupiedByteTimes(payloadBytes: number, vlan: boolean): number {
  return vlan
    ? 42 + Math.max(42, 12 + payloadBytes)
    : 38 + Math.max(46, 12 + payloadBytes);
}

export function calculateBandwidth(input: BandwidthInput): BandwidthResult {
  const { format, rateHz, channels, linkGbps, vlan, packetTargetUs, admissionPercent } = input;
  if (!Number.isSafeInteger(rateHz) || rateHz <= 0) throw new RangeError('Rate must be a positive safe integer in hertz.');
  if (!Number.isInteger(channels) || channels < 2 || channels > 32) throw new RangeError('Channels must be between 2 and 32.');
  if (!Number.isInteger(packetTargetUs) || packetTargetUs <= 0 || packetTargetUs > 1_000_000) throw new RangeError('Packet target must be a positive whole number of microseconds.');

  const rateNumerator = BigInt(rateHz);
  const rateDenominator = format === 'dsd' ? 32n : 1n;
  const targetProduct = rateNumerator * BigInt(packetTargetUs);
  const targetDenominator = rateDenominator * 1_000_000n;
  const deadlineGroups = Number(targetProduct / targetDenominator);
  const groupsCapacity = Math.floor(1440 / (4 * channels));
  const groupsPerPacket = Math.min(groupsCapacity, Math.max(1, deadlineGroups));
  const payloadBytes = 4 * channels * groupsPerPacket;
  const wireBytes = occupiedByteTimes(payloadBytes, vlan);
  const occupiedBpsNumerator = 8n * BigInt(wireBytes) * rateNumerator;
  const occupiedBpsDenominator = BigInt(groupsPerPacket) * rateDenominator;
  const rawAudioBpsNumerator = 32n * BigInt(channels) * rateNumerator;
  const rawAudioBpsDenominator = rateDenominator;
  const occupiedBps = Number(occupiedBpsNumerator) / Number(occupiedBpsDenominator);
  const rawAudioBps = Number(rawAudioBpsNumerator) / Number(rawAudioBpsDenominator);
  const packetIntervalUs = Number(BigInt(groupsPerPacket) * rateDenominator * 1_000_000n) / rateHz;
  const capacity = linkGbps * 1_000_000_000;
  const utilisationPercent = occupiedBps / capacity * 100;
  const limitBps = capacity * admissionPercent / 100;
  const protocolHeaderBytes = 12;

  return {
    groupsPerPacket,
    payloadBytes,
    wireBytes,
    groupRateNumerator: rateNumerator,
    groupRateDenominator: rateDenominator,
    rawAudioBpsNumerator,
    rawAudioBpsDenominator,
    occupiedBpsNumerator,
    occupiedBpsDenominator,
    rawAudioBps,
    occupiedBps,
    packetIntervalUs,
    utilisationPercent,
    admissionPass: occupiedBps <= limitBps,
    atLeastOneGroupOverTarget: targetProduct < targetDenominator,
    headroomBps: limitBps - occupiedBps,
    macCapacityBps: capacity,
    unusedMacCapacityBps: capacity - occupiedBps,
    protocolHeaderBytes,
    ethernetOverheadBytes: wireBytes - payloadBytes - protocolHeaderBytes,
  };
}

export function formatRate(bps: number, digits = 4): string {
  const mbps = bps / 1_000_000;
  return `${mbps.toLocaleString('en-GB', { maximumFractionDigits: digits })} Mb/s`;
}
