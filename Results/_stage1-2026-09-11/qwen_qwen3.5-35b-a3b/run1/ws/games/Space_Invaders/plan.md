# Space Invaders - AAA Retro-Futurism Implementation Plan

## 1. CORE GAMEPLAY MATHEMATICAL MODELING

### Game State Machine
```typescript
enum GameState { MENU, PLAYING, PAUSED, GAME_OVER, VICTORY }
const STATE_TRANSITIONS: Record<GameState, () => void> = {
  MENU: initMenu,
  PLAYING: startGameLoop,
  PAUSED: pauseGameLoop,
  GAME_OVER: showGameOverScreen,
  VICTORY: showVictoryScreen
}
```

### Grid-Based Enemy Formation (The "Wave")
- **Grid Dimensions:** 5 rows × 11 columns = 55 enemies maximum
- **Formation Offset:** Each enemy positioned at `position = origin + rowOffset * ROW_SPACING + colOffset * COL_SPACING`
- **ROW_SPACING:** 40 units, **COL_SPACING:** 35 units
- **Wave Movement Vector:** Horizontal velocity `v_x = baseSpeed × directionMultiplier`, where `directionMultiplier ∈ {-1, +1}`
- **Drop Mechanic:** When wave hits screen edge (x < -25 or x > 25), trigger:
  ```typescript
  dropDistance = 8; // units downward
  directionMultiplier *= -1; // reverse horizontal direction
  baseSpeed += speedIncrement; // exponential difficulty curve
  ```

### Enemy Movement Algorithm
```typescript
function updateEnemies(deltaTime: number): void {
  const timeSinceLastDrop = clock.getElapsedTime() - lastDropTime;
  
  if (timeSinceLastDrop >= dropInterval) {
    enemies.forEach(enemy => enemy.position.y -= dropDistance);
    directionMultiplier *= -1;
    baseSpeed += speedIncrement;
    lastDropTime = clock.getElapsedTime();
  }
  
  enemies.forEach(enemy => {
    enemy.position.x += baseSpeed * directionMultiplier * deltaTime;
    
    // Edge detection with margin buffer
    if (enemy.position.x < screenLeftEdge && directionMultiplier === -1) {
      triggerDrop();
    } else if (enemy.position.x > screenRightEdge && directionMultiplier === 1) {
      triggerDrop();
    }
  });
}
```

### Player Ship Movement & Constraints
- **Movement Speed:** 15 units/second horizontally
- **Boundary Clamp:** `playerX = clamp(playerX, -22, 22)`
- **Input Deadzone:** Gamepad axis deadzone of 0.15 to prevent drift

### Projectile Physics
```typescript
interface Projectile {
  position: Vector3;
  velocity: Vector3; // (0, 0, speed) for bullets moving toward camera
  owner: 'player' | 'enemy';
  active: boolean;
}

function updateProjectiles(deltaTime: number): void {
  playerBullets.forEach(bullet => {
    if (bullet.active) {
      bullet.position.z -= BULLET_SPEED * deltaTime; // toward camera (+Z)
      if (bullet.position.z < -50) deactivateBullet(bullet);
    }
  });
  
  enemyBullets.forEach(bullet => {
    if (bullet.active) {
      bullet.position.z += ENEMY_BULLET_SPEED * deltaTime; // away from camera (-Z)
      if (bullet.position.z > 30) deactivateBullet(bullet);
    }
  });
}
```

### Collision Detection System
**Axis-Aligned Bounding Box (AABB) with padding:**
```typescript
function checkCollision(a: Entity, b: Entity): boolean {
  const padding = 2.5; // generous hitbox for retro feel
  return Math.abs(a.position.x - b.position.x) < (a.width + b.width)/2 + padding &&
         Math.abs(a.position.y - b.position.y) < (a.height + b.height)/2 + padding &&
         Math.abs(a.position.z - b.position.z) < (a.depth + b.depth)/2 + padding;
}

// Bullet-Enemy collision
playerBullets.forEach(bullet => {
  enemies.forEach(enemy => {
    if (bullet.active && enemy.alive && checkCollision(bullet, enemy)) {
      activateExplosion(enemy.position);
      enemy.markDead();
      bullet.deactivate();
      score += calculateScore(enemy.type);
      triggerHitStop(0.15); // satisfying impact pause
    }
  });
});

// Bullet-Player collision
enemyBullets.forEach(bullet => {
  if (bullet.active && checkCollision(bullet, playerShip)) {
    activateExplosion(player.position);
    triggerCameraShake(2.0, 0.8); // major trauma shake
    handlePlayerDeath();
  }
});

// Enemy-Player collision (invasion win condition)
enemies.forEach(enemy => {
  if (enemy.alive && enemy.position.y > player.position.y - 3) {
    triggerGameOver("INVADED!");
  }
});
```

### Scoring System
| Enemy Type | Score | Visual Distinction |
|------------|-------|-------------------|
| Squid (row 0) | 30 | Red, smallest |
| Crab (row 1-2) | 20 | Orange, medium |
| Octopus (row 3-4) | 10 | Yellow, largest |

