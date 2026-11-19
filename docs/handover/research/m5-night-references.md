# M5 reference sheet: Night (Research phase, D20; s18, 2026-11-19)

I looked again at the owner's photos for this place (`waterfall` 1–11, `aurora` 1–13, `fireflies` photos and videos
1–3, `lanterns`) as contact sheets made with `_tools/sheets.py` (kept outside git), and put them beside the approved
render (`out3/night_hybrid_vivid.jpg`) and the live stop at HEAD 68a08b4 (`.superpowers/m5/before/mid.png`,
`low.png`, local). The long versions stay `owner-references.md` §2, §3, §11, §12, the reference book §3, §5, §6, §7,
`reference-landforms.md` §1–2 and Amendment 1 §5 (the brief). No web search: the research folder already covers the
three real places, the aurora and fireflies.

## What the live stop is today (HEAD 68a08b4, mid; low looks the same)

| Element | Render has | Live has | Gap |
|---|---|---|---|
| Walls | 22 pillar rocks round the crater, striped, trees on the rim | the 8 m height field's crater: smooth grey-green slopes, smeared | no columns, no wet rock, no moss, no foot; reads as clay (Amendment §5 "a stage flat") |
| Light | dark walls, deep shadows, green only on the moss line | the whole wall lit pale grey-green, as bright as the sky | far too bright; no deep teal shadow |
| Falls | one white rectangle in a notch | the same rectangle, centred, frontal | one even sheet, centred, lamp-white |
| Aurora | two banners with hard lower lines | the same, plus magenta | banners parallel to the horizon; no corona; the lagoon does not mirror it |
| Water | mirrors the falls only | a mirror of walls and falls | no aurora in it, no rings, no lanterns |
| Near layer | glowing reeds, fireflies | nothing | no near layer (D28 needs one) |
| Projects | (none) | none | the stop that holds the projects shows none |

## What each element takes from the references

### The bowl (Gljúfrabúi, Svartifoss, Litlanesfoss; owner `waterfall` 5, 10, 2; landforms §2)
- **Enclosed, open above** (Gljúfrabúi: "sheer rock walls on all sides, open to the sky"). Owner photo 5 (Abiqua) is
  the brief built by nature: a round bowl of columns, moss, a dark pool, one fall, mist at its foot.
- **Columns** are 0.3–1 m across, mostly six-sided, in neat rows like organ pipes (Svartifoss), **broken at different
  heights**, so the top and the foot of the wall are stepped. Above the neat columns, a band of thin chaotic ones
  (the entablature). Columns stand square to the cooling surface: sets lean or fan a few degrees. Equal upright
  columns look built.
- **The foot** is a heap of fallen drums (columns break across into short pieces), into the shallows.
- **Wet and mossy where spray reaches.** Moss on ledges, column tops and the faces near the fall; wet rock darker
  and shining; dry rock matt. Moss is the walls' second colour and takes the aurora's green.
- **Size (brief):** 60–90 m across, walls 25–40 m, one side high and close (left, within 10 m of the camera), the far
  side lower so the sky opens there.

### The falls (owner `waterfall` 4, 8 tiers; 2, 10 split ribbons; 9 the truth for motion; book §3)
- **Two tiers** (Litlanesfoss; owner 4, 8): the upper narrow, the lower spreading over a stepped ledge; the total drop
  about the present one (32 m, lip to lagoon).
- **Never one even sheet:** split into ribbons, wide and narrow, with wet rock between (owner 2, 10).
- **Accelerates** all the way: √(2·9.8·h); glassy at the lip, white within a few metres, ragged at the foot, in surges.
- **At night it is as bright as its light, no brighter.** It reads by contrast with the shadowed alcove (every owner
  photo), not by glowing. Under an aurora: pale grey-green.
- **Mist** rises at the foot and drifts with the wind (Night is force 0: it rises and spreads slowly).
- **Gives it away:** constant speed; white lip to pool; a clean rectangle; no wet rock; glowing.

### The aurora (owner `aurora` 2, 3, 4, 8, 9, 11 overhead and fans; 3, 10, 12 doubled in water; book §5)
- **Seen from under the curtain the rays converge to one point** (a corona): rays fanning out from a point high in
  the sky, soft and of different widths, the brightest part a fold, never the lower edge.
- **Colour by height:** green body, a magenta or pink top (owner 1, 7, 13), pale mint to white in the brightest
  cores (8, 9). Stars show through it.
- **It lights the land:** the walls' wet faces and moss take its green; shadows stay deep teal, not black.
- **The still lagoon doubles it** (owner 3, 10, 12): the picture Night should be. Rings and lantern wakes break the
  mirror; the mirror is a little darker than the sky.
- **Motion:** folds drift and ripple slowly; rays shimmer sideways.
- **Gives it away:** a hard top edge; even brightness; a regular comb of rays; banners parallel to the horizon;
  nothing on the ground taking its colour.

### Fireflies (owner `fireflies` videos 1–3; book §6)
- **Real time is sparse and dark:** dozens of faint points and, at any moment, one or two bright ones; each on for
  about ¾ s every 5–6 s, each on its own clock, never together. Low, in and just above the plants (0.3–2 m).
- **Yellow-green**, the same in every clip. The flash is often made on a rising swoop.
- **Toward the pointer:** they drift, slowly, to where the pointer rests and drift off again (inspiration §C).
- A short trail behind a bright one gets part of the long-exposure "carpet" honestly.
- **Gives it away:** lights that stay on; all blinking together; drifting like dust.

### Glowing reed tips (render; owner `fireflies` photo 1, the mossy stream; book §6 fungi)
- Steady, faint, blue-green, never blinking, lighting nothing around them. In the near shallows only, as the near
  layer (D28: about 3 % parallax).
- Reeds bend a little and sway together (one wind; Night is force 0: barely).

### Project lanterns (spec §10; book §7; owner `lanterns`)
- Deep orange (about 1 900 K) through paper, brightest low; steady in calm air (force 0).
- On water: drift at walking pace or less, turn slowly, bob; a loose line, never a grid; a warm streak under each.
- Warm on green: the strongest colour contrast of the night. One per project (three today, `content/projects.ts`),
  plus the visitor's own lantern from Golden (the thread).
- **Hover lifts and brightens; click opens its card; each has an HTML twin.**
- **Gives it away:** fast flicker; white light; lanterns keeping station; no reflection.

## Where I take a different call from the brief (my calls, told to the owner)
- **Litlanesfoss** is, by our own landforms note, "about 30 m in two tiers, each tier ringed by columns". The live
  drop stays the present 32 m (Litlanesfoss is about 30 m), split into an upper tier and a wider lower one.
- **The bowl is made in the browser** (seeded, pure data in TypeScript, like Blue hour's caps), not exported from
  Blender: hexagonal prisms are a few lines of code, cost no download (D30), and the Blender round is no longer needed
  for stills (D27).
