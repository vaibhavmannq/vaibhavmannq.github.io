import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPOT_WALK_MS, SPOTS, sampleSpot, spotLength } from '../../src/journey/spots';
import { STOPS } from '../../src/journey/stops';
import { toThree } from '../../src/journey/types';
import { createHeightSampler } from '../../src/world/heights';

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const bytes = readFileSync('public/world/base/heights.bin');
const heightAt = createHeightSampler(
  new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2),
  base.heights,
);

describe("Golden's spots (Amendment 1 §6 step 2; plan M2.5 Task 7)", () => {
  it('has two spots at Golden, each starting at its camera', () => {
    const golden = SPOTS.filter((s) => s.stop === 'golden');
    expect(golden.length).toBe(2);
    for (const s of golden) expect(s.points[0]).toEqual(STOPS[0]?.cam);
  });

  it('walks at 1.2 m/s over a short baked path', () => {
    for (const s of SPOTS) {
      expect(spotLength(s), s.id).toBeGreaterThanOrEqual(2);
      expect(spotLength(s), s.id).toBeLessThanOrEqual(40);
      expect(SPOT_WALK_MS(s)).toBeCloseTo((spotLength(s) / 1.2) * 1000, 6);
    }
  });

  // Review Focus 5
  it('never enters rock or sea: every sample stays ≥ 0.4 m above max(ground, 0)', () => {
    for (const s of SPOTS) {
      for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        const p = sampleSpot(s, t).coast;
        expect(p[2] - Math.max(heightAt(p[0], p[1]), 0), `${s.id} t=${t}`).toBeGreaterThanOrEqual(0.4);
      }
    }
  });

  it('starts at the path and ends there, looking where the spot looks', () => {
    for (const s of SPOTS) {
      expect(sampleSpot(s, 0).position).toEqual(toThree(s.points[0] ?? [0, 0, 0]));
      const end = sampleSpot(s, 1);
      expect(end.position).toEqual(toThree(s.points[s.points.length - 1] ?? [0, 0, 0]));
      expect(end.yaw).toBeCloseTo(s.look[0], 6);
      expect(end.pitch).toBeCloseTo(s.look[1], 6);
    }
  });

  it('each spot has an HTML twin for keyboards and screen readers', () => {
    const html = readFileSync('index.html', 'utf8');
    for (const s of SPOTS) expect(html, s.id).toContain(`data-spot="${s.id}"`);
  });
});