### Wave Progression & Difficulty Curve
```typescript
const difficultyCurve: Record<number, number> = {
  wave1: { baseSpeed: 5, dropInterval: 2.0, enemyFireRate: 0.001 },
  wave2: { baseSpeed: 7, dropInterval: 1.5, enemyFireRate: 0.002 },
  wave3: { baseSpeed: 9, dropInterval: 1.0, enemyFireRate: 0.004 },
  wave4: { baseSpeed: 12, dropInterval: 0.7, enemyFireRate: 0.008 }
};

function calculateDifficulty(): number {
  const enemiesRemaining = enemies.filter(e => e.alive).length;
  if (enemiesRemaining > 35) return 1;
  if (enemiesRemaining > 20) return 2;
  if (enemiesRemaining > 8) return 3;
  return 4; // maximum difficulty
}
```

### Enemy Firing Logic
- **Randomized per enemy:** Each enemy has independent fire timer
- **Fire probability per frame:** `fireChance = enemyFireRate × deltaTime`
- **Suppression mechanic:** When player shoots, reduce enemy fire rate by 30% for 2 seconds (player pressure system)

---

## 2. MODERN AAA UPGRADES (15-20 SPECIFIC IMPLEMENTATIONS)

### 1. Dynamic Bloom-Based Neon Aesthetics
```typescript
// EffectComposer setup with tuned UnrealBloomPass
const bloomPass = new UnrealBloomPass(
  new Vector2(window.innerWidth, window.innerHeight),
  1.5,    // strength - neon glow intensity
  0.4,    // radius - bloom spread
  0.85    // threshold - emissive surfaces that trigger bloom
);

// Material emissive tuning for retro-futurism
const squidMaterial = new MeshStandardMaterial({
  color: 0xff0044,      // base red
  emissive: 0xff0044,   // matching glow
  emissiveIntensity: 2.5, // bright neon without washout
  metalness: 0.3,
  roughness: 0.2
});
```

### 2. Procedural Texture Generation via Canvas API
- **Enemy Sprites:** Generate pixel-art style textures on HTMLCanvasElement, convert to Three.js Texture
- **Background Stars:** Noise-based starfield with varying sizes and brightness
- **Player Ship Glow:** Radial gradient texture for engine trail effect

```typescript
function generateEnemyTexture(type: EnemyType): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  
  // Pixel-art drawing commands based on enemy type
  switch (type) {
    case 'squid': drawSquidSprite(ctx); break;
    case 'crab': drawCrabSprite(ctx); break;
    case 'octopus': drawOctopusSprite(ctx); break;
  }
  
  const texture = new CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; // retro pixel look
  return texture;
}
```

### 3. Parallax Starfield Background
- **Three depth layers:** Far stars (slow), mid stars (medium), near stars (fast)
- **Procedural generation:** Simplex noise for natural distribution, no repetition patterns
- **Looping mechanism:** Stars wrap around screen edges seamlessly

```typescript
class Starfield {
  private stars: InstancedMesh;
  private starPositions: Float32Array;
  
  constructor() {
    const geometry = new SphereGeometry(0.1, 4, 4); // minimal poly for instancing
    const material = new PointsMaterial({ 
      color: 0xffffff, 
      size: 0.5,
      transparent: true,
      opacity: 0.8
    });
    
    this.stars = new InstancedMesh(geometry, material, STAR_COUNT);
    this.generateStarPositions();
  }
  
  private generateStarPositions(): void {
    for (let i = 0; i < STAR_COUNT; i++) {
      const x = randomRange(-50, 50);
      const y = randomRange(-30, 30);
      const z = randomRange(-100, -20); // depth layering
      this.starPositions.set([x, y, z], i * 3);
    }
  }
  
  update(deltaTime: number): void {
    // Parallax movement based on player velocity
    const speed = 5 + playerVelocity.z;
    this.moveStars(speed * deltaTime);
  }
}
```

### 4. Animated Enemy Sprites (Frame-by-Frame)
- **Sprite sheet generation:** Procedurally create multi-frame animations
- **Animation timing:** Squid (0.15s/frame), Crab (0.2s/frame), Octopus (0.25s/frame)
- **Blend mode:** Cross-fade between frames for smooth motion

```typescript
class AnimatedEnemy {
  private frameTextures: Texture[];
  private currentFrame: number = 0;
  private animationTimer: number = 0;
  
  constructor(type: EnemyType) {
    this.frameTextures = generateAnimatedSpriteFrames(type);
  }
  
  update(deltaTime: number): void {
    this.animationTimer += deltaTime;
    const frameDuration = getFrameDuration(this.type);
    
    if (this.animationTimer >= frameDuration) {
      this.currentFrame = (this.currentFrame + 1) % this.frameTextures.length;
      this.material.map = this.frameTextures[this.currentFrame];
      this.animationTimer = 0;
    }
  }
}
```

### 5. Dynamic Lighting & Shadows
- **Point lights on explosions:** Temporary light sources that decay over time
- **Ambient occlusion:** SSAO effect for depth perception in retro aesthetic
- **Dynamic shadows:** Enemy shadows projected onto "ground plane" (Z=0)

```typescript
class ExplosionLight {
  private light: PointLight;
  private intensityDecay: number = 1.0;
  
  constructor(position: Vector3) {
    this.light = new PointLight(0xffaa00, 2, 15);
    this.light.position.copy(position);
    scene.add(this.light);
  }
  
  update(deltaTime: number): void {
    this.intensityDecay -= deltaTime * 3; // fade over ~0.33s
    this.light.intensity = Math.max(0, this.intensityDecay);
    
    if (this.intensityDecay <= 0) {
      scene.remove(this.light);
      this.light.dispose();
    }
  }
}
```

### 6. Screen-Space Ambient Occlusion (SSAO)
- **Post-processing pass:** Adds contact shadows for depth in retro aesthetic
- **Tunable radius:** 2 units, quality preset: medium (balance performance/aesthetics)

