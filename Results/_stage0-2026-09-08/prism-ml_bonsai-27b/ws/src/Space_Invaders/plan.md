# Space Invaders — AAA Retro-Futurism Architecture Plan

## 1. Core Gameplay: Mathematical Modeling of Classic Mechanics

### Player Controller
- **Movement:** Continuous velocity-based movement with clamped bounds. Input is accumulated as a normalized direction vector (dx, dy) from the unified input system, then applied to position each frame: `player.position.x += player.velocity * deltaTime`. Maximum speed capped at 300 units/sec.
- **Shooting:** Fire rate limited to 12 shots per second (83ms interval). Each shot spawns a projectile from the player's top-center anchor point. Projectile velocity is fixed upward at -600 units/sec.

### Enemy Formation Dynamics
- **Grid Layout:** 5 rows × 11 columns = 55 enemy entities. Initial positions: row y = [280, 340, 400, 460, 520], column x = [-275, -215, -155, -95, -35, 35, 95, 155, 215, 275, 335].
- **Movement Algorithm:** The formation moves as a single rigid body. Direction toggles every time any edge entity contacts the boundary (x = ±400). Movement speed starts at 80 units/sec and increases by 15% per row eliminated.
- **Step Calculation:** When direction changes, each enemy steps forward by `stepSize` in the current direction. Step size is proportional to formation width: `stepSize = formationWidth * 0.02`.
- **Drop Behavior:** If any edge entity would exceed boundary bounds, all entities drop down by 40 units and reverse horizontal direction.

### Enemy Shooting Logic
- **Target Selection:** Each enemy selects a random player or another enemy as target. Probability of targeting the player is weighted: `playerProbability = 1 / (totalEnemies + 3)`.
- **Fire Rate:** Base rate of 2 shots/sec per enemy, but only one shot at a time across all enemies (global cooldown). The shooter is selected by random choice among all enemies.
- **Projectile Velocity:** Downward at -400 units/sec with slight horizontal variance based on the shooter's position relative to center.

### Scoring System
- **Enemy Values:** Row 1 (top) = 30pts, Row 2 = 20pts, Row 3 = 10pts, Row 4 = 5pts, Row 5 (bottom) = 1pt.
- **Ship Bonuses:** Destroying a UFO that flies across the top row awards 100/150/300 pts randomly.
- **Lives:** Player starts with 3 lives. Each death resets position to center and pauses gameplay for 2 seconds.

### Wave Progression
- After all enemies are destroyed, a brief pause (1 second), then the formation respawns at full health with increased speed. The UFO spawn rate increases each wave.

## 2. Modern Enhancements: 20 AAA Upgrades

### Rendering & Visual
1. **Procedural Enemy Sprites:** Each enemy type is generated via Canvas API as a pixel-perfect sprite with neon glow edges, then converted to a Three.js texture for PBR rendering.
2. **Emissive Material Shading:** Enemies use `MeshStandardMaterial` with emissive color matching their row (red→blue gradient), creating the classic color-coded formation.
3. **Dynamic Lighting:** Directional light with warm tone + ambient light, plus per-object point lights on player and UFO for spotlight effect.
4. **Screen Border Glow:** CSS border with neon cyan glow using `box-shadow: 0 0 20px rgba(0,255,255,0.6)`, reinforcing the arcade cabinet aesthetic.
5. **Vignette Post-Processing:** Custom vignette pass in EffectComposer that darkens screen edges for cinematic framing.

### Gameplay Polish
6. **Hit Stun System:** Player takes 0.3s invincibility frames after taking damage, with a flash effect and camera shake proportional to damage severity.
7. **Enemy Stagger Animation:** When an enemy is hit, it plays a brief "stagger" animation (scale pulse + color shift) before disappearing.
8. **Projectile Trail System:** Player bullets have motion trails; enemy bullets have shorter trails for visual distinction.
9. **Screen Edge Warning:** Subtle pulsing glow on screen edges when enemies are near the boundary, warning of imminent drop.
10. **Wave Announcement:** Floating 3D text "WAVE [N]" appears at top center with scale-in animation and neon glow before each wave starts.

