# The owner's UI and motion sites (s19, 2026-11-19)

The owner, mid-session s19: "Kawaii Text Animation, 21st.dev, Supahero, Originkit, Fontshare, MotionSites. View and
use anything you find useful from these sites for ALL MILESTONES." I opened each in the built-in browser. This sheet
says what each offers and which milestone takes what. Cite it in each milestone's Research phase (D20), beside the
owner's photos (D28) and the reference book (D24).

**Our constraints when borrowing:** the site is vanilla TypeScript + three.js (no React, no Tailwind, no GSAP, no
Framer). Take ideas, timings and structure, and write them ourselves in a few lines of CSS or TSL. Never add a library
for one effect (D9: the size bar). Nothing may take a scene's attention from the world: text sits on the world, quiet.

| Site | What it is | Licence | What we take |
|---|---|---|---|
| **Originkit** (originkit.dev) | ~810 free animated components, by category: Text, Cursor, Loader, Background, Image | free; code needs a free key | text reveals, a cursor, a loader (below) |
| **21st.dev** | the largest React + Tailwind component marketplace (Texts 663, Heroes 1 152, Cursors 152, Backgrounds 365) | each component its own (often MIT) | text effect timings; the card and dialog patterns for the project card (M9) |
| **Supahero** (supahero.io) | ~400 real hero sections from brands and portfolios, as images; now part of screensdesign.com | gallery | how a first screen places a name and one line over a full-bleed image: our Golden hour (M9) |
| **Fontshare** (fontshare.com) | free fonts from the Indian Type Foundry | free for personal and commercial use (ITF FFL) | **we already use Satoshi from it** (body); candidates below |
| **MotionSites** (motionsites.ai) | a paid library of AI prompts for animated hero sections, with free previews | paid prompts | look only: "Coastal Cards", "Dark Portfolio", "Ink Reveal", "Moss Island", "Scroll-Driven 3D" |
| **Kawaii Text Animation** | dropped by the owner (s19, after the survey) | — | nothing |

## What each milestone takes

- **M6 (Deep midnight, s19):** nothing changes the place's look. One idea kept for M9: a stop's title can arrive like
  mist, letters condensing out of a blur (Originkit "Smoky Text", "Dust Text Reveal").
- **M8 (polish):** a cursor that belongs to the night: a soft glow with a short trail at night hours only (Originkit
  "Aura Cursor", "Ribbon Trails"); never replacing the pointer for links. The loading line under the name (D9 "no blank
  loading screen"): a hairline that fills (Originkit "Hairline Loader", "Masthead Reveal").
- **M9 (text):**
  - Stop titles reveal per letter or per word on arrival, 400–700 ms, staggered 20–40 ms, blur and rise a few pixels
    (Originkit "Scroll Text Reveal", "Text Lift", 21st.dev ibelick "Text Effect"). Reduced motion: a plain fade.
  - The hour's numeral (I–IX) can change by a short scramble while flying (Originkit "Scramble Text"), only mid-flight.
  - Hover on a project title: weight or spotlight shift (Originkit "Weight Hover", "Spotlight Text") on Satoshi's or
    Fraunces' variable axes, no new font.
  - Type: we use **Satoshi** (Fontshare) for body and **Fraunces** for headings. If Fraunces' soft, wonky serif feels
    too sweet for the night, Fontshare's **Sentient**, **Zodiak**, **Erode** or **Boska** are the serif candidates to
    try running, side by side, behind a switch (rule 1).
  - The first screen (Golden): the name large, one line under it, nothing else, the world full-bleed (Supahero's
    portfolio heroes). Matches spec §6.
- **M10 (launch):** fonts self-hosted as now (no third-party font request), subset to Latin.
