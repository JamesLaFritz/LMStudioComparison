const DEFAULT_VOLUMES = Object.freeze({ sfx: 0.78, music: 0.42, ambience: 0.28 });

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createNoiseBuffer(context, seconds = 2) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x9e3779b9;
  let previous = 0;
  for (let i = 0; i < length; i += 1) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const white = ((seed >>> 0) / 0xffffffff) * 2 - 1;
    previous = previous * 0.86 + white * 0.14;
    data[i] = clamp(white * 0.72 + previous * 0.28, -1, 1);
  }
  return buffer;
}

export class SynthAudioEngine {
  constructor({ AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext } = {}) {
    this.AudioContextClass = AudioContextClass;
    this.context = null;
    this.masterGain = null;
    this.compressor = null;
    this.buses = null;
    this.toneVoices = [];
    this.musicVoices = [];
    this.noiseVoices = [];
    this.noiseSource = null;
    this.sequences = new Map();
    this.sequenceSerial = 0;
    this.muted = false;
    this.volumes = { ...DEFAULT_VOLUMES };
    this.disposed = false;
  }

  get unlocked() {
    return Boolean(this.context && this.context.state !== 'closed');
  }

  async unlock() {
    if (this.disposed || !this.AudioContextClass) return false;
    try {
      if (!this.context) this.#createGraph();
      if (this.context.state === 'suspended') await this.context.resume();
      return this.context.state === 'running';
    } catch {
      return false;
    }
  }

  #createGraph() {
    const context = new this.AudioContextClass({ latencyHint: 'interactive' });
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;
    const masterGain = context.createGain();
    masterGain.gain.value = this.muted ? 0 : 0.9;
    compressor.connect(masterGain).connect(context.destination);

    const buses = {
      sfx: context.createGain(),
      music: context.createGain(),
      ambience: context.createGain(),
    };
    for (const [name, bus] of Object.entries(buses)) {
      bus.gain.value = this.volumes[name];
      bus.connect(compressor);
    }

