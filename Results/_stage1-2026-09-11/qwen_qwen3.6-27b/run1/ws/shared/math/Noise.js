/**
 * Simplex Noise — 2D and 3D, seeded.
 * Ported/adapted for vanilla JS with explicit seed control.
 */

// Permutation table — built from seed
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3;
const G3 = 1 / 6;

let perm = new Uint8Array(512);
let permMod12 = new Uint8Array(512);

export function seedNoise(seed) {
    // Build permutation table from seed using a simple LCG
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    // Fisher-Yates shuffle with seeded RNG
    let s = seed | 0;
    for (let i = 255; i > 0; i--) {
        s = (s * 16807 + 0) % 2147483647;
        const j = s % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
    }

    perm = new Uint8Array(512);
    permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
        perm[i] = p[i & 255];
        permMod12[i] = perm[i] % 12;
    }
}

// Default seed
seedNoise(42);

// Gradient vectors for 2D
const grad2 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [1, 0], [-1, 0],
    [0, 1], [0, -1], [0, 1], [0, -1]
];

// Gradient vectors for 3D
const grad3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
];

/** 2D Simplex Noise */
export function noise2D(xin, yin) {
    let n0, n1, n2;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0;
    else {
        t0 *= t0;
        n0 = t0 * t0 * (grad2[permMod12[ii + perm[jj]]][0] * x0 + grad2[permMod12[ii + perm[jj]]][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0;
    else {
        t1 *= t1;
        n1 = t1 * t1 * (grad2[permMod12[ii + i1 + perm[jj + j1]]][0] * x1 + grad2[permMod12[ii + i1 + perm[jj + j1]]][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0;
    else {
        t2 *= t2;
        n2 = t2 * t2 * (grad2[permMod12[ii + 1 + perm[jj + 1]]][0] * x2 + grad2[permMod12[ii + 1 + perm[jj + 1]]][1] * y2);
    }

    return 70 * (n0 + n1 + n2);
}

/** 3D Simplex Noise */
export function noise3D(xin, yin, zin) {
    let n0, n1, n2, n3;

    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    const z0 = zin - Z0;

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) n0 = 0;
    else {
        t0 *= t0;
        const g = grad3[permMod12[ii + perm[jj + perm[kk]]]];
        n0 = t0 * t0 * (g[0] * x0 + g[1] * y0 + g[2] * z0);
    }

    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) n1 = 0;
    else {
        t1 *= t1;
        const g = grad3[permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]];
        n1 = t1 * t1 * (g[0] * x1 + g[1] * y1 + g[2] * z1);
    }

    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) n2 = 0;
    else {
        t2 *= t2;
        const g = grad3[permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]];
        n2 = t2 * t2 * (g[0] * x2 + g[1] * y2 + g[2] * z2);
    }

    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) n3 = 0;
    else {
        t3 *= t3;
        const g = grad3[permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]];
        n3 = t3 * t3 * (g[0] * x3 + g[1] * y3 + g[2] * z3);
    }

    return 32 * (n0 + n1 + n2 + n3);
}

/** Fractal Brownian Motion — layers multiple octaves of noise */
export function fbm2D(x, y, octaves, persistence, lacunarity) {
    if (octaves === undefined) octaves = 4;
    if (persistence === undefined) persistence = 0.5;
    if (lacunarity === undefined) lacunarity = 2.0;

    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
        value += amplitude * noise2D(x * frequency, y * frequency);
        maxAmplitude += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }

    return value / maxAmplitude;
}

/** 3D FBM */
export function fbm3D(x, y, z, octaves, persistence, lacunarity) {
    if (octaves === undefined) octaves = 4;
    if (persistence === undefined) persistence = 0.5;
    if (lacunarity === undefined) lacunarity = 2.0;

    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
        value += amplitude * noise3D(x * frequency, y * frequency, z * frequency);
        maxAmplitude += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }

    return value / maxAmplitude;
}

/** Ridge noise — inverted and abs'd FBM for sharp features */
export function ridge2D(x, y, octaves, persistence, lacunarity) {
    if (octaves === undefined) octaves = 4;
    if (persistence === undefined) persistence = 0.5;
    if (lacunarity === undefined) lacunarity = 2.0;

    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmplitude = 0;
    let previous = 1;

    for (let i = 0; i < octaves; i++) {
        let signal = noise2D(x * frequency, y * frequency);
        signal = Math.abs(signal);
        signal = previous * (1 - signal);
        value += amplitude * signal;
        maxAmplitude += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
        previous = signal;
    }

    return value / maxAmplitude;
}

/** Value noise (simpler, faster, less organic) */
export function valueNoise2D(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;

    const ux = xf * xf * (3 - 2 * xf);
    const uy = yf * yf * (3 - 2 * yf);

    const hash = (a, b) => {
        let h = (a * 2654435761 ^ b * 2246822519) | 0;
        h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
        h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
        return ((h >> 16) ^ h) & 255;
    };

    const v00 = hash(xi, yi) / 255;
    const v10 = hash(xi + 1, yi) / 255;
    const v01 = hash(xi, yi + 1) / 255;
    const v11 = hash(xi + 1, yi + 1) / 255;

    const left = v00 + (v10 - v00) * ux;
    const right = v01 + (v11 - v01) * ux;

    return (left + (right - left) * uy) * 2 - 1;
}
