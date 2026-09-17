# Space Invaders / Neon Siege

A complete three-wave arcade defense game built with vanilla JavaScript, Three.js, and Vite. Move the interceptor, cut firing channels through destructible bunkers, and stop the accelerating formation before it crosses the defense line. Bonus saucers award extra points; 1,500 points earns one extra hull. Clear all three waves to win.

## Run locally

Use Node.js 22.12 or newer with npm. Dependencies are pinned in the lockfile.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For the production build:

```sh
npm test
npm run build
npm run preview
```

The game uses WebGL 2 and works entirely in the browser. After the JavaScript loads, it requests no external images, models, fonts, music, or other assets. Geometry, surface textures, environment lighting, sound effects, and music are generated in code. No server or account is required.

## Controls

| Action | Keyboard | Standard controller |
|---|---|---|
| Move | A / D or Left / Right | Left stick or D-pad |
| Fire | Space, W, or Up | A or right trigger |
| Confirm | Enter or Space | A |
| Pause / resume | Escape or P | Start |
| Back | Escape | B |
| Navigate menus | Tab or Up / Down | Left stick or D-pad |

Optional touch buttons are available in **Settings & controls**. Release Fire after starting or resuming to arm the cannon. The game pauses on focus loss or when the active controller disconnects. Resume explicitly when ready.

Audio starts after a user interaction. The top music button mutes or unmutes both music and effects; their separate volumes are in Settings. Best score and preferences are stored locally, with safe defaults when browser storage is unavailable.

## Graphics and accessibility

Settings include High, Balanced, and Low graphics, camera shake, reduced effects, and touch controls. The initial effects preference respects `prefers-reduced-motion`. All quality levels retain the same gameplay, bloom, and six effect systems. Sustained slow rendering can lower graphics one level automatically. Low is useful for integrated graphics or very large windows.

Menus use native buttons and inputs with visible keyboard focus. The canvas resizes without cropping the battlefield, and touch controls occupy their own area below it. The title, pause, settings, victory, defeat, and error screens provide a complete loop with immediate replay.

## Implementation

`src/Space_Invaders/` contains the sole game, including a renderer-independent fixed-step simulation and its tests. `src/shared/` contains reusable input, pooling, collision, rendering, VFX, audio, and overlay components. See [the architecture and implementation plan](src/Space_Invaders/plan.md) and [the validation record](src/Space_Invaders/validation.md).

- 120 Hz simulation, interpolated rendering, swept relative AABB collisions, chronological contact resolution, and seeded gameplay randomness.
- Fixed pools for entities, projectiles, sound voices, score labels, and all transient visuals. Sparks, debris, trails, and rings share a hard 500-primitive ceiling.
- Instanced and merged procedural geometry; scene materials are exclusively `MeshStandardMaterial`.
- `EffectComposer` → `RenderPass` → `UnrealBloomPass` → `OutputPass`, with explicit ownership and disposal of geometry, materials, textures, and render targets.
- Context-loss recovery, pause-safe input, one animation loop, and clean Vite hot-reload teardown.

Append `?debug&seed=42` to the URL for a reproducible gameplay seed and the read-only `window.__SPACE_INVADERS__.snapshot()` diagnostics. Without `debug`, that API is absent. Diagnostics expose copies for inspection, with no game-state mutation or phase-skipping commands.

## Troubleshooting

- **Blank or error screen:** enable WebGL / browser hardware acceleration, use a current browser, and press Retry. WebGL 2 is required.
- **Slow frame rate:** select Low graphics or reduce the browser window size. Performance depends on the GPU and browser.
- **Silent audio:** click the audio button and check the two volume sliders and browser/site sound permissions.
- **Controller inactive:** press a controller button while this page is focused. A standard Gamepad API mapping is required; physical controller coverage is documented in the validation record.
- **Controls appear paused after switching windows:** click Resume defense. This prevents unattended damage while the page is unfocused.

Verification screenshots, measurement scripts, and local logs live in the ignored `artifacts/` directory and are not runtime assets.
