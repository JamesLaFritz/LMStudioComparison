/**
 * Noise Textures - Simplex noise textures for materials, terrain, surfaces
 */
class NoiseTextures {
    constructor() {
        this.noise = new SimplexNoise();
    }

    generateTexture(width, height, type = 'simplex', scale = 1.0) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let value = 0;

                switch(type) {
                    case 'simplep':
                        value = this.noise.simplex2(x / scale, y / scale);
                        break;
                    case 'perlin':
                        value = this._generatePerlinNoise(x / scale, y / scale);
                        break;
                    case 'value':
                        value = Math.random();
                        break;
                }

                // Normalize to 0-255 range
                const normalizedValue = (value + 1) * 127.5;
                const index = (y * width + x) * 4;

                imageData.data[index] = Math.floor(normalizedValue);
                imageData.data[index + 1] = Math.floor(normalizedValue);
                imageData.data[index + 2] = Math.floor(normalizedValue);
                imageData.data[index + 3] = 255; // Alpha channel
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    _generatePerlinNoise(x, y) {
        const n1 = Math.sin(x * 7.0 + y * 3.0) * 0.5 + 0.5;
        const n2 = Math.sin(y * 5.0 + x * 2.0) * 0.5 + 0.5;

        return (n1 + n2) / 2;
    }

    generateNormalMap(width, height, scale = 1.0) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Calculate normal vector based on noise gradient
                const dx = this.noise.simplep2((x + 1) / scale, y / scale);
                const dy = this.noise.simplep2(x / scale, (y + 1) / scale);

                // Convert to RGB for normal map
                const nx = Math.cos(dx * Math.PI * 2);
                const ny = Math.sin(dy * Math.PI * 2);
                const nz = 1.0;

                const index = (y * width + x) * 4;

                // Pack normal into RGB
                imageData.data[index] = Math.floor((nx + 1) * 127.5);
                imageData.data[index + 1] = Math.floor((ny + 1) * 127.5);
                imageData.data[index + 2] = Math.floor(nz * 255);
                imageData.data[index + 3] = 255; // Alpha channel
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    destroy() {
        this.noise = null;
    }
}

export default NoiseTextures;
