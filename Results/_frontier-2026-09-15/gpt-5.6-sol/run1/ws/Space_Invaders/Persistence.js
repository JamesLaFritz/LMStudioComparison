import { CONFIG } from './config.js';

export const STORAGE_KEY = CONFIG.storageKey;

const defaultProfile = () => ({
  version: CONFIG.version,
  highScore: 0,
  muted: false,
  reducedMotion: typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)').matches
    : false,
  reducedFlashes: false,
});

export function sanitizeProfile(value) {
  const defaults = defaultProfile();
  if (!value || typeof value !== 'object') return defaults;
  return {
    version: CONFIG.version,
    highScore: Number.isFinite(value.highScore) ? Math.max(0, Math.floor(value.highScore)) : 0,
    muted: Boolean(value.muted),
    reducedMotion: Boolean(value.reducedMotion),
    reducedFlashes: Boolean(value.reducedFlashes),
  };
}

export function loadProfile() {
  try {
    return sanitizeProfile(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProfile(profile)));
    return true;
  } catch {
    return false;
  }
}
