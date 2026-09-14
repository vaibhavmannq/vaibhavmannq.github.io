import { cross, directionFromAzEl, normalize } from './moonDirection';

/**
 * The night sky's fixed layout (owner request, 2026-09-14; spec §17 S28). Angles are radians in sea
 * space, as azimuth and elevation (moonDirection.ts). The camera's view never turns (§17 S27): a 16:9
 * laptop sees azimuth ±0.51 and elevation up to 0.24, a portrait phone azimuth ±0.31 and elevation up
 * to 0.55. The details sit up and left, away from the moon on the right and the text at the bottom.
 * The owner kept many stars, the milky band, the nebula and earthshine; constellations were dropped.
 */
export type AzEl = readonly [number, number];

/** The milky band is the great circle through these two directions: low on the left, rising to the right. */
export const MILKY_BAND_NORMAL = normalize(cross(directionFromAzEl(-0.3, 0), directionFromAzEl(0.02, 0.6)));

/** Centre of the faint nebula, above and left of the moon. */
export const NEBULA_CENTRE: AzEl = [-0.15, 0.2];
