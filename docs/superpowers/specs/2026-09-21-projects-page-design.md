# Projects page: the third page on the shore

- **Date:** 2026-09-21
- **Status:** Built on branch `projects-page`, at the owner's request ("continue and finish")
- **Amends:** `2026-09-13-moonlit-portfolio-design.md` §3.1, §3.3, §5.7, §14 and §17 S31

## 1. Why

Phase 2 of the master spec planned a second region, Lumenreach: a lantern city with a ring gate,
reached through a "resonance ripple" transition. When it came up, the owner said that idea had been
scrapped along with the shore's structures, and asked for the Projects page to work like pages 1 and 2:
"check what happens on page 1 and 2 and implement that".

## 2. Decisions (owner, 2026-09-21)

| Question | Choice |
|---|---|
| What Projects holds with no projects yet | This site as project #1, with its dialog and deep link |
| The sky | One sky and one moon for the whole journey; they never move |
| The look | The same moonlit sea; no city, no new scenery |
| The camera on page 3 | Walks sideways along the shoreline |

## 3. Behaviour

- **Pages 1 and 2 are unchanged.** The first 2.7 screen heights are today's sea-to-shore drift. The
  journey grows to 4.2; About still starts 1.215 screens in and the camera lands on the shore at 2.7.
- **Handover:** the same sequential fade with a quiet gap as intro → About. The fade (0.27 of a
  screen) and the gap (0.216) are kept in screen heights, so they feel identical on the longer journey.
- **Projects** starts at 2.8 screens, just after the camera lands. The camera then walks 8 units
  along the waterline (only `x` changes, so the foam stays at the same distance). The view never turns.
- **Touch snap:** three stops, where the intro, About and Projects are fully shown. Resting between two
  stops continues in the swipe's direction; past the Projects stop scrolling is free.
- **Reduced motion:** three viewpoints cut at the anchors with the text: open sea, shore, end of walk.
- **Project list:** each entry shows the year and role, the title as a button, and a one-line summary.
- **Dialog:** a native modal `<dialog>`. Esc, the Close button or the backdrop close it; focus returns
  to the button that opened it. Opening sets `#/projects/<slug>`; closing steps back or clears it,
  and Back closes it. A deep link skips the opening, lands on the Projects page and opens the dialog.
  An unknown slug is dropped from the address. The page behind stays locked while it is open.
- **Content:** `src/content/projects.ts`; adding a project is one entry there. About's copy no longer
  promises "three moonlit regions".

## 4. Dropped

The Lumenreach scene, the resonance ripple, the two-pass transition pipeline and lazy region builds.
The "still being lit" empty state is no longer needed, since there is a first project.

## 5. Tests

Unit: journey config and anchors, timeline, three-section handover, reduced-motion cuts, camera walk,
touch snap with three stops, router parsing, and the projects content schema. Browser: section handovers
around both anchors, the snap through all three pages, the dialog (open, Esc, focus return, deep link,
Back, unknown slug), axe on About, Projects and the open dialog, and full-moon contrast on all three
pages.
