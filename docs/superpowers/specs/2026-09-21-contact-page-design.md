# Contact page: the fourth page, at the water's edge

- **Date:** 2026-09-21
- **Status:** Built on branch `contact-page`, approved by the owner in chat
- **Amends:** `2026-09-13-moonlit-portfolio-design.md` §3.1, §3.3, §14 and §17 S32; follows the
  projects-page design (`2026-09-21-projects-page-design.md`)

## Decisions (owner, 2026-09-21)

| Question | Choice |
|---|---|
| The look | The same pattern as pages 1 to 3: same sea, sky and moon, same handover (Lastlight Isle is dropped) |
| Ways to reach the owner | Email `vaibhavmann.03@gmail.com`, GitHub `vaibhavmannq`, LinkedIn `vaibhav-mann-635542282` |
| The camera | After the shoreline walk, it steps toward the sea and stops at the water's edge |

## Behaviour

- **Pages 1 to 3 are unchanged** in screen heights: About at 1.215, the shore at 2.7, Projects at 2.8,
  the end of the walk at 4.2. The journey grows to 5.6.
- **Contact** starts at 4.3 screens. The camera steps from (x −8, z −5.5) toward the sea to z −4.3 and
  lowers from 1.45 to 0.95, staying on the sand (the waterline is at z ≈ −1.7). The view never turns.
- **Handover and snap:** the same fade, gap and fade; the touch snap gains a fourth stop.
- **Reduced motion:** four viewpoints cut at the anchors; Contact's is the water's edge.
- **Page:** "At the water's edge", Contact, and three links, each with a small label. GitHub and
  LinkedIn open in a new tab and say so to screen readers. The links are plain HTML in `index.html`,
  not rendered from data, so they work even if JavaScript does not.
- **Return to the shore:** glides back to the top and moves keyboard focus to the name. The planned
  ripple is gone with the transitions.

## Tests

Unit: config positions, timeline, the step to the water, reduced-motion cuts at all four anchors.
Browser: every handover, the four-stop snap, the links' addresses, Return to the shore, axe and
full-moon contrast on the Contact page.
