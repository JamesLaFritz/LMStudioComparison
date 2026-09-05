# Retro-Futurism Space Invaders — reference build — answer key

## Three.js 0.169 to 0.182

**PIN UP. `three@0.182.0` / `vite@^7.3.6`, matching the Template. Four edits, all
in `src/shared/render/` plus one in `src/shared/core/Disposer.js`.**

Nothing in the 13-revision range breaks a line of this build's API usage. The
migration is small and known; staying put buys nothing and costs a migration later.

### How this was established

Not from memory. Sources, in descending authority:

1. The published packages themselves — `three-0.169.0.tgz` and `three-0.182.0.tgz`
   from `registry.npmjs.org`, diffed file by file (`src/`, `examples/jsm/`,
   `package.json`). Revisions 0.170–0.181 pulled per-file from `unpkg.com` to bisect
   which release introduced each change.
2. The official Migration Guide wiki,
   `https://raw.githubusercontent.com/wiki/mrdoob/three.js/Migration-Guide.md`,
   sections `169 → 170` through `181 → 182`.
3. Official three.js and Vite docs via the `ctx7` CLI (`/mrdoob/three.js`,
   `/websites/v7_vite_dev`, `/websites/v6_vite_dev`).
4. **Executed evidence.** Two sandboxes *outside* the repo, each an unmodified copy
   of `opus/retro-futurism-arcade/` (`src/`, `index.html`, `vite.config.js`):
   **A** = `three 0.169.0` / `vite 5.4.21`, **B** = `three 0.182.0` / `vite 7.3.6`.
   Both `vite build`-ed; both driven in headless Chromium to construct the renderer,
   the whole six-pass PostFX stack, `ParticleManager` and `ShockwaveSystem`, render
   frames, read pixels back, and tear down while sampling `renderer.info.memory`.
   Nothing under `Results/_SpaceInvaders-bench-2026-09-04/` was modified.

Full working, with every diff and measurement, is on branch
`research/threejs-0169-to-0182` at
`wayfinder/retro-futurism-space-invaders/research/threejs-0169-to-0182.md`.

### Headline: both configurations build and run

| | A (0.169 / vite 5.4.21) | B (0.182 / vite 7.3.6) |
|---|---|---|
| `vite build` | clean | clean |
| `three` chunk | 554.97 kB (gzip 162.44) | 578.43 kB (gzip 169.16) |
| `engine` chunk, CSS emitted | 119.07 kB, 4.94 + 12.65 kB | identical |
| Runtime: full stack, 2 frames, dispose | 0 errors, 0 warnings | 0 errors, 0 warnings |

`vite.config.js` needed **no edit at all** for Vite 7.

### The questions asked, answered

**`EffectComposer` / `UnrealBloomPass` / `RenderPass` — import paths and constructor
shape.** Unchanged. The `exports` map in three's `package.json` is byte-identical for
`"."`, `"./examples/jsm/*"`, `"./addons"`, `"./addons/*"` and `"./src/*"` between the
two versions; the only edit anywhere in that block is `"./tsl"`, a WebGPU path this
build never imports. `examples/jsm/postprocessing/` did **not** move or change shape.
All six postprocessing imports in `PostFX.js` and the two in the custom passes, plus
`three/examples/jsm/utils/BufferGeometryUtils.js` in `GeometryLab.js`, resolve
unchanged. `EffectComposer.js` with comments stripped differs by exactly one line (two
`MaskPass` imports merged into one statement). `RenderPass(scene, camera, overrideMaterial,
clearColor, clearAlpha)`, `OutputPass()` and `UnrealBloomPass(resolution, strength,
radius, threshold)` are all signature-identical. No WebGPU/TSL restructuring touched a
path this build uses. All 41 `THREE.*` symbols the build references were verified to be
live exports of r182's `build/three.module.js` by importing the module in Node; the one
miss, `THREE.ColorRepresentation`, is absent at r169 too — it is a `@types/three`
TypeScript type appearing only inside JSDoc comments.

