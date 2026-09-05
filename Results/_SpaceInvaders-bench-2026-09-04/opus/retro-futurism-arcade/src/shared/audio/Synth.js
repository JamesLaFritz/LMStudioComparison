/**
 * Synthesis primitives.
 *
 * Every sound in this arcade is built from these. There are no audio files, so
 * the entire sonic identity of the project comes out of oscillators, filtered
 * noise, and envelopes.
 *
 * ### Node lifetime
 *
 * Web Audio nodes are one-shot: an `OscillatorNode` that has been started and
 * stopped cannot be restarted, and a graph left connected after it has gone
 * silent still occupies a slot in the audio thread's processing list. Every
 * helper here therefore schedules its own `stop()` and disconnects on
 * `onended`. Skipping that teardown is how a Web Audio game slowly develops
 * crackling and then drops out entirely after a few minutes of play.
 *
 * ### Envelopes and clicks
 *
 * Gain is never assigned directly on a sounding voice. An instantaneous jump
 * from 0 to 1 is a step discontinuity, which is heard as a click. Every voice
 * ramps, and every release uses `exponentialRampToValueAtTime` — which cannot
 * reach exactly zero, hence the small epsilon floor used throughout.
 */

/** Smallest value an exponential ramp may target. Zero is undefined for it. */
const EPS = 0.0001;

/**
 * Apply an ADSR-style gain envelope to a gain node.
 *
 * @param {GainNode} gain
 * @param {number} t0 start time in context seconds
 * @param {object} env
 * @param {number} env.attack
 * @param {number} env.decay
 * @param {number} env.sustain  0..1 level, not a duration
 * @param {number} env.release
 * @param {number} env.duration time from t0 until the release begins
 * @param {number} env.peak     0..1 level at the end of the attack
 * @returns {number} the time at which the voice has fully died
 */
export function applyEnvelope(gain, t0, env) {
  const {
    attack = 0.005,
    decay = 0.05,
    sustain = 0.6,
    release = 0.08,
    duration = 0.2,
    peak = 1
  } = env;

  const p = gain.gain;
  const sustainLevel = Math.max(EPS, peak * sustain);

  p.cancelScheduledValues(t0);
  p.setValueAtTime(EPS, t0);
  p.exponentialRampToValueAtTime(Math.max(EPS, peak), t0 + attack);
  p.exponentialRampToValueAtTime(sustainLevel, t0 + attack + decay);

  const releaseStart = t0 + Math.max(attack + decay, duration);
  p.setValueAtTime(sustainLevel, releaseStart);
  p.exponentialRampToValueAtTime(EPS, releaseStart + release);

  return releaseStart + release;
}

/**
 * Disconnect a set of nodes once the source has finished.
 *
 * A tiny grace period is added because `onended` fires at the scheduled stop
 * time, and disconnecting a node whose release ramp is still audible truncates
 * it into — of course — a click.
 */
export function scheduleTeardown(source, nodes, graceSeconds = 0.05) {
  source.onended = () => {
    // The grace timer is in wall-clock milliseconds; this runs on the main
    // thread, well after the audio thread has finished with the nodes.
    window.setTimeout(() => {
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          /* already disconnected */
        }
      }
    }, graceSeconds * 1000);
  };
}

/**
 * A pitched oscillator voice with an optional frequency sweep and filter.
 *
 * The frequency sweep is what turns a beep into a *sound*: a static sine is
 * inert, while the same sine glided from 880Hz to 2200Hz over 60ms reads as a
 * discharge. Almost every effect in this project is a sweep.
 *
 * @param {import('./AudioEngine.js').AudioEngine} engine
 * @param {object} opts
 * @returns {number} time at which the voice ends, or 0 if audio is unavailable
 */
