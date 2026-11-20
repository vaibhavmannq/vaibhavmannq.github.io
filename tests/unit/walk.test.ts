import { describe, expect, it } from 'vitest';
import { walkStart } from '../../src/journey/flights';
import type { FrameState } from '../../src/journey/timeline';
import { createWalk, WALK_SECONDS, walkAt } from '../../src/journey/walk';
import { caveFloorSite, fungiClusters, scatterFloor } from '../../src/world/caveFloor';

const stop = (stopT: number, resting = true): FrameState => ({
  kind: 'stop',
  a: 6,
  b: 6,
  t: 0.5,
  resting,
  hourWeight: 0,
  skyWeight: 0,
  stillWeight: 1,
  fade: 0,
  stopT,
});
const flight = (a: number, b: number): FrameState => ({ ...stop(0), kind: 'flight', a, b, resting: false });

describe('the stop’s walk (plan M7 Task 2)', () => {
  it('meets the flight in at the deep end and the flight out at the stop’s camera', () => {
    for (const e of [0, 0.5, 1]) {
      expect(walkAt(0, e)).toBe(0);
      expect(walkAt(1, e)).toBe(1);
    }
  });
  it('rests at the stop’s middle at the deep end, then walks there with time', () => {
    expect(walkAt(0.5, 0)).toBe(0);
    expect(walkAt(0.5, 0.5)).toBeCloseTo(0.5, 5);
    expect(walkAt(0.5, 1)).toBe(1);
  });
  it('takes WALK_SECONDS while resting, starts again after leaving, counts as done in the flight out', () => {
    const w = createWalk(6);
    w.step(flight(5, 6), 0.016, false);
    let s = 0;
    for (let t = 0; t < WALK_SECONDS / 2; t += 0.1) s = w.step(stop(0.5), 0.1, false);
    expect(s).toBeGreaterThan(0.3);
    expect(s).toBeLessThan(0.7);
    for (let t = 0; t < WALK_SECONDS; t += 0.1) s = w.step(stop(0.5), 0.1, false);
    expect(s).toBe(1);
    w.step(flight(6, 7), 0.016, false);
    expect(w.step(stop(0.5), 0, false)).toBe(1);
    w.step(flight(5, 6), 0.016, false);
    expect(w.step(stop(0.5), 0, false)).toBe(0);
    expect(createWalk(6).step(stop(0.5), 1, true)).toBe(1);
  });
  it('starts 14 m behind the camera, against the view', () => {
    const [x, y, z] = walkStart([0, 0, 5], -10, 14);
    expect(Math.hypot(x, y)).toBeCloseTo(14, 5);
    expect(z).toBe(5);
    expect(y).toBeLessThan(-13);
  });
});

describe('the cave floor and fungi (plan M7 Tasks 4, 5)', () => {
  const along = (x: number, y: number) => -y;
  const lateral = (x: number, _y: number) => x;
  const site = caveFloorSite({
    along,
    lateral,
    at: (s, l) => [l, -s],
    halfW: 2.6,
    passageEnd: 19,
    walkDepth: 14,
    pool: { x: 0, y: 4, r: 3 },
  });
  const stones = scatterFloor(site, [-9.5, -20, 9.5, 9.5]);
  // plan M8 Task 7: small cobbles (r <= 0.15 m, far under the 1.5 m eye) may lie on the walk's line; nothing larger
  it('keeps the walk’s line clear of all but cobbles, the pool clear, and gathers stones against the walls', () => {
    expect(stones.length).toBeGreaterThan(80);
    let nearWall = 0;
    for (const s of stones) {
      // the walk runs from 14.5 m behind the camera (y = -14.5) out through the mouth
      if (s.y > -14.5 && s.y < 17 && s.r > 0.15) expect(Math.abs(s.x) - s.r).toBeGreaterThan(0.79);
      expect(Math.hypot(s.x, s.y - 4)).toBeGreaterThan(3 + s.r - 1e-6);
      if (site.nearWall(s.x, s.y) > 0.5) nearWall++;
    }
    expect(nearWall / stones.length).toBeGreaterThan(0.5);
  });
  it('places fungi in clusters, not evenly (book §6)', () => {
    const shell: number[] = [];
    for (let a = 0; a < 360; a += 3)
      for (let z = 0; z < 2; z += 0.3)
        shell.push(8 * Math.sin((a * Math.PI) / 180), 7 * Math.cos((a * Math.PI) / 180) - 3, z);
    const f = fungiClusters({
      shell: new Float32Array(shell),
      passage: { position: new Float32Array(0), floor: new Float32Array(0) },
      stones: [],
      along,
      lateral,
    });
    const n = f.length / 4;
    expect(n).toBeGreaterThan(60);
    // nearest-neighbour distances: most points have a neighbour within 0.3 m (clusters), the clusters 1.6 m apart
    let close = 0;
    for (let i = 0; i < n; i++) {
      let best = Number.POSITIVE_INFINITY;
      for (let j = 0; j < n; j++)
        if (i !== j)
          best = Math.min(
            best,
            Math.hypot(
              (f[i * 4] ?? 0) - (f[j * 4] ?? 0),
              (f[i * 4 + 1] ?? 0) - (f[j * 4 + 1] ?? 0),
              (f[i * 4 + 2] ?? 0) - (f[j * 4 + 2] ?? 0),
            ),
          );
      if (best < 0.3) close++;
    }
    expect(close / n).toBeGreaterThan(0.85);
  });
});
