import { describe, expect, it } from 'vitest';
import { STOPS } from '../../src/journey/stops';
import { buildTrack } from '../../src/journey/timeline';
import { jumpPlan, snapStops, targetFromLocation } from '../../src/overlay/links';

describe('links to a place (spec §8.4)', () => {
  it('reads the place from the hash', () => {
    expect(targetFromLocation('#night', '')).toBe(4);
  });

  it('answers -1 for an unknown place, so the visit starts at Golden (Review Focus 2)', () => {
    expect(targetFromLocation('#foo', '')).toBe(-1);
    expect(targetFromLocation('', '')).toBe(-1);
  });

  it('also reads ?stop=, the test flag', () => {
    expect(targetFromLocation('', '?stop=sunrise')).toBe(8);
  });

  it('glides to a neighbour and fades to anywhere further', () => {
    expect(jumpPlan(0, 1)).toBe('glide');
    expect(jumpPlan(5, 4)).toBe('glide');
    expect(jumpPlan(0, 5)).toBe('fade');
  });
});

describe('touch snap points', () => {
  it('start at 0, end at 1, and sit on the stops in between', () => {
    const track = buildTrack(STOPS);
    const stops = snapStops(track);
    expect(stops).toHaveLength(9);
    expect(stops[0]).toBe(0);
    expect(stops[8]).toBe(1);
    for (let i = 1; i < stops.length; i++) expect(stops[i]).toBeGreaterThan(stops[i - 1] as number);
  });
});
