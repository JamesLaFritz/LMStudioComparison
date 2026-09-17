import { loadJson, saveJson } from '../../shared/storage/SafeStorage.js';

const STORAGE_KEY = 'space-invaders:command-profile:v1';
const QUALITY_MODES = new Set(['auto', 'forced-high', 'forced-low']);

export const DEFAULT_PROFILE = Object.freeze({
  highScore: 0,
  qualityMode: 'auto',
  reducedMotion: false,
  highContrast: false,
  muted: false,
  sfxVolume: 0.78,
  musicVolume: 0.32,
  ambienceVolume: 0.28,
});

const volume = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
};

const sanitize = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : DEFAULT_PROFILE;
  const score = Number(source.highScore);
  return {
    highScore: Number.isFinite(score) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(score))) : 0,
    qualityMode: QUALITY_MODES.has(source.qualityMode) ? source.qualityMode : DEFAULT_PROFILE.qualityMode,
    reducedMotion: typeof source.reducedMotion === 'boolean' ? source.reducedMotion : DEFAULT_PROFILE.reducedMotion,
    highContrast: typeof source.highContrast === 'boolean' ? source.highContrast : DEFAULT_PROFILE.highContrast,
    muted: typeof source.muted === 'boolean' ? source.muted : DEFAULT_PROFILE.muted,
    sfxVolume: volume(source.sfxVolume, DEFAULT_PROFILE.sfxVolume),
    musicVolume: volume(source.musicVolume, DEFAULT_PROFILE.musicVolume),
    ambienceVolume: volume(source.ambienceVolume, DEFAULT_PROFILE.ambienceVolume),
  };
};

/** Read and schema-sanitize the small persistent command profile. */
export function loadProfile() {
  return sanitize(loadJson(STORAGE_KEY, DEFAULT_PROFILE));
}

/** Persist only validated profile fields; storage failures are deliberately nonfatal. */
export function saveProfile(profile) {
  return saveJson(STORAGE_KEY, sanitize(profile));
}

