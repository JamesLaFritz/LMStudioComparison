# Space Invaders — AAA Retro-Futurism Plan

## 1. Core Gameplay

### Classic Mechanics, Mathematically Modeled

**Player Movement:**
- Horizontal translation along X-axis at fixed Z depth (z = 0).
- Speed: 8 units/sec (keyboard), gamepad axis with deadzone 0.2, max speed 8 units/sec.
- Clamped to arena bounds: x ∈ [-9, 9].

**Alien Formation:**
- Grid: 5 rows × 11 columns = 55 aliens per wave.
- Spacing: dx = 1.4 (horizontal), dy = 0.8 (vertical).
- Formation center starts at (0, 3) and moves laterally.
- Lateral speed starts at 0.15 units/sec, increases as aliens are destroyed: `speed = baseSpeed × (1 + (55 - aliveCount) / 55 × 2.5)`.
- When any alien hits the left or right boundary (x < -9.5 or x > 9.5), the entire formation drops dy = 0.3 and reverses direction.
- On the last row, aliens fire downward.

**Alien Shooting:**
- Each frame, a random chance `shootChance = 0.002 + (55 - aliveCount) × 0.0004` triggers one alien to shoot.
- The shooter is selected by: pick a random column (0–10), find the bottom-most living alien in that column → fires downward at velocity (0, -6).
- Maximum simultaneous enemy projectiles on screen: 8.

**Player Shooting:**
- One projectile active at a time (classic constraint).
- Projectile velocity: (0, 12) units/sec.
- Fire rate cooldown: 0.3 seconds between shots.

**Collision Detection (AABB):**
- Player ship AABB: half-extents (0.5, 0.25).
- Alien AABB: half-extents (0.45, 0.35) — varies slightly per type.
- Projectile AABB: half-extents (0.08, 0.15).
- Resolution: remove projectile on any hit; if alien hit → destroy alien + particles + score; if player hit → lose life + screen shake + hit-stop.

**Shields/Barriers:**
- 4 shield blocks positioned at x = [-6, -2, 2, 6], z = -3.
- Each shield is a destructible grid of small cubes (5×7 per shield).
- Both player and alien projectiles damage shields (AABB vs individual cube segments).

**Mystery Ship (Bonus):**
- Spawns every 15–40 seconds, flies across the top at y = 6.5, z = -2.
- Speed: 3 units/sec, random direction.
- Points: 50/100/150 (displayed briefly on screen when spawned).
- Survives until it exits screen or is shot.

**Progression:**
- Wave completes when all aliens are destroyed → next wave starts with faster base speed (+15%).
- Lives: 3 per game, respawn after 2 seconds at center position.
- Game over when lives reach 0 and no aliens remain (aliens reach bottom = instant game over).

---

## 2. Modern Enhancements (20 AAA Upgrades)

### 1. 3D Depth to Classic 2D Plane
The alien formation occupies a plane tilted at 15° from the camera, giving depth perception. The player ship exists on the ground plane (z = 0), aliens are at z = -4, shields at z = -3. Camera is positioned at (0, 6, 12) looking down at ~30° angle — a "isometric-ish" perspective that preserves readability while adding depth.

### 2. Procedural Alien Designs via Combined Geometries
Three alien types procedurally built from Three.js primitives:
- **Type A (Squid):** Torus + Sphere combination, emissive magenta material.
- **Type B (Crab):** Box geometries merged into a crab-like silhouette with antenna details, emissive cyan material.
- **Type C (Octopus):** Icosahedron with displaced vertices for tentacle effect, emissive lime green material.
Each type has two animation states (frame A / frame B) toggled every 0.5 seconds — achieved by swapping vertex positions on a custom BufferGeometry.

