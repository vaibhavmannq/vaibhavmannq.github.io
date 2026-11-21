import { describe, expect, it } from 'vitest';
import { STOP_IDS } from '../../src/journey/types';
import {
  SEA_M,
  SWELL_M,
  SWELL_PERIOD,
  seaGrid,
  seaStateAt,
  swashCycle,
  swashLevel,
  swellAt,
} from '../../src/world/sea';

// M8.5 #1 (owner, round 1: "waves rustling but no waves can be seen"): a long swell that rolls in and washes up the sand.
describe('the swell', () => {
  it('has a height for every place, and none in the Night lagoon', () => {
    expect(SWELL_M.length).toBe(STOP_IDS.length);
    expect(SWELL_M[STOP_IDS.indexOf('night')]).toBe(0);
    for (const s of SWELL_M) expect(s).toBeLessThanOrEqual(0.5);
  });

  it('blends between two places like the light', () => {
    expect(swellAt(0, 1, 0)).toBe(SWELL_M[0]);
    expect(swellAt(0, 1, 1)).toBe(SWELL_M[1]);
    expect(swellAt(3, 4, 0.5)).toBeCloseTo((SWELL_M[3] + SWELL_M[4]) / 2);
  });

  it('runs up quickly and slides back slowly, once a period', () => {
    expect(swashCycle(0)).toBeCloseTo(0.25);
    expect(swashCycle(SWELL_PERIOD)).toBeCloseTo(swashCycle(0));
    const s = 0.35;
    const samples = Array.from({ length: 80 }, (_, i) => swashLevel((i / 80) * SWELL_PERIOD, s));
    const top = Math.max(...samples);
    expect(top).toBeCloseTo(s * 0.45, 2);
    expect(Math.min(...samples)).toBeCloseTo(-s * 0.05, 3);
    // the climb takes under a quarter of the period, the slide back over half
    const level = (c: number) => swashLevel(((c - 0.25 + 1) % 1) * SWELL_PERIOD, s);
    expect(level(0.18)).toBeGreaterThan(level(0.5));
    expect(level(0.5)).toBeGreaterThan(level(0.85));
  });

  it('is still where there is no swell', () => {
    for (let t = 0; t < SWELL_PERIOD; t += 0.5) expect(Math.abs(swashLevel(t, 0))).toBe(0);
  });
});

// round 1b: the surface itself moves (owner: "no actual movement in water")
describe('the rolling waves', () => {
  it('have a height for every place, none in the Night lagoon, and blend like the light', () => {
    expect(SEA_M.length).toBe(STOP_IDS.length);
    expect(SEA_M[STOP_IDS.indexOf('night')]).toBe(0);
    expect(seaStateAt(0, 1, 0.5)).toBeCloseTo((SEA_M[0] + SEA_M[1]) / 2);
  });

  it('ride a mesh of rings round the eye, fine at the feet', () => {
    const g = seaGrid(10, 16, 0.5, 9000);
    const pos = g.getAttribute('position');
    expect(pos.count).toBe(1 + 10 * 16);
    expect(Math.hypot(pos.getX(1), pos.getZ(1))).toBeCloseTo(0.5);
    expect(Math.hypot(pos.getX(1 + 9 * 16), pos.getZ(1 + 9 * 16))).toBeCloseTo(9000, 0);
    expect(g.getIndex()?.count).toBe(16 * 3 + 9 * 16 * 6);
  });
});
