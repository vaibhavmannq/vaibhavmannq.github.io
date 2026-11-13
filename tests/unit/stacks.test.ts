/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StacksMeta } from '../../src/assets/manifest';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, frameAt } from '../../src/journey/timeline';
import { STOP_IDS } from '../../src/journey/types';
import { HEADLAND_PACK } from '../../src/world/headland';
import { decodeStacks, STACKS_SEEN_FROM, STACKS_SEEN_ON, stacksInPlay } from '../../src/world/stacks';
import { cameraSamples, framing, pointTriangle } from './framing';

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const meta = base.stacks as StacksMeta | undefined;
if (!meta) throw new Error('base.json has no stacks: run `npm run world:blender`');
const buf = readFileSync(`public/world/${meta.file}`);
const stacks = decodeStacks(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), meta);
/** Vertex i in coast axes (x east, y north, z up). */
const at = (i: number): [number, number, number] => [
  (stacks.position[i * 3] ?? 0) + meta.x,
  (stacks.position[i * 3 + 1] ?? 0) + meta.y,
  stacks.position[i * 3 + 2] ?? 0,
];

describe('the headland stacks (M2.5 Task 3c)', () => {
  it("decodeStacks returns the meta's counts, in metres around the line", () => {
    expect(stacks.position.length).toBe(meta.verts * 3);
    expect(stacks.index.length).toBe(meta.tris * 3);
    expect(stacks.light.length).toBe(meta.verts);
    expect(stacks.moss.length).toBe(meta.verts);
    expect(stacks.column.length).toBe(meta.verts * 2);
    expect(meta.tris).toBeLessThanOrEqual(150_000);
    let top = -1e9;
    for (let i = 0; i < meta.verts; i++) {
      const [x, y, z] = [stacks.position[i * 3] ?? 0, stacks.position[i * 3 + 1] ?? 0, stacks.position[i * 3 + 2] ?? 0];
      expect(Math.hypot(x, y)).toBeLessThan(400);
      expect(z).toBeGreaterThan(-8);
      top = Math.max(top, z);
    }
    expect(top).toBeGreaterThan(50); // the parent mass, 58 m
    expect(top).toBeLessThan(62);
    let max = 0;
    for (const k of stacks.index) max = Math.max(max, k);
    expect(max).toBeLessThan(meta.verts);
  });

  it('lives in the headland place pack, counted against the stops that see it (R15)', () => {
    expect(meta.file).toBe(`${HEADLAND_PACK}stacks.bin`);
    const manifest = JSON.parse(readFileSync('public/world/manifest.json', 'utf8'));
    const entry = manifest.files.find((f: { path: string }) => f.path === meta.file);
    expect(entry?.stage).toBe('B');
    expect(entry?.stops).toEqual(STOP_IDS.filter((s) => STACKS_SEEN_FROM.has(s)));
  });

  it('carries moss only above the spray', () => {
    for (let i = 0; i < meta.verts; i++) if ((stacks.position[i * 3 + 2] ?? 0) < 8) expect(stacks.moss[i]).toBe(0);
  });

  it('is in play exactly at the stops and flights listed', () => {
    const track = buildTrack(STOPS);
    for (const seg of track.segments) {
      const state = frameAt(track, (seg.start + seg.end) / 2, false);
      const key = seg.kind === 'stop' ? STOP_IDS[seg.stop] : `${STOP_IDS[seg.from]}>${STOP_IDS[seg.to]}`;
      const expected =
        seg.kind === 'stop' ? STACKS_SEEN_FROM.has(STOP_IDS[seg.stop] as never) : STACKS_SEEN_ON.has(key as never);
      expect(stacksInPlay(state), key).toBe(expected);
    }
  });

  // Every pose that frames a stack or its reflection, with the line of sight clear over the baked heights, is in a
  // segment that draws the part; every segment that draws it frames it at least once.
  it('is drawn at every pose that frames it, and every place it is drawn frames it at least once', () => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < meta.verts; i += 61) {
      const [x, y, z] = at(i);
      if (z < 0.5) continue; // the shelves are awash: under the sea's surface
      pts.push([x, y, z], [x, y, -z]);
    }
    const { seen, missing } = framing(pts, stacksInPlay);
    expect(missing).toEqual([]);
    const drawn = [...STACKS_SEEN_FROM, ...STACKS_SEEN_ON].sort();
    expect(drawn.filter((k) => !seen.has(k))).toEqual([]);
  });

  // Review Focus 1: the same margin as the arch's. Exact distances to the triangles near the camera, and a camera is
  // never inside the rock (a vertical ray from it crosses the closed mesh an even number of times).
  it('stands clear of every stop camera and flight: no sample within 6 m of its rock, none inside it', () => {
    const tris = stacks.index;
    const n = tris.length / 3;
    const cen = new Float32Array(n * 3);
    const rad = new Float32Array(n);
    const P = (k: number) => at(k);
    for (let t = 0; t < n; t++) {
      const [a, b, c] = [P(tris[t * 3] ?? 0), P(tris[t * 3 + 1] ?? 0), P(tris[t * 3 + 2] ?? 0)];
      for (let j = 0; j < 3; j++) cen[t * 3 + j] = ((a[j] ?? 0) + (b[j] ?? 0) + (c[j] ?? 0)) / 3;
      const cc = [cen[t * 3] ?? 0, cen[t * 3 + 1] ?? 0, cen[t * 3 + 2] ?? 0];
      rad[t] = Math.max(
        ...[a, b, c].map((v) => Math.hypot(v[0] - (cc[0] ?? 0), v[1] - (cc[1] ?? 0), v[2] - (cc[2] ?? 0))),
      );
    }
    const lo = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    const hi = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (let i = 0; i < meta.verts; i++) {
      const [x, y] = at(i);
      lo[0] = Math.min(lo[0] ?? 0, x);
      lo[1] = Math.min(lo[1] ?? 0, y);
      hi[0] = Math.max(hi[0] ?? 0, x);
      hi[1] = Math.max(hi[1] ?? 0, y);
    }
    let nearest = Number.POSITIVE_INFINITY;
    let where = '';
    const inside: string[] = [];
    for (const { key, p } of cameraSamples(400)) {
      if (p[0] < (lo[0] ?? 0) - 20 || p[0] > (hi[0] ?? 0) + 20 || p[1] < (lo[1] ?? 0) - 20 || p[1] > (hi[1] ?? 0) + 20)
        continue;
      let crossings = 0;
      for (let t = 0; t < n; t++) {
        const d = Math.hypot(p[0] - (cen[t * 3] ?? 0), p[1] - (cen[t * 3 + 1] ?? 0), p[2] - (cen[t * 3 + 2] ?? 0));
        const [a, b, c] = [P(tris[t * 3] ?? 0), P(tris[t * 3 + 1] ?? 0), P(tris[t * 3 + 2] ?? 0)];
        if (d - (rad[t] ?? 0) < Math.min(nearest, 12)) {
          const e = pointTriangle(p, a, b, c);
          if (e < nearest) {
            nearest = e;
            where = `${key} at (${p.map((v) => v.toFixed(1)).join(', ')})`;
          }
        }
        // a vertical ray up from the camera: does it pass through this triangle (above the camera)?
        const s1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        const s2 = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0]);
        const s3 = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0]);
        if ((s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0)) {
          const area = s1 + s2 + s3;
          const z = (a[2] * s2 + b[2] * s3 + c[2] * s1) / area;
          if (z > p[2]) crossings++;
        }
      }
      if (crossings % 2 === 1) inside.push(key);
    }
    expect(inside).toEqual([]);
    expect(nearest, where).toBeGreaterThan(6);
  });
});
