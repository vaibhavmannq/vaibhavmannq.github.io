import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPOT_WALK_MS, SPOTS, sampleSpot, spotLength, spotsOpen } from '../../src/journey/spots';
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

  // Review Focus 5, the way back (final review M6): walking back blends in a straight line from wherever the walk
  // was left to the stop's camera
  it('the straight way back from any point of a path stays ≥ 0.4 m above max(ground, 0)', () => {
    for (const s of SPOTS) {
      const cam = s.points[0] as [number, number, number];
      for (let i = 0; i <= 40; i++) {
        const p = sampleSpot(s, i / 40).coast;
        for (let j = 0; j <= 20; j++) {
          const w = j / 20;
          const q = [0, 1, 2].map((k) => (cam[k] as number) + ((p[k] as number) - (cam[k] as number)) * w) as number[];
          const clear = (q[2] as number) - Math.max(heightAt(q[0] as number, q[1] as number), 0);
          expect(clear, `${s.id} t=${i / 40} w=${w}`).toBeGreaterThanOrEqual(0.4);
        }
      }
    }
  });

  // final review M5: a glint picked while the camera still eases back would jump it from mid-way to the stop
  it('the glints come back only once the camera is home', () => {
    expect(spotsOpen(true, 1)).toBe(false);
    expect(spotsOpen(false, 0.5)).toBe(false);
    expect(spotsOpen(false, 0.005)).toBe(true);
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
