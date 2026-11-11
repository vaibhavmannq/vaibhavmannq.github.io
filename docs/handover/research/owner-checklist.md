# For the owner: questions, things to verify, references to add

Written in s08. Answer in chat or write under each line here; either works. Short answers are fine ("yes", "no",
"your call"). Nothing here blocks M2 except A1.

## Answered by the owner, 2026-11-11 (D27)

- **A1–A9: all as recommended.** So: look-around + spots now, free roaming judged after M8; real behaviour with
  styled colour; a basalt coast; Night rebuilt; the new cameras at Sunset and Dusk; the longer night with a top
  speed and a ride button; one prompt for sound and tilt; stills captured from the live site; the lantern thread.
- **B1 Projects:** only Eventide so far. Its text, number, pictures and links are already in
  `src/content/projects.ts` (with "Moonlit", the old site). So Night has **two or three lanterns**: Eventide,
  "How this world was built" (B4), and Moonlit as the earlier work at `/moonlit/`. More lanterns float unlit
  ("another is on its way"), which the lagoon needs anyway.
- **B2 About:** keep it ambiguous. A few evocative lines, no CV.
- **B3 Contact:** as on the current site: email, GitHub, LinkedIn (`index.html` on `main`, the `#contact`
  section). The email is already public there.
- **B4:** yes, say it was built with an AI assistant: "no shame in hiding" (taken as: nothing to hide).
- **B5:** stay on `vaibhavmannq.github.io`; no paid domain.
- **B6:** the owner asked what a visitor counter is: answered in chat (a free service such as GoatCounter that
  counts visits without cookies or personal data). Undecided; default is none.
- **B7:** no Apple device; a Samsung tablet is available (a second Android screen size, good for the tablet
  layout). Safari stays untested by hand: run the e2e suite on Playwright's WebKit as the stand-in and say so
  plainly at launch.
- **C:** not yet gone through. **D:** 128 files added; what they show is in `owner-references.md`.
  `wuwa-moods/` and `sound/` are still empty. Sound sites offered: Pixabay sound effects (usable), Audionautix
  (terms unread).

## A. Decisions (a word each)

| # | Question | My recommendation |
|---|---|---|
| A1 | By "open world", do you want **free roaming** (walk anywhere with keys or a thumb stick), or is **look around + tap a spot to walk there** enough? | Look around + spots now; free roaming judged after M8. |
| A2 | When **real** and **beautiful** disagree, which wins? Example: a bright moon really washes out an aurora, but both together look grand. | Real behaviour, styled colour: keep both in the sky, dim the moon to a thin crescent when the aurora is strong. |
| A3 | The whole coast becomes a **basalt coast** (Iceland / Scotland kind: dark columns, moss, stacks). Yes? | Yes. |
| A4 | **Night is rebuilt**: an enclosed mossy bowl, a two-step fall, the aurora overhead and mirrored in the lagoon. Yes? | Yes. |
| A5 | New cameras: **Sunset low in the flowers, Dusk high looking down** on the lanterns. Yes? | Yes, shown beside the old ones. |
| A6 | Pace: the night about twice as long to scroll, a top speed for the camera, and a **"ride" button** that plays a flight for you. Yes? | Yes. |
| A7 | On phones, ask once for **sound and tilt** together (tilt makes the view lean as you move the phone)? | Yes. |
| A8 | Drop the Blender re-render round and take the fallback **stills from the finished live site**? | Yes. |
| A9 | The **lantern thread**: the lantern you light at Golden travels the whole night and "light another" is the contact button. Yes? | Yes. |

## B. Your content (needed for M9; rough notes are enough)

1. **Projects** for the lanterns. For each: name; one line; what you built; the hardest part and how you solved
   it; link; a picture if there is one. Three to five is ideal.
2. **About:** who you are and what you want next (job, internship, freelance), in your own words.
3. **Contact:** which links (email, GitHub, LinkedIn, others)? Is a public email address fine?
4. One lantern as **"How this world was built"** (the numbers, what broke, that it was built with an AI
   assistant and what you learned)? I recommend yes.
5. A **custom domain**, or stay on `vaibhavmannq.github.io`?
6. Do you want a **visitor counter** (privacy-friendly), or nothing?
7. Can you borrow an **iPhone or iPad** for one test before launch?

