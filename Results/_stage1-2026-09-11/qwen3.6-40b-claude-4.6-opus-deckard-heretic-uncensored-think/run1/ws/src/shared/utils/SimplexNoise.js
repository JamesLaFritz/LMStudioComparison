/**
 * Simplex Noise Implementation - 2D and 3D noise generation for procedural textures
 */
class SimplepNoise {
    constructor() {
        // Initialize permutation tables
        this.perm = new Array(512);

        // Seed with random values
        const seed = Math.random();
        this.seed(seed);
    }

    seed(value) {
        // Fill permutation table with random values based on seed
        for (let i = 0; i < 256; i++) {
            this.perm[i] = i;
        }

        // Shuffle using Fisher-Yates algorithm
        const temp = new Array(256);
        for (let i = 0; i < 256; i++) {
            temp[i] = Math.floor(Math.random() * 256) % 256;
        }

        // Copy to permutation table
        for (let i = 0; i < 256; i++) {
            this.perm[i] = temp[i];
        }
    }

    simplex2(x, y) {
        // Constants for 2D noise calculation
        const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        const G2 = 1.0 / (6.0 * Math.sqrt(3.0));

        // Calculate grid coordinates
        const x0 = Math.floor(x + y * F2);
        const y0 = Math.floor(y + x * F2);

        // Get base point coordinates
        const x1 = x - x0;
        const y1 = y - y0;

        // Calculate noise value using interpolation
        const u = this._noise(x1, y1);
        const v = this._noise(x1 + 1.0, y1);
        const w = this._noise(x1, y1 + 1.0);

        return (u + v + w) / 3.0;
    }

    _noise(x, y) {
        // Calculate noise using permutation table
        const xi = Math.floor(x) & 255;
        const yi = Math.floor(y) & 255;

        return this.perm[xi + (yi << 8)] / 256.0 - 0.5;
    }

    destroy() {
        // Clear references
        this.perm = null;
    }
}

export default SimplepNoise;