### 3. Neon Emissive Projectiles with Custom Glow Shaders
Player projectiles use a `MeshStandardMaterial` with emissive (0, 1, 0.5), emissiveIntensity = 3.0, and a point light attached (color #00ff80, distance 6). Alien projectiles use red-orange emissive (#ff4400, intensity 2.5) with their own point lights.

### 4. Dynamic Point Lights Per Entity
Each alien type has an associated point light that follows it:
- Type A: magenta point light (distance 3, intensity 0.8).
- Type B: cyan point light (distance 3, intensity 0.8).
- Type C: lime point light (distance 3, intensity 0.8).
Lights are pooled and recycled — when an alien dies, its light is released back to the pool.

### 5. Procedural Starfield Background with Parallax
A particle-based starfield using `InstancedMesh` of tiny spheres (or points) at z = -100 to z = -200, three layers moving at different speeds based on camera rotation → parallax depth effect.

### 6. 3D Shield Barriers with Progressive Damage States
Each shield is a grid of 5×7 small cubes (35 per shield). When hit by a projectile, the impacted cube is removed from the scene and disposed. Shields visually degrade over time — remaining cubes slightly shift position for a "damaged" look.

### 7. Screen-Space Motion Trails on Fast Projectiles
Player projectiles maintain an array of last 8 positions → rendered as a `BufferGeometry` line with decreasing opacity via vertex colors (bright at head, fading to transparent at tail). Alien projectile trails use shorter arrays (4 positions) for visual distinction.

### 8. Color-Coded Procedural Explosion Particles Per Alien Type
When an alien dies:
- Type A: 30 magenta particles burst outward with random velocities.
- Type B: 25 cyan particles + spark sub-burst of 10 white sparks.
- Type C: 35 lime particles in a spiral pattern.
All managed by the centralized ParticleManager (hard cap 500).

### 9. Dynamic Camera Zoom Based on Remaining Aliens
Camera Z position interpolates from 12 → 8 as alien count drops from 55 → 0, creating dramatic tension. Interpolation uses smooth damping: `cameraZ += (target - cameraZ) * 0.02`.

### 10. Procedural Sound Synthesis via Web Audio API
All SFX generated in real-time:
- Player shoot: 800Hz square wave → sweeps to 200Hz over 0.15s.
- Alien kill: noise burst (filtered white noise, 200ms decay).
- Player death: descending sawtooth sweep (440→60Hz over 0.8s) + low-frequency rumble.
- Mystery ship: continuous 440Hz tone with vibrato (LFO at 6Hz).
- Formation drop: low bass thump (55Hz sine, 0.3s).
Music: procedural arpeggiated bass line using oscillators in D minor pentatonic.

### 11. Formation Distortion Waves on Damage
When a row of aliens is hit, the remaining aliens in that row briefly pulse their emissive intensity (2× for 0.2s) — a "damage ripple" effect visible across the formation.

### 12. Volumetric Glow Mystery Ship
The mystery ship is built from a custom geometry (elongated capsule shape) with high-emissive gold material (#ffdd00, intensity 4.0), surrounded by a transparent sphere with fresnel-like shader for a "halo" effect. It also has a trailing particle system.

### 13. Procedural Ground Plane with Retro Grid
A large plane at y = -0.5 with a custom grid texture generated via Canvas API — neon cyan lines on dark background, extending from x = [-12, 12], z = [-8, 4]. The grid has a subtle glow effect via emissive material properties.

### 14. Alien Death Shockwave Rings
On each alien death, an expanding `RingGeometry` is spawned at the alien's position — starts with radius 0.1, expands to 2.0 over 0.5 seconds, opacity fades from 1.0 → 0. The ring uses a custom shader with fresnel-like edge glow in the alien's death color.

### 15. Floating Score Text in 3D Space
When an alien is destroyed, a floating HTML element (positioned via screen-space projection of the kill location) displays the score points ("+100", "+200", etc.) with glassmorphism styling and neon glow. The text rises upward and fades over 1.5 seconds.

### 16. Dynamic Bloom Intensity Based on Screen Chaos
The `UnrealBloomPass` strength dynamically adjusts: base = 1.5, increases by +0.3 for every 10 active projectiles, +0.5 during player death hit-stop. This creates a "chaos-reactive" visual feel.

### 17. Player Ship Thrust Particles
When the player moves (any direction), small green particles emit from the rear of the ship — 2–3 per frame, velocity biased backward, lifetime 0.4s. These are managed by the ParticleManager and use instanced rendering for performance.

### 18. Screen-Edge Vignette Post-Processing
A custom vignette pass applied after bloom: darkens screen edges with a radial gradient, giving a CRT monitor feel that complements the retro-futuristic theme.

### 19. Alien Formation "Idle Animation" — Subtle Breathing
The entire alien formation subtly oscillates in Y (±0.05 units) using `Math.sin(time × 2)` to give the formation a living, breathing quality rather than being rigidly static.

### 20. Procedural Wave Transition Cinematic
Between waves, the screen fades to black for 1.5 seconds while a glassmorphism panel displays "WAVE N" with neon glow, then the new wave drops in from above with a camera shake impact. This is handled by the GameEngine's hit-stop and fade controller.

---

## 3. Graphics Pipeline

### Post-Processing Stack (EffectComposer)
```
RenderPass (base scene render)
  → UnrealBloomPass (strength: dynamic[1.5–3.0], radius: 0.4, threshold: 0.1)
    → ShaderPass (Vignette — radial darkening, darkness: 0.6)
      → OutputPass (tone mapping, color space correction)
```

### Bloom Configuration Details
- **Strength:** Base 1.5. Modulated by chaos meter: `strength = base + activeProjectiles × 0.03 + (hitStopActive ? 1.5 : 0)`.
- **Radius:** Fixed at 0.4 — tight bloom for crisp neon edges, not a soft glow wash.
- **Threshold:** 0.1 — only very bright emissive surfaces trigger bloom, keeping the dark background clean.

### Procedural Generation Math

**Starfield (InstancedMesh):**
```javascript
const starCount = 800;
const geometry = new THREE.SphereGeometry(0.03, 4, 4); // tiny low-poly spheres
const material = new MeshStandardMaterial({ color: 0xffffff, emissive: 0x444466 });
const instancedMesh = new InstancedMesh(geometry, material, starCount);

for (let i = 0; i < starCount; i++) {
  const layer = Math.floor(i / (starCount / 3)); // 3 depth layers
  const scale = [0.8, 1.0, 1.2][layer]; // parallax speed factor
  const matrix = new Matrix4();
  matrix.setPosition(
    random(-20, 20),
    random(5, 15),
    -100 - layer * 30 // depth layers at z=-100, -130, -160
  );
  matrix.scale(new Vector3(scale, scale, scale));
  instancedMesh.setMatrixAt(i, matrix);
}
```

**Grid Texture (Canvas API):**
```javascript
function createGridTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a1a'; // dark background
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#00ffcc'; // neon cyan grid lines
  ctx.lineWidth = 2;
  const spacing = 32;
  for (let x = 0; x <= 512; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
  }
  for (let y = 0; y <= 512; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 3);
  return texture;
}
```

**Alien Geometry Displacement (for Octopus type):**
```javascript
function createOctopusGeometry() {
  const geo = new IcosahedronGeometry(0.5, 2);
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    // Displace lower vertices to create tentacle effect
    if (y < -0.1) {
      const displacement = Math.sin(y * 8 + time) * 0.15;
      positions.setX(i, x + displacement);
      positions.setY(i, y - 0.2);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
```

### Lighting Setup
- **Ambient Light:** intensity 0.15, color #1a1a2e (deep navy) — sets the dark retro-futuristic mood.
- **Directional Light:** intensity 0.4, from camera direction — provides basic scene illumination without washing out emissive materials.
- **Point Lights:** pooled per alien type (see Enhancement #4).

### PBR Material Strategy
All entities use `MeshStandardMaterial`:
- Player ship: metalness 0.7, roughness 0.2, emissive #00ff80, emissiveIntensity 1.5.
- Aliens Type A: metalness 0.3, roughness 0.4, emissive #ff00ff, intensity 2.0.
- Aliens Type B: metalness 0.3, roughness 0.4, emissive #00ffff, intensity 2.0.
- Aliens Type C: metalness 0.3, roughness 0.4, emissive #88ff00, intensity 2.0.
- Projectiles: metalness 0.0, roughness 0.1, high emissive + attached point light.
- Ground grid: metalness 0.5, roughness 0.3, emissiveMap from canvas texture.

---

## 4. VFX Implementation — Priority Logic

### Camera Shake (Trauma-Based System)
```javascript
class CameraShake {
  constructor() {
    this.intensity = 0;
    this.decay = 0.92; // exponential decay per frame
    this.frequency = 8; // Hz of oscillation
  }

  addTrauma(amount) {
    this.intensity = Math.min(this.intensity + amount, 3.0); // cap at 3.0
  }

  update(deltaTime) {
    if (this.intensity < 0.01) return;
    this.intensity *= Math.pow(this.decay, deltaTime * 60); // frame-rate independent decay
    
    // Apply offset to camera position
    const offsetX = Math.sin(performance.now() * this.frequency * 0.01) * this.intensity * 0.05;
    const offsetY = Math.cos(performance.now() * this.frequency * 0.013) * this.intensity * 0.03;
    
    // Store offsets for the camera controller to apply
    return { offsetX, offsetY };
  }

  // Trigger levels:
  // Alien kill: addTrauma(0.2) — subtle shake
  // Player hit: addTrauma(1.5) — strong shake
  // Player death: addTrauma(2.5) — intense shake
}
```

### Hit-Stop / Frame-Freeze (Timescale Dilation)
```javascript
class HitStop {
  constructor() {
    this.timescale = 1.0;
    this.targetTimescale = 1.0;
    this.rampSpeed = 20.0; // how fast timescale returns to 1.0
  }

  trigger(duration) {
    this.timescale = 0.05; // near-freeze
    this.targetTimescale = 1.0;
    this.recoverDuration = duration;
    this.elapsed = 0;
  }

  update(deltaTime) {
    if (this.timescale < 0.99) {
      this.elapsed += deltaTime;
      const t = Math.min(this.elapsed / this.recoverDuration, 1.0);
      // Smooth ramp: ease-out cubic
      this.timescale = 0.05 + (1.0 - 0.05) * (1 - Math.pow(1 - t, 3));
    }
    return this.timescale;
  }

  // Trigger levels:
  // Alien kill: trigger(0.04s) — brief micro-stutter
  // Player hit: trigger(0.1s) — noticeable impact freeze
  // Player death: trigger(0.25s) — dramatic slow-mo recovery
}
```

### Procedural Particle Bursts (Centralized Manager, Hard Cap 500)
```javascript
class ParticleManager {
  constructor(maxParticles = 500) {
    this.maxParticles = maxParticles;
    this.particles = []; // active particles array
    this.pool = new ObjectPool(() => createParticleData(), maxParticles);
  }

  spawnBurst(position, count, color, velocityRange = 4.0, lifetime = 0.8) {
    const spawned = Math.min(count, this.maxParticles - this.particles.length);
    for (let i = 0; i < spawned; i++) {
      const particle = this.pool.acquire();
      particle.position.copy(position);
      particle.velocity.set(
        random(-velocityRange, velocityRange),
        random(-velocityRange, velocityRange),
        random(-velocityRange * 0.5, velocityRange * 0.5)
      );
      particle.color = new Color(color);
      particle.lifetime = lifetime + random(-0.2, 0.2);
      particle.age = 0;
      particle.size = random(0.05, 0.15);
      this.particles.push(particle);
    }
  }

  update(deltaTime) {
    // Update each particle
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += deltaTime;
      if (p.age >= p.lifetime) {
        this.pool.release(p);
        this.particles.splice(i, 1);
        continue;
      }
      // Physics: velocity + gravity + drag
      p.velocity.y -= 2.0 * deltaTime; // slight gravity
      p.velocity.multiplyScalar(0.98); // air drag
      p.position.add(p.velocity.clone().multiplyScalar(deltaTime));
    }
  }

  render(camera, scene) {
    // Render all active particles via InstancedMesh for performance
    // Update instance matrices and colors each frame
  }

  dispose() {
    this.particles.forEach(p => this.pool.release(p));
    this.particles.length = 0;
  }
}
```

### Shockwave Rings
```javascript
class ShockwaveRing {
  constructor(position, color) {
    this.geometry = new RingGeometry(0.1, 0.3, 32);
    this.material = new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.position.copy(position);
    this.mesh.rotation.x = -Math.PI / 2; // flat on ground plane
    this.radius = 0.1;
    this.maxRadius = 2.5;
    this.lifetime = 0.6;
    this.age = 0;
  }

  update(deltaTime) {
    this.age += deltaTime;
    const t = Math.min(this.age / this.lifetime, 1.0);
    this.radius = 0.1 + (this.maxRadius - 0.1) * t;
    this.geometry.dispose();
    this.geometry = new RingGeometry(this.radius * 0.8, this.radius, 32);
    this.material.opacity = 1.0 - t;
    return t < 1.0; // true if still alive
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
```

### Motion Trails (Player Projectiles)
Each projectile maintains a ring buffer of last N positions:
```javascript
class ProjectileTrail {
  constructor(maxPoints = 8) {
    this.positions = []; // Vector3[]
    this.maxPoints = maxPoints;
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new Float32BufferAttribute([], 3));
    this.geometry.setAttribute('color', new Float32BufferAttribute([], 3));
    this.material = new LineBasicMaterial({ vertexColors: true, transparent: true });
    this.line = new Line(this.geometry, this.material);
  }

  addPosition(pos) {
    this.positions.push(pos.clone());
    if (this.positions.length > this.maxPoints) this.positions.shift();
    this.updateGeometry();
  }

  updateGeometry() {
    const positions = [];
    const colors = [];
    for (let i = 0; i < this.positions.length; i++) {
      positions.push(this.positions[i].x, this.positions[i].y, this.positions[i].z);
      const alpha = i / this.positions.length; // fade from head to tail
      colors.push(0, 1, alpha * 0.8); // green trail fading out
    }
    this.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
```

### Floating Score Text (HTML Overlay)
Positioned via screen-space projection:
```javascript
function spawnFloatingText(worldPosition, text, color = '#00ff80') {
  const el = document.createElement('div');
  el.className = 'floating-score';
  el.style.color = color;
  el.textContent = text;
  document.getElementById('ui-overlay').appendChild(el);

  // Project world position to screen space each frame
  const updatePosition = () => {
    const projected = worldPosition.clone().project(camera);
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    el.style.left = `${x}px`;
    el.style.top = `${y - riseAmount}px`; // rising offset over time
    if (projected.z > 1) { el.remove(); return false; } // behind camera
    return true;
  };

  // Animate and remove after lifetime
  setTimeout(() => el.remove(), 1500);
}
```

---

## 5. File Architecture

### Complete ES Module List with Import Paths

```
Space_Invaders/
│
├── plan.md                          # This document
│
├── index.js                         # Entry point: bootstraps GameEngine + SpaceInvadersGame
│   └── imports:
│       ├── /shared/engine/GameEngine.js
│       └── ./SpaceInvadersGame.js
│
├── SpaceInvadersGame.js             # Core game logic: state machine, wave management, scoring
│   └── imports:
│       ├── /shared/input/InputManager.js
│       ├── /shared/math/AABB.js
│       ├── /shared/pool/ObjectPool.js
│       ├── /shared/pool/ProjectilePool.js
│       ├── /shared/particles/ParticleManager.js
│       ├── /shared/vfx/CameraShake.js
│       ├── /shared/vfx/HitStop.js
│       ├── ./entities/PlayerShip.js
│       ├── ./entities/AlienFormation.js
│       ├── ./entities/ShieldBlock.js
│       └── ./components/ScoreHUD.js
│
├── entities/
│   │
│   ├── PlayerShip.js                # Player ship: movement, shooting, thrust particles
│   │   └── imports:
│   │       ├── /shared/input/InputManager.js
│   │       ├── /shared/pool/ProjectilePool.js
│   │       ├── /shared/particles/ParticleManager.js
│   │       ├── /shared/rendering/MaterialFactory.js
│   │       └── ./ProjectileTrail.js
│   │
│   ├── AlienFormation.js            # Grid management, formation movement, alien spawning/despawning
│   │   └── imports:
│   │       ├── /shared/math/AABB.js
│   │       ├── /shared/pool/EntityPool.js
│   │       ├── /shared/vfx/CameraShake.js
│   │       ├── /shared/vfx/HitStop.js
│   │       ├── /shared/particles/ParticleManager.js
│   │       ├── /shared/rendering/MaterialFactory.js
│   │       └── ./Alien.js
│   │
│   ├── Alien.js                     # Individual alien: geometry, animation frame, point light attachment
│   │   └── imports:
│   │       ├── /shared/rendering/MaterialFactory.js
│   │       └── /shared/pool/ObjectPool.js (for point lights)
│   │
│   ├── ShieldBlock.js               # Destructible shield grid with per-cube AABB collision
│   │   └── imports:
│   │       ├── /shared/rendering/MaterialFactory.js
│   │       └── /shared/math/AABB.js
│   │
│   ├── ProjectileTrail.js           # Motion trail renderer for projectiles (see VFX section)
│   │   └── imports: none (self-contained)
│   │
│   └── MysteryShip.js               # Bonus UFO entity with volumetric glow and trailing particles
│       └── imports:
│           ├── /shared/rendering/MaterialFactory.js
│           └── /shared/particles/ParticleManager.js
│
├── components/
│   │
│   ├── ScoreHUD.js                  # Glassmorphism HTML overlay for score, lives, wave number
│   │   └── imports: none (DOM-only)
│   │
│   └── FloatingText.js              # Dynamic floating score text spawner (see VFX section)
│       └── imports: none (DOM-only utility)
│
└── utils/
    │
    ├── AlienGeometryBuilder.js      # Procedural geometry creation for all 3 alien types
    │   └── imports: none (pure geometry math)
    │
    ├── GridTextureGenerator.js      # Canvas-based grid texture for ground plane
    │   └── imports: none (pure canvas API)
    │
    └── StarfieldBuilder.js          # InstancedMesh starfield with parallax layers
        └── imports: none (pure Three.js setup)
```

### Import Path Rules
- **All shared modules** are imported via `/shared/...` alias configured in `vite.config.js`.
- **Game-local modules** use relative paths (`./entities/PlayerShip`, `../SpaceInvadersGame`).
- **No cross-game imports** — each game is fully isolated.
- **No circular dependencies** — the dependency graph flows: `index.js → GameEngine + GameLogic → entities → shared utilities`.

### Memory Management Plan
1. **Object Pools:** ProjectilePool (pre-warmed to 20), EntityPool for aliens (pre-warmed to 60), generic ObjectPool for point lights (pre-warmed to 55).
2. **Particle Manager:** Hard cap at 500; particles released back to pool on lifetime expiry.
3. **InstancedMesh:** Used for starfield (800 stars), shield cubes (4 shields × 35 = 140 cubes — could be merged into a single InstancedMesh per shield).
4. **Dispose on cleanup:** Every geometry, material, texture, and mesh created during gameplay is tracked and disposed when the game ends or wave transitions.
5. **Point Light Pool:** Lights are not created/destroyed per alien; they are pooled and attached/detached from alive aliens each frame.

---

## 6. Wave State Machine

```
STATE: IDLE → (player presses fire / space) → SHOOTING
STATE: ALIEN_ALIVE → (all aliens destroyed) → WAVE_TRANSITION
STATE: WAVE_TRANSITION → (transition complete) → IDLE (next wave, increased speed)
STATE: PLAYER_HIT → (hit-stop + shake) → IDLE (if lives remain) or GAME_OVER
STATE: GAME_OVER → (display final score) → IDLE (restart prompt)
```

### Wave Transition Sequence
1. All aliens destroyed → trigger `HitStop.trigger(0.25s)`.
2. Camera zooms to max tension (Z = 8).
3. Screen fades to black over 0.5s via overlay div opacity.
4. Glassmorphism panel displays "WAVE N" with neon glow animation.
5. After 1.5s, fade back in → aliens drop from above (y = 10) with camera shake impact.

---

## 7. Performance Budget

| Metric | Target | Strategy |
|--------|--------|----------|
| Active particles | ≤ 500 | Centralized ParticleManager with hard cap |
| Projectiles on screen | ≤ 9 (8 enemy + 1 player) | ProjectilePool, one-at-a-time for player |
| Aliens on screen | ≤ 55 | EntityPool, InstancedMesh where possible |
| Draw calls | ≤ 50 | InstancedMesh for shields, starfield; merged geometries for aliens |
| Geometry count | ≤ 100 | Reuse shared geometries across instances |
| Texture memory | < 2 MB | Canvas-generated textures only (grid, alien sprites) |
| Audio context | Single instance | Web Audio API with shared AudioContext |

---

## 8. Testing & Verification Plan

### Unit Tests (Conceptual — no test framework needed for implementation)
- **AABB collision:** Verify overlap detection between all entity pairs.
- **Formation movement:** Verify direction reversal at boundaries, drop distance consistency.
- **Particle cap:** Verify that spawning 1000 particles simultaneously does not exceed 500 active.
- **Object pool:** Verify acquire/release cycle returns same object references (zero allocation).

### Integration Tests
- **Full wave playthrough:** All 55 aliens destroyed → wave transition → next wave with increased speed.
- **Player death sequence:** Hit → hit-stop → shake → respawn → lives decremented.
- **Shield destruction:** Projectile hits shield → cubes removed → remaining shields still functional.

### Visual Verification Checklist
- [ ] Bloom effect visible on all emissive surfaces (projectiles, aliens, player ship).
- [ ] Camera shake triggers on alien kills and player death with correct intensity levels.
- [ ] Hit-stop freezes simulation for correct duration on impacts.
- [ ] Motion trails render correctly behind moving projectiles.
- [ ] Shockwave rings expand and fade on every impact.
- [ ] Floating score text appears at kill location and rises/fades.
- [ ] Glassmorphism UI is readable against the game scene.
- [ ] Starfield parallax responds to camera movement.
- [ ] Grid ground plane has correct neon cyan lines with proper tiling.
- [ ] Mystery ship has volumetric glow effect and trailing particles.

---

## 9. Implementation Order (for Step 3 execution)

1. **Foundation:** `index.js` → bootstraps shared engine + scene setup.
2. **Player:** `entities/PlayerShip.js` — movement, shooting, thrust particles.
3. **Aliens:** `entities/Alien.js` → `entities/AlienFormation.js` — geometry, formation logic.
4. **Projectiles & Trails:** ProjectilePool integration + `ProjectileTrail.js`.
5. **Shields:** `entities/ShieldBlock.js` — destructible grid with per-cube collision.
6. **Mystery Ship:** `entities/MysteryShip.js` — bonus entity.
7. **VFX Integration:** Camera shake, hit-stop, particle bursts, shockwave rings on kills.
8. **HUD & UI:** `components/ScoreHUD.js`, `components/FloatingText.js`.
9. **Environment:** Starfield, ground grid, lighting setup.
10. **Audio:** Web Audio API SFX and music engine integration.
11. **Wave Management:** State machine, progression, transitions.
12. **Polish:** Dynamic bloom, vignette post-processing, idle animations, final tuning.
