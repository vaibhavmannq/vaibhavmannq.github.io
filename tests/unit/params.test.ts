import { describe, expect, it } from 'vitest';
import { readParams } from '../../src/app/params';

describe('URL flags (spec §17)', () => {
  it('reads nothing from an empty query', () => {
    expect(readParams('')).toEqual({ hud: false, stills: true, webgl: false, nogl: false, auroraActive: false });
  });

  it('reads the tier by name', () => {
    expect(readParams('?tier=low').tier).toBe(0);
    expect(readParams('?tier=high').tier).toBe(2);
    expect(readParams('?tier=ultra').tier).toBeUndefined();
  });

  it('ignores an unknown stop (Review Focus 2)', () => {
    expect(readParams('?stop=foo').stop).toBeUndefined();
    expect(readParams('?stop=night').stop).toBe('night');
  });

  it('reads progress clamped to 0..1, and the switches', () => {
    expect(readParams('?p=1.5').p).toBe(1);
    expect(readParams('?p=abc').p).toBeUndefined();
    expect(readParams('?hud&stills=off&webgl&nogl')).toMatchObject({
      hud: true,
      stills: false,
      webgl: true,
      nogl: true,
    });
  });
});
