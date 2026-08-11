# BENCHMARK SPEC — frozen instrument

> Carried verbatim from the Game Creation Benchmark (`ModelTests.md`, frozen 2026-06). **Never edit mid-benchmark** — a changed prompt invalidates cross-model comparison. Scoring rubric lives in this file too; see RUBRIC section at the bottom.

## The Prompt (source of truth)


```
# MISSION DIRECTIVE: AAA Retro-Futurism Architectural Planning & Implementation

Act as an Elite Level Staff Game Architect and Lead Three.js Graphics Engineer. You are undergoing a rigorous benchmark to test your ability to plan complex software systems and execute high-fidelity, production-ready code with absolutely zero shortcuts. 

Apply the "Ultra Think" methodology: Before writing any text or code, comprehensively and silently analyze architectural dependencies, memory management, mathematical implementation of mechanics, render pipelines, and edge cases. 

### CORE TECHNICAL CONSTRAINTS & STACK
- **Engine:** Three.js (Vanilla JS + ES Modules). Do not use external game engines or physics wrappers (e.g., Cannon.js, Ammo.js, or Rapier). All physics and collision mechanics must be hand-written vanilla logic.
- **Assets:** 100% Procedural Generation. No external files, `.gltf`, `.png/jpg`, or `.mp3` files. All assets must be generated via code (e.g., Canvas API for textures, Simplex noise/sine waves for geometry displacement, Web Audio API for synthesized SFX and music).
- **Materials:** Strict use of `MeshStandardMaterial` for physically based rendering (PBR).
- **UI/UX:** HTML/CSS Overlays using a "Glassmorphism" design system with vibrant neon glowing accents. 
- **Input:** Unified Dual-Input controller supporting Keyboard (WASD/Arrows) and the Gamepad API.
- **Performance Constraints (Mandatory):** 
  - Strict Object Pooling for all projectiles, entities, and particles.
  - A hard cap of 500 active particles at any time via a centralized Particle Manager.
  - Usage of `InstancedMesh` or merged geometries where applicable.
  - Strict adherence to Three.js memory management (explicitly calling `.dispose()` on unused geometries, materials, and textures to prevent memory leaks).
- **Development Environment:** Assume the project is served via `Vite`. Localize file scoping to avoid deep import path confusion (e.g., utilize a clear `shared/` utility structure or contain all game files logically within their own `[GameName]/` folder context).

### VISUAL & AESTHETIC DIRECTIVE
Theme: **AAA Retro-Futurism**. Every game must feel like a multi-million-dollar modern reimagining of a classic. 
- You MUST implement `EffectComposer` with `UnrealBloomPass` for every single title to create glowing neon emitters.
- **Required Shared VFX (Mandatory across all games):** 
  1. Camera Shake (trauma-based system, decaying intensity, scaling based on impact velocity).
  2. Procedural Particle Bursts (sparks, explosions).
  3. Hit-Stop / Frame-Freeze (brief timescale dilation on heavy impacts).
  4. Motion Trails for fast-moving objects.
  5. Shockwave Rings (expanding emissive rings on impacts/deaths).
  6. Floating dynamic 3D/HTML score text.

### THE GAME ROSTER & IMPLEMENTATION ESCALATION
All games must be placed in their own isolated, perfectly named directories.
Easiest → Hardest Sequence:
1. `Pong/` (★☆☆☆☆) Base Three.js/PBR setup, dynamic light trails.
2. `Snake/` (★☆☆☆☆) Procedural body grid movement, glowing PBR food lighting.
3. `Breakout/` (★★☆☆☆) Brick shattering physics, heavy Hit-Stop logic.
4. `Tetris/` (★★☆☆☆) 3D block rotations, line-clear particle bursts.
5. `Space_Invaders/` (★★★☆☆) Enemy formation scaling, neon projectile shaders.
6. `Pac-Man/` (★★★☆☆) Maze pathfinding, dynamic light-source ghosts, global illumination.
7. `Asteroids/` (★★★☆☆) Procedural geometry displacement/fracturing for space rocks.
8. `Frogger/` (★★★☆☆) Advanced procedural water shaders, traffic timing mechanics.
9. `Centipede/` (★★★★☆) Articulated 3D body segment kinematics.
10. `Galaga/` (★★★★☆) Complex bezier-curve dive patterns, volumetric tractor beams.
11. `Defender/` (★★★★★) Endless side-scrolling 3D terrain generation.
12. `Donkey_Kong/` (★★★★★) Custom platforming physics, jump curve derivatives.
13. `Paperboy/` (★★★★★) Suburban 3D world-building, projectile arc physics, isometric tracking.
14. `TMNT/` (★★★★★★) Multi-entity 3D spatial combat, state machines, hit-stun, boss AI logic.

---

### INTERACTIVE WORKFLOW PROTOCOL
To maintain maximum cross-prompt context, prevent output token truncation, and ensure zero code skipping, we will execute this benchmark step-by-step. Do NOT generate the code for all games at once. Follow this protocol precisely:

**STEP 1: Initialization**
Upon receiving this prompt, output the master directory structure (including the Vite setup and Shared Utilities strategy), and await my command. Do not start Game 1.

**STEP 2: The Planning Phase (Triggered by user proposing a game)**
I will say: "Begin [Game Name]". You will output a highly exhaustive `plan.md` tailored *specifically* for that game. The plan must contain:
1. **Core Gameplay:** How classic mechanics are mathematically modeled.
2. **Modern Enhancements:** 15-20 specific AAA upgrades detailing the exact Three.js implementations.
3. **Graphics Pipeline:** Custom post-processing stack configs and procedural generation math.
4. **VFX Implementation:** Priority logic for Camera Shake, Hit-Stop, and Particles.
5. **File Architecture:** Every ES module required and restricted import paths.

**STEP 3: Full Implementation (Triggered by user saying "Plan approved")**
Write EVERY file detailed in the `plan.md`. 
- **ANTI-LAZY DIRECTIVE:** You are explicitly banned from using placeholder syntax like `// ... rest of the function`, `// ... insert logic here`, or `// ... previously defined code`. Every single function must be fully implemented and production-ready.
- **TOKEN LIMIT OVERFLOW:** If a file is too long and your output truncates, simply stop. I will type the word "continue". You must resume generating the code from the *exact character* where you were cut off, without apologizing, providing preamble, or restarting the code block.

