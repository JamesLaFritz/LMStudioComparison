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
