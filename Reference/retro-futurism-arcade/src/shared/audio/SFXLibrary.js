import { tone, noiseBurst, fmVoice, deathSweep, drone } from './Synth.js';

/**
 * Named sound-effect recipes.
 *
 * Each entry is a function that builds a voice graph from the primitives in
 * `Synth.js`. Keeping them in one table rather than inline at call sites means
 * the whole game's sonic palette can be auditioned and retuned together, and it
 * makes the layering explicit — almost every good arcade sound is two or three
 * simple voices stacked, not one clever one.
 *
 * ### Voice budget
 *
 * `play()` enforces a per-name rate limit. Without it, a wave clear that
 * destroys eleven invaders in one tick schedules eleven identical explosions
 * within a millisecond of each other; they sum to roughly eleven times the
 * amplitude, slam the compressor, and produce a distorted thud instead of the
 * intended sound. The limiter keeps simultaneous identical events to a
 * musically useful number and drops the rest, which is inaudible because the
 * ones that did play mask them completely.
 */

/** Minimum seconds between two plays of the same effect name. */
const DEFAULT_RATE_LIMIT = 0.02;

/**
 * @typedef {(engine: import('./AudioEngine.js').AudioEngine, opts: object) => *} SfxRecipe
 */

/** @type {Record<string, {rateLimit?:number, play:SfxRecipe}>} */
export const SFX_RECIPES = {
  /**
   * Player weapon discharge.
   *
   * A fast upward saw sweep for the "charge release", plus a very short noise
   * transient for the mechanical snap of the launcher. The transient is what
   * makes it feel like a *device* firing rather than a synthesiser playing.
   */
  bolt: {
    rateLimit: 0.04,
    play(engine, opts = {}) {
      const pan = opts.pan || 0;
      tone(engine, {
        type: 'sawtooth',
        frequency: 880,
        frequencyEnd: 2200,
        duration: 0.06,
        attack: 0.002,
        decay: 0.02,
        sustain: 0.3,
        release: 0.05,
        gain: 0.16,
        filterType: 'lowpass',
        filterFrequency: 3000,
        filterFrequencyEnd: 6500,
        filterQ: 3.5,
        pan
      });
      noiseBurst(engine, {
        duration: 0.02,
        attack: 0.001,
        decay: 0.008,
        sustain: 0.1,
        release: 0.02,
        gain: 0.09,
        filterType: 'highpass',
        filterFrequency: 2400,
        filterQ: 0.8,
        pan
      });
    }
  },

  /**
   * A standard enemy destroyed.
   *
   * Ring-modulated square plus a filtered noise body. The square's descending
   * sweep gives it pitch — which is what makes it read as *something* dying
   * rather than as a generic crunch.
   */
  invaderDeath: {
    rateLimit: 0.03,
    play(engine, opts = {}) {
      const pan = opts.pan || 0;
      const pitch = opts.pitch || 1;
      noiseBurst(engine, {
        duration: 0.16,
        attack: 0.001,
        decay: 0.05,
        sustain: 0.3,
        release: 0.12,
        gain: 0.2,
        filterType: 'bandpass',
        filterFrequency: 1400 * pitch,
        filterFrequencyEnd: 340 * pitch,
        filterQ: 1.1,
        pan
      });
      tone(engine, {
        type: 'square',
        frequency: 320 * pitch,
        frequencyEnd: 90 * pitch,
        duration: 0.14,
        attack: 0.002,
        decay: 0.04,
        sustain: 0.4,
        release: 0.09,
        gain: 0.11,
        filterType: 'lowpass',
        filterFrequency: 2200,
        filterFrequencyEnd: 500,
        pan
      });
    }
  },

  /** A small chip of destructible cover breaking off. Tight and dry. */
  bunkerChip: {
    rateLimit: 0.03,
    play(engine, opts = {}) {
      noiseBurst(engine, {
        duration: 0.035,
        attack: 0.001,
        decay: 0.012,
        sustain: 0.2,
        release: 0.03,
        gain: 0.13,
        filterType: 'bandpass',
        filterFrequency: 1800,
        filterFrequencyEnd: 900,
        filterQ: 2.4,
        pan: opts.pan || 0
      });
    }
  },

  /** A projectile intercepted mid-air. Bright, metallic, satisfying. */
  intercept: {
    rateLimit: 0.02,
    play(engine, opts = {}) {
      const pan = opts.pan || 0;
      tone(engine, {
        type: 'triangle',
        frequency: 2400,
        frequencyEnd: 3600,
        duration: 0.05,
        attack: 0.001,
        decay: 0.015,
        sustain: 0.25,
        release: 0.05,
        gain: 0.13,
        pan
      });
      noiseBurst(engine, {
        duration: 0.04,
        attack: 0.001,
        decay: 0.01,
        sustain: 0.15,
        release: 0.03,
        gain: 0.08,
        filterType: 'highpass',
        filterFrequency: 3200,
        pan
      });
    }
  },

  /**
   * The march tick.
   *
   * Deliberately not a musical note — it is a low, short thud that sits under
   * the bass line. In the original this *was* the music; here it anchors the
   * generative score's rhythm so the two can never drift apart.
   */
  marchTick: {
    rateLimit: 0.01,
    play(engine, opts = {}) {
      const step = opts.step || 0;
      // Four descending pitches cycling with the step, exactly as the arcade did.
      const pitches = [110, 98, 87.3, 82.4];
      tone(engine, {
        type: 'triangle',
        frequency: pitches[step % 4],
        frequencyEnd: pitches[step % 4] * 0.82,
        duration: 0.09,
        attack: 0.004,
        decay: 0.03,
        sustain: 0.5,
        release: 0.05,
        gain: 0.13,
        filterType: 'lowpass',
        filterFrequency: 900,
        filterQ: 1.4
      });
    }
  },

  /** Formation descends one row. A heavier version of the march tick. */
  formationDrop: {
    rateLimit: 0.05,
    play(engine) {
      tone(engine, {
        type: 'sine',
        frequency: 120,
        frequencyEnd: 55,
        duration: 0.22,
        attack: 0.005,
        decay: 0.07,
        sustain: 0.6,
        release: 0.14,
        gain: 0.22,
        filterType: 'lowpass',
        filterFrequency: 700
      });
    }
  },

  /** High-value target destroyed. Layered and deliberately over-generous. */
  ufoDeath: {
    rateLimit: 0.1,
    play(engine) {
      noiseBurst(engine, {
        duration: 0.5,
        attack: 0.002,
        decay: 0.12,
        sustain: 0.45,
        release: 0.35,
        gain: 0.26,
        filterType: 'bandpass',
        filterFrequency: 2600,
        filterFrequencyEnd: 220,
        filterQ: 0.9
      });
      fmVoice(engine, {
        carrierFrequency: 660,
        modulatorFrequency: 180,
        modulationIndex: 420,
        modulationIndexEnd: 20,
        duration: 0.45,
        attack: 0.003,
        decay: 0.1,
        sustain: 0.5,
        release: 0.25,
        gain: 0.18
      });
      tone(engine, {
        type: 'sawtooth',
        frequency: 220,
        frequencyEnd: 48,
        duration: 0.55,
        attack: 0.004,
        decay: 0.15,
        sustain: 0.5,
        release: 0.3,
        gain: 0.15,
        filterType: 'lowpass',
        filterFrequency: 1400,
        filterFrequencyEnd: 200
      });
    }
  },

  /** The player destroyed. The most expensive sound in the game. */
  playerDeath: {
    rateLimit: 0.5,
    play(engine) {
      deathSweep(engine, {
        startFrequency: 400,
        endFrequency: 40,
        duration: 1.1,
        gain: 0.34,
        distortion: 46
      });
      noiseBurst(engine, {
        duration: 0.8,
        attack: 0.002,
        decay: 0.2,
        sustain: 0.4,
        release: 0.5,
        gain: 0.26,
        filterType: 'lowpass',
        filterFrequency: 2400,
        filterFrequencyEnd: 120,
        filterQ: 1.2
      });
    }
  },

  /** Wave cleared. Rising, resolved, brief. */
  waveClear: {
    rateLimit: 0.5,
    play(engine) {
      const root = 220;
      // A major triad arpeggiated upward — the only unambiguously "you won"
      // gesture in Western tonality, and it costs three oscillators.
      const intervals = [1, 1.25, 1.5, 2];
      for (let i = 0; i < intervals.length; i++) {
        window.setTimeout(() => {
          tone(engine, {
            type: 'triangle',
            frequency: root * intervals[i],
            duration: 0.18,
            attack: 0.005,
            decay: 0.05,
            sustain: 0.6,
            release: 0.2,
            gain: 0.14,
            filterType: 'lowpass',
            filterFrequency: 4200
          });
        }, i * 70);
      }
    }
  },

  /** Extra life awarded. */
  extraLife: {
    rateLimit: 0.5,
    play(engine) {
      for (let i = 0; i < 3; i++) {
        window.setTimeout(() => {
          tone(engine, {
            type: 'square',
            frequency: 660 * (1 + i * 0.25),
            frequencyEnd: 880 * (1 + i * 0.25),
            duration: 0.1,
            attack: 0.003,
            decay: 0.03,
            sustain: 0.5,
            release: 0.1,
            gain: 0.1,
            filterType: 'lowpass',
            filterFrequency: 5000
          });
        }, i * 60);
      }
    }
  },

  /** UI: selection moved. */
  uiMove: {
    rateLimit: 0.04,
    play(engine) {
      tone(engine, {
        type: 'square',
        frequency: 880,
        duration: 0.03,
        attack: 0.001,
        decay: 0.01,
        sustain: 0.3,
        release: 0.03,
        gain: 0.06,
        filterType: 'lowpass',
        filterFrequency: 3000
      });
    }
  },

  /** UI: selection confirmed. */
  uiConfirm: {
    rateLimit: 0.08,
    play(engine) {
      tone(engine, {
        type: 'square',
        frequency: 520,
        frequencyEnd: 1040,
        duration: 0.09,
        attack: 0.002,
        decay: 0.02,
        sustain: 0.5,
        release: 0.08,
        gain: 0.1,
        filterType: 'lowpass',
        filterFrequency: 4000
      });
    }
  },

  /** UI: rejected / back. */
  uiBack: {
    rateLimit: 0.08,
    play(engine) {
      tone(engine, {
        type: 'square',
        frequency: 440,
        frequencyEnd: 220,
        duration: 0.08,
        attack: 0.002,
        decay: 0.02,
        sustain: 0.4,
        release: 0.07,
        gain: 0.08,
        filterType: 'lowpass',
        filterFrequency: 2200
      });
    }
  }
};

