import { uniform } from 'three/tsl';
import { Color, DirectionalLight, HemisphereLight, type Scene, Vector3 } from 'three/webgpu';
import type { SkyAmbient } from '../assets/manifest';
import { sunDir, windVector } from '../journey/hours';
import { type HourPreset, type RGB, toThree, type Vec3, type WorldState } from '../journey/types';
import { lerp } from '../shared/math';
import { createBakedLight } from './baked';

/**
 * Factors from Blender's units to this renderer's, taken from the slice's hand-tuned Golden and Sunset numbers
 * (s02: sun intensity 2.2 for sun_str 3.5, exposure 0.42 for expo 0.5, fog 0.00032 for fog_amt 0.12). Tune by eye.
 */
export const KEY_SCALE = 0.6;
export const EXPOSURE_SCALE = 0.84;
export const FOG_SCALE = 0.0027;
export const FOG_COLOUR_SCALE = 0.65;
export const HEMI_INTENSITY = 2.0;
export const FILL_SHARE = 0.25;
/** What a full aurora adds to the light from the sky (the renders' aurora lit the ground: `light=True`). */
export const AURORA_AMBIENT: RGB = [0.02, 0.1, 0.05];

/**
 * How much of an aurora a moon of this phase leaves (reference book §1: a bright moon washes an aurora out). A
 * crescent (phase up to 0.2 from new) leaves all of it; a full moon (0.5) half.
 */
export function auroraDim(phase: number): number {
  const f = Math.min(phase, 1 - phase);
  return f <= 0.2 ? 1 : lerp(1, 0.5, (f - 0.2) / 0.3);
}

/** Far layers pale at night (design review §3.3): the fog thickens 1.6× once the sun is 18° down (reference book §1). */
export const NIGHT_HAZE = 1.6;

const sstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** The hour's shadow floor in linear light, for the grade (see SHADOW_FLOOR in hours.ts). */
export function shadowFloor(hour: HourPreset): RGB {
  const f = hour.shadowFloor;
  return [toLinear(f[0]), toLinear(f[1]), toLinear(f[2])];
}

/**
 * How far the grade lifts the darkest pixels (Phase 2 Task 14; owner, end of s30: the renders' "true blacks"): `today`
 * the hour's floor as since M2.5, `half` half of it, `zero` none (the renders go to black), `deep` none and the sky's fill
 * and the bounce light halved (s31: with the floor gone, Golden, Blue hour, Before dawn and Sunrise still had almost no
 * near-black pixels; the fill lights every shaded side). `?blacks=` for the owner's A/B.
 */
/**
 * `mid` (owner, s33: "going all black … made every colour we worked so hard on vanish - can we find a middle ground"):
 * the colour of shaded sides comes from the sky's fill, which `deep` halves; `mid` keeps most of it and a third of the
 * floor, so the deepest pixels still go dark. (The owner then chose `today`; `mid` stays as `?blacks=mid`.)
 */
const MID = [0.35, 0.85] as const;
export type Blacks = 'today' | 'half' | 'mid' | 'zero' | 'deep';
const BLACKS_SHARE: Readonly<Record<Blacks, number>> = { today: 1, half: 0.5, mid: MID[0], zero: 0, deep: 0 };
/** How much of the sky's fill and the bounce light each mode keeps. */
export const FILL_SHARE_BY_BLACKS: Readonly<Record<Blacks, number>> = {
  today: 1,
  half: 1,
  mid: MID[1],
  zero: 1,
  deep: 0.5,
};
/**
 * The site's mode from `?blacks=`: `today` unless another is named (owner, end of s33, after testing deep, mid and
 * today: "&blacks=today is better"; s31's default was `deep`, s33's first answer `mid`).
 */
export const blacksMode = (v: string | null): Blacks =>
  v === 'mid' || v === 'half' || v === 'zero' || v === 'deep' ? v : 'today';