```typescript
const ssaoPass = new SSAOPass(
  new Vector2(window.innerWidth, window.innerHeight),
  1024, // resolution
  2.0,  // radius
  0.5,  // intensity
  0,    // min/ max blur
  true  // invert output for retro look
);
```

### 7. Retro CRT Scanline Effect
- **Overlay shader:** Subtle horizontal scanlines with slight curvature (vignette)
- **Flicker effect:** Random luminance variation simulating old monitor instability
- **Chromatic aberration:** Slight RGB channel separation at screen edges

```typescript
class CRTEffect {
  private material: ShaderMaterial;
  
  constructor() {
    this.material = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        scanlineIntensity: { value: 0.15 },
        curvature: { value: 0.02 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float scanlineIntensity;
        uniform float curvature;
        
        varying vec2 vUv;
        
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          
          // Scanlines with slight curve
          float scanline = sin(vUv.y * 100.0 + time * 5.0) * 0.5 + 0.5;
          color.rgb *= 1.0 - scanline * scanlineIntensity;
          
          // Vignette curvature
          float dist = distance(vUv, vec2(0.5));
          color.rgb *= 1.0 - dist * curvature;
          
          // Subtle chromatic aberration at edges
          if (dist > 0.4) {
            float aberration = (dist - 0.4) * 0.5;
            vec3 rgbShift = vec3(aberration, -aberration, 0);
            color.r = texture2D(tDiffuse, vUv + rgbShift).r;
          }
          
          gl_FragColor = color;
        }
      `
    });
  }
}
```

### 8. Particle System with Physics
- **Explosion particles:** Velocity, gravity, drag, lifetime decay
- **Engine trail particles:** Continuous emission from player ship
- **Debris fragments:** Enemy destruction spawns colored shard particles

```typescript
interface Particle {
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3; // gravity/drag modifiers
  color: Color;
  size: number;
  lifetime: number;
  maxLifetime: number;
}

function updateParticles(deltaTime: number): void {
  particles.forEach(particle => {
    if (particle.lifetime <= 0) return;
    
    // Physics integration
    particle.velocity.addScaledVector(particle.acceleration, deltaTime);
    particle.position.addScaledVector(particle.velocity, deltaTime);
    particle.lifetime -= deltaTime;
    
    // Size decay for fade-out effect
    particle.size = particle.maxSize * (particle.lifetime / particle.maxLifetime);
  });
}

function spawnExplosion(position: Vector3, count: number = 20): void {
  const colors = [0xff4400, 0xffaa00, 0xffff00, 0xffffff];
  
  for (let i = 0; i < count; i++) {
    const particle = objectPool.acquireParticle();
    particle.position.copy(position);
    particle.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
    
    // Random velocity in spherical distribution
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const speed = randomRange(5, 15);
    
    particle.velocity.set(
      speed * Math.sin(phi) * Math.cos(theta),
      speed * Math.sin(phi) * Math.sin(theta),
      speed * Math.cos(phi)
    );
    
    particle.acceleration.set(0, -9.8, 0); // gravity
    particle.maxLifetime = randomRange(0.3, 0.8);
    particle.lifetime = particle.maxLifetime;
    
    particleManager.spawn(particle);
  }
}
```

### 9. Weapon Power-Up System (Optional Enhancement)
- **Drop probability:** 5% chance per enemy kill
- **Power-up types:** Spread shot, rapid fire, shield
- **Visual indicator:** Floating power-up sprite with rotation animation

```typescript
interface PowerUp {
  type: 'spread' | 'rapid' | 'shield';
  position: Vector3;
  active: boolean;
  lifetime: number;
}

const POWER_UP_TYPES: Record<string, { color: Color; duration: number }> = {
  spread: { color: new Color(0x00ffff), duration: 10 }, // cyan
  rapid: { color: new Color(0xff00ff), duration: 8 },   // magenta
  shield: { color: new Color(0x00ff00), duration: 15 }  // green
};

function spawnPowerUp(position: Vector3): void {
  const powerUp = objectPool.acquirePowerUp();
  powerUp.type = POWER_UP_TYPES[Object.keys(POWER_UP_TYPES)[Math.floor(Math.random() * 3)]];
  powerUp.position.copy(position);
  powerUp.active = true;
  powerUp.lifetime = randomRange(5, 10);
}
```

### 10. Dynamic Sound Synthesis (Web Audio API)
- **No external assets:** All SFX synthesized in real-time
- **Enemy shoot:** Sawtooth wave with pitch envelope
- **Player shoot:** High-frequency square wave with decay
- **Explosion:** Noise buffer with low-pass filter sweep

```typescript
class AudioSynth {
  private ctx: AudioContext;
  
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  playEnemyShoot(): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }
  
  playExplosion(): void {
    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // White noise generation
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.3);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }
}
```

### 11. Particle-Bloom Integration
- **Bloom on particles:** High emissive intensity causes bloom glow
- **Color mapping:** Explosion colors map to bloom color space for cohesive aesthetic
- **Fade-to-white handling:** Bloom threshold prevents overexposure

```typescript
// Particle material with bloom-triggering emissive
const particleMaterial = new PointsMaterial({
  size: 0.3,
  transparent: true,
  opacity: 1.0,
  blending: THREE.AdditiveBlending, // additive for glow effect
  depthWrite: false,
  map: generateParticleTexture()
});

