# Visual spec — Retro-Futurism Space Invaders

**Status:** SPEC tier. This document, plus `reference/measurements.csv`, is the
only authority for layout, counts, sizes, colours and parameters. The images in
`reference/` are FIDELITY tier and answer exactly one question: *put our
screenshot next to Resogun — could you tell which one is the game?*

**The bar:** Housemarque's *Resogun* (2013). Not "neon", not "synthwave" —
Resogun specifically, because it is the one shipped title whose whole visual
thesis is *many small hard light sources against a dark saturated ground*,
which is what a 55-invader lattice needs.

**Every number here is checkable against a screenshot.** Run
`python tools/measure-frame.py shot.png`. Where a number is a taste call
rather than a measurement, it says so.

Confidence tags used throughout:
**[M]** measured off the reference corpus · **[C]** carried from the frozen
build's `config.js` (already decided, restated here) · **[D]** derived by
arithmetic from [M] or [C] · **[G]** my best guess, needs one tuning pass.

---

## 0. Spatial source of truth

Restated as text so nothing has to be scaled off an image.

- Arena **30 × 22** world units. Player rail `y = −9`. Kill line `y = −7.6`.
  Deck `y = −9.9`. UFO lane `y = 8.9`. Back wall `z = −12`, nebula `z = −40`. **[C]**
- Camera: FOV **46°** vertical, at `(0, −0.6, 24.5)`, looking at `(0, 0.4, 0)`. **[C]**
- Therefore the visible height at the play plane (`z = 0`) is
  `2 × 24.5 × tan(23°)` = **20.8 world units**, and
  **1 % of frame height = 0.208 world units**. **[D]** Every image-derived size
  below is converted with this constant and no other.
- Formation: **11 columns × 5 rows = 55** invaders, spacing 1.9 × 1.55, one row
  of squids, two of crabs, two of octopuses. **[C]**
- **4** bunkers at x = ±3.2, ±9.6, each a 22 × 16 grid of 0.115-unit cells. **[C]**
- **1** UFO. **1** player cannon. **1** player bolt in flight, max **6** bombs. **[C]**
- Hub: **14** cabinet cards on one horizontal rail, **1** playable, **13** locked. **[C]**

Nothing in `reference/` may change any line above.

---

## 1. The tonal contract — the thing that actually reads as Resogun

This is the highest-priority section. Everything else can be right and the
screenshot will still lose if this is wrong.

Measured across 26 Resogun frames, p10 … p90 **[M]**:

| Metric | p10 | median | p90 | What it means |
|---|---|---|---|---|
| frame-median linear luminance | 0.011 | **0.028** | 0.057 | Half the frame is essentially black |
| linear luminance p99 | 0.68 | **0.96** | 1.00 | The top 1 % is fully blown |
| spread (p99 ÷ p50) | 16 | **31 ×** | 76 | Enormous dynamic range in one frame |
| % of pixels below sRGB V 0.35 | 49 % | **64 %** | 86 % | Two thirds of the screen is dark |
| % near-white (all channels > 240) | 0.04 % | **0.94 %** | 7.8 % | **Under 1 % of the frame is white** |
| mean saturation of *lit* pixels | 38 % | **56 %** | 65 % | Light is coloured, not white |
| mean saturation of *dark* pixels | 49 % | **70 %** | 87 % | **The shadows are more saturated than the highlights** |

Three rules fall out, and they are the whole aesthetic:

1. **Two thirds of the frame is dark.** Target 55–75 % of pixels below sRGB
   V 0.35. If our screenshot is a bright field with dark bits, it is wrong no
   matter how good the individual elements look.
2. **Under 1 % of the frame is white.** Blowout is a punctuation mark. A build
   that reaches ~5 % white during a wave-clear is inside the envelope; one that
   sits at 5 % during ordinary play is washed out, which is exactly the failure
   the rubric's axis 3 names ("glow without washout").
