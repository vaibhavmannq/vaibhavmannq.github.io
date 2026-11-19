import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import { createSurfaceSampler, type GridMeta } from '../../src/world/heights';
import { PEBBLES, pebbleField, pebblesInPlay } from '../../src/world/pebbles';

const manifest = JSON.parse(readFileSync('public/world/manifest.json', 'utf8'));
const meta: GridMeta = manifest.base.heights;
const q = new Uint16Array(readFileSync('public/world/base/heights.bin').buffer.slice(0));
const surface = createSurfaceSampler(q, meta);

describe("Golden's pebbles (s16)", () => {
  const field = pebbleField(surface);
  const [cx, cy] = SHOTS.golden.cam;
  const yaw = (SHOTS.golden.look[0] * Math.PI) / 180;

  it('lays a few hundred in front of the eye, on the beach between the swash and the dry sand', () => {
    expect(field.length).toBeGreaterThan(200);
    expect(field.length).toBeLessThanOrEqual(PEBBLES.n);
    for (const p of field) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      expect(d).toBeGreaterThanOrEqual(PEBBLES.near - 1e-6);
      expect(d).toBeLessThanOrEqual(PEBBLES.far + 1e-6);
      const a = Math.atan2(p.x - cx, p.y - cy);
      expect(Math.abs(Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw)))).toBeLessThanOrEqual(PEBBLES.spread + 1e-6);
      expect(p.z).toBeGreaterThan(-0.05);
      expect(p.z).toBeLessThan(1.4);
      expect(p.r).toBeGreaterThan(0.01);
      expect(p.r).toBeLessThan(0.1);
    }
  });

  it('is the same on every visit (seeded)', () => {
    expect(pebbleField(surface)).toEqual(field);
  });

  it('shows only at Golden and the first part of the flight away', () => {
    expect(pebblesInPlay({ kind: 'stop', a: 0, t: 0 })).toBe(true);
    expect(pebblesInPlay({ kind: 'flight', a: 0, t: 0.5 })).toBe(true);
    expect(pebblesInPlay({ kind: 'flight', a: 0, t: 0.7 })).toBe(false);
    expect(pebblesInPlay({ kind: 'stop', a: 1, t: 0 })).toBe(false);
  });
});
