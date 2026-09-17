/**
 * In-place vertex displacement helpers. Operate directly on a BufferGeometry's
 * position attribute so callers control when to call computeVertexNormals().
 */
export const GeometryDisplace = {
  /** Displace each vertex along its local normal by noise sampled in XZ space. */
  displaceByNoise(geometry, noiseField, amplitude = 0.2, frequency = 0.5) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const n = noiseField.noise2D(x * frequency, z * frequency);
      const nx = normal.getX(i);
      const ny = normal.getY(i);
      const nz = normal.getZ(i);
      position.setXYZ(i, x + nx * n * amplitude, y + ny * n * amplitude, z + nz * n * amplitude);
    }
    position.needsUpdate = true;
  },

  /** Sine-wave ripple along Y, useful for energy-field / shield-style surfaces. */
  rippleSineY(geometry, time, amplitude = 0.1, frequency = 2, speed = 1) {
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const baseY = position.getY(i);
      const wave = Math.sin(x * frequency + time * speed) * Math.cos(z * frequency + time * speed);
      position.setY(i, baseY + wave * amplitude);
    }
    position.needsUpdate = true;
  }
};
