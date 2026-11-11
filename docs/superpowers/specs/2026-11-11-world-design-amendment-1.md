# Amendment 1 to the live-world design: freedom, reference, interaction, pace, sound

- **Date:** 2026-11-11 (session s08, research only; nothing here is built).
- **Amends:** `2026-11-10-realtime-world-design.md` (the spec). Where the two disagree, this file wins.
- **Why:** the owner, in s08: ideas beyond the renders are wanted (D21); full creative freedom, cameras included
  (D22); sound yes (D23); the land must come from real reference, not imagination (D24); the world should feel
  interactive "like we are in open world" (D25); the journey must be smooth, not "over in a blink" (D26).
- **Evidence and detail:** `docs/handover/research/` (start at its README). My critique of the nine places:
  `research/design-review-and-proposals.md`. Real places: `research/reference-landforms.md`.
- **Status:** draft for the owner. Written without a question round ("do it, then show"). Every choice the owner
  did not make is listed as **my call** in §9.

## 1. What stays

The nine hours and their order; the route's nine places; the speed bar (D9); one shared material set and the draw
limit (D13); TypeScript + three.js 0.186, WebGPU with a WebGL2 path; tiers and the governor; staged loading with
no blank screen; the owner tests only what I call ready (D15); no game assets and no borrowed set pieces.
The renders stay the guide for **mood and colour** at every place.

## 2. What the renders no longer decide (replaces spec §3 non-goal "changes to an approved composition")

- Camera position, direction and lens at any stop.
- The shapes of rock: stacks, arch, cliffs, the crater, the cave.
- Anything added: creatures, sky phenomena, responses to the pointer, the lantern thread.

A changed view is always shown beside the old one, with a switch back, and named in the session log.

## 3. Everything from reference (D24; adds to spec §9 and §15)

**The owner widened this the same day: every element and how it behaves, not only rock.** The standing source is
`docs/handover/research/reference-book.md` (light, wind, water, falls, fog, aurora, living lights, lanterns,
plants, creatures, sound). Three rules follow:
- Every plan task that makes or tunes an element cites its entry and the numbers taken from it.
- **One world state per place** in the hour preset: sun or moon angle, wind direction and force (Beaufort), moon
  phase. Grass, leaves, mist, cloud drift, ripples, lanterns and sound all read it, so they agree.
- A look check gives two scores: looks like the reference, behaves like the reference.
The book's last section lists what the current build gets wrong by these rules (a bright moon with a full aurora,
grass waving over mirror water, constant waterfall speed, steady plankton glow, fungi as lamps).

For the land:

- The coast is one real kind of place: **a northern basalt coast** (`research/reference-landforms.md` §1).
- Every land form is built against a named real place, with photos kept locally (not in git).
- The stacks follow the real sequence (headland, cave, arch, stack, stump): one line along the old headland,
  lower and more broken seaward, a notch at every waterline, a shelf and fallen blocks at every foot, plants only
  on top, a tide band on everything that stands in the sea.
- Within about 30 m of a stop's camera, rock is a scan (CC0) or modelled against a photo.
- `npm run compare` shows the reference photo beside the live view; a % is given against the photo.
- Shadows hold colour, never pure black; far layers get paler; the sun's and moon's roads on water are broken
  glitter (`research/design-review-and-proposals.md` §3).

## 4. The places (changes only; the rest of spec §2 and §5 stands)

| # | Change |
|---|---|
| I Golden | The paper lantern is the second thing the eye finds: near, lit, left of centre. Hover lights it; it becomes the visitor's lantern for the night. |
| II Sunset | Camera down into the flowers (eye about 0.5 m); the meadow is the subject. |
| III Dusk | Camera truly high, pitched down about 30°; the lanterns are a drifting pattern on the water below. |
| IV Blue hour | A lopsided arch with a fallen block; plankton as trails that answer the pointer. |
| V Night | **Redesigned: §5.** |
| VI Midnight | A real moon with its road on the cloud; several peaks fading with distance; a softer aurora foot. |
| VII Before dawn | The stop begins deeper in the cave and drifts toward the mouth; a skylight shaft is an option to show. |
| VIII First light | The grove and cliff show soft detail through layered mist. |
| IX Sunrise | Real rock on the left cliff; a flock lifts off the grove on arrival. |

