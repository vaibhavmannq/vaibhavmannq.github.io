import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import { glintAt, SPOT_WALK_MS, SPOTS, sampleSpot, spotLength, spotsAt, spotsOpen } from '../../src/journey/spots';
import { STOPS, stopIndex } from '../../src/journey/stops';
import { toThree } from '../../src/journey/types';
import { createHeightSampler } from '../../src/world/heights';

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const bytes = readFileSync('public/world/base/heights.bin');
const heightAt = createHeightSampler(
  new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2),
  base.heights,
);

/** 0.4 m, or less where the stop's own eye is lower over the live grid (Sunset's is 0.32 m, D32; ruling R60). */
const floor = (s: (typeof SPOTS)[number]) => {
  const c = s.points[0] as [number, number, number];
  return Math.min(0.4, c[2] - Math.max(heightAt(c[0], c[1]), 0) - 1e-6);
};

describe("Golden's spots (Amendment 1 §6 step 2; plan M2.5 Task 7)", () => {
  it('has two spots at Golden and one at each other cove stop and at Blue hour (plan M3 Task 7, M4 Task 5), each starting at its camera', () => {
    const count = (id: string) => SPOTS.filter((s) => s.stop === id).length;
    expect(count('golden')).toBe(2);
    for (const id of ['sunset', 'dusk', 'bluehour', 'firstlight', 'sunrise']) expect(count(id), id).toBe(1);
    for (const id of ['night', 'midnight', 'beforedawn']) expect(count(id), id).toBe(0);
    for (const s of SPOTS) expect(s.points[0], s.id).toEqual(STOPS[stopIndex(s.stop)]?.cam);
  });

  it('offers only the spots of the stop the visitor rests at', () => {
    expect(spotsAt(stopIndex('golden')).map((s) => s.id)).toEqual(['water-edge', 'lantern']);
    expect(spotsAt(stopIndex('dusk')).map((s) => s.stop)).toEqual(['dusk']);
    expect(spotsAt(stopIndex('night'))).toEqual([]);
  });

  it("puts each glint in its stop's frame, over the ground, where a tap can find it", () => {
    for (const s of SPOTS) {
      const sh = SHOTS[s.stop];
      const [x, y, z] = glintAt(s);
      expect(z - Math.max(heightAt(x, y), 0), s.id).toBeGreaterThanOrEqual(0.05);
      const dx = x - (sh.cam[0] as number);
      const dy = y - (sh.cam[1] as number);
      const yaw = (Math.atan2(dx, dy) * 180) / Math.PI;
      const dyaw = ((yaw - sh.look[0] + 540) % 360) - 180;
      const el = (Math.atan2(z - sh.eyeZ, Math.hypot(dx, dy)) * 180) / Math.PI;
      const h = (Math.atan(18 / sh.lens) * 180) / Math.PI;
      const v = (Math.atan(18 / sh.lens / (16 / 9)) * 180) / Math.PI;
      expect(Math.abs(dyaw), s.id).toBeLessThan(h * 0.9);
      expect(Math.abs(el - sh.look[1]), s.id).toBeLessThan(v * 0.9);
    }
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
        expect(p[2] - Math.max(heightAt(p[0], p[1]), 0), `${s.id} t=${t}`).toBeGreaterThanOrEqual(floor(s));
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
          expect(clear, `${s.id} t=${i / 40} w=${w}`).toBeGreaterThanOrEqual(floor(s));
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