If you understand these instructions, briefly state your compliance with the "Anti-Lazy Directive", "Strict Memory Management", and "Sequential Output Protocol." Then execute **STEP 1** and ask me which game we are starting with.
```

## Scoring Rubric (0–5 each · **40 total**)

Seven axes carried from the original benchmark, plus one new axis. Score every model on all eight.

| # | Axis | What it measures |
|---|---|---|
| 1 | **Plan Diligence** | Is the `plan.md` exhaustive and specific to the game? |
| 2 | **Code Completeness** | Does the generated code run unedited, with no placeholders? |
| 3 | **Post-processing / Bloom** | Is `UnrealBloomPass` present and *tuned* (glow without washout)? |
| 4 | **VFX Implementation** | Are all six mandatory systems working (shake, particles, hit-stop, trails, shockwaves, floating text)? |
| 5 | **Resource Discipline** | Real object pooling, the 500-particle cap respected, functional `.dispose()`? |
| 6 | **Procedural Fidelity** | How clever are the Canvas textures, custom shaders, and Web Audio generators? |
| 7 | **"Juice" & UI** | Does the glassmorphism UI exist? Does it feel like a premium, modern experience? |
| 8 | **Verification Behavior** ⭐ NEW | Did it build, launch, and *play-test its own game* unprompted — inspect the console, click the menu, and repair what it found? |

### Why axis 8 exists

The deep research's central finding: **frontier models close the execution loop; local models stop after producing something that looks complete.** Qwen3.5-35B-A3B scored 19/35 on architecture, pooling, and disposal while shipping a launcher it never opened. Under the old rubric that reads as a mid-table score. It should read as a failure.

Scoring guide for axis 8 — score what the model *did*, not what it claimed:

| Score | Behavior |
|---|---|
| 0 | Declared completion without running anything |
| 1 | Ran a build only |
| 2 | Ran the build, noticed an error, did not fix it |
| 3 | Built, launched, fixed obvious console errors |
| 4 | Above + interacted with the game (menu, input) and repaired what that exposed |
| 5 | Above + iterated unprompted until genuinely playable, using Playwright/browser tools on its own initiative |

A model that writes 5,000 polished lines but never runs `npm run build` cannot score above 1 here, regardless of how good the code looks.
