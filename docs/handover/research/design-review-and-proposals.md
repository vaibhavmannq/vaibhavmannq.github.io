# The nine places, looked at fresh: what I would change (D22)

Written in s08 after the owner gave full creative freedom, cameras included (D22). I looked at the nine stills
(`public/world/stills/*.webp`) as a visitor would, then wrote what is strong, what is weak, and what I would do.
Everything here is **my judgement** unless marked **[search]**. Nothing is built. Each proposal is to be shown
running, beside the current view, and can be switched back.

## 1. Five things wrong across the set

1. **The same landmark, from the same side, four times.** Golden, Sunset, Dusk and Sunrise all put the arch and its
   row of stacks small on the horizon near the middle. Blue hour is the only place that does something new with
   it. This is the "too static" of D1 coming back in a quieter form.
2. **Too much pure black.** In six of nine pictures a third to a half of the frame is a black silhouette (the
   grove and cliff at Golden and First light, the headland at Dusk, the cave, the right wall at Night, the ridge
   at Midnight). Painters and level designers agree [search]: night and backlight should keep a wide range of
   values; shadows hold colour, not black; a pale rim light reads the shape; far things get lighter and bluer;
   check a frame in black and white before trusting it. Wuthering Waves' nights are full of colour in the dark.
3. **The stacks stand in a row like teeth, and the arch is a neat horseshoe.** Even spacing and symmetry read as
   built, not eroded. D3 asked for "the last piece of an eroded headland among stacks and reefs".
4. **The sun's road on the water is a solid white bar** (Golden, and worst at Sunset, where it looks like a pillar
   of light standing on the sea). A real sun road is broken glitter that widens toward the viewer.
5. **Night is the weakest place, and it holds the projects.** See §2 V.

## 2. Place by place

**I · Golden hour.** My 85 %. The rays, the mirror and the grass blades framing the shot are right. Change: the sun
road (glitter, §3.4); lift the right-hand black mass with warm bounce so the cliff shows its rock; the paper
lantern the spec promises is not visible in the still, and it is now the start of the story (the lantern thread),
so it needs to be the thing the eye lands on after the sun: near, left of centre, lit.

**II · Sunset.** My 75 %. The meadow and flowers are the best foreground of the nine; the tree frames well. Wrong:
the light pillar; the row of teeth. Change: go **lower, into the flowers** (eye at about 0.5 m, flowers large and
soft in front, wind moving them), so this is "the meadow" and the arch is a small promise behind it. Petals on
the wind. That makes II a different picture from I and III.

**III · Dusk.** My 88 % as a picture; the lanterns on pink water are the heart of the site. But it is "high on the
headland" and looks low. Change: **make it truly high and look down.** A steep view (pitch about −30°) from the
top: the lanterns as a drifting constellation on the water below, the headland's edge and flowers at the bottom
of the frame, the arch far up near the top edge with the last light. No other stop looks down. Then the flight
to Blue hour **drops off the headland and follows the lanterns out** (§4).

**IV · Blue hour.** My 85 %. The scale change works: after three small arches, you stand under it. Change: break
the horseshoe (one thick leg, one thin, a fallen block at its foot); plankton as trails where the water moves,
not even dots (see `milestones-m3-m10.md`); a rim of last light on the arch's inner edge so it is not flat black.

**V · Night.** My 55 %. Honest list:
- The crater wall is one flat striped band straight across the frame at one height, like a stage flat.
- The falls are a white rectangle, lit as if by a lamp.
- The aurora hangs as two banners with a hard lower line, parallel to the horizon.
- **The water does not mirror the aurora.** A still lake doubling the aurora is the picture every aurora
  photographer goes out for, and we have a still lagoon under one.
- It is frontal and symmetrical; nothing wraps around you, so it does not feel like being inside a crater.

Proposal: **redesign this stop.**
- Camera lower and off-axis: the falls at a three-quarter angle, a third in from one side, not in the middle.
- The near wall rises out of frame on one side, close, wet, catching green light; the far wall curves away. Now
  you are inside something.
- The falls in two or three steps with ledges and a veil of mist at the foot, lit by the sky only.
- Pitch the camera down a little: the lagoon takes the lower 45 % and carries the aurora's mirror, broken by
  rings and by the project lanterns (warm on green: the strongest colour contrast in the whole night).
- The aurora seen from inside a crater should come **over the rim toward you**: rays converging overhead. That
  is real: a corona is "standing at the base of a tall tower of green light, where the walls appear to meet
  overhead" [search]. It is the opposite of a banner.

**VI · Deep midnight.** My 70 %. The tree and flowers in front and the idea are right. Wrong: the cloud reads as a
quilt; the far mountain is a flat navy cut-out; the moon is a dot that reads as a star; the aurora's foot is a
hard bright line. Change: a real moon (2–4× the true size, with a soft halo) low over the cloud with its road
of light on the deck; three or four peaks standing out of the cloud at different distances, each paler than the
one before (depth by haze); the aurora softer at the foot and partly behind the peaks. The cloud's texture is M2's
work (`m2-references.md` §2).

**VII · Before dawn.** My 80 %. The frame within a frame works. Change: leaf-shaped vines (known); start the stop
**deeper in the cave** with the mouth smaller, and let the stop's slow drift walk toward it; a drip that rings
the puddle; the visitor's lantern glowing just outside.

