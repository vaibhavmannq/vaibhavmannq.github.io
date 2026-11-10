import { describe, expect, it } from 'vitest';
import { pickSkyTexture, skiesToHold } from '../../src/assets/skies';

describe('which skies stay loaded (spec §12)', () => {
  it('holds the current stop, then the next, then the previous', () => {
    expect(skiesToHold(4, 'stop', 4)).toEqual([4, 5, 3]);
  });

  it('never asks for a stop before the first or after the last', () => {
    expect(skiesToHold(0, 'stop', 0)).toEqual([0, 1]);
    expect(skiesToHold(8, 'stop', 8)).toEqual([8, 7]);
  });

  it('in flight holds both ends first', () => {
    expect(skiesToHold(2, 'flight', 3)).toEqual([2, 3, 4, 1]);
  });
});

describe('the sky shown while one is still loading (Review Focus 1)', () => {
  const F = 'fallback';
  it('uses the nearest loaded sky on the journey', () => {
    const loaded = new Map([
      [4, 'four'],
      [5, 'five'],
    ]);
    expect(pickSkyTexture(6, loaded, F)).toBe('five');
    expect(pickSkyTexture(4, loaded, F)).toBe('four');
  });

  it('falls back when nothing is loaded', () => {
    expect(pickSkyTexture(3, new Map(), F)).toBe(F);
  });
});
