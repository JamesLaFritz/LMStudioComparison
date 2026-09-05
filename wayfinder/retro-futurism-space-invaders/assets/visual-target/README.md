# The visual target

Answers the ticket `The visual target` in
`wayfinder/retro-futurism-space-invaders/map.md`: what "AAA Retro-Futurism"
concretely means for this build, stated so a harsh critic can judge a
screenshot against it without reading a line of code.

**The bar is Housemarque's *Resogun* (2013).**

| File | What it is | Read it when |
|---|---|---|
| `visual-spec.md` | **The specification.** Palette hexes and their roles, r182 bloom parameters, emissive / roughness / metalness bands, background and fog, particle scale and lifetime, the glassmorphism token set, the hub's card treatment. Every number tagged with where it came from and how much to trust it. | Before authoring any material, tuning bloom, or touching `glass.css` / `hub.css`. |
| `judging-checklist.md` | **The gate.** Sixteen items in priority order, each answerable by looking at two images side by side, each with a numeric backstop. | When a screenshot exists and someone has to say whether it is good. |
| `manifest.md` | The reference pack's provenance, the two-tier authority split, and the congruence pass. | Before letting any image in `reference/` constrain a decision. |
| `reference/` | Thirteen Resogun plates (five first-party, six press capture, two derived crops) plus `measurements.csv` for all 26 frames measured. | As fidelity reference only — never for layout, counts or subject matter. |
| `tools/measure-frame.py` | Turns a screenshot into the ten numbers the spec gates on, with the reference envelope printed beside each. Needs `pillow` and `numpy`, nothing else. | Every time. `python tools/measure-frame.py shot.png` |

## The one-paragraph version

The frame is **two thirds dark**, and the dark is **teal and saturated**, not
grey. Under **1 %** of it is white. The light is **narrow-band** — two adjacent
hues plus a warm accent, not a rainbow — and it comes from **many small hard
point sources** whose glow has a **tight core inside 1 % of frame height and a
long faint skirt**. The 55 invaders are **lit matter, not light**: dark hulls
with a thin white rim and one hot eye each. Bloom is re-tuned for **r182**,
where the same numbers glow ~17 % brighter and about twice as wide as they did
at r169.

## The four things a builder is most likely to get wrong

1. Making the invader formation emissive. It is the named failure mode
   (`BloomPreset.js` calls it "one glowing slab") and the fix is in the
   *material*, not the bloom parameters. → `visual-spec.md` §4.
2. Copying bloom numbers from anything written before three.js r181. → §3.
3. Leaving the fog blue-violet. → §2.3.
4. Trying to buy the reference's particle density out of the 500-particle
   budget. It comes from `InstancedMesh`, not from the particle manager. → §6.3.
