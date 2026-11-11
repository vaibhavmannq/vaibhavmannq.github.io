# Session s01 · 2026-11-10 · round 3 finished, GPU renders checked, direction changed to a real-time world

(First session under the handover system. Everything before it is in `.superpowers/brainstorm/videos/HANDOVER.md` and
the dated logs beside it: storyboard v1–v3, the first GPU batches, round 2.)

## Done

1. **Round 3: every hour taken to 100% at preview level**, each with before/now, likes, dislikes, verdict on the canvas
   board "Round 3: each hour taken to the finish". Per hour, what changed:
   - Sunrise: barren left → a sunlit jointed-rock bluff stepping down to the arch, trees on top; frame tree dropped on
     purpose (the camera's slope falls 13 m in 9 m). Sun az 50 / el 14.
   - Golden: the smooth slope top-right → a rim-lit rock wall (`cliff_rocks`).
   - Sunset: sky brightness capped near the sun (`sky_clip`), dimmer disc, clouds turned 40° (`sky_rot`), one grove tree
     moved out of the sun, gold-orange ramp.
   - Dusk: floating paper lanterns drifting cove → arch (`build_lanterns`), violet-blue sky top (`sky_grad`).
   - Blue hour: the cyan horizon line was plankton 20–40 m away squashed into a row by the low camera → `fade`; flats
     deepened (no bar breaks the surface); scrub crowns on stacks and arch (`build_caps`); stacks notched/stepped/tapered.
   - Night: irregular crater flutes; 22 jointed columns around the north wall; falls rebuilt as a lip-and-drop sheet
     landing in the lagoon with foam, boulders and an ellipsoid spray cloud; glowing reeds, low fireflies.
   - Midnight: cloud sea raised to 172 m with a feathered edge (`feather`); lone tree on the ridge (`props`).
   - Before dawn: wet rock floor with puddles (`wet_floor`), vines anchored to real rock (`anchor`), leaf-shaped leaves,
     fungi on floor and walls (`wall_fungi`).
   - First light: clouds rotated 45°, inverted ramp (dark clouds rose, bright gaps silver-blue), cool haze.
   - Aurora rebuilt twice; final = `build_aurora_sky` + `aurora_mat` with `sky_bands` (D4).
2. **The friend rendered all nine at 1920×1080 / 512 spp on his RTX 5060** (skipped the test): no errors, 2–7.5 min each.
   All pass at full size (canvas board "Full renders: round 3 on the GPU"). Three full-size-only fixes made in `coast.py`
   (not re-rendered, see D6): no scrub crowns inside the falls; a pointed leaf mesh for the vines; the tide-pool shelf as
   dark wet rock with 12 fallen blocks (its paleness is grazing-angle sky reflection, so geometry fixes it, not colour).
   `render.bat` now takes hour names (`render.bat night beforedawn`). Patch pack: `python real/make_pack.py 3 --patch`.
3. **Three motion sketches** (breathe / depth parallax / water shader) built from the Golden render and shown:
   https://claude.ai/artifact/M7cgj3E9ELJVqmAKZdWFun. **Rejected** by the owner → D7. Keep only as a lesson.
4. **Aditya's repo read** (clone in the session scratchpad; re-clone if needed): Vite, React 19, R3F, three 0.186, WebGPU
   with WebGL fallback, postprocessing, Lenis; ~9k lines for 4 stops; instanced grass tiles with 2 LODs, wind and cursor
   parting; Reflector sea with swell/foam/sun lanes; sky baked to a cubemap + live stars; procedural piano/ruins; packed
   Poly Haven scans with baked AO; textures at 512/1k/2k; quality tiers minimal–ultra settled by a load-time test (the
   12–30 s loader); 39 MB in repo, ~14 MB per visit; ambience audio and a playable piano. Our site shares three 0.186,
   Vite and Lenis; ours is plain TS (3.9k lines) with tiers, a governor and a journey timeline.
5. Handover system created (this folder); memory updated (`realtime-3d-not-stills`, `session-handover-protocol`).

## Learned

- Full-size renders reveal what 640×360 previews hide (square leaves, a shrub in a stream). Check full size before judging.
- Cheap geometric checks (`raymap.py`, `skypeek.py`, `probe.py`) found every round-3 bug before a render was spent.
- Fog volumes: `Generated`/`Object` coordinates gave zero density; use an ellipsoid mesh for a round cloud instead.
- The friend will skip the test run if the full run is one double-click away; design the pack for that.
- The owner's "simple animations" rejection was predictable from the 8 Nov brief ("camera moving across the scene, things
  to play with"). Re-read the brief before proposing a delivery form.

## Open questions

- Which objects are hover/click targets at stops other than Night (lanterns = projects is my proposal, accepted "all good").
- Trees in real time: cards/impostors vs simplified meshes (the Poly Haven trees are 45–80 MB each; unusable as is).
- Whether the live world needs new Blender passes (wider frames, separate layers) for the fallback tier → decided in the
  design, rendered in the one later round (D6).
- Exact per-tier budgets (set in the design from the slice's numbers).

## Next step (do this first next session)

Build the **Golden cove vertical slice**, throwaway, in a scratch Vite root that aliases the repo's three.js (the pattern
from memory `perf-test-machine`), measured with per-rAF frame counts on this laptop in the headed Playwright browser:
terrain from `ground()` (port the numpy noise to GLSL/JS), reflecting sea, grass tiles with wind, the arch and stacks
exported from Blender as light meshes, the real sky HDRI shrunk, the camera flying from the beach stop to the clifftop
stop with the light turning toward Sunset, one hover target. Serve it to the owner's phone. Then write the design.
