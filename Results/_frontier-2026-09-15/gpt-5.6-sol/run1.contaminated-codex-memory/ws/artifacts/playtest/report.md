# Space Invaders playtest and acceptance report

Date: 2026-09-15  
Target: `Space_Invaders`  
Verdict: **PASS**, with the physical-controller limitation recorded below.

## Method

- Headed Chrome was driven with `playwright-cli` against the Vite development URL (`/?debug=1`) and the production preview.
- The development-only bridge supplied read-only telemetry and the four planned transition hooks. Production was separately checked to contain neither the bridge nor any mutation-command symbols.
- Browser observations were paired with deterministic Node tests. Terminal screenshots use transition hooks only to reach presentation states quickly; ordinary collision and mode progression are proven separately by integration tests.

## Automated checks

| Check | Result |
|---|---|
| `npm test` | 59/59 pass |
| `npm run build` | Pass; Vite 8.3.0, 66 modules |
| JavaScript syntax check | Pass for every `.js` file under `src/` and `tests/` |
| Production debug-symbol scan | `__SPACE_INVADERS_DEBUG__` and all four `debugForce*` names absent from `dist/` |
| Material audit | Every visible scene mesh reports `MeshStandardMaterial` |

The nine-wave integration case resolves all 495 alien kills through the ordinary swept-collision pass and advances every wave through the real hit-stop, wave-clear, READY, and VICTORY timers. A second integration case reaches zero-life loss through ordinary enemy-projectile collisions and invasion loss through the ordinary formation boundary check. These cases do not call force-clear, force-victory, force-hit, or force-invasion.

## Browser results

### Startup, network, and production boundary

- Development and production each loaded one canvas and an actionable title screen.
- Final clean reloads recorded 0 console errors, 0 warnings, 0 failed requests, and 0 HTTP responses at or above 400.
- A cold Chrome launch can emit one ANGLE/D3D shader precision information warning (`X4122`). It originates in the graphics driver shader compiler, not project code, and does not recur on the clean reload.
- Production preview had no global debug bridge. Starting the campaign, moving, and firing worked; Web Audio reported `Online`. See [production-smoke.png](./production-smoke.png).

### Keyboard play and simulation behavior

- Keyboard and button activation started the campaign. Left/right input moved the player from x=112 to x=102 and back to x=111.
- Ordinary firing produced projectile trails and impacts. The play pass killed an alien (`score 10`, `54` remaining), damaged shield population from `1144` to `1124`, and exercised projectile interception.
- A 600 ms pause held hash `a989f15f`, host tick `243`, world tick `3`, player position, and formation position unchanged. Resume reported `droppedTimeMs=0` and `substepSaturation=0`.
- Hit-stop, camera trauma, pooled particles, motion trails, shockwave rings, impact lights, and world-anchored score text were all observed during play.

### Visibility and catch-up debt

A synthetic browser visibility transition was applied while PLAYING:

| Stage | Mode | Hash | Host/world ticks | Dropped time | Saturation |
|---|---|---:|---:|---:|---:|
| Before hidden | PLAYING | `3254ec6d` | 240 / 0 | 0 ms | 0 |
| Hidden | PAUSED | `a49a42c8` | 240 / 0 | 0 ms | 0 |
| Hidden after 650 ms | PAUSED | `a49a42c8` | 240 / 0 | 0 ms | 0 |
| Visible, before explicit resume | PAUSED | `a49a42c8` | 240 / 0 | 0 ms | 0 |
| 150 ms after resume | PLAYING | `6745a094` | 255 / 15 | 0 ms | 0 |

The pause transition itself changes the hash because mode is hashed; all state then remains frozen while hidden. No catch-up burst occurs after resume.

### Gamepad API

A standard-mapped Gamepad API object was injected before page load:

- A button started the campaign; telemetry selected input kind `gamepad`.
- Left axis moved x=112 to x=100.
- A button fired one player projectile and produced 9 active particles in the sampled frame.
- Menu/Start paused at host/world tick `248/8`; hash `febf3199` and both ticks remained unchanged for the 300 ms paused sample.
- A resumed from the paused menu. Menu/Start paused again, then B returned to TITLE, proving paused-menu polling and navigation remained live.
- A started a second campaign, and A restarted from a dev-assisted invasion GAME_OVER into READY with wave 1, three lives, and cleared terminal reason.
- A `gamepaddisconnected` event paused the game.

See [gamepad-mocked.png](./gamepad-mocked.png). No physical controller was available on this host, so vibration and real-device mapping remain unverified.

### Accessibility and presentation

- Full-motion player impact sampled 119 particles, one shockwave, one transient light, and camera trauma `0.55`.
- Reduced motion lowered the comparable burst to 43 particles while preserving the gameplay cue. See [reduced-motion.png](./reduced-motion.png).
- High contrast, three independent volume controls, mute, and quality selection were rendered and persisted. See [high-contrast.png](./high-contrast.png).
- Maximum-impact bloom remains localized enough to retain projectile and field silhouettes. See [impact.png](./impact.png).
- Victory and the two game-over causes are visually and textually distinct: `EARTH HOLDS`, `NO RESERVES`, and `LINE BREACHED`. See [victory.png](./victory.png), [life-loss.png](./life-loss.png), and [invasion-loss.png](./invasion-loss.png).

