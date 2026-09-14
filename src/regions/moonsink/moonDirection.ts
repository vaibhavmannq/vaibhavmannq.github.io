/**
 * Where the moon sits, in "sea space" (sea.ts): azimuth turns from +z toward +x, elevation rises from
 * the horizon, both in radians. One source for the shader and the tests.
 */
export type Vec3 = readonly [number, number, number];

export const MOON_AZIMUTH = 0.14888;
/** About 6°. It was about 4° (0.0691); the owner asked for the moon "just a lil bit up", 2026-09-14. */
export const MOON_ELEVATION = 0.105;

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
};

export function directionFromAzEl(azimuth: number, elevation: number): Vec3 {
  return [Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)];
}

export const MOON_DIRECTION = directionFromAzEl(MOON_AZIMUTH, MOON_ELEVATION);

/** Axes across the moon's disc, computed once here so the shader gets constants (see moonLit in sea.ts). */
export const MOON_RIGHT_AXIS = normalize(cross([0, 1, 0], MOON_DIRECTION));
export const MOON_UP_AXIS = normalize(cross(MOON_DIRECTION, MOON_RIGHT_AXIS));