    this.context = context;
    this.compressor = compressor;
    this.masterGain = masterGain;
    this.buses = buses;
    this.toneVoices = this.#createToneBank(16, buses.sfx);
    this.musicVoices = this.#createToneBank(4, buses.music);
    this.#createNoiseBank(4, buses.sfx);
  }

  #createToneBank(count, destination) {
    const voices = [];
    for (let index = 0; index < count; index += 1) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const panner = this.context.createStereoPanner();
      oscillator.type = 'sine';
      oscillator.frequency.value = 110;
      gain.gain.value = 0;
      oscillator.connect(gain).connect(panner).connect(destination);
      oscillator.start();
      voices.push({ oscillator, gain, panner, destination, busyUntil: 0, priority: -1 });
    }
    return voices;
  }

  #createNoiseBank(count, destination) {
    const source = this.context.createBufferSource();
    source.buffer = createNoiseBuffer(this.context);
    source.loop = true;
    for (let index = 0; index < count; index += 1) {
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      const panner = this.context.createStereoPanner();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;
      filter.Q.value = 0.8;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(panner).connect(destination);
      this.noiseVoices.push({ filter, gain, panner, destination, busyUntil: 0, priority: -1 });
    }
    source.start();
    this.noiseSource = source;
  }

  #selectVoice(bank, now, priority) {
    let selected = null;
    for (const voice of bank) {
      if (voice.busyUntil <= now) return voice;
      if (voice.priority < priority && (!selected || voice.priority < selected.priority || (voice.priority === selected.priority && voice.busyUntil < selected.busyUntil))) {
        selected = voice;
      }
    }
    return selected;
  }

  #routeVoice(voice, destination) {
    if (!voice || !destination || voice.destination === destination) return;
    voice.panner.disconnect();
    voice.panner.connect(destination);
    voice.destination = destination;
  }

  playTone(spec = {}) {
    if (!this.unlocked || this.context.state !== 'running') return null;
    const now = Math.max(this.context.currentTime, Number(spec.when) || 0);
    const duration = clamp(Number(spec.duration) || 0.1, 0.012, 8);
    const priority = clamp(Number(spec.priority) || 0, 0, 9);
    const busName = spec.bus === 'music' || spec.bus === 'ambience' ? spec.bus : 'sfx';
    const bank = busName === 'music' ? this.musicVoices : this.toneVoices;
    const voice = this.#selectVoice(bank, now, priority);
    if (!voice) return null;
    this.#routeVoice(voice, this.buses[busName]);

    const attack = clamp(Number(spec.attack) || 0.004, 0.001, duration * 0.45);
    const release = clamp(Number(spec.release) || Math.min(0.08, duration * 0.45), 0.002, duration * 0.8);
    const peak = clamp(Number(spec.gain) || 0.16, 0.0001, 0.8);
    const startFrequency = clamp(Number(spec.frequency) || 440, 20, 18000);
    const endFrequency = clamp(Number(spec.endFrequency) || startFrequency, 20, 18000);
    const end = now + duration;
    const gain = voice.gain.gain;
    const frequency = voice.oscillator.frequency;

    voice.oscillator.type = ['sine', 'square', 'sawtooth', 'triangle'].includes(spec.type) ? spec.type : 'sine';
    voice.panner.pan.setValueAtTime(clamp(Number(spec.pan) || 0, -1, 1), now);
    frequency.cancelScheduledValues(now);
    frequency.setValueAtTime(startFrequency, now);
    frequency.exponentialRampToValueAtTime(endFrequency, end);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0.0001, now);
    gain.exponentialRampToValueAtTime(peak, now + attack);
    gain.setValueAtTime(peak, Math.max(now + attack, end - release));
    gain.exponentialRampToValueAtTime(0.0001, end);
    gain.setValueAtTime(0, end + 0.002);
    voice.busyUntil = end + 0.003;
    voice.priority = priority;
    return voice;
  }

  playNoise(spec = {}) {
    if (!this.unlocked || this.context.state !== 'running') return null;
    const now = Math.max(this.context.currentTime, Number(spec.when) || 0);
    const duration = clamp(Number(spec.duration) || 0.08, 0.012, 5);
    const priority = clamp(Number(spec.priority) || 0, 0, 9);
    const voice = this.#selectVoice(this.noiseVoices, now, priority);
    if (!voice) return null;
    const busName = spec.bus === 'ambience' ? 'ambience' : 'sfx';
    this.#routeVoice(voice, this.buses[busName]);
    const end = now + duration;
    const peak = clamp(Number(spec.gain) || 0.12, 0.0001, 0.8);
    const attack = clamp(Number(spec.attack) || 0.002, 0.001, duration * 0.4);
    const startFrequency = clamp(Number(spec.frequency) || 1200, 40, 18000);
    const endFrequency = clamp(Number(spec.endFrequency) || Math.max(40, startFrequency * 0.25), 40, 18000);
    voice.filter.type = spec.filterType ?? 'bandpass';
    voice.filter.Q.setValueAtTime(clamp(Number(spec.q) || 0.9, 0.0001, 30), now);
    voice.filter.frequency.cancelScheduledValues(now);
    voice.filter.frequency.setValueAtTime(startFrequency, now);
    voice.filter.frequency.exponentialRampToValueAtTime(endFrequency, end);
    voice.panner.pan.setValueAtTime(clamp(Number(spec.pan) || 0, -1, 1), now);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(0.0001, now);
    voice.gain.gain.exponentialRampToValueAtTime(peak, now + attack);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, end);
    voice.gain.gain.setValueAtTime(0, end + 0.002);
    voice.busyUntil = end + 0.003;
    voice.priority = priority;
    return voice;
  }

  startSequence(spec = {}) {
    if (this.disposed || !Array.isArray(spec.notes) || spec.notes.length === 0) return null;
    const id = spec.id ?? `sequence-${++this.sequenceSerial}`;
    this.stopSequence(id);
    const beatSeconds = 60 / clamp(Number(spec.tempo) || 120, 20, 600);
    let noteIndex = 0;
    const playNext = () => {
      if (!this.sequences.has(id) || this.disposed) return;
      const note = spec.notes[noteIndex];
      this.playTone({
        bus: spec.bus ?? 'music',
        priority: spec.priority ?? 3,
        type: note.type ?? spec.type ?? 'triangle',
        frequency: note.frequency,
        endFrequency: note.endFrequency ?? note.frequency,
        duration: (note.durationBeats ?? 0.75) * beatSeconds,
        gain: note.gain ?? spec.gain ?? 0.1,
        pan: note.pan ?? 0,
      });
      noteIndex += 1;
      if (noteIndex >= spec.notes.length) {
        if (!spec.loop) {
          this.stopSequence(id);
          return;
        }
        noteIndex = 0;
      }
      const delay = Math.max(8, (note.stepBeats ?? 1) * beatSeconds * 1000);
      const record = this.sequences.get(id);
      if (record) record.timer = globalThis.setTimeout(playNext, delay);
    };
    this.sequences.set(id, { timer: globalThis.setTimeout(playNext, 0) });
    return id;
  }

  stopSequence(id) {
    const record = this.sequences.get(id);
    if (!record) return false;
    globalThis.clearTimeout(record.timer);
    this.sequences.delete(id);
    return true;
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.masterGain && this.context?.state !== 'closed') {
      const now = this.context.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.9, now, 0.015);
    }
  }

  setVolumes(sfx = this.volumes.sfx, music = this.volumes.music, ambience = this.volumes.ambience) {
    this.volumes.sfx = clamp(Number(sfx), 0, 1);
    this.volumes.music = clamp(Number(music), 0, 1);
    this.volumes.ambience = clamp(Number(ambience), 0, 1);
    if (this.buses && this.context?.state !== 'closed') {
      const now = this.context.currentTime;
      for (const name of Object.keys(this.buses)) {
        this.buses[name].gain.cancelScheduledValues(now);
        this.buses[name].gain.setTargetAtTime(this.volumes[name], now, 0.02);
      }
    }
  }

  async suspend() {
    if (!this.unlocked || this.context.state !== 'running') return false;
    try {
      await this.context.suspend();
      return true;
    } catch {
      return false;
    }
  }

  async resume() {
    if (!this.unlocked || this.context.state !== 'suspended') return false;
    try {
      await this.context.resume();
      return this.context.state === 'running';
    } catch {
      return false;
    }
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const id of [...this.sequences.keys()]) this.stopSequence(id);
    for (const voice of [...this.toneVoices, ...this.musicVoices]) {
      try { voice.gain.gain.cancelScheduledValues(0); } catch {}
      try { voice.oscillator.stop(); } catch {}
      try { voice.oscillator.disconnect(); } catch {}
      try { voice.gain.disconnect(); } catch {}
      try { voice.panner.disconnect(); } catch {}
    }
    for (const voice of this.noiseVoices) {
      try { voice.gain.gain.cancelScheduledValues(0); } catch {}
      try { voice.filter.disconnect(); } catch {}
      try { voice.gain.disconnect(); } catch {}
      try { voice.panner.disconnect(); } catch {}
    }
    try { this.noiseSource?.stop(); } catch {}
    try { this.noiseSource?.disconnect(); } catch {}
    for (const bus of Object.values(this.buses ?? {})) {
      try { bus.disconnect(); } catch {}
    }
    try { this.compressor?.disconnect(); } catch {}
    try { this.masterGain?.disconnect(); } catch {}
    if (this.context && this.context.state !== 'closed') {
      try { await this.context.close(); } catch {}
    }
    this.toneVoices.length = 0;
    this.musicVoices.length = 0;
    this.noiseVoices.length = 0;
    this.buses = null;
    this.context = null;
  }
}
