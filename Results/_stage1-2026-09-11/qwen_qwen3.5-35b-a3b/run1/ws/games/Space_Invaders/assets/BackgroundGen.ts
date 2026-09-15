import { MathUtils } from '../../../shared/utils/MathUtils.js';

export interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
  opacity: number;
}

export class BackgroundGenerator {
  private stars: Star[] = [];
  private readonly starCount: number;
  private readonly seed: number;

  constructor(starCount: number = 500, seed: number = Math.random() * 1000) {
    this.starCount = starCount;
    this.seed = seed;
    this.generateStars();
  }

  private generateStars(): void {
    const random = MathUtils.seededRandom(this.seed);
    
    for (let i = 0; i < this.starCount; i++) {
      this.stars.push({
        x: random() * 2 - 1, // Range [-1, 1]
        y: random() * 2 - 1,
        z: random() * 5 + 2, // Depth from 2 to 7
        size: random() * 0.03 + 0.01,
        speed: random() * 0.5 + 0.1,
        opacity: random() * 0.5 + 0.5
      });
    }
  }

  public getStars(): Star[] {
    return this.stars;
  }

  public update(deltaTime: number): void {
    // Animate stars with parallax effect
    const time = Date.now() * 0.001;
    
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      
      // Twinkle effect using sine wave
      star.opacity = 0.5 + 0.5 * Math.sin(time * star.speed + i);
      
      // Slow drift for dynamic feel
      star.x += Math.cos(time + i) * 0.001;
    }
  }

  public dispose(): void {
    this.stars = [];
  }
}

export class NebulaGenerator {
  private readonly colors: THREE.Color[] = [
    new THREE.Color(0x2a004d), // Deep purple
    new THREE.Color(0x0066cc), // Electric blue
    new THREE.Color(0xff0080)  // Neon pink
  ];

  public generateNebulaMesh(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(100, 100);
    
    // Custom shader for nebula effect
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float time;
      uniform vec3 color1;
      uniform vec3 color2;
      varying vec2 vUv;

      // Simplex noise function
      vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                            -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
          + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        return 42.0 * dot( m*m, vec3( dot(p.x,x0), dot(p.y,x12.xy), dot(p.z,x12.zw) ) );
      }

      void main() {
        vec2 uv = vUv * 3.0;
        float n = snoise(uv + time * 0.1);
        
        // Mix colors based on noise value
        vec3 color = mix(color1, color2, smoothstep(-1.0, 1.0, n));
        
        // Add subtle variation
        color += snoise(uv * 5.0 - time * 0.2) * 0.1;
        
        gl_FragColor = vec4(color, 0.3);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0 },
        color1: { value: this.colors[0] },
        color2: { value: this.colors[1] }
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = -50;
    
    return mesh;
  }

  public updateShaderTime(mesh: THREE.Mesh, deltaTime: number): void {
    if (mesh.material instanceof THREE.ShaderMaterial) {
      const shaderMaterial = mesh.material as any;
      if (shaderMaterial.uniforms && shaderMaterial.uniforms.time) {
        shaderMaterial.uniforms.time.value += deltaTime;
      }
    }
  }

  public dispose(): void {
    this.colors.forEach(color => color.dispose());
  }
}