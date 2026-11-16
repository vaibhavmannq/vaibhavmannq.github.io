/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import { STOP_IDS } from '../../src/journey/types';
import { createSurfaceSampler } from '../../src/world/heights';
import {
  DRIFT_MAX,
  DUSK_LANTERNS,
  driftOffset,
  duskLanternsInPlay,
  LIGHT_SPAN,
  lanternField,
  litLevel,
  SHALLOWS_AT,
  threadPick,
} from '../../src/world/lanterns';

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const hb = readFileSync('public/world/base/heights.bin');
const ground = createSurfaceSampler(new Uint16Array(hb.buffer, hb.byteOffset, hb.byteLength / 2), base.heights);
const field = lanternField();
const dusk = STOP_IDS.indexOf('dusk');

describe("Dusk's lanterns (plan M3 Task 5; owner lanterns video 4; reference book §7)", () => {
  it('are 44 on open water along coast.py’s path, out of the cove toward the arch', () => {
    expect(field.length).toBe(DUSK_LANTERNS.n);
    const [[x0, y0], [x1, y1]] = DUSK_LANTERNS.path;
    for (const l of field) {
      expect(ground(l.x, l.y), `${l.x}, ${l.y}`).toBeLessThan(-0.5);
      // within the path's band: along 0..1, across at most w0 + w1 + 3 sigma
      const t = ((l.x - x0) * (x1 - x0) + (l.y - y0) * (y1 - y0)) / ((x1 - x0) ** 2 + (y1 - y0) ** 2);
      expect(t).toBeGreaterThan(-0.05);
      expect(t).toBeLessThan(1.05);
    }
  });

  it('come in loose strings: most have a neighbour within 3 m, but they are not a grid', () => {
    const near = field.map((a) =>
      Math.min(...field.filter((b) => b !== a).map((b) => Math.hypot(a.x - b.x, a.y - b.y))),
    );
    expect(near.filter((d) => d < 3).length / near.length).toBeGreaterThan(0.5);
    expect(Math.min(...near)).toBeGreaterThan(0.6); // never touching
  });

  it('drift with the wind at most 0.03 m/s (one lantern width in ~9 s: video 4)', () => {
    for (let t = 0; t < 4000; t += 0.5) {
      const v = Math.abs(driftOffset(t + 0.5) - driftOffset(t)) / 0.5;
      expect(v).toBeLessThanOrEqual(DRIFT_MAX + 1e-9);
    }
    expect(DRIFT_MAX).toBeLessThanOrEqual(0.03);
  });

  it('light one by one as the visitor arrives, every one lit within about 4 s', () => {
    const n = field.length;
    for (let k = 0; k < n; k++) {
      expect(litLevel(k, n, 0)).toBe(0);
      expect(litLevel(k, n, LIGHT_SPAN + 0.6)).toBe(1);
    }
    expect(LIGHT_SPAN).toBeLessThanOrEqual(4);
    // in order: at any moment an earlier one is at least as lit as a later one, and at 1.5 s some are lit, some not
    for (let s = 0; s < 5; s += 0.1)
      for (let k = 1; k < n; k++) expect(litLevel(k - 1, n, s)).toBeGreaterThanOrEqual(litLevel(k, n, s));
    const mid = field.map((_, k) => litLevel(k, n, 1.5));
    expect(mid.some((v) => v === 1) && mid.some((v) => v === 0)).toBe(true);
  });

  it('are drawn at Dusk and on the flights’ near halves only', () => {
    const at = (kind: 'stop' | 'flight', a: string, b: string, t: number) =>
      duskLanternsInPlay({ kind, a: STOP_IDS.indexOf(a as never), b: STOP_IDS.indexOf(b as never), t });
    expect(at('stop', 'dusk', 'dusk', 0.5)).toBe(true);
    expect(at('flight', 'sunset', 'dusk', 0.6)).toBe(true);
    expect(at('flight', 'sunset', 'dusk', 0.3)).toBe(false);
    expect(at('flight', 'dusk', 'bluehour', 0.5)).toBe(true);
    expect(at('flight', 'dusk', 'bluehour', 0.8)).toBe(false);
    expect(at('stop', 'golden', 'golden', 0.5)).toBe(false);
    expect(dusk).toBeGreaterThan(0);
  });

  it("picks the visitor's lantern in the middle of Dusk's view, the same one every time", () => {
    const shot = SHOTS.dusk;
    const k = threadPick(field, shot.cam, shot.look[0]);
    expect(k).toBe(threadPick(field, shot.cam, shot.look[0]));
    const l = field[k];
    if (!l) throw new Error('no pick');
    const yaw = (Math.atan2(l.x - shot.cam[0], l.y - shot.cam[1]) * 180) / Math.PI;
    expect(Math.abs(yaw - shot.look[0])).toBeLessThan(12);
    expect(Math.hypot(l.x - shot.cam[0], l.y - shot.cam[1])).toBeGreaterThan(25);
  });

  it('rests in the shallows at First light: under 0.7 m of water, in its view', () => {
    const [x, y] = SHALLOWS_AT;
    const g = ground(x, y);
    expect(g).toBeLessThan(-0.1);
    expect(g).toBeGreaterThan(-0.7);
    const fl = SHOTS.firstlight;
    const yaw = (Math.atan2(x - fl.cam[0], y - fl.cam[1]) * 180) / Math.PI;
    expect(Math.abs(yaw - fl.look[0])).toBeLessThan(30);
  });
});
