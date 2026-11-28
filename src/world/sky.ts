import {
  atan,
  cameraPosition,
  dot,
  equirectUV,
  exp,
  Fn,
  float,
  floor,
  fract,
  fwidth,
  If,
  length,
  max,
  min,
  mix,
  normalize,
  positionWorld,
  sin,
  smoothstep,
  step,
  time,
  vec2,
  vec3,
} from 'three/tsl';
import { BackSide, Mesh, MeshBasicNodeMaterial, type Node, SphereGeometry, type Texture } from 'three/webgpu';
import type { SkyStore } from '../assets/skies';
import { type LightUniforms, MIN_MOON_RADIUS } from './light';
import type { WorldPart } from './part';
import { slotTexture } from './slotTexture';

type V3 = Node<'vec3'>;
type F = Node<'float'>;

/** The sky files store e = (x / (1 + x))^(1/2.2) (tools/world/prep_sky.py); this gives x back. */
const decode = (e: V3): V3 => {
  const p = e.pow(2.2);
  return p.div(float(1).sub(p).max(0.03));
};

/** A hash of a 3D cell: a repeatable random number per cell. */
const hash3 = (c: V3): F => fract(sin(dot(c, vec3(127.1, 311.7, 74.7))).mul(43758.5453));

/** Where the painted horizon rows are read: inside the bottom HORIZON_ROWS (6) rows of a 1024-row photo. */
const HORIZON_V = 2.5 / 1024;

/** The gold lobe toward a low sun: strength, width (1 − cos), height (in y); picked against the render (s33, R241). */
const GLOW = [1.6, 0.25, 0.18] as const;

/** The sun's aureole: core, skirt, wide strengths (s33, R241). */
const AUR = [2, 0.6, 0.12] as const;

/**
 * The violet high sky (Task 16h): strength, brightness kept (× the sky's own), from and to which height (dir.y) it
 * comes in. `?violet=a,b,c,d` while tuning (s34).
 */
const VIOLET: number[] = [0.55, 0.9, 0.08, 0.55];
{
  const q = typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('violet') ?? '');
  q.split(',').forEach((v, i) => {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n) && i < VIOLET.length) VIOLET[i] = n;
  });
}
/** Violet at unit brightness, linear light (the render's overhead: ~#6a4a9a). */
const VIOLET_HUE = vec3(0.141, 0.069, 0.325).div(0.2126 * 0.141 + 0.7152 * 0.069 + 0.0722 * 0.325);

/**
 * The crepuscular rays: strength, reach (1 − cos: 0.1 ≈ 26°), how much a shadow beam darkens, how much a light beam
 * adds of the sun's gold, drift (radians of fan per second). `?rays=a,b,c,d,e` while tuning (s34).
 */
const RAYS: number[] = [2, 0.11, 0.25, 0.65, 0.004];
/** Golden's share of the rays' strength, and how much higher they reach there (`?rg=a,b` while tuning, s34). */
const RAYS_GOLDEN: number[] = [0.8, 0];
{
  const q = typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('rays') ?? '');
  q.split(',').forEach((v, i) => {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n) && i < RAYS.length) RAYS[i] = n;
  });
  const g = typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('rg') ?? '');
  g.split(',').forEach((v, i) => {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n) && i < RAYS_GOLDEN.length) RAYS_GOLDEN[i] = n;
  });
}

export interface Sky extends WorldPart {
  /** The sky colour seen along a direction (three.js axes), for reflections in water and wet sand. */
  colorAt(dir: V3): V3;
  /** The sky's soft colour at the horizon in the compass direction of `dir`: what distant things fade into. */
  horizonAt(dir: V3): V3;
}