export function tone(engine, opts = {}) {
  if (!engine.available) return 0;

  const ctx = engine.ctx;
  const {
    type = 'sine',
    frequency = 440,
    frequencyEnd = null,
    sweepShape = 'exponential',
    detune = 0,
    duration = 0.2,
    attack = 0.005,
    decay = 0.05,
    sustain = 0.6,
    release = 0.08,
    gain = 0.3,
    destination = null,
    filterType = null,
    filterFrequency = 2000,
    filterFrequencyEnd = null,
    filterQ = 1,
    pan = 0
  } = opts;

  const t0 = ctx.currentTime;
  const dest = destination || engine.sfxBus;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(Math.max(1, frequency), t0);

  if (frequencyEnd !== null && frequencyEnd !== frequency) {
    const target = Math.max(1, frequencyEnd);
    if (sweepShape === 'linear') {
      osc.frequency.linearRampToValueAtTime(target, t0 + duration);
    } else {
      osc.frequency.exponentialRampToValueAtTime(target, t0 + duration);
    }
  }

  const gainNode = ctx.createGain();
  const nodes = [osc, gainNode];

  let head = osc;

  if (filterType) {
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = filterQ;
    filter.frequency.setValueAtTime(Math.max(20, filterFrequency), t0);
    if (filterFrequencyEnd !== null) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(20, filterFrequencyEnd),
        t0 + duration
      );
    }
    head.connect(filter);
    head = filter;
    nodes.push(filter);
  }

  head.connect(gainNode);

  if (pan !== 0 && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gainNode.connect(panner);
    panner.connect(dest);
    nodes.push(panner);
  } else {
    gainNode.connect(dest);
  }

  const endTime = applyEnvelope(gainNode, t0, {
    attack,
    decay,
    sustain,
    release,
    duration,
    peak: gain
  });

  osc.start(t0);
  osc.stop(endTime + 0.02);
  scheduleTeardown(osc, nodes);

  return endTime;
}

/**
 * A filtered noise burst.
 *
 * Noise plus a bandpass is the foundation of every impact, explosion and
 * mechanical sound here. The filter's centre frequency is what distinguishes
 * them: 1.8kHz reads as a sharp chip of masonry, 300Hz as a heavy thud, and a
 * downward sweep across that whole range reads as something large collapsing.
 */
export function noiseBurst(engine, opts = {}) {
  if (!engine.available || !engine.noiseBuffer) return 0;

  const ctx = engine.ctx;
  const {
    duration = 0.12,
    attack = 0.001,
    decay = 0.03,
    sustain = 0.35,
    release = 0.06,
    gain = 0.3,
    filterType = 'bandpass',
    filterFrequency = 1200,
    filterFrequencyEnd = null,
    filterQ = 1.2,
    playbackRate = 1,
    destination = null,
    pan = 0
  } = opts;

  const t0 = ctx.currentTime;
  const dest = destination || engine.sfxBus;

  const source = ctx.createBufferSource();
  source.buffer = engine.noiseBuffer;
  source.playbackRate.value = playbackRate;
  // Start at a random offset so repeated bursts do not replay identical noise,
  // which would be audible as an obviously looped texture.
  const maxOffset = Math.max(0, engine.noiseBuffer.duration - duration - 0.05);
  const offset = Math.random() * maxOffset;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.Q.value = filterQ;
  filter.frequency.setValueAtTime(Math.max(20, filterFrequency), t0);
  if (filterFrequencyEnd !== null) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(20, filterFrequencyEnd),
      t0 + duration
    );
  }

  const gainNode = ctx.createGain();
  const nodes = [source, filter, gainNode];

  source.connect(filter);
  filter.connect(gainNode);

  if (pan !== 0 && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gainNode.connect(panner);
    panner.connect(dest);
    nodes.push(panner);
  } else {
    gainNode.connect(dest);
  }

  const endTime = applyEnvelope(gainNode, t0, {
    attack,
    decay,
    sustain,
    release,
    duration,
    peak: gain
  });

  source.start(t0, offset);
  source.stop(endTime + 0.02);
  scheduleTeardown(source, nodes);

  return endTime;
}

/**
 * A two-operator FM voice.
 *
 * One oscillator modulates another's frequency. At low modulator rates this is
 * vibrato; at audio rates it generates inharmonic sidebands and becomes the
 * cheapest route to metallic, bell-like and distinctly *electronic* timbres.
 * The UFO warble is exactly this: a 520Hz carrier with a 7Hz modulator at an
 * index of 90.
 */
export function fmVoice(engine, opts = {}) {
  if (!engine.available) return 0;

  const ctx = engine.ctx;
  const {
    carrierFrequency = 440,
    carrierType = 'sine',
    modulatorFrequency = 110,
    modulatorType = 'sine',
    modulationIndex = 100,
    modulationIndexEnd = null,
    duration = 0.4,
    attack = 0.01,
    decay = 0.08,
    sustain = 0.7,
    release = 0.15,
    gain = 0.25,
    destination = null
  } = opts;

  const t0 = ctx.currentTime;
  const dest = destination || engine.sfxBus;

  const carrier = ctx.createOscillator();
  carrier.type = carrierType;
  carrier.frequency.value = carrierFrequency;

  const modulator = ctx.createOscillator();
  modulator.type = modulatorType;
  modulator.frequency.value = modulatorFrequency;

  // The modulator's output is scaled by a gain node and added to the carrier's
  // frequency. That gain *is* the modulation index, in Hz of deviation.
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(modulationIndex, t0);
  if (modulationIndexEnd !== null) {
    modGain.gain.linearRampToValueAtTime(modulationIndexEnd, t0 + duration);
  }

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  const gainNode = ctx.createGain();
  carrier.connect(gainNode);
  gainNode.connect(dest);

  const endTime = applyEnvelope(gainNode, t0, {
    attack,
    decay,
    sustain,
    release,
    duration,
    peak: gain
  });

  carrier.start(t0);
  modulator.start(t0);
  carrier.stop(endTime + 0.02);
  modulator.stop(endTime + 0.02);

  scheduleTeardown(carrier, [carrier, modulator, modGain, gainNode]);

  return endTime;
}

