# Space Invaders — AAA Retro-Futurism Architectural Plan

## 1. Core Gameplay Mechanics

### Mathematical Models

**Player Movement:**
- X-axis constrained to viewport bounds: `player.x ∈ [-screenWidth/2 + margin, screenWidth/2 - margin]`
- Smooth interpolation via lerp: `player.x += (targetX - player.x) * deltaTime * 8.0`
- Acceleration curve for responsive feel without overshoot

**Enemy Grid Logic:**
- Grid dimensions: 5 rows × 11 columns = 55 enemies per wave
- Movement pattern: horizontal sweep → edge detection → descend + reverse direction
- Speed acceleration formula: `baseSpeed * (1 + (totalEnemies - remainingEnemies) / totalEnemies)`
- Edge threshold: when any enemy crosses ±(gridWidth/2 + margin), trigger descent

**Collision Detection:**
- AABB (Axis-Aligned Bounding Box) for all entities
- Player bullet vs enemy: `bullet.minX < enemy.maxX && bullet.maxX > enemy.minX && ...`
- Enemy bullet vs player: same AABB logic with priority resolution
- Projectile lifetime: 3.0 seconds before auto-pool return

**Scoring System:**
- Standard invader types (5 tiers): 10, 20, 30, 40, 50 points
- Bonus UFO: random spawn every 60-90 seconds, worth 100-500 points
- Wave completion bonus: `remainingEnemies * 10`

### Win/Loss Conditions
- **Win:** Clear all enemy waves (progressive difficulty increase)
- **Loss:** Player health reaches zero OR enemies reach bottom boundary

---

## 2. Modern AAA Enhancements (15-20 Specific Three.js Implementations)

1. **3D Perspective Camera** — Dolly zoom effect during intense moments, slight tilt for cinematic feel
2. **Procedural Alien Geometry** — Each alien type uses unique displaced geometry (sine-wave vertex displacement via custom shader)
3. **Dynamic Lighting System** — Point lights attached to player and UFO, casting real-time shadows
4. **Procedural Starfield Background** — 1000+ particles with parallax layers based on camera movement
5. **Neon Grid Floor** — InstancedMesh grid lines with bloom glow, receding into distance for depth
6. **Player Shield System** — Hexagonal energy shield using transparent MeshStandardMaterial with fresnel-like opacity
7. **Enemy Death Animation** — Multi-stage explosion: geometry split → particle burst → shockwave ring
8. **Motion Blur on Player** — Trail effect using accumulated position history rendered as fading quads
9. **Dynamic Fog** — Exponential fog that increases density per wave for atmosphere
10. **Procedural Sound Synthesis** — Web Audio API oscillators for shooting, explosions, alien march
11. **Screen Shake on Impact** — Camera shake intensity scales with projectile velocity at collision
12. **Hit-Stop Frame Freeze** — 80ms timescale reduction on player death, 40ms on enemy destruction
13. **Floating Damage Numbers** — HTML overlay positioned via Three.js project() for screen-space alignment
14. **Wave Transition Cinematic** — Camera pull-back + text fade-in sequence between waves
15. **Procedural UI Glassmorphism** — CSS backdrop-filter blur with neon border glow animations
16. **Particle System Optimization** — InstancedMesh particle rendering with GPU-driven animation via uniforms
17. **Enemy Formation Morphing** — Subtle wave distortion in enemy grid positions using sine displacement
18. **UFO Sound Design** — Unique oscillator frequency sweep for each pass

---

## 3. Graphics Pipeline

### Post-Processing Stack Configuration

```typescript
// EffectComposer chain:
Scene → RenderPass → UnrealBloomPass → FinalPass

// Bloom parameters (tuned for retro-futurism):
- strength: 1.2 (glow without washout)
- radius: 0.4 (tight glow control)
- threshold: 0.85 (only bright emissive surfaces trigger bloom)

// Emissive material strategy:
- Player ship: emissiveIntensity = 1.5, color = #00ffff
- Enemies: emissiveIntensity = 0.8, color varies by tier
- Projectiles: emissiveIntensity = 2.0, color = neon green/yellow
- Grid floor: emissiveIntensity = 0.6, color = purple/magenta
```

### Procedural Generation Math

**Starfield:**
- Position distribution: Poisson-disc sampling for even spacing
- Parallax layers: 3 depth levels (near, mid, far) with different scroll speeds
- Color variation: HSL hue rotation based on depth layer

**Alien Geometry Displacement:**
```glsl
// Vertex shader displacement
float displacement = sin(position.x * 10.0 + time) * 0.02;
displacement += cos(position.y * 8.0 + time * 0.5) * 0.015;
position.z += displacement;
```

**Grid Floor:**
- InstancedMesh with 40×60 instances
- Spacing: 0.5 units, extending to ±20 units on X, -30 to +10 on Z
- Emissive pulse via uniform time variable

---

## 4. VFX Implementation Priority Logic

