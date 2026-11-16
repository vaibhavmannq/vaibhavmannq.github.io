import { describe, expect, it } from 'vitest';
import { blendHours, HOURS } from '../../src/journey/hours';
import { STOP_IDS } from '../../src/journey/types';
import { MIST_DRIFT_MAX, mistAmount, mistDrift, mistFog } from '../../src/world/mist';
import { foamLevel } from '../../src/world/sea';

// plan M3 Task 3: First light's mist (reference book §4: radiation fog, a flat layer a metre or two deep, almost
// still, thinning as the sun arrives; owner `mist` 8).
describe("First light's mist", () => {
  it('lies only at First light and, thinner, at Sunrise', () => {
    for (const id of STOP_IDS) {
      const m = mistFog(HOURS[id].mist);
      if (id === 'firstlight' || id === 'sunrise') expect(m.density).toBeGreaterThan(0);
      else expect(m.density).toBe(0);
    }
    expect(mistFog(HOURS.sunrise.mist).density).toBeLessThan(mistFog(HOURS.firstlight.mist).density);
  });

  it('is a flat band 1–2 m deep with its top at most 2.5 m, at every hour and between them', () => {
    const fl = mistFog(HOURS.firstlight.mist);
    expect(fl.top).toBeGreaterThanOrEqual(1);
    expect(fl.top).toBeLessThanOrEqual(2);
    for (let i = 0; i + 1 < STOP_IDS.length; i++) {
      const a = HOURS[STOP_IDS[i] as (typeof STOP_IDS)[number]];
      const b = HOURS[STOP_IDS[i + 1] as (typeof STOP_IDS)[number]];
      for (const w of [0, 0.25, 0.5, 0.75, 1]) {
        const m = mistFog(blendHours(a, b, w).mist);
        expect(m.top).toBeLessThanOrEqual(2.5);
        // no leak into a flight between two mistless hours
        if (a.mist === 0 && b.mist === 0) expect(m.density).toBe(0);
      }
    }
  });

  it('thickens on the way into First light and thins on the way to Sunrise', () => {
    const into = [0, 0.3, 0.6, 1].map((w) => mistFog(blendHours(HOURS.beforedawn, HOURS.firstlight, w).mist).density);
    const out = [0, 0.3, 0.6, 1].map((w) => mistFog(blendHours(HOURS.firstlight, HOURS.sunrise, w).mist).density);
    for (let i = 1; i < 4; i++) {
      expect(into[i]).toBeGreaterThan(into[i - 1] as number);
      expect(out[i]).toBeLessThan(out[i - 1] as number);
    }
  });

  it('reads as a band from First light: far water and the shore foot hidden, the tops clear, near water clear', () => {
    const { density, top } = mistFog(HOURS.firstlight.mist);
    const eye = 0.55; // First light's eye (shots.json)
    expect(mistAmount(eye, 0, 300, density, top)).toBeGreaterThan(0.8); // the far sea
    expect(mistAmount(eye, 0, 10, density, top)).toBeLessThan(0.1); // the water at your feet
    expect(mistAmount(eye, 0.5, 150, density, top)).toBeGreaterThan(0.4); // the headland's foot
    expect(mistAmount(eye, 12, 150, density, top)).toBeLessThan(0.1); // its trees stand clear
    // from above the layer the same far sea is hidden less than from inside it
    expect(mistAmount(4, 0, 300, density, top)).toBeLessThan(mistAmount(eye, 0, 300, density, top));
    expect(mistAmount(eye, 0, 300, 0, top)).toBe(0);
  });

  it('hangs: drifts with the wind at no more than 0.1 m/s', () => {
    expect(MIST_DRIFT_MAX).toBeLessThanOrEqual(0.1);
    for (const id of STOP_IDS) {
      const [vx, vz] = mistDrift(HOURS[id].world);
      expect(Math.hypot(vx, vz)).toBeLessThanOrEqual(0.1 + 1e-9);
    }
    // with the wind, not against it: First light's wind comes from the north (az 0), so the mist moves south
    const [, vy] = mistDrift({ windAz: 0, beaufort: 1 });
    expect(vy).toBeLessThan(0);
  });
});

// The surf follows the wind force (reference book §2–3: force 0–1 water is a mirror with no crests; a white line of
// foam comes and goes; the swash sheet belongs to a breeze). Today First light (force 0) shows a bright white band.
describe('surf foam by wind force', () => {
  it('is faint at force 0, grows with the force, full from force 2', () => {
    expect(foamLevel(0).edge).toBeLessThanOrEqual(0.4);
    expect(foamLevel(0).sheet).toBe(0);
    expect(foamLevel(1).edge).toBeGreaterThan(foamLevel(0).edge);
    expect(foamLevel(1).sheet).toBeLessThanOrEqual(0.4);
    expect(foamLevel(2)).toEqual({ edge: 1, sheet: 1 });
    expect(foamLevel(4)).toEqual({ edge: 1, sheet: 1 });
    expect(foamLevel(-1)).toEqual(foamLevel(0));
  });
});