/**
 * The SFX player. Owns rate limiting and holds handles to sustained voices.
 */
export class SFXLibrary {
  /** @param {import('./AudioEngine.js').AudioEngine} engine */
  constructor(engine) {
    this.engine = engine;
    /** @type {Map<string, number>} name -> context time of last play */
    this.lastPlayed = new Map();
    /** @type {Map<string, object>} name -> sustained voice handle */
    this.sustained = new Map();
    this.enabled = true;
  }

  /**
   * Play a named effect.
   * @param {keyof typeof SFX_RECIPES} name
   * @param {object} [opts] forwarded to the recipe
   * @returns {boolean} whether it actually played
   */
  play(name, opts = {}) {
    if (!this.enabled || !this.engine.available) return false;

    const entry = SFX_RECIPES[name];
    if (!entry) {
      console.warn(`SFXLibrary: unknown effect "${name}".`);
      return false;
    }

    const now = this.engine.now;
    const limit = entry.rateLimit !== undefined ? entry.rateLimit : DEFAULT_RATE_LIMIT;
    const last = this.lastPlayed.get(name);

    if (last !== undefined && now - last < limit) return false;

    this.lastPlayed.set(name, now);
    entry.play(this.engine, opts);
    return true;
  }

  /**
   * Start a sustained voice under a name, replacing any existing one.
   *
   * Used for the UFO warble. Keyed by name so a second UFO cannot leave the
   * first one's oscillator running forever — the classic way a looping game
   * sound ends up permanently stuck on.
   */
  startSustained(name, opts = {}) {
    if (!this.enabled || !this.engine.available) return null;
    this.stopSustained(name);
    const handle = drone(this.engine, opts);
    if (handle) this.sustained.set(name, handle);
    return handle;
  }

  /** Fetch a live sustained voice for modulation. */
  getSustained(name) {
    const handle = this.sustained.get(name);
    return handle && handle.alive ? handle : null;
  }

  /** Stop and release a sustained voice. */
  stopSustained(name, fade = 0.08) {
    const handle = this.sustained.get(name);
    if (handle) {
      handle.stop(fade);
      this.sustained.delete(name);
    }
  }

  /** Stop every sustained voice. Called on pause, death and teardown. */
  stopAllSustained(fade = 0.06) {
    for (const [name, handle] of this.sustained) {
      handle.stop(fade);
      this.sustained.delete(name);
    }
  }

  dispose() {
    this.stopAllSustained(0.02);
    this.lastPlayed.clear();
  }
}
