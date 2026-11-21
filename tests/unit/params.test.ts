import { describe, expect, it } from 'vitest';
import { readParams } from '../../src/app/params';

describe('URL flags (spec §17)', () => {
  it('reads nothing from an empty query', () => {
    expect(readParams('')).toEqual({
      hud: false,
      stills: false,
      webgl: false,
      nogl: false,
      auroraActive: false,
      gpu: false,
    });
  });

  it('reads the tier by name', () => {
    expect(readParams('?tier=low').tier).toBe(0);
    expect(readParams('?tier=high').tier).toBe(2);
    expect(readParams('?tier=ultra').tier).toBe(3);
    expect(readParams('?tier=extreme').tier).toBeUndefined();
  });

  it('ignores an unknown stop (Review Focus 2)', () => {
    expect(readParams('?stop=foo').stop).toBeUndefined();
    expect(readParams('?stop=night').stop).toBe('night');
  });

  // final review I4: the Blender stills are only the no-GPU fallback now (D27); they would cover the live world's
  // lantern, look-around and spots at every stop
  it('shows the stills over a live world only when asked (?stills=on)', () => {
    expect(readParams('?stills=on').stills).toBe(true);
    expect(readParams('?stills=off').stills).toBe(false);
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
