# Sound: a one-page design (M8 Task 9, for the owner's yes before any build)

Sources: Amendment 1 §8 (D23), reference book §11, owner-references §15, inspiration-and-ideas D, research sheet §3.2.

## 1. The rules
- **Silent until the visitor asks.** No sound plays and no audio file downloads before the tap. The browser only
  allows sound after a tap anyway; the `AudioContext` is made inside that tap.
- **A toggle always in view:** a small speaker button at the right end of the masthead (`header.masthead`), "Sound
  off" / "Sound on", a keyboard button with `aria-pressed`. It remembers the choice for the visit (sessionStorage,
  like the lantern thread), never across visits. Reduced motion does not mute.
- **Ambience only, no music** (owner §15: music is its own decision later).
- **Outside the speed bar:** files fetch after the tap, the current place first, then the rest by nearness.

## 2. Files (Pixabay, owner §15; each file's page URL and author in `tools/world/sources.json`)
One loop per place, AAC `.m4a`, mono, 48 kbit/s, 20–40 s, cut to loop without a seam: about 150–250 kB each.
Total ≈ 1.6–2 MB, fetched only after the tap. Folder: `public/world/sound/`.

| Loop | Heard at | What it is (reference book §11) |
|---|---|---|
| `cove-lap` | Golden, Sunset, First light, Sunrise | calm water lapping on sand; never crashing surf |
| `cove-evening` | Dusk | the same water, quieter, a few crickets in the turf |
| `open-sea` | Blue hour | slow swell against the stacks, a hollow knock under the arch |
| `falls` | Night (placed) | a steady roar; fills the bowl |
| `night-air` | Night, Midnight | a faint breeze and a far owl or insects, very low |
| `ridge-wind` | Midnight | wind over heather and grass, force 2–3 |
| `cave` | Before dawn | room tone, single drips, the sea's echo through the mouth |
| `dawn-chorus` | First light → Sunrise | one or two birds at First light, swelling to a chorus at Sunrise |

## 3. Placement and mixing
- **Hours:** each loop's gain follows the same weights that blend the hours (`hourWeight` in the timeline), so a
  flight cross-fades its two places in its middle third, exactly as the light does. Loops start silent and fade in
  over 2 s; nothing ever cuts.
- **Placed sounds:** the falls and the surf are points in the world (Web Audio `PannerNode`, distance model
  "inverse", a ref distance of 15 m). The falls get louder as the flight up from Blue hour reaches the lagoon and fall
  away up the falls toward Midnight; the surf sits at the cove's shoreline and follows the eye's distance to the water.
- **Wind follows the world state:** the wind loops' gain = the place's Beaufort force (force 0 → silent, 3 → full),
  so the calm cove has almost none and the ridge the most.
- **The dawn chorus grows with the light:** at First light 30 %, at Sunrise 100 %, nothing at night.
- **One master gain** with a soft limiter (a `DynamicsCompressorNode`), overall level quiet (about −20 dBFS
  average): it is a backdrop, never louder than a voice.
- **Hidden tab:** the context suspends when the page is hidden and resumes on return.

## 4. How it is built (Task 9 after the yes)
- `src/sound/` — `mixer.ts` (pure: hour weights + world state + eye position → a gain per loop, unit-tested),
  `engine.ts` (Web Audio: fetch, decode, loop sources, panners, master), `toggle.ts` (the button).
- Tests: no audio fetched before the tap (e2e, network log); gains for each stop and halfway through each flight
  (unit); the toggle by keyboard and its label (e2e).
- Phone check over USB: no frame cost (audio runs off the main thread), memory after decoding (~2 MB of files
  decode to ~25 MB of PCM at 48 kHz mono: acceptable; streaming via `<audio>` elements is the fallback if the phone
  objects).

## 5. My calls (say no to any)
1. Ambience only, no music.
2. The toggle in the masthead's right end, text plus icon.
3. Off by default on every visit; the choice remembered only within the visit.
4. Eight loops as listed; I choose the files and you hear them on the phone before the build is called ready.
