# Space Invaders - AAA Retro-Futurism Plan

## Core Gameplay Mechanics

### Player Ship
- Horizontal movement: WASD/Arrows or Gamepad left stick
- Movement speed: 8 units/sec (linear interpolation for smooth motion)
- Boundaries: X ∈ [-12, 12], Y = -9 (fixed at bottom of screen)
- Health: 3 lives (destroyed by enemy projectiles)

### Enemy Formation
- Grid layout: 10 columns × 5 rows = 50 enemies total
- Horizontal movement pattern:
  - Move right until edge reached → descend → move left
  - Repeat until all destroyed or player defeated
- Movement speed increases as enemies are destroyed (difficulty curve)
- Descend amount: 2 units per row when reaching screen edges

### Projectile System
- Player projectiles:
  - Speed: 15 units/sec upward
  - Max active: 3 at once
  - Fire rate: 0.3 second cooldown
  - Destroyed by enemy collision or leaving screen top
  
- Enemy projectiles:
  - Each enemy fires with probability proportional to remaining enemies (more fired as fewer remain)
  - Speed: 4 units/sec downward
  - Max active per row: 2 at once
  - Destroyed by player collision, player projectile collision, or reaching bottom

### Scoring System
- Enemy destroyed: +10 points × enemy tier (top rows worth more)
- Player hit: lose life, score penalty of -50
- Game win: all enemies destroyed → next level with faster enemies
- Game loss: all lives lost

## Modern Enhancements

### 1. Procedural Planet Background
- Generate procedural planet surface using Simplex noise for terrain displacement
- Atmospheric glow shader effect around planet edges
- Star field particle system (500 stars, twinkling animation)

### 2. Neon Emissive Materials
- Player ship: cyan emissive glow with bloom pass
- Enemy ships: red/orange gradient based on tier
- Projectiles: bright white with motion trails

### 3. Camera Shake System
- Trauma-based shake decaying over time
- Scale by impact velocity (enemy destruction = medium, player hit = high)
- Frequency modulation for different event types

### 4. Particle Burst Effects
- Enemy explosion: multi-layered sparks + shockwave ring
- Player hit: debris particles + smoke trail
- Projectile collision: brief spark burst

### 5. Hit-Stop Frame Freeze
- Brief timescale dilation (0.1s) on heavy impacts
- Scale by enemy tier destroyed (higher = longer freeze)

### 6. Motion Trails for Projectiles
- Trail length proportional to projectile speed
- Fade-out gradient with time-based decay

### 7. Shockwave Rings
- Expanding emissive rings at impact points
- Ring size scales with explosion magnitude

### 8. Floating Score Text
- Dynamic HTML score display at destruction point
- Fades out and rises upward over 2 seconds

## Graphics Pipeline Configuration

### EffectComposer Stack
```javascript
const composer = new EffectComposer();
composer.setSize(window.innerWidth, window.innerHeight);

// Bloom pass for neon emitters
const bloomPass = new UnrealBloomPass(1.5, 0.4, 0.8); // intensity, threshold, radius
bloomPass.resolution = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
composer.addPass(bloomPass);

// Outline pass for enemy silhouettes
const outlinePass = new OutlinePass();
outlinePass.outlineColor = new THREE.Color(0xff4444); // Red outline
outlinePass.outlineThickness = 1.5;
composer.addPass(outlinePass);

// Vignette effect for cinematic feel
const vignettePass = new ShaderPass(new VignetteShader());
vignettePass.uniforms.vintage.value = true;
vignettePass.uniforms.darkness.value = 0.3;
composer.addPass(vignettePass);
```

### Procedural Generation Math

#### Planet Surface Displacement
```javascript
function getTerrainHeight(x, z) {
    return noise2D(x * 0.5, z * 0.5) * 0.3 + 
           noise2D(x * 1.2, z * 1.2) * 0.1;
}

// Simplex noise implementation for procedural textures
class NoiseGenerator {
    constructor(seed = Math.random()) {
        this.seed = seed;
        // Initialize permutation tables
    }
    
    noise2D(x, y) {
        return this.simplexNoise2(x, y);
    }
}
```

#### Star Field Animation
```javascript
function updateStars(time) {
    stars.forEach((star, i) => {
        star.twinkle = Math.sin(time * 0.5 + i * 3.14) * 0.5 + 0.5;
        star.opacity = star.twinkle > 0.7 ? 1 : 0; // Blink effect
    });
}
```

## VFX Implementation Priority Logic

### Camera Shake System (Priority 1)
- Triggered by: enemy destruction, player hit, explosions
- Intensity scale:
  - Enemy destroyed: 0.3 × tier value
  - Player hit: 0.8
  - Explosion near camera: 0.5 + distance factor
  
```javascript
class CameraShakeSystem {
    constructor(camera) {
        this.camera = camera;
        this.intensity = 0;
        this.decayRate = 0.9; // Exponential decay
        
        // Store original position
        this.originalPosition = new THREE.Vector3();
    }
    
    applyShake(intensity, duration) {
        this.intensity += intensity * duration;
        this.duration = Math.max(this.duration, duration);
        
        // Apply random offset to camera position
        const shakeAmount = this.intensity * Math.random() * 0.1;
        this.camera.position.x += shakeAmount - 0.05;
        this.camera.position.y += shakeAmount - 0.05;
    }
    
    update(deltaTime) {
        if (this.duration > 0) {
            this.intensity *= Math.pow(this.decayRate, deltaTime);
            this.duration -= deltaTime;
            
            // Gradually return to original position
            this.camera.position.lerp(
                this.originalPosition, 
                1 - this.intensity * 0.5
            );
        } else {
            this.intensity = 0;
            this.camera.position.copy(this.originalPosition);
        }
    }
}
```

