// Shared constants for all games in the collection

export const COLORS = {
  // Neon palette
  neonCyan: 0x00ffff,
  neonMagenta: 0xff00ff,
  neonYellow: 0xffff00,
  neonGreen: 0x00ff00,
  neonRed: 0xff0000,
  neonBlue: 0x0088ff,
  neonWhite: 0xffffff,
  
  // Backgrounds
  deepSpace: 0x0a0a1a,
  gridDark: 0x1a1a2e,
  
  // UI
  glassBg: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  textGlow: '0 0 10px rgba(0, 255, 255, 0.8)'
};

export const PHYSICS = {
  gravity: 9.81,
  defaultFriction: 0.97,
  collisionTolerance: 0.1
};

export const VFX = {
  maxParticles: 500,
  hitStopBaseFrames: 8,
  cameraShakeDecay: 0.92,
  bloomThreshold: 0.85,
  bloomStrength: 1.4,
  bloomRadius: 0.4
};

export const AUDIO = {
  masterVolume: 0.7,
  sfxVolume: 0.6,
  musicVolume: 0.4
};

export default { COLORS, PHYSICS, VFX, AUDIO };