/** The floor the grade lifts to under that mode, linear light (a uniform's value: switching builds no shader). */
export function floorFor(hour: HourPreset, mode: Blacks): RGB {
  const k = BLACKS_SHARE[mode];
  const f = shadowFloor(hour);
  return [f[0] * k, f[1] * k, f[2] * k];
}

/**
 * The moon's styled angular diameter (plan M2.5 Task 5: the real 0.52° is lost on a phone; owner night-sky-and-moon
 * 4, 5, 8: a small sharp disc with a soft halo).
 */
export const MOON_SIZE_DEG = 1.6;

/**
 * Pure twin of the sky's moon test: 1 inside a disc of angular radius `r` (radians), 0 outside, for d = cos(angle to
 * its centre). Squared angles (2·(1 − d) ≈ angle²), never cos(r) on the GPU: WGSL's cos is only good to about 5e-4,
 * which erased a 0.45° disc entirely (the s07 "no moon at Midnight" bug).
 */
/** The smallest disc radius the sky works with, radians: size 0 (no moon) would divide by zero. */
export const MIN_MOON_RADIUS = 1e-5;

export function moonCover(d: number, rIn: number): number {
  const r = Math.max(rIn, MIN_MOON_RADIUS); // no moon (size 0) must not make 0/0 at the moon itself
  const x = 2 * (1 - d);
  return 1 - sstep((0.95 * r) ** 2, (1.05 * r) ** 2, x);
}

/**
 * How sharp the sun's or moon's road on the water is: the glint lobe's power for the sea's chop (reference book §3:
 * calmer water gives a narrower road). 220 at force 1's chop (0.55), as plan Task 5 sets; ~400 on a mirror, ~150 at force 2.
 */
export function glitterPower(chop: number): number {
  return (220 * 0.55) / chop;
}

const norm3 = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * Where the crescent's dark disc sits (three.js axes): the moon's own direction turned by 2·r·(lit fraction) straight
 * up the sky, so the lit limb faces the sun below the horizon [mine: at our hours the sun is 30° down and under the
 * moon]. A full moon's dark disc lies a whole diameter away, outside the disc.
 */
function moonShadow(moonDir: Vec3, sizeDeg: number, lit: number): Vec3 {
  const m = norm3(moonDir);
  const up: Vec3 = [-m[0] * m[1], 1 - m[1] * m[1], -m[2] * m[1]];
  const a = norm3(up);
  const s = 2 * (((sizeDeg / 2) * Math.PI) / 180) * lit;
  return norm3([
    m[0] * Math.cos(s) + a[0] * Math.sin(s),
    m[1] * Math.cos(s) + a[1] * Math.sin(s),
    m[2] * Math.cos(s) + a[2] * Math.sin(s),
  ]);
}

/** Everything the materials read about the light this frame; three.js axes. */
export interface LightValues {
  keyDir: Vec3;
  keyColor: RGB;
  keyStrength: number;
  ambSky: RGB;
  ambGround: RGB;
  fogColor: RGB;
  fogDensity: number;
  exposure: number;
  skyGain: number;
  skyTint: RGB;
  skyWeight: number;
  stars: number;
  moonDir: Vec3;
  moonSize: number;
  moonStrength: number;
  /** the crescent's dark disc: a disc of the moon's size centred here hides that part of it */
  moonShadowDir: Vec3;
  /** 0 new … 1 full: the share of the disc that is lit */
  moonLit: number;
  aurora: number;
  cloud: number;
  shadowFloor: RGB;
  /** × HEMI_INTENSITY (hours.ts SKY_FILL) */
  skyFill: number;
  /** × the bounce light's strength (1 but under `?blacks=deep`) */
  fillGain: number;
  /** 0..1: the sea's sun or moon road (HourPreset.road) */
  road: number;
}

const mix3 = (a: RGB, b: RGB, w: number): RGB =>
  w <= 0 ? a : w >= 1 ? b : [lerp(a[0], b[0], w), lerp(a[1], b[1], w), lerp(a[2], b[2], w)];
