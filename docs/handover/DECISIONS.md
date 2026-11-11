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
