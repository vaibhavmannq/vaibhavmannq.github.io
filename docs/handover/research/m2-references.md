# M2 reference sheet: aurora, sea of cloud, waterfall, cave (plan Task 0, D20)

Marks: **[read]**, **[search]**, **[mine]**: see `README.md`. Links only, no copied pictures.

**Status: a draft, not Task 0 done.** These are named references with someone else's written description. None
was watched or looked at by the builder (it cannot play video). Task 0's first box stays open until the owner has
gone through the watch list.

## The owner's watch list (about 20 minutes; this is what closes Task 0)

For each one, say in a line what you want ours to have and what you do not.

1. Aurora, real time: Ole Salomonsen, "Soaring" (Tromsø, Sony a7S, 25 fps, no time-lapse).
   https://www.universetoday.com/articles/soar-with-the-aurora-in-this-breathtaking-real-time-video
2. Aurora, real time: Thierry Legault, Norway 2014.
   https://www.universetoday.com/articles/incredible-fast-moving-aurora-captured-in-real-time-by-thierry-legault
3. Aurora, real time, no noise reduction: Anders Mildestveit, Tromsø.
   https://petapixel.com/2014/10/21/video-aurora-borealis-real-time-shot-sony-a7s-iso-25600-noise-reduction
4. Cloud sea under the moon: ESO, "Moonshine like sunshine" (Paranal). https://www.eso.org/public/images/img-4520-cc
5. Cloud sea at night, with the photographer's notes: Canon, "A sea of clouds in the city at night".
   https://snapshot.canon-asia.com/article/en/nailing-the-shot-a-sea-of-clouds-in-the-city-at-night
6. Glow-worm cave: Shaun Jeffers, Ruakuri Cave, Waitomo. https://mymodernmet.com/shaun-jeffers-glow-worms
7. Glow-worm cave in motion: National Geographic video. https://on.natgeo.com/2eO6UEC
8. (For M4, while you are at it) glowing plankton in real time: Kris Williams, Penmon Point, Wales.
   https://petapixel.com/2018/07/06/photographer-captures-the-beauty-of-bioluminescent-plankton

## 1. Aurora (Night, Midnight)

| Reference | What it shows | Take from it |
|---|---|---|
| Ole Salomonsen, "Soaring" [search] | Real-time aurora at 25 fps. He says strong displays move "far too fast" for time-lapse, and some streaks outran even 25 fps. | The true speed range. Quiet glow most of the time, then fast ripples along the curtain. |
| Thierry Legault, Norway 2014 [search] | "The true rhythm of the aurora", with stars twinkling and trees moving in the wind in the same shot. | The aurora's motion is judged against other motion in the frame. Our stars should twinkle a little and the grass move, or the aurora looks pasted on. |
| Anders Mildestveit [search] | ISO 25 600, no noise reduction: what a camera really sees. | Real footage is grainy and not saturated. Our render is cleaner and brighter than life; that is a style choice (D2), not an error. |
| Jon Kerr, northern Finland [search] | Real-time shimmer. https://www.universetoday.com/articles/watch-the-aurora-shimmer-and-dance-in-real-time | Sideways shimmer of the rays. |

**Colours by height [mine, standard aurora physics, no source opened]:** the green body is oxygen at about
100–150 km; red is oxygen above about 200 km; blue-violet tops and a pink or magenta fringe at the very bottom
edge are nitrogen, the fringe showing in active displays. D4's "yellow-green foot, rays fading to violet" agrees.
A thin pink lower fringe during the fast moments is a real detail we could offer the owner as an option.

