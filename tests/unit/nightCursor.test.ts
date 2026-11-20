import { describe, expect, it } from 'vitest';
import { nightWeight } from '../../src/overlay/nightCursor';

// plan M8 Task 8 (owner-sites: Originkit "Aura Cursor"): the glow belongs to the night hours, Blue hour to Before dawn.
describe('nightWeight', () => {
  const at = (a: number, b: number, hourWeight: number) => ({ a, b, hourWeight });
  it('is 1 at the night stops and 0 at the day ones', () => {
    for (const i of [3, 4, 5, 6]) expect(nightWeight(at(i, i, 0))).toBe(1);
    for (const i of [0, 1, 2, 7, 8]) expect(nightWeight(at(i, i, 0))).toBe(0);
  });
  it('follows the light in a flight between a day and a night stop', () => {
    expect(nightWeight(at(2, 3, 0.25))).toBeCloseTo(0.25);
    expect(nightWeight(at(6, 7, 0.75))).toBeCloseTo(0.25);
  });
});