export function createSky(u: LightUniforms, skies: SkyStore, first: Texture): Sky {
  // each slot its own binding, so the shaders built at a stop (one texture in both) serve the flights (R121)
  const texA = slotTexture(first, 'sky-a');
  const texB = slotTexture(first, 'sky-b');

  // Task 16b (s33; the Sunset render: gold toward the sun along the horizon, violet overhead and away; reference book
  // §light): under a low sun the haze toward it glows gold, a lobe ~40° wide hugging the horizon. In the sky's own
  // colour, so the fog, the water's reflections and the clouds' fade agree with it. Only from the sun, only when low.
  const sunFlat = normalize(vec3(u.keyDir.x, 0, u.keyDir.z).add(vec3(0.0001, 0, 0)));
  const glowOn = smoothstep(0.42, 0.04, u.keyDir.y)
    .mul(smoothstep(-0.1, -0.015, u.keyDir.y))
    .mul(float(1).sub(step(0.001, u.moonStrength)))
    .mul(min(u.keyStrength, 1));
  // the rays reach up to Golden's 3.6° sun (s34); the violet stays Sunset's
  const raysOn = glowOn.mul(smoothstep(0.1, 0.05, u.keyDir.y));
  const violetOn = glowOn
    .mul(smoothstep(0.06, 0.03, u.keyDir.y))
    .mul(
      (typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('s34off') ?? '')).includes(
        'sky',
      )
        ? 0
        : 1,
    );
  const keyCol = u.keyColor as unknown as V3;
  const glowHue = mix(keyCol.div(dot(keyCol, vec3(0.2126, 0.7152, 0.0722)).max(1e-3)), vec3(1.45, 0.9, 0.3), 0.6);
  /** The sky's colour `c` along `dir`, turned gold and lifted toward a low sun (its own brightness kept as the scale). */
  // Every material's haze reads colorAt, so the glow's maths sits behind a uniform branch: skipped at every hour whose
  // sun is not low and up (s33: the night stops paid +0.3–0.9 ms at low for a glow of 0). Values are passed in, not read
  // through a closure (the Fn body runs when the shader is built; s32 lesson).
  const glowFn = Fn(([c, dir]: [V3, V3]) => {
    const out = vec3(0).toVar();
    out.assign(c);
    If(glowOn.greaterThan(0.001), () => {
      const flat = normalize(vec3(dir.x, 0, dir.z).add(vec3(0.0001, 0, 0)));
      const across = float(1).sub(dot(flat, sunFlat)); // 0 toward the sun; ~0.13 at 30°
      const lobe = across.div(GLOW[1]).negate().exp().mul(dir.y.max(0).div(GLOW[2]).negate().exp()).mul(glowOn);
      const gold = glowHue.mul(dot(c, vec3(0.2126, 0.7152, 0.0722)));
      out.assign(mix(c, gold, lobe.mul(GLOW[0]).min(1)).mul(lobe.mul(GLOW[0]).mul(0.15).add(1)));
      // Task 16h (s34; the Sunset render: violet overhead and away from the sun; reference book §light: once the sun is
      // on the horizon the high sky is lit only through the long path, its red and blue left, the green taken by ozone).
      // The high sky turns violet at its own brightness, a little deeper; the gold lobe keeps its side. Only a sun on the
      // horizon (Sunset), as the rays. The clouds read this colour, so their tops away from the sun follow.
      // (its own function, violetFn: the haze every material reads per pixel is at the horizon, where it is 0; s34 phone)
    });
    return out;
  });
  const violetFn = Fn(([c, dir]: [V3, V3]) => {
    const out = vec3(0).toVar();
    out.assign(c);
    If(violetOn.greaterThan(0.001), () => {
      const flat = normalize(vec3(dir.x, 0, dir.z).add(vec3(0.0001, 0, 0)));
      const across = float(1).sub(dot(flat, sunFlat));
      const lobe = across.div(GLOW[1]).negate().exp().mul(dir.y.max(0).div(GLOW[2]).negate().exp()).mul(glowOn);
      const high = smoothstep(VIOLET[2], VIOLET[3], dir.y)
        .mul(float(1).sub(lobe.mul(GLOW[0]).min(1)))
        .mul(violetOn)
        .mul(VIOLET[0]);
      const lc = dot(c, vec3(0.2126, 0.7152, 0.0722));
      out.assign(mix(c, VIOLET_HUE.mul(lc.mul(VIOLET[1])), high));
    });
    return out;
  });
  const horizonGlow = (c: V3, dir: V3): V3 => glowFn(c, dir) as unknown as V3;
  const colorAt = (dir: V3, row?: number): V3 => {
    const st = row === undefined ? equirectUV(dir) : vec2(equirectUV(dir).x, row);
    const glowed = horizonGlow(
      mix(decode(texA.sample(st).level(float(0)).rgb), decode(texB.sample(st).level(float(0)).rgb), u.skyWeight)
        .mul(u.skyGain)
        .mul(u.skyTint),
      dir,
    );
    // the horizon row (the haze) is never violet: skip it there
    return row === undefined ? (violetFn(glowed, dir) as unknown as V3) : glowed;
  };

  // Far things fade into the sky's soft horizon colour in their compass direction (horizonAt, used as the scene's fog),
  // and the sky below the horizon is that same colour: the far sea and land meet the sky with no line, whatever the
  // hour (M0 look note). The soft colours are painted into each photo's bottom rows when it is decoded (skyHorizon.ts).
  const horizonAt = (d: V3): V3 => colorAt(normalize(vec3(d.x, 0, d.z)), HORIZON_V);
  const dir = normalize(positionWorld.sub(cameraPosition));
  let col = mix(colorAt(dir), horizonAt(dir), smoothstep(0.0, -0.025, dir.y));

  // The sun's disc, only while the key light is the sun (at night the key is the moon, drawn below), and not while the
  // key swings from one light to another (M8.5 #3b: a false sun crossed Blue hour → Night's sky, mirrored as a blob).
  const isSun = float(1).sub(step(0.001, u.moonStrength));
  const sunDisc = smoothstep(0.999984, 0.999994, dot(dir, u.keyDir))
    .mul(40.0)
    .mul(min(u.keyStrength, 1))
    .mul(isSun)
    .mul(u.road);
  col = col.add(u.keyColor.mul(sunDisc));
  // The sun's aureole (Task 16b, s33; the Sunset render's hot gold bloom; reference book §light: forward scattering by
  // haze, a bright core ~2° and a wide skirt ~10°, strongest when the sun is low and its light crosses the most air).
  // The clear-sky copies (R235) blurred the photos' own aureole away; this puts it back, the sun's colour, not white.
  const cosSun = max(dot(dir, u.keyDir), 0);
  const low = smoothstep(0.45, 0.02, u.keyDir.y);
  const aureole = cosSun
    .pow(2000)
    .mul(AUR[0])
    .add(cosSun.pow(180).mul(AUR[1]))
    .add(cosSun.pow(18).mul(AUR[2]))
    .mul(min(u.keyStrength, 1))
    .mul(isSun)
    .mul(u.road)
    .mul(low)
    .mul(smoothstep(-0.04, 0.01, dir.y));
  col = col.add(u.keyColor.mul(aureole));

  // Crepuscular rays (Task 16g, s34; reference book §light): a low sun behind cloud past the horizon throws a fan of
  // light and shadow beams across the hazy sky, radiating from the sun, strongest 3-30° from it, gone by ~60°. Each beam
  // is a direction around the sun (its polar angle), so the fan is a sum of whole-number sines of that angle (no seam),
  // drifting slowly as the far clouds do. Light beams take the sun's gold, shadow beams only darken. Drawn on the dome
  // alone, so the sea's mirror shows them and nothing else pays; behind the glow's uniform branch.
  const raysFn = Fn(([c, d]: [V3, V3]) => {
    const out = vec3(0).toVar();
    out.assign(c);
    // only pixels in the low cone round the sun pay for the angle and the sines (s34 phone: II -> III)
    const inCone = raysOn
      .greaterThan(0.001)
      .and(dot(d, u.keyDir as unknown as V3).greaterThan(1 - 6 * RAYS[1]))
      .and(d.y.lessThan(0.42))
      .and(d.y.greaterThan(-0.005));
    If(inCone, () => {
      const s = normalize(u.keyDir as unknown as V3);
      const up = normalize(
        vec3(0, 1, 0)
          .sub(s.mul(s.y))
          .add(vec3(0, 0.0001, 0)),
      );
      const right = s.cross(up);
      const around = atan(dot(d, right), dot(d, up));
      const drift = time.mul(RAYS[4]);
      const beam = sin(around.mul(11).add(drift))
        .add(sin(around.mul(23).sub(drift.mul(1.7)).add(1.3)).mul(0.7))
        .add(sin(around.mul(41).add(drift.mul(0.6)).add(4.1)).mul(0.45))
        .add(sin(around.mul(67).add(2.6)).mul(0.3));
      // a few distinct beams of uneven width with wide gaps, not a regular sunburst: only the sum's tops are light beams,
      // only its troughs shadow; most of the fan is the sky as it was
      const lit = smoothstep(0.7, 1.9, beam)
        .sub(smoothstep(-0.9, -2.0, beam).mul(0.8))
        .add(0.5);
      const x = float(1).sub(dot(d, s)); // 1 − cos of the angle to the sun
      const reach = smoothstep(0.0012, 0.008, x)
        .mul(x.div(RAYS[1]).negate().exp())
        .mul(smoothstep(-0.005, 0.05, d.y))
        // the beams live in the low haze: gone by ~25 deg up (looking up, they read as searchlights; s34)
        .mul(smoothstep(0.42, 0.12, d.y))
        .mul(glowOn)
        // full for a sun on the horizon (Sunset 1°); Golden's 3.6° sun takes its own share (s34: at Sunset's strength
        // the fan read as a hard white sunburst there; the Golden render's rays are softer and reach higher)
        .mul(mix(float(RAYS_GOLDEN[0]), float(1), smoothstep(0.06, 0.03, s.y)))
        .mul(
          float(1).add(
            smoothstep(0.035, 0.06, s.y)
              .mul(RAYS_GOLDEN[1])
              .mul(smoothstep(0.42, 0.12, d.y).oneMinus()),
          ),
        );
      const k = reach.mul(RAYS[0]);
      const gold = glowHue.mul(dot(c, vec3(0.2126, 0.7152, 0.0722)));
      // lit: 0.5 the sky as it was, up to 1.5 a light beam, down to −0.3 a shadow one
      out.assign(
        c
          .mul(float(1).sub(k.mul(RAYS[2]).mul(float(0.5).sub(lit).max(0))))
          .add(gold.mul(k.mul(RAYS[3]).mul(lit.sub(0.5).max(0)))),
      );
    });
    return out;
  });
  col = raysFn(col, dir) as unknown as V3;

  // The moon (owner night-sky-and-moon 3, 4, 5, 8): a small sharp disc, lit as a crescent by its phase, the dark part
  // faintly grey (earthshine), a soft halo that lights the sky and cloud beside it. Tested on squared angles
  // (light.ts moonCover): WGSL's cos is only good to ~5e-4, which erased the disc before (s07 bug).
  const radius = u.moonSize.mul(Math.PI / 360).max(MIN_MOON_RADIUS); // size 0: no NaN at the zenith (final review M12)
  const r2a = radius.mul(0.95).pow(2);
  const r2b = radius.mul(1.05).pow(2);
  const toMoon = float(1).sub(dot(dir, u.moonDir)).mul(2);
  const disc = float(1).sub(smoothstep(r2a, r2b, toMoon));
  const moonDark = float(1).sub(smoothstep(r2a, r2b, float(1).sub(dot(dir, u.moonShadowDir)).mul(2)));
  const moonLitPart = disc.mul(float(1).sub(moonDark));
  const earthshine = disc.mul(moonDark).mul(0.035);
  const halo = toMoon.max(0).sqrt().div(radius.mul(4)).negate().exp().mul(u.moonLit.mul(0.7).add(0.3)).mul(0.18);
  col = col.add(vec3(1.0, 0.98, 0.94).mul(moonLitPart.add(earthshine)).mul(u.moonStrength).mul(0.1));
  col = col.add(vec3(0.75, 0.82, 1.0).mul(halo).mul(u.moonStrength).mul(0.1));

  // Stars (plan M4 Task 2; reference book §1; research/m4-blue-hour-references.md; owner night-sky-and-moon 1, 2, 7).
  // One candidate star per cell of a fine grid on the sky. Each has a magnitude from its hash, drawn so every step
  // fainter holds about 2.7× more stars, and it shows only where it outshines the sky behind it. So the brightest come
  // out first, the dark side of a twilight sky fills before the glow, and Night's dark sky holds a dense field, with no
  // per-hour count. Size grows with brightness and is never under a pixel (a smaller star crawls as the camera moves).
  // Colour by temperature: most white to pale orange, a few blue-white. Twinkle is stronger near the horizon.
  // Only an hour with stars pays for them (s17: the field cost ~1 ms at mid on this laptop at every stop): a uniform
  // branch, so the derivative inside stays in uniform control flow.
  // the sky the stars must outshine, fixed here: the Fn body runs when the shader is built, when `col` already holds the
  // clouds drawn over the stars (s32: read through the closure, the whole cloud layer was built inside the stars' If)
  const skyBehindStars = col;
  const starField = Fn(() => {
    const stars = vec3(0).toVar();
    If(u.stars.greaterThan(0.01), () => {
      const p = dir.mul(330.0);
      const cell = floor(p);
      const centre = vec3(hash3(cell), hash3(cell.add(17.0)), hash3(cell.add(31.0)))
        .sub(0.5)
        .mul(0.6);
      const cellsPerPx = fwidth(p).length().max(1e-4);
      const dPx = length(fract(p).sub(0.5).sub(centre)).div(cellsPerPx);
      // flux relative to the faintest star a cell can hold: N(< m) ∝ 10^(0.43 m) → flux = u^(−0.4 / 0.43)
      const flux = hash3(cell.add(5.0)).max(1e-4).pow(-0.93).min(600.0);
      const skyLum = dot(skyBehindStars, vec3(0.2126, 0.7152, 0.0722)).max(0.0015);
      // near the horizon a star looks through more air: up to two magnitudes dimmer (×0.16)
      const air = mix(float(0.16), float(1), smoothstep(0.0, 0.25, dir.y)).mul(smoothstep(-0.01, 0.03, dir.y));
      const seen = flux.mul(air).mul(max(u.stars, 0)).mul(0.0002);
      const shows = smoothstep(1.0, 3.0, seen.div(skyLum));
      const rPx = flux.log().mul(0.22).add(0.6).clamp(0.6, 2.2);
      const point = exp(dPx.div(rPx).pow(2).negate());
      const twinkleAmp = mix(float(0.3), float(0.04), smoothstep(0.02, 0.5, dir.y));
      const twinkle = sin(time.mul(hash3(cell.add(23.0)).mul(9.0).add(5.0)).add(hash3(cell.add(29.0)).mul(6.283)))
        .mul(twinkleAmp)
        .add(1);
      const temp = smoothstep(0.08, 0.98, hash3(cell.add(41.0)));
      const starCol = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.8, 0.6), temp);
      const glow = seen.sqrt().mul(0.2).min(1.6);
      stars.assign(starCol.mul(point.mul(shows).mul(glow).mul(twinkle)));
    });
    return stars;
  });
  col = col.add(starField());

  // the clouds (Task 12, s32) are their own part (cloudCards.ts): cards in the world, drawn over this dome

  const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
  material.name = 'sky.material';
  material.colorNode = col;
  const mesh = new Mesh(new SphereGeometry(12000, 64, 32), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  return {
    object: mesh,
    colorAt,
    horizonAt,
    update(f) {
      skies.update(f.state);
      texA.value = skies.get(f.state.a);
      texB.value = skies.get(f.state.b);
      mesh.position.set(...f.pose.position);
    },
    setTier() {},
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
