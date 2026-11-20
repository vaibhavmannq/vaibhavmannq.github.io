# Decisions (append-only; never rewrite, add a new entry that supersedes)

Format: number, date, decision, why, what it replaced. Owner = Vaibhav. Earlier (Sept–Oct) decisions about the live
Moonsink Shore site are in `docs/superpowers/specs/`; this log starts with the new site.

**D1 · 2026-11-08 · The new site is a journey through one world at nine hours, not one static scene.**
Why: the owner, on seeing a nine-hour storyboard that never left the cove: "I am into open world, this is too static."
Replaced: the single-cove storyboard.

**D2 · 2026-11-09 · Hybrid look: realistic light, water and materials + Wuthering Waves colour accents and a few glowing
details.** Never flat two-colour, never white-fur grass, never glowing-cyan water. Real sky photos (Poly Haven HDRIs)
recoloured per hour, not painted cloud cards. Night skies: stars and an aurora.
Why: in the first full renders the realistic versions won because they mixed light and dark; the stylised versions were
"stuck in two colours". Replaced: separate realistic vs stylised variants.

**D3 · 2026-11-09 · The arch stays, 1.7 km out, but never alone: the last piece of an eroded headland among stacks and reefs.**
Why: alone it "looked weird". Replaced: a lone arch.

**D4 · 2026-11-10 · Auroras are natural: folded, overlapping curtains sweeping diagonally, a wobbling yellow-green lower edge,
rays of different lengths fading to violet, uneven brightness, navy starry sky.** Never one smooth arc with regular rays.
Why: the owner on the first version: "too rigid and artificial"; photo references given. Replaced: the even ribbon.

**D5 · 2026-11-10 · The nine full renders are approved as the art direction for the nine stops.** Owner: "YOU ARE AMAZING";
three small notes (aurora, falls, vines) fixed. Three full-size-only flaws (a shrub on the falls, square vine leaves, the
pale tide-pool shelf) are fixed in the script but not re-rendered.
Why: the look has been judged hour by hour, in finished pictures, as the process required.

**D6 · 2026-11-10 · Don't re-send renders to the friend's GPU now; batch all Blender fixes into ONE later render round
together with the site's real requirements** (frame size, separate passes, whatever the live build turns out to need).
Why: the current renders are good enough to design against; a shrub is not worth a round trip. Replaced: a patch render.

