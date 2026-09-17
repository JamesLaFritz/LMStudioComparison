# Neon Siege — validation record

Tested on 2026-09-16. This record distinguishes executed checks from untested hardware. The runtime contains one game, under `src/Space_Invaders/`.

## Environment and reproduction

- Windows 10/11, Chrome 153.0.0.0, WebGL 2.
- GPU reported by WebGL: `ANGLE (Intel, Intel(R) Graphics (0x00007D67) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
- Node.js 22.19.0; npm 10.9.3; Three.js 0.186.0; Vite 8.3.0.
- Development: `npm run dev`, observed at `http://127.0.0.1:5173/`.
- Production: `npm run build`, then `npm run preview -- --port 4173`, observed at `http://127.0.0.1:4173/`.
- Reproduction seed: add `?debug&seed=42` or `?debug&seed=123`. The optional debug API returns copies of state and rendering diagnostics; it has no setters or simulation shortcuts.

Browser interaction used Playwright, native keyboard/pointer input, and browser-injected keyboard events. The full-run driver reads diagnostics and presses A, D, and Space through the normal `InputController`. It does not remove enemies, set scores, grant lives, change time, or force phases. The driver and screenshots are verification artifacts, outside the runtime import graph.

## Executed automated checks

`npm test` passes **17 tests**, with no failures or skipped tests. They cover:

- Swept relative AABB tunneling, tangency, overlap, zero-axis motion, and miss cases.
- Pool exhaustion, 1,000 reuse cycles, identity stability, stale generations, and double-release rejection.
- Event capacity and identity-based, idempotent resource disposal, including early removal.
- Seed determinism and hit-stop priority, maximum duration, and recovery.
- Mixed spark/trail/ring pressure beyond capacity: total stops at **500**, trails at 128, rings at 12; ring render slots stay paired with central tokens. Expiration returns all slots. Reused projectile generations cannot connect unrelated trails.
- Bunker occupancy (304 initially live cells), crater damage, and swept grid lookup.
- Formation bounds, edge descent, surviving-column bounds, and empty formations.
- Chronological collisions, fast bullets, erosion opening a path, duplicate-score prevention, terminal ties, and earlier final kills canceling later fire.
- Lives, protection, reconstruction, invasion loss, fire cooldowns/caps, shooter selection, wave progression, replay, the single extra-life award, and the final survival bonus.
- Identical simulation results under 30/60/144 Hz presentation schedules.
- Short key taps, opposing directions, standard-gamepad dead zones, release gates, disconnects, virtual pointers, unknown mappings, and held pause buttons across input clearing.

A separate input-driven pure simulation completed all three waves for seeds 42, 123, and 777. These simulation outcomes support the logic checks; the browser outcomes below establish actual playability.

`npm run build` resolves all imports and produces the production bundle. A separate temporary directory received only the manifests, Vite/HTML setup, and source tree: **fresh `npm ci`, all 17 tests, and a production build passed**. Installation reported zero known dependency vulnerabilities at that time.

Vite reports its advisory for a minified JavaScript chunk over 500 kB. The self-contained bundle is approximately 667 kB, 174 kB gzip; it includes Three.js and the required composer/bloom implementation. This warning does not prevent the build. CSS is approximately 11.6 kB, 3.5 kB gzip.

## Browser outcomes and controls

The development build completed a full seed-42 campaign at 1280×800 on Low graphics:

| Result | Observed value |
|---|---:|
| Outcome | Victory |
| Waves cleared | 3 / 3 |
| Invaders killed | 165 |
| Final score | 3,770 |
| Surviving hulls | 4 |
| Shots fired | 779 |
| Simulation duration | 189.10 seconds |
| Wall duration | 193.76 seconds |
| Mean sampled frame interval | 16.05 ms |

The **production build** also completed a full seed-123 campaign at 1280×800 on **Balanced** graphics: victory, 3/3 waves, 165 invaders, four bonus saucers, four surviving hulls, **4,420 points**, and 772 shots. Duration was 187.76 simulation seconds / 192.35 wall seconds; the mean sampled frame interval was **16.68 ms**. It peaked at 56 composed-frame draw calls, 71,016 triangles, and 127 sampled transient primitives. `production-victory.json` and `production-victory.png` capture that result. Production replay, arrow movement, pause, mute/unmute, saved best score, and return to title were also exercised.

A normal-input defeat check deliberately moved into descending shots. It reached Game Over after 13.44 simulation seconds, with zero hulls. Recorded transitions were Playing → Reconstructing → Playing → Reconstructing → Playing → Game Over. Both reconstruction intervals lasted approximately 0.8 simulation seconds. On damage, projectile pools were cleared; the next ship had protection. Replay returned to a fresh countdown without page reload.

