import * as THREE from 'three';

/**
 * StarfieldGenerator - Creates a multi-layer parallax starfield for the background
 */
export class StarfieldGenerator {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = {
            layerCount: 5,
            starsPerLayer: [200, 300, 400, 300, 150],
            depthRange: [20, 50, 100, 200, 400],
            speedMultipliers: [0.2, 0.5, 1.0, 0.7, 0.3],
            ...options
        };

        this.layers = [];
        this.createStarfield();
    }

    createStarfield() {
        for (let i = 0; i < this.options.layerCount; i++) {
            const layer = this.createLayer(i);
            this.layers.push(layer);
            this.scene.add(layer);
        }
    }

    createLayer(index) {
        const starCount = this.options.starsPerLayer[index];
        const depth = this.options.depthRange[index];
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);
        const colors = new Float32Array(starCount * 3);

        const colorPalette = [
            new THREE.Color(0xffffff), // White
            new THREE.Color(0xaaddff), // Light blue
            new THREE.Color(0xffddaa), // Warm yellow
            new THREE.Color(0xddaaff)  // Purple tint
        ];

        for (let i = 0; i < starCount; i++) {
            const x = (Math.random() - 0.5) * 60;
            const y = (Math.random() - 0.5) * 40;
            const z = -depth + Math.random() * depth * 0.3;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            sizes[i] = Math.random() * 0.5 + 0.2;

            const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const points = new THREE.Points(geometry, material);
        points.userData = {
            speedMultiplier: this.options.speedMultipliers[index],
            basePositions: positions.slice()
        };

        return points;
    }

    update(delta) {
        this.layers.forEach(layer => {
            const positions = layer.geometry.attributes.position.array;
            const speed = 2 * delta * layer.userData.speedMultiplier;

            for (let i = 0; i < positions.length / 3; i++) {
                positions[i * 3 + 2] += speed;

                // Reset star when it goes behind camera
                if (positions[i * 3 + 2] > 10) {
                    positions[i * 3 + 2] = -layer.userData.basePositions[i * 3 + 2];
                }
            }

            layer.geometry.attributes.position.needsUpdate = true;
        });
    }

    pulse(intensity = 1.0) {
        this.layers.forEach(layer => {
            const targetOpacity = 0.8 * intensity;
            layer.material.opacity = THREE.MathUtils.lerp(
                layer.material.opacity,
                targetOpacity,
                0.05
            );
        });
    }

    dispose() {
        this.layers.forEach(layer => {
            layer.geometry.dispose();
            layer.material.dispose();
            this.scene.remove(layer);
        });
        this.layers = [];
    }
}

export default StarfieldGenerator;