const scale3 = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const add3 = (a: RGB, b: RGB, k: number): RGB => (k === 0 ? a : [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]);

/** Pure: an hour (already blended) and the two skies' ambient light, mixed by how far b's sky has faded in. */
export function lightValues(
  hour: HourPreset,
  ambA: SkyAmbient,
  ambB: SkyAmbient,
  skyWeight: number,
  blacks: Blacks = 'today',
): LightValues {
  const moon = hour.moon;
  const moonDir: Vec3 = moon ? toThree(sunDir(moon.el, moon.az)) : [0, 1, 0];
  const moonLit = (1 - Math.cos(2 * Math.PI * hour.world.moonPhase)) / 2;
  return {
    keyDir: toThree(hour.key.dir),
    keyColor: hour.key.color,
    keyStrength: hour.key.strength * KEY_SCALE,
    ambSky: add3(mix3(ambA.ambientSky, ambB.ambientSky, skyWeight), AURORA_AMBIENT, hour.aurora),
    ambGround: mix3(ambA.ambientGround, ambB.ambientGround, skyWeight),
    fogColor: scale3(hour.fogColor, FOG_COLOUR_SCALE),
    fogDensity: hour.fogAmount * FOG_SCALE * (1 + (NIGHT_HAZE - 1) * sstep(-6, -18, hour.world.sunEl)),
    exposure: hour.exposure * EXPOSURE_SCALE,
    skyGain: hour.skyGain,
    // coast.py's hybrid style multiplies the sky by (1, 1, 1), whatever sky_tint says
    skyTint: [1, 1, 1],
    skyWeight,
    stars: hour.stars,
    moonDir,
    moonSize: moon ? MOON_SIZE_DEG : 0,
    moonStrength: moon ? moon.strength : 0,
    moonShadowDir: moonShadow(moonDir, MOON_SIZE_DEG, moonLit),
    moonLit,
    aurora: hour.aurora,
    cloud: hour.cloud,
    shadowFloor: floorFor(hour, blacks),
    skyFill: hour.skyFill * FILL_SHARE_BY_BLACKS[blacks],
    fillGain: FILL_SHARE_BY_BLACKS[blacks],
    road: hour.road,
  };
}