/**
 * Build a waveshaper curve for distortion.
 *
 * The classic arctangent-style transfer function. Used on the player-death
 * sound, where clean synthesis sounds far too polite for the moment.
 *
 * @param {number} amount 0 = linear, higher = harder clipping
 * @param {number} samples resolution of the lookup table
 */
export function makeDistortionCurve(amount = 40, samples = 1024) {
  const curve = new Float32Array(samples);
  const k = amount;
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/**
 * A distorted, descending sweep. The "you died" primitive.
 */
export function deathSweep(engine, opts = {}) {
  if (!engine.available) return 0;

  const ctx = engine.ctx;
  const {
    startFrequency = 400,
    endFrequency = 40,
    duration = 1.1,
    gain = 0.4,
    distortion = 40,
    destination = null
  } = opts;

  const t0 = ctx.currentTime;
  const dest = destination || engine.sfxBus;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(startFrequency, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), t0 + duration);

  const shaper = ctx.createWaveShaper();
  shaper.curve = makeDistortionCurve(distortion);
  shaper.oversample = '2x';

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3200, t0);
  filter.frequency.exponentialRampToValueAtTime(180, t0 + duration);
  filter.Q.value = 2.2;

  const gainNode = ctx.createGain();

  osc.connect(shaper);
  shaper.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(dest);

  const endTime = applyEnvelope(gainNode, t0, {
    attack: 0.004,
    decay: 0.1,
    sustain: 0.8,
    release: 0.25,
    duration,
    peak: gain
  });

  osc.start(t0);
  osc.stop(endTime + 0.02);
  scheduleTeardown(osc, [osc, shaper, filter, gainNode]);

  return endTime;
}

/**
 * A sustained, controllable drone voice.
 *
 * Unlike the one-shot helpers this returns a handle so the caller can modulate
 * and stop it — used for the UFO, whose warble must persist for as long as it
 * is on screen and stop the instant it is destroyed.
 *
 * @returns {{stop:(fade?:number)=>void, setFrequency:(f:number, ramp?:number)=>void,
 *            setGain:(g:number, ramp?:number)=>void, alive:boolean}|null}
 */
export function drone(engine, opts = {}) {
  if (!engine.available) return null;

  const ctx = engine.ctx;
  const {
    carrierFrequency = 520,
    modulatorFrequency = 7,
    modulationIndex = 90,
    gain = 0.16,
    attack = 0.08,
    destination = null
  } = opts;

  const t0 = ctx.currentTime;
  const dest = destination || engine.sfxBus;

  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = carrierFrequency;

  const modulator = ctx.createOscillator();
  modulator.type = 'sine';
  modulator.frequency.value = modulatorFrequency;

  const modGain = ctx.createGain();
  modGain.gain.value = modulationIndex;
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(EPS, t0);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(EPS, gain), t0 + attack);

  carrier.connect(gainNode);
  gainNode.connect(dest);

  carrier.start(t0);
  modulator.start(t0);

  const handle = {
    alive: true,
    setFrequency(f, ramp = 0.05) {
      if (!handle.alive) return;
      carrier.frequency.setTargetAtTime(Math.max(1, f), ctx.currentTime, ramp);
    },
    setGain(g, ramp = 0.05) {
      if (!handle.alive) return;
      gainNode.gain.setTargetAtTime(Math.max(EPS, g), ctx.currentTime, ramp);
    },
    stop(fade = 0.08) {
      if (!handle.alive) return;
      handle.alive = false;
      const t = ctx.currentTime;
      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setValueAtTime(Math.max(EPS, gainNode.gain.value), t);
      gainNode.gain.exponentialRampToValueAtTime(EPS, t + fade);
      carrier.stop(t + fade + 0.02);
      modulator.stop(t + fade + 0.02);
      scheduleTeardown(carrier, [carrier, modulator, modGain, gainNode]);
    }
  };

  return handle;
}