## C. References I found but could not look at: please look, and say "like" or "not this" with one reason

**Aurora, filmed in real time**
- [ ] Ole Salomonsen, "Soaring": https://www.universetoday.com/articles/soar-with-the-aurora-in-this-breathtaking-real-time-video
- [ ] Thierry Legault: https://www.universetoday.com/articles/incredible-fast-moving-aurora-captured-in-real-time-by-thierry-legault
- [ ] Anders Mildestveit: https://petapixel.com/2014/10/21/video-aurora-borealis-real-time-shot-sony-a7s-iso-25600-noise-reduction
- Tell me: is our aurora too slow, too fast, too neat? Which moment in which film is "the one"?

**Sea of cloud at night**
- [ ] ESO, "Moonshine like sunshine": https://www.eso.org/public/images/img-4520-cc
- [ ] Canon, sea of clouds at night: https://snapshot.canon-asia.com/article/en/nailing-the-shot-a-sea-of-clouds-in-the-city-at-night

**Glowing things**
- [ ] Shaun Jeffers, glow-worm cave: https://mymodernmet.com/shaun-jeffers-glow-worms
- [ ] National Geographic glow-worm video: https://on.natgeo.com/2eO6UEC
- [ ] Kris Williams, plankton in real time: https://petapixel.com/2018/07/06/photographer-captures-the-beauty-of-bioluminescent-plankton

**Real places for our rock (image-search each name)**
- [ ] Gljúfrabúi (the waterfall in a mossy canyon: my model for Night)
- [ ] Svartifoss, Litlanesfoss, Aldeyjarfoss (falls among basalt columns)
- [ ] Stuðlagil (a canyon of columns)
- [ ] Reynisdrangar, Dyrhólaey (basalt stacks and an arch)
- [ ] Fingal's Cave, Benagil (sea caves; Benagil has a hole in its roof)
- Tell me: which one is "our" waterfall, "our" arch, "our" cave?

**Websites (for feel and pace, not to copy)**
- [ ] "8 Best Three.js Websites of 2026": https://www.utsubo.com/blog/best-threejs-websites-2026
- [ ] "More Than a Portfolio: Building a Scroll-Driven 3D World" (I could not open it): https://tympanus.net/codrops/?p=114641
- [ ] Bruno Simon's new portfolio, and Abeto's "Messenger": https://www.awwwards.com/messenger.html
- Tell me: whose **pace** feels right? Whose **interaction** feels like an open world to you?

## D. References I would love from you

Folders are ready at `.superpowers/refs/` (on this PC only, never uploaded). Drop pictures or clips in, or paste
links into a `links.txt` in the folder. **One line per item saying what you like in it** is worth more than
the item: "the mist", "how slow it is", "this colour".

| Folder | What helps most |
|---|---|
| `wuwa-moods/` | Screenshots of Wuthering Waves moments you love: night, water, light. For mood and colour only; nothing is copied. **The single most useful thing you can add,** because it shows me your taste. |
| `sites-i-like/` | Any site whose scroll speed or interactivity feels right, and Aditya's moments you like most. |
| `waterfall/`, `aurora/`, `cloud-sea/`, `cave/` | Photos or films of the real thing that made you stop. |
| `cove-and-stacks/`, `cliffs-and-columns/` | Real coasts you find beautiful. |
| `meadow-and-flowers/`, `mist/`, `night-sky-and-moon/` | The same. |
| `lanterns/`, `plankton/`, `fireflies/` | Especially video: motion is what I cannot guess. |
| `sound/` | Any ambience you like, or a site whose sound felt right. |

## E. Facts in the reference book that came from my memory, not a source

You do not need to check these; I list them so you know where the book is soft. If a film or photo you look at
contradicts one, tell me.
- A waterfall is clear at the lip and turns white as it falls; it pulses in surges.
- A paper lantern's light is deep orange and nearly steady in still air.
- Moonlight looks blue-silver and drains colour from the land.
- Fireflies fly about a metre above the grass and are busiest just after dusk.
- Coastal trees lean away from the sea wind.
- Real fog is the colour of the light falling on it.
