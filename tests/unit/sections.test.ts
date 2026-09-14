import { describe, expect, it } from 'vitest';
import { CROSSFADE_BAND, crossfadeOffset, crossfadeOpacity } from '../../src/overlay/sections';

describe('crossfadeOpacity', () => {
  it('is fully current and fully hidden-next before the crossfade band starts', () => {
    expect(crossfadeOpacity('outgoing', 0, false)).toBe(1);
    expect(crossfadeOpacity('incoming', 0, false)).toBe(0);
    // still true right up to the edge of the band
    expect(crossfadeOpacity('outgoing', 1 - CROSSFADE_BAND, false)).toBe(1);
    expect(crossfadeOpacity('incoming', 1 - CROSSFADE_BAND, false)).toBe(0);
  });

  it('reaches the handover exactly at mix 1: current gone, next fully in', () => {
    expect(crossfadeOpacity('outgoing', 1, false)).toBe(0);
    expect(crossfadeOpacity('incoming', 1, false)).toBe(1);
  });

  it('overlaps inside the band: both strictly between 0 and 1, and they sum to 1', () => {
    const mix = 1 - CROSSFADE_BAND / 2; // dead centre of the band
    const outgoing = crossfadeOpacity('outgoing', mix, false);
    const incoming = crossfadeOpacity('incoming', mix, false);
    expect(outgoing).toBeGreaterThan(0);
    expect(outgoing).toBeLessThan(1);
    expect(incoming).toBeGreaterThan(0);
    expect(incoming).toBeLessThan(1);
    expect(outgoing + incoming).toBeCloseTo(1, 10);
  });

  it('is monotonic across the band (no flicker)', () => {
    const samples = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1];
    let previous = -Infinity;
    for (const mix of samples) {
      const value = crossfadeOpacity('incoming', mix, false);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('scrolling backwards produces exactly the mirrored values (pure function, no hysteresis)', () => {
    const steps = [0.7, 0.8, 0.9, 1];
    const forward = steps.map((mix) => crossfadeOpacity('incoming', mix, false));
    const backward = [...steps].reverse().map((mix) => crossfadeOpacity('incoming', mix, false));
    expect(backward).toEqual([...forward].reverse());
    // and the outgoing side mirrors too
    const forwardOut = steps.map((mix) => crossfadeOpacity('outgoing', mix, false));
    const backwardOut = [...steps].reverse().map((mix) => crossfadeOpacity('outgoing', mix, false));
    expect(backwardOut).toEqual([...forwardOut].reverse());
  });

  it('reduced motion is a hard switch at the next anchor, never a gradient', () => {
    expect(crossfadeOpacity('outgoing', 0.5, true)).toBe(1);
    expect(crossfadeOpacity('incoming', 0.5, true)).toBe(0);
    expect(crossfadeOpacity('outgoing', 0.99, true)).toBe(1);
    expect(crossfadeOpacity('incoming', 0.99, true)).toBe(0);
    expect(crossfadeOpacity('outgoing', 1, true)).toBe(0);
    expect(crossfadeOpacity('incoming', 1, true)).toBe(1);
    for (const mix of [0, 0.1, 0.3, 0.49, 0.5, 0.7, 1]) {
      const value = crossfadeOpacity('outgoing', mix, true);
      expect(value === 0 || value === 1).toBe(true);
    }
  });
});

describe('crossfadeOffset', () => {
  it('is at rest (0) before the band starts, and settles back to rest once the handover completes', () => {
    // outgoing hasn't started exiting yet
    expect(crossfadeOffset('outgoing', 0, false)).toBe(0);
    expect(crossfadeOffset('outgoing', 1 - CROSSFADE_BAND, false)).toBe(0);
    // incoming has fully arrived and settled back to no offset
    expect(crossfadeOffset('incoming', 1, false)).toBe(0);
  });

  it('the incoming section starts displaced and settles to 0 as it becomes current', () => {
    const early = Math.abs(crossfadeOffset('incoming', 1 - CROSSFADE_BAND + 0.001, false));
    const late = Math.abs(crossfadeOffset('incoming', 1 - CROSSFADE_BAND / 4, false));
    expect(early).toBeGreaterThan(late);
  });

  it('reduced motion drops the offset entirely, at every point in the band', () => {
    for (const mix of [0, 0.3, 0.7, 0.85, 1]) {
      expect(crossfadeOffset('outgoing', mix, true)).toBe(0);
      expect(crossfadeOffset('incoming', mix, true)).toBe(0);
    }
  });
});