3. **The dark is coloured and the light is coloured.** Both ends carry
   saturation. Neutral grey shadows are the single most common way a Three.js
   scene fails this test.

### Failure this contract prevents

`BloomPreset.js` warns that too much strength "makes a full formation of 55
invaders merge into one glowing slab". The reference's answer, visible in
`F05` and `C01`, is not *less bloom* — it is **the formation is not a light
source at all**. See §4.

---

## 2. Palette

### 2.1 The distribution rule — more important than the colours **[M]**

Bin every lit pixel (sRGB V > 0.55, saturation > 0.35) by hue into twelve 30°
bins. **The top two adjacent bins must hold 40–75 % of them** (Resogun p10…p90;
median 61 %).

Resogun is *narrow-band per level*, not rainbow: `F02` puts 65 % of its lit
pixels in 180–270°; `F03` puts 58 % in 300–30°. The constant is the narrowness.
A build that scatters cyan, magenta, lime, amber, violet and red evenly across
the frame will measure ~25 % on this metric and will read as a toybox.

**Our band: 150–210° (spring-green → cyan).** Chosen because the player, the
bolt and the grid are already cyan in `config.js` **[C]**, and because the
formation's violet is then a *complement* rather than a competing key.

### 2.2 Roles **[C]** with **[G]** proportion targets

Hex values are carried unchanged from `config.js` `PALETTE` — they were already
right, and changing them would churn frozen decisions for nothing. What is new
is the **budget**: how much of the lit-pixel area each role is allowed.

| Role | Hex | Budget (% of lit pixels) | Notes |
|---|---|---|---|
| Player cannon | `#57e2ff` cyan | — | Also the hub's primary accent |
| Player bolt core | `#66f6ff` / emissive `#9ffcff` | **35–50 %** together with the player and grid-major | The dominant band |
| Grid major line | `#57e2ff` | (in the above) | One major every 5 minor |
| Bunker | `#7dff9b` lime | 5–12 % | Sits at the low edge of our band |
| Spark / impact | `#ffe6a8` warm white → amber | 15–30 % | The complementary warm; see §6 |
| Debris | `#9fd8ff` pale blue | (mostly unlit) | Debris is *matter*, not light |
| Bomb (plunger) | `#ff3a8c` magenta | **≤ 8 % combined** | Threat only |
| Bomb (squiggly) | `#ffb545` amber | (in spark budget) | |
| Bomb (rolling) | `#ff4d5a` red | (in threat budget) | The unshootable one |
| UFO | `#ff3a8c` magenta, emissive intensity 2.0 | ≤ 4 %, and only while on screen | The single biggest hue violation on screen, on purpose — that is what makes it an event |
| Grid minor | `#1d6fa5` | 0 % — **must not bloom** | |
| Invader hulls | `#161d33` / `#1a1630` / `#24132a` | 0 % — **must not bloom** | These are albedo, not light. See §4 |

**Ruling on magenta.** In the pushsquare half of the corpus magenta is under
1 % of lit pixels; in `F03` it is a third of them. It is therefore legitimate
but must be *earned*. Here it is reserved for threat — bombs and the UFO —
which is also what makes the colour-blind variant (`PALETTE_CB`, red/cyan →
blue/amber) a straight substitution rather than a redesign. **[D]**

### 2.3 The colour of the dark — the correction the reference forces **[M]**

Sampled independently from both sources, which agree to within 2/255:

| Band | pushsquare | Housemarque | Adopt |
|---|---|---|---|
| deepest black (V < 0.06) | `#030906` | `#050a06` | — |
| shadow (V 0.10–0.22) | `#102323` | `#092125` | `#0d2224` |
| haze (V 0.22–0.42) | `#244443` | `#143c49` | `#1c4046` |

Resogun's near-black is **green-led with red crushed**, ramping to teal-cyan as
it lifts. The build's current `#05060f` is blue-violet — blue channel highest,
green almost absent. That is a real, visible, one-line difference.

