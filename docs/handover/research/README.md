# Research (D20): read this before planning or building a milestone

Written in s08 (2026-11-11), a research-only session. No code was changed. The aim: the next building session
does not spend its budget searching the web for things already found here.

| File | Use it when |
|---|---|
| `threejs-r186-notes.md` | writing any three.js / TSL code: exact API patterns from the r186 examples, what r187 and r188 change, which official example shows what |
| `m2-references.md` | finishing M2 Task 0 and re-judging the aurora, cloud sea, waterfall and cave |
| `milestones-m3-m10.md` | planning M3 to M10: techniques, references, known traps and open questions per milestone |
| `design-review-and-proposals.md` | **before M2 Task 5 goes further and before M3 is planned:** my critique of the nine places and the changes D22 allows (Night redesigned, stacks re-scattered, cameras at II/III/VII, flights as shots, sound) |
| `reference-book.md` | **before making or tuning anything:** how each element looks and behaves in the real world, with numbers (light, wind, water, falls, fog, aurora, fireflies, plankton, lanterns, plants), and what the current build gets wrong (D24) |
| `reference-landforms.md` | building or judging any rock, cliff, stack, falls or cave: the real places to work from and the rules real coasts obey (D24) |
| `inspiration-and-ideas.md` | looking for what would lift a place above its render (D21): a story thread, real sky phenomena, life, pointer responses, sound |

## How far to trust each line

Every finding carries one of three marks. Do not treat a lower mark as a higher one.

- **[read]** I opened the page or the source file and the fact is in it.
- **[search]** It comes from a search result's summary of a page. Open the link before relying on it.
- **[mine]** My own reasoning or background knowledge. No source. Test it before building on it.

**Nothing here was watched.** I cannot play video. Every film and photo below is a link with a written description
from someone else. D20 asks for references that were looked at: the owner is the one who can do that (see the
"owner's watch list" at the top of `m2-references.md`).

## Findings that change something now

1. **Stay on three.js 0.186 through M7.** r188 is the newest release [read]. Nothing in r187 or r188 fixes a problem
   we have. Two r187 changes can move our pictures: environment maps (PMREM) are rebuilt on cube render targets and
   "materials may look slightly different", and `setViewport()`/`setScissor()` stop scaling by pixel ratio when a
   render target is bound (our reflection pass). Upgrade, if at all, at the start of M8, with `npm run compare`
   before and after.
2. **Plan Review Focus 2 has an exact API.** `await renderer.compileAsync( object, camera, scene )` compiles an
   object that is not yet in the scene, against the scene it will join [read]. Since r184 it does not block
   rendering [search]. This is the documented way to make a part appear with no compile hitch.
3. **Glow can bloom alone.** The r186 example blooms only an `emissive` render target (MRT), so nothing else in the
   picture has to pass a brightness threshold [read]. This fits spec §9.8 (glowing things, no real lights) better
   than a threshold bloom, at the price of a second colour target. Measure it on the phone before adopting it.
4. **A ray-marched cloud is not for the phone.** three's own volume cloud takes up to 100 steps × 3 texture reads
   per covered pixel [read]. A deck that fills the screen at Midnight cannot afford that. The displaced-mesh deck
   of M2 Task 4 is the right family; the work left is its texture and light, not its method.
5. **The real aurora is not always slow.** Film makers who shoot it in real time say strong displays move too fast
   even for 25 frames a second [search]. The plan's motion constants describe a quiet aurora. Keep them as the
   default, and give the owner one faster variant to judge (rule 1: options running).
6. **Lenis has its own snap package** (`lenis/snap`) and does not work with CSS scroll-snap [read]. It also honours
   "reduce motion" by default (`respectReducedMotion: true`): smoothing off, programmatic scrolls instant [read].
   Spec §8.5 can lean on that.
7. **GitHub Pages limits:** published site ≤ 1 GB, soft 100 GB of traffic a month, deploys time out at 10 minutes,
   cache headers cannot be set [search]. At about 20 MB for the whole night that is about 5 000 full visits a
   month. The committed generated files count toward the 1 GB repository guideline: keep the pack report's habit.

## Not found (do not search again without a new idea)

- A TSL aurora drawn as a mesh ribbon. Only ray-marched ones exist (a WGSL one samples 32 slices per sky ray).
- A written technique for a mesh cloud deck in a shipped game. Only volumetric papers (Horizon Zero Dawn,
  Frostbite) turned up.
- A three.js waterfall breakdown. The Unity ones carry over; see `m2-references.md`.
- A three.js official example for stars, fireflies, grass, trees or level of detail.
- The Lawlor and Genetti aurora paper's host was unreachable from here; its numbers are not in these notes.
- One Codrops article ("More Than a Portfolio: Building a Scroll-Driven 3D World with Something to Say") returned
  403. It is the closest published case study to this site; the owner can open it in a browser:
  https://tympanus.net/codrops/?p=114641
