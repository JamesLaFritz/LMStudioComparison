export function createNoiseBuffer(context, duration = 0.2) {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let state = 0x4b1d2ef7;
  for (let index = 0; index < length; index += 1) {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    data[index] = (((value ^ (value >>> 14)) >>> 0) / 2147483648 - 1) * 0.82;
  }
  return buffer;
}

export function scheduleTone(context, destination, {
  frequency = 220,
  endFrequency = frequency,
  duration = 0.12,
  gain = 0.12,
  type = 'square',
  detune = 0,
} = {}) {
  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.detune.setValueAtTime(detune, start);
  oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.015);
  return { source: oscillator, nodes: [oscillator, envelope] };
}

export function scheduleNoise(context, destination, {
  duration = 0.16,
  gain = 0.1,
  frequency = 900,
  endFrequency = 180,
} = {}) {
  const start = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context, duration);
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.max(10, frequency), start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(10, endFrequency), start + duration);
  envelope.gain.setValueAtTime(Math.max(0.0001, gain), start);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(destination);
  source.start(start);
  source.stop(start + duration + 0.015);
  return { source, nodes: [source, filter, envelope] };
}