## 5. Night, redesigned (brief for the builder)

**What it is now:** a frontal view of a flat striped wall with a white rectangle of water and an aurora in two
banners; the lagoon mirrors only the falls. My 55 %.

**What it becomes:** you stand at the water's edge inside a narrow, wet, mossy bowl of basalt columns, open to the
sky, the way Gljúfrabúi is. The aurora comes over the rim toward you and lies doubled in the lagoon. Your projects
float on the water as warm lanterns against the green.

- **Real places:** Gljúfrabúi (the enclosure, the moss, light from above), Svartifoss (dark columns like organ
  pipes round the fall), Litlanesfoss (a fall in two tiers).
- **Shape:** the bowl is 60–90 m across, walls 25–40 m, not a ring of equal height: one side high and close, the
  far side lower so the sky opens there. Columns broken at different heights; a heap of fallen column drums at
  the walls' feet and in the shallows; moss on ledges and in the spray.
- **The falls:** two tiers, the upper narrow, the lower spreading over a stepped ledge; total drop about the
  present one. Mist at the foot. Lit only by sky and aurora: pale grey-green, never lamp white.
- **Camera:** at the edge, eye about 1 m, the falls a third in from the right at a three-quarter angle, the high
  wall rising out of frame on the left within 10 m. Pitch a little down: water fills the lower 45 %.
- **Aurora:** rays that converge overhead (a corona, seen from under the curtain) plus one band low over the
  open side. The lagoon mirrors it; rings and lantern wakes break the mirror.
- **Light:** the walls take the aurora's green on wet faces and moss; shadows are deep teal, not black.
- **Life:** fireflies that drift toward the pointer; reeds with glowing tips in the near shallows; rings on the
  water; the visitor's lantern among the project lanterns.
- **Interaction:** each project lantern lifts and brightens on hover and opens its card on click (spec §10).
- **What M2 keeps:** the aurora ribbon technique, the mirror, the waterfall shader's layers, the spray. What
  changes: the aurora's fold lines for Night (a new export from coast.py), the falls' geometry (two tiers),
  the wall mesh (new, from reference). **So M2 Task 5's look-check should judge the water's motion and light,
  not the composition.**
- **Cost guard:** the bowl is one merged mesh in the shared rock material; moss is a mask in that material, not
  a new one; the census limits stand.
- **Done when:** a % against photos of the three real places and against this brief, ≥ 85 % by my judgement,
  then the owner's.

## 6. Interaction: an open world you can look into and wander in (D25; replaces spec §10's first bullet, adds to §8)

The owner wants the world to feel interactive "like we are in open world". D7 ruled out free walking. Between a
fixed camera and free walking there are three steps; this amendment takes the first two and names the third.

1. **Look around.** At every stop, drag (mouse) or drag sideways (touch) turns the head: about ±40° left and
   right, ±15° up and down, eased; it settles back when the journey moves on. With no drag, the camera leans a
   degree or two toward the pointer, or with the phone's tilt (asked for with the sound prompt's tap).
2. **Wander.** Each stop has two to four **spots**: soft glints in the scene. Click or tap one and the camera
   walks there along a short baked path (5–40 m): down to the water's edge, behind the falls, up onto a rock,
   deeper into the cave. Each spot holds one small discovery (a view, a creature, a thing that responds).
   Scrolling on leaves from wherever you are. Spots are the "points of interest" of an open world, sized to
   what one person can build and a phone can draw.
3. **Free roaming** (walk anywhere with keys or a thumb stick): not in this amendment. It needs ground collision,
   detail everywhere the feet can go, and phone controls; it would multiply the content. Revisit after M8 with
   real numbers. If this is what the owner means, he should say so now: it changes the plan more than anything
   else here.