**D7 · 2026-11-10 · The site is a real-time 3D world in the browser (plain TypeScript + three.js 0.186 on the existing
site stack), NOT baked renders with parallax and shader motion.** Camera flies between stops on scroll; things in the
scene respond to hover and click (projects on floating lanterns at the Night lagoon, my placement, owner's "all good").
No free walking. The renders become each stop's target look and the low-tier fallback.
Why: the owner, shown three motion sketches cut from the renders: "I don't want these simple animations but I want a real
world interactive experience like Aditya's" (R3F site; facts in the s01 session log). Replaced: the depth-layer plan.

**D8 · 2026-11-10 · Production recipe:** vertical slice (Golden cove) → written design → plan → build per stop behind flags;
per-tier budgets enforced in CI (size-limit + a perf check); one asset-pipeline script (Blender → meshopt, KTX2, baked
light/AO, shrunk HDRIs); staged loading, cove first, quality measured while visible, no blank loader; renders as the
safety net on weak tiers; the owner judges running builds on their phone behind switches; milestones per stop; the old
site kept at `/moonlit/`.
Why: the owner: "I just hope we can execute this well enough"; confidence comes from process, not hope.

**D9 · 2026-11-10 · The speed bar for the 3D site:** your name on screen under 1 s; the first view under 3 s on a 10 Mbit/s
connection; each stop complete under 5 s; 60 fps on each device's default setting; about 3 MB per stop.
Why: the old site's bar (1.5 MB, one sea shader) cannot hold a world with terrain, rocks and trees; the visitor rules stay
(name at once, no blank loader, smooth, works on phones), the numbers follow what the slice measured. Owner: "yes to the new
speed bar". Replaced: the old site's 1.5 MB figure as a budget for the new site.

**D10 · 2026-11-10 · Two skies: each stop keeps its own approved sky photo;** during a flight the next stop's sky fades in.
Why: the Sunset sky is the best part of its render; the one-sky option (Golden's clouds recoloured) lost it. Owner chose
"two skies" after seeing both running on the phone. Replaced: my earlier recommendation of one sky per stretch.

**D11 · 2026-11-10 · Build order for the live world:** M0 the rough whole night (all 9 stops and 8 flights over simple
ground, nine skies and hours, places shown as their renders), M1 the world pass, M2 the four unknowns (aurora, sea of
cloud, waterfall, cave) one view each, M3–M7 the places, M8 polish, M9 text, M10 launch. All nine scenes before any text.
Why: the slice proved 146 m of a 5.8 km route in sunlight; the unknowns go first. Owner: "I want all 9 scenes created
first", then on the design: "everything looks good on paper, let's go". Spec: `docs/superpowers/specs/2026-11-10-realtime-world-design.md`.

**D12 · 2026-11-10 · The world pass:** the ground formula is reshaped (noise-warped edges, inland ridges, a colour map,
distant dressing) so the land holds up from the air; the nine approved camera views stay, checked with `raymap.py`.
Why: the formula shows box edges and bare land from flight height (maps in the s03 design page).

**D13 · 2026-11-10 · One shared material set for the whole world** (about a dozen, ≤ 14), ≤ 60 draws per frame including
the reflection pass, checked in CI by a census. Why: three's WebGPU renderer builds a shader per material (≈ 13 ms each,
s02); new materials at each place would freeze every arrival.

**D14 · 2026-11-10 · Textures stay WebP** until measurement (phone GPU memory, upload hitches > 50 ms) says KTX2.
Why: WebP measured small in the slice and needs no 200+ KB decoder. Replaced: D8's "KTX2 textures".

The design's nine "my calls" (§20: 1 screen per stop and 1–2.2 per flight; long flights glide 80–250 m; rail jumps
fade; blurred render at first paint; glow without real lights; grass parting off on touch; coast.py into the repo; mid
start with the governor; text mapping I/III/V/IX for later) are accepted with the design.

**D15 · 2026-11-10 · The owner tests only builds I call ready.** I judge every build myself the established way (likes,
dislikes, a %), on the laptop and in the phone emulation, and keep iterating until I am satisfied; then the owner does the
phone recording. Owner: "I don't want to test until you think it's perfect, follow that what you like, don't like and
percentage method and don't stop until you are satisfied with the final build".
Why: two phone rounds in s04 spent the owner's time on problems I could have found first. Replaced: asking for a phone
recording after every fix.

**D16 · 2026-11-11 · (my call, owner to confirm) "The nine views stay" means: exactly unchanged within 1.5 km of each
camera, in every framing the site shows (16:9, square, portrait), plus anything that could shadow that ground; the far
background beyond 1.5 km may change; ground under Midnight's sea of cloud counts as hidden.**
Why: the strict rule protected 45 % of the map and all the land the flights cross, so the world pass could change
nothing a visitor sees from the air. With these two rules 17 % is protected. Measured change in the far background:
Blue hour 0.3 %, Midnight 1.2 % of view rays, the other seven 0. Replaced: D12's "the nine approved camera views stay".

**D17 · 2026-11-11 · Distance fades into the sky's own soft horizon colour, by compass direction; the hour presets' fog
colour no longer colours the fog.** Why: a separate fog colour drew a hard line where sea met sky on high flights (M0
look note); browser open-world builders settle on the same fix. Replaced: fog colour from the hour presets.

**D18 · 2026-11-11 · Phone checks run over USB (adb + remote debugging) on `localhost`, before any hands-on test.**
Why: the LAN address is not a secure page, so the phone silently used WebGL2; recordings cost frames and showed only
symptoms. The owner still gives the final feel verdict by hand (D15).

