import { describe, expect, it } from 'vitest';
import { readDebugParams } from '../../src/app/params';

describe('readDebugParams', () => {
  it('has safe defaults when nothing is set', () => {
    expect(readDebugParams('')).toEqual({
      tier: undefined,
      p: undefined,
      time: undefined,
      hud: false,
      gui: false,
      forceWebGL: false,
      stills: false,
    });
  });

  it('reads a valid tier and ignores invalid ones', () => {
    expect(readDebugParams('?tier=2').tier).toBe(2);
    expect(readDebugParams('?tier=7').tier).toBeUndefined();
    expect(readDebugParams('?tier=1.5').tier).toBeUndefined();
    expect(readDebugParams('?tier=abc').tier).toBeUndefined();
  });

  it('clamps progress and keeps a frozen time of zero', () => {
    expect(readDebugParams('?p=1.4').p).toBe(1);
    expect(readDebugParams('?p=0.6').p).toBe(0.6);
    expect(readDebugParams('?time=0').time).toBe(0);
    expect(readDebugParams('?time=').time).toBeUndefined();
  });

  it('treats presence-only flags as true', () => {
    const params = readDebugParams('?hud&gui&webgl&stills');
    expect(params.hud).toBe(true);
    expect(params.gui).toBe(true);
    expect(params.forceWebGL).toBe(true);
    expect(params.stills).toBe(true);
  });
});
