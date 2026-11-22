# Session s30 · 2026-11-22 · Phase 1 closed: baked light, the cove's finer land, the phone

Opus 5.5, main account, inline, main checkout on `world`. Plan `docs/superpowers/plans/2026-11-21-world-to-100.md`
(Phase 1); ledger `docs/handover/ledgers/2026-11-21-world-to-100.md` (R221–R224). Commits 4e68e0f … (not pushed).

## Done
1. **Task 11, baked light (R222, 4e68e0f):** `tools/world/bake_light.py` bakes, per lit hour (Golden, Sunset, Night,
   Midnight, Sunrise), the height above which a point sees the key (soft: a 1.5° disc) and the sky's share (horizon AO),
   over the whole base at 4 m and each place at 1 m; occluders are the live ground, the ring, the arch, stacks, cliffs,
   grove, Midnight's lone tree and the far trees. In the browser (`src/world/baked.ts`) the key light's colour is
   multiplied by the baked shadow (one hook for every standard material), AO goes into the ground and rock, meadow and
   grove read both per vertex; rides blend the two nearest hours' maps. `?baked=off`. 3.2 MB.
2. **Task 11b (R223):** the rim on rock kept; leaves as they are; **the live shadow on high carried to Phase 3** (three
   keys every lit shader on `castShadow`: a tier-following shadow would rebuild shaders mid-ride, R38).
3. **Task 10, finer land (R221, bc2fa79):** a **4 m** patch of coast.py's formula over the cove (one patch, five places),
   blended into the 8 m ground at its edge, held at every camera and walk spot; the base's cells under it are left out of
   its mesh; every placement reads the patched ground; the light re-baked over it. `?patch=off`. Faces dressing carried
   to Phase 3.
4. **Task 7a in part (R217 cont.):** the phone was plugged in mid-session. Found and fixed: First light's sun (off) sits
   5° from Golden's and read its shadow maps for nothing; on the phone the ride to Sunrise fell to 52 fps. Now gated by
   the key's strength (57.9 fps). The governor comparison old vs new is **not settled** (the phone heated through the
   runs; the old build measured last was the slowest of all).
5. **11c, laptop half (R224):** final sweep, cold rides, first-view bytes, 90 audit views old vs new, `world:test`, unit,
   report. Carry list per task in the ledger (R224's table).
6. On the way: `manifest.ts` had no rule for `light/` (the report failed); the base budget is 5 MB under D53; on low the
   shadow reads one texel (6644b32).
7. **The phone, second time (R225, 5656c86):** cool phone, old vs new alternating. The new build lost a whole tier (mid
   from II). Probes found the plants' per-vertex lookup was most of it: plants now read one coarse texel, and the
   ground and rock have no baked AO (it barely read). Now: ultra by III, then high, mid from VI, where the old build
   holds high — about one tier in the night's second half, carried. Laptop at low now +0.0–1.3 ms.
8. **Phase 1 closed** with its carry list (ledger R224's table + R225).

## Owner's notes this session
- "Why so long?" (1 h 32 m on Task 11): answered with where the time went (three 11-min bakes, a breakage I caused,
  eight speed pairs). Speed-ups offered: a second agent on the Python bake work (owner's choice, not taken yet), batched
  speed checks (done since), a faster bake (parallel hours: 11 → 8 min), a quiet laptop during sweeps.
- A side agent's note, accepted: "closed" now always comes with its carry list (R224).
- The phone: plugged in mid-session, taken back before 11c; the owner runs the phone part later, then Phase 1 closes.

## Learned
- three r186: a DataArrayTexture with Nearest min and mag filters takes the "unfilterable" `textureLoad` path, whose
  cached size variable leaks between materials ("unresolved value nodeUniformN"; meadow and grove vanished). Linear
  filtering, read at texel centres, gives the same bytes on the normal path.
- three r186 builds `Fn` bodies when the shader builds, not when called: a JS flag set around a call does nothing.
- A height-field occluder shades a rock's own sunny face unless the lookup moves off the surface by more than a cell
  on steep faces (0.5 m + 2.5 m × steepness).
- At a 1° sun the baked shadow is physically right and still reads muddy against the render: per-hour shadow depth.
- The phone's governor result swings with heat more than with a 1–2 ms change: alternate old/new on a cool phone.
- `app.tier` is a number (0–3): the type check caught a tier test written against names.

## Open
- The phone's tier in the night's second half (mid from VI, old holds high): profile IV→IX on the phone first in Phase 2.
- Light maps per hour, the opening hour's first (−2.6 MB before a first view).
- From before: the owner's test of #8, #9's walls, #10, #12, #14 (+ `?sunrise=sun`) and the reflections; mid at
  Dusk/Sunrise on this laptop; the headland pack at every start; `horizon.spec.ts`; Firefox smoke timing.

## Next
Phase 2 (sky, water, exposure), written in detail at its start; its first step, with the phone plugged in: profile the
rides IV→IX on the phone (`.superpowers/w100/phone-night.mjs` with RIDES, PORT, Q; old build in `../wt-head` at 1fed1a1)
and win back the tier; then the light maps per hour (opening hour first).
