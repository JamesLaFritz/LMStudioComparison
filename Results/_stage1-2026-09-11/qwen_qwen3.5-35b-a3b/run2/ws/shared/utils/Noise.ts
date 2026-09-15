// Simplex Noise Implementation - Pure JavaScript
// Based on Stefan Gustavson's implementation

export class SimplexNoise {
    private perm: Uint8Array;
    private p: Uint8Array;

    constructor(seed?: number) {
        this.perm = new Uint8Array(512);
        this.p = new Uint8Array(512);
        
        const gradient3 = [
            [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
            [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
            [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
        ];

        if (seed !== undefined) {
            this.seed(seed);
        } else {
            for (let i = 0; i < 256; i++) {
                this.p[i] = Math.floor(Math.random() * 256);
            }
            for (let i = 0; i < 512; i++) {
                this.perm[i] = this.p[i & 255];
            }
        }

        this.gradient3 = gradient3;
    }

    private seed(seed: number): void {
        const randArray = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            randArray[i] = Math.floor(Math.random() * 256);
        }
        
        // Fisher-Yates shuffle
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [randArray[i], randArray[j]] = [randArray[j], randArray[i]];
        }

        for (let i = 0; i < 256; i++) {
            this.p[i] = randArray[i];
            this.perm[i] = randArray[i];
            this.perm[256 + i] = randArray[i];
        }
    }

    private gradient3: Array<[number, number, number]>;

    public noise2D(x: number, y: number): number {
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const G2 = (3 - Math.sqrt(3)) / 6;

        let n0 = 0, n1 = 0, n2 = 0;

        // Skew input space to determine which simplex cell we're in
        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);

        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = x - X0;
        const y0 = y - Y0;

        // Determine which simplex we are in
        let i1, j1;
        if (x0 > y0) {
            i1 = 1; j1 = 0;
        } else {
            i1 = 0; j1 = 1;
        }

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;

        // Hash coordinates of the 3 simplex corners
        const ii = i & 255;
        const jj = j & 255;

        const gi0 = this.perm[ii + this.perm[jj]] % 12;
        const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
        const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;

        // Add contributions from each corner to get the final noise value.
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) {
            n0 = 0.0;
        } else {
            t0 *= t0;
            const g0 = this.gradient3[gi0];
            n0 = t0 * t0 * (g0[0] * x0 + g0[1] * y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) {
            n1 = 0.0;
        } else {
            t1 *= t1;
            const g1 = this.gradient3[gi1];
            n1 = t1 * t1 * (g1[0] * x1 + g1[1] * y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) {
            n2 = 0.0;
        } else {
            t2 *= t2;
            const g2 = this.gradient3[gi2];
            n2 = t2 * t2 * (g2[0] * x2 + g2[1] * y2);
        }

        // Scale to [-1, 1]
        return 70.0 * (n0 + n1 + n2);
    }

    public noise3D(x: number, y: number, z: number): number {
        const F3 = 1.0 / 3.0;
        const G3 = 1.0 / 6.0;

        let n0, n1, n2, n3;

        // Skew input space to determine which simplex cell we're in
        const s = (x + y + z) * F3;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const k = Math.floor(z + s);

        const t = (i + j + k) * G3;
        const X0 = i - t;
        const Y0 = j - t;
        const Z0 = k - t;
        const x0 = x - X0;
        const y0 = y - Y0;
        const z0 = z - Z0;

        // Determine which simplex we are in
        let i1, j1, k1;
        let i2, j2, k2;

        if (x0 >= y0) {
            if (y0 >= z0) {
                i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
            } else if (x0 >= z0) {
                i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
            } else {
                i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
            }
        } else {
            if (y0 < z0) {
                i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
            } else if (x0 < z0) {
                i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
            } else {
                i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
            }
        }

        const x1 = x0 - i1 + G3;
        const y1 = y0 - j1 + G3;
        const z1 = z0 - k1 + G3;
        const x2 = x0 - i2 + 2.0 * G3;
        const y2 = y0 - j2 + 2.0 * G3;
        const z2 = z0 - k2 + 2.0 * G3;
        const x3 = x0 - 1.0 + 3.0 * G3;
        const y3 = y0 - 1.0 + 3.0 * G3;
        const z3 = z0 - 1.0 + 3.0 * G3;

        // Hash coordinates of the 4 simplex corners
        const ii = i & 255;
        const jj = j & 255;
        const kk = k & 255;

        const gi0 = this.perm[ii + this.perm[jj + this.perm[kk]]] % 12;
        const gi1 = this.perm[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]] % 12;
        const gi2 = this.perm[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]] % 12;
        const gi3 = this.perm[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]] % 12;

        // Add contributions from each corner to get the final noise value.
        let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
        if (t0 < 0) {
            n0 = 0.0;
        } else {
            t0 *= t0;
            const g0 = this.gradient3[gi0];
            n0 = t0 * t0 * (g0[0] * x0 + g0[1] * y0 + g0[2] * z0);
        }

        let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
        if (t1 < 0) {
            n1 = 0.0;
        } else {
            t1 *= t1;
            const g1 = this.gradient3[gi1];
            n1 = t1 * t1 * (g1[0] * x1 + g1[1] * y1 + g1[2] * z1);
        }

        let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
        if (t2 < 0) {
            n2 = 0.0;
        } else {
            t2 *= t2;
            const g2 = this.gradient3[gi2];
            n2 = t2 * t2 * (g2[0] * x2 + g2[1] * y2 + g2[2] * z2);
        }

        let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
        if (t3 < 0) {
            n3 = 0.0;
        } else {
            t3 *= t3;
            const g3 = this.gradient3[gi3];
            n3 = t3 * t3 * (g3[0] * x3 + g3[1] * y3 + g3[2] * z3);
        }

        // Scale to [-1, 1]
        return 32.0 * (n0 + n1 + n2 + n3);
    }
}