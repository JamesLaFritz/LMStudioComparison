/**
 * SFX — named synthesized sound effects.
 *
 * Every builder is a pure function: (ctx, dest, opts) => void.
 *   ctx    — AudioContext
 *   dest   — AudioNode to connect into (usually the SFX bus)
 *   opts   — { volume = 1, pitch = 1 }
 *
 * No state, no allocation beyond the nodes the WebAudio graph needs.
 */

function env(ctx, t0, { a = 0.005, d = 0.1, s = 0, r = 0.1, peak = 1 } = {}) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  if (s > 0) {
    g.gain.setTargetAtTime(peak * s, t0 + a, d);
    g.gain.setTargetAtTime(0.0001, t0 + a + d, r);
  } else {
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  return g;
}

function osc(ctx, type, freq) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

function noiseBuffer(ctx, seconds = 1) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function noiseSource(ctx, seconds = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, seconds);
  return src;
}

function bandpass(ctx, freq, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function lowpass(ctx, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/* ── named builders ─────────────────────────────────────────────── */

export function explosion(ctx, dest, { volume = 1, pitch = 1 } = {}) {
  const t0 = ctx.currentTime;
  // low thump
  const o = osc(ctx, 'sine', 90 * pitch);
  o.frequency.exponentialRampToValueAtTime(28 * pitch, t0 + 0.4);
  const og = env(ctx, t0, { a: 0.004, d: 0.35, r: 0.2, peak: 0.9 * volume });
  o.connect(og).connect(dest);
  o.start(t0); o.stop(t0 + 0.6);
  // noise body
  const n = noiseSource(ctx, 0.8);
  const f = lowpass(ctx, 1800 * pitch);
  f.frequency.exponentialRampToValueAtTime(120, t0 + 0.5);
  const ng = env(ctx, t0, { a: 0.003, d: 0.45, r: 0.15, peak: 0.55 * volume });
  n.connect(f).connect(ng).connect(dest);
  n.start(t0); n.stop(t0 + 0.8);
}

export function hit(ctx, dest, { volume = 1, pitch = 1 } = {}) {
  const t0 = ctx.currentTime;
  const o = osc(ctx, 'square', 220 * pitch);
  o.frequency.exponentialRampToValueAtTime(60 * pitch, t0 + 0.12);
  const g = env(ctx, t0, { a: 0.002, d: 0.12, r: 0.05, peak: 0.5 * volume });
  o.connect(g).connect(dest);
  o.start(t0); o.stop(t0 + 0.2);
  const n = noiseSource(ctx, 0.15);
  const f = bandpass(ctx, 2400 * pitch, 1.2);
  const ng = env(ctx, t0, { a: 0.002, d: 0.08, r: 0.03, peak: 0.3 * volume });
  n.connect(f).connect(ng).connect(dest);
  n.start(t0); n.stop(t0 + 0.15);
}

export function laser(ctx, dest, { volume = 1, pitch = 1 } = {}) {
  const t0 = ctx.currentTime;
  const o = osc(ctx, 'sawtooth', 880 * pitch);
  o.frequency.exponentialRampToValueAtTime(180 * pitch, t0 + 0.14);
  const g = env(ctx, t0, { a: 0.002, d: 0.14, r: 0.04, peak: 0.35 * volume });
  const f = bandpass(ctx, 1200 * pitch, 2);
  o.connect(f).connect(g).connect(dest);
  o.start(t0); o.stop(t0 + 0.2);
}

export function wallBounce(ctx, dest, { volume = 1, pitch = 1 } = {}) {
  const t0 = ctx.currentTime;
  const o = osc(ctx, 'triangle', 320 * pitch);
  o.frequency.exponentialRampToValueAtTime(140 * pitch, t0 + 0.08);
  const g = env(ctx, t0, { a: 0.002, d: 0.08, r: 0.03, peak: 0.3 * volume });
  o.connect(g).connect(dest);
  o.start(t0); o.stop(t0 + 0.12);
}

export function score(ctx, dest, { volume = 1, pitch = 1 } = {}) {
  const t0 = ctx.currentTime;
  const notes = [660, 880, 1320];
  notes.forEach((f, i) => {
    const o = osc(ctx, 'square', f * pitch);
    const g = env(ctx, t0 + i * 0.05, { a: 0.002, d: 0.09, r: 0.03, peak: 0.22 * volume });
    o.connect(g).connect(dest);
    o.start(t0 + i * 0.05); o.stop(t0 + i * 0.05 + 0.12);
  });
}

export function powerup(ctx, dest, { volume = 1, pitch = 1 } = {}) {
  const t0 = ctx.currentTime;
  const o = osc(ctx, 'sine', 330 * pitch);
  o.frequency.exponentialRampToValueAtTime(1760 * pitch, t0 + 0.3);
  const g = env(ctx, t0, { a: 0.01, d: 0.3, r: 0.1, peak: 0.4 * volume });
  o.connect(g).connect(dest);
  o.start(t0); o.stop(t0 + 0.45);
  const o2 = osc(ctx, 'sine', 495 * pitch);
  o2.frequency.exponentialRampToValueAtTime(2640 * pitch, t0 + 0.3);
  const g2 = env(ctx, t0, { a: 0.01, d: 0.3, r: 0.1, peak: 0.2 * volume });
  o2.connect(g2).connect(dest);
  o2.start(t0); o2.stop(t0 + 0.45);
}

export function gameover(ctx, dest, { volume = 1, pitch = 1 } = {}) {
  const t0 = ctx.currentTime;
  const notes = [440, 349, 294, 220];
  notes.forEach((f, i) => {
    const o = osc(ctx, 'sawtooth', f * pitch);
    const g = env(ctx, t0 + i * 0.18, { a: 0.01, d: 0.22, r: 0.08, peak: 0.3 * volume });
    const fl = lowpass(ctx, 1600);
    o.connect(fl).connect(g).connect(dest);
    o.start(t0 + i * 0.18); o.stop(t0 + i * 0.18 + 0.35);
  });
}

export function uiClick(ctx, dest, { volume = 1, pitch = 1 } = {}) {
  const t0 = ctx.currentTime;
  const o = osc(ctx, 'sine', 1200 * pitch);
  const g = env(ctx, t0, { a: 0.001, d: 0.05, r: 0.02, peak: 0.25 * volume });
  o.connect(g).connect(dest);
  o.start(t0); o.stop(t0 + 0.08);
}

export function siren(ctx, dest, { volume = 1, pitch = 1, duration = 0.6 } = {}) {
  const t0 = ctx.currentTime;
  const o = osc(ctx, 'sawtooth', 520 * pitch);
  const lfo = osc(ctx, 'sine', 5.5);
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 180 * pitch;
  lfo.connect(lfoGain).connect(o.frequency);
  const g = env(ctx, t0, { a: 0.02, d: duration, r: 0.1, peak: 0.22 * volume });
  const f = bandpass(ctx, 900, 1.5);
  o.connect(f).connect(g).connect(dest);
  o.start(t0); o.stop(t0 + duration + 0.2);
  lfo.start(t0); lfo.stop(t0 + duration + 0.2);
}

export function nuke(ctx, dest, { volume = 1, pitch = 1 } = {}) {
  const t0 = ctx.currentTime;
  const o = osc(ctx, 'sine', 60 * pitch);
  o.frequency.exponentialRampToValueAtTime(24 * pitch, t0 + 1.2);
  const g = env(ctx, t0, { a: 0.01, d: 1.1, r: 0.4, peak: 1.0 * volume });
  o.connect(g).connect(dest);
  o.start(t0); o.stop(t0 + 1.6);
  const n = noiseSource(ctx, 1.4);
  const f = lowpass(ctx, 3000);
  f.frequency.exponentialRampToValueAtTime(80, t0 + 1.2);
  const ng = env(ctx, t0, { a: 0.005, d: 1.0, r: 0.3, peak: 0.7 * volume });
  n.connect(f).connect(ng).connect(dest);
  n.start(t0); n.stop(t0 + 1.4);
}

export const SFX_MAP = {
  explosion, hit, laser, wallBounce, score, powerup, gameover, uiClick, siren, nuke,
};

export function playSfx(ctx, dest, name, opts = {}) {
  const fn = SFX_MAP[name];
  if (fn) fn(ctx, dest, opts);
}

export function listSfx() {
  return Object.keys(SFX_MAP);
}
