import { describe, expect, it } from 'vitest';
import { readDebugParams } from '../../src/app/params';

describe('readDebugParams', () => {
  it('has safe defaults when nothing is set', () => {
    expect(readDebugParams('')).toEqual({
      tier: undefined,
      p: undefined,
      time: undefined,
      moon: undefined,
      length: undefined,
      hud: false,
      gui: false,
      forceWebGL: false,
      stills: false,
      bare: false,
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

  it('clamps a moon override and falls back to undefined for junk input', () => {
    expect(readDebugParams('?moon=0.3').moon).toBe(0.3);
    expect(readDebugParams('?moon=1.7').moon).toBe(1);
    expect(readDebugParams('?moon=-0.4').moon).toBe(0);
    expect(readDebugParams('?moon=abc').moon).toBeUndefined();
    expect(readDebugParams('').moon).toBeUndefined();
  });

  it('reads a journey length and clamps it to 1.5–4 screen heights', () => {
    expect(readDebugParams('?length=2.8').length).toBe(2.8);
    expect(readDebugParams('?length=9').length).toBe(4);
    expect(readDebugParams('?length=0.5').length).toBe(1.5);
    expect(readDebugParams('?length=abc').length).toBeUndefined();
  });

  it('treats presence-only flags as true', () => {
    const params = readDebugParams('?hud&gui&webgl&stills&bare');
    expect(params.bare).toBe(true);
    expect(params.hud).toBe(true);
    expect(params.gui).toBe(true);
    expect(params.forceWebGL).toBe(true);
    expect(params.stills).toBe(true);
  });
});
