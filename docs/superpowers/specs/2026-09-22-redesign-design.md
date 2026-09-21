# Redesign: chapters, type and touch

- **Date:** 2026-09-22
- **Status:** Built on branch `redesign`, chosen by the owner from a runnable demo
- **Amends:** `2026-09-13-moonlit-portfolio-design.md` D7, §3.3, §7 (budget) and §17 S33

## 1. Why

The owner's review: the fonts, the placement (every page bottom-left) and the sizes felt off, and the
journey was "just reading the text whenever they pop up — why would anyone read it and go with the
journey". They asked for creativity and to look at GSAP and its peers. Research: GSAP is now free
including SplitText and ScrambleText (Webflow, 2025) and remains the strongest for scroll and text
motion; Anime.js v4 is smaller but weaker at scroll; Motion suits React interfaces.

## 2. Decisions (owner, from the demo)

| Question | Choice |
|---|---|
| Hook | A story in chapters, things to touch, cinematic moments |
| Type | Fraunces (display, name, italic lines), Hanken Grotesk (reading), Space Mono (the log voice) |
| Placement | Composed: each chapter placed for its view |
| Touch | Links lean toward the pointer; the water ripple was dropped ("feels fake") |
| Chapter titles and the voyage log | Keep |
| Budget | Raise it; GSAP loads with the page (270 → 330 kB) |

## 3. Behaviour

- **Voyage log** (top): today's date and time, and tonight's moon, e.g. "Waxing gibbous · 65% lit",
  from the same phase as the scene (including `?moon=`). Refreshed every 30 s.
- **Chapters:** "I · Adrift", "II · The shore", "III · What washed ashore", "IV · The water's edge", in
  Space Mono. Screen readers hear a plain version ("Chapter one: Adrift"; About's title is a heading
  named "About").
- **Text motion:** each chapter has one paused GSAP timeline, 0 → 1 arriving (lines rise through masks,
  the title types itself in with ScrambleText) and 1 → 2 leaving (lines lift away, the title fades). Its
  position comes from the same handover as the chapter's opacity (sections.ts), never from a clock, so
  scrolling back reverses it exactly. SplitText re-splits on font load and resize.
- **The name** rises letter by letter as the opening lifts (a one-shot tween, like the opening's own
  fades). On a mouse or trackpad its letters swell toward the pointer (Fraunces' weight axis).
- **Pull:** project and contact links and "Return to the shore" lean gently toward the pointer.
- **Placement:** on wide screens the intro and Projects sit high, in the sky; About and Contact stay low.
  Contact was centred in the demo, but over the real scene that put it on the moon's path (§3.4 rule
  4), so it stays left.
- **Reduced motion:** no rise, no typing, no masks moving, no swell or pull; text switches at anchors.
- **Copy:** the demo's lines, e.g. "I build quiet, moonlit things for the web.", About's "Everything here
  is made by hand: the sea is a shader, and the moon is tonight's.", "Say hello", and the project's
  aside "you're standing in it".

## 4. Not changed

The scene, the camera, the pacing, the snap and the handover positions.
