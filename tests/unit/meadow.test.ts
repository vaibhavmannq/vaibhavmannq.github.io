import { describe, expect, it } from 'vitest';
import { flowerClump, plantWeight, shortTuft, tallTuft } from '../../src/world/meadow';

describe('the cove plants (plan M3 Task 1)', () => {
  it('shows only the stop’s own plants at a stop (their cost does not add up across the cove)', () => {
    expect(plantWeight({ kind: 'stop', a: 0, b: 0, t: 0.5 }, 0)).toBe(1);
    expect(plantWeight({ kind: 'stop', a: 0, b: 0, t: 0.5 }, 1)).toBe(0);
  });

  it('on a flight, shrinks the plants left behind late and grows those ahead early: never both gone mid-flight', () => {
    const at = (t: number) => [
      plantWeight({ kind: 'flight', a: 0, b: 1, t }, 0),
      plantWeight({ kind: 'flight', a: 0, b: 1, t }, 1),
    ];
    expect(at(0)).toEqual([1, 0]);
    expect(at(1)).toEqual([0, 1]);
    for (let t = 0; t <= 1; t += 0.05) {
      const [from, to] = at(t) as [number, number];
      expect(from + to).toBeGreaterThan(0.5);
    }
    // a third stop is never drawn on this flight
    expect(plantWeight({ kind: 'flight', a: 0, b: 1, t: 0.5 }, 2)).toBe(0);
  });

  it('keeps every shape cheap (triangles per plant)', () => {
    expect(tallTuft().pos.length / 9).toBeLessThanOrEqual(30);
    expect(shortTuft().pos.length / 9).toBeLessThanOrEqual(16);
    expect(flowerClump().pos.length / 9).toBeLessThanOrEqual(50);
  });
});
