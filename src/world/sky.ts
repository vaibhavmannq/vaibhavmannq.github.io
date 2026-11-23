import {
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
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import {
  BackSide,
  type DataTexture,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  SphereGeometry,
  type Texture,
  Vector2,
  Vector3,
} from 'three/webgpu';
import type { SkyStore } from '../assets/skies';
import { windVector } from '../journey/hours';
import { SHOTS } from '../journey/shots';
import { STOP_IDS } from '../journey/types';
import { type LightUniforms, MIN_MOON_RADIUS } from './light';
import type { WorldPart } from './part';
import { PHOTO_CEILING, photoDrift, type SkyMode, usesClearSky } from './skyClouds';
import { createCloudLayer } from './skyLayer';
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

/** The blurred copy the drifting sky keeps its broad light from: 2048 → 64 texels across (≈ 6° each). */
const LOW_MIP = 5;

/** Where the painted horizon rows are read: inside the bottom HORIZON_ROWS (6) rows of a 1024-row photo. */
const HORIZON_V = 2.5 / 1024;

export interface Sky extends WorldPart {
  /** The sky colour seen along a direction (three.js axes), for reflections in water and wet sand. */
  colorAt(dir: V3): V3;
  /** The sky's soft colour at the horizon in the compass direction of `dir`: what distant things fade into. */
  horizonAt(dir: V3): V3;
}

/** A stop's eye in three.js axes (x east, y up, z = -north). */
const eyeOf = (i: number): [number, number, number] => {
  const s = SHOTS[STOP_IDS[i] ?? 'golden'];
  return [s.cam[0], s.eyeZ, -s.cam[1]];
};

export function createSky(
  u: LightUniforms,
  skies: SkyStore,
  first: Texture,
  mode: SkyMode = 'photo',
  cloudMap?: DataTexture,
): Sky & { cloudsReady(): void } {
  // each slot its own binding, so the shaders built at a stop (one texture in both) serve the flights (R121)
  const texA = slotTexture(first, 'sky-a');
  const texB = slotTexture(first, 'sky-b');
  // M8.5 #3a: the eyes the two photos were made for and the drift of the photo's ceiling (`drift`)
  const eyeA = uniform(new Vector3(...eyeOf(0)));
  const eyeB = uniform(new Vector3(...eyeOf(0)));
  const drift = uniform(new Vector2());
  let carried = 0;

  /** `drift`: the direction from the photo's own eye to where `d` meets the (drifted) ceiling; `d` itself low down. */
  const onCeiling = (d: V3, eye: V3): V3 => {
    const up = d.y.max(0.02);
    const t = float(PHOTO_CEILING).sub(cameraPosition.y).div(up);
    const hit = cameraPosition.add(d.mul(t)).add(vec3(drift.x, 0, drift.y));
    return normalize(mix(d, normalize(hit.sub(eye)), smoothstep(0.015, 0.12, d.y)));
  };

  /**
   * The sky seen along `dir`. `drifting`: only for the dome itself (s31: the ground's wet sheen, the cave and the vines
   * read the sky too, every pixel; with the drift's six reads there, the whole night got 0.3–1.7 ms slower at low). The
   * water's mirror redraws the dome, so its reflections drift anyway.
   */
  // one photo except while the two skies blend (s31, 11d: the second photo's three reads on every sky pixel cost the
  // phone ~2 fps on the ride into the cave); a uniform branch with explicit levels, built inside an Fn (TSL's If needs one)
  const driftSky = Fn(([d]: [V3]) => {
    const here = equirectUV(d);
    const moved = (tex: typeof texA, eye: V3): V3 => {
      const at = equirectUV(onCeiling(d, eye));
      const ratio = decode(tex.sample(here).level(float(LOW_MIP)).rgb).div(
        decode(tex.sample(at).level(float(LOW_MIP)).rgb).max(1e-4),
      );
      return decode(tex.sample(at).level(float(0)).rgb).mul(ratio.clamp(0.25, 4));
    };
    const out = vec3(0).toVar();
    If(u.skyWeight.lessThan(0.001), () => {
      out.assign(moved(texA, eyeA));
    })
      .ElseIf(u.skyWeight.greaterThan(0.999), () => {
        out.assign(moved(texB, eyeB));
      })
      .Else(() => {
        out.assign(mix(moved(texA, eyeA), moved(texB, eyeB), u.skyWeight));
      });
    return out;
  });

  const colorAt = (dir: V3, row?: number, drifting = false): V3 => {
    if (drifting && mode === 'drift' && row === undefined) {
      // Phase 2 Task 12: only the photo's detail (its clouds) moves with the ceiling; its broad light (the gradient and
      // the sun's glow, the blurred copy at mip LOW_MIP) stays where it is, as the real sky's would
      return (driftSky(dir) as unknown as V3).mul(u.skyGain).mul(u.skyTint);
    }
    const st = row === undefined ? equirectUV(dir) : vec2(equirectUV(dir).x, row);
    // level 0 always: with the drift's mipmaps an auto level would blur along the equirect seam (u wraps)
    return mix(decode(texA.sample(st).level(float(0)).rgb), decode(texB.sample(st).level(float(0)).rgb), u.skyWeight)
      .mul(u.skyGain)
      .mul(u.skyTint);
  };

  // Far things fade into the sky's soft horizon colour in their compass direction (horizonAt, used as the scene's fog),
  // and the sky below the horizon is that same colour: the far sea and land meet the sky with no line, whatever the
  // hour (M0 look note). The soft colours are painted into each photo's bottom rows when it is decoded (skyHorizon.ts).
  const horizonAt = (d: V3): V3 => colorAt(normalize(vec3(d.x, 0, d.z)), HORIZON_V);
  const dir = normalize(positionWorld.sub(cameraPosition));
  let col = mix(colorAt(dir, undefined, true), horizonAt(dir), smoothstep(0.0, -0.025, dir.y));

  // The sun's disc, only while the key light is the sun (at night the key is the moon, drawn below), and not while the
  // key swings from one light to another (M8.5 #3b: a false sun crossed Blue hour → Night's sky, mirrored as a blob).
  const isSun = float(1).sub(step(0.001, u.moonStrength));
  const sunDisc = smoothstep(0.999984, 0.999994, dot(dir, u.keyDir))
    .mul(40.0)
    .mul(min(u.keyStrength, 1))
    .mul(isSun)
    .mul(u.road);
  col = col.add(u.keyColor.mul(sunDisc));

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

  // Task 12 (s32): our own clouds over the clear sky (skyLayer.ts), over the sun, moon and stars too
  const clouds = !cloudMap
    ? null
    : mode === 'band'
      ? null // dense cards carry even the overcast hours; the photo keeps its own low deck (s32: the deck cost ~1 ms)
      : mode === 'cards'
        ? // the cards carry scattered cloud; only an overcast hour's deck is drawn behind them
          createCloudLayer(u, cloudMap, 'deck', colorAt, (c) => Math.min(1, Math.max(0, (c - 0.55) * 3)))
        : createCloudLayer(u, cloudMap, mode, colorAt);
  if (clouds) col = clouds.over(colorAt(dir), col, dir);

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
    cloudsReady: () => clouds?.ready(),
    update(f) {
      skies.update(f.state);
      texA.value = skies.get(f.state.a);
      texB.value = skies.get(f.state.b);
      mesh.position.set(...f.pose.position);
      clouds?.update(f.state.a, f.state.b, u.skyWeight.value, windVector(f.hour.world), f.dtS);
      if (mode === 'drift') {
        eyeA.value.set(...eyeOf(f.state.a));
        eyeB.value.set(...eyeOf(f.state.b));
        // aloft the wind is ~3x the ground's (coast x east, y north; three.js z is -north)
        const [wx, wy] = windVector(f.hour.world).map((v) => v * 3) as [number, number];
        const speed = Math.hypot(wx, wy);
        carried += speed * f.dtS;
        const k = speed > 1e-6 ? photoDrift(carried) / speed : 0;
        drift.value.set(wx * k, -wy * k);
      }
    },
    setTier() {},
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
