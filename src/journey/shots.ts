import data from './shots.json';
import type { RGB, StopId, Vec3, WorldState } from './types';

/** The aurora's curtains (coast.py's `sky_bands` and `aurora_mat` settings). */
export interface AuroraShot {
  strength: number;
  rays: number;
  ray_min: number;
  foot: number;
  warp: number;
  haze: number;
  lean: number;
  core: RGB;
  low: RGB;
  high: RGB;
  /** The shot's look azimuth: the bands' azimuths are relative to it. */
  yaw: number;
  /** az0, az1, el0, el1, height, fold amplitude (all degrees), brightness */
  bands: [number, number, number, number, number, number, number][];
}

/** The sea of cloud (coast.py's `build_cloudsea`). box = x0, x1, y0, y1. */
export interface CloudShot {
  z: number;
  amp: number;
  box: [number, number, number, number];
  feather: number;
  low: RGB;
  high: RGB;
}

/** The waterfall (coast.py's `build_waterfall`): w0, w1 are half-widths at the lip and at the pool. */
export interface FallsShot {
  x: number;
  yLip: number;
  yPool: number;
  zTop: number;
  w0: number;
  w1: number;
  pool: number;
  poolY: number;
  spray: Vec3;
  sprayZ: number;
}

/** The cave (coast.py's `build_cave`). `az` is where the mouth faces; `top` its upper edge, degrees. */
export interface CaveShot {
  x: number;
  y: number;
  floor: number;
  az: number;
  top: number;
  radii: Vec3;
  centreZ: number;
  fungiCol: RGB;
  fungiGlow: number;
  pool: { x: number; y: number; r: number };
}

/** One hour's settings as exported from coast.py by tools/world/export_hours.py. */
export interface Shot {
  cam: Vec3;
  look: [number, number];
  lens: number;
  ground: number;
  eyeZ: number;
  sun_el: number;
  sun_az: number;
  sun_col: RGB;
  sun_str: number;
  hdri_gain: number;
  expo: number;
  fog: RGB;
  fog_amt: number;
  sky_tint: RGB;
  stars: number;
  /** az, el, size in degrees, disc strength, lamp energy */
  moon: [number, number, number, number, number] | null;
  swell: number;
  /** The place's world state (export_hours.py's WORLD): see `WorldState`. */
  world: WorldState;
  aurora: AuroraShot | null;
  cloudsea: CloudShot | null;
  falls: FallsShot | null;
  cave: CaveShot | null;
}

export const SHOTS = data as unknown as Record<StopId, Shot>;

/**
 * The cameras Sunset and Dusk had before M3 (D31; acd7442~1), for a side-by-side in the running site: `?cams=old`.
 * Read once, before the stops, the plants and the flights are built from the shots (boot.ts swaps the three flights
 * that touch them). The spots at those two stops start from the new cameras, so they are hidden there.
 */
export const OLD_CAMS: Partial<Record<StopId, Pick<Shot, 'cam' | 'look' | 'lens' | 'ground' | 'eyeZ'>>> = {
  sunset: { cam: [25.0, 141.0, 1.7], look: [-47.0, 0.5], lens: 28, ground: 14.3584, eyeZ: 16.0584 },
  dusk: { cam: [30.0, 40.0, 1.7], look: [-40.0, -5.5], lens: 24, ground: 25.5974, eyeZ: 27.2974 },
};

export const OLD_CAMS_ON =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('cams') === 'old';

if (OLD_CAMS_ON) for (const [id, old] of Object.entries(OLD_CAMS)) Object.assign(SHOTS[id as StopId], old);
