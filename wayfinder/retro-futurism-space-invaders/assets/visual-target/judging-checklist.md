# Judging checklist — our screenshot beside Resogun, blind

For a critic who is **not allowed to read the code**. Every item is answerable
by looking at two images side by side. Each has a numeric backstop from
`tools/measure-frame.py` for when eyes disagree, but the eye goes first — the
numbers exist to settle arguments, not to replace the judgement.

## How to run it

1. Capture our frame at **1920 × 1080**, in the same game state as the
   reference plate you are comparing against (busy vs. quiet — do not judge a
   quiet frame against `F07`).
2. Put it beside the plate at the same size on the same screen.
3. Walk the items **in order**. Items 1–4 are the ones that decide the
   comparison in the first two seconds; if any of them fails, fixing item 11
   is wasted work.
4. Then run `python tools/measure-frame.py ourshot.png` and check the flagged
   metrics against the envelope.

A failure is a specific sentence — *"the invader formation is a single glowing
mass where the reference's formation is dark hulls with white edges"* — never
a score.

---

## Tier 1 — decides it in two seconds

### 1. Squint at both. Which one is darker?

Blur your eyes until shapes go. The reference collapses to **a mostly-black
field with a few intense coloured blobs**. If ours collapses to an evenly
bright field, or to a grey wash, we have lost and nothing below matters.

- **Fail looks like:** an even mid-grey. A visible "lit room" quality. Being
  able to see the ground plane across the whole frame.
- **Backstop:** `pct_dark_V_lt_035` in **49–86 %** (ref median 64 %).
  `Y_p50` in **0.011–0.057**.
- **Plates:** `S01`, `S03` (quiet); `F05` (busy).

### 2. Where is the white — is it a punctuation mark or a wash?

In the reference, near-white is a **tiny fraction of the frame**, always at the
core of something violent, and it has an obvious cause you can point at. Even
`F07` (peak destruction, the busiest frame in the corpus) is only 1.7 % white.

- **Fail looks like:** white haze in the *background*. Emitters that have gone
  white all over instead of white-cored-and-coloured-outward. Being unable to
  point at what caused a given white region.
- **Backstop:** `pct_white_240` under **2 %** in ordinary play, under **8 %**
  at a wave-clear or player death. Over 8 % is washout.
- **Plates:** `F07` is the ceiling; `S01` is the floor.

### 3. The shape of one glow

Find one small isolated bright thing in each image — a star, an engine dot, a
lamp. Compare the *shape* of what surrounds it, not its brightness.

The reference glow is **a very tight bright core with a long, faint, almost
flat skirt**: it halves within about 1 % of the frame's height, then trails off
so gradually you can still see it 8 % away.

- **Fail looks like:** a soft round mound with no hard centre (`radius` too
  high, or `bloomDivisor` costing resolution) — the commonest failure. Or the
  opposite: a hard-edged dot with no skirt at all (bloom effectively off, or
  emissive below the threshold).
- **Backstop:** `halo_r_half_pct` in **0.37–1.95 %** (ref median 0.74),
  `halo_r_tenth_pct` in **1.15–5.97 %** (ref median 3.71).
  `halo_n_emitters` of 0 means nothing small in our frame is glowing at all.
- **Plates:** `C02` is the magnified reference for exactly this.

### 4. Is the dark coloured?

Look into the darkest region of each image and ask what colour it is. The
reference's dark is **not neutral** — it is a green-teal, and it is *more*
saturated than the bright areas.

