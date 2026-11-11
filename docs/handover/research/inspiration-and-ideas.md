# Inspiration and ideas beyond the renders

Owner, 2026-11-11 (s08): "I don't want us to be confined to just the render, if you get any inspiration or idea
say it." Recorded as D21. Marks: **[read]**, **[search]**, **[mine]**: see `README.md`.

**How these are meant to be used.** Each idea is an option to show running behind a switch (rule 1), judged by the
owner, kept or dropped. None moves a camera or adds a set piece. Almost all ride in materials we already have
(the glow sprites, the sky, the water), so D13's 14 materials hold. Each still needs its cost measured.

## A. One idea for the whole night: follow one lantern [mine]

The lantern is already in three places: you lift one at Golden (I), lanterns drift out at Dusk (III), the projects
sit on lanterns at Night (V). Make it one thread:

- **Golden:** the visitor's hover lifts and lights the lantern. It is "theirs" from then on (a slightly warmer
  colour than every other lantern).
- **Dusk:** it is among the ones drifting out toward the arch, and easy to spot.
- **Blue hour:** a single warm point far out on the flats, among the blue plankton sparks.
- **Night:** it has reached the lagoon, among the project lanterns.
- **Midnight:** one warm speck far below, through a gap in the cloud.
- **Before dawn:** its glow on the wet cave floor, just outside the mouth.
- **First light:** it rests in the shallows, dim, the flame nearly out.
- **Sunrise:** the sun takes over. Contact = "light another one": the send button lifts a new lantern.

Why: a visitor who notices it has a reason to keep scrolling, and the night gets a meaning (your work carried
through the dark to morning) without a word of text. Cost: one more instance in the glow material at each stop.

## B. Real things the sky and light do that the renders do not have