### Audio & Feedback
11. **Synthesized Sound Effects:** Web Audio API generates retro-style sounds: player shot (square wave burst), enemy shot (sawtooth sweep), explosion (noise burst + filter sweep), UFO flyby (sine oscillator with LFO modulation).
12. **Impact Sound Scaling:** Explosion volume scales with impact velocity, creating a sense of weight to hits.
13. **Ambient Drone:** Subtle low-frequency drone plays during gameplay, increasing in pitch as enemy count decreases.
14. **Victory Jingle:** Short synthesized melody plays when all enemies are destroyed, using arpeggiated sine waves with reverb.
15. **Game Over Strobe:** Screen flashes red-white-red for 3 seconds on death, then fades to black before showing game over screen.

### Performance & Systems
16. **Object Pooling:** All projectiles (player + enemy), particles, and hit effects are pooled. Player bullets: pool of 20; enemy bullets: pool of 30.
17. **Instanced Enemy Rendering:** Enemies in the same row use `InstancedMesh` with shared geometry but individual material emissive colors for performance.
18. **Frustum Culling:** Entities outside camera frustum are disabled rather than removed, reducing draw calls.
19. **Delta-Time Throttling:** All physics and movement calculations use normalized delta time to ensure consistent behavior across frame rates.
20. **Memory Leak Prevention:** Every created Three.js object (geometry, material, texture, audio buffer) is tracked in a disposal registry and explicitly freed when no longer needed.

## 3. Graphics Pipeline: Post-Processing & Procedural Generation

### EffectComposer Stack (Applied to RenderPass)
```javascript
// Main render pass with post-processing
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const effectComposer = new EffectComposer(renderer);
effectComposer.addPass(renderPass);

// Post-processing passes (order matters)
effectComposer.addPass(new UnrealBloomPass({
    threshold: 0.5,       // Glow starts above this luminance
    radius: 1.0,         // Bloom spread in screen space
    strength: 1.2,       // Overall bloom intensity
    exponent: 2.0        // Bloom falloff curve
}));

effectComposer.addPass(new VignettePass({
    radius: 0.85,        // Inner radius where vignette starts
    factor: 1.5          // Darkness multiplier at edge
}));

// Screen-space effects (applied after bloom)
effectComposer.addPass(new MotionBlurPass({
    blurAmount: 0.3,     // Subtle motion blur for retro feel
    strength: 0.7        // Blur intensity
}));
```

### Procedural Texture Generation (Canvas API)
- **Enemy Sprites:** Each enemy type is drawn pixel-by-pixel on a Canvas, then converted to a Three.js texture via `Texture.fromCanvas()`. The sprites are 32×32 pixels with neon outlines.
- **Player Ship:** A 48×32 procedural sprite with a glowing cockpit and engine flame (animated via canvas redraw every frame).
- **UFO:** A 64×16 procedural sprite with rotating detail elements, generated procedurally to avoid external assets.
- **Background Grid:** A subtle grid texture generated on Canvas with low-opacity cyan lines, used as the floor plane material.

### Material Configuration (MeshStandardMaterial)
```javascript
// Enemy materials per row (color-coded)
const enemyMaterials = [
    { emissive: new THREE.Color(0xFF2244), roughness: 0.3, metalness: 0.7 }, // Row 1 - Red
    { emissive: new THREE.Color(0xFF6600), roughness: 0.3, metalness: 0.7 }, // Row 2 - Orange
    { emissive: new THREE.Color(0xFFCC00), roughness: 0.3, metalness: 0.7 }, // Row 3 - Yellow
    { emissive: new THREE.Color(0x44FF00), roughness: 0.3, metalness: 0.7 }, // Row 4 - Green
    { emissive: new THREE.Color(0x00CCFF), roughness: 0.3, metalness: 0.7 }  // Row 5 - Blue
];

// Player material with glow
const playerMaterial = new MeshStandardMaterial({
    color: new THREE.Color(0x00FFFF),
    emissive: new THREE.Color(0x0088FF),
    roughness: 0.2,
    metalness: 0.9
});

// UFO material with animated glow
const ufoMaterial = new MeshStandardMaterial({
    color: new THREE.Color(0xFF44AA),
    emissive: new THREE.Color(0x88FFCC),
    roughness: 0.1,
    metalness: 0.95
});
```