- **Fail looks like:** neutral grey-black shadows. A blue-violet cast (the
  build's `#05060f` default). Any dark region you would describe as "grey".
- **Backstop:** `sat_dark_pct` in **49–87 %** and — this is the giveaway —
  **`sat_dark_pct` should exceed `sat_lit_pct`.** If the shadows are less
  saturated than the highlights, the fog colour is wrong.
  `shadow_hex` should sit near `#0d2224`, not `#05060f`.
- **Plates:** `S02`, `C02`.

---

## Tier 2 — the subject matter

### 5. Count the hues. Is it a band or a rainbow?

Name the colours of the light in each image. The reference gives you **two
adjacent hues plus one small warm accent**, and that is all. `F02` is
cyan-blue-violet; `F03` is red-orange-magenta. Neither is both.

- **Fail looks like:** cyan *and* magenta *and* lime *and* amber *and* violet
  all present in comparable amounts. It reads as a toybox, not as a world with
  a light source.
- **Backstop:** `hue_top2_pct` in **40–75 %** (ref median 61). Below ~35 % is a
  rainbow. `hue_dominant_deg` should be **150 or 180** for our chosen band.
- **Plates:** `F02` and `F03` together — they disagree on the hue and agree on
  the narrowness, which is the point.

### 6. The formation: dark hulls, or one glowing slab?

This is the item most likely to fail, and the one our subject matter makes
uniquely dangerous — 55 objects in a tight lattice.

In `F05` and `C01` the enemy craft are **lit matter**: saturated mid-dark
bodies with visible light and dark faces, sitting in the frame's shadow range.
They do not contribute glow. The light around them belongs to projectiles and
impacts.

- **Fail looks like:** the 11 × 5 lattice merging into a single luminous
  rectangle. Individual invaders that are indistinguishable at a glance. A
  formation that is the brightest thing in the frame.
- **Answerable by looking:** can you count the invaders in the third row?
  Can you see a dark gap between two adjacent invaders? If either answer is
  no, the hulls are emitting.
- **Plates:** `F05`, `F06`, `C01`.

### 7. Do the silhouettes have edges?

Zoom in on one enemy in each image. The reference hull has a **thin near-white
line tracing its whole outline**, roughly one to two pixels at 1080p, plus one
small hot accent (an engine dot).

- **Fail looks like:** a hull that dissolves into the background at its edge. Or
  the overcorrection: a thick glowing outline that has itself become the light
  source, which fails item 6 by a different route.
- **Answerable by looking:** trace the silhouette with your eye. Is there a
  continuous bright line, and is it *thin*?
- **Plates:** `C01` — this is the plate that exists for this question.

### 8. Particle scale: dust, or confetti?

Compare the size of the smallest bright things. In the reference the median lit
feature is **under 0.6 % of the frame's height** — genuinely small — and there
are a great many of them.

- **Fail looks like:** a dozen large soft blobs standing in for an explosion.
  Or particles so large they read as geometry. Or the frame simply being empty
  of small detail, which is the 500-cap failure: a build that tried to buy
  density from the particle system and ran out.
- **Answerable by looking:** hold a fingernail against the screen. In the
  reference, many bright things are smaller than it. In ours?
- **Plates:** `F06` (the amber spark field), `F08` (debris in isolation).

### 9. Does the light die before the matter does?

Needs two frames, or a video, so it is the one item here that is not strictly a
still. Capture just after an invader dies, and again half a second later.

The reference's signature: the **white core is already gone while the debris
chunks are still in flight**. Light is transient; matter falls and settles.

- **Fail looks like:** glowing debris that stays hot for its whole life — every
  fragment a light source, so a busy moment turns into a wash. Or debris that
  vanishes with the flash, so an explosion has no aftermath.
- **Plates:** `F07` (core alive), `F08` (matter without light).

---

## Tier 3 — composition and chrome

### 10. Is there one place for the eye to go?

Each reference frame has an obvious focal point and an obvious hierarchy. Cover
the brightest region with your thumb; the frame should become legibly quieter,
not merely differently busy.

- **Fail looks like:** three or four competing bright regions of equal weight.
  Uniform interest across the frame. The player's ship not being findable in
  under a second — in `F01` and `F05` you find it immediately, because it is
  the shiniest object present.
- **Answerable by looking:** time yourself finding the player.

### 11. Does the chrome eat the playfield?

Look at our HTML overlay beside `F01`, whose entire HUD is a thin coloured
label at the frame's edge occupying under 4 % of it.

- **Fail looks like:** glass panels in the centre of the screen. A four-corner
  dashboard. Any panel large enough that you read it before you read the game.
  Frosted glass so opaque that the playfield behind it has gone.
- **Answerable by looking:** is the centre half of the screen free of chrome?
  Can you see the game through every piece of glass on it?
- **Backstop:** total glass surface under ~18 % of the frame; zero glass inside
  the centre 50 % × 50 % during play.

### 12. Do the glows on the UI match the glows in the scene?

Compare a neon UI accent against a neon object in the 3D scene. They should
look like the same lighting model — same tightness, same falloff.

- **Fail looks like:** CSS `text-shadow` glows that are much softer and wider
  than the scene's bloom, so the UI reads as a sticker on top of the render.
  Four or five different glow strengths across the overlay, with no ladder.
- **Answerable by looking:** squint at the whole composite. Does the UI belong
  to the same world?

---

## Tier 4 — the hub, judged on its own

The hub is the first frame anyone sees, so it takes items 1–5 and 10–12
unchanged. These four are additional.

### 13. Can you find the one playable cabinet without being told?

One card in fourteen is live. It should be findable in **under a second**,
because it is the only one with a coloured title and a lit accent bar.

- **Fail looks like:** having to read the cards to work out which one works.
  Fourteen equally coloured accents.

### 14. Do the thirteen locked cards read as *scheduled* or as *broken*?

The single question this ticket was written to answer. Show the hub to someone
who knows nothing about the project and ask: *"is this menu working?"*

- **Coming soon reads as:** the card is fully present and legible; it carries a
  visible status pill saying so, with a **dashed** border; its difficulty stars
  are still lit; its colour has drained but its structure has not.
- **Broken reads as:** cards so dim you assume a render failed. A card with an
  empty region where something should be. No status text at all. Hovering and
  getting no response whatsoever.
- **Answerable by looking:** is there a status pill on *every* card? Is the
  locked pill's border dashed? Can you read every locked card's title without
  leaning in?

### 15. Does hovering a locked card acknowledge you?

Point at a locked card. Something must change — a border brightening is
enough — and the cursor must become `not-allowed`.

- **Fail looks like:** absolutely nothing happens. An unresponsive element is
  indistinguishable from a dead one, and this is exactly the case where the
  gate must not mistake correct behaviour for a dead button.

### 16. Does the attract scene pass items 1–4 on its own?

It uses a different bloom preset from the game and is easy to forget. Run
`measure-frame.py` on a hub screenshot exactly as on a gameplay screenshot.

- **Fail looks like:** a hazy grey starfield instead of hard points — the
  classic symptom of a wide bloom `radius` carried over from r169.

---

## Scoring note

There is no score here on purpose. The output of this checklist is **a list of
named failures with the plate that proves each one**, ranked by tier. Tier 1
failures are fixed before any Tier 3 item is looked at, because a Tier 1 failure
makes the Tier 3 items unjudgeable.

If nothing in Tier 1 or Tier 2 fails, the honest verdict is: *a critic putting
these side by side would not immediately know which is which* — which is the
bar, and is a much stronger claim than any number out of 5.
