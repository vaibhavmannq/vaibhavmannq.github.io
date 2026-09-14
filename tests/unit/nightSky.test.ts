import { describe, expect, it } from 'vitest';
import { directionFromAzEl, MOON_DIRECTION, type Vec3 } from '../../src/regions/moonsink/moonDirection';
import {
  FIGURE_LINES,
  FIGURE_MAGNITUDES,
  FIGURE_STARS,
  MILKY_BAND_NORMAL,
  NEBULA_CENTRE,
} from '../../src/regions/moonsink/nightSky';

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angleFromMoon = (azimuth: number, elevation: number) =>
  Math.acos(Math.min(1, dot(directionFromAzEl(azimuth, elevation), MOON_DIRECTION)));

describe('the night sky keeps the moon the one focal point (spec §3.4 rule 1)', () => {
  it('keeps every constellation star well clear of the moon', () => {
    for (const [azimuth, elevation] of FIGURE_STARS) {
      expect(angleFromMoon(azimuth, elevation)).toBeGreaterThan(0.15);
    }
  });

  it('keeps the milky band and the nebula away from the moon', () => {
    // The angle between a direction and a great circle is asin(|direction · normal|).
    expect(Math.asin(Math.abs(dot(MOON_DIRECTION, MILKY_BAND_NORMAL)))).toBeGreaterThan(0.3);
    expect(angleFromMoon(NEBULA_CENTRE[0], NEBULA_CENTRE[1])).toBeGreaterThan(0.25);
  });
});

describe('constellations', () => {
  it('only join stars that exist, and give every star a brightness', () => {
    expect(FIGURE_MAGNITUDES).toHaveLength(FIGURE_STARS.length);
    for (const [from, to] of FIGURE_LINES) {
      expect(FIGURE_STARS[from]).toBeDefined();
      expect(FIGURE_STARS[to]).toBeDefined();
      expect(from).not.toBe(to);
    }
  });

  it('sit above the horizon haze, with two figures inside a laptop view', () => {
    for (const [, elevation] of FIGURE_STARS) expect(elevation).toBeGreaterThanOrEqual(0.1);
    // A 16:9 screen sees elevation up to pitch + half its vertical FOV: −0.06 + 0.303 ≈ 0.24.
    const onLaptop = FIGURE_STARS.filter(([azimuth, elevation]) => elevation <= 0.24 && Math.abs(azimuth) <= 0.5);
    expect(onLaptop.length).toBeGreaterThanOrEqual(10);
  });
});
