import test from 'node:test';
import assert from 'node:assert/strict';
import { CumulativeCredit, packetArrivesBeforeDeadline, packetTimes, secondsToMargin, simulateClock, type ClockScenario } from '../src/client/clockModel.ts';

const base: ClockScenario = { mode: 'independent-fixed', groupRate: 3_072_000, ppm: 0, bufferGroups: 9_216, initialOccupancyGroups: 4_608, holdoverSeconds: 2 };

test('zero mismatch produces no long-term occupancy drift', () => {
  const r = simulateClock(base, 120);
  assert.equal(r.occupancyGroups, base.initialOccupancyGroups);
  assert.equal(r.state, 'RUNNING');
});

test('positive mismatch fills FIFO; negative mismatch drains it', () => {
  const plus = simulateClock({ ...base, ppm: 50 }, 10);
  const minus = simulateClock({ ...base, ppm: -50 }, 10);
  assert.ok(plus.occupancyGroups > base.initialOccupancyGroups);
  assert.ok(minus.occupancyGroups < base.initialOccupancyGroups);
  assert.ok(plus.upstreamBacklogGroups > 0);
});

test('one millisecond margin at 50 ppm lasts 20 seconds at any fixed group rate', () => {
  assert.equal(secondsToMargin(3_072_000, 1, 50), 20);
});

test('duplicate grants add no credit, stale grants cannot retract, and packet sends obey absolute grant end', () => {
  const c = new CumulativeCredit(100, 60, 40);
  assert.equal(c.applyGrant(100), 'duplicate');
  assert.equal(c.applyGrant(90), 'stale');
  assert.equal(c.grantEndGroup, 100);
  assert.equal(c.canSend(40), true);
  assert.equal(c.canSend(41), false);
  c.send(40);
  assert.throws(() => c.send(1), /exceeds cumulative/);
});

test('cumulative send boundary rejects unsafe integer overflow', () => {
  const c = new CumulativeCredit(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 2, 0);
  assert.equal(c.canSend(2), true);
  assert.equal(c.canSend(3), false);
});

test('consumption is monotonic and cannot exceed sent data', () => {
  const c = new CumulativeCredit(100, 0, 0);
  c.send(40);
  c.consume(24);
  assert.throws(() => c.consume(12), /monotonic/);
  assert.throws(() => c.consume(41), /cannot pass sent/);
});

test('excessive packet delay misses its playout deadline', () => {
  assert.equal(packetArrivesBeforeDeadline(0.015, 0.02), true);
  assert.equal(packetArrivesBeforeDeadline(0.021, 0.02), false);
});

test('reference loss is bounded by declared holdover and causes local abort after expiry', () => {
  const within = simulateClock({ ...base, mode: 'common-reference', ppm: 12 }, 5, 4);
  const expired = simulateClock({ ...base, mode: 'common-reference' }, 7, 4);
  assert.equal(within.state, 'HOLDOVER');
  assert.equal(expired.state, 'MUTE_ABORT');
});

test('seeded packet timing is reproducible, increasing and resettable', () => {
  const a = packetTimes(100, 2, 5, 0x0a2a7);
  const b = packetTimes(100, 2, 5, 0x0a2a7);
  assert.deepEqual(a, b);
  assert.ok(a.every((t, i) => i === 0 || t > a[i - 1]!));
});

test('buffer underflow or overflow mutes instead of permitting invalid occupancy', () => {
  const under = simulateClock({ ...base, ppm: -500, initialOccupancyGroups: 10 }, 10);
  const over = simulateClock({ ...base, ppm: 500, initialOccupancyGroups: base.bufferGroups - 10 }, 10);
  assert.equal(under.state, 'MUTE_ABORT');
  assert.equal(under.occupancyGroups, 0);
  assert.equal(over.state, 'MUTE_ABORT');
  assert.equal(over.occupancyGroups, base.bufferGroups);
});