**Technique.**
- Only ray-marched auroras exist for the browser [search]: one WGSL shader samples 32 slices through the height
  band per sky ray (https://www.shadcn.io/shaders/aurora-3d-shader). That is 32 noise reads on every sky pixel.
- Our ribbon mesh costs pixels only where the aurora is and follows folds that swing back on themselves. No
  source contradicts the choice. Its known weakness is additive overdraw where folds overlap [mine]: that is
  the number to read in Task 7.
- Lawlor and Genetti, "Interactive Volume Rendering Aurora on the GPU" (2011): the display factors into a 2D
  footprint (splines on the ground) times a height-dependent emission curve [search]. Same split as ours:
  `aurora.json` is the footprint, the fragment shader is the height curve. The paper's numbers were not read
  (host unreachable). https://hgpu.org/?p=3188 lists it.

**What to change when re-judging [mine]:**
1. Add a second motion state: every 20–40 s, for a few seconds, a brighter ripple runs along the foot at about
   10× the drift speed, with the ray noise sliding faster. Show the owner both (always slow / slow with ripples).
2. The "thin bright spikes" the ledger dislikes: real rays are soft columns. Widen the brightest rays instead of
   only dimming them (lower the ray noise's contrast near its peaks).
3. Violet tops fainter than the render: raise the top colour's gain before changing its hue.

## 2. Sea of cloud (Midnight)

| Reference | What it shows | Take from it |
|---|---|---|
| ESO, "Moonshine like sunshine" [search] | Moonlight on a thin cloud sea from a mountain observatory; a "double horizon". | A moonlit deck has a bright road toward the moon, like the sun's road on water. This is the "moon glow on it" the ledger misses. |
| Canon Asia, sea of clouds at night [search] | A photographer's notes; "a sea of clouds usually doesn't look as bright in real life as it does in photos". | Photos are long exposures. Ours is a styled night (D2): bright is allowed, but keep the darks. |
| Michael Frye, moonlit clouds [search] https://www.michaelfrye.com/?p=20751 | Low-angle moonlight gives gold, orange and pink like a sunset. | Our moon is low at Midnight: a warm edge on the billows facing it is real, not a mistake. |
| Cloud inversion, the physics [search] | Warm air above cold air traps the cloud in the valleys. | The top is flat on the large scale and lumpy on the small scale, and it laps at ridges. Matches the plan. |

**Technique.**
- No published mesh-deck technique was found. The volumetric line (Horizon Zero Dawn, SIGGRAPH 2015; Frostbite,
  SIGGRAPH 2016) is the film-quality answer and too dear for a phone at full screen: three's own small volume
  cloud is up to 300 texture reads per pixel [read].
- So the displaced grid stays. What the ledger calls "satin, a little like snow" is missing small-scale light,
  not missing geometry [mine]:
  1. **Light through the bumps.** Snow is lit on the face toward the light and dark behind. Cloud glows on the
     thin edges facing away from the light. Add a term that brightens thin crests when looking toward the moon
     (the plan's rim term, made much wider and tied to how high the vertex is above the mean deck).
  2. **Dark between the billows.** Darken by how far a point sits below the local mean height (the valleys
     between billows are deep in shadow). Costs one subtraction; reads as cotton at once.
  3. **Detail in the fragment shader only,** two octaves, faded with distance, as the plan says. Do it before
     any finer mesh.
  4. **Soft shores by depth,** if the height-texture shore still shows a line: fade by scene depth behind the
     pixel (see `threejs-r186-notes.md` 2.2). Costs a depth copy.
- The two thin layers under the deck (spec §9.10) are the last resort. They double the overdraw.

## 3. Waterfall (Night)

| Reference | What it shows | Take from it |
|---|---|---|
| Unity, "Nature shaders with Shader Graph" [search] https://unity.com/blog/engine-platform/nature-shaders-with-shader-graph-in-2022-lts | Two meshes: the falling sheet and a disc for ripples. Two noise layers: large and slow, small and fast. | Confirms the plan's two layers and the foam disc. |
| 80 Level, "Creating a Stylized Waterfall in Unity, part 4" [search] https://80.lv/articles/creating-a-stylized-waterfall-in-unity-part-4 | Cut-out, not blended: each pixel is water, foam or nothing. | **A cut-out sheet needs no sorting** against the aurora, the spray and the lagoon's mirror. Our plan blends. If the sheet sorts wrongly anywhere, switch to an alpha cut with a dithered edge. |
| Real Time VFX, "Sketch #49: Waterfall" [search] https://realtimevfx.com/t/sketch-49-waterfall/19243 | Many artists' breakdowns; mist, bubbles and spray added on top of the shader. One warning: do not vary the noise's scale along a panning noise. | Our "falling speed grows down the drop" must stretch the **offset**, not the scale, or the streaks swim. Check `waterfall.ts` for this. |
| The Rookies, a Rime-inspired waterfall [search] https://discover.therookies.co/2019/11/05/stylized-vfx-in-unity-a-rime-inspired-waterfall/ | Full breakdown of a stylised fall. | Foam where water lands, mist as separate particles. |

**Real falls at night [mine]:** under the moon a fall is a pale grey-blue veil, brightest at the top where the
sheet is thin and catches the light, and it loses itself in mist at the bottom. The base is the brightest and
softest part. The plan's "the sheet is the brightest thing in the crater but not self-lit" agrees.
No real-footage reference was found for moonlit falls: a gap for the owner or a later search ("moonbow",
"Yosemite Falls moonlight real time").

## 4. Cave (Before dawn)

| Reference | What it shows | Take from it |
|---|---|---|
| Shaun Jeffers, Ruakuri Cave [search] | Glow-worms as "tranquil, illuminated blue" scenes; he stood six to eight hours in cold water for them. | Blue-green points in thousands, like a night sky on the rock. Points, not lamps. |
| Other Waitomo photographers [search] | 30 s exposures at ISO 6 400 to 32 000. | To the eye the worms are faint. They never light the rock; the rock is seen as a shape against them. Our `fungiLight` on the rock should be small: a hint within about 0.3 m, no more. |
| A cave photographer's note [search] https://fujilove.com/2-8-minutes-in-the-inky-black-nature-photography-underground/ | "The entrances to caves provide the best opportunities for photography, especially toward dusk." | The mouth is the picture. Expose for it; the inside is a frame. Matches the plan. |

**Our fungi are not glow-worms** (the render has fungi and vines), but the rule carries: many small points of
different sizes and brightness, in clusters with empty rock between, none of them evenly spaced [mine].

**Wet floor [mine]:** a still puddle mirrors the bright mouth sharply; wet rock beside it shows only a streak
toward the mouth. The contrast between the two is what reads as "wet". The plan has both.

## 5. What this changes in the plan (to write into the ledger when re-judging)

1. Aurora: a second, faster motion state as an option; soften the spike rays.
2. Cloud: crest glow toward the moon, dark between billows, fragment detail; no finer mesh yet.
3. Waterfall: check that the speed-up down the drop is an offset, not a scale; keep a cut-out sheet in reserve.
4. Cave: keep the fungi's light on the rock small; vary the fungi's size and brightness.
5. Stars should twinkle slightly wherever the aurora shows (motion needs company).