### Geometry Generation (Procedural Meshes)
- **Enemy Geometries:** Each enemy type is a simple box-based geometry with cutouts, generated via `THREE.BoxGeometry` and `THREE.MeshBasicMaterial`. The shapes are distinct per row but share the same base geometry for instancing.
- **Player Ship:** A composite mesh of three boxes (body, cockpit, engine) joined together, with emissive material on key surfaces.
- **Bullet Geometries:** Small spheres or capsules for projectiles, generated procedurally and pooled.

## 4. VFX Implementation: Priority Logic

### Camera Shake System
```javascript
// Trauma-based camera shake
class CameraShake {
    constructor() {
        this.intensity = 0;
        this.decayRate = 8.0; // Decay per second
        this.maxDuration = 0.5; // Max duration in seconds
    }

    trigger(velocity) {
        // Intensity scales with impact velocity
        this.intensity = Math.min(velocity * 0.1, 20);
        this.duration = Math.min(this.maxDuration, velocity * 0.005);
    }

    update(deltaTime) {
        if (this.intensity > 0) {
            const duration = this.duration - deltaTime;
            if (duration <= 0) {
                this.intensity = 0;
                return;
            }
            // Exponential decay
            this.intensity *= Math.pow(0.1, deltaTime / 0.5);
        }
    }

    getOffset() {
        if (this.intensity <= 0) return new THREE.Vector3();
        const x = (Math.random() - 0.5) * this.intensity;
        const y = (Math.random() - 0.5) * this.intensity;
        return new THREE.Vector3(x, y, 0);
    }
}
```

### Hit-Stop System
```javascript
// Timescale dilation on heavy impacts
class HitStop {
    constructor() {
        this.active = false;
        this.duration = 0.05; // Default 50ms freeze
        this.elapsed = 0;
    }

    trigger(duration) {
        this.active = true;
        this.duration = duration;
        this.elapsed = 0;
    }

    update(deltaTime) {
        if (this.active) {
            this.elapsed += deltaTime;
            if (this.elapsed >= this.duration) {
                this.active = false;
            }
        }
    }

    getTimescale() {
        return this.active ? 0 : 1.0; // Freeze or normal speed
    }
}
```

### Particle System (Centralized Manager with Hard Cap of 500)
```javascript
// Centralized particle pool with strict cap
class ParticleManager {
    constructor(maxParticles = 500) {
        this.maxParticles = maxParticles;
        this.particles = []; // Pool of reusable particles
        this.activeCount = 0;
        
        // Create initial pool
        for (let i = 0; i < maxParticles; i++) {
            this.particles.push(this.createParticle());
        }
    }

    createParticle() {
        const geometry = new THREE.SphereGeometry(0.02, 8, 6);
        const material = new MeshStandardMaterial({
            color: new THREE.Color(0xFFFF),
            emissive: new THREE.Color(0xFFFF),
            size: 1.0
        });
        return {
            mesh: new THREE.Mesh(geometry, material),
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            life: 0,
            maxLife: 0,
            active: false
        };
    }

    spawn(x, y, z, color, count = 10) {
        const available = this.maxParticles - this.activeCount;
        if (available <= 0) return; // Hard cap reached
        
        for (let i = 0; i < count && this.activeCount < this.maxParticles; i++) {
            const particle = this.particles[i];
            particle.position.set(x, y, z);
            particle.velocity.set(
                (Math.random() - 0.5) * 200,
                (Math.random() - 0.5) * 200,
                (Math.random() - 0.5) * 200
            );
            particle.life = Math.random() * 1.0 + 0.5; // Random lifetime
            particle.maxLife = particle.life;
            particle.active = true;
            this.activeCount++;
        }
    }

    update(deltaTime) {
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (!p.active) continue;
            
            // Update position
            p.position.add(p.velocity);
            
            // Decay life
            p.life -= deltaTime;
            if (p.life <= 0) {
                p.active = false;
                this.activeCount--;
            }
        }
    }

    dispose() {
        for (const p of this.particles) {
            p.mesh.dispose();
        }
        this.particles.length = 0;
    }
}
```

