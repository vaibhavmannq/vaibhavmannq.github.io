import { describe, expect, it } from 'vitest';
import { STOPS, stopIndex } from '../../src/journey/stops';
import { STOP_IDS, type Stop } from '../../src/journey/types';

function at(i: number): Stop {
  const stop = STOPS[i];
  if (!stop) throw new Error(`no stop ${i}`);
  return stop;
}

describe('the nine stops (spec §5)', () => {
  it('come in journey order', () => {
    expect(STOPS.map((s) => s.id)).toEqual([...STOP_IDS]);
    expect(STOPS).toHaveLength(9);
  });

  it('stand where the render cameras stood, eye height above the ground', () => {
    const golden = at(0);
    expect(golden.cam[0]).toBeCloseTo(9.5, 2);
    expect(golden.cam[1]).toBeCloseTo(-4, 2);
    expect(Math.abs(golden.cam[2] - 0.92)).toBeLessThan(0.01);
    expect(Math.abs(at(stopIndex('midnight')).cam[2] - 285.9)).toBeLessThan(0.1);
  });

  it('finds a stop by id, and -1 for anything else', () => {
    expect(stopIndex('night')).toBe(4);
    expect(stopIndex('foo')).toBe(-1);
  });

  it('carries the placeholder label text', () => {
    const night = at(4);
    expect([night.numeral, night.hour, night.place]).toEqual(['V', 'Night', 'The lagoon']);
  });
});
