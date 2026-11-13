/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StacksMeta } from '../../src/assets/manifest';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, frameAt } from '../../src/journey/timeline';
import { STOP_IDS } from '../../src/journey/types';
import { HEADLAND_PACK } from '../../src/world/headland';
import { decodeStacks, STACKS_SEEN_FROM, STACKS_SEEN_ON, stacksInPlay } from '../../src/world/stacks';
import { clearance, framing } from './framing';

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
    const { nearest, where, inside } = clearance(stacks.position, stacks.index, meta);
    expect(inside).toEqual([]);
    expect(nearest, where).toBeGreaterThan(6);
  });
});
