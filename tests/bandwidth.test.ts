import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBandwidth, occupiedByteTimes } from '../src/client/bandwidth.ts';

const pcm = (rateHz: number, channels: number, admissionPercent: 80 | 85 = 85) => calculateBandwidth({
  format: 'pcm', rateHz, channels, linkGbps: 1, vlan: true, packetTargetUs: 125, admissionPercent,
});

test('required tagged 1G PCM examples use exact v0.2 wire accounting', () => {
  assert.equal(pcm(48_000, 2).occupiedBps, 6_528_000);
  assert.equal(pcm(768_000, 2).occupiedBps, 52_608_000);
  assert.equal(pcm(3_072_000, 2).occupiedBps, 203_980_800);
  assert.equal(pcm(2_822_400, 8).occupiedBps, 749_629_440);
  assert.equal(pcm(3_072_000, 8).occupiedBps, 815_923_200);
  assert.ok(Math.abs(pcm(3_072_000, 16).occupiedBps - 1_633_186_909.090909) < 0.001);
  const extremeEight = pcm(3_072_000, 8);
  assert.equal(extremeEight.macCapacityBps, 1_000_000_000);
  assert.equal(extremeEight.payloadBytes, 1_440);
  assert.equal(extremeEight.protocolHeaderBytes, 12);
  assert.equal(extremeEight.unusedMacCapacityBps, 184_076_800);
});

test('DSD families have the same transport budget as equivalent PCM group rates', () => {
  const a = calculateBandwidth({ format: 'dsd', rateHz: 90_316_800, channels: 8, linkGbps: 1, vlan: true, packetTargetUs: 125, admissionPercent: 85 });
  const b = pcm(2_822_400, 8);
  const c = calculateBandwidth({ format: 'dsd', rateHz: 98_304_000, channels: 8, linkGbps: 1, vlan: true, packetTargetUs: 125, admissionPercent: 85 });
  const d = pcm(3_072_000, 8);
  assert.equal(a.occupiedBps, b.occupiedBps);
  assert.equal(c.occupiedBps, d.occupiedBps);
});

test('eight-channel high extreme passes 85 percent and fails 80 percent', () => {
  assert.equal(pcm(3_072_000, 8, 85).admissionPass, true);
  assert.equal(pcm(3_072_000, 8, 80).admissionPass, false);
});

test('minimum frame occupancy includes tagged and untagged padding', () => {
  assert.equal(occupiedByteTimes(8, false), 84);
  assert.equal(occupiedByteTimes(8, true), 84);
  assert.equal(occupiedByteTimes(32, false), 84);
  assert.equal(occupiedByteTimes(32, true), 86);
});

test('one group is retained when the requested deadline is shorter than one group', () => {
  const r = calculateBandwidth({ format: 'pcm', rateHz: 8_000, channels: 2, linkGbps: 1, vlan: false, packetTargetUs: 1, admissionPercent: 85 });
  assert.equal(r.groupsPerPacket, 1);
  assert.equal(r.atLeastOneGroupOverTarget, true);
});
