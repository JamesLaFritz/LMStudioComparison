/**
 * Simplex Noise Implementation
 * Portable simplex noise algorithm for procedural generation
 */

export class SimplexNoise {
    constructor(seed = Math.random()) {
        this.p = new Uint8Array(256);
        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);
        
        // Initialize permutation table with seed
        for (let i = 0; i < 256; i++) {
            this.p[i] = i;
        }
        
        // Shuffle based on seed
        let s = seed * 2147483647;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807) % 2147483647;
            const j = s % (i + 1);
            const temp = this.p[i];
            this.p[i] = this.p[j];
            this.p[j] = temp;
        }
        
        // Build permutation and mod12 tables
        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
        
        // Gradients for 2D and 3D
        this.grad3 = [
            [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
            [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
            [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
        ];
        
        this.grad2 = [
            [1, 1], [-1, 1], [1, -1], [-1, -1]
        ];
        
        // Skewing factors
        this.F2 = 0.5 * (Math.sqrt(3) - 1);
        this.G2 = (3 - Math.sqrt(3)) / 6;
        
        this.F3 = 1 / 3;
        this.G3 = 1 / 6;
    }
    
    // 2D Simplex Noise
    noise2D(xin, yin) {
        const n0, n1, n2;
        
        // Skew input space to determine which simplex cell we're in
        const s = (xin + yin) * this.F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        
        const t = (i + j) * this.G2;
        const X0 = i - t;
        const Y0 = j - t;
        
        const x0 = xin - X0;
        const y0 = yin - Y0;
        
        // Determine which simplex we're in
        let i1, j1;
        if (x0 > y0) {
            i1 = 1;
            j1 = 0;
        } else {
            i1 = 0;
            j1 = 1;
        }
        
        const x1 = x0 - i1 + this.G2;
        const y1 = y0 - j1 + this.G2;
        const x2 = x0 - 1 + 2 * this.G2;
        const y2 = y0 - 1 + 2 * this.G2;
        
        // Hash coordinates of the 3 simplex corners
        const ii = i & 255;
        const jj = j & 255;
        
        // Calculate contribution from first corner
        const t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) {
            n0 = 0;
        } else {
            const gi0 = this.permMod12[ii + jj] % 4;
            t0 *= t0;
            n0 = t0 * t0 * (this.grad2[gi0][0] * x0 + this.grad2[gi0][1] * y0);
        }
        
        // Calculate contribution from second corner
        const t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) {
            n1 = 0;
        } else {
            const gi1 = this.permMod12[ii + i1 + jj + j1] % 4;
            t1 *= t1;
            n1 = t1 * t1 * (this.grad2[gi1][0] * x1 + this.grad2[gi1][1] * y1);
        }
        
        // Calculate contribution from third corner
        const t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) {
            n2 = 0;
        } else {
            const gi2 = this.permMod12[ii + 1 + jj + 1] % 4;
            t2 *= t2;
            n2 = t2 * t2 * (this.grad2[gi2][0] * x2 + this.grad2[gi2][1] * y2);
        }
        
        // Scale to [-1, 1]
        return 70 * (n0 + n1 + n2);
    }
    
    // 3D Simplex Noise
    noise3D(xin, yin, zin) {
        let n0, n1, n2, n3;
        
        const s = (xin + yin + zin) * this.F3;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const k = Math.floor(zin + s);
        
        const t = (i + j + k) * this.G3;
        const X0 = i - t;
        const Y0 = j - t;
        const Z0 = k - t;
        
        const x0 = xin - X0;
        const y0 = yin - Y0;
        const z0 = zin - Z0;
        
        // Determine simplex cell
        let i1, j1, k1;
        let i2, j2, k2;
        
        if (x0 >= y0) {
            if (y0 >= z0) {
                i1 = 1; j1 = 0; k1 = 0;
                i2 = 1; j2 = 1; k2 = 0;
            } else if (x0 >= z0) {
                i1 = 1; j1 = 0; k1 = 0;
                i2 = 1; j2 = 0; k2 = 1;
            } else {
                i1 = 0; j1 = 0; k1 = 1;
                i2 = 1; j2 = 0; k2 = 1;
            }
        } else {
            if (y0 < z0) {
                i1 = 0; j1 = 1; k1 = 0;
                i2 = 0; j2 = 1; k2 = 1;
            } else if (x0 < z0) {
                i1 = 0; j1 = 1; k1 = 0;
                i2 = 1; j2 = 1; k2 = 0;
            } else {
                i1 = 1; j1 = 1; k1 = 0;
                i2 = 1; j2 = 0; k2 = 1;
            }
        }
        
        const x1 = x0 - i1 + this.G3;
        const y1 = y0 - j1 + this.G3;
        const z1 = z0 - k1 + this.G3;
        
        const x2 = x0 - i2 + 2 * this.G3;
        const y2 = y0 - j2 + 2 * this.G3;
        const z2 = z0 - k2 + 2 * this.G3;
        
        const x3 = x0 - 1 + 3 * this.G3;
        const y3 = y0 - 1 + 3 * this.G3;
        const z3 = z0 - 1 + 3 * this.G3;
        
        const ii = i & 255;
        const jj = j & 255;
        const kk = k & 255;
        
        // First corner
        const t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
        if (t0 < 0) {
            n0 = 0;
        } else {
            const gi0 = this.permMod12[ii + jj + kk] % 12;
            t0 *= t0;
            n0 = t0 * t0 * (this.grad3[gi0][0] * x0 + this.grad3[gi0][1] * y0 + this.grad3[gi0][2] * z0);
        }
        
        // Second corner
        const t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
        if (t1 < 0) {
            n1 = 0;
        } else {
            const gi1 = this.permMod12[ii + i1 + jj + j1 + kk + k1] % 12;
            t1 *= t1;
            n1 = t1 * t1 * (this.grad3[gi1][0] * x1 + this.grad3[gi1][1] * y1 + this.grad3[gi1][2] * z1);
        }
        
        // Third corner
        const t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
        if (t2 < 0) {
            n2 = 0;
        } else {
            const gi2 = this.permMod12[ii + i2 + jj + j2 + kk + k2] % 12;
            t2 *= t2;
            n2 = t2 * t2 * (this.grad3[gi2][0] * x2 + this.grad3[gi2][1] * y2 + this.grad3[gi2][2] * z2);
        }
        
        // Fourth corner
        const t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
        if (t3 < 0) {
            n3 = 0;
        } else {
            const gi3 = this.permMod12[ii + 1 + jj + 1 + kk + 1] % 12;
            t3 *= t3;
            n3 = t3 * t3 * (this.grad3[gi3][0] * x3 + this.grad3[gi3][1] * y3 + this.grad3[gi3][2] * z3);
        }
        
        return 32 * (n0 + n1 + n2 + n3);
    }
    
    // Value noise (simpler, faster but less smooth)
    valueNoise2D(x, y, scale = 1) {
        const xi = Math.floor(x * scale);
        const yi = Math.floor(y * scale);
        
        const xf = x * scale - xi;
        const yf = y * scale - yi;
        
        // Get values at corners
        const v00 = this.noise2D(xi, yi);
        const v10 = this.noise2D(xi + 1, yi);
        const v01 = this.noise2D(xi, yi + 1);
        const v11 = this.noise2D(xi + 1, yi + 1);
        
        // Smooth interpolation
        const ix = this.smoothstep(xf);
        const iy = this.smoothstep(yf);
        
        return this.lerp(this.lerp(v00, v10, ix), this.lerp(v01, v11, ix), iy);
    }
    
    lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    smoothstep(t) {
        return t * t * (3 - 2 * t);
    }
}

// Singleton instance with default seed
export const simplexNoise = new SimplexNoise();
