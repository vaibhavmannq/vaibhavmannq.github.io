# M8 ledger: the whole night, polished

Plan: `docs/superpowers/plans/2026-11-20-m8-the-whole-night-polished.md`. Research: `research/m8-whole-night-references.md`.
Rulings continue from M7's R123.

## Session s21 (2026-11-20)

### Task 0: Research and plan
- The reference sheet gathers every carried item (M3–M7) with its evidence and what M8 adds; the plan orders the work by
  what a visitor meets first: hitches, Sunset's view (D38), portrait framings, fade-ins, flights, looks, cursor and
  loader, sound (design first), speed, stills, gate.

### Task 1: R121, the first trip out of Before dawn (laptop)
- **Reproduced** cold (QUIET_COLD=1, START=midnight, two rides, low): out of Before dawn one 600 / 1150 ms freeze
  ~0.6 s after `renderPipeline_MeshStandardNodeMaterial_38`, and 67–100 ms after `SpriteNodeMaterial_21`
  (`.superpowers/m8/r121-cold2.log`, `r121-cold3.log`). New bench hook `__whoIs(id)` names the parts: 38 is the shared
  rock (cliffs, pebbles, arch, stacks, bowl), 21 the spots' glints.
- **Cause, from the shader text** (`.superpowers/m8/pipediff.mjs`; `pipes/`, `pipes2/`):
  - **R124:** three r186 gives texture nodes holding the same Texture one binding (`TextureNode.getUniformHash` is the
    texture's uuid). The sky's two hour slots (texA, texB; the fog reads them) hold one texture at a stop and two in a
    flight, so a shader pre-built at rest has one binding fewer than the flight's: rebuilt on the first flight that
    draws it. Fix: `slotTexture(value, slot)`: a slot's hash is its name. Test `slotTexture.test.ts`.
  - **R125:** the glints were pre-built while the slots held the 1×1 placeholder sky, a plain DataTexture (nearest,
    clamped), which three reads with `textureLoad`; the photos (linear, wrapped) need `textureSample`. Fix: `blankSky()`
    is prepared like a photo. Test `blankSky.test.ts`.
  - **R126:** the eye's pre-build culled by the view at join time (only the mirror's call turned culling off), so a part
    out of view when it joined was not built for the eye. Fix: culling off for both calls (`pipeline.ts compile`).
- **After** (cold, same ride, `r121-fix2.log`, `r121-fix3.log`): **0 late pipelines on both rides** (was 2); into
  Before dawn worst 34–51 ms, out of it no frame over 50 ms in the flight.
- **Whole night, cold, low** (START=golden, eight rides, `night-cold-new.log`): **0 late pipelines on every flight**;
  every flight's frames ≤ 50 ms except one 66–83 ms pair arriving at Blue hour.
- **R123, phone** (USB, Brave, WebGPU; `.superpowers/m8/phone-ride.mjs`, all 30 parts joined): old build (b1e50c7) into
  Before dawn 2 frames over 50 ms, worst 301 ms, right after the same `MeshStandardNodeMaterial_38`; out of it a late
  rock and glint build again. **New build: 0 frames over 50 ms on both rides, worst 34 ms, no pipeline made.** R121 and
  R123 were one cause.
- **R127, open (R101's family):** a single 167–200 ms frame ~32 s after arriving at First light, resting, with no
  pipeline, shader or texture created and no long task (main thread idle: a GPU-side stall). Seen in every cold run,
  before and after the fix, and warm too (266 ms at Dusk ~36 s after arriving, `warm-ride.log`). Nothing in our code
  fires then; a Chrome trace of Sunset → Dusk and 50 s at rest caught no gap (intermittent). Resting, not in a flight:
  left open, below the visible work.
- **Verdict, Task 1:** behaviour 92 % (no first-trip build left on any flight, laptop cold and phone); not 100 because
  of R127's resting frame.