| Idea | Where | What is real | Cost |
|---|---|---|---|
| **The pink band behind you** | Dusk, First light, and the flights that turn away from the sun | Opposite the low sun there is a blue-grey wedge on the horizon (the Earth's shadow) with a pink band above it (the Belt of Venus); the edge is soft, and it is sharper from high up and over the sea [search, atoptics.co.uk]. | A gradient in the sky shader, by compass direction (D17 already does direction). Check first whether the sky photos already carry it. |
| **A surge in the aurora** | Night, Midnight | Strong displays move too fast for 25 fps film [search]. | In `m2-references.md` §1. |
| **A shooting star for those who linger** | any night stop, after about 10 s of rest, then rarely | Meteors are short (under a second), thin, and seldom [mine]. | One stretched sprite. Almost nothing. |
| **A pale moonbow in the falls' spray** | Night | To the eye a moonbow is "a dull white or almost grey arc"; colour appears only in long exposures [search]. Needs the moon behind the viewer and lower than 42°. | An arc in the spray's own shader. Our Night already has an aurora: this may be one wonder too many. Offer, expect a no. |
| **Your shadow with a ring of light on the cloud** | Midnight, on the flight in or out, when the moon is behind the camera | A Brocken spectre: the observer's shadow on mist with a coloured ring (a glory) round its head; photographed by moonlight in Japan's Hida mountains [search, atoptics.co.uk]. | A small ring in the cloud's shader at the point opposite the moon. A quiet surprise for the few who see it. |
| **The moon walks across the night** | Blue hour to Before dawn | The moon rises, climbs and sets like the sun [mine]. | Only preset values, if the nine skies allow it. Fix the missing disc first (s07). |
| **Dew glints** | Sunrise | Low sun on wet grass sparkles point by point [mine]. | A sparkle term in the grass shader facing the sun. |

## C. Life: small moving things, so no stop is a still picture

Game environment artists agree on this [search, 80 Level, RMCAD]: motion in the foreground, the middle and the
background at once; small unscripted moments; drifting things that give scale; "small accents and surprises for
a player to discover" (Andres Rodriguez, Naughty Dog). Our stops have wind and water. They have no creatures.

| Idea | Where | Notes |
|---|---|---|
| Two or three gulls crossing far off | Golden, Sunset, Sunrise | Dark sprites with a wing flap, on slow curved paths. They give the sky its size. |
| Bats, a quick flicker | Dusk | Small, fast, erratic, seen for a second. |
| A flock lifting off the grove | Sunrise | Once, as the stop is reached. The night is over. |
| Rings on still water (a fish, a drop) | First light, the lagoon, the cave puddles | One expanding ring in the water shader every few seconds, at random places. In the cave it is a drip from the roof: the ring breaks the mirror of the mouth. |
| A leaf or petals on the wind | Sunset meadow | A handful of sprites. The pink flowers are already there. |
| Plankton that answers the pointer | Blue hour | Real plankton lights only where the water is disturbed [search]. Moving the pointer over the flats leaves a fading blue trail. The best hover response in the whole site, and true to nature. |
| Fireflies that gather round the pointer | Night | Slowly, and drift off again. |
| Fungi that brighten as the pointer passes | Before dawn | A wave of light through the cluster. |

All of these are the glow or sprite material with different numbers. On touch, a tap does what hover does.

## D. Sound [search: Chrome's autoplay policy, MDN]

Aditya's site has ambience; the spec parks it. What the research says:
- Browsers do not allow sound before a user gesture: create or resume the `AudioContext` inside a click or tap.
- Silent until the visitor opts in; a small, always visible sound toggle; never a surprise.
- A world like this gains more from sound than from any shader [mine]: waves at the cove, wind on the ridge,
  the falls growing louder as the flight nears the lagoon, drips and a hollow echo in the cave, the first birds
  at First light. One loop per place, cross-faded by the same weights that blend the hours.
- Cost: files (about 100–200 kB a loop as Opus or AAC), loaded only after opt-in, so the speed bar is untouched.
- This is an owner decision (question 5 in `milestones-m3-m10.md`).

## E. What the best browser worlds do [search; none of their case studies gave technical detail]

- **Abeto, "Messenger"** (a postman on a tiny planet; three.js; runs on phones): settled the visual style first,
  then planned about seven distinct places. https://www.awwwards.com/messenger.html
  Take: places worth finding things in. Each of our nine should hold one small discovery.
- **Bruno Simon's 2025 portfolio** (rebuilt for WebGPU and TSL; a portfolio you play):
  https://www.awwwards.com/brunos-portfolio-case-study.html , his own account: https://tympanus.net/codrops/?p=100452
  ("Self Doubt and the Quest for Fun"). Take: a portfolio is remembered for how it felt to use.
- **Sleep Well Creative** (Awwwards Site of the Day, January 2026): a scroll-driven illustrated 3D world.
  Listed in https://www.utsubo.com/blog/best-threejs-websites-2026 ("8 Best Three.js Websites of 2026, Technique
  by Technique": worth the owner's ten minutes, it was not read here).
- **Immersive Garden** (Cartier, Longines): three.js with Blender and Houdini assets; case study at
  https://www.awwwards.com/case-study-immersive-gardens-new-website.html (not read).

## F. My order, if only five get built [mine]

1. **The lantern thread (A).** Cheapest, and the only idea that gives the night a story.
2. **Plankton, fireflies and fungi that answer the pointer (C).** Three stops gain a hover response; the spec
   lists "hover targets at the places without text" as open.
3. **Rings on still water and the cave drip (C).** Tiny, and it fixes the stillest stops.
4. **Birds (C).** Scale and life in the three daylight skies.
5. **The shooting star and the aurora surge (B).** Rewards for staying.

Then sound (D), if the owner says yes: the largest single gain in feel, and its own small design.

Not recommended now: the moonbow (too much beside the aurora), ray-marched light shafts in the cave (cost).

## When

None of this belongs in M2. The pointer responses and the life layer fit the place milestones (M3–M7), one stop
at a time; the lantern thread is a line in each of those plans; sound is M8 or its own milestone.
