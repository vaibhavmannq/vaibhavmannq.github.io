# M6 reference sheet: Deep midnight (Research phase, D20; s19, 2026-11-19)

I put the live stop at HEAD e406c8a (`.superpowers/m6/before/mid.png`, `low.png`, local) beside the approved render
(`out3/midnight_hybrid_vivid.jpg`) and the owner's photos for this place (`night-sky-and-moon` 3–8, `cloud-sea` 3,
`mist` 2, `aurora` 1–13) in one sheet (`.superpowers/m6/before/sheet.jpg`). The long versions stay
`owner-references.md` §2, §7, §10 (D28), the reference book §1, §4, §5, §8 (D24) and Amendment 1 §4 row VI (the brief:
"a real moon with its road on the cloud; several peaks fading with distance; a softer aurora foot"). No web search: the
research folder covers the moon, the cloud sea and the aurora. The owner's six UI/motion sites (s19) are noted in
`owner-sites.md`; none of them changes this place's look.

## What the live stop is today (HEAD e406c8a, mid; low looks the same)

| Element | Render has | Live has | Gap |
|---|---|---|---|
| Ground underfoot | a grassy ridge top, heather bottom right, white flowers | a grey wedge in the bottom-left corner (the 8 m grid's ridge seen from 2.4 m) | no ridge, no near layer (D28 asks for one at every stop) |
| Lone tree | a wind-bent tree on the left third, dark against the cloud | none | the subject is missing |
| Cloud sea | a white deck to the horizon, soft lumps | a grey-white deck of long rolling waves, lumps 50–100 m, bright everywhere | lumps too big and too even; no moonlit side; no road |
| Peaks | one dark ridge across the back | one navy ridge, barely seen; a bright green hill cluster mid-left | not "several peaks fading"; the green hill reads as daylight turf |
| Moon | a small white point low right | a 13 % crescent with a soft halo, low right | the disc is right (owner `night-sky` 3); nothing it lights |
| Aurora | a banner across the top | two banners of rays with a bright green foot, magenta tops | the foot is the hardest, brightest line in the frame; a flat band parallel to the horizon ("gives it away", book §5) |
| Sky | navy, stars | navy, stars | fine (owner §10: never black, lighter toward the horizon) |

My live score before M6: **look 45 %** (the deck and the aurora carry it), behaviour 55 % (the deck drifts, the
aurora sways as at Night; nothing answers the pointer).

## What each element takes from the references

### The ridge and its near layer (render; owner `night-sky` 6; book §8)
- You stand **on** something: a narrow grassy ridge top that falls away in front, so the cloud starts below the frame's
  lower third (render). Within 30 m of the eye the land must be modelled (Amendment §3), not the 8 m grid.
- **Heather** (book §8; milestones note "M6"): a low dense mat, 20–50 cm, in clumps, purple-pink in flower but
  **grey-violet under moonlight** (Purkinje, book §1); short grass between, a few pale stones breaking through.
- The near layer answers the pointer (D28 parallax 3 %): heather and grass in the foreground move against the cloud.

### The lone tree (owner `night-sky` 6; render; Sunset's `LONE_TREE`, D33)
- One tree, wind-shaped, on the ridge's shoulder at the left third, its crown **against the cloud and sky**, never
  against the peaks. Night trees are silhouettes with a thin moonlit rim on the moon's side.
- It moves least of everything: a slow sway at force 2 (book §2), the crown more than the trunk.

### The sea of cloud (owner `cloud-sea` 3, `mist` 2; book §4; m2-references §2)
- From above, **thousands of separate cauliflower lumps**, bright tops, blue shadow between (cloud 3); much smaller and
  more numerous than ours. Far away the lumps merge into a flat white plain to the horizon (mist 2).
- Valley fog: **flat at one height** over connected valleys, lapping at slopes with a hard-ish edge where it meets a
  hillside (mist 2), drifting at 0.4 × the wind (R8), never streaming.
- **The moon's road on cloud** (owner `night-sky` 4, 5, 8: the moon "lights the cloud beside it"): cloud is not a
  mirror. It scatters forward, so the tops between you and a low moon brighten into a broad, soft silver band toward
  the moon, broken where lumps face away; the side of each lump facing the moon is brighter than the side facing you.
  The band is widest and softest at the horizon under the moon and fades toward the eye.
- Fog takes the light's colour: silver-blue under the moon, a faint green under the aurora (book §4, §5).

### Peaks fading with distance (owner `night-sky` 6, 3; `mist` 2; book §1 "far layers get paler")
- **Several ranges, each paler and bluer than the one in front** (night 6: four layers of blue hills; mist 2: far ridges
  as dark islands standing out of the deck). Nearest: almost black with a moonlit rim; farthest: barely darker than
  the sky at the horizon. Silhouettes jagged and varied (night 3: one sharp peak), not one smooth line.
- Their feet are hidden in the cloud: each range is islands, not a wall.

### The moon (owner `night-sky` 3, 4, 5, 8; book §1; milestones "moon size")
- **A small sharp disc with a soft halo**; the world state keeps one night's phase (0.12, a crescent; A2 confirmed a
  crescent beside an aurora is believable). The dark part of the disc shows faintly (earthshine).
- It sits low (7°) right of centre: low enough that its road crosses the whole deck.
- It lights the cloud beside it (a brighter patch of deck under it) and gives everything a moon side.

### The aurora, late at night (book §5; owner `aurora` 6, 12; the brief "a softer aurora foot")
- **Pulsating aurora** is the late-night kind: soft patches that **brighten and dim with periods of a few seconds to
  tens of seconds**, each on its own clock, with no sharp edges (book §5). Weaker than Night's curtains, and a moon,
  even a crescent, dims it further.
- The **foot softens**: no sharp, bright lower edge; the brightest part is a fold or patch, not the foot (owner §2).
- Not a band parallel to the horizon: it should run away into the distance (owner 6, 12) or break into patches.
- The cloud deck takes a faint green where the aurora is over it (book §5: "it lights the land faintly green").

## My calls for M6 (owner told in the session log; D37)

1. **Fix R38 first**, measured (the brief's step 3): a moon road and an aurora are wasted if the flight in stutters.
2. **The ridge top is made in the browser** (like the bowl and the caps): a fine local ground patch around the camera
   that meets the 8 m grid at its edge, drawn with the terrain's look; heather and grass from the meadow's plant system.
3. **The lone tree** reuses the cove pack's tree (the grove's material, no new download), placed in the browser.
4. **The peaks are silhouette ranges made in the browser**: three or four ridgelines at rising distance, one mesh, one
   material, each layer paler toward the sky's horizon colour, feet in the cloud.
5. **The cloud deck**: smaller, more numerous lumps; a moon side; the road (forward scatter toward the moon).
6. **Midnight's aurora**: a soft foot, dimmer, and pulsating patches on their own clocks (5–20 s).
7. **Midnight's land at night**: the mid-ground hill loses its daylight green (the moon's light, not the turf colour).
