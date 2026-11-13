import { lerp } from '../shared/math';
import { SHOTS } from './shots';
import {
  type HourPreset,
  type KeyLight,
  type Moon,
  type RGB,
  STOP_IDS,
  type StopId,
  type Vec3,
  type WorldState,
} from './types';

/** coast.py's sun_dir(): toward a light at elevation `el`, azimuth `az` (degrees). */
export function sunDir(el: number, az: number): Vec3 {
  const e = (el * Math.PI) / 180;
  const a = (az * Math.PI) / 180;
  return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
}

/** The moon's lamp colour in coast.py's build_moon(). */
const MOON_LIGHT: [number, number, number] = [0.72, 0.8, 1.0];

function keyLight(id: StopId): KeyLight {
  const s = SHOTS[id];
  if (s.sun_str > 0) return { dir: sunDir(s.sun_el, s.sun_az), color: s.sun_col, strength: s.sun_str };
  if (s.moon) return { dir: sunDir(s.moon[1], s.moon[0]), color: MOON_LIGHT, strength: s.moon[4] };
  return { dir: sunDir(s.sun_el, s.sun_az), color: s.sun_col, strength: 0 };
}

/**
 * Each hour's shadow floor, sRGB on screen (plan M2.5 Task 4: violet at dusk, teal-blue at night, grey rose at first
 * light; owner-references §14.4 "shadows with something in them", §17 "no darker than about #10123a"). Each sits just
 * above #10123a's luminance; daylight floors stay warm so they never show as haze.
 */
export const SHADOW_FLOOR: Record<StopId, RGB> = {
  golden: [0.12, 0.09, 0.12],
  sunset: [0.13, 0.08, 0.13],
  dusk: [0.11, 0.08, 0.17],
  bluehour: [0.07, 0.09, 0.17],
  night: [0.06, 0.1, 0.15],
  midnight: [0.06, 0.1, 0.15],
  beforedawn: [0.07, 0.1, 0.14],
  firstlight: [0.12, 0.09, 0.1],
  sunrise: [0.12, 0.09, 0.11],
};

function preset(id: StopId): HourPreset {
  const s = SHOTS[id];
  // one moon: the world state's moonEl is its height (the lamp's own height in s.moon still aims the key light)
  const moon: Moon | null = s.moon
    ? { az: s.moon[0], el: s.world.moonEl ?? s.moon[1], sizeDeg: s.moon[2], strength: s.moon[3] }
    : null;
  return {
    id,
    key: keyLight(id),
    exposure: s.expo,
    fogColor: s.fog,
    fogAmount: s.fog_amt,
    skyTint: s.sky_tint,
    skyGain: s.hdri_gain,
    stars: s.stars,
    moon,
    swell: s.swell,
    world: s.world,
    aurora: s.aurora ? 1 : 0,
    cloud: s.cloudsea ? 1 : 0,
    shadowFloor: SHADOW_FLOOR[id],
  };
}

export const HOURS = Object.fromEntries(STOP_IDS.map((id) => [id, preset(id)])) as Record<StopId, HourPreset>;

const mix3 = <T extends number[]>(a: T, b: T, w: number): T => a.map((v, i) => lerp(v, b[i] as number, w)) as T;

/** Spherical blend of two unit vectors; stays unit length. */
function slerp(a: Vec3, b: Vec3, w: number): Vec3 {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const angle = Math.acos(dot);
  if (angle < 1e-6) return a;
  if (Math.PI - angle < 1e-6) {
    // Opposite directions: pass over the zenith.
    const up: Vec3 = [0, 0, 1];
    return w < 0.5 ? slerp(a, up, w * 2) : slerp(up, b, w * 2 - 1);
  }
  const s = Math.sin(angle);
  const ka = Math.sin((1 - w) * angle) / s;
  const kb = Math.sin(w * angle) / s;
  const v: Vec3 = [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
}

function blendMoon(a: Moon | null, b: Moon | null, w: number): Moon | null {
  if (!a && !b) return null;
  if (a && b)
    return {
      az: lerp(a.az, b.az, w),
      el: lerp(a.el, b.el, w),
      sizeDeg: lerp(a.sizeDeg, b.sizeDeg, w),
      strength: lerp(a.strength, b.strength, w),
    };
  const only = (a ?? b) as Moon;
  return { ...only, strength: lerp(a ? only.strength : 0, b ? only.strength : 0, w) };
}

/** Angles in degrees, blended the short way round (350 to 10 passes through 0, not 180). */
const lerpAngle = (a: number, b: number, w: number): number => {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return (((a + d * w) % 360) + 360) % 360;
};

function blendWorld(a: WorldState, b: WorldState, w: number): WorldState {
  return {
    sunEl: lerp(a.sunEl, b.sunEl, w),
    moonEl:
      a.moonEl === null && b.moonEl === null
        ? null
        : lerp(a.moonEl ?? (b.moonEl as number), b.moonEl ?? (a.moonEl as number), w),
    moonPhase: lerp(a.moonPhase, b.moonPhase, w),
    windAz: lerpAngle(a.windAz, b.windAz, w),
    beaufort: lerp(a.beaufort, b.beaufort, w),
  };
}

/** Beaufort force 0..4 to a speed, metres per second (the brief's midpoints; 4 = 20-28 km/h, reference book §2). */
const BEAUFORT_MS = [0.2, 0.8, 2.5, 4.4, 6.7];

/**
 * Where the air moves, metres per second in coast axes [x east, y north]: the opposite of where the wind comes from.
 * Everything that moves reads this one vector (reference book §2: "things moving in different directions give it away").
 */
export function windVector(world: Pick<WorldState, 'windAz' | 'beaufort'>): [number, number] {
  const f = Math.min(Math.max(world.beaufort, 0), BEAUFORT_MS.length - 1);
  const i = Math.min(Math.floor(f), BEAUFORT_MS.length - 2);
  const speed = lerp(BEAUFORT_MS[i] as number, BEAUFORT_MS[i + 1] as number, f - i);
  const az = (world.windAz * Math.PI) / 180;
  return [-Math.sin(az) * speed, -Math.cos(az) * speed];
}

/** The light between two hours, `w` = 0 (all of a) to 1 (all of b). */
export function blendHours(a: HourPreset, b: HourPreset, w: number): HourPreset {
  if (w <= 0) return a;
  if (w >= 1) return b;
  return {
    id: w < 0.5 ? a.id : b.id,
    key: {
      dir: slerp(a.key.dir, b.key.dir, w),
      color: mix3(a.key.color, b.key.color, w),
      strength: lerp(a.key.strength, b.key.strength, w),
    },
    exposure: lerp(a.exposure, b.exposure, w),
    fogColor: mix3(a.fogColor, b.fogColor, w),
    fogAmount: lerp(a.fogAmount, b.fogAmount, w),
    skyTint: mix3(a.skyTint, b.skyTint, w),
    skyGain: lerp(a.skyGain, b.skyGain, w),
    stars: lerp(a.stars, b.stars, w),
    moon: blendMoon(a.moon, b.moon, w),
    swell: lerp(a.swell, b.swell, w),
    world: blendWorld(a.world, b.world, w),
    aurora: lerp(a.aurora, b.aurora, w),
    cloud: lerp(a.cloud, b.cloud, w),
    shadowFloor: mix3(a.shadowFloor, b.shadowFloor, w),
  };
}