D16 confirmed by the owner, 2026-11-11, after the hands-on phone test of M1: "feels good, I trust you".

**D19 · 2026-11-11 · The handover notes and plans are committed and pushed with the work; the no-AI rule covers commits and
commit messages only.** Owner: "add handover and plans to github - don't worry about ai, it shouldn't show in commits
or it's message that's all". Replaced: s03's "handover notes stay local".

**D20 · 2026-11-11 · M2 gets a Research phase: before a look is called done, it is judged against real references
(photographers and videographers of the real thing), not only against our own render.** Owner, mid-build: "take
reference from internet as well, there are some really amazing photographer and videographer", then "add it in
Milestone as a Research phase". The references go in `docs/handover/research/` as links with what to take from each.
Why: the renders are our own guess at an aurora, a cloud sea, a waterfall and a cave; the real ones are the bar.
Adds to D5 (renders as art direction); the compositions stay.

**D21 · 2026-11-11 · The renders are the floor, not the ceiling.** Owner, s08: "I don't want us to be confined to just
the render, if you get any inspiration or idea say it". Ideas that go beyond a render (a story thread, real sky
phenomena, creatures, pointer responses, sound) are welcome, are said out loud, and are shown running behind a switch
for the owner to keep or drop. (My reading, owner to confirm: cameras and set pieces still do not change without a
yes per case; the budgets of D9 and D13 still hold.) The running list: `docs/handover/research/inspiration-and-ideas.md`.
Why: the renders were our first guess at each place; research and inspiration should be able to improve on them.
Widens D5 and D20.

**D22 · 2026-11-11 · Full creative freedom for the builder, cameras and design included.** Owner, s08, after seeing
the ideas list: "all of them ... you are free to change the design of cove or anything you wish, even the camera
angles, I GIVE YOU FULL FREEDOM TO YOUR CREATIVITY AND IMAGINATION". Every idea in
`docs/handover/research/inspiration-and-ideas.md` is accepted to build. Replaces my caveat in D21 (cameras and set
pieces needing a yes per case) and loosens D5, D16 and the spec's non-goal "changes to an approved composition".
What still holds (my reading): the speed bar (D9), the material and draw limits (D13), no game assets or borrowed set
pieces, D15 (the owner tests only what I call ready), and every change is shown running and can be switched back.
A changed view is said out loud with before and after, never slipped in.

**D23 · 2026-11-11 · Sound: yes.** Owner, s08: "sound yes". Opt-in (silent until the visitor says yes, a visible
toggle), loaded only after opt-in so D9 is untouched; one ambience per place, cross-faded with the hours. Its own
short design before it is built. Replaces the spec's non-goal "Sound".

**D24 · 2026-11-11 · Land forms are built from real reference, not imagined.** Owner, s08: "the views, walls, stone
cove look out of place because we are imagining it instead of taking reference". Every rock form is built against a
named real place with photos kept locally; the compare tool shows the photo beside the live view. (My call: the whole
coast becomes one real kind of place, a northern basalt coast; `docs/handover/research/reference-landforms.md`.)
Extends D20 from the four unknowns to all land.

**D25 · 2026-11-11 · The world should feel interactive, "like we are in open world".** Owner, s08. (My call, owner to
confirm: delivered as look-around at every stop plus two to four spots per stop the camera can walk to, each with a
small discovery; free roaming stays out as in D7 until after M8. If the owner means free roaming, this entry is
replaced.) Amendment 1 §6.

**D26 · 2026-11-11 · The journey is smooth and unhurried, never "over in a blink of an eye".** Owner, s08. (My call:
about 41 screens instead of 21, a top speed for the camera however hard the scroll, and a "ride" control that plays
a flight at its designed length.) Replaces the design's call 1. Amendment 1 §7.

Amendment 1 to the design (`docs/superpowers/specs/2026-11-11-world-design-amendment-1.md`) gathers D21–D26; it is a
draft until the owner has read it.