// Bloom threshold tuned to particle emissive intensity
bloomPass.threshold = 0.7; // particles with emissive > 0.7 trigger bloom
```

### 12. Screen-Space Reflections (SSR) - Simplified
- **Floor reflection:** Fake SSR on ground plane for ship reflections
- **Specular highlights:** Dynamic specular on enemy surfaces based on light angle

```typescript
const floorMaterial = new MeshStandardMaterial({
  color: 0x111122,
  roughness: 0.3,
  metalness: 0.7,
  envMapIntensity: 1.5
});

// Dynamic specular calculation in fragment shader
const fragmentShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 lightDir = normalize(vec3(0, 1, 1));
    float spec = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 32.0);
    gl_FragColor = baseColor + vec4(spec * 0.5, spec * 0.5, spec * 0.5, 1.0);
  }
`;
```

### 13. Dynamic Difficulty Adjustment (DDA)
- **Player performance tracking:** Kill rate, death count, score per minute
- **Adaptive enemy spawn rate:** Slow down if player struggling, speed up if dominating
- **Balanced challenge curve:** Prevents frustration while maintaining engagement

```typescript
class DifficultyManager {
  private killRate: number = 0;
  private deathCount: number = 0;
  private lastKillTime: number = 0;
  
  update(deltaTime: number): void {
    const now = performance.now() / 1000;
    
    // Track kills per minute
    if (now - this.lastKillTime < 60) {
      this.killRate++;
    } else {
      this.killRate = 0;
    }
    this.lastKillTime = now;
    
    // Adjust enemy speed based on performance
    const targetSpeed = this.calculateTargetSpeed();
    this.currentSpeed += (targetSpeed - this.currentSpeed) * deltaTime * 0.5;
  }
  
  private calculateTargetSpeed(): number {
    if (this.killRate > 30) return MAX_SPEED; // player dominating, increase challenge
    if (this.deathCount > 3) return MIN_SPEED; // player struggling, ease difficulty
    return BASE_SPEED;
  }
}
```

### 14. Haptic Feedback Integration (Gamepad Vibration)
- **Explosion feedback:** Strong vibration on enemy death
- **Player hit feedback:** Patterned vibration for damage taken
- **Power-up acquisition:** Short pulse on power-up pickup

```typescript
function triggerHapticFeedback(type: 'explosion' | 'playerHit' | 'powerUp'): void {
  const gamepads = navigator.getGamepads();
  const gamepad = gamepads[0]; // assume player 1
  
  if (!gamepad || !gamepad.vibrationActuator) return;
  
  switch (type) {
    case 'explosion':
      gamepad.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: 200,
        weakMagnitude: 1.0,
        strongMagnitude: 1.0
      });
      break;
    case 'playerHit':
      gamepad.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: 500,
        weakMagnitude: 0.8,
        strongMagnitude: 0.4
      });
      break;
    case 'powerUp':
      gamepad.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: 150,
        weakMagnitude: 0.3,
        strongMagnitude: 0.6
      });
      break;
  }
}
```

### 15. Time-Dilation Slow Motion (Hit-Stop)
- **Impact frame freeze:** Brief pause on significant collisions
- **Recovery interpolation:** Smooth timescale return to normal
- **Visual stutter:** Frame skipping during hit-stop for retro feel

```typescript
class HitStopManager {
  private active: boolean = false;
  private duration: number = 0;
  private accumulator: number = 0;
  
  trigger(durationMs: number): void {
    this.active = true;
    this.duration = durationMs / 1000;
    this.accumulator = 0;
  }
  
  update(deltaTime: number): number {
    if (!this.active) return deltaTime; // normal timescale
    
    this.accumulator += deltaTime;
    
    if (this.accumulator >= this.duration) {
      this.active = false;
      return deltaTime; // resume normal
    }
    
    // Frame freeze - skip physics update but continue rendering
    return 0; // zero delta for game logic during hit-stop
  }
}
```

### 16. Procedural Background Music (Sequencer)
- **Retro synth melody:** Simple arpeggiated sequence
- **Dynamic intensity:** Music speeds up as difficulty increases
- **Event triggers:** Musical stings on power-up, wave clear, game over

```typescript
class MusicSequencer {
  private notes: number[] = [261.63, 329.63, 392.00, 523.25]; // C major arpeggio
  private currentNote: number = 0;
  private tempo: number = 120; // BPM
  private nextNoteTime: number = 0;
  
  constructor() {
    this.nextNoteTime = audioCtx.currentTime;
  }
  
  update(deltaTime: number): void {
    const now = audioCtx.currentTime;
    
    while (this.nextNoteTime < now) {
      this.playNote(this.notes[this.currentNote]);
      this.currentNote = (this.currentNote + 1) % this.notes.length;
      this.nextNoteTime += 60 / this.tempo; // note duration in seconds
    }
  }
  
  private playNote(frequency: number): void {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.value = frequency;
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  }
}
```

### 17. Dynamic Camera Follow with Lag
- **Smooth follow:** Camera lags slightly behind player for weight
- **Boundary constraints:** Camera stays within play area bounds
- **Zoom on power-ups:** Subtle zoom effect when power-up acquired

