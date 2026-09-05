import * as THREE from 'three';

const GRID_SHADER_VERT = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GRID_SHADER_FRAG = `
uniform float uTime;
uniform float uFormationSpeed;
varying vec2 vUv;

void main() {
    // Perspective grid: lines converge toward horizon (top of screen)
    vec2 uv = vUv;
    
    // Grid spacing - tighter near player, wider at horizon
    float perspectiveFactor = 1.0 / (uv.y + 0.01);
    vec2 gridUV = uv * perspectiveFactor;
    
    // Create grid lines
    vec2 grid = abs(fract(gridUV * vec2(40.0, 20.0)) - 0.5);
    float lineX = smoothstep(0.48, 0.50, grid.x);
    float lineY = smoothstep(0.48, 0.50, grid.y);
    float gridLine = max(lineX, lineY) * step(0.02, uv.y);
    
    // Pulse in sync with formation speed
    float pulse = 0.6 + 0.4 * sin(uTime * uFormationSpeed * 3.0);
    
    // Neon cyan color
    vec3 baseColor = vec3(0.02, 0.05, 0.1);
    vec3 neonColor = vec3(0.0, 1.0, 0.8);
    vec3 color = mix(baseColor, neonColor * pulse, gridLine * 0.7);
    
    // Fade out at horizon
    float alpha = smoothstep(0.0, 0.3, uv.y) * (1.0 - uv.y * 0.5);
    
    gl_FragColor = vec4(color, alpha * 0.8);
}
`;

export class GridFloor {
    constructor(scene) {
        this.uniforms = {
            uTime: { value: 0 },
            uFormationSpeed: { value: 0.3 }
        };

        const material = new THREE.ShaderMaterial({
            vertexShader: GRID_SHADER_VERT,
            fragmentShader: GRID_SHADER_FRAG,
            uniforms: this.uniforms,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(40, 20),
            material
        );
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.set(0, -3.5, -10);
        scene.add(this.mesh);
    }

    update(time, formationSpeed) {
        this.uniforms.uTime.value = time;
        this.uniforms.uFormationSpeed.value = formationSpeed;
    }

    updateCamera(camera) {
        // Update grid floor camera reference for parallax
        this.camera = camera;
    }

    setPulse(value) {
        // Store pulse value for use in update()
        this._pulseValue = value;
    }

    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
