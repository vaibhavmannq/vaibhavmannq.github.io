import { describe, expect, it } from 'vitest';
import { blendHours, HOURS, windVector } from '../../src/journey/hours';
import { STOP_IDS } from '../../src/journey/types';

const length = (v: readonly number[]) => Math.hypot(...v);

describe('hour presets from coast.py (spec §9.1)', () => {
  it('give every hour a unit key-light direction', () => {
    for (const id of STOP_IDS) expect(Math.abs(length(HOURS[id].key.dir) - 1)).toBeLessThan(1e-6);
  });

  it('light Golden by the sun and Night by the moon', () => {
    expect(HOURS.golden.key.strength).toBeGreaterThan(0);
    expect(HOURS.golden.moon).toBeNull();
    expect(HOURS.night.moon).not.toBeNull();
  });

  it('blend to either end exactly', () => {
    expect(blendHours(HOURS.golden, HOURS.sunset, 0)).toEqual(HOURS.golden);
    expect(blendHours(HOURS.golden, HOURS.sunset, 1)).toEqual(HOURS.sunset);
  });

  it('keep the blended light direction unit length', () => {
    const mid = blendHours(HOURS.golden, HOURS.sunrise, 0.5);
    expect(Math.abs(length(mid.key.dir) - 1)).toBeLessThan(1e-6);
  });

  it('give Night and Midnight an aurora, and only Midnight a cloud deck', () => {
    expect(HOURS.night.aurora).toBe(1);
    expect(HOURS.midnight.aurora).toBe(1);
    expect(HOURS.golden.aurora).toBe(0);
    expect(HOURS.night.cloud).toBe(0);
    expect(HOURS.midnight.cloud).toBe(1);
    expect(blendHours(HOURS.night, HOURS.midnight, 0.5).cloud).toBe(0.5);
    expect(blendHours(HOURS.bluehour, HOURS.night, 0.25).aurora).toBe(0.25);
  });

  // M8.5 #3b: the light now turns through the whole flight, so a moon that rose with it showed (and its reflection, a
  // white blob) while the sky was still Blue hour's. A moon only one side has comes in late and goes out early.
  it('fade a moon only one side has in as the sky darkens, and out before it lightens', () => {
    const full = HOURS.night.moon?.strength ?? 0;
    const into = (w: number) => blendHours(HOURS.bluehour, HOURS.night, w).moon?.strength ?? 0;
    const out = (w: number) => blendHours(HOURS.night, HOURS.sunrise, w).moon?.strength ?? 0;
    expect(into(0.25)).toBe(0);
    expect(into(0.5)).toBeGreaterThan(0);
    expect(into(0.5)).toBeLessThan(full / 2);
    expect(into(0.85)).toBeCloseTo(full, 6);
    expect(out(0.15)).toBeCloseTo(full, 6);
    expect(out(0.5)).toBeLessThan(full / 2);
    expect(out(0.75)).toBe(0);
  });

  // M8.5 #3b: between two hours lit from different directions (Blue hour's sun under the horizon, Night's moon) the key
  // light swings through directions where no light is; the sea's road followed it as a white blob on the water.
  it('show the sun or moon road only near a real light while the key light hands over', () => {
    for (const id of STOP_IDS) expect(HOURS[id].road).toBe(1);
    const road = (w: number) => blendHours(HOURS.bluehour, HOURS.night, w).road;
    expect(road(0.3)).toBe(0);
    expect(road(0.6)).toBe(0);
    expect(road(0.15)).toBe(0);
    expect(road(0.98)).toBeGreaterThan(0.5);
    // the same light moving a little (Golden's sun to Sunset's) keeps its road all the way
    for (const w of [0.25, 0.5, 0.75]) expect(blendHours(HOURS.golden, HOURS.sunset, w).road).toBe(1);
  });

  it('give every hour a world state in range', () => {
    for (const id of STOP_IDS) {
      const w = HOURS[id].world;
      expect(w.sunEl).toBeGreaterThanOrEqual(-90);
      expect(w.sunEl).toBeLessThanOrEqual(90);
      expect(w.windAz).toBeGreaterThanOrEqual(0);
      expect(w.windAz).toBeLessThan(360);
      expect(w.beaufort).toBeGreaterThanOrEqual(0);
      expect(w.beaufort).toBeLessThanOrEqual(4);
      expect(w.moonPhase).toBeGreaterThanOrEqual(0);
      expect(w.moonPhase).toBeLessThanOrEqual(1);
      // one moon: the hour has one exactly when the world state says the moon is up, and at that height
      expect(HOURS[id].moon === null).toBe(w.moonEl === null);
      if (w.moonEl !== null) expect(HOURS[id].moon?.el).toBe(w.moonEl);
    }
    // reference book §1: the night hours sit below -18 degrees, with a crescent moon
    expect(HOURS.night.world.sunEl).toBeLessThan(-18);
    expect(HOURS.midnight.world.sunEl).toBeLessThan(-18);
    expect(HOURS.night.world.moonPhase).toBeCloseTo(0.12, 6);
  });

  it('keep the mirror-water hours at force 0 or 1', () => {
    for (const id of ['golden', 'bluehour', 'night', 'firstlight'] as const)
      expect(HOURS[id].world.beaufort).toBeLessThanOrEqual(1);
  });

  it('blend the wind the short way round', () => {
    const a = { ...HOURS.golden, world: { ...HOURS.golden.world, windAz: 350 } };
    const b = { ...HOURS.sunset, world: { ...HOURS.sunset.world, windAz: 10 } };
    const mid = blendHours(a, b, 0.5).world.windAz;
    expect(Math.min(mid, 360 - mid)).toBeLessThan(1e-6);
    const quarter = blendHours(a, b, 0.25).world.windAz;
    expect(quarter).toBeCloseTo(355, 6);
  });

  it('turn the wind into metres per second that move away from where it comes from', () => {
    const [nx, ny] = windVector({ ...HOURS.golden.world, windAz: 0, beaufort: 2 });
    expect(nx).toBeCloseTo(0, 9);
    expect(ny).toBeCloseTo(-2.5, 9);
    const [ex, ey] = windVector({ ...HOURS.golden.world, windAz: 90, beaufort: 1 });
    expect(ex).toBeCloseTo(-0.8, 9);
    expect(ey).toBeCloseTo(0, 9);
    expect(Math.hypot(...windVector({ ...HOURS.golden.world, beaufort: 0 }))).toBeCloseTo(0.2, 9);
    expect(Math.hypot(...windVector({ ...HOURS.golden.world, beaufort: 3 }))).toBeCloseTo(4.4, 9);
    expect(Math.hypot(...windVector({ ...HOURS.golden.world, beaufort: 0.5 }))).toBeCloseTo(0.5, 9);
  });
});
