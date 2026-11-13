/** Coast coordinates: x east, y out to sea (north), z up, metres (coast.py). three.js uses (x, z, -y). */
export type Vec3 = [number, number, number];
export type RGB = [number, number, number];

export type StopId =
  | 'golden'
  | 'sunset'
  | 'dusk'
  | 'bluehour'
  | 'night'
  | 'midnight'
  | 'beforedawn'
  | 'firstlight'
  | 'sunrise';

/** The nine stops in journey order (spec §2). */
export const STOP_IDS: readonly StopId[] = [
  'golden',
  'sunset',
  'dusk',
  'bluehour',
  'night',
  'midnight',
  'beforedawn',
  'firstlight',
  'sunrise',
];

export const toThree = (v: Vec3): Vec3 => [v[0], v[2], -v[1]];

/** Where a camera looks: yaw 0 = out to sea (+y), positive turns east; pitch positive = up; lens in mm (36 mm film). */
export interface Framing {
  yaw: number;
  pitch: number;
  lens: number;
}

export interface Stop {
  id: StopId;
  numeral: string;
  hour: string;
  place: string;
  /** Coast x, y and the absolute eye height (ground + eye). */
  cam: Vec3;
  landscape: Framing;
}

/** The light that casts shadows: the sun, or the moon at night. `dir` points toward the light (coast, unit). */
export interface KeyLight {
  dir: Vec3;
  color: RGB;
  strength: number;
}

export interface Moon {
  az: number;
  el: number;
  sizeDeg: number;
  strength: number;
}

/**
 * One world state per place (M2.5): the sun and moon where they really sit, and the one wind everything that moves
 * reads (reference book §1 the clock of the night, §2 wind). Degrees; moon phase 0 new .. 0.5 full .. 1 new.
 */
export interface WorldState {
  sunEl: number;
  /** null when the hour has no moon up */
  moonEl: number | null;
  moonPhase: number;
  /** Where the wind blows FROM, degrees: 0 north, 90 east (the sea side of the stop). */
  windAz: number;
  /** Beaufort force, 0 calm .. 4 moderate; fractions while the light blends between two hours. */
  beaufort: number;
}

export interface HourPreset {
  id: StopId;
  key: KeyLight;
  exposure: number;
  fogColor: RGB;
  fogAmount: number;
  skyTint: RGB;
  skyGain: number;
  stars: number;
  moon: Moon | null;
  swell: number;
  world: WorldState;
  /** 0..1: how much of an aurora this hour has (Night, Deep midnight). */
  aurora: number;
  /** 0..1: how much of the sea of cloud lies in the midnight valley. */
  cloud: number;
}