*The one exception:* **`SMAAPass` lost its `width, height` constructor arguments at
r175** (Migration Guide `174 → 175`). `PostFX.js:110` passes them; at r182 they are
silently ignored and the pass allocates 1x1 targets. **Harmless as written** —
verified, not assumed: `EffectComposer.addPass()` calls `pass.setSize(...)` immediately,
and the instrumented run reported the SMAA targets at `[800, 450]` after construction at
*both* revisions. Clean it up anyway so the call site stops lying.

**The custom-pass authoring API — do `ChromaticAberrationPass` and `FilmGrainPass`
still work?** **Yes, unchanged, no migration.** `Pass` keeps `isPass`, `enabled`,
`needsSwap`, `clear`, `renderToScreen`, and the abstract `setSize()` /
`render(renderer, writeBuffer, readBuffer, deltaTime, maskActive)` / `dispose()`.
`ShaderPass(shader, textureID = 'tDiffuse')` still accepts a plain
`{ name, uniforms, vertexShader, fragmentShader }` object, still clones uniforms onto
`this.uniforms`, still builds `this.material`, still blits `readBuffer.texture` into the
sampler. Both passes touch only `this.uniforms`, `this.material` and `this.enabled`.
Their GLSL (`texture2D`, `gl_FragColor`, the standard vertex form) still compiles under
r182's `ShaderMaterial` — no forced GLSL3. Confirmed by execution: the full six-pass
stack constructs and renders at r182 with zero warnings.

r175 *did* privatise pass internals (`ShaderPass.fsQuad` -> `_fsQuad`;
`UnrealBloomPass.fsQuad` / `.basic` / `.oldClearAlpha` / `.getSeperableBlurMaterial()` /
`.getCompositeMaterial()`; all of `SMAAPass`'s targets and materials;
`OutputPass.fsQuad`). Grepped `src/` for every one of those names — **zero hits.**

**Colour management.** **Zero work.** The upheaval was **r152** (Migration Guide
`151 → 152`: `outputEncoding` -> `outputColorSpace`, `Texture.encoding` ->
`Texture.colorSpace`, `sRGBEncoding` -> `SRGBColorSpace`, `uv2` -> `uv1`) — well before
0.169, and this build is already on the far side of all of it. Grepping `src/` for
`encoding`, `outputEncoding`, `sRGBEncoding`, `LinearEncoding`, `useLegacyLights`,
`physicallyCorrectLights`, `gammaFactor` returns nothing. Across 0.169 → 0.182:
`WebGLRenderer` still defaults `outputColorSpace` to `SRGBColorSpace` and `toneMapping`
to `NoToneMapping`; `ColorManagement.enabled` is still `true` and `workingColorSpace`
still `LinearSRGBColorSpace`; every constant the build uses (`SRGBColorSpace`,
`LinearSRGBColorSpace`, `NoColorSpace`, `HalfFloatType`, `ACESFilmicToneMapping`,
`DynamicDrawUsage`, the wrapping and filter constants) has the same name and value.
Renamed but unused: `ColorManagement.toWorkingColorSpace()` -> `colorSpaceToWorking()`
and `fromWorkingColorSpace()` -> `workingToColorSpace()` (**r177**) — the build never
calls `ColorManagement`. Removed but unused: `DisplayP3ColorSpace`,
`LinearDisplayP3ColorSpace`, `Rec709Primaries`, `P3Primaries`, `LuminanceFormat`,
`LuminanceAlphaFormat`. `PostFX.js`'s HDR premise still holds exactly as its docblock
describes: `HalfFloatType` + `LinearSRGBColorSpace` target, renderer forces
`NoToneMapping` into targets, `OutputPass` applies tone mapping last.

**`MeshStandardMaterial` / `InstancedMesh` / `BufferGeometry`.** Effectively nothing.
`MeshStandardMaterial`'s comment-stripped diff is empty. `InstancedMesh` differs in one
line: `dispose()` no longer returns `this` (never chained here). `BufferGeometry` is
purely additive (`setIndirect()` / `getIndirect()`; `setFromPoints()` reuses an existing
`position` attribute). `BufferAttribute` gained a read-only `id`; `InstancedBufferAttribute`
with `setUsage(DynamicDrawUsage)` unchanged. `WebGLRenderTarget` and `CanvasTexture` diffs
are empty. `Texture` is additive but gained read-only **`width` / `height` / `depth`
getters** — assigning `texture.width = ...` would now throw in strict mode; grepped, the
build never does. `mergeGeometries` is unchanged and still exported.