Everything responds: lanterns, plankton, fireflies, fungi, grass, water rings (`research/inspiration-and-ideas.md`).
Every spot and target has an HTML twin for keyboard and screen readers (spec §10).

## 7. Pace: a smooth journey (D26; replaces spec §8.1's lengths and my call 1)

The first design gave a 1.7 km flight 2.2 screens of scroll. One flick on a phone is more than that. So:

- **Longer:** a stop is 1.5 screens; a flight is `clamp( 1.5 + distance / 400 m, 2, 6 )` screens. The night is
  about 41 screens, up from 21.
- **The camera has a top speed.** Scroll sets where you are going; the camera follows with damping and may not
  cover a flight faster than its own minimum time, however hard the flick: about 3 s for the short flights,
  8–12 s for the four long ones. The scroll position is not allowed to run more than half a screen ahead of
  the camera. (Scroll libraries expose exactly these two controls, damping and a maximum speed.)
- **A ride.** A "next" control (also the arrow keys and space) plays the flight at its designed length,
  10–20 s for the long ones, eased, with no scrolling needed. The rail's far jumps still fade (spec §8.4).
- **Rhythm inside a flight:** slow at the reveals (through the arch, breaking out of the cloud, into the cave),
  quicker over open water.
- **Touch:** the settle at a stop stays, but only when the scroll has nearly stopped; it never pulls a flight short.
- **Flights are shots,** each with one moment (`research/design-review-and-proposals.md` §4). The low passes
  need `check_paths` to allow under 80 m over open water.
- Reduced motion: flights become cross-fades, as before.

## 8. Sound (D23; replaces the spec's non-goal)

Silent until the visitor opts in; a toggle always in view; the audio context starts inside that tap. One loop per
place, cross-faded with the hour weights; the falls and the surf are placed in the world and grow with nearness.
AAC in `.m4a` as the format that works everywhere; files loaded only after opt-in, outside the speed bar; every
file CC0 and listed in `tools/world/sources.json`. Sound gets its own short design before it is built.

## 9. My calls (for the owner to check)

1. The whole coast becomes a basalt coast (§3).
2. Night is rebuilt as an enclosed, mossy bowl with a two-tier fall and an overhead aurora (§5).
3. "Open world" is delivered as look-around plus spots to wander to; free roaming is deferred (§6).
4. The night is about 41 screens long, with a camera top speed and a "ride" control (§7).
5. The cameras at II, III and VII change (§4).
6. The gyroscope is asked for together with sound, in one prompt.
7. AAC only, for sound.

## 10. What this does to the build order (amends spec §18)

| | Change |
|---|---|
| M2 | Finish as planned, but the waterfall and Night's aurora are judged for motion, light and cost, not for composition. Add: the camera's top speed and the longer scroll (§7), because the owner feels the pace now and it is a small change in `timeline.ts`. |
| new: M2.5 | **The world from reference:** stacks, arch, tide bands, shadow colour, glitter roads, the moon; the compare tool's photo column; look-around and the first spots at Golden. One world edit that improves six views. |
| M3 | The cove's five places with the new cameras at II and III, the lantern thread, the life layer. |
| M5 | Night as §5. |
| M7 | The cave from Fingal's Cave, the deeper start. |
| M8 | The flights as shots; sound's design and build; the stills' new renders (D6 round). |

The D6 render round now also has to re-render every changed view (II, III, V and whatever else moves), or the
stills fallback shows pictures that no longer match. Cheaper alternative, my recommendation: **capture the stills
from the finished live site** at high quality on the laptop, and drop the Blender round.

## 11. Open

- Does the owner mean free roaming by "open world" (§6 step 3)?
- The seven questions in `research/milestones-m3-m10.md`.
- The watch lists (`research/m2-references.md`, `research/reference-landforms.md` §4).
