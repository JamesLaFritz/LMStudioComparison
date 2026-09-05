# Reference pack — Housemarque's *Resogun* (2013, PS4)

The bar for "AAA Retro-Futurism" in this build. Gathered 2026-09-05.

## Authority — read this before using any image here

Per `remakebench-skills:reference-pack-authority`, a pack is two tiers with
different powers, and the split here is unusual because **the reference is a
different game**.

| Tier | What it is | What it may decide | What it may NOT decide |
|---|---|---|---|
| **SPEC** | `visual-spec.md` and `reference/measurements.csv` — text and numbers | Everything about our layout, counts, sizes, colours and parameters | — |
| **FIDELITY** | the images in `reference/` | Only *"could you tell which screenshot is the game?"* — light quality, tonal structure, material read, particle character | Nothing about our layout, counts, positions or subject matter |

**The tiebreak, stated so a judge can quote it:** *Resogun is a horizontal
cylinder-world twin-stick shooter. We are building Space Invaders. Where an
image disagrees with `visual-spec.md` about what is on screen, where it is, or
how many there are, the spec wins and the disagreement is **not** a defect in
the build.* A judge must never report a layout defect sourced from these images.

Concretely, these images are **not** authority for: the camera being horizontal
or cylindrical; a scrolling city backdrop; voxel destruction of the environment;
humans to rescue; a boost/overdrive mechanic; enemy ship silhouettes; or the
HUD's layout. They *are* authority for how dark the dark is, how tight the glow
is, what the light is coloured, and how a lit hull reads against that dark.

**The spec exists as text.** Every quantity that matters is a number in
`visual-spec.md` or a row in `measurements.csv`. Nothing here is defined by an
image "implying" it, and nothing may be scaled off a screenshot.

## Provenance and independence

Two independent sources, deliberately. `hm_*` frames are **first-party** —
Housemarque's own press capture, so they show the game as its authors chose to
present it. `ps_*` frames are third-party press capture from a different site
with a different re-encode pipeline. Where the two agree on a measurement (they
agree on frame-median luminance to within 20 % and on the colour of the near-
black to within 2/255 per channel) the finding is not an artefact of one
site's compression. Where only one source shows something, it is flagged below.

**All measurements were taken on the originals downloaded from the URLs in the
table.** The copies in `reference/` are re-encoded working copies (JPEG q92) and
will measure a hair differently. `measurements.csv` is keyed by *original*
filename; the mapping is in the table.

## The images

`reference/`, prefix meaning: **F** = fidelity plate in a busy/lit state,
**S** = fidelity plate in a quiet/dark state, **C** = derived close-up crop.

| Shipped as | Original | Source URL | Authoritative for |
|---|---|---|---|
| `F01-hm-level3-formation-and-hud.jpg` | `Level3_1-1600x900.png` | https://images.squarespace-cdn.com/content/v1/5bfd4f00710699387b6a460a/1543922849597-IN1ODDSOI3Z0V62Q9GW5/Level3_1-1600x900.png | **The single most important plate.** An enemy *formation* of ~14 craft, a player ship with a beam, an amber enemy cluster, and an in-world HUD label — the closest thing in the corpus to our subject. Authoritative for: a formation reading as low-key lit hulls against a dark ground while the *projectiles* carry the light; the thin light rim on every hull; HUD text as thin coloured glyphs with a glow and no panel behind them. |
| `F02-hm-level4-cyan-key.jpg` | `Level4_5-1600x900.png` | https://images.squarespace-cdn.com/content/v1/5bfd4f00710699387b6a460a/1543922942131-D3QX0QEU6AP02Y7JYI1I/Level4_5-1600x900.png | The **per-level hue key**: 65 % of lit pixels fall in 180–270° (cyan→blue→violet). Authoritative for "the palette is narrow, not a rainbow". |
| `F03-hm-level5-magenta-key.jpg` | `Level5_5-1600x900.png` | https://images.squarespace-cdn.com/content/v1/5bfd4f00710699387b6a460a/1543922984930-LJ2W7GK5ISQKW23UQWRE/Level5_5-1600x900.png | The **opposite** hue key — red/orange + magenta, essentially no cyan. Proof the narrow-band rule is the constant and the specific hue is not. Also the best plate for a large translucent emissive volume (the red sphere) sitting *behind* the action without washing it out. |
| `F04-hm-protector-mode.jpg` | `Protector-Mode-Screenshot-1600x900.png` | https://images.squarespace-cdn.com/content/v1/5bfd4f00710699387b6a460a/1543922988522-CTHMGZ06IK0J0F2BYI29/Protector-Mode-Screenshot-1600x900.png | A second first-party frame at a different intensity, used only as corroboration in `measurements.csv`. |
| `F05-formation-lowkey-against-dark.jpg` | `ps_53886.jpg` | https://images.pushsquare.com/screenshots/53886/large.jpg | **Formation material language.** Blue-violet hulls with yellow accent bands and white rims, clearly *lit* rather than emissive — they do not bloom. The light in the frame belongs to the green tracers, the cyan impact and the blue orbit ring. This is the plate that kills "make every invader glow". |
| `F06-formation-dense-plus-kill.jpg` | `ps_53895.jpg` | https://images.pushsquare.com/screenshots/53895/large.jpg | A dense 20-craft formation *plus* a kill blowout in the same frame. Authoritative for: how a single white-cored explosion coexists with an unbloomed formation; amber spark field scale and clustering. |
| `S01-quiet-frame-isolated-emitters.jpg` | `ps_53875.jpg` | https://images.pushsquare.com/screenshots/53875/large.jpg | **The bloom halo profile** and the idle/attract state. 88 % of this frame is below sRGB V 0.35; the light is a dozen isolated point sources, each with a tight core and a long faint skirt. The primary source for `halo_r_half_pct` / `halo_r_tenth_pct`. |
| `S02-dark-frame-haze-and-silhouette.jpg` | `ps_53884.jpg` | https://images.pushsquare.com/screenshots/53884/large.jpg | Atmospheric haze and near-black architecture-as-silhouette. Authoritative for the fog treatment and for how much structure may be legible in shadow. |
| `S03-extreme-dark-single-streak.jpg` | `ps_53888.jpg` | https://images.pushsquare.com/screenshots/53888/large.jpg | The darkest frame in the corpus — 55 % of pixels below sRGB V 0.10. Authoritative for the *floor*: how black the game is willing to go, and that a single violent streak is enough to carry a frame. |
| `F07-peak-destruction-white-core.jpg` | `ps_53883.jpg` | https://images.pushsquare.com/screenshots/53883/large.jpg | Peak destruction. Authoritative for the ceiling on white blowout (1.7 % of pixels here) and for debris density: ~22 000 distinct bright horizontal runs, median 5 px wide at 1080p. |
| `F08-debris-cloud-amber.jpg` | `ps_53892.jpg` | https://images.pushsquare.com/screenshots/53892/large.jpg | Debris colour and scale in isolation: thousands of small amber chunks, most of them *not* hot, a minority blown out. Authoritative for "debris is lit matter, sparks are light". |
| `C01-crop-hull-rim-outline.jpg` | crop of `ps_53895.jpg` @ (120,220)–(760,780), nearest-neighbour ×1.5 | derived — see `F06` row | The **rim**. At this magnification the 1–2 px near-white outline tracing every hull silhouette, the faceted PBR shading inside it, and the single hot engine dot per craft are all unambiguous. |
| `C02-crop-point-source-halo.jpg` | crop of `ps_53875.jpg` @ (1050,20)–(1920,420), ×1.2 | derived — see `S01` row | The **glow shape** at magnification: black silhouette architecture carrying small saturated emissive strips, plus orange orb lamps whose halo is tight and whose skirt is long and faint. |

