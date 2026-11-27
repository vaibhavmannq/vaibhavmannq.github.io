/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOURS, windVector } from '../../src/journey/hours';
import { SHOTS } from '../../src/journey/shots';
import { STOP_IDS, type StopId } from '../../src/journey/types';
import { createSurfaceSampler } from '../../src/world/heights';
import {
  FLOCK_AFTER,
  GUST_PETALS,
  LIFE_STOPS,
  type LifeKind,
  lifeSprites,
  MOTES,
  RING_SPEED,
  ringAt,
  SKEIN,
  type Sprite,
} from '../../src/world/life';

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const hb = readFileSync('public/world/base/heights.bin');
const ground = createSurfaceSampler(new Uint16Array(hb.buffer, hb.byteOffset, hb.byteLength / 2), base.heights);
const KINDS: LifeKind[] = ['gull', 'bat', 'flock', 'petal', 'dew', 'mote'];
const at = (stop: StopId, t: number, since = t, reduced = false) =>
  lifeSprites(stop, t, since, HOURS[stop].world, ground, reduced);
const times = Array.from({ length: 241 }, (_, i) => i * 0.25); // a minute

/** the angle (deg) of a point off the camera's look, sideways and up */
function inView(stop: StopId, s: Sprite): boolean {
  const sh = SHOTS[stop];
  const [cx, cy] = sh.cam;
  const dx = s.x - cx;
  const dy = s.y - cy;
  const yaw = (Math.atan2(dx, dy) * 180) / Math.PI;
  const dyaw = ((yaw - sh.look[0] + 540) % 360) - 180;
  const el = (Math.atan2(s.z - sh.eyeZ, Math.hypot(dx, dy)) * 180) / Math.PI;
  const h = (Math.atan(18 / sh.lens) * 180) / Math.PI;
  const v = (Math.atan(18 / sh.lens / (16 / 9)) * 180) / Math.PI;
  return Math.abs(dyaw) < h && Math.abs(el - sh.look[1]) < v;
}

