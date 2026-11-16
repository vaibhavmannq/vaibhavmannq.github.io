# M3 reference sheet: the cove's five places (Research phase, D20; s13, 2026-11-16)

I looked again at the owner's photos for the cove (contact sheets made with `_tools/sheets.py`, kept outside git)
and put them beside the s12 build at mid and low (`.superpowers/m3/base-a.jpg`, `base-b.jpg`, local).
`owner-references.md` stays the long version. This sheet is what M3 builds against, place by place.

## What the live cove is today (s12 build, judged at mid and low, which look the same)

| Place | Render has | Live has | Gap |
|---|---|---|---|
| I Golden | grass blades framing the lens, a grove on a dark hill, column cliffs on the right, pebbles | a flat dark slab on the right, bare beach, the lantern (an orange box) | no near layer except the lantern; the slab |
| II Sunset | a tree framing the left, a meadow with pink flower drifts, tall grass | open water and a bare yellow edge | everything: there is no meadow |
| III Dusk | the cliff-top grove in silhouette, flowers, 44 lanterns on the water | a slab and the mirror | no lanterns, no grove |
| VIII First light | the grove and a cliff over the water, a mist band | the slab, white surf foam | no grove, no mist; the foam is too bright for force 0–1 |
| IX Sunrise | sunlit column cliffs on the left, the grove, grass and flowers in front | two bare green ramps | no rock, no plants |

So M3 is mostly building the life layer: plants, trees, cliff rock, lanterns, mist. Shader tuning comes second.

## What each element takes from the owner's photos

- **Meadow (Sunset; also the tops at Golden, Dusk and Sunrise).** `meadow-and-flowers` 1–6, 8, 9, 11:
  - the photos are taken from inside the flowers: large flowers fill the bottom of the frame, and the field goes
    soft toward one tree or one tree line;
  - colours come in **drifts and bands** (5: white, blue and red in bands; 9: red along the folds of the hill),
    never as an even sprinkle;
  - tall grass and seed heads stand above the flowers; the low sun lights them **through** (1, 2): bright
    yellow-green rims against a dark base.
- **Coastal plants (Golden, Dusk, Sunrise).** Reference book §8: sea pink (thrift), low cushions with pink heads
  on 10–20 cm stalks; heather; plants only on the tops and in gullies, never on a sheer face; trees low and leaning
  away from the sea wind.
- **The grove.** `cove-and-stacks` 6 and 12 (trees on the cliff tops), `meadow-and-flowers` 10 (the owner's taste:
  one clean tree shape with one accent colour). One clear silhouette per group, not a carpet of cones.
- **Cliffs.** `cove-and-stacks` 1, 3, 4: a cliff is a vertical rock face in beds, with a grass cap and a slope of
  fallen blocks at its foot. It is never a smooth green ramp. Our Golden and Sunrise columns come from coast.py
  `cliff_rocks`.
- **Lanterns.** `lanterns` video 4, frames 0.5–9.2 s:
  - the paper is **pale cream, almost white, at the top**, and orange only low down where the candle is;
  - the edges are soft, and the float is a dark thin plate;
  - each lantern has a warm streak under it, broken into bars, about as long as the lantern is tall;
  - they drift about one lantern width in 9 s, in loose strings;
  - **"Reads as a box" means it is too saturated and too even.** Ours is orange all over, with a hard dark frame
    and a hard edge. The real ones are boxes too, but they are pale, glowing and soft-edged.
- **Mist (First light).** `mist` 8:
  - a thin, flat band on the water, with the far trees standing out above it;
  - the pink cloud is mirrored below the band; the band itself is grey-lilac and takes the sky's colour;
  - reference book §4: radiation fog, a metre or two deep, almost still, gone by sunrise.
  - `mist` 7 (sun shafts through misty trees) is the option for Sunrise.
- **Life.** Reference book §10 and `inspiration-and-ideas.md` C:
  - gulls glide more than they flap, pale shapes going dark against a bright sky;
  - bats are quick and erratic, seen for a second;
  - a flock lifts off the grove at sunrise and streams one way;
  - a fish ring spreads with no splash.

## Behaviour numbers (from the reference book, cited by the plan tasks)

- Wind per place comes from the hour preset (M2.5 Task 2). Golden, First light and Sunrise are force 0–1: grass
  only trembles at the tips. Sunset is force 2–3: a gust wave crosses the meadow at a few m/s, and the blades bend
  away and spring back faster than they bent (§2).
- A candle flickers at about 10 Hz, and only from force 2 (§7). Lanterns drift at walking pace or less and turn
  slowly (§7; video 4: about one width in 9 s).
- Dusk is when the lights come on (WuWa "weather"): the lanterns light one by one as you arrive.
- Mist hangs: drift ≤ 0.1 m/s, and its top is flat (§4).
