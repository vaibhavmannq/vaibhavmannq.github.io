import { describe, expect, it } from 'vitest';
import { skyFileFor } from '../../src/assets/skies';
import { blendWeather, CLOUD_WEATHER, photoDrift, shellHit, skyMode, usesClearSky } from '../../src/world/skyClouds';

describe('the sky mode (Phase 2 Task 12)', () => {
  it('drift by default; photo and volume when named; the s27 flat layer is gone', () => {
    expect(skyMode('')).toBe('drift');
    expect(skyMode('?sky=nonsense')).toBe('drift');
    expect(skyMode('?sky=photo')).toBe('photo');
    expect(skyMode('?sky=volume')).toBe('volume');
    expect(skyMode('?sky=layer')).toBe('drift');
  });
  it('the ceiling drifts out and back, never further than its reach', () => {
    for (let c = 0; c < 5000; c += 37) expect(Math.abs(photoDrift(c))).toBeLessThanOrEqual(350);
    expect(photoDrift(0)).toBe(0);
  });
});

describe('the sky of our own clouds (Task 12, s32)', () => {
  it('names the new modes; anything else is drift', () => {
    expect(skyMode('?sky=deck')).toBe('deck');
    expect(skyMode('?sky=layers')).toBe('layers');
    expect(skyMode('?sky=clear')).toBe('clear');
    expect(skyMode('?sky=clouds')).toBe('drift');
  });
  it('the cloud modes read the clear copies, photo and drift the photos', () => {
    const entry = { file: 'sky/golden.jpg', clear: 'sky/golden-clear.jpg' };
    for (const m of ['clear', 'deck', 'layers', 'volume'] as const) {
      expect(usesClearSky(m)).toBe(true);
      expect(skyFileFor(entry, m)).toBe('sky/golden-clear.jpg');
    }
    for (const m of ['photo', 'drift'] as const) expect(skyFileFor(entry, m)).toBe('sky/golden.jpg');
    // a manifest from before the clear copies: the photo
    expect(skyFileFor({ file: 'sky/golden.jpg' }, 'deck')).toBe('sky/golden.jpg');
  });
  it('weather blends per channel and stays inside 0..1', () => {
    const a = CLOUD_WEATHER.golden;
    const b = CLOUD_WEATHER.beforedawn;
    expect(blendWeather(a, b, 0)).toEqual(a);
    expect(blendWeather(a, b, 1)).toEqual(b);
    const h = blendWeather(a, b, 0.5);
    expect(h.cover).toBeCloseTo((a.cover + b.cover) / 2);
    expect(h.base).toBeCloseTo((a.base + b.base) / 2);
    const over = blendWeather({ ...a, cover: 2 }, b, -1);
    expect(over.cover).toBe(1);
  });
  it('the shell is the flat distance overhead and finite at the horizon', () => {
    expect(shellHit(10, 1, 1800)).toBeCloseTo(1790, 0);
    const flat = (1800 - 10) / Math.sin(0.5);
    expect(Math.abs(shellHit(10, Math.sin(0.5), 1800) / flat - 1)).toBeLessThan(0.01);
    const far = shellHit(10, 0, 1800);
    expect(far).toBeGreaterThan(100_000);
    expect(far).toBeLessThan(200_000);
    expect(Number.isFinite(shellHit(10, -0.05, 1800))).toBe(true);
  });
});

describe('the band sky (s32)', () => {
  it('band reads its own copy, else the photo', () => {
    expect(skyMode('?sky=band')).toBe('band');
    expect(skyFileFor({ file: 'sky/a.jpg', clear: 'sky/a-clear.jpg', band: 'sky/a-band.jpg' }, 'band')).toBe(
      'sky/a-band.jpg',
    );
    expect(skyFileFor({ file: 'sky/a.jpg', clear: 'sky/a-clear.jpg' }, 'band')).toBe('sky/a.jpg');
  });
});