Additional executed interaction checks:

- A/D movement, arrows, bounded movement, held fire, and visible projectile impacts.
- Start/countdown, pause/resume by keyboard and buttons, settings, return to title, replay, saved score, and audio unlock.
- A held Escape originally retriggered after clearing input. Fixed with auto-repeat suppression; a held controller Start preserves its sampled edge. The browser retest remained paused while held and resumed on a fresh press.
- Injected standard Gamepad API records started the game, moved the ship to x≈4.90, fired three shots, operated pause/resume, and triggered pause on disconnect. Reconnection required explicit resume. Prompts switched to controller controls.
- Touch events held movement and fire simultaneously, producing movement and three shots. Independent pointer release, pointer cancellation, and mouse/pointer release outside the captured button cleared the corresponding actions.
- A pause comparison 500 ms apart had identical tick, shot, and particle counts. Focus loss also entered pause.

No physical gamepad or physical touch device was connected. The mapping and browser pointer tests do not establish compatibility with every controller, mobile browser, or hardware device.

## Visuals and effects

Inspected the running title, battle, damaged bunkers, impacts with floating scores, reconstruction, wave clear, victory, and defeat. Representative images are in the ignored root `artifacts/` directory: `title.png`, `combat-wave-three.png`, `score-impact.png`, `respawn-impact.png`, `wave-clear.png`, `victory.png`, and `current-loss-test.png`.

Invader species retain distinct silhouettes and colors; colored emissive shots remain readable against the dark PBR platform. Bunker holes, player banking, march poses, saucers, and the protection halo are visible. All scene materials, including nested ship/saucer meshes and VFX, report `isMeshStandardMaterial === true`. Internal PMREM/composer shaders remain library implementation details.

All six effects were exercised. In particular, the damage trace recorded an 80 ms hit-stop request: simulation tick 555 stayed constant across multiple advancing render frames, while the camera's X/Y/roll changed and particles continued their slowed presentation. Measured maximum sampled camera displacement was approximately 0.040 world units, and trauma decayed back to zero. Two expanding rings and dozens of burst particles were visible during reconstruction. Projectile trails and projected score labels were captured in combat.

Title/layout checks at **1920×1080, 1280×720, 1024×768, and 390×844** showed no page overflow. The camera keeps the complete battlefield within view; portrait touch controls sit below the canvas. Settings and results use scrollable panels when vertical space is limited. The portrait view is playable but necessarily makes the full-width formation smaller than desktop.

AudioContext successfully unlocked and ran after interaction. The application synthesizes the music and effects with fixed voice graphs; no audio file is fetched. This environment did not include a human listening assessment of speaker/headphone balance.

## Performance, resources, and recovery

The full Low-quality victory sampled at most 58 composed-frame draw calls, 70,968 triangles, and 107 transient primitives. A separate damage run sampled 71 simultaneous primitives, including two rings. The automated stress check reached the exact hard cap of 500. Performance counters include the postprocessing passes.

At a larger initial 2020×936 viewport, Balanced measured approximately 29.6 ms/frame on this integrated GPU; Low measured approximately 19.0 ms/frame. These are environment-specific measurements, not a promise of 60 fps on every device. The emergency quality reduction and manual Low preset preserve gameplay and the six effects.

After warming combat and damage resources, **20 same-page restarts** kept 27 geometries, 17 textures, and 21 shader programs. Every check retained one canvas, 24 pooled labels, one AudioContext, and 56 event listeners. DOM counts fluctuated from 349 to 359 and returned to 351, rather than growing with restart count. Six quality changes also settled at 17 textures and 21 programs. Renderer counts are object counts, not precise GPU-byte measurements.

`WEBGL_lose_context` recovery was exercised. Initial testing exposed stale-handle disposal warnings; releasing GPU resources while the old context is lost fixed that issue. Two consecutive recovery cycles then restored rendering with **zero warnings and zero errors**, kept materials valid, and required explicit Resume. CPU simulation and pool state survived.

Hot module replacement uses the same complete teardown as application disposal. The document stayed loaded, the old AudioContext closed, and the new instance retained one canvas and 24 labels. The entry releases its old game reference, and audio teardown disconnects nodes and releases their references.

The production page's resource timing list contains only its local JavaScript and CSS bundles. Source scans found no asset URLs, prohibited scene-material constructors, missing function bodies, or placeholder implementation markers. An early ANGLE-generated shader precision warning occurred during development; the clean recovery retest had no warnings. See the exact run artifacts for environment-specific console observations.
