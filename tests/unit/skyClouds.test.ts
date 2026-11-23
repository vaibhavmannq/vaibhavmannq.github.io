import { describe, expect, it } from 'vitest';
import { skyFileFor } from '../../src/assets/skies';
import { blendWeather, CLOUD_WEATHER, skyMode } from '../../src/world/skyClouds';

describe('the sky of our own clouds (Task 12, s32, D58)', () => {
  it('cards by default; photo only when named; the dropped modes fall back to cards', () => {
    expect(skyMode('')).toBe('cards');
    expect(skyMode('?sky=photo')).toBe('photo');
    for (const old of ['drift', 'band', 'deck', 'layers', 'volume', 'clear', 'nonsense'])
      expect(skyMode(`?sky=${old}`)).toBe('cards');
  });
  it('the cards draw over the clear copy; photo reads the photo; an old manifest falls back to the photo', () => {
    const entry = { file: 'sky/golden.jpg', clear: 'sky/golden-clear.jpg' };
    expect(skyFileFor(entry, 'cards')).toBe('sky/golden-clear.jpg');
    expect(skyFileFor(entry, 'photo')).toBe('sky/golden.jpg');
    expect(skyFileFor({ file: 'sky/golden.jpg' }, 'cards')).toBe('sky/golden.jpg');
  });
  it('weather blends per channel and stays inside 0..1', () => {
    const a = CLOUD_WEATHER.golden;
    const b = CLOUD_WEATHER.beforedawn;
    expect(blendWeather(a, b, 0)).toEqual(a);
    expect(blendWeather(a, b, 1)).toEqual(b);
    expect(blendWeather(a, b, 0.5).cover).toBeCloseTo((a.cover + b.cover) / 2);
    expect(blendWeather({ ...a, cover: 2 }, b, -1).cover).toBe(1);
  });
  it('night hours keep the aurora clear: thin cover, thin clouds', () => {
    for (const id of ['night', 'midnight'] as const) {
      expect(CLOUD_WEATHER[id].cover).toBeLessThan(0.1);
      expect(CLOUD_WEATHER[id].opacity).toBeLessThanOrEqual(0.55);
    }
  });
});