### Viewport matrix

The document, canvas CSS size, canvas drawing buffer, and renderer matched every target viewport. The title panel remained within each viewport, with no document overflow.

| Viewport | Document | Canvas CSS/buffer | Title panel bounds | Material audit |
|---|---|---|---|---|
| 1920×1080 | 1920×1080 | 1920×1080 | (672,292)–(1248,788) | Pass |
| 1366×768 | 1366×768 | 1366×768 | (395,136)–(971,632) | Pass |
| 1024×768 | 1024×768 | 1024×768 | (224,137)–(800,631) | Pass |
| 390×844 | 390×844 | 390×844 | (16,235)–(375,609) | Pass |

The 1366×768 and 390×844 PLAYING captures each report player visible, 55 alien instances, 1,144 shield cells, and the full material audit passing. Together with the 1920×1080 and 1024×768 captures, they visibly preserve the player, bunkers, lowest enemy row, and central firing lanes below the HUD at every required viewport.

Active-play evidence: [play.png](./play.png), [gameplay-1366x768.png](./gameplay-1366x768.png), [viewport-1024x768.png](./viewport-1024x768.png), and [mobile-gameplay-390x844.png](./mobile-gameplay-390x844.png). Title/settings evidence: [title.png](./title.png) and [mobile-390x844.png](./mobile-390x844.png).

### WebGL context recovery and teardown

- `WEBGL_lose_context` returned supported. The blocking `GRAPHICS CONTEXT INTERRUPTED` surface appeared; see [context-loss.png](./context-loss.png).
- Single-cycle hash stayed `d3d09c85` before loss, while lost, and after restore. Material audit remained true; restored counts were 17 programs, 23 geometries, and 20 textures. The probe logged 0 errors and 0 warnings beyond the expected context lifecycle log messages.
- An independent three-cycle pass held hash `114e4904` at every lost/restored checkpoint and held resources at 17/23/20. A post-restore high→low quality change was also clean.
- Final `pagehide` removed the debug bridge and produced 0 errors and 0 warnings. Old-context dispose listeners, composer targets, and the renderer-owned shadow map are released while the context is lost, preventing foreign-handle deletion at final teardown.

A separate instrumented final-teardown run began with Web Audio running, six UI-root children, 32 VFX-overlay children, and one live `ResizeObserver`. After `pagehide` and the asynchronous `Game.dispose()` chain completed:

- the debug bridge was absent; UI-root children, VFX-overlay children, and all queried game DOM nodes were zero;
- the `AudioContext` state was `closed` and the `ResizeObserver` reported disconnected;
- all tracked game listener families had matching removals, including both renderer and host canvas context listeners, input listeners, visibility/blur/disconnect listeners, and `pagehide`;
- the final WebGL context reported lost after renderer teardown;
- instrumented GPU cleanup observed 170 buffer, 36 texture, 33 program, 32 framebuffer, 8 renderbuffer, 104 vertex-array, and 68 shader deletion calls;
- the teardown console remained at 0 errors and 0 warnings.

### Repeated wave/restart stability

Three development wave resets followed by a full campaign restart produced:

| Sample | Mode/wave | Programs | Geometries | Textures | Draw calls | Particle peak | Event overflow |
|---|---|---:|---:|---:|---:|---:|---:|
| Baseline | PLAYING / 1 | 17 | 23 | 20 | 36 | 10 | 0 |
| Wave 2 | PLAYING / 2 | 17 | 23 | 20 | 35 | 110 | 0 |
| Wave 3 | PLAYING / 3 | 17 | 23 | 20 | 35 | 115 | 0 |
| Wave 4 | PLAYING / 4 | 17 | 23 | 20 | 35 | 115 | 0 |
| Restart | PLAYING / 1 | 17 | 23 | 20 | 35 | 5 | 0 |

Every sample retained the same fixed capacities: player 1, aliens 55, player shot 1, each hostile shot type 1, saucer 1, shield cells 1408. Draw/triangle variation is expected from transient pooled VFX; GPU object counts did not grow. Particle peak stayed below the hard cap of 500.

## Screenshot index

- [Title](./title.png)
- [Normal play](./play.png)
- [Heavy impact](./impact.png)
- [Pause](./pause.png)
- [Reduced motion](./reduced-motion.png)
- [High contrast](./high-contrast.png)
- [Victory](./victory.png)
- [Life-loss game over](./life-loss.png)
- [Invasion game over](./invasion-loss.png)
- [1024×768 gameplay](./viewport-1024x768.png)
- [1366×768 active gameplay](./gameplay-1366x768.png)
- [390×844 mobile layout](./mobile-390x844.png)
- [390×844 active gameplay](./mobile-gameplay-390x844.png)
- [Mocked gamepad](./gamepad-mocked.png)
- [Context-loss overlay](./context-loss.png)
- [Production preview](./production-smoke.png)

## Limitations and evidence boundaries

- No physical gamepad was connected; Gamepad API behavior was verified with a standards-shaped mock and unit tests.
- Terminal screenshots are presentation captures reached with development-only transition hooks. The separate 59-test suite is the evidence for ordinary nine-wave, life-loss, and invasion state progression.
- The automated nine-wave case accelerates projectile placement but does not bypass collision resolution or mode timers; a real-time human nine-wave endurance playthrough was not recorded.