D24 widened by the owner the same day: "real reference for everything that we create ... whether it's the waterfall,
fog, aurora etc. ... and how they would react in a real world scenario so it doesn't feel foreign". So D24 covers
every element and its **behaviour**, not only rock. The standing source is
`docs/handover/research/reference-book.md`: an entry per element (look, behaviour, numbers, what gives a fake away);
every plan task that makes or tunes something cites its entry; each place has one world state (sun or moon angle,
wind, moon phase) that every moving part reads; look checks give a % for look and a % for behaviour.

**D27 · 2026-11-11 · The owner accepted every recommendation in the s08 checklist (A1–A9), so Amendment 1 is approved
and my calls in D24–D26 are confirmed.** In short: look-around and spots now, free roaming judged after M8; real
behaviour with styled colour (a crescent moon where the aurora is strong); a basalt coast; Night rebuilt; new cameras
at Sunset and Dusk; a night about twice as long with a camera top speed and a ride control; one prompt for sound and
tilt; fallback stills captured from the finished live site (**replaces D6's Blender render round**); the lantern
thread. Content: Eventide plus "How this world was built" on the lanterns, the built-with-AI fact stated openly; About
kept ambiguous; contact links as on the current site; no paid domain. Answers in full:
`docs/handover/research/owner-checklist.md`.

**D28 · 2026-11-11 · The owner's own references are the first authority for look.** He added 128 photos and clips to
`.superpowers/refs/` (local only). What they show, element by element, is `docs/handover/research/owner-references.md`;
it overrides the search-based research where they differ. From his motion video: **the view must answer the pointer at
once (parallax of about 3 % of the screen between near and far), and something must always be moving on its own.**
So every stop needs a near layer. Sharpens D25.

**D29 · 2026-11-13 · (my call, owner told in chat) The sea stacks and the arch come into the live world as meshes
exported from Blender, not through the height field; M2.5 gains a Task 3c for the stacks.** Found in s10: the live
site had no stacks at all (they lived only in the Blender scene, below coast.py's render-setup marker); the dark
blocks at Golden are headland ground. On the 8 m height field a 7 m stack would be a pyramid and no undercut notch
is possible. So: Task 3 made the stacks pure, tested data (the real headland sequence); Task 3b exports the arch;
Task 3c exports the stacks, shelves and fallen blocks as one merged mesh in the shared rock material (one draw,
≤ 150 k triangles), with spires, wedges and flared feet from the owner's `cove-and-stacks` 12. If the census or the
phone says no, the fallback is said out loud. Replaces the M2.5 plan's "rebake with `npm run world`" for Task 3.

**D30 · 2026-11-13 · New download per place: ≤ 5 MB (was ≈ 3 MB in D9).** Owner, s11, on hearing the arch and the
stacks (1.9 MB of rock) left the cove places about 0.9 MB for trees, flowers, lanterns and near layers: "increase the
limit". The number is my call: at 10 Mbit/s 5 MB takes about 4 s, inside D9's "each stop complete under 5 s". The
first-view (stage A ≤ 1.2 MB) and world-base (≤ 1.0 MB) budgets do not change. Enforced in `src/assets/manifest.ts`
`BUDGETS.perStopBytes` (CI: `npm run world:report`). Replaces D9's "about 3 MB per stop".

**D31 · 2026-11-16 · (my calls, s13; owner told in chat) The M3 plan, and the cameras at Sunset and Dusk move.** The M3
plan is `docs/superpowers/plans/2026-11-16-m3-the-cove.md`. Its calls:
- The cove's plants are made in the browser (no download).
- Each stop draws only its own plants (R40).
- Sunset's camera goes down into the meadow at (86, 96), eye 0.6 m.
- Dusk's camera goes to the plateau's top edge at (32, 30), looking down 18°.
- The M1 keep protects the approved render views, not the new ones (R42).

Why: Amendment 1 §4 and D22. The before views are kept as shots in `.superpowers/m3/`. A live switch back is still
owed.

**D32 · 2026-11-16 · (my calls, s14; owner told in chat) The cove gets its own place pack, and things on the land
stand on the live height grid.** `public/world/stops/cove/` holds the cliff columns and the grove (0.75 MB), counted
against the five cove stops. Plants and rocks follow the site's 8 m grid where it differs from coast.py's formula
(2–5 m along the rims): six of 43 plants are left out where the grid is sea (R43), and cliff columns whose tops would
just poke through the turf are lowered (R47). The thread is kept per visit in sessionStorage. Ledger: R43–R52.

**D33 · 2026-11-18 · (my calls, s16; owner told in chat) Sunset gets a lone tree of its own, and Dusk's lanterns leave
the water's mirror.** A new plant in coast.py's grove (`LONE_TREE`, group "lone": the old tree's model at (62.8, 145.8),
scale 2.2) is Sunset's subject (owner `meadow-and-flowers` 10), so the grove the other places show is unchanged. Dusk's
lanterns and their streaks draw for the eye only: the streak is their reflection, and the mirror's first build of them
hitched the first flight into Dusk. Ledger: R65–R71.

**D34 · 2026-11-19 · (my call, s16; owner asked to "cover and finish M3 here" and is asked on the M3 page to confirm)
M3 closes below the 85 % bar, at Golden 76 %, Sunset 80 %, Dusk 74 %, First light 74 %, Sunrise 76 %.** The look items
left (Golden's glare, Sunset's clump, Dusk's mirror resolution and foreground, First light's mist, Sunrise's sun shafts,
faceted flower heads) move to M8 polish, where the whole night is judged together. `?cams=old` stays until the owner
picks the Sunset and Dusk cameras. Rulings R72–R75 (pebbles, the backlit meadow, the lantern's place, the switch).

**D35 · 2026-11-19 · (my calls, s17; owner told in the session log and on the M4 page) Blue hour, M4.** The stop's camera
stays; "the arch overhead" is the flight to Night leaving under the span with the gaze lifting (`FLIGHT_OVERRIDES`,
`LOOK_UP`). Sea sparkle lights only where water moves (waterlines, rare sparks, the pointer's trail, the wading feet),
in one sprite draw, Blue hour only. Stars are shown by magnitude against the sky's own brightness, every night hour.
Scrub caps are placed in the browser by coast.py's rule and drawn with the grove's material, only at Blue hour and its
flights. Blue hour's wind is force 0.5 (was 0). A new spot, "Wade out into the flats". Ledger: R76–R83.

**D36 · 2026-11-19 · (my calls, s18; owner told in the session log and on the M5 page) Night, M5.** The bowl of
basalt columns is made in the browser (`src/world/bowl.ts`), real prisms in the shared rock material, no download;
coast.py lowers the crater's west rim so the sky opens there (the base re-baked; Night's old view kept in the M1 keep).
Night's camera stands 1 m over the lagoon inside the south wall (`?cams=old` keeps the old one, without the bowl).
Night's moon lights as its crescent (lamp 5.0 → 0.7). The falls come in two tiers of ribbons over a stepped ledge.
Night's aurora is a corona made in the browser (`corona.ts`), every ray toward one apex; Midnight's is unchanged. The
rock takes a faint aurora green. Fireflies gather where the pointer meets the water; reeds frame the near shallows;
one lantern per project plus the visitor's floats on the lagoon, hover lifts it, click opens a card, each has a
keyboard twin. Night → Midnight goes up beside the falls. Ledger: R84–R98.

**D37 · 2026-11-19 · (my calls, s19; owner told in the session log and on the M6 page) Deep midnight, M6, and R38.**
Every part's shaders are built for the sea's mirror as well as the scene pass before it joins, each build keyed by its
own render context (`keyBuildsByOwnContext`, using three's `renderer.debug.onNodeBuilderCreated`): three r186 shared one
camera uniform group between pre-built shaders, which is why s12's attempt drew the eye's view upside down. Midnight's
ground within 60 m of the eye is designed in the browser (`ridge.ts`: a 7° shoulder of heather and grass, a knoll),
drawn in the terrain's material; the eye stands 1.6 m over it. Heather is a new plant kind; Midnight is the meadow's
sixth stop. In the moon's hours plants, turf and leaves lose most of their colour (Purkinje) and no backlit glow comes
through them. The lone tree is the cove pack's tree at coast.py's midnight prop. Four ranges at 1.5–7.5 km are made in
the browser (`peaks.ts`), each paler with distance, their feet in the deck, which now reaches north to y = −100. The
deck carries a forward-scatter road toward the moon and is dimmer elsewhere; its lumps are smaller. Midnight's aurora
is the late-night kind: a soft foot, weaker (× 0.78), patches breathing on 6.5/11/17 s clocks. Ledger: R100–R110.
The owner's six UI and motion sites are surveyed for every milestone in `research/owner-sites.md`.

**D38 · 2026-11-19 · (owner, s19) M3, M4, M5 and M6 close below the 85 % bar; their leftovers go to M8. Sunset and
Dusk keep the new cameras.** Closing scores (mine, look at mid): Golden 76, Sunset 80, Dusk 74, First light 74,
Sunrise 76, Blue hour 82, Night 72, Deep midnight 74. Every carried item is in the s16, s17, s18 and s19 logs. On the
cameras the owner added: "honestly I really liked the old sunset; if possible try adding some more in view as it feels
empty; do it in M8". So M8 fills Sunset's new meadow view (more in the frame, the old view's richness as the guide);
`?cams=old` stays as that reference until the M8 Sunset pass, then goes.

**D39 · 2026-11-19 · (my calls, s20; owner told in the session log) Before dawn, M7.** The stop starts 14 m deeper, in
a passage of basalt columns made in the browser behind the chamber (`passage.ts`, merged into the cave's one mesh; no
Blender re-export), and walks to the old camera in 30 s while resting, or with the scroll (`walk.ts`); the flight in
backs in through the mouth facing the sea and ends at the deep end. The cave is lit by the mouth's form factor computed
at load (`caveLight.ts`), not cave.bin's bake, shown with its range compressed (share^0.6); the chamber's walls carry
Fingal's colonnade in the shader. One still pool mirrors the mouth from any eye (ray to the mouth's plane), with two
drips; cobbles, boulders and stumps on the floor; fungi in clusters that brighten along the pointer; leaf-shaped vines
on the lip; a skylight shaft, faint and cool (no beam before dawn), on by default with `?skylight=off`. Ledger:
R112–R122.

**D40 · 2026-11-19 · (owner, s20) M7 closes below the 85 % bar, at Before dawn 72 % (mid), 70 % (low), behaviour 74 %;
its leftovers go to M8.** Carried: the floor's stones that barely read, the regular colonnade, the very dark deep start,
thin vines, the straight slab outside, the fungi's pointer wave not judged in motion; R121, R122, R123. The skylight
stays on by default (`?skylight=off` remains for comparison).

**D41 · 2026-11-20 · (my calls, s21; owner told in the session log) M8's first parts.** The sky's hour slots keep a
binding each and the placeholder sky samples like a photo, so no shader is rebuilt on a first trip (R121 and R123, one
cause). Sunset's meadow view gets a framing tree 8 m to the left (the old tree's model, grove material), grass at the
lens sides and flower drifts up the slope; `?cams=old` is removed (D38's condition met). On a portrait screen each stop
turns toward its subject. The first view waits, behind the poster and a hairline loader under the name, for the parts
the opening stop shows (capped at 3 s past stage A), and the cove pack is fetched with the base when the visit opens on
a cove stop: D9's "first view < 3 s" is met by the poster, the whole live view following (~4.5 s on 10 Mbit/s). A
night cursor (a glow and short trail, mouse only, night hours). Ledger: R124–R135.