Shader injection survives intact: all three chunk hooks `MaterialLibrary.js` patches —
`#include <common>`, `#include <begin_vertex>`, `#include <emissivemap_fragment>` —
are still present in r182's `meshphysical.glsl.js` at essentially the same lines, with
`totalEmissiveRadiance` and `diffuseColor` still in scope. `onBeforeCompile(shader,
renderer)` and `customProgramCacheKey()` are unchanged. All five patches work.

Two r170 notes, both checked and both no-ops here: **`Material.type` became static**
(*"might affect projects which use `onBeforeCompile()`"*) — the build never assigns a
material's `type`; and **mipmaps are now always generated when `generateMipmaps` is
`true` regardless of filter** — `TextureFactory.js` already pairs `generateMipmaps = true`
with `LinearMipmapLinearFilter` and no call site overrides it.

**`.dispose()` semantics.** Unchanged for `BufferGeometry`, `Material`, `Texture`,
`WebGLRenderTarget`, `EffectComposer` and every pass. `WebGLObjects.js` — which frees
`instanceMatrix` / `instanceColor` on an `InstancedMesh`'s `dispose` event — is
**byte-identical** between the versions.

One measured difference. Full stack, render, then dispose step by step, sampling
`renderer.info.memory.textures`:

| stage | r169 | r182 |
|---|---|---|
| after 2 frames | 15 | 16 |
| after complete teardown | **0** | **1** |

Isolated: the extra texture comes from neither bloom nor SMAA. A bare r182 renderer with
no composer allocates it on the **first render to screen** and never releases it, and a
second allocate/render/dispose cycle returns to 1, not 2. So it is a **one-time +1
baseline, not a per-mount leak** — drift across a mount/unmount cycle is still zero at
both revisions. Consequence for `Disposer.memorySnapshot()` and the leak assertion: take
the "before" snapshot *after* the first rendered frame, or it will report a one-off
`textures: +1`. *Which* internal texture it is (probably the empty sampler placeholder in
`WebGLUniforms`) is **unconfirmed** — the behaviour is measured, the mechanism is a guess.

Separately, a **pre-existing, version-independent bug**: `Disposer.js:135-136` frees
instanced buffers with `node.instanceMatrix.array = null` / `node.instanceColor.array =
null`. That drops the JS typed array but never frees the GPU buffer — only
`InstancedMesh.dispose()` does, by dispatching the `'dispose'` event that
`WebGLObjects.onInstancedMeshDispose` listens for. Leaks identically at 0.169 and 0.182,
so it is not an argument for staying put, but it is real and it belongs to
`Does the adopted layer run`.

**Vite 5 -> 7 for a vanilla-JS ESM app with CSS imports and dynamic `import()`.**
Nothing affects this app; the config builds unmodified under 7.3.6. The one real
requirement is **Node 20.19+ or 22.12+** (Node 18 dropped). Checked and dismissed, each
individually: default `build.target` changed `'modules'` -> `'baseline-widely-available'`
and `'modules'` was removed — the config sets `target: 'es2022'` explicitly, so the
default never applies; `resolve.conditions` defaults changed in Vite 6 but only matter if
you override the option, which this config does not; `json.stringify: 'auto'` — no JSON
imported; Sass legacy API removed — plain CSS only; CSS `@import` inlining and `url()`
rebasing unchanged, and both builds emitted identical stylesheets at identical sizes;
dynamic `import()` in `GameRegistry.js:77` still code-splits; the `@shared` / `@game` /
`@hub` aliases and the `three` -> `./node_modules/three` **directory** alias all resolve
under Vite 7's resolver; `manualChunks` function form still supported; `vite.config.js` is
already ESM so the CJS Node API removal is moot.

### What actually changes visually — the real cost

