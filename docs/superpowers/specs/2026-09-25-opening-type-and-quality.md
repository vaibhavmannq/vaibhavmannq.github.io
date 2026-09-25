# The opening's hand-over, the journey's type, and a scene that stopped blinking

- **Date:** 2026-09-25
- **Status:** Built on `satoshi-type`, each part chosen by the owner from options running on the real site
- **Amends:** `2026-09-22-redesign-design.md` §2 (type), §3 (the opening, placement); master spec §5.6

## 1. Why

The owner reviewed the live redesign and rejected an earlier sweep of changes outright ("every change you
made is awful"), so that work was reverted and each item was taken one at a time, shown running rather than
as screenshots.

## 2. The opening

Measured on the built site: the journey's text began fading in 900 ms **before** the black had finished
lifting, so the first thing a visitor saw was half-faded words on the black. Four orderings were built
behind `?open=` and the owner chose on a phone:

| | black lifts | text arrives | overlap |
|---|---|---|---|
| the old one | 0.5–2.3 s | 1.2–2.1 s | 900 ms |
| **chosen** | 0.4–2.0 s | 2.0–2.8 s | none |

The greeting's own fade is untouched in all of them — that part the owner likes. The name now rises with
the rest of the page rather than ahead of it, and a test reads the two timings so the order cannot drift
back. The greeting keeps Fraunces, italic second line and all: the owner asked for that moment to stay
exactly as it was, and a second test guards it.

## 3. The type

The owner's references — shadergradient.co, dark.design, minimal.gallery — turned out to be modern
grotesks set tight on near-black (Inter at −1.15px tracking, Aeonik at −1.5px uppercase, a monospace for
the small print), not the editorial serifs offered in two earlier rounds. Seven faces were then run on the
real journey, switchable live, and the owner chose **Satoshi**:

- Satoshi carries headings, reading text, the project title and the contact links, with the tracking those
  references use (−0.03em on headings, −0.011em on reading text).
- **Fraunces is kept for the name and the opening's greeting only**, which makes the name the one serif on
  the page rather than one serif among many.
- Space Mono still speaks the log's voice: chapter titles, the voyage log, the small labels.
- The italics go. None of the references italicise; they set a stressed line lighter and tighter instead,
  and faking an italic on a grotesk reads as a mistake.
- Contact values take the softer ink the owner picked over full white, next to the glow-blue labels, and
  the last page greets in Spanish: "Hola".
- Satoshi ships with the site (three weights, 74 kB) rather than coming from Fontshare's CDN. A second font
  host delayed the page enough under load that a WebKit touch-snap test missed its window twice; self-hosted,
  the suite went green, and the page no longer waits on someone else's server to settle its type.

## 4. The blinking scene

The owner: a few seconds after coming to rest on a page, the scene blinks — then again at the next stop.

Measured: a tier change is visible. Stepping 1 → 2 turns bloom on and brightens the whole picture (3.1% of
pixels change); stepping 2 → 3 changes the render scale and 1.8% of pixels. The governor may only change
tier once the visitor stops (§5.6, never mid-scroll), and it was flapping: scrolling frames are slower than
standing-still ones, so every stop stepped down and every three quiet seconds stepped back up. Over 25 s of
standing still, two changes; it would have continued indefinitely.

Two rules now hold it still:

- **A latched ceiling** (journey-flow review M10, deferred until now): a tier that has proved too slow is
  never returned to for the rest of the visit.
- **A settle window**: step *ups* are allowed only in the first 20 s. Steps down are never time-limited —
  a struggling device still gets help whenever it needs it.

Measured after: one change at 0.7 s, then nothing for the remaining 24 s.

## 5. Also

The on-page "Reduce motion" button is gone at the owner's request; the system setting alone decides, and is
followed live so switching it mid-visit still quiets the page.
