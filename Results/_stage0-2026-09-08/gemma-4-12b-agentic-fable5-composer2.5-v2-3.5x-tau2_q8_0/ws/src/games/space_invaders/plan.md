# Space Invaders - AAA Retro-Futurism Plan

## Core Gameplay Model
Invader grid of 10x22 units, each invader moving horizontally and dropping down on edge hit; speed increases as fewer invaders remain (inverse square relationship to count). Player fires single laser at a time with cooldown. Scoring: 10 per invader destroyed by laser, 30 for destruction by enemy laser; bonus points for clearing entire rows/columns. Win when all Invaders are gone; loss on player hit or invasion reaching the bottom row.

## Modern Enhancements (20)
- UnrealBloomPass glow on invaders and lasers — neon aesthetic without washing out to white
- Camera shake per impact with decaying intensity, scaling by velocity
- Hit-stop / frame-freeze (~50ms timescale dilation) on heavy destruction events
- Procedural particle bursts for explosions (sparks flying in direction of force)
- Expanding emissive shockwave rings at each invader death
- Motion trails for fast projectiles — short decaying geometry segments
- Floating 3D score text with neon outline, updating dynamically
- Glassmorphism HUD overlay: semi-transparent panels with blur and glowing borders
- PBR materials on all surfaces (`MeshStandardMaterial`)
- Invaders as InstancedMesh (10x22 = 220 instances) for single draw call
- Procedural textures generated at runtime via Canvas API — no external images
- Web Audio synthesizer for laser fire, explosion SFX and background music
- Unified Keyboard + Gamepad input handling with deadzone clamping
- Invader death animation: brief flash before removal
- Laser beam particle trail on rapid fire
- Destruction VFX that scales with invader row (higher rows = bigger shockwaves)
- Screen shake intensity ramps up as fewer invaders remain — builds tension
- HUD animations for score changes and game state transitions
- Dynamic lighting from laser impacts illuminating the environment

## Graphics Pipeline & Procedural Assets
PBR materials + EffectComposer stack: RenderPass -> UnrealBloomPass (threshold 0.8, strength 1.5, radius 4) -> NFillPass. Invaders have emissive neon colors; lasers are pure white with high intensity for bloom. Textures generated on a hidden canvas at startup and uploaded as `WebGLTexture`.

## VFX Implementation Priority
1. Camera shake & hit-stop — fundamental impact feel
2. Particle bursts & shockwaves — visual feedback per destruction event
3. Motion trails & floating score text — polish layer

## File Architecture (ES Modules)
@shared/renderer.js - Scene, camera, lighting, EffectComposer+UnrealBloomPass
@shared/input.js - Unified Keyboard + Gamepad API state manager
@shared/vfx.js - Camera shake, hit-stop, shockwaves, particles (500 cap)
@shared/assets.js - Procedural texture generation via Canvas API, noise geometry math
@shared/audio.js - Web Audio synthesizer for SFX and music
@shared/pool.js - Generic object pooling utility

games/space_invaders/main.js - Game loop, state machine, invader logic
games/space_invaders/player.js - Player ship model, fire cooldown, input mapping
games/space_invaders/enemy.js - Invader grid movement, death animation, destruction VFX
games/space_invaders/laser.js - Laser projectile class with motion trail and particle burst on hit
games/space_invaders/hud.js - Glassmorphism UI overlay, score text, game state display
