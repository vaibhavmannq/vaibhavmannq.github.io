import { cross, directionFromAzEl, normalize } from './moonDirection';

/**
 * The night sky's fixed layout (owner request, 2026-09-14; spec §17 S28). Angles are radians in sea
 * space, as azimuth and elevation (moonDirection.ts). The camera's view never turns (§17 S27): a 16:9
 * laptop sees azimuth ±0.51 and elevation up to 0.24, a portrait phone azimuth ±0.31 and elevation up
 * to 0.55. The details sit up and left, away from the moon on the right and the text at the bottom.
 */
export type AzEl = readonly [number, number];

/** The milky band is the great circle through these two directions: low on the left, rising to the right. */
export const MILKY_BAND_NORMAL = normalize(cross(directionFromAzEl(-0.3, 0), directionFromAzEl(0.02, 0.6)));

/** Centre of the faint nebula, above and left of the moon. */
export const NEBULA_CENTRE: AzEl = [-0.15, 0.2];

/** Original figures, not real constellations. */
export const FIGURE_STARS: readonly AzEl[] = [
  // A long-necked bird, low on the left
  [-0.33, 0.1],
  [-0.29, 0.15],
  [-0.24, 0.17],
  [-0.2, 0.14],
  [-0.16, 0.19],
  [-0.26, 0.21],
  // A kite, upper middle
  [-0.07, 0.16],
  [-0.02, 0.18],
  [0, 0.23],
  [-0.05, 0.225],
  [-0.045, 0.13],
  // A chain, high up (on tall screens only)
  [-0.18, 0.36],
  [-0.11, 0.4],
  [-0.04, 0.37],
  [0.03, 0.42],
  [0.08, 0.35],
];

/** Pairs of FIGURE_STARS indices joined by a faint line. */
export const FIGURE_LINES: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [2, 5],
  [6, 7],
  [7, 8],
  [8, 9],
  [9, 6],
  [6, 10],
  [11, 12],
  [12, 13],
  [13, 14],
  [14, 15],
];

/** Relative brightness of each figure star, fixed so the figures look the same on every visit. */
export const FIGURE_MAGNITUDES: readonly number[] = [
  0.9, 0.6, 1, 0.7, 0.8, 0.55, 0.85, 1, 0.65, 0.6, 0.7, 0.75, 0.95, 0.6, 0.8, 0.7,
];

/** The flattened sky map the shader draws figures on: azimuth scaled by cos(elevation), so shapes keep their proportions. */
export const toSkyMap = ([azimuth, elevation]: AzEl): readonly [number, number] => [
  azimuth * Math.cos(elevation),
  elevation,
];