**Ruling — do not apply it everywhere. [D]** Resogun's dark is a city under
atmosphere; ours is partly empty space, and a green-black void would read as a
colour bug rather than as air. Split it:

| Surface | Value | Rationale |
|---|---|---|
| Renderer clear / true void behind the stars | `#03060a` | Near-neutral, very slightly cool. The existing `#05060f` de-purpled and darkened. |
| `FogExp2` colour (`HubScene.js:48` and the game scene) | **`#0b1e22`** | This is where the teal lives. **This single change carries most of the reference's character.** |
| Arena deck / ground base albedo | `#0d2224` | Measured shadow band |
| Back wall + nebula peak brightness | `#1c4046` | Measured haze band; must stay below the bloom threshold |
| Hub boot screen / fatal overlay ground | `#05060f` → `#040c10` | Consistency with the above |

**Confounder, stated:** both sources are lossy-encoded, and the very bottom of
the tonal range is where lossy codecs are least trustworthy. Two independent
codecs agreeing is strong but not conclusive. The teal fog is the load-bearing
part and it sits at V 0.10–0.42, well clear of codec noise; the exact
`#030906` at V < 0.06 is the part to hold loosely.

---

## 3. Bloom — stated as **r182** values

The build pins `three@0.182.0`. Per the answer key under *Three.js 0.169 to
0.182*, r182 bloom is **+16.7 % in mean luminance and ~2× in the mid-halo** for
identical numeric settings versus r169, and r181 changed PBR energy
conservation so rough materials read brighter. **Every bloom or emissive number
copied from a pre-r181 source or tutorial is wrong here.** The values below are
r182 values and nothing else.

### 3.1 The acceptance criterion is the halo profile, not the parameters **[M]**

Bloom is judged by the **shape of the glow around an isolated small emitter**,
because a tight core with a long faint skirt and a broad soft mound can have
identical peak *and* mean luminance and look nothing alike. Measured on
isolated point sources in the corpus (`S01`, `C02` are the clearest):

| Radius, as % of frame height | Luminance, as fraction of core |
|---|---|
| 0.37 % | 0.77 |
| **0.74 %** | **0.50** ← half-power radius, p10…p90 = 0.37 … 1.95 % |
| 1.30 % | 0.25 |
| 2.6 % | 0.12 |
| **3.7 %** | **0.10** ← p10…p90 = 1.15 … 5.97 % |
| 5.6 % | 0.087 |
| 8.2 % | 0.070 |

Read that shape: **a very tight bright core — half-power inside 1 % of frame
height — followed by a long, low, nearly flat skirt still at ~7 % of core
brightness eight frame-height-percent away.** That is the target. Not a soft
mound, not a hard-edged sprite.

`tools/measure-frame.py` reports `halo_r_half_pct` and `halo_r_tenth_pct` on
any screenshot. **This is the gate. The three parameters below are a starting
point for hitting it, not the specification.**

### 3.2 Starting parameters **[G]**

`BloomPreset.js` `spaceInvaders`, authored against r169's narrower kernel:

```
r169 (current, frozen):   strength 0.85   radius 0.55   threshold 0.72
r182 (this spec):         strength 0.72   radius 0.38   threshold 0.72
```

- **`threshold` 0.72 — hold.** It anchors the whole emissive-authoring contract
  in §4 (must-glow ≥ 1.4, must-not-glow ≤ 0.5, threshold between). Moving it
  invalidates every emissive value in this document. It is safe to hold because
  §5 keeps almost every material below roughness 0.5, which is where r181's
  energy-conservation change bites.
- **`radius` 0.55 → 0.38 — the significant move.** `radius` blends the blur
  pyramid's mip levels; lower concentrates the composite on the finer mips.
  This is the direct counter to r181's widened kernel and r182's doubled
  mid-halo, and it is what buys the tight core the profile demands.
- **`strength` 0.85 → 0.72 — a 15 % cut**, roughly cancelling r182's +16.7 %
  mean rise. Deliberately *not* cut further, because §4 removes 55 invader
  emitters from the bloom buffer and the frame will lose real bloom source as a
  result. These two changes must be made and measured **together**; either one
  alone will look wrong.

