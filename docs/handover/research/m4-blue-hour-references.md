# M4 reference sheet: Blue hour (Research phase, D20; s17, 2026-11-19)

I looked again at the owner's photos for this place (`plankton` 1–6 and videos 1–3, `night-sky-and-moon` 1–8,
`cove-and-stacks` 6, 8, 12) as contact sheets made with `_tools/sheets.py` (kept outside git). Then I put them beside
the approved render (`out3/bluehour_hybrid_vivid.jpg`) and the live stop at HEAD 2e88b09
(`.superpowers/m4/before/mid.png`, `low.png`, local).
`owner-references.md` §6, §10, §13 and the reference book §1, §3, §6, §8 stay the long versions. This sheet is what
M4 builds against. I did no web search: the research folder already covers plankton and stars
(`milestones-m3-m10.md` "M4").

## What the live stop is today (HEAD 2e88b09, mid; low looks the same)

| Element | Render has | Live has | Gap |
|---|---|---|---|
| Arch | the lopsided arch, 175 m out, framing the afterglow | the same arch (M2.5), a clean silhouette | it is never overhead: no part of the journey goes near it |
| Stacks | scrub caps on every top (coast.py `build_caps`: the searsia shrub, 14 per top, 1.6–3.2 m) | bare tops, cut flat or spired | no caps at all |
| Water | ankle-deep flats, a mirror broken by slow ripples, blue sparks in drifts | a perfect mirror; at mid its edges are stair-stepped (low-resolution mirror) | no ripples (Beaufort 0), no plankton |
| Stars | many faint stars in the dark upper left, none in the glow | a few, hard to find | not dense; the same size whatever their brightness |
| Fallen blocks under the arch | one low rock in the glow | five box-like blocks on the shelf | they read as boxes |
| Sky | violet to rose, a soft glow behind the arch | the same sky picture, a hot glare at the arch's right foot | the glare is a little strong for a sun 6° down |

## What each element takes from the references

### Plankton (owner `plankton` 1–6, videos 1–3; reference book §6; milestones "M4")
- **Only where the water moves.** The light is in the breaking crest and the last line of the wash. Open water
  between is black (videos 1, 2). A steady glow in calm water gives it away (book §6).
- **Separate sparks, not a sheet,** except where the wash is thick. Photos 3, 4 and 6 show thousands of points,
  dense along the water's edge and thinning both ways. Video 3: a stream over sand is a ribbon of sparks.
- **Timing (book §6, [search]):** a cell flashes within 20 ms of being stirred and its flash lasts about 0.2 s. It
  tires if stirred again at once and recovers when left alone. A crest's line of light lasts 1–2 s as it travels
  (videos 1, 2).
- **Colour:** electric blue, about 475 nm (*Lingulodinium*, the usual bloom species) [mine]; the brightest sparks
  go cyan-white (photos 3, 6). D2 still holds: sparks on dark water, never a cyan sheet.
- **For us:**
  - sparks along every line where water meets rock (the stacks' and the arch's feet, the fallen blocks), flaring
    as each slow ripple reaches them;
  - sparks along a ripple crest as it runs over the flats;
  - a trail where the pointer stirs the water, and around the feet when the visitor wades;
  - a patch stirred again at once is dimmer (fatigue);
  - only at night: the hour's world state says how much (Blue hour full; none in daylight).
  - The render's 2 600 points within 40 m (coast.py `plankton`) were an even sprinkle; the photos say waterlines.

### Stars (owner `night-sky-and-moon` 1, 2, 7; book §1; milestones "M4")
- **Blue hour sits at sun −6° (end of civil twilight).** Only the brightest stars are out, and only in the darker
  half of the sky. They come out brightest first [mine, book §1]. A full field in a bright sky gives it away.
- **So "dense" has to come from the sky, not a count.** Each star has a magnitude from its hash. It shows only where
  it outshines the sky behind it. The dark violet upper left (away from the sun) holds a real field; the glow holds
  none. Night and Midnight, where the sky is dark, fill in the most.
- **Many faint, few bright:** about 2.5–3× more stars per magnitude step [mine]. Colour by temperature: most are
  white to pale orange (K, G), a few blue-white (B, A).
- **Size from brightness, never below a pixel.** A star smaller than a pixel crawls and blinks as the camera moves.
  Bright ones get a 1–2 px soft core.
- **Twinkle:** a few percent of brightness, faster and stronger near the horizon, barely at the zenith [mine].
- Owner photo 1: the blue-hour gradient itself (teal top, a pale band, a pink-red rim). Our sky picture already
  carries it.

### Scrub caps (owner `cove-and-stacks` 6, 8, 12; book §8, §9; `reference-landforms.md`)
- Plants only on the tops (and on ledges that hold soil), never on a sheer face.
- On an exposed stack they are low, dense and wind-pruned: a ragged dome, a few sprigs standing above, leaning
  away from the sea wind (Blue hour's wind comes from 35°).
- At Blue hour they are pure silhouette against the sky, so the outline is what matters: ragged and broken, with
  sky showing through at the edge. Never a smooth hat.
- The render's rule (coast.py `build_caps`): the searsia shrub, scale 1.6–3.2, about 14 per top, on faces whose
  normal is within 53° of up, above 60 % of the stack's height. The live site already has that shrub (the cove
  pack's grove, model 3), so caps cost no download.

### The flats and the arch overhead (spec §2; design review §2 "IV", §4 "III → IV", "IV → V")
- **Ankle-deep flats** (ground −0.22 m under a still sea):
  - at the feet you see into the water and the sand ribs under it (Fresnel: steep view, little reflection);
  - farther out the water mirrors;
  - a light air (Beaufort 1, "ripples with no crests", book §2) breaks the mirror into slow wobbles. The render
    shows exactly this, and the ripples also hide the low-resolution mirror's stair-steps.
- **Wave ripples in sand** are 5–15 cm apart and about 1 cm high [mine]. Seen through 20 cm of water at night they
  are a faint texture within about 10 m of the feet, nothing more.
- **The arch overhead.** Measured from the arch mesh (`.superpowers/m4/tools/arch-gap.mjs`): the opening is about
  33 m wide and the span's underside is 40–45 m above the flats, 170–184 m from the stop.
  - The design review's "IV → V: through the arch" is the way to stand under it. The flight leaves low over the
    flats, through the opening, and climbs round toward the land as the stars come out.
  - The stop keeps its approved view: the arch framing the afterglow, the stacks either side, the mirror.

## Calls for the plan (mine)
1. Plankton is drawn inside the sea's own shader: sparks from a hashed grid on the water plane, gated by
   disturbance (waterlines, ripple crests, the pointer's trail, the walker's feet). No new draw, no new material.
2. Stars: one shader change in `sky.ts`, magnitude against the sky's brightness. It changes every night sky a
   little, and each is judged.
3. Scrub caps reuse the grove's shrub and its material: a second mesh sharing the same material, placed on the
   stacks' and the arch's tops in the browser by the render's rule.
4. Blue hour's wind goes from force 0 to 1, and the flats get sand ribs seen near the feet.
5. The flight to Night leaves through the arch. The stop's camera does not move.
6. A spot, "Wade out into the flats": a short walk on which every step lights the water.