/** The shared TSL uniforms every material reads, and the scene's three lights. */
export function createLightUniforms() {
  const u = {
    keyDir: uniform(new Vector3(0, 0.1, -1)),
    keyColor: uniform(new Color(1, 0.62, 0.36)),
    keyStrength: uniform(1),
    ambSky: uniform(new Color(0.3, 0.25, 0.3)),
    ambGround: uniform(new Color(0.1, 0.08, 0.08)),
    fogColor: uniform(new Color(0.5, 0.35, 0.35)),
    fogDensity: uniform(0.00035),
    exposure: uniform(0.42),
    skyGain: uniform(1),
    skyTint: uniform(new Color(1, 1, 1)),
    skyWeight: uniform(0),
    stars: uniform(0),
    moonDir: uniform(new Vector3(0, 1, 0)),
    moonSize: uniform(0),
    moonStrength: uniform(0),
    moonShadowDir: uniform(new Vector3(0, 1, 0)),
    moonLit: uniform(1),
    aurora: uniform(0),
    cloud: uniform(0),
    shadowFloor: uniform(new Color(0.008, 0.008, 0.02)),
    /** × HEMI_INTENSITY for the parts that light themselves (meadow, grove): hours.ts SKY_FILL */
    skyFill: uniform(1),
    /** 0..1: the sea's sun or moon road (HourPreset.road; M8.5 #3b) */
    road: uniform(1),
  };
  const key = new DirectionalLight(0xffffff, 2);
  // The key's light at a point is its colour × the baked shadow there (plan world-to-100 Task 11): one hook, so every
  // standard material (ground, rock, the arch, stacks, cliffs, the bowl) is shadowed alike. three's light node reads
  // `colorNode` when it is made, in place of its colour × intensity uniform, so `apply` sets keyLight instead.
  const baked = createBakedLight();
  const keyLight = uniform(new Color(1, 1, 1));
  (key as unknown as { colorNode: unknown }).colorNode = keyLight.mul(baked.shadow);
  /** Bounce light from the lit sea and sky opposite the key, so shadowed faces keep their shape (slice). */
  const fill = new DirectionalLight(0xffffff, 0.5);
  const hemi = new HemisphereLight(0x8070a0, 0x201810, HEMI_INTENSITY);
  const lights = [key, key.target, fill, fill.target, hemi];

  return {
    ...u,
    lights,
    baked,
    /** Adds the lights to the scene. The fog is boot's: distance fades into the sky's own horizon colour (D17). */
    install(scene: Scene) {
      scene.add(...lights);
    },
    apply(v: LightValues, cameraPosition: Vector3) {
      u.keyDir.value.set(...v.keyDir).normalize();
      u.keyColor.value.setRGB(...v.keyColor);
      u.keyStrength.value = v.keyStrength;
      u.ambSky.value.setRGB(...v.ambSky);
      u.ambGround.value.setRGB(...v.ambGround);
      u.fogColor.value.setRGB(...v.fogColor);
      u.fogDensity.value = v.fogDensity;
      u.exposure.value = v.exposure;
      u.skyGain.value = v.skyGain;
      u.skyTint.value.setRGB(...v.skyTint);
      u.skyWeight.value = v.skyWeight;
      u.stars.value = v.stars;
      u.moonDir.value.set(...v.moonDir).normalize();
      u.moonSize.value = v.moonSize;
      u.moonStrength.value = v.moonStrength;
      u.moonShadowDir.value.set(...v.moonShadowDir).normalize();
      u.moonLit.value = v.moonLit;
      u.road.value = v.road;
      u.aurora.value = v.aurora;
      u.cloud.value = v.cloud;
      u.shadowFloor.value.setRGB(...v.shadowFloor);
      u.skyFill.value = v.skyFill;

      key.color.setRGB(...v.keyColor);
      key.intensity = v.keyStrength;
      keyLight.value.setRGB(...v.keyColor).multiplyScalar(v.keyStrength);
      baked.update(v.keyDir, v.keyStrength);
      key.position.copy(cameraPosition).addScaledVector(u.keyDir.value, 500);
      key.target.position.copy(cameraPosition);
      fill.color.setRGB(...v.ambSky);
      fill.intensity = (v.keyStrength * FILL_SHARE + 0.3) * v.fillGain;
      hemi.intensity = HEMI_INTENSITY * v.skyFill;
      fill.position.set(-u.keyDir.value.x, 0.6, -u.keyDir.value.z).multiplyScalar(500).add(cameraPosition);
      fill.target.position.copy(cameraPosition);
      hemi.color.setRGB(...v.ambSky);
      hemi.groundColor.setRGB(...v.ambGround);
    },
  };
}

export type LightUniforms = ReturnType<typeof createLightUniforms>;

/** The glitter's facets drift along the wind at this speed (reference-book §3: capillary ripples ride the wind). */
export const GLITTER_DRIFT_MS = 0.05;

/**
 * The glitter's offset after `dtS` more seconds: carried frame by frame along the wind's direction (three.js x, z),
 * so a wind that turns during a flight never makes the pattern jump (final review M8; cloudSea's `carried` does the same).
 */
export function glitterCarry(
  off: readonly [number, number],
  world: Pick<WorldState, 'windAz' | 'beaufort'>,
  dtS: number,
): [number, number] {
  const [wx, wy] = windVector(world);
  const wl = Math.hypot(wx, wy) || 1;
  const step = GLITTER_DRIFT_MS * dtS;
  return [off[0] + (wx / wl) * step, off[1] - (wy / wl) * step];
}