**1. `PCFSoftShadowMap` silently becomes hard BASIC shadows at r182.** The sharpest
finding, and the one that would have cost a session. Migration Guide `181 → 182`:
*"`PCFSoftShadowMap` with `WebGLRenderer` is now deprecated. Use `PCFShadowMap` which is
now soft as well."* `RendererFactory.js:80` sets `PCFSoftShadowMap`. At r182,
`WebGLProgram.js` replaced the old `if/else` chain with a lookup table containing
entries for `PCFShadowMap` and `VSMShadowMap` **only**, falling back to
`'SHADOWMAP_TYPE_BASIC'`; `PCFSoftShadowMap` (value `2`) is not in it. The intended
runtime coercion in `WebGLShadowMap.js:99` tests `lights.type === PCFSoftShadowMap`, but
`lights` is the *array* of shadow lights (`if (lights.length === 0) return;` is the line
above), so `lights.type` is `undefined`, the branch never fires, the deprecation warning
is never printed and the type is never coerced.

Confirmed by reading the compiled fragment shader out of
`renderer.info.programs[i].fragmentShader` via `gl.getShaderSource()`:

| `shadowMap.type` | r169 compiles | r182 compiles |
|---|---|---|
| `PCFSoftShadowMap` | `SHADOWMAP_TYPE_PCF_SOFT` | **`SHADOWMAP_TYPE_BASIC`** |
| `PCFShadowMap` | `SHADOWMAP_TYPE_PCF` | `SHADOWMAP_TYPE_PCF` |
| `BasicShadowMap` | `SHADOWMAP_TYPE_BASIC` | `SHADOWMAP_TYPE_BASIC` |
| `VSMShadowMap` | `SHADOWMAP_TYPE_VSM` | `SHADOWMAP_TYPE_VSM` |

**Zero console output either way.** Pin up without changing that line and every shadow
in the arcade goes hard-edged with nothing reporting it — precisely the class of failure
this effort exists to catch.

**2. `UnrealBloomPass` blooms wider and brighter for the same numbers (r181 + r182).**
Bisected to the exact releases. **r181**: `kernelSizeArray` widened from `[3,5,7,9,11]`
to `[6,10,14,18,22]`, sigma became `kernelRadius / 3`, and the `diffuseSum / weightSum`
normalisation was removed. **r182**: the composite went from `bloomStrength * sum(...)` on
a `vec4` to `3.0 * bloomStrength * sum(...rgb)` with a computed `bloomAlpha`, and
`blendMaterial` gained `premultipliedAlpha: true`.

Measured — identical scene, one small cyan emitter on black, ACES, exposure 1.06, the
exact `spaceInvaders` preset (`strength 0.85 / radius 0.55 / threshold 0.72`), 512x512
pixel readback:

| metric | r169 | r182 | change |
|---|---|---|---|
| mean screen luminance | 23.35 | 27.25 | **+16.7 %** |
| pixels above black (>4/255) | 218,208 (83.2 %) | 243,344 (92.8 %) | **+11.5 %** |
| luminance at the frame edge | 5 | 8 | **+60 %** |
| luminance ~64 px from centre | 6 | 13 | **~2x** |
| peak luminance | 252.5 | 252.5 | unchanged |

The emitter core is identical; the **skirt** is materially wider and brighter. That is
exactly what `BloomPreset.js` is tuned against — it asks for "hard point sources, hence
0.55" and warns that too much strength "makes a full formation of 55 invaders merge into
one glowing slab". At r182 the shipped numbers already sit further toward that failure.
This is a re-tune, not a break, and the preset table exists to be tuned.

