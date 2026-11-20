import { calculateBandwidth, formatRate } from './bandwidth.ts';
import { CumulativeCredit, packetTimes, ratesFor, simulateClock, secondsToMargin, type ClockScenario, type SourceMode } from './clockModel.ts';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing explore control: ${id}`);
  return node as T;
}

function mountCalculator() {
  const format = el<HTMLSelectElement>('format');
  const rate = el<HTMLInputElement>('rate');
  const channels = el<HTMLInputElement>('channels');
  const link = el<HTMLSelectElement>('link');
  const vlan = el<HTMLInputElement>('vlan');
  const target = el<HTMLInputElement>('target');
  const admission = el<HTMLSelectElement>('admission');
  const form = el<HTMLFormElement>('bandwidth-form');
  const update = () => {
    if (!form.checkValidity()) {
      el('group-warning').textContent = 'Enter a valid rate, channel count and packet target to calculate the link budget.';
      for (const id of ['raw-rate','wire-rate','wire-util','admission-result','groups','payload','interval','wire-bytes','headroom','mac-capacity','unused-capacity','o2at-header','ethernet-overhead']) el(id).textContent = '—';
      el<HTMLMeterElement>('meter').value = 0;
      return;
    }
    const result = calculateBandwidth({
      format: format.value as 'pcm' | 'dsd',
      rateHz: Number(rate.value),
      channels: Number(channels.value),
      linkGbps: Number(link.value) as 1 | 10,
      vlan: vlan.checked,
      packetTargetUs: Number(target.value),
      admissionPercent: Number(admission.value) as 80 | 85,
    });
    el('raw-rate').textContent = formatRate(result.rawAudioBps, 5);
    el('wire-rate').textContent = formatRate(result.occupiedBps, 5);
    el('wire-rate').setAttribute('aria-label', `Occupied wire rate ${formatRate(result.occupiedBps, 5)}`);
    el('wire-util').textContent = `${result.utilisationPercent.toLocaleString('en-GB', { maximumFractionDigits: 4 })}% of MAC service`;
    el('groups').textContent = String(result.groupsPerPacket);
    el('payload').textContent = `${result.payloadBytes.toLocaleString('en-GB')} bytes`;
    el('interval').textContent = `${result.packetIntervalUs.toLocaleString('en-GB', { maximumFractionDigits: 4 })} µs`;
    el('wire-bytes').textContent = `${result.wireBytes.toLocaleString('en-GB')} byte-times`;
    el('headroom').textContent = `${formatRate(result.headroomBps, 5)} ${result.headroomBps >= 0 ? 'below' : 'above'} ${admission.value}% ceiling`;
    el('mac-capacity').textContent = formatRate(result.macCapacityBps, 3);
    el('unused-capacity').textContent = formatRate(result.unusedMacCapacityBps, 5);
    el('o2at-header').textContent = `${result.protocolHeaderBytes} bytes`;
    el('ethernet-overhead').textContent = `${result.ethernetOverheadBytes} bytes`;
    const meter = el<HTMLMeterElement>('meter');
    meter.value = Math.min(100, Math.max(0, result.utilisationPercent));
    meter.setAttribute('aria-valuetext', `${result.utilisationPercent.toLocaleString('en-GB', { maximumFractionDigits: 2 })} percent of MAC service`);
    meter.classList.toggle('over', !result.admissionPass);
    el('admission-result').textContent = result.admissionPass ? `Within the ${admission.value}% policy ceiling.` : `Exceeds the ${admission.value}% policy ceiling.`;
    el('group-warning').textContent = result.atLeastOneGroupOverTarget ? 'Even one group exceeds this packetisation target. The model retains one group and reports the resulting interval.' : '';
    el('result-summary').textContent = `${channels.value} channels, ${format.value.toUpperCase()} at ${Number(rate.value).toLocaleString('en-GB')} ${format.value === 'pcm' ? 'samples/s' : 'bits/s'} per channel over ${link.value}G ${vlan.checked ? 'tagged' : 'untagged'} Ethernet.`;
  };
  for (const input of [format, rate, channels, link, vlan, target, admission]) input.addEventListener('input', update);
  update();
}

function mountClockLab() {
  const mode = el<HTMLSelectElement>('source-mode');
  const rate = el<HTMLSelectElement>('group-rate');
  const ppm = el<HTMLInputElement>('ppm');
  const marginMs = el<HTMLInputElement>('margin-ms');
  const seed = el<HTMLInputElement>('seed');
  const runButton = el<HTMLButtonElement>('play');
  let elapsed = 0;
  let timer: number | undefined;
  let referenceLostAt: number | undefined;
  let paused = true;

  const config = (): ClockScenario => {
    const groupRate = Number(rate.value);
    const bufferGroups = groupRate * Number(marginMs.value) / 500;
    const initialOccupancyGroups = bufferGroups / 2;
    return {
      mode: mode.value as SourceMode,
      groupRate,
      ppm: Number(ppm.value),
      bufferGroups,
      initialOccupancyGroups,
      holdoverSeconds: 5,
    };
  };
  const render = () => {
    const scenario = config();
    const result = simulateClock(scenario, elapsed, referenceLostAt);
    el('clock-now').textContent = `${elapsed.toFixed(1)} s`;
    el('producer-rate').textContent = `${Math.round(result.producerRate).toLocaleString('en-GB')} groups/s`;
    el('receiver-rate').textContent = `${Math.round(result.receiverRate).toLocaleString('en-GB')} groups/s`;
    el('occupancy').textContent = `${result.occupancyGroups.toLocaleString('en-GB', { maximumFractionDigits: 1 })} groups (${result.occupancyPercent.toFixed(1)}%)`;
    el('backlog').textContent = `${result.upstreamBacklogGroups.toLocaleString('en-GB', { maximumFractionDigits: 1 })} groups`;
    el('clock-reason').textContent = result.reason;
    el('clock-state').textContent = result.state;
    el('clock-state').setAttribute('class', `status-note clock-status ${result.state === 'MUTE_ABORT' ? 'is-alert' : ''}`);
    el<HTMLProgressElement>('fifo-level').value = result.occupancyPercent;
    for (const n of ['OPEN', 'CLOCK_VALID', 'PREFILL', 'RUNNING', 'HOLDOVER', 'MUTE_ABORT']) {
      const pill = document.getElementById(`state-${n}`);
      pill?.classList.toggle('active', n === result.state || (result.state === 'RUNNING' && ['OPEN','CLOCK_VALID','PREFILL'].includes(n)));
    }
    const effectivePpm = ratesFor(scenario).ppm;
    const driftSeconds = secondsToMargin(scenario.groupRate, Number(marginMs.value), effectivePpm);
    el('time-to-margin').textContent = Number.isFinite(driftSeconds) ? `${driftSeconds.toLocaleString('en-GB', { maximumFractionDigits: 2 })} s analytical margin` : 'No sustained mismatch in this scenario';
    const times = packetTimes(8, 0.125, 3, Number(seed.value) || 1);
    el('packet-times').textContent = times.map(x => x.toFixed(3)).join(' · ') + ' ms';
    el('simulation-state').textContent = paused ? 'Paused' : 'Playing at 4× model time';
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries({ mode: mode.value, rate: rate.value, ppm: ppm.value, margin: marginMs.value, seed: seed.value })) url.searchParams.set(key, value);
    history.replaceState(null, '', url);
  };
  const pause = () => { if (timer) window.clearInterval(timer); timer = undefined; paused = true; runButton.textContent = 'Play'; runButton.setAttribute('aria-pressed', 'false'); };
  const start = () => {
    if (timer) window.clearInterval(timer);
    paused = false;
    runButton.textContent = 'Pause';
    runButton.setAttribute('aria-pressed', 'true');
    timer = window.setInterval(() => {
      elapsed += 0.4;
      render();
      if (el('clock-state').textContent === 'MUTE_ABORT') pause();
    }, 100);
  };
  const setControlFromQuery = (key: string, input: HTMLInputElement | HTMLSelectElement, min: number, max: number) => {
    const v = new URLSearchParams(location.search).get(key);
    if (v === null) return;
    const n = Number(v);
    if (Number.isFinite(n) && n >= min && n <= max) input.value = v;
  };
  const requestedMode = new URLSearchParams(location.search).get('mode');
  if (requestedMode && ['elastic', 'common-reference', 'independent-fixed'].includes(requestedMode)) mode.value = requestedMode;
  setControlFromQuery('rate', rate, 1, 100_000_000);
  setControlFromQuery('ppm', ppm, -500, 500);
  setControlFromQuery('margin', marginMs, 0.1, 20);
  setControlFromQuery('seed', seed, 1, 2_147_483_647);

  runButton.addEventListener('click', () => paused ? start() : pause());
  el('reset').addEventListener('click', () => { pause(); elapsed = 0; referenceLostAt = undefined; render(); });
  el('lose-reference').addEventListener('click', () => { referenceLostAt = elapsed; render(); });
  for (const input of [mode, rate, ppm, marginMs, seed]) input.addEventListener('input', () => { pause(); render(); });
  el('copy-scenario').addEventListener('click', async () => {
    const output = el<HTMLInputElement>('scenario-url');
    output.value = window.location.href;
    output.hidden = false;
    try { await navigator.clipboard.writeText(output.value); el('copy-status').textContent = 'Scenario link copied.'; }
    catch { output.focus(); output.select(); el('copy-status').textContent = 'Scenario link selected. Copy it using your browser or keyboard shortcut.'; }
  });
  render();
}

function mountPacketInspector() {
  const credits = new CumulativeCredit(180, 0, 0);
  el('packet-hex').textContent = '6f 32 61 74 20 b4 12 34 56 78 00 00';
  el('packet-fields').textContent = 'magic 0x6f32 · version/type 0x61/0x74 · flags and format 0x20/0xb4 · session 0x12345678 · sequence 0';
  el('credit-permission').textContent = `grant_end_group=${credits.grantEndGroup}; packet_groups=180; permitted=${credits.canSend(180)}`;
}

export function mountExplore() {
  if (document.getElementById('bandwidth-form')) mountCalculator();
  if (document.getElementById('clock-lab')) mountClockLab();
  if (document.getElementById('packet-inspector')) mountPacketInspector();
}