```typescript
class CameraController {
  private targetPosition: Vector3 = new Vector3(0, 0, -5);
  private currentVelocity: Vector3 = new Vector3();
  private smoothingFactor: number = 0.1;
  
  update(deltaTime: number): void {
    // Smooth interpolation with velocity-based lag
    const desiredPosition = this.targetPosition.clone().add(new Vector3(0, 0, -5));
    const force = desiredPosition.sub(this.camera.position).multiplyScalar(this.smoothingFactor);
    
    this.currentVelocity.add(force);
    this.currentVelocity.multiplyScalar(1 - this.smoothingFactor * deltaTime); // damping
    
    this.camera.position.add(this.currentVelocity.clone().multiplyScalar(deltaTime));
  }
  
  setTarget(position: Vector3): void {
    this.targetPosition.copy(position);
  }
}
```

### 18. Save/Load System (LocalStorage)
- **High score persistence:** Store best score across sessions
- **Player preferences:** Audio volume, difficulty preference
- **Auto-save on wave clear:** Prevent progress loss

```typescript
class SaveSystem {
  private STORAGE_KEY = 'space_invaders_save_v1';
  
  save(data: SaveData): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
      highScore: data.highScore,
      volume: data.volume,
      lastPlayed: Date.now()
    }));
  }
  
  load(): SaveData | null {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (!saved) return null;
    
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Save file corrupted, resetting');
      return null;
    }
  }
}

interface SaveData {
  highScore: number;
  volume: number;
  lastPlayed: number;
}
```

---

## 3. GRAPHICS PIPELINE CONFIGURATION

### Post-Processing Stack Order
```typescript
// Render loop with post-processing chain
composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera)); // base render
composer.addPass(new UnrealBloomPass(...));       // bloom glow
composer.addPass(new SSAOPass(...));              // ambient occlusion
composer.addPass(new CRTEffect(...));             // retro scanlines

// Final output: composer.render() instead of renderer.render()
```

### Bloom Pass Tuning (Retro-Futurism Aesthetic)
| Parameter | Value | Rationale |
|-----------|-------|-----------|
| strength | 1.5 | Strong neon glow without washout |
| radius | 0.4 | Tight bloom for crisp edges |
| threshold | 0.85 | Only brightest emissive surfaces trigger |

### Material Emissive Color Mapping
```typescript
const MATERIAL_PALETTE = {
  playerShip: { color: 0x00aaff, emissive: 0x00aaff, intensity: 2.0 },
  squidEnemy: { color: 0xff0044, emissive: 0xff0044, intensity: 2.5 },
  crabEnemy: { color: 0xff8800, emissive: 0xff8800, intensity: 2.2 },
  octopusEnemy: { color: 0xffff00, emissive: 0xffff00, intensity: 2.3 },
  bulletPlayer: { color: 0x00ffff, emissive: 0x00ffff, intensity: 1.8 },
  bulletEnemy: { color: 0xff4444, emissive: 0xff4444, intensity: 1.5 }
};
```

### Procedural Texture Generation Pipeline
```typescript
// Texture generation sequence for each asset type
const TEXTURE_PIPELINE = {
  enemySprite: (type) => generateCanvasTexture(type, 64, 64),
  powerUp: (powerType) => generatePowerUpTexture(powerType),
  particle: () => generateParticleGlowTexture(),
  backgroundStar: (layer) => generateStarfieldLayer(layer),
  uiElement: (elementType) => generateGlassmorphismPanel(elementType)
};

function generateCanvasTexture(type: string, width: number, height: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  // Drawing commands based on type
  switch (type) {
    case 'enemy_squid': drawPixelSprite(ctx, SQUID_PATTERN); break;
    case 'enemy_crab': drawPixelSprite(ctx, CRAB_PATTERN); break;
    // ... more cases
  }
  
  const texture = new CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; // preserve pixel art look
  texture.minFilter = THREE.LinearFilter; // smooth when distant
  return texture;
}
```

---

## 4. VFX IMPLEMENTATION PRIORITY LOGIC

### Camera Shake System (Trauma-Based)
```typescript
class CameraShakeManager {
  private shakeIntensity: number = 0;
  private decayRate: number = 2.5; // intensity per second
  
  trigger(impactVelocity: number, magnitude: number): void {
    this.shakeIntensity += impactVelocity * magnitude;
  }
  
  update(deltaTime: number): Vector3 {
    if (this.shakeIntensity <= 0) return new Vector3();
    
    // Decay intensity over time
    this.shakeIntensity = Math.max(0, this.shakeIntensity - this.decayRate * deltaTime);
    
    // Random offset with exponential decay envelope
    const offset = new Vector3(
      randomRange(-1, 1) * this.shakeIntensity,
      randomRange(-1, 1) * this.shakeIntensity,
      randomRange(-1, 1) * this.shakeIntensity
    );
    
    return offset;
  }
}

// Usage on impacts:
function onEnemyDeath(position: Vector3, velocity: number): void {
  cameraShake.trigger(velocity, 0.5); // moderate shake for enemy death
  spawnExplosion(position, 15);
  triggerHapticFeedback('explosion');
}

function onPlayerHit(position: Vector3, velocity: number): void {
  cameraShake.trigger(velocity, 2.0); // major shake for player trauma
  spawnExplosion(position, 30);
  triggerHapticFeedback('playerHit');
  triggerGameOver();
}
```

