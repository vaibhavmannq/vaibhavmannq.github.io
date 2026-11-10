import data from './shots.json';
import type { RGB, StopId, Vec3 } from './types';

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
  chop: number;
}

export const SHOTS = data as unknown as Record<StopId, Shot>;
