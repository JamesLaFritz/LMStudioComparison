/**
 * Neon Glow Textures - Canvas-based neon glow patterns and emissive maps
 */
class NeonGlowTextures {
    constructor() {
        this.cache = {};
    }

    generateNeonTexture(width, height, color = '#00ff88', intensity = 1.0) {
        const key = `neon_${width}_${height}_${color}_${intensity}`;

        if (this.cache[key]) {
            return this.cache[key];
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        // Create radial gradient for neon glow effect
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2;

        const gradient = ctx.createRadialGradient(centerX, centerY, 0, 
            centerX, centerY, maxRadius);

        // Parse color for glow effect
        const r = parseInt(color.substring(1), 16);
        const g = parseInt(color.substring(3), 16);
        const b = parseInt(color.substring(5), 16);

        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity})`);
        gradient.addColorStop(0.2, `rgba(${r * 0.8}, ${g * 0.8}, ${b * 0.8}, ${intensity * 0.7})`);
        gradient.addColorStop(0.5, `rgba(${r * 0.6}, ${g * 0.6}, ${b * 0.6}, ${intensity * 0.4})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        // Draw glow pattern
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        this.cache[key] = canvas;
        return canvas;
    }

    generateEmissiveMap(width, height, patternType = 'grid') {
        const key = `emissive_${width}_${height}_${patternType}`;

        if (this.cache[key]) {
            return this.cache[key];
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let intensity = 0;

                switch(patternType) {
                    case 'grid':
                        // Create grid pattern with glowing lines
                        const gridSize = 20;
                        const gx = Math.abs(x % gridSize - gridSize / 2);
                        const gy = Math.abs(y % gridSize - gridSize / 2);

                        if (gx < 3 || gy < 3) {
                            intensity = 1.0;
                        } else {
                            intensity = 0.1;
                        }
                        break;

                    case 'dots':
                        // Create dot pattern
                        const dotSize = 5;
                        const dx = (x % 20) - 10;
                        const dy = (y % 20) - 10;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < dotSize) {
                            intensity = 1.0;
                        } else {
                            intensity = 0.05;
                        }
                        break;

                    case 'wave':
                        // Create wave pattern
                        const waveX = Math.sin(x / width * Math.PI * 4);
                        const waveY = Math.sin(y / height * Math.PI * 2);
                        intensity = (waveX + waveY) * 0.5 + 0.5;
                        break;

                    default:
                        intensity = 0.1;
                }

                // Apply intensity to RGB channels
                const index = (y * width + x) * 4;
                imageData.data[index] = Math.floor(intensity * 255);
                imageData.data[index + 1] = Math.floor(intensity * 255);
                imageData.data[index + 2] = Math.floor(intensity * 255);
                imageData.data[index + 3] = 255; // Alpha channel
            }
        }

        ctx.putImageData(imageData, 0, 0);

        this.cache[key] = canvas;
        return canvas;
    }

    destroy() {
        // Clear cache and dispose canvases
        Object.keys(this.cache).forEach(key => {
            if (this.cache[key]) {
                this.cache[key].getContext('2d').clearRect(0, 0, 
                    this.cache[key].width, this.cache[key].height);
            }
        });
        this.cache = {};
    }
}

export default NeonGlowTextures;