**VIII · First light.** My 72 %. Calm, and the pink is lovely, but the middle of the frame is a black block.
Change: this is the hour when the dark lets go, so the grove and cliff should show soft grey-blue detail through
the mist, not black; the mist in layers; a fish ring; the dim lantern in the shallows.

**IX · Sunrise.** My 85 %. The only place where the world shows its real colours, and a good ending. Change: the
left cliff's columns look like clay (rock material and baked light, spec §9.6); break the row of stacks; the
flock lifting off the grove.

## 3. Changes to the world itself

1. **Re-scatter the stacks:** uneven gaps, uneven heights, two leaning, a reef line just breaking the surface,
   one stack split. Make the arch lopsided. One edit in `coast.py`, and it improves six views at once.
   D16's "views stay within 1.5 km" protected exactly this; D22 lifts it.
2. **Shadows hold colour.** A floor on ambient light per hour, tinted (violet at Dusk, teal-blue at Night, grey
   rose at First light), plus the baked bounce the spec already plans, plus a thin rim on silhouettes facing
   the sky's bright side. Test every stop in black and white.
3. **Haze for depth:** each farther layer a step paler and bluer. D17's fog already has the colour; it needs to
   start nearer at night.
4. **The sun and moon roads as glitter:** the mirror stays, but the bright core breaks into sparkles by a noise
   threshold that scrolls slowly, widening toward the camera [search: the Super Mario Sunshine trick, a
   threshold on scrolling noise; and a separate glitter term as in Journey's sand]. Watch for shimmer far away.
5. **A bigger moon**, everywhere it shows.

## 4. The flights as shots, not transfers

The spec treats a flight as getting from A to B at 80–250 m. With freedom over cameras, each flight can be the
best moment between two places.

| Flight | Shot |
|---|---|
| I → II | Rise from the wet sand, up the cliff face, the meadow opening as the edge is crossed. |
| II → III | Low through the flowers toward the tree, around its trunk, up to the headland's top. |
| III → IV | **Step off the headland, drop to the water and skim out among the lanterns** toward the arch as the sky cools; the lanterns thin out, the first plankton sparks appear, the arch grows until it is overhead. The lantern thread's best moment. |
| IV → V | **Through the arch.** Then a long climb over the sea toward the land as the stars come out; the crater's rim ahead with a green glow behind it; over the rim and down inside. |
| V → VI | **Up the falls and through the cloud.** Rise beside the falling water, over the lip, into the cloud (the picture goes soft and grey for a moment), then break out above it: moon, aurora, peaks. s07 found the flight must climb through the deck and treated it as a problem. It is the best beat of the night. |
| VI → VII | Dive off the ridge into the cloud, out underneath over the dark coast, down to the water, **in through the cave mouth**, and turn to look back out. |
| VII → VIII | **Walk out of the cave** through the vines into the open; the cove at first light. |
| VIII → IX | Along the beach just above the mist, up the rise, turning into the sun. |

Rules these keep: `check_paths` (2 m ground clearance, no long look into a hillside); the low skim is over open
water, where there is nothing to hit; reduced motion still gets cross-fades.

## 5. The camera at rest

- **The stop breathes:** a slow push-in or arc of a few metres over the stop's scroll length, not the spec's
  "few centimetres". Stills are what we are leaving behind.
- **Pointer parallax:** the camera turns one or two degrees toward the pointer, eased. Near things slide against
  far things and the scene has depth. On phones, the same from the gyroscope: on iOS that needs
  `DeviceOrientationEvent.requestPermission()` called from a tap, on a secure page [search, MDN]. The sound
  toggle's tap can ask for both. Small amplitude, off under reduced motion.

## 6. Sound (D23): what the research gave

- Start or resume the `AudioContext` only inside a tap or click; silent until the visitor opts in; a toggle
  always visible [search, Chrome and MDN].
- three.js: one `AudioListener` on the camera, `Audio` for ambience loops (`setLoop( true )`), `PositionalAudio`
  for things with a place (the falls, the cave drip) [search; check the three.js docs].
- Format: Safari's support for Opus in WebM has a history of gaps in `decodeAudioData`; AAC in `.m4a` is the
  safe choice there. MP3 loops are not gapless (padding); AAC and Opus loop better. Ship Opus with an m4a
  fallback, or m4a only for simplicity [search].
- Sources: only files marked **CC0** on freesound.org need no credit; "free" packs are often CC-BY (credit
  required). Check each file's licence and list them in `tools/world/sources.json` like the other assets.
  No specific files were chosen.
- One loop per place, cross-faded by the hour weights; the falls and the surf get louder with nearness.

## 7. Order and cost

1. **Night's redesign** (largest gain, and M2's waterfall and aurora feed straight into it). It should be planned
   before M2's Task 5 look-check goes far: the falls' steps and the aurora's shape change.
2. **Stacks and arch re-scatter** in `coast.py` (one change, six views).
3. **Shadow colour, haze, glitter roads, the moon** (shader numbers; each stop gains).
4. **Camera changes at II, III, VII** and the stop's breathing and parallax.
5. **The flights as shots**, one at a time, III → IV and V → VI first.
6. Sound's design.

What this costs the plan: the nine Blender renders stop being the target for II, III and V (they stay the target
for mood and colour). The stills fallback (spec §13.4) will need new renders of the changed views, in the D6
round. M2's goal ("a % against its render") becomes "a % against the references and the new brief" for Night.
The spec needs a short amendment before M3 is planned.
