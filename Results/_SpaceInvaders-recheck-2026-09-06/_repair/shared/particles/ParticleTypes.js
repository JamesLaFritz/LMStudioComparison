// Particle type definitions — constants used by ParticleManager
export const PARTICLE_TYPES = {
  BURST: 'burst',
  SPARK: 'spark',
  TRAIL: 'trail',
  SHOCKWAVE: 'shockwave',
  EXPLOSION: 'explosion',
};

// Burst particle config — small spherical particles radiating outward
export const BURST_CONFIG = {
  count: 12,
  speedMin: 2.0,
  speedMax: 6.0,
  lifetime: 0.4,
  size: 0.15,
  color: new Float32Array([1.0, 0.8, 0.2]), // warm gold
};

// Spark particle config — elongated fast particles with gravity-like falloff
export const SPARK_CONFIG = {
  count: 8,
  speedMin: 4.0,
  speedMax: 10.0,
  lifetime: 0.25,
  size: 0.08,
  color: new Float32Array([1.0, 0.4, 0.1]), // orange-red
};

// Trail particle config — fading particles left behind a moving object
export const TRAIL_CONFIG = {
  count: 1,
  speedMin: 0.0,
  speedMax: 0.0,
  lifetime: 0.3,
  size: 0.2,
  color: new Float32Array([0.5, 0.8, 1.0]), // cyan-blue
};

// Shockwave ring config — expanding emissive torus/ring geometry
export const SHOCKWAVE_CONFIG = {
  initialRadius: 0.1,
  maxRadius: 3.0,
  lifetime: 0.6,
  color: new Float32Array([1.0, 0.5, 0.0]), // orange
};

// Explosion particle config — large volumetric burst with longer life
export const EXPLOSION_CONFIG = {
  count: 24,
  speedMin: 1.0,
  speedMax: 8.0,
  lifetime: 0.8,
  size: 0.3,
  color: new Float32Array([1.0, 0.6, 0.1]), // deep orange
};