### Hit-Stop / Frame-Freeze System
```typescript
class HitStopSystem {
  private active: boolean = false;
  private duration: number = 0; // seconds of freeze
  private frameAccumulator: number = 0;
  
  trigger(durationMs: number): void {
    this.active = true;
    this.duration = durationMs / 1000;
    this.frameAccumulator = 0;
  }
  
  update(deltaTime: number): boolean {
    // Returns false during hit-stop (skip physics/game logic)
    if (!this.active) return true; // normal operation
    
    this.frameAccumulator += deltaTime;
    
    if (this.frameAccumulator >= this.duration) {
      this.active = false;
      return true; // resume normal
    }
    
    return false; // freeze game logic, continue rendering
  }
}

// Integration with game loop:
function gameLoop(deltaTime: number): void {
  if (!hitStopSystem.update(deltaTime)) {
    // Skip physics update during hit-stop
    renderer.render(scene, camera);
    composer.render();
    return;
  }
  
  // Normal game logic
  updateEntities(deltaTime);
  updateProjectiles(deltaTime);
  checkCollisions();
  
  renderer.render(scene, camera);
  composer.render();
}

// Trigger on heavy impacts:
function onBulletHitEnemy(bullet: Projectile, enemy: Enemy): void {
  hitStopSystem.trigger(100); // 100ms freeze for impact feel
  spawnExplosion(enemy.position, 20);
  score += calculateScore(enemy.type);
}
```

### Particle System Priority Logic
```typescript
class ParticleManager {
  private particles: Particle[] = [];
  private readonly MAX_PARTICLES = 500; // hard cap
  
  spawn(position: Vector3, type: 'explosion' | 'trail' | 'spark'): void {
    if (this.particles.length >= this.MAX_PARTICLES) {
      // Evict oldest particle to maintain cap
      const oldestIndex = this.particles.findIndex(p => p.lifetime <= 0);
      if (oldestIndex !== -1) {
        this.recycleParticle(oldestIndex);
      } else {
        return; // no space, drop spawn request
      }
    }
    
    const particle = this.createParticle(position, type);
    this.particles.push(particle);
  }
  
  update(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Physics integration
      p.velocity.addScaledVector(p.acceleration, deltaTime);
      p.position.addScaledVector(p.velocity, deltaTime);
      p.lifetime -= deltaTime;
      
      if (p.lifetime <= 0) {
        this.recycleParticle(i);
      }
    }
  }
  
  private recycleParticle(index: number): void {
    const particle = this.particles[index];
    particle.position.set(0, 0, 0); // reset position
    particle.lifetime = 0; // mark as inactive
    
    // Remove from array and push to pool for reuse
    this.particles.splice(index, 1);
    objectPool.returnParticle(particle);
  }
}

// Priority spawning order during complex events:
function onMajorExplosion(position: Vector3): void {
  spawnParticles(position, 'explosion', count: 20); // primary explosion
  spawnParticles(position, 'spark', count: 10);     // secondary sparks
  triggerShockwave(position);                       // shockwave ring
  addFloatingText(position, "+100", Color.YELLOW); // score popup
}
```

### Motion Trails System
```typescript
class MotionTrailManager {
  private trails: Map<number, TrailSegment[]> = new Map();
  
  startTrail(objectId: number): void {
    this.trails.set(objectId, []);
  }
  
  addSegment(objectId: number, position: Vector3, color: Color): void {
    const trail = this.trails.get(objectId) || [];
    trail.push({ position: position.clone(), color: color.clone(), age: 0 });
    
    if (trail.length > MAX_TRAIL_LENGTH) {
      trail.shift(); // remove oldest segment
    }
    
    this.trails.set(objectId, trail);
  }
  
  renderTrails(): void {
    this.trails.forEach((segments, objectId) => {
      const geometry = new BufferGeometry();
      const positions = [];
      const colors = [];
      
      segments.forEach(segment => {
        segment.age += deltaTime;
        
        if (segment.age < MAX_TRAIL_AGE) {
          positions.push(
            segment.position.x, segment.position.y, segment.position.z
          );
          
          // Fade color over time
          const alpha = 1 - (segment.age / MAX_TRAIL_AGE);
          colors.push(
            segment.color.r * alpha,
            segment.color.g * alpha,
            segment.color.b * alpha
          );
        }
      });
      
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      
      const material = new LineBasicMaterial({ 
        vertexColors: true,
        transparent: true,
        opacity: 0.6
      });
      
      const line = new Lines(geometry, material);
      scene.add(line);
    });
  }
}

// Usage for fast-moving objects:
function updatePlayer(deltaTime: number): void {
  const previousPosition = player.position.clone();
  
  // Move player based on input
  player.position.x += velocity.x * deltaTime;
  
  // Add motion trail segment
  if (Math.abs(velocity.x) > 5) { // only trail when moving fast
    motionTrail.addSegment(player.id, previousPosition, PLAYER_COLOR);
  }
}
```

