# Real places for the rock, the cove, the falls and the cave (D24)

Owner, s08: "the views, walls, stone cove look out of place because we are imagining it instead of taking
reference." He is right: the crater wall at Night and the cliff columns at Sunrise read as clay because they were
invented. This file names real places to build from. Marks: **[search]** from a search summary, **[mine]** my
own knowledge without a source opened (check before relying on it). No picture was looked at by me: the owner
should open each name in an image search, and save the ones he likes into `.superpowers/refs/<place>/` (not in
git; other people's photos must not go into the public repo).

## 1. One rock story for the whole coast: a basalt coast under an aurora

The spec already uses jointed columns in three places (Golden's cliff, the lagoon walls, Sunrise's bluff). Columns
are what basalt does. So make the whole coast one real kind of place: a northern basalt coast, the kind found in
Iceland, the Faroes and western Scotland. That is also where auroras, sea stacks, moss, falls in column
amphitheatres and sea caves all occur together. One geology means every wall, stack and cave agrees with the next.

| Our part | Real places to take from | What to take |
|---|---|---|
| Stacks and arch | Reynisdrangar (Iceland, basalt stacks) [mine]; Dyrhólaey (Iceland, a basalt arch on a headland) [mine]; Old Harry Rocks and Durdle Door (England; chalk and limestone, for how a line of stacks stands) [search] | Shapes of real stacks: tall and narrow or blocky, flat or spired tops, never plugs. Durdle Door's arch is lopsided because its beds are tilted and the lower rock is softer [search]. |
| Cliff walls with columns | Giant's Causeway (N. Ireland) [mine]; Staffa (Scotland) [mine]; Stuðlagil canyon (Iceland): "cathedral-like" walls of columns over a turquoise river [search] | Columns in neat rows like organ pipes, broken at different heights so the wall's top and foot are stepped. |
| The Night falls and crater | **Gljúfrabúi** (Iceland): a 40 m fall inside a narrow canyon, "sheer rock walls on all sides, open to the sky above", "bright green moss-covered cliffs", a shaft of light on the falling water [search]. **Svartifoss**: a small fall in a cliff of dark hexagonal columns "like the pipes of an organ" [search]. **Litlanesfoss**: about 30 m in two tiers, each tier ringed by columns [search]. **Aldeyjarfoss**: bent, many-coloured columns framing a plunge pool [search]. Kvernufoss: you can walk behind it [search]. | Gljúfrabúi is our crater: enclosed, wet, mossy, open above. Svartifoss and Litlanesfoss are the wall and the stepped fall. Moss gives the walls a second colour that will catch the aurora's green. |
| The cave | Fingal's Cave (Staffa): a sea cave "filled with basalt columns" [search]. Benagil (Portugal, limestone): a sea cave with a round hole in its roof [search, the hole from mine]. | Fingal's for the walls. Benagil for an idea: a skylight, so the cave has two lights, the mouth and a shaft from above. |
| The tide-pool shelf | Any wave-cut platform [search] | It is real and has a cause (below). |

## 2. Rules of real coasts that our shapes must obey

How stacks come to be [search, school geography sources that agree]:
1. Waves attack a headland at its weak lines (joints, faults, softer beds) and open **caves**.
2. Two caves meet through the headland: an **arch**.
3. The arch's roof falls: the seaward leg is a **stack**.
4. Waves undercut the stack; it falls to a **stump**, often seen only at low tide.
5. At the foot of every cliff the waves cut a **notch** between high and low water; the rock above falls; what
   is left is a gently sloping **wave-cut platform**.

What that means for us:
- **A line of stacks is correct** (I was wrong to call the row itself a fault): they stand along the line of the
  old headland. What is wrong is equal size and equal gaps. They should get lower and more broken seaward,
  ending in stumps and a reef; the arch is still joined to, or nearest to, the land.
- Every stack and cliff has a **notch at the waterline** and stands on a shelf, with fallen blocks at its foot.
- **Tops are flat-ish and carry the only plants;** sides are bare.
- Arches are lopsided because rock is not uniform.

More, from my own knowledge **[mine]**:
- A **tide band**: dark wet rock at the bottom, a pale line of barnacles above it, black lichen above that,
  then the rock's own colour. Three horizontal bands tie every rock to the sea.
- Basalt columns are 0.3–1 m across, mostly six-sided, and break across into short drums, so a cliff foot is a
  heap of fallen column pieces. Above the neat columns there is often a layer of thin chaotic ones.
- Columns stand at right angles to the surface that cooled them, so some sets lean or fan out. A wall of
  perfectly upright, equal columns looks built.
- Wet rock is darker and shines; dry rock is matt. Spray zones near falls are both wet and mossy.

## 3. Use scans where the eye is close

Poly Haven (already our source for the scanned cliff, the trees and the skies) has rock and cliff scans under
CC0. sharetextures.com and OpenGameArt also list CC0 photogrammetry rocks [search; check each licence page].
A scanned boulder or cliff face, placed and scaled by hand, looks real because it is. Rule for the place
milestones: **anything within about 30 m of a stop's camera is a scan or is modelled against a named photo;
procedural shapes only in the distance.** Same pipeline as today (gltfpack, shared rock material, D13).

## 4. How to work from now on (this is the change)

1. Before a land form is built or rebuilt, name its real place from the table and collect 3–5 photos locally.
2. `npm run compare` gets a third column: the reference photo, beside the live view (and the render where one
   still applies). A % is given against the photo.
3. The owner's watch list in `m2-references.md` gains these names: Gljúfrabúi, Svartifoss, Litlanesfoss,
   Stuðlagil, Reynisdrangar, Dyrhólaey, Fingal's Cave, Benagil. Ten minutes of image search; say which you like.
