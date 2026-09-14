import { describe, expect, it } from 'vitest';
import { directionFromAzEl, MOON_DIRECTION, type Vec3 } from '../../src/regions/moonsink/moonDirection';
import { MILKY_BAND_NORMAL, NEBULA_CENTRE } from '../../src/regions/moonsink/nightSky';

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angleFromMoon = (azimuth: number, elevation: number) =>
  Math.acos(Math.min(1, dot(directionFromAzEl(azimuth, elevation), MOON_DIRECTION)));

describe('the night sky keeps the moon the one focal point (spec §3.4 rule 1)', () => {
  it('keeps the milky band and the nebula away from the moon', () => {
    // The angle between a direction and a great circle is asin(|direction · normal|).
    expect(Math.asin(Math.abs(dot(MOON_DIRECTION, MILKY_BAND_NORMAL)))).toBeGreaterThan(0.3);
    expect(angleFromMoon(NEBULA_CENTRE[0], NEBULA_CENTRE[1])).toBeGreaterThan(0.25);
  });

  it('puts the nebula where both a laptop and a portrait phone can see it', () => {
    // Laptop: elevation up to ≈0.24. Phone: azimuth within ±0.31. Keep clear of the horizon haze too.
    const [azimuth, elevation] = NEBULA_CENTRE;
    expect(Math.abs(azimuth)).toBeLessThanOrEqual(0.31);
    expect(elevation).toBeLessThanOrEqual(0.24);
    expect(elevation).toBeGreaterThanOrEqual(0.12);
  });
});