### Motion Trails
- Each fast-moving object (player, bullets, UFO) has a trail system that stores recent positions and renders them as fading spheres. Trail length is proportional to velocity: `trailLength = Math.min(velocity * 0.1, 5)`.

### Shockwave Rings
- On enemy death or heavy impact, an expanding ring is spawned at the impact point. The ring grows outward with decreasing opacity over time. Ring geometry is a torus with emissive material.

## 5. File Architecture: ES Module Structure

```
src/Space_Invaders/
├── index.js                  # Entry point: loads scene, starts game loop
├── Game/
│   ├── SpaceInvadersGame.js  # Main game class (state machine, win/loss logic)
│   └── GameState.js          # Enum-like state definitions (MENU, PLAYING, PAUSED, GAME_OVER)
├── Player/
│   ├── PlayerController.js   # Player movement, shooting, invincibility
│   └── PlayerSprite.js       # Procedural player sprite generation
├── Enemies/
│   ├── EnemyFormation.js     # Formation management (movement, dropping, direction toggle)
│   ├── EnemyController.js    # Individual enemy behavior (shooting, AI targeting)
│   ├── EnemySprite.js        # Procedural enemy sprite generation per row type
│   └── EnemyPool.js          # Object pool for enemy entities
├── Projectiles/
│   ├── ProjectileFactory.js  # Factory for creating player and enemy projectiles
│   ├── PlayerBullet.js       # Player bullet class (upward velocity, trail)
│   ├── EnemyBullet.js        # Enemy bullet class (downward velocity, slight variance)
│   └── BulletPool.js         # Object pool for all bullets
├── VFX/
│   ├── CameraShake.js        # Trauma-based camera shake system
│   ├── HitStop.js            # Timescale dilation on impacts
│   ├── ParticleManager.js    # Centralized particle pool (hard cap 500)
│   ├── MotionTrails.js       # Fast-moving object trails
│   └── ShockwaveRings.js     # Expanding impact rings
├── Audio/
│   ├── AudioSynthesizer.js   # Web Audio API sound generation
│   └── SFXManager.js         # Sound playback manager with volume control
├── UI/
│   ├── HUDController.js      # Score, lives, wave display (HTML/CSS overlays)
│   ├── MenuSystem.js         # Main menu and game over screen management
│   └── FloatingText.js       # Dynamic 3D floating score text
├── Utils/
│   ├── InputManager.js       # Unified Dual-Input (Keyboard + Gamepad API)
│   ├── MathUtils.js          # Vector math, noise functions, procedural helpers
│   └── Constants.js          # Game constants (speeds, sizes, colors)
├── Shared/
│   ├── MemoryManager.js      # Explicit .dispose() tracking for all Three.js objects
│   └── ObjectPool.js         # Generic object pool implementation
└── post-processing/
    ├── UnrealBloomPass.js    # Custom bloom pass configuration
    ├── VignettePass.js       # Screen-space vignette effect
    └── MotionBlurPass.js     # Subtle motion blur for retro feel
```

### Import Path Summary
- `SpaceInvadersGame` imports from `Player`, `Enemies`, `Projectiles`, `VFX`, `Audio`, `UI`, and `Utils`.
- All VFX modules import from `shared/utils/input.js` (for input events) and `shared/vfx/particleManager.js` (for particle spawning).
- UI modules use HTML/CSS overlays with data attributes for game state binding.
- Audio uses Web Audio API directly in `AudioSynthesizer`, with no external dependencies.

---

This plan covers all required aspects: mathematical modeling of classic mechanics, 20 specific AAA upgrades with Three.js implementations, the post-processing stack configuration, VFX priority logic, and complete file architecture with import paths. Every module is defined and its responsibilities are clear.

Awaiting your command to proceed to STEP 3 (Full Implementation).