### Shockwave Rings System
```typescript
class ShockwaveRingManager {
  private rings: ShockwaveRing[] = [];
  
  spawn(position: Vector3, color: Color, radius: number = 2): void {
    const ring = new ShockwaveRing(position, color, radius);
    this.rings.push(ring);
  }
  
  update(deltaTime: number): void {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      
      ring.radius += ring.expansionSpeed * deltaTime;
      ring.opacity -= ring.fadeRate * deltaTime;
      
      if (ring.opacity <= 0) {
        scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
        this.rings.splice(i, 1);
      } else {
        ring.mesh.material.opacity = ring.opacity;
      }
    }
  }
}

class ShockwaveRing {
  mesh: RingGeometry;
  radius: number;
  opacity: number;
  
  constructor(position: Vector3, color: Color, initialRadius: number) {
    const geometry = new RingGeometry(initialRadius, initialRadius + 0.5, 32);
    const material = new MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    
    this.mesh = new Mesh(geometry, material);
    this.mesh.position.copy(position);
    this.mesh.rotation.x = Math.PI / 2; // lie flat on ground plane
    
    scene.add(this.mesh);
    
    this.radius = initialRadius;
    this.opacity = 1.0;
    this.expansionSpeed = 8; // units per second
    this.fadeRate = 2.5; // opacity per second
  }
}

// Trigger on major impacts:
function onPlayerDeath(position: Vector3): void {
  shockwaveManager.spawn(position, new Color(0xff0000), 1);
  setTimeout(() => shockwaveManager.spawn(position, new Color(0xffaa00), 2), 100);
  setTimeout(() => shockwaveManager.spawn(position, new Color(0xffff00), 3), 200);
}

function onEnemyWaveClear(): void {
  // Victory shockwave across entire screen
  shockwaveManager.spawn(new Vector3(0, -5, 0), new Color(0x00ff00), 10);
}
```

### Floating Score Text System (Hybrid 3D/HTML)
```typescript
class FloatingTextSystem {
  private texts: FloatingTextElement[] = [];
  
  spawn(position: Vector3, text: string, color: Color): void {
    // Create HTML overlay element for crisp text rendering
    const element = document.createElement('div');
    element.className = 'floating-text';
    element.style.color = `rgb(${color.r*255},${color.g*255},${color.b*255})`;
    element.textContent = text;
    
    // Position in 3D space, project to screen coordinates
    const screenPos = position.clone().project(camera);
    element.style.left = `${(screenPos.x * 0.5 + 0.5) * window.innerWidth}px`;
    element.style.top = `${(-(screenPos.y * 0.5) + 0.5) * window.innerHeight - 100}px`;
    
    document.body.appendChild(element);
    
    this.texts.push({
      element,
      position: position.clone(),
      velocity: new Vector3(0, 2, 0), // float upward
      lifetime: 2.0,
      maxLifetime: 2.0
    });
  }
  
  update(deltaTime: number): void {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const ft = this.texts[i];
      
      ft.position.addScaledVector(ft.velocity, deltaTime);
      ft.lifetime -= deltaTime;
      
      // Update HTML position based on 3D movement
      const screenPos = ft.position.clone().project(camera);
      ft.element.style.left = `${(screenPos.x * 0.5 + 0.5) * window.innerWidth}px`;
      ft.element.style.top = `${(-(screenPos.y * 0.5) + 0.5) * window.innerHeight - 100}px`;
      
      // Fade out
      const alpha = ft.lifetime / ft.maxLifetime;
      ft.element.style.opacity = String(alpha);
      
      if (ft.lifetime <= 0) {
        ft.element.remove();
        this.texts.splice(i, 1);
      }
    }
  }
}

// Usage on score events:
function addScore(position: Vector3, points: number): void {
  const color = getScoreColor(points); // yellow for normal, gold for bonus
  floatingText.spawn(position, `+${points}`, color);
  
  if (points >= 100) {
    shockwaveManager.spawn(position, color, 2);
    triggerHapticFeedback('powerUp');
  }
}

function getScoreColor(points: number): Color {
  if (points >= 30) return new Color(0xffaa00); // gold for high score
  if (points >= 20) return new Color(0xffff00); // yellow for medium
  return new Color(0x00ffff); // cyan for low score
}
```

---

## 5. FILE ARCHITECTURE & IMPORT PATHS

### Core Module Dependencies
```
games/Space_Invaders/
├── index.html                    # Game container with glassmorphism UI overlay
├── main.ts                       # Entry point, initializes engine and game state
├── config.ts                     # Game constants (speeds, scores, difficulty)
│
├── entities/
│   ├── PlayerShip.ts             # Player entity class with movement logic
│   ├── Enemy.ts                  # Base enemy class with type-specific behavior
│   ├── Projectile.ts             # Bullet entity (player & enemy variants)
│   └── PowerUp.ts                # Optional power-up entity system
│
├── systems/
│   ├── GameLoop.ts               # Main game loop, state machine controller
│   ├── CollisionSystem.ts        # AABB collision detection and resolution
│   ├── WaveManager.ts            # Enemy wave spawning and progression
│   ├── ScoreSystem.ts            # Scoring, high score persistence
│   └── UIManager.ts              # HUD rendering, menu transitions
│
├── vfx/
│   ├── ExplosionVFX.ts           # Particle explosion generation
│   ├── ShockwaveManager.ts       # Shockwave ring spawning and animation
│   ├── FloatingTextSystem.ts     # Score popup text overlay system
│   └── HitStopController.ts      # Frame freeze on impacts
│
├── graphics/
│   ├── ProceduralTextures.ts     # Canvas-based texture generation
│   ├── NeonMaterials.ts          # PBR material presets for neon aesthetic
│   ├── StarfieldBackground.ts    # Parallax starfield implementation
│   └── EffectComposerSetup.ts    # Post-processing stack configuration
│
├── audio/
│   └── AudioSynth.ts             # Web Audio API SFX and music synthesis
│
└── shared/                       # Cross-game reusable utilities (already defined)
    ├── core/
    │   ├── GameEngine.ts         # Main loop, delta time management
    │   ├── InputManager.ts       # Keyboard + gamepad unified input
    │   └── ObjectPool.ts         # Generic object pooling system
    ├── vfx/
    │   ├── CameraShake.ts        # Trauma-based camera shake
    │   ├── ParticleManager.ts    # Particle spawning with 500 cap
    │   └── MotionTrails.ts       # Trail rendering for fast objects
    ├── graphics/
    │   ├── ProceduralTextures.ts # Shared texture generation utilities
    │   └── EffectComposerSetup.ts# Shared post-processing config
    └── utils/
        ├── MathUtils.ts          # Vector, rotation, collision helpers
        └── Noise.ts              # Simplex noise for procedural gen
```