### 3.3 Tuning order, if the profile is off **[D]**

Change one thing at a time, re-measure after each.

1. Halo too **wide**: `PostFX.bloomDivisor` is **2**, which renders bloom at
   half resolution and by itself doubles the kernel's screen-space width.
   Try `bloomDivisor = 1` **before** dropping `radius` below 0.38 — it costs
   fill rate but it is the cleanest tightening available.
2. Still too wide: `radius` down in 0.05 steps to a floor of 0.25.
3. Skirt too **faint** (`halo_r_tenth_pct` under 1.2 %): raise `strength`, not
   `radius`. Radius controls the shape; strength controls the amount.
4. Whole frame too bright (`Y_p50` over 0.06, or white over 2 % in ordinary
   play): `RendererFactory` `exposure` 1.06 → 0.95 **last**, after bloom is
   shaped. Exposure is a global fix for a local problem and using it first
   hides which parameter was actually wrong.

`PostFX.setBloom()` already exposes these live, so this is a single session
with a slider, not a rebuild loop.

### 3.4 The rest of the stack **[C]** / **[G]**

Pass order is fixed by `PostFX.js` and is correct — do not reorder. Chromatic
aberration and film grain must stay **subthreshold**: if a still frame lets you
name either effect, both are too strong. Concretely **[G]**: chromatic offset
≤ 0.0018 of screen width at the corners and zero at the centre; grain
amplitude ≤ 0.022 in sRGB. Resogun uses neither conspicuously — in the whole
corpus there is no frame where grain is visible in the near-black, and our
near-black is 55–75 % of the screen, which is exactly where grain shows worst.

---

## 4. Material language — the single biggest change

### 4.1 The rule, from `C01` and `F05` **[M]**

At magnification, every enemy hull in the reference shows the same three things:

1. A **saturated, mid-dark albedo** with visible faceted shading — light faces
   and dark faces, i.e. real PBR response to a real key light. Not flat colour.
2. A **1–2 px near-white rim** at 1080p tracing the whole silhouette. This is
   what makes a dark hull read against a dark ground.
3. **One small hot accent** per craft — an engine dot, a cockpit — that *does*
   bloom, at maybe 2 % of the hull's screen area.

**The hull itself does not bloom.** The light in `F05` belongs to the tracers,
the impact and the orbit ring; the twenty-odd enemy craft contribute none of it.

### 4.2 What this means for 55 invaders **[D]**

`config.js` currently gives every species `emissiveIntensity` 1.45–1.55, all
above `minimumGlowIntensity(0.72)` = 1.368. All 55 invaders would bloom. That
is the "glowing slab" `BloomPreset.js` warns about, arrived at by the
material authoring rather than by the bloom parameters.

**Ruling — invert it. [D]**

| Part | emissive | Blooms? |
|---|---|---|
| Invader hull body | `#161d33` / `#1a1630` / `#24132a` at intensity **0.35** | No |
| Invader silhouette rim | species emissive colour at intensity **1.05** | No — sits deliberately *just under* the 1.368 floor, so it reads bright and crisp without adding to the bloom buffer |
| Invader "eye" — one dot, ≤ 4 % of the hull's projected area | species emissive at **2.1** | **Yes** |

So a full formation contributes **55 small hot points**, not 55 glowing slabs.
That is both the reference's behaviour and the cheapest possible fix for the
named failure mode.

Keep the three species' emissive *hues* as authored (`#57e2ff` squid,
`#9d6bff` crab, `#ff3a8c` octopus) **[C]** — row identity by hue is the
classic's own readability device and the rim carries it fine at 1.05.

### 4.3 The rim, procedurally **[D]**

