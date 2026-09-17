import { loadJson, saveJson } from '../storage/SafeStorage.js';

const DEFAULT_STORAGE_KEY = 'aaa-retro-arcade:accessibility';

function clampVolume(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
}

/** Persistent accessibility/audio preference store with system-motion fallback. */
export class AccessibilityPreferences {
  constructor({
    storageKey = DEFAULT_STORAGE_KEY,
    storage,
    matchMedia = globalThis.matchMedia?.bind(globalThis),
  } = {}) {
    this._storageKey = String(storageKey || DEFAULT_STORAGE_KEY);
    this._storage = storage;
    this._listeners = new Set();
    this._disposed = false;
    this._loaded = false;
    this._motionOverride = null;
    this._highContrast = false;
    this._sfxVolume = 0.8;
    this._musicVolume = 0.55;
    this._ambienceVolume = 0.45;
    this._media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    this._systemReducedMotion = Boolean(this._media?.matches);
    this._onSystemMotionChange = this._onSystemMotionChange.bind(this);
    if (typeof this._media?.addEventListener === 'function') {
      this._media.addEventListener('change', this._onSystemMotionChange);
    } else if (typeof this._media?.addListener === 'function') {
      this._media.addListener(this._onSystemMotionChange);
    }
  }

  load() {
    if (this._disposed) throw new Error('Cannot load disposed AccessibilityPreferences');
    const stored = loadJson(this._storageKey, null, this._storage);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      this._motionOverride = typeof stored.reducedMotion === 'boolean' ? stored.reducedMotion : null;
      this._highContrast = Boolean(stored.highContrast);
      this._sfxVolume = clampVolume(stored.sfxVolume, this._sfxVolume);
      this._musicVolume = clampVolume(stored.musicVolume, this._musicVolume);
      this._ambienceVolume = clampVolume(stored.ambienceVolume, this._ambienceVolume);
    }
    this._loaded = true;
    return this.getSnapshot({});
  }

  getSnapshot(target = {}) {
    target.reducedMotion = this._motionOverride ?? this._systemReducedMotion;
    target.highContrast = this._highContrast;
    target.sfxVolume = this._sfxVolume;
    target.musicVolume = this._musicVolume;
    target.ambienceVolume = this._ambienceVolume;
    return target;
  }

  setReducedMotion(value) {
    this._assertUsable();
    const next = Boolean(value);
    if (next === this._motionOverride) return false;
    this._motionOverride = next;
    this._commitAndNotify();
    return true;
  }

  setHighContrast(value) {
    this._assertUsable();
    const next = Boolean(value);
    if (next === this._highContrast) return false;
    this._highContrast = next;
    this._commitAndNotify();
    return true;
  }

  setVolumes(values = {}) {
    this._assertUsable();
    const sfx = clampVolume(values.sfx ?? values.sfxVolume, this._sfxVolume);
    const music = clampVolume(values.music ?? values.musicVolume, this._musicVolume);
    const ambience = clampVolume(values.ambience ?? values.ambienceVolume, this._ambienceVolume);
    if (sfx === this._sfxVolume && music === this._musicVolume && ambience === this._ambienceVolume) return false;
    this._sfxVolume = sfx;
    this._musicVolume = music;
    this._ambienceVolume = ambience;
    this._commitAndNotify();
    return true;
  }

  subscribe(listener) {
    this._assertUsable();
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    this._listeners.add(listener);
    let subscribed = true;
    return () => {
      if (!subscribed) return false;
      subscribed = false;
      return this._listeners.delete(listener);
    };
  }

  dispose() {
    if (this._disposed) return;
    if (typeof this._media?.removeEventListener === 'function') {
      this._media.removeEventListener('change', this._onSystemMotionChange);
    } else if (typeof this._media?.removeListener === 'function') {
      this._media.removeListener(this._onSystemMotionChange);
    }
    this._listeners.clear();
    this._media = null;
    this._storage = null;
    this._disposed = true;
  }

  _assertUsable() {
    if (this._disposed) throw new Error('AccessibilityPreferences has been disposed');
    if (!this._loaded) this.load();
  }

  _serialize() {
    return {
      reducedMotion: this._motionOverride,
      highContrast: this._highContrast,
      sfxVolume: this._sfxVolume,
      musicVolume: this._musicVolume,
      ambienceVolume: this._ambienceVolume,
    };
  }

  _commitAndNotify() {
    saveJson(this._storageKey, this._serialize(), this._storage);
    for (const listener of this._listeners) listener(this.getSnapshot({}));
  }

  _onSystemMotionChange(event) {
    const previous = this._motionOverride ?? this._systemReducedMotion;
    this._systemReducedMotion = Boolean(event?.matches);
    const next = this._motionOverride ?? this._systemReducedMotion;
    if (next !== previous) {
      for (const listener of this._listeners) listener(this.getSnapshot({}));
    }
  }
}