### Import Path Map (ES Modules)
```typescript
// main.ts imports
import { GameEngine } from '../core/GameEngine.js';
import { InputManager } from '../core/InputManager.js';
import { ObjectPool } from '../core/ObjectPool.js';
import { ParticleManager } from '../vfx/ParticleManager.js';
import { CameraShake } from '../vfx/CameraShake.js';

// entities imports
import { PlayerShip } from './entities/PlayerShip.js';
import { Enemy } from './entities/Enemy.js';
import { Projectile } from './entities/Projectile.js';

// systems imports
import { GameLoop } from './systems/GameLoop.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { WaveManager } from './systems/WaveManager.js';

// graphics imports
import { ProceduralTextures } from '../graphics/ProceduralTextures.js';
import { NeonMaterials } from '../graphics/NeonMaterials.js';
import { StarfieldBackground } from '../graphics/StarfieldBackground.js';
import { EffectComposerSetup } from '../graphics/EffectComposerSetup.js';

// audio imports
import { AudioSynth } from './audio/AudioSynth.js';

// vfx imports
import { ExplosionVFX } from './vfx/ExplosionVFX.js';
import { ShockwaveManager } from './vfx/ShockwaveManager.js';
import { FloatingTextSystem } from './vfx/FloatingTextSystem.js';
import { HitStopController } from './vfx/HitStopController.js';

// config imports
import { GAME_CONFIG, ENEMY_TYPES, SCORE_VALUES } from './config.js';
```

### Shared Utility Exports (Cross-Game Reusable)
```typescript
// shared/core/GameEngine.ts exports
export class GameEngine {
  constructor();
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  getState(): GameState;
}

// shared/core/InputManager.ts exports
export class InputManager {
  constructor();
  update(deltaTime: number): void;
  getAxis(axis: string): number;
  getButton(button: string): boolean;
  isKeyDown(key: string): boolean;
}

// shared/vfx/CameraShake.ts exports
export class CameraShake {
  trigger(intensity: number, decayRate: number): void;
  update(deltaTime: number): Vector3;
  reset(): void;
}

// shared/graphics/EffectComposerSetup.ts exports
export function setupEffectComposer(renderer: Renderer): EffectComposer;
export function configureBloomPass(pass: UnrealBloomPass, strength: number): void;
```

---

## IMPLEMENTATION SEQUENCE (STEP 3 TRIGGER)

**Upon receiving "Plan approved", the following files will be written in order:**

1. `games/Space_Invaders/config.ts` - Game constants and tuning parameters
2. `shared/core/GameEngine.ts` - Core game loop infrastructure
3. `shared/core/InputManager.ts` - Unified input handling
4. `shared/vfx/CameraShake.ts` - Trauma-based shake system
5. `shared/vfx/ParticleManager.ts` - Particle spawning with 500 cap
6. `shared/vfx/MotionTrails.ts` - Trail rendering for fast objects
7. `shared/graphics/ProceduralTextures.ts` - Canvas texture generation
8. `shared/graphics/EffectComposerSetup.ts` - Post-processing stack
9. `games/Space_Invaders/entities/PlayerShip.ts` - Player entity
10. `games/Space_Invaders/entities/Enemy.ts` - Enemy base class
11. `games/Space_Invaders/entities/Projectile.ts` - Bullet system
12. `games/Space_Invaders/systems/GameLoop.ts` - State machine controller
13. `games/Space_Invaders/systems/CollisionSystem.ts` - AABB collision detection
14. `games/Space_Invaders/systems/WaveManager.ts` - Wave progression logic
15. `games/Space_Invaders/vfx/ExplosionVFX.ts` - Particle explosions
16. `games/Space_Invaders/vfx/ShockwaveManager.ts` - Shockwave rings
17. `games/Space_Invaders/vfx/FloatingTextSystem.ts` - Score popups
18. `games/Space_Invaders/vfx/HitStopController.ts` - Frame freeze system
19. `games/Space_Invaders/audio/AudioSynth.ts` - Web Audio synthesis
20. `games/Space_Invaders/main.ts` - Entry point and initialization
21. `games/Space_Invaders/index.html` - Game container with UI overlay

**Total files to write: 21 production-ready, fully-implemented ES modules.**

---

## VERIFICATION CHECKLIST (Before Reporting Done)

- [ ] All imports resolve to actual exports in written files
- [ ] No placeholder syntax (`// ... rest of function`) anywhere
- [ ] Object pooling implemented for projectiles and particles
- [ ] ParticleManager enforces 500 active particle hard cap
- [ ] EffectComposer with UnrealBloomPass configured correctly
- [ ] All six required VFX systems implemented (Camera Shake, Particles, Hit-Stop, Motion Trails, Shockwave Rings, Floating Text)
- [ ] Glassmorphism UI overlay present and styled
- [ ] Dual-input controller supports both keyboard and gamepad
- [ ] Memory management: `.dispose()` called on all disposed resources
- [ ] Game is playable from menu to win/loss state

---

**Awaiting "Plan approved" to proceed with full implementation.**