// plan M3 Task 6 (reference book §10; ideas C): gulls at I, II, IX; bats at III; the flock at IX; petals at II; dew
// at IX; a fish ring at VIII. Review: each creature only at its stops, and never in the ground.
describe('the life layer', () => {
  it('puts each creature only at its stops', () => {
    for (const stop of STOP_IDS) {
      const kinds = new Set(times.flatMap((t) => at(stop, t).map((s) => s.kind)));
      for (const k of KINDS) {
        if (LIFE_STOPS[k].includes(stop)) expect(kinds.has(k), `${k} at ${stop}`).toBe(true);
        else expect(kinds.has(k), `${k} at ${stop}`).toBe(false);
      }
    }
    expect(LIFE_STOPS.gull).toEqual(['golden', 'sunset', 'sunrise']);
    expect(LIFE_STOPS.bat).toEqual(['dusk']);
  });

  it('keeps flyers in the sky and petals and dew on the land, never under it', () => {
    for (const stop of STOP_IDS)
      for (const t of times)
        for (const s of at(stop, t)) {
          const g = Math.max(0, ground(s.x, s.y));
          const where = `${s.kind} at ${stop} t=${t} (${s.x.toFixed(1)}, ${s.y.toFixed(1)}, ${s.z.toFixed(1)}) g=${g.toFixed(1)}`;
          if (s.kind === 'gull') expect(s.z - g, where).toBeGreaterThan(8);
          if (s.kind === 'bat' || s.kind === 'flock') expect(s.z - g, where).toBeGreaterThan(1.5);
          if (s.kind === 'petal') expect(s.z - g, where).toBeGreaterThan(0.1);
          if (s.kind === 'dew') {
            expect(ground(s.x, s.y), where).toBeGreaterThan(0.5); // on grass, not in the sea
            expect(s.z - g, where).toBeGreaterThanOrEqual(0);
            expect(s.z - g, where).toBeLessThan(0.4);
          }
        }
  });

  it('shows them: gulls, bats, petals and dew are mostly inside the stop’s frame', () => {
    for (const [kind, stops] of Object.entries(LIFE_STOPS) as [LifeKind, StopId[]][]) {
      if (kind === 'flock') continue;
      for (const stop of stops) {
        const all = times.flatMap((t) => at(stop, t).filter((s) => s.kind === kind && s.alpha > 0.5));
        const seen = all.filter((s) => inView(stop, s)).length;
        expect(seen / all.length, `${kind} at ${stop}`).toBeGreaterThan(0.6);
      }
    }
  });

  it('gulls glide more than they flap, at a gull’s speed', () => {
    const g0 = times.map((t) => at('golden', t).filter((s) => s.kind === 'gull')[0] as Sprite);
    const flapping = g0.filter((s) => s.flapping).length / g0.length;
    expect(flapping).toBeLessThan(0.3);
    expect(flapping).toBeGreaterThan(0.05);
    const v = Math.hypot(
      (g0[1] as Sprite).x - (g0[0] as Sprite).x,
      (g0[1] as Sprite).y - (g0[0] as Sprite).y,
      (g0[1] as Sprite).z - (g0[0] as Sprite).z,
    );
    expect(v / 0.25).toBeGreaterThan(6);
    expect(v / 0.25).toBeLessThan(13);
  });

  it('bats are quick and seen for about a second at a time', () => {
    const dt = 0.05;
    const seen: number[] = [];
    let run = 0;
    for (let t = 0; t < 60; t += dt) {
      const b = at('dusk', t).filter((s) => s.kind === 'bat' && s.alpha > 0.3);
      if (b.length > 0) run += dt;
      else if (run > 0) {
        seen.push(run);
        run = 0;
      }
    }
    expect(seen.length).toBeGreaterThan(6);
    for (const r of seen) expect(r).toBeLessThan(2.4); // two bats can overlap
    const mean = seen.reduce((a, b) => a + b, 0) / seen.length;
    expect(mean).toBeGreaterThan(0.7);
    expect(mean).toBeLessThan(1.6);
  });

  it('the flock lifts off once on arrival at Sunrise, streams one way and is gone', () => {
    expect(at('sunrise', 30, 0.2).filter((s) => s.kind === 'flock' && s.alpha > 0)).toHaveLength(0);
    const early = at('sunrise', 30, FLOCK_AFTER + 0.1).filter((s) => s.kind === 'flock');
    const later = at('sunrise', 30, FLOCK_AFTER + 5).filter((s) => s.kind === 'flock');
    expect(early.length).toBeGreaterThan(12);
    expect(later.length).toBe(early.length);
    // up together
    const meanZ = (l: Sprite[]) => l.reduce((a, s) => a + s.z, 0) / l.length;
    expect(meanZ(later)).toBeGreaterThan(meanZ(early) + 5);
    // one way: every bird's travel within 35° of the mean
    const d = later.map((s, i) => [s.x - (early[i] as Sprite).x, s.y - (early[i] as Sprite).y]);
    const m = d.reduce((a, b) => [(a[0] as number) + (b[0] as number), (a[1] as number) + (b[1] as number)], [0, 0]);
    const mAng = Math.atan2(m[0] as number, m[1] as number);
    for (const [x, y] of d) {
      const diff = Math.abs(((Math.atan2(x as number, y as number) - mAng + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      expect(diff).toBeLessThan((35 * Math.PI) / 180);
    }
    expect(at('sunrise', 30, FLOCK_AFTER + 30).filter((s) => s.kind === 'flock' && s.alpha > 0)).toHaveLength(0);
  });

  it('petals go with Sunset’s wind', () => {
    const a = at('sunset', 10).filter((s) => s.kind === 'petal');
    const b = at('sunset', 10.2).filter((s) => s.kind === 'petal');
    const [wx, wy] = windVector(HOURS.sunset.world);
    let along = 0;
    let n = 0;
    a.forEach((p, i) => {
      const q = b[i] as Sprite;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      if (Math.hypot(dx, dy) > 2) return; // wrapped round
      along += (dx * wx + dy * wy) / Math.hypot(wx, wy) / 0.2;
      n++;
    });
    expect(n).toBeGreaterThan(10);
    expect(along / n).toBeGreaterThan(1); // m/s downwind
  });

  it('under reduced motion only the still dew stays', () => {
    for (const stop of STOP_IDS)
      for (const s of lifeSprites(stop, 12, 12, HOURS[stop].world, ground, true)) expect(s.kind).toBe('dew');
  });
});

describe('the fish ring at First light', () => {
  it('rises every 4–9 s on open water in view, and spreads at 0.2–0.3 m/s', () => {
    expect(RING_SPEED).toBeGreaterThanOrEqual(0.2);
    expect(RING_SPEED).toBeLessThanOrEqual(0.3);
    const starts: number[] = [];
    let last = -1;
    for (let t = 0; t < 120; t += 0.05) {
      const r = ringAt(t, ground);
      if (!r) continue;
      expect(ground(r.x, r.y), `${r.x}, ${r.y}`).toBeLessThan(-0.3);
      const s = t - r.age;
      if (Math.abs(s - last) > 0.01) {
        starts.push(s);
        last = s;
        const sh = SHOTS.firstlight;
        const d = Math.hypot(r.x - sh.cam[0], r.y - sh.cam[1]);
        expect(d).toBeGreaterThan(8);
        expect(d).toBeLessThan(40);
      }
    }
    for (let i = 1; i < starts.length; i++) {
      const gap = (starts[i] as number) - (starts[i - 1] as number);
      expect(gap).toBeGreaterThanOrEqual(4 - 1e-6);
      expect(gap).toBeLessThanOrEqual(9 + 1e-6);
    }
  });
});

// Task 16g (s34): Sunset's motes hang in front of the eye over the turf (one drifting past the lens is faded by the
// shader) and drift slowly
describe('motes', () => {
  it('are at Sunset only, all of them, in the air ahead, and off under reduced motion', () => {
    for (const stop of STOP_IDS) {
      const n = at(stop, 10).filter((s) => s.kind === 'mote').length;
      expect(n).toBe(stop === 'sunset' ? MOTES : 0);
    }
    expect(at('sunset', 10, 10, true).some((s) => s.kind === 'mote')).toBe(false);
    const sh = SHOTS.sunset;
    for (const t of [0, 7.5, 33, 90])
      for (const s of at('sunset', t).filter((m) => m.kind === 'mote')) {
        const d = Math.hypot(s.x - sh.cam[0], s.y - sh.cam[1]);
        expect(d).toBeLessThan(25); // 16 m out, ±10 m across, ±4.5 m of drift
        expect(s.z).toBeGreaterThan(Math.max(0, ground(s.x, s.y)) + 0.1);
        expect(s.alpha).toBeGreaterThanOrEqual(0);
        expect(s.alpha).toBeLessThanOrEqual(1);
      }
  });
  it('move under 0.4 m/s', () => {
    const a = at('sunset', 20).filter((m) => m.kind === 'mote');
    const b = at('sunset', 20.25).filter((m) => m.kind === 'mote');
    for (let i = 0; i < a.length; i++) {
      const [p, q] = [a[i] as Sprite, b[i] as Sprite];
      const step = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
      if (step < 3) expect(step / 0.25).toBeLessThan(0.4); // a wrap jumps the drift's length, faded out
    }
  });
});

// Task 16k (s34): petals ride in behind Sunset's gust; a skein crosses the sun now and then
describe('Sunset in the gust, and its skein', () => {
  const petalsAt = (gust: { amp: number; front: number }) =>
    lifeSprites('sunset', 50, 50, HOURS.sunset.world, ground, false, gust).filter((s) => s.kind === 'petal').length;
  it('a gust in view adds petals; none without one or under reduced motion', () => {
    const calm = petalsAt({ amp: 0, front: -110 });
    expect(petalsAt({ amp: 1, front: -20 })).toBeGreaterThan(calm + GUST_PETALS / 2);
    expect(petalsAt({ amp: 1, front: -300 })).toBe(calm);
    const reduced = lifeSprites('sunset', 50, 50, HOURS.sunset.world, ground, true, { amp: 1, front: -20 });
    expect(reduced.some((s) => s.kind === 'petal')).toBe(false);
  });
  it('seven birds cross in each window and none outside it', () => {
    const birds = (t: number) => at('sunset', t).filter((s) => s.kind === 'flock').length;
    expect(birds(SKEIN.first + SKEIN.cross / 2)).toBe(7);
    expect(birds(SKEIN.first + SKEIN.every + SKEIN.cross / 2)).toBe(7);
    expect(birds(SKEIN.first + SKEIN.cross + 5)).toBe(0);
    expect(birds(SKEIN.first - 1)).toBe(0);
  });
});