`reference/measurements.csv` — every metric in `visual-spec.md`, per frame, for
all **26** frames measured, generated by `tools/measure-frame.py --csv`. It
includes 15 frames not shipped as images (`ps_53876..53896` minus the six above,
plus `hm_level2_3` and `hm_level3_1`); their URLs follow the same two patterns:
`https://images.pushsquare.com/screenshots/<id>/large.jpg` for ids 53875–53896
(53880 does not exist), and the Housemarque CDN paths listed on
https://housemarque.com/games/resogun.

## Congruence pass

Run before any of this was allowed to constrain the build, per the skill.

1. **Counts.** No countable landmark is imported from the reference — our
   counts (11×5 formation, 4 bunkers, 1 UFO, 14 cabinets) come from
   `config.js` and `GameRegistry.js` and are restated in `visual-spec.md`. The
   pack cannot contradict them because it is not allowed to speak to them.
2. **Route / layout topology.** Not applicable and deliberately so — see the
   tiebreak above. Resogun's cylinder world has no counterpart here and the
   pack is barred from layout authority precisely to stop one being invented.
3. **Elevation / spatial definition.** Our arena is already fully specified as
   text in `config.js` `ARENA` (30 × 22 units, named Y rails for player, kill
   line, floor and UFO). **Not undefined** — this is the state the skill warns
   about, and it is already closed.
4. **Scale-bar audit.** No plate here is technical and none carries a scale
   bar, so nothing may be measured off an image *in world units*. All
   image-derived quantities are expressed as **fraction of frame height**,
   which survives resolution changes and is the only scale these images can
   honestly support.
5. **Internal contradictions found, and their rulings.**
   - *Hue.* The pushsquare set (levels 1–4) put 45 % of lit pixels in
     150–210° and under 1 % in 270–330°, which reads as "magenta is never a
     light colour". `F03` (level 5) flatly contradicts that: 58 % of its lit
     pixels are in 300–30°. **Ruling:** the constant is *narrowness* (top two
     adjacent 30° bins hold 40–75 % of lit pixels), not the specific hue.
     Recorded in the spec as a rule about distribution shape, not colour.
   - *Colour of the dark.* Both sources agree the near-black is green-led with
     red crushed (#030906 vs #050a06), which contradicts the current build's
     blue-violet `#05060f`. **Ruling:** believe it, but only for fog and
     shadowed matter, not for the true void — see `visual-spec.md` §3. Flagged
     as the one measurement with a plausible codec confound (both sources are
     lossy, and the very bottom of the range is where lossy codecs are least
     trustworthy).
6. **Circularity.** None. Every number in `visual-spec.md` that came from an
   image was measured off imagery this project did not produce, before any of
   our own frames existed. Where a number came from our own `config.js`
   instead, the spec says so in the table's *source* column.

## Non-authoritative

Nothing in this directory is a generation prompt, and none was used — these are
captures of a shipped commercial game, not generated concept art. That removes
the skill's biggest trap (a superseded brief outranking the plates) but adds a
different one: **these frames are not ours and cannot be regenerated.** If a
contradiction is found that a reissue would normally fix, the fix is a ruling in
`visual-spec.md`, not a new image.

Held for internal art-direction reference only.