### Hit-Stop Frame Freeze (Priority 2)
- Triggered by: enemy destruction, player hit
- Duration scale:
  - Enemy destroyed: 0.1s × tier value
  - Player hit: 0.3s
  
```javascript
class TimeManager {
    constructor() {
        this.timeScale = 1;
        this.freezeDuration = 0;
        this.originalTimeScale = 1;
    }
    
    applyHitStop(duration) {
        this.timeScale *= 0.5; // Slow down by half
        this.freezeDuration += duration * 0.1; // Convert to seconds
        
        // Clamp minimum time scale
        this.timeScale = Math.max(this.timeScale, 0.2);
        
        // Gradually restore normal speed
        setTimeout(() => {
            this.timeScale = this.originalTimeScale;
        }, this.freezeDuration * 1000);
    }
}
```

### Particle System (Priority 3)
- Max 500 particles at once
- Priority order: player explosions > enemy explosions > projectile sparks
  
```javascript
class ParticleManager {
    constructor(maxParticles = 500) {
        this.maxParticles = maxParticles;
        this.activeParticles = [];
        
        // Initialize particle pool
        for (let i = 0; i < maxParticles; i++) {
            this.createParticlePool();
        }
    }
    
    createExplosion(position, intensity) {
        const particleCount = Math.min(intensity * 20, 100);
        
        for (let i = 0; i < particleCount && this.activeParticles.length < this.maxParticles; i++) {
            // Get available particle from pool
            const particle = this.getAvailableParticle();
            
            if (!particle) break;
            
            // Initialize explosion particle
            particle.position.copy(position);
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * intensity * 2,
                Math.random() * intensity * 2,
                (Math.random() - 0.5) * intensity * 2
            );
            
            // Set lifetime based on explosion size
            particle.lifetime = 1 + intensity * 0.5;
            
            this.activeParticles.push(particle);
        }
    }
}
```

## File Architecture & Import Paths

### Shared Utilities Structure
```
src/
├── shared/
│   ├── input/
│   │   ├── InputManager.js          # Main entry point for input system
│   │   ├── KeyboardController.js   # WASD/Arrow key handling
│   │   └── GamepadController.js    # Gamepad API integration
│   │
│   ├── audio/
│   │   ├── AudioManager.js          # Web Audio API context manager
│   │   ├── SoundSynth.js            # Procedural sound effects
│   │   └── MusicSynth.js            # Procedural music generation
│   │
│   ├── particles/
│   │   ├── ParticleManager.js      # Centralized particle pool
│   │   ├── ExplosionBurst.js       # Multi-layered explosion effects
│   │   ├── SparkBurst.js           # High-speed spark particles
│   │   └── ShockwaveRing.js        # Expanding emissive ring system
│   │
│   ├── camera/
│   │   └── CameraShakeSystem.js    # Trauma-based shake with decay curves
│   │
│   ├── procedural/
│   │   ├── NoiseTextures.js        # Simplex noise textures for materials
│   │   └── NeonGlowTextures.js    # Canvas-based neon glow patterns
│   │
│   └── utils/
│       └── PhysicsUtils.js          # Collision detection math, trajectory calculations
│
├── Space_Invaders/
│   ├── index.js                     # Entry point for Space Invaders game
│   ├── Scene.js                     # Scene setup and initialization
│   ├── Game.js                      # Core game logic implementation
│   │
│   ├── entities/
│   │   ├── PlayerShip.js            # Player ship entity with movement controls
│   │   ├── Enemy.js                 # Enemy ship entity with AI behavior
│   │   └ Projectile.js             # Projectile entity for both player and enemies
│   │
│   ├── levels/
│   │   └ EnemyFormationGenerator.js # Procedural enemy formation generation
│   │
│   └ ui/
│       └ ScoreDisplay.js            # Dynamic score display with floating text
```

### Import Path Relationships

#### PlayerShip.js imports:
```javascript
import { InputManager } from '../../shared/input/InputManager';
import { PhysicsUtils } from '../../shared/utils/PhysicsUtils';
```

#### Enemy.js imports:
```javascript
import { PhysicsUtils } from '../../shared/utils/PhysicsUtils';
```

#### Projectile.js imports:
```javascript
import { PhysicsUtils } from '../../shared/utils/PhysicsUtils';
```

#### Game.js imports:
```javascript
import { PlayerShip } from './entities/PlayerShip';
import { Enemy } from './entities/Enemy';
import { Projectile } from './entities/Projectile';
import { InputManager } from '../../shared/input/InputManager';
import { AudioManager } from '../../shared/audio/AudioManager';
import { ParticleManager } from '../../shared/particles/ParticleManager';
```

#### Scene.js imports:
```javascript
import * as THREE from 'three';
import { EffectComposer, UnrealBloomPass, OutlinePass, VignetteShader, ShaderPass } from 'three/examples/postprocessing/EffectComposer.js';
```

## Edge Cases & Error Handling

### Collision Detection Failures
- Implement fallback collision detection using axis-aligned bounding boxes
- Log errors and continue game without specific collision effects

### Memory Management
- Explicitly dispose of all geometries, materials, textures when no longer needed
- Use object pooling for projectiles and particles to prevent garbage collection overhead

### Performance Degradation
- Monitor frame rate and reduce particle count if below 30fps threshold
- Implement level scaling based on performance metrics

## Testing Requirements

### Unit Tests Coverage:
1. Player movement boundaries
2. Projectile collision detection accuracy
3. Enemy formation generation consistency
4. Score calculation correctness
5. Memory leak prevention verification

### Integration Tests:
1. Full game loop execution from start to win/loss state
2. Input system responsiveness across all control schemes
3. Particle system performance under load
4. Audio synthesis quality and timing accuracy