`MaterialLibrary.js` already patches `MeshStandardMaterial` via
`onBeforeCompile` (`applyInstanceTint`, `applyNeonBolt`, `applyScanSweep`). A
Fresnel rim term added the same way is still a `MeshStandardMaterial` and is
therefore directive-compliant. Target width **0.10–0.20 % of frame height**
(1–2 px at 1080p) **[M]**, which at our camera is **0.02–0.04 world units** —
too thin for a scaled back-face shell to hold steady, so Fresnel is the
primary implementation and the shell is the fallback only if the shader patch
fights `InstancedMesh`.

### 4.4 Roughness / metalness bands **[G]**

r181 changed indirect specular and made **rough materials (roughness > 0.5)
brighter**. Everything that must stay dark is therefore specified **below
0.5**, and the two entries above 0.5 have had their emissive cut to pay for it.

| Surface | metalness | roughness | emissive intensity | Reads as |
|---|---|---|---|---|
| Player cannon | 0.75 | **0.20** | 1.6 (trim only) | The shiniest object on screen — the eye should find it instantly |
| Invader hull | 0.60 | 0.32 | 0.35 body / 1.05 rim / 2.1 eye | Painted metal, crisp facet highlights |
| UFO | 0.85 | 0.16 | 2.2 | Chrome; the only fully hot hull |
| Bunker | 0.10 | **0.62** ⚠ | **0.30** (was 0.42 — cut to pay for r181's rough-material lift) | Chalky, eroding, the one non-metal |
| Arena deck / ground | 0.12 | 0.46 | 0 | Matte, dark, must never lift |
| Back wall / architecture | 0.00 | 0.45 | 0.05 | Silhouette |
| Nebula / backdrop plane | 0.00 | 1.00 ⚠ | **0.18** | Fills the frame, so it must contribute *nothing* to bloom. `HubScene.js` already authors its backdrop this way — copy that pattern. |
| Bolt / bomb bodies | 0.00 | 0.40 | 1.9 – 2.4 | Pure light |
| Grid minor line | 0.00 | 0.50 | 0.35 | Structure, not light |
| Grid major line | 0.00 | 0.40 | 1.9 | Light |

⚠ marks the two entries above roughness 0.5. If either reads too bright after
the r182 pass, cut its emissive before touching its roughness — roughness is
carrying the material's identity and emissive is not.

**Directive check:** every row above is a `MeshStandardMaterial`, every texture
is Canvas-API-generated via `TextureFactory` / `PBRMaps`, every geometry is
code-built via `GeometryLab`. No external file appears anywhere in this spec.

---

## 5. Background, ground and the grid floor

**Sky / void.** Clear colour `#03060a` **[D]**. Three parallax star layers,
counts 260 / 180 / 90 at scales 0.018 / 0.032 / 0.055 **[C]**. The two nearer
layers at emissive intensity 2.2 and 1.1 **[C]** — they bloom, and they are
most of the frame's isolated point emitters in a quiet moment, which is exactly
what `S01` shows the reference doing. The far layer at 0.5 does not bloom.

**Fog.** `FogExp2(0x0b1e22, 0.021)` **[D]** — the teal from §2.3 at the density
already in `HubScene.js`. This is the highest-value single line in this
document.

**Nebula.** One plane at `z = −40`, emissive `#1c4046` at intensity 0.18, `fog:
false` **[C]** pattern. It may fill a third of the frame and must contribute
zero bloom. `S02` is the reference for how much structure a haze layer is
allowed to show: shapes are readable, edges are not.

**Grid floor.** Not in the reference — Resogun has a voxel city where we have a
deck — so this is **[G]**, decided by the spec, not by an image:

- Minor lines every 1 world unit, `#1d6fa5`, emissive 0.35 → invisible to bloom.
- Major line every 5th, `#57e2ff`, emissive 1.9 → blooms as a thin bright line.
- The grid fades into the fog by `z = −12`; the horizon must be fog, never a
  visible plane edge. `S02` is the fidelity reference for that transition.
- `GRID_SWEEP_SPEED 0.06`, `GRID_PULSE_DECAY 3.2` **[C]** — a slow emissive
  sweep, plus a pulse driven by `FORMATION.stepPeriod`. As the formation thins
  and accelerates, the floor pulses faster. Nobody notices; everybody feels it.

---

## 6. Particles

### 6.1 Scale **[M]** → **[D]**

Median bright-feature width in the reference is **4–6 px at 1080p = 0.37–0.56 %
of frame height**; p95 is ~45 px = 4 %. Converted at 0.208 world units per
percent:

| Class | World size | % frame height | Reference |
|---|---|---|---|
| Spark | **0.08 – 0.13** | 0.4 – 0.6 % | `F06`, `F08` — the amber field |
| Debris chunk | **0.10 – 0.18** | 0.5 – 0.9 % | `F08` |
| Impact core (largest single element) | **≤ 0.85** | ≤ 4 % | `F07` |
| Player bolt width | 0.11 **[C]** | 0.53 % | Already correct — no change |

The bolt's existing `RADIUS 0.055` lands on the reference's median lit-feature
width to within a tenth of a percent. Independent corroboration that the
frozen `config.js` scale decisions were sound.

### 6.2 Lifetime character **[G]**

Two classes, because `F08` shows two behaviours — light that dies fast and
matter that falls.

- **Sparks** — 0.18–0.45 s. Emissive 3.0 → 0 over life on a squared curve
  (bright for the first third, then gone). Fast, decelerating, no gravity.
  These are *light*.
- **Debris** — 0.9–1.6 s. Emissive constant at 0.6 (below the bloom floor:
  debris is lit matter, not a light source) then faded over the last 0.25 s.
  Gravity, one bounce off `FLOOR_Y = −9.9` at 0.35 restitution, tumbling.

The visible signature of getting this right: **an explosion's light is gone
before its debris is.** In `F07` the white core has already died where the
voxel chunks are still in flight.

### 6.3 Budget against the 500 cap **[D]**

| Pool | Cap | Why |
|---|---|---|
| Sparks | 320 | The bulk; short-lived, so turnover is high |
| Debris | 140 | Long-lived, so this is the pool that actually stays full |
| Reserve | 40 | Never allocated by routine events, so a player death can always spend |
| **Total** | **500** | Mission-directive hard cap |

**The reconciliation that matters.** The reference frames carry roughly
20 000 distinct bright horizontal runs each — one to two orders of magnitude
past 500 particles. We cannot and must not try to match that with the particle
manager. Density comes from geometry that is **not** particles:

- 530 stars across three `Points`/`InstancedMesh` layers **[C]**
- 4 × 22 × 16 = **1 408** bunker cells as `InstancedMesh` **[C]**
- 55 invaders as `InstancedMesh` **[C]**
- the grid floor's lines

That is ~2 000 individually-lit elements before a single particle is spawned,
which is the right order. A build that tries to buy density from the particle
system will hit the cap, thrash the pool, and still look sparse. **Stated
plainly so nobody re-derives it under deadline.**

---

## 7. Glassmorphism overlay

The directive mandates it; the reference does not have it (Resogun's HUD is
bare glowing glyphs on the scene — see the "POWER UP" label in `F01`). So this
section is **[G]** throughout, disciplined by one borrowed rule: in `F01` the
HUD occupies under 4 % of the frame and sits at the far edge. Glass that eats
the playfield loses to Resogun on sight, however pretty it is.

### 7.1 Token set

Replacing the blue-violet tokens in `shared/ui/glass.css` with the teal ramp
from §2.3. Structure, blur and radius are unchanged — only the hue moves.

```css
:root {
  /* Surfaces — teal-shifted to sit on the §2.3 ramp */
  --glass-bg:            rgba(9, 26, 30, 0.44);
  --glass-bg-strong:     rgba(6, 18, 22, 0.80);
  --glass-border:        rgba(120, 220, 235, 0.18);
  --glass-border-bright: rgba(140, 240, 255, 0.38);
  --glass-blur:          18px;   /* panels */
  --glass-blur-sm:       12px;   /* pills and chips — 18px is wasted fill rate */
  --glass-radius:        14px;
  --glass-radius-sm:      9px;
  --glass-radius-pill:  999px;
  --glass-saturate:      160%;   /* keep: this is what makes glass over neon read as glass */
}
```

Backdrop filter is always `blur(var(--glass-blur)) saturate(var(--glass-saturate))`
with the `-webkit-` twin, on both properties, every time.

Neon accent triples are carried unchanged from `glass.css` **[C]** —
`--neon-cyan-rgb: 87,226,255`, `--neon-magenta-rgb: 255,58,140`,
`--neon-lime-rgb: 154,255,122`, `--neon-amber-rgb: 255,186,84`,
`--neon-violet-rgb: 173,122,255`, `--neon-red-rgb: 255,88,88`. Authoring them
as raw triples is right and stays.

### 7.2 The glow ladder — exactly three tiers, never a fourth

```css
--glow-1: 0 0  8px rgba(var(--A), 0.55), 0 0 24px rgba(var(--A), 0.22);
--glow-2: 0 0 10px rgba(var(--A), 0.75), 0 0 30px rgba(var(--A), 0.38),
          0 0 72px rgba(var(--A), 0.14);
--glow-3: 0 0 10px rgba(var(--A), 0.75), 0 0 34px rgba(var(--A), 0.40),
          0 0 80px rgba(var(--A), 0.16);
```

- **Tier 1** — resting neon text, status pills, `kbd` chips.
- **Tier 2** — the focused or selected element. **At most one on screen.**
- **Tier 3** — the hub title only. This is the existing `.hub-title` shadow
  unchanged **[C]**; it was already correct and becomes the ladder's top rung.

Hard limits: never more than **3** shadow stops, never a blur radius over
**80 px**, and never animate `box-shadow` — it repaints every frame, and
`glass.css` already says so **[C]**. Animate `opacity` on a pseudo-element
carrying the glow instead.

### 7.3 Area budget

- Total glass surface **≤ 18 %** of the viewport during play.
- **0 %** inside the centre 50 % × 50 % of the screen during play. `glass.css`
  rule 1 already states this **[C]**; it is repeated here because it is the
  rule most likely to be broken by a well-meant HUD.
- Floating score text is exempt — it is transient and it *is* the juice.

---

## 8. The hub — cabinet cards, and "coming soon" vs. "broken"

The hub is the first thing anyone sees, so it is inside the visual gate. It also
contains the ticket's specific unresolved question: `hub.css` ships an unused
`.cabinet__status--scheduled` rule, implying a per-card status line that was
never wired up. **[C]**

**Ruling: wire it up, and make it mandatory on every card.** All **[G]**.

### 8.1 The seven rules for a locked card

A dimmed card is ambiguous by default: "off on purpose" and "failed to load"
look identical. Each rule below removes one way of reading it as broken.

1. **Opacity 0.46 → 0.70.** `hub.css` currently sets `.cabinet--locked
   { opacity: 0.46 }` **[C]**. Below roughly 0.6 the title stops reading as text
   and starts reading as a failed render. 0.70 reads as *off*.
2. **Kill the colour, not the card.** The accent bar gets
   `filter: grayscale(1); opacity: 0.35; box-shadow: none`. Colour is the
   reward for being playable, and exactly one card in the rail gets it.
3. **Title in `--text-secondary`, not the accent.** So the rail has exactly one
   coloured title. The lit cabinet is found instantly, without an arrow.
4. **A status pill on every card, no exceptions.**
   - Playable: text `PLAYABLE`, colour `--neon-lime`, `1px solid currentColor`,
     `--glow-1`.
   - Locked: text `COMING SOON`, colour `--text-dim`, **`1px dashed
     currentColor`**, no glow. A dashed border is the cheapest unambiguous
     "placeholder, on purpose" signal in the whole CSS vocabulary, and it is
     the entire difference between *off* and *broken*. This is what
     `.cabinet__status--scheduled` becomes.
5. **Hover must do something.** `.cabinet--locked:hover` currently kills the
   transform and leaves nothing **[C]**. Silence reads as a dead element. Add
   `border-color: var(--glass-border-bright)` over `--dur-med`, no transform,
   and keep `cursor: not-allowed`. The card acknowledges the pointer and
   declines — which is a *state*, not a failure.
6. **Keep the difficulty stars at full amber.** They are real information about
   a real planned entry. Dimming them says "we have nothing here"; leaving them
   lit says "this one is spec'd, it just isn't built".
7. **Never leave an empty preview area.** If a card gets a thumbnail slot, a
   locked card fills it with flat `--glass-bg-strong` and a centred dim lock
   glyph. An empty box is the most convincing broken-menu signal there is.

### 8.2 The attract scene

`HubScene.js` uses the `deepSpace` bloom preset (strength 0.95 / radius 0.78)
**[C]**, authored against r169. At r182 that radius is the widest in the whole
preset table and will read as haze, not as stars.

**Ruling [G]:** the attract scene must pass §1 and §3 like any other frame.
Starting point `strength 0.80 / radius 0.55 / threshold 0.68`, then measured
with `tools/measure-frame.py` exactly as the game is. The hub is not exempt
from the visual target because it is chrome; it is the first frame anybody
sees, which makes it the *most* exposed.

The hub scene's fog changes to `#0b1e22` with everything else (§2.3).

---

## 9. What I am confident about, and what I am not

Stated plainly, because a spec that hides its own uncertainty is worse than a
vague one.

**High confidence — measured, corroborated across two independent sources.**
- The tonal contract in §1. Every number, all 26 frames, both sources agreeing.
- The narrow-hue-band rule in §2.1 — and it is corroborated *by a
  contradiction*, which is the strongest form: the two halves of the corpus
  disagree about the hue and agree about the narrowness.
- The halo profile in §3.1. Two ways of measuring it (hand-picked emitters,
  then an automated isolation test) landed on 0.74 % half-power independently.
- The material language in §4.1. Visible directly in `C01` at magnification;
  not an inference.
- The particle scale in §6.1, and the fact that reference density cannot come
  from a 500-particle budget (§6.3).

**Medium confidence — measured but with a caveat.**
- The green-led near-black in §2.3. Two independent lossy codecs agreeing is
  strong, but it is the one measurement taken where codecs are least reliable.
  The teal *fog* (V 0.10–0.42) is safe; the exact deepest-black hex is not.
- The split of that finding between fog and void. That is my judgement call
  about our different subject matter, not something an image showed me.

**Best guess — needs one tuning pass with a slider and a screenshot.**
- The three bloom numbers in §3.2. I could not run three.js r182 here, so
  0.72 / 0.38 / 0.72 is arithmetic on the answer key's measured deltas plus a
  judgement about §4 removing 55 emitters. **The halo profile is the gate; these
  numbers are only a starting point.** The direction — lower strength, notably
  lower radius — is what the answer key independently predicted, which is
  reassuring but is not verification.
- Every roughness/metalness value in §4.4. Reasoned from the reference's
  *appearance* plus r181's energy-conservation change; none was measured off a
  material.
- The whole of §7 (glassmorphism) and §8 (hub cards). The reference has no
  glassmorphism and no cabinet select. These are directive-driven design
  decisions, disciplined by the reference only through the area budget and the
  colour ramp. The seven locked-card rules are craft judgement — defensible,
  but not derived from anything measured.
- Chromatic aberration and grain amplitudes in §3.4.

**What the images do not show and I did not infer.**
- Anything about our layout, camera, subject matter or counts — barred by the
  tier split in `manifest.md`.
- Motion. Everything here was measured on stills. Trail length, hit-stop
  duration, shake decay and the *timing* of the six mandated VFX are outside
  this spec and belong to the playability gate.
- Audio. Out of scope here; see the ticket `Audio in the done bar`.