### Camera Shake System
```typescript
class CameraShake {
    private intensity: number = 0;
    private decayRate: number = 2.5;
    
    // Trigger on collision impact velocity
    trigger(impactVelocity: Vector3): void {
        this.intensity = Math.min(impactVelocity.length() * 0.1, 2.0);
    }
    
    // Apply each frame with exponential decay
    update(deltaTime: number): void {
        this.intensity *= Math.exp(-this.decayRate * deltaTime);
        if (this.intensity < 0.01) this.intensity = 0;
        
        camera.position.x += random() * this.intensity - this.intensity/2;
        camera.position.y += random() * this.intensity - this.intensity/2;
    }
}
```

### Hit-Stop System
```typescript
class HitStop {
    private remainingFrames: number = 0;
    
    trigger(durationMs: number): void {
        this.remainingFrames = Math.floor(durationMs / (1000/60));
    }
    
    update(deltaTime: number): boolean {
        if (this.remainingFrames > 0) {
            this.remainingFrames--;
            return true; // Freeze frame
        }
        return false; // Normal time flow
    }
}
```

### Particle System (Hard Cap 500)
```typescript
class ParticleManager {
    private particles: Particle[] = [];
    private MAX_PARTICLES = 500;
    
    spawnBurst(position: Vector3, count: number, velocityRange: number): void {
        let spawned = 0;
        for (let i = 0; i < this.particles.length && spawned < count; i++) {
            if (!this.particles[i].active) {
                this.particles[i].activate(position, randomVelocity(velocityRange));
                spawned++;
            }
        }
        // If not enough inactive particles, skip excess (graceful degradation)
    }
}
```

### Shockwave Ring System
- Geometry: TorusGeometry with radius growing from 0.1 to 3.0 over 1.5 seconds
- Material: Transparent MeshStandardMaterial with emissive purple glow
- Render order: After main scene pass for proper blending

---

## 5. File Architecture & Import Paths

### Entry Point
```
src/main.ts → imports @shared/render/PostProcessor, @games/Space_Invaders/Game
```

### Shared Utilities (Import Aliases)
```typescript
// All shared modules use @shared prefix in vite.config.ts alias resolution
import { ProjectilePool } from '@shared/pool/ProjectilePool';
import { ParticleManager } from '@shared/vfx/ParticleManager';
import { CameraShake } from '@shared/vfx/CameraShake';
import { HitStop } from '@shared/vfx/HitStop';
import { InputController } from '@shared/input/InputController';
import { SynthAudio } from '@shared/audio/SynthAudio';
import { PostProcessor } from '@shared/render/PostProcessor';
import { MemoryManager } from '@shared/render/MemoryManager';
```

### Game Module Structure
```
games/Space_Invaders/
├── Game.ts              ← Main game loop, state machine, scene management
├── Player.ts            ← Player entity: movement, shooting, health
├── Enemy.ts             ← Enemy base class with tier-specific behavior
├── EnemyGrid.ts         ← Grid formation logic, movement patterns
├── Projectile.ts        ← Bullet classes (player/enemy/UFO)
├── UFO.ts               ← Bonus UFO entity
├── VFX.ts               ← Game-specific VFX orchestration
└── ui/
    └── HUD.ts           ← Glassmorphism overlay rendering
```

### Cross-Module Dependencies
```
Game.ts → imports: Player, EnemyGrid, ProjectilePool, ParticleManager, CameraShake, HitStop, PostProcessor, InputController, SynthAudio, MemoryManager
Player.ts → imports: Projectile (creates player bullets)
Enemy.ts → imports: Projectile (creates enemy bullets on random shoot)
EnemyGrid.ts → imports: Enemy (instantiates grid), ProjectilePool
UFO.ts → imports: Projectile (special projectile type)
VFX.ts → imports: ParticleManager, CameraShake, HitStop, ShockwaveRing, FloatingScoreText
HUD.ts → imports: Game state data for rendering
```

### Memory Management Tracking
```typescript
// MemoryManager.ts maintains tracking arrays
class MemoryManager {
    private trackedGeometries: Geometry[] = [];
    private trackedMaterials: Material[] = [];
    private trackedTextures: Texture[] = [];
    
    track(geometry: Geometry): void { this.trackedGeometries.push(geometry); }
    disposeAll(): void { /* dispose everything */ }
}
```

---

## Verification Checklist Before Completion

- [ ] Game launches and renders without errors
- [ ] Player movement responds to keyboard AND gamepad input
- [ ] Shooting mechanics work for player (up arrow/space or trigger)
- [ ] Enemy grid moves, descends, and accelerates correctly
- [ ] Collision detection fires for all projectile types
- [ ] Particle system respects 500 hard cap
- [ ] Bloom post-processing creates neon glow without washout
- [ ] Camera shake triggers on significant impacts
- [ ] Hit-stop freezes frames on player death
- [ ] All geometries/materials disposed on game end
- [ ] No console errors or memory leak warnings
- [ ] Win/loss states trigger appropriate sequences
