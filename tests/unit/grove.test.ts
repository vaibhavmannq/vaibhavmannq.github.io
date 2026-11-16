/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CliffsMeta, GroveMeta } from '../../src/assets/manifest';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, frameAt } from '../../src/journey/timeline';
import { STOP_IDS } from '../../src/journey/types';
import { coveInPlay, decodeCliffs } from '../../src/world/cliffs';
import { COVE_PACK, COVE_SEEN_FROM, COVE_SEEN_ON } from '../../src/world/cove';
import { bakeGrove, decodeGrove, drawCount, placePoint, rootZ } from '../../src/world/grove';
import { createSurfaceSampler } from '../../src/world/heights';
import { clearance, framing } from './framing';

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const gm = base.grove as GroveMeta | undefined;
const cm = base.cliffs as CliffsMeta | undefined;
if (!gm || !cm) throw new Error('base.json has no grove or cliffs: run `npm run world:blender`');
const load = (file: string) => {
  const b = readFileSync(`public/world/${file}`);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const grove = decodeGrove(load(gm.file), gm);
const cliffs = decodeCliffs(load(cm.file), cm);
const hb = readFileSync('public/world/base/heights.bin');
const surface = createSurfaceSampler(new Uint16Array(hb.buffer, hb.byteOffset, hb.byteLength / 2), base.heights);
const baked = bakeGrove(grove, surface);
const nv = baked.position.length / 3;
/** Vertex i in coast axes (baked positions are three.js axes: x, z, −y). */
const coast = (i: number): [number, number, number] => [
  baked.position[i * 3] ?? 0,
  -(baked.position[i * 3 + 2] ?? 0),
  baked.position[i * 3 + 1] ?? 0,
];

describe('the grove (M3 Task 2)', () => {
  it("decodeGrove returns the meta's counts", () => {
    expect(grove.instances.length).toBe(gm.instances * 10);
    expect(grove.protos.length).toBe(gm.protos.length);
    grove.protos.forEach((p, k) => {
      const m = gm.protos[k];
      expect(p.woodPos.length).toBe((m?.woodVerts ?? -1) * 3);
      expect(p.woodIndex.length).toBe((m?.woodTris ?? -1) * 3);
      expect(p.cardPos.length).toBe((m?.cards ?? -1) * 12);
      expect(p.cardBent.length).toBe((m?.cards ?? -1) * 12);
      for (const i of p.woodIndex) expect(i).toBeLessThan(m?.woodVerts ?? 0);
    });
  });

  it('places a model as Blender does: scale, then turn about x, y, then z, then move', () => {
    const at = (p: [number, number, number], s: [number, number, number], r: [number, number, number]) =>
      placePoint(Float32Array.from([0, 10, 20, 30, ...s, ...r]), 0, p).map((v) => Math.round(v * 1e6) / 1e6);
    const q = Math.PI / 2;
    expect(at([1, 2, 3], [1, 1, 1], [0, 0, 0])).toEqual([11, 22, 33]);
    expect(at([1, 0, 0], [2, 1, 1], [0, 0, q])).toEqual([10, 22, 30]);
    // x first, then z: (0, 0, 1) → (0, −1, 0) → (1, 0, 0)
    expect(at([0, 0, 1], [1, 1, 1], [q, 0, q])).toEqual([11, 20, 30]);
  });

  it('stands every plant on the live ground, never floating, none in the sea', () => {
    for (let i = 0; i < gm.instances; i++) {
      const [x, y] = [grove.instances[i * 10 + 1] ?? 0, grove.instances[i * 10 + 2] ?? 0];
      const g = surface(x, y);
      const r = rootZ(grove.instances[i * 10] ?? 0, g);
      if (r === null) {
        expect(g).toBeLessThan(0.8);
        continue;
      }
      expect(r).toBeLessThanOrEqual(g - 0.1);
      expect(r).toBeGreaterThan(g - 0.3);
    }
    expect(baked.kept.length).toBeGreaterThanOrEqual(gm.instances - 6); // s14: six stand where the grid is sea
  });

  it('holds every plant: wood, then cards; the cards light round from outside their crown', () => {
    let want = 0;
    for (const i of baked.kept) {
      const p = gm.protos[grove.instances[i * 10] ?? 0];
      want += (p?.woodVerts ?? 0) + 4 * (p?.cards ?? 0);
    }
    expect(nv).toBe(want);
    // per tree: the bent normals point away from the crown's middle
    let out = 0;
    let all = 0;
    for (const [lo, hi] of baked.crowns) {
      const c = [0, 0, 0];
      for (let v = lo; v < hi; v++) {
        const p = coast(v);
        for (let j = 0; j < 3; j++) c[j] = (c[j] ?? 0) + (p[j] ?? 0) / (hi - lo);
      }
      for (let v = lo; v < hi; v++) {
        const p = coast(v);
        const n = [baked.normal[v * 3] ?? 0, -(baked.normal[v * 3 + 2] ?? 0), baked.normal[v * 3 + 1] ?? 0];
        const d =
          (p[0] - (c[0] ?? 0)) * (n[0] ?? 0) + (p[1] - (c[1] ?? 0)) * (n[1] ?? 0) + (p[2] - (c[2] ?? 0)) * (n[2] ?? 0);
        all++;
        if (d > 0) out++;
      }
    }
    expect(out / all).toBeGreaterThan(0.85);
    expect(baked.woodIndexCount % 3).toBe(0);
    expect(drawCount(baked, 1)).toBe(baked.index.length);
    expect(drawCount(baked, 0)).toBe(baked.woodIndexCount);
    expect(drawCount(baked, 0.5) % 6).toBe(baked.woodIndexCount % 6);
    for (let k = 0; k < baked.woodIndexCount; k++) expect(baked.aux[(baked.index[k] ?? 0) * 4]).toBe(0);
    for (let k = baked.woodIndexCount; k < baked.index.length; k += 97)
      expect(baked.aux[(baked.index[k] ?? 0) * 4]).toBe(1);
  });
});

describe('the cove pack (M3 Task 2)', () => {
  it('lives in the cove place pack, counted against the cove stops', () => {
    const manifest = JSON.parse(readFileSync('public/world/manifest.json', 'utf8'));
    for (const file of [gm.file, cm.file]) {
      expect(file.startsWith(COVE_PACK)).toBe(true);
      const entry = manifest.files.find((f: { path: string }) => f.path === file);
      expect(entry?.stage).toBe('B');
      expect(entry?.stops).toEqual(STOP_IDS.filter((s) => COVE_SEEN_FROM.has(s)));
    }
  });

  it('is in play at the cove stops and flights, and only on the cove side of the flight that leaves for Blue hour', () => {
    const track = buildTrack(STOPS);
    for (const seg of track.segments) {
      const key = seg.kind === 'stop' ? STOP_IDS[seg.stop] : `${STOP_IDS[seg.from]}>${STOP_IDS[seg.to]}`;
      const state = frameAt(track, (seg.start + seg.end) / 2, false);
      const listed =
        seg.kind === 'stop' ? COVE_SEEN_FROM.has(STOP_IDS[seg.stop] as never) : COVE_SEEN_ON.has(key as never);
      if (!listed) expect(coveInPlay(state), key).toBe(false);
    }
    const leave = { kind: 'flight' as const, a: STOP_IDS.indexOf('dusk'), b: STOP_IDS.indexOf('bluehour') };
    expect(coveInPlay({ ...leave, t: 0.6 })).toBe(true);
    expect(coveInPlay({ ...leave, t: 0.7 })).toBe(false);
    const reach = { kind: 'flight' as const, a: STOP_IDS.indexOf('beforedawn'), b: STOP_IDS.indexOf('firstlight') };
    expect(coveInPlay({ ...reach, t: 0.05 })).toBe(true); // it leaves the cave looking down over the cove
  });

  // The pop-out on a flight's far third is allowed only where the cove is far behind: framing poses from there on
  // that see a tree or a cliff top within 400 m would show it vanish.
  it('is drawn at every pose that frames it up close; every cove stop frames it', () => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < nv; i += 97) pts.push(coast(i));
    for (let i = 0; i < cm.verts; i += 53) {
      const z = cliffs.position[i * 3 + 2] ?? 0;
      if (z > 1) pts.push([(cliffs.position[i * 3] ?? 0) + cm.x, (cliffs.position[i * 3 + 1] ?? 0) + cm.y, z]);
    }
    const { seen, missing } = framing(pts, coveInPlay, 150, 400);
    expect(missing).toEqual([]);
    expect([...COVE_SEEN_FROM].filter((k) => !seen.has(k))).toEqual([]);
  }, 60_000);

  it('stands clear of every camera: 6 m from the cliffs (never inside), 2 m from a leaf', () => {
    const rock = clearance(cliffs.position, cliffs.index, cm);
    expect(rock.inside).toEqual([]);
    expect(rock.nearest, rock.where).toBeGreaterThan(6);
    const cards = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) cards.set(coast(i), i * 3);
    const leaf = clearance(cards, Uint32Array.from(baked.index), { x: 0, y: 0 }, 150);
    expect(leaf.nearest, leaf.where).toBeGreaterThan(2);
  }, 120_000);
});