**3. PBR materials changed appearance at r181.** Migration Guide `180 → 181`: indirect
specular computation improved ([#32054](https://github.com/mrdoob/three.js/pull/32054)),
and PBR materials now conserve energy better so *rough materials (roughness > 0.5) are
brighter* ([#32072](https://github.com/mrdoob/three.js/pull/32072)). Every material here
is a `MeshStandardMaterial` by directive, so this touches all of them, and it compounds
with the bloom change: brighter rough surfaces push more of the frame over the 0.72
threshold. Re-tune, no API change.

Points 2 and 3 are **not** reasons to stay put. The visual target is still undecided
(`The visual target` has not been answered), `PostFX.setBloom()` already exposes live
sliders, and tuning once against r182 is strictly cheaper than tuning against r169 and
migrating afterwards.

### Migration steps

1. **`package.json`** — `"three": "0.182.0"`, `"vite": "^7.3.6"`, add
   `"engines": { "node": ">=22.12.0" }`. Delete `package-lock.json` and `node_modules/`,
   reinstall.
2. **`src/shared/render/RendererFactory.js:80`** — **required.**
   `THREE.PCFSoftShadowMap` -> `THREE.PCFShadowMap`. Silent hard-shadow regression
   otherwise.
3. **`src/shared/render/PostFX.js:110`** — cosmetic. `new SMAAPass(this.width, this.height)`
   -> `new SMAAPass()`. The arguments are ignored at r182 and `addPass()` sizes the pass
   either way.
4. **`src/shared/render/BloomPreset.js`** — re-tune once `The visual target` lands.
   Every entry was authored against r169's narrower blur. Expect a **lower `strength`
   and smaller `radius`** than 0.85 / 0.55, and re-check `minimumGlowIntensity()`'s 1.9x
   ACES margin. Do not treat the current numbers as a baseline that "should" look right.
5. **`src/shared/core/Disposer.js:135-136`** — not a version issue, fix while you are
   here: call `node.dispose()` on instanced meshes instead of nulling
   `instanceMatrix.array` / `instanceColor.array`.
6. **`Disposer.memorySnapshot()`** — take the baseline after the first rendered frame,
   or the leak assertion reports a one-off `textures: +1` at r182.

No other file in `src/` needs to change. Specifically **no edits are required to**
`ChromaticAberrationPass.js`, `FilmGrainPass.js`, `MaterialLibrary.js`,
`TextureFactory.js`, `PBRMaps.js`, `GeometryLab.js`, `ParticleManager.js`,
`Shockwave.js`, or `vite.config.js`.

### Two blockers found in passing — version-independent, for `Does the adopted layer run`

Trying to build the frozen source fails identically at **both** versions, so these are
structural gaps, not drift:

1. **`src/games/Space_Invaders/index.js` does not exist.** `GameRegistry.js:77`
   dynamically imports it. `vite build` fails outright:
   `Could not resolve "../games/Space_Invaders/index.js" from "src/hub/GameRegistry.js"`.
2. **`Formation.js:2` imports five symbols `SimState.js` does not export** —
   `colOf`, `rowOf`, `speciesOfRow`, `invaderX`, `invaderY`.
   -> `"colOf" is not exported by "src/games/Space_Invaders/simulation/SimState.js"`.

Every measurement above was therefore taken with a synthetic entry point importing all
44 `shared/` modules, so the version question stayed isolated from these two gaps.

### Stated as unconfirmed

- Which renderer-internal texture accounts for r182's `+1` baseline. Behaviour measured;
  mechanism is a guess.
- The perceptual magnitude of the bloom and PBR changes in the finished game — the
  numbers come from a synthetic single-emitter scene, because the game layer does not
  exist yet.
- Revisions 0.183+ were not examined. The Template pins 0.182.

## The visual target

**The bar is Housemarque's *Resogun* (2013), stated as measurements, not adjectives.**
Spec, reference pack, judging checklist and a measurement tool live in
`wayfinder/retro-futurism-space-invaders/assets/visual-target/` (commit `043d333`).

A generated reference pack was **not** warranted; real imagery of a shipped title was, and
it is strictly better — a generated pack can only describe a world, whereas 26 frames of an
actual game can be *measured*, and the numbers are what make the direction verifiable.

### How this was established

26 Resogun frames from two independent sources, deliberately: 6 first-party (Housemarque's
own press capture) and 20 third-party, which have different re-encode pipelines. Every
finding below is one the two sources agree on; the one place they disagree is recorded as a
ruling. Nothing was inferred from an adjective in a review. Provenance and the two-tier
authority split are in `manifest.md`; per-frame numbers for all 26 in `reference/measurements.csv`.

### The authority split, because the reference is a different game

Resogun is a horizontal cylinder-world twin-stick shooter; we are building Space Invaders.

- **SPEC tier** — `visual-spec.md` and `measurements.csv`. Sole authority for layout,
  counts, sizes, colours and parameters.
- **FIDELITY tier** — the images. They answer exactly one question: *put our screenshot next
  to Resogun, could you tell which is the game?*

**Tiebreak, quotable in a judge prompt:** where an image disagrees with the spec about what
is on screen, where it is, or how many there are, the spec wins and the disagreement is not
a defect. The images are explicitly not authority for a horizontal camera, a scrolling city,
voxel destruction, enemy silhouettes, or HUD layout.

### What was measured

| Finding | Confidence | What it changes |
|---|---|---|
| **Two thirds of the frame is dark.** 49-86 % of pixels below sRGB V 0.35 (median 64 %); frame-median linear luminance 0.028 | measured, both sources | The whole tonal contract. If our frame is bright with dark bits, nothing else matters |
| **Under 1 % of the frame is white.** Median 0.94 %; even peak destruction only 1.7 % | measured | The washout ceiling |
| **The dark is green-teal and *more saturated* than the highlights.** Near-black `#030906`/`#050a06`; shadow band ~`#0d2224` | measured, sources agree to 2/255 | The build's `#05060f` fog is blue-violet. `FogExp2` to **`#0b1e22`** is the highest-value single line in the spec |
| **Glow shape: tight core, long faint skirt.** Half-power at **0.74 % of frame height**, still ~7 % of core brightness 8 % away | measured two independent ways | **This is the bloom acceptance criterion**, not the three parameters |
| **Light is narrow-band.** Top two adjacent 30° hue bins hold 40-75 % of lit pixels | measured; corroborated by a contradiction — the two halves disagree on the hue and agree on the narrowness | Kills "neon = cyan + magenta + lime + amber at once". Our band: 150-210° |
| **Enemy hulls are lit matter, not light.** Saturated mid-dark body, faceted PBR, a 1-2 px near-white rim, one small hot accent | visible at magnification | The big one — see below |
| **Reference density is 1-2 orders of magnitude past 500 particles** (~20,000 bright runs/frame, median 5 px wide) | measured | Density comes from `InstancedMesh`, not the particle manager |

### The decision that matters most

`config.js` gives all three invader species `emissiveIntensity` 1.45-1.55, all above
`minimumGlowIntensity(0.72)` = 1.368. **All 55 invaders would bloom** — precisely the
"formation merges into one glowing slab" that `BloomPreset.js` warns about, arrived at
through *material authoring* where the file's own comment expects it to arrive through the
bloom parameters. Turning bloom down cannot fix it without killing the projectiles.

The reference's answer: the formation is not a light source at all.

- hull body emissive **0.35** — does not bloom
- silhouette rim **1.05** — deliberately just under the 1.368 floor: bright and crisp, adds
  nothing to the bloom buffer
- one "eye" dot, <= 4 % of hull area, at **2.1** — blooms

55 small hot points instead of 55 glowing slabs. Species emissive *hues* stay as authored —
row identity by colour is the classic's own readability device and the rim carries it.

### Bloom, stated as r182 values

```
r169 (frozen preset):  strength 0.85   radius 0.55   threshold 0.72
r182 (this spec):      strength 0.72   radius 0.38   threshold 0.72
```

- **threshold holds at 0.72** — it anchors the emissive-authoring contract above. Safe
  because nearly every material is specified below roughness 0.5, which is where r181 bites.
- **radius 0.55 -> 0.38** is the significant move, the direct counter to r181's widened kernel.
- **strength cut only 15 %**, deliberately: removing 55 invader emitters takes real bloom
  source out of the frame. Both changes must be made and measured together; either alone
  looks wrong.

**Starting point only — not verified, r182 could not be run in that session. The gate is the
measured halo profile.** If the halo is still too wide, drop `PostFX.bloomDivisor` from 2 to
1 *before* dropping `radius` further: the half-resolution bloom buffer is itself doubling the
kernel's screen-space width.

### The hub

`.cabinet__status--scheduled` is wired up and made **mandatory on every card**. A dimmed card
is ambiguous by default — "off on purpose" and "failed to load" look identical — so seven
rules each remove one way of reading it as broken. Load-bearing: opacity **0.46 -> 0.70**
(below ~0.6 a title stops reading as text and starts reading as a failed render); grayscale
the accent bar rather than dimming the whole card, so exactly one title in fourteen is
coloured; a **dashed** border on the locked pill, the cheapest unambiguous "placeholder, on
purpose" signal in CSS; and a hover response, because an unresponsive element is
indistinguishable from a dead one — exactly the case the playability gate must not mistake
for a dead button.

`HubScene.js` uses the `deepSpace` preset (radius 0.78, widest in the table) against r169. At
r182 that reads as haze, not stars. The attract scene is not exempt from the visual gate; it
is the first frame anyone sees.

### The gate

`tools/measure-frame.py` reports ten metrics on any screenshot with the reference p10-p90
envelope beside each (needs `pillow`, `numpy`). `judging-checklist.md` is 16 items in
priority order, each answerable by looking at two images rather than reading code, in four
tiers. Tier-1 failures are fixed before a Tier-3 item is looked at, because a Tier-1 failure
makes the rest unjudgeable. Output is a list of named failures with the plate proving each —
not a score.

### Stated as unconfirmed

- The three bloom numbers. Arithmetic on measured deltas plus judgement about the
  emitter-count change; not rendered.
- Every roughness/metalness value. Reasoned, none measured off a material.
- The green-led *deepest* black. Two lossy codecs agreeing is strong, but it is the
  measurement taken where codecs are least reliable. The teal fog (V 0.10-0.42) is safe; the
  exact sub-0.06 hex is not.
- The split of that finding between fog and true void — a call about our different subject
  matter, not something an image showed.
- All of glassmorphism and the hub cards. The reference has neither.
- **Motion.** Everything was measured on stills. Trail length, hit-stop duration, shake decay
  and the timing of the six VFX belong to the playability gate.

### Assets

`assets/visual-target/` — `README.md`, `visual-spec.md` (9 sections, every number tagged
[M]easured / [C]arried / [D]erived / [G]uess), `judging-checklist.md`, `manifest.md`,
`reference/` (13 plates + `measurements.csv`), `tools/measure-frame.py`.

## The playability gate

**Written, executable, and proved able to go red. 42 automated verbs — 10 hub, 26
classic-complete, 6 VFX — plus 9 integrity checks and 3 specified as manual.** Everything in
`wayfinder/retro-futurism-space-invaders/assets/playability-gate/` (commit `ee2311c`);
`gate.md` is the gate, `run-gate.mjs` executes it. Every row is: the verb, the real input
that triggers it, the observable that proves it, and a numeric threshold.

### The rule the whole instrument turns on

The gate may **read** state to confirm what it caused. It may never **cause** state by calling
into game internals. Every state change originates from `page.keyboard.*` / `page.mouse.*`,
dispatched through CDP `Input.dispatchKeyEvent` — the browser's real input pipeline, upstream
of the page's own listeners. No harness code path calls a game method, sets a game field, or
synthesises a `KeyboardEvent` in page script. Causing by calling internals is exactly how the
2026-09-04 failure hid.

Corollary, enforced per row: **no verb passes on state alone.** Every verb carries a pixel or
DOM observable; the probe is corroboration only.

### Anti-false-green

1. **Idle-window frame differencing.** I5 over the whole frame, C6 restricted to the
   formation band. Reported as raw changed-pixel counts, so `0` appears as `0`. This is the
   measurement that caught the local build.
2. **Per-verb pixel/state deltas.** C12 requires the score increase to coincide with the
   formation *losing lit mass*; C25 requires restart to restore not just the picture and the
   HUD but the *march*. Both exist to catch a HUD reporting what the world did not do.
3. **Negative control** (I6): an unbound key must change nothing, making every input verb a
   differential claim. **Input-path liveness** (I7) separates "keyboard dead" from "verb
   unimplemented" — opposite repairs.
4. **Three-valued verdicts.** PASS / FAIL / INCONCLUSIVE, where INCONCLUSIVE is a claim about
   the *run*, never a pass. `--quick`, `--only`, `--verbs`, `--fault` runs can report red but
   can never report a pass.
5. **Capture cadence is a measurement.** `page.screenshot()` costs 1102 ms/frame against a
   bloomed WebGL build under software GL — too coarse to see a projectile or a 200 ms
   hit-stop, and it would have produced confident reds about working code. Time-series
   capture therefore uses CDP `Page.startScreencast`, measured at 16.5 ms/frame. Achieved
   cadence is recorded beside each verdict; C5 returns INCONCLUSIVE rather than red when it
   cannot resolve the shot rate.

### The six VFX are six rows, never one

They fire on the same event, so each needs a signature no other produces. **V1** moves light
in a `sceneryBand` containing no gameplay entity (only the camera can do that) and must
decay. **V2** is a filled cloud that swells and clears, beating a measured ambient baseline.
**V3** is a *trough* in whole-frame change that recovers — the one effect that is the absence
of motion. **V4** is a single-frame streak far longer than the projectile, dimming along its
length. **V5** must be **hollow** and its peak radius must strictly grow. **V6** is a DOM node
with digits that rises and is removed. The self-test asserts a filled burst passes V2 and
**fails** V5 on the same frames.

### The hub, and the locked-card subtlety

H1-H10 cover boot, the 14-card grid (13 locked), hash routing and deep links, launching the
lit cabinet into a *painting* canvas, exit back to hub, attract liveness, and a failed load
surfacing (H8 aborts the lazily-imported chunk by request interception, so the registry's
rejection and `main.js`'s `showFatal` run for real).

H3 does not ask "did clicking the locked card do something" — **silence is never scored as a
dead button.** It requires both *correctly inert* (no navigation, no mount, nothing thrown)
and *legible* (`disabled`/`aria-disabled`, plus a status matching `/scheduled|soon|locked/i`
on screen). A locked card that launched something fails as a broken lock; one that sat there
with no indication why fails as an **unlabelled** button — and the report says so in those
words, so the repair is unambiguous.

### What the build owes the gate

A read-only `window.__gate.snapshot()` (contract in `gate.md`: pure, derived from what the
renderer draws from, never a call-site tally) and `data-gate` attributes on the HUD, the
game-over overlay, the restart control and each floating-score node. Absent probe is not a
failure — the harness degrades to HUD scraping and marks affected rows INCONCLUSIVE.

### Proved, not asserted

- `selftest.mjs` — **24/24**, a PASS *and* a FAIL case per detector. Writing it found three
  real weaknesses: V1, V2 and V5 all read ambient scene motion as an effect. Fixed; all three
  now require the effect to beat a measured ambient baseline.
- **Run end to end against the frozen 2026-09-04 local build** (a copy outside `Results/`)
  and it reproduced the human verdict independently: I5 `unionChangedPixels: 0`, C6
  `centroidTravel: 0, maxChangedPixels: 0`, C4 no projectile, C12 score never moved, C1/C2/C3
  pass — the ship being the only working verb, exactly as recorded.
  **9 pass · 14 fail · 13 inconclusive · 3 skipped.**
- **Live red proofs:** `--fault freeze-raf` turns I2, I5, I9 red. `--fault no-input` turns
  C1/C2/C3 red on the same build where they pass unfaulted, while the negative control I6
  stays green. That differential is the strongest evidence the harness measures input rather
  than the passage of time.
- Reports and frames for all four runs are under `assets/playability-gate/evidence/`.

### Not verified, and gate.md says so plainly

**No verb has ever been observed passing on a real Space Invaders build, because there is not
one yet.** The frozen build proves the reds; it cannot prove the greens. Unexecuted in the
green direction: C6-C10, C14-C28, V1-V6, and all of H1-H10. The `__gate` probe has never been
implemented, so every probe-corroborated branch is untried. `targets/reference.json` regions
are guesses and are marked as such — calibration against one real frame is part of running
it, and a mis-set `sceneryBand` is the one way this harness can produce a false red.
`--fault mute-fire` and `--fault frozen-hud` are untested live. C17 (shoot the UFO), C28
(invasion ends the run) and G1 (gamepad — CDP has no gamepad domain, and faking
`navigator.getGamepads` would be the synthetic call this gate forbids) are specified with
manual procedures and deliberately not automated.
