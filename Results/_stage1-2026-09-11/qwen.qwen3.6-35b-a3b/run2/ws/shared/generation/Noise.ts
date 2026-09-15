// Simplex-like noise using layered sine waves for procedural generation
export class Noise {
  private static seed: number = 42;

  static setSeed(seed: number): void {
    this.seed = seed;
  }

  static hash(x: number, y: number): number {
    let h = this.seed + x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return (h ^ (h >> 16)) / 2147483648.0;
  }

  static smoothNoise(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const v1 = this.hash(ix, iy);
    const v2 = this.hash(ix + 1, iy);
    const v3 = this.hash(ix, iy + 1);
    const v4 = this.hash(ix + 1, iy + 1);

    const i1 = v1 * (1 - fx) + v2 * fx;
    const i2 = v3 * (1 - fx) + v4 * fx;
    return i1 * (1 - fy) + i2 * fy;
  }

  static octaveNoise(x: number, y: number, octaves: number, persistence: number): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.smoothNoise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }

  static displacement(value: number, scale: number): number {
    return Math.sin(value * scale) * 0.1 + Math.cos(value * scale * 0.7) * 0.05;
  }
}