import { describe, expect, it } from 'vitest';
import { bakedAt, decodeTexel, keyShines, shadowBlend } from '../../src/world/baked';

const dir = (elDeg: number, azDeg: number): [number, number, number] => {
  const e = (elDeg * Math.PI) / 180;
  const a = (azDeg * Math.PI) / 180;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
};

describe('shadowBlend', () => {
  const keys = [dir(3.6, -33), dir(1, -40), dir(22, 140), dir(7, -82), dir(14, 50)];

  it('at a stop, its own map alone, fully weighted', () => {
    const b = shadowBlend(dir(1, -40), keys);
    expect(b.a).toBe(1);
    expect(b.t).toBeLessThan(0.001); // below the shader's cut for reading a second map
    expect(b.weight).toBe(1);
  });

  it('a ride blends the two nearest hours’ shadows', () => {
    // halfway from Golden's sun to Sunset's (7.5° apart)
    const b = shadowBlend(dir(2.3, -36.5), keys);
    expect([b.a, b.b].sort()).toEqual([0, 1]);
    expect(b.t).toBeGreaterThan(0.3);
    expect(b.t).toBeLessThan(0.7);
    expect(b.weight).toBe(1);
    // nearer Sunset: more of Sunset's map
    const near = shadowBlend(dir(1.5, -39), keys);
    const tSunset = near.a === 1 ? 1 - near.t : near.t;
    expect(tSunset).toBeGreaterThan(0.6);
  });

  it('a map whose key is far from now weighs nothing', () => {
    // the moon handing over from Night (az 140) to Midnight (az −82): mid-swing, neither map is near
    const b = shadowBlend(dir(30, 30), keys.slice(2, 4));
    expect(b.weight).toBe(0);
    const c = shadowBlend(dir(3.6, -33), keys);
    expect(c.weight).toBe(1);
  });

  it('the weights change smoothly as the key moves', () => {
    let prev = shadowBlend(dir(3.6, -33), keys);
    for (let s = 1; s <= 60; s++) {
      const el = 3.6 + (s / 60) * 20;
      const now = shadowBlend(dir(el, -33), keys);
      expect(Math.abs(now.weight - prev.weight)).toBeLessThan(0.2);
      prev = now;
    }
  });
});

describe('keyShines', () => {
  it('a key that is off reads no shadow; a lit one reads all of it', () => {
    expect(keyShines(0)).toBe(0); // First light: the sun below the horizon
    expect(keyShines(0.42)).toBe(1); // Night's moon (0.7 × KEY_SCALE)
    expect(keyShines(2.1)).toBe(1); // Golden's sun
    expect(keyShines(0.1)).toBeGreaterThan(0);
    expect(keyShines(0.1)).toBeLessThan(1);
  });
});

describe('the baked texel', () => {
  it('decodes the bake’s 16-bit height and penumbra', () => {
    // bake_light.py encode_key: q = (h - lo) / 0.1; R = q >> 8, G = q & 255, B = w * 10
    const lo = -30;
    const q = Math.round((12.5 - lo) / 0.1);
    const t = decodeTexel(q >> 8, q & 255, 25, lo, 0.1);
    expect(t.h).toBeCloseTo(12.5, 2);
    expect(t.w).toBeCloseTo(2.5, 5);
  });

  it('outside every map, shadow and AO are 1', () => {
    const out = bakedAt(null, 0, 0, 0);
    expect(out).toEqual({ shadow: 1, ao: 1 });
  });

  it('lit above the shadow height, dark below, soft in between', () => {
    const map = { x0: 0, y0: 0, step: 1, nx: 2, ny: 2, h: [10, 10, 10, 10], w: [1, 1, 1, 1], ao: [0.8, 0.8, 0.8, 0.8] };
    expect(bakedAt(map, 1, 1, 12).shadow).toBe(1);
    expect(bakedAt(map, 1, 1, 8).shadow).toBe(0);
    expect(bakedAt(map, 1, 1, 10).shadow).toBeCloseTo(0.5, 5);
    expect(bakedAt(map, 1, 1, 10).ao).toBeCloseTo(0.8, 5);
    expect(bakedAt(map, 5, 1, 0)).toEqual({ shadow: 1, ao: 1 });
  });
});
