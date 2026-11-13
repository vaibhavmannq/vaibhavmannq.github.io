/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ArchMeta } from '../../src/assets/manifest';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, frameAt } from '../../src/journey/timeline';
import { STOP_IDS } from '../../src/journey/types';
import { ARCH_SEEN_FROM, ARCH_SEEN_ON, archInPlay, decodeArch } from '../../src/world/arch';
import { HEADLAND_PACK } from '../../src/world/headland';
import { clearance, framing } from './framing';

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const meta = base.arch as ArchMeta | undefined;
if (!meta) throw new Error('base.json has no arch: run `npm run world:blender`');
const buf = readFileSync(`public/world/${meta.file}`);
const arch = decodeArch(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), meta);

describe('the arch (M2.5 Task 3b)', () => {
  it("decodeArch returns the meta's counts, in metres around the arch", () => {
    expect(arch.position.length).toBe(meta.verts * 3);
    expect(arch.index.length).toBe(meta.tris * 3);
    expect(arch.light.length).toBe(meta.verts);
    expect(arch.moss.length).toBe(meta.verts);
    expect(arch.column.length).toBe(meta.verts * 2);
    let top = -1e9;
    for (let i = 0; i < meta.verts; i++) {
      const x = arch.position[i * 3] ?? 0;
      const y = arch.position[i * 3 + 1] ?? 0;
      const z = arch.position[i * 3 + 2] ?? 0;
      expect(Math.hypot(x, y)).toBeLessThan(90);
      expect(z).toBeGreaterThan(-8);
      top = Math.max(top, z);
    }
    expect(top).toBeGreaterThan(55);
    expect(top).toBeLessThan(72);
    let max = 0;
    for (const k of arch.index) max = Math.max(max, k);
    expect(max).toBeLessThan(meta.verts);
    for (const l of arch.light) {
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
    }
  });

  it('lives in the headland place pack, counted against the stops that see it, not the world base (R15)', () => {
    expect(meta.file.startsWith(HEADLAND_PACK)).toBe(true);
    const manifest = JSON.parse(readFileSync('public/world/manifest.json', 'utf8'));
    const entry = manifest.files.find((f: { path: string }) => f.path === meta.file);
    expect(entry?.stage).toBe('B');
    expect(entry?.stops).toEqual(STOP_IDS.filter((s) => ARCH_SEEN_FROM.has(s)));
  });

  it('carries moss only above the spray', () => {
    for (let i = 0; i < meta.verts; i++) if ((arch.position[i * 3 + 2] ?? 0) < 8) expect(arch.moss[i]).toBe(0);
  });

  it('is in play at the stops whose approved renders show it, hidden at the others', () => {
    expect([...ARCH_SEEN_FROM].sort()).toEqual(['bluehour', 'dusk', 'golden', 'sunrise', 'sunset']);
    const track = buildTrack(STOPS);
    for (const seg of track.segments) {
      const state = frameAt(track, (seg.start + seg.end) / 2, false);
      const key = seg.kind === 'stop' ? STOP_IDS[seg.stop] : `${STOP_IDS[seg.from]}>${STOP_IDS[seg.to]}`;
      const expected =
        seg.kind === 'stop' ? ARCH_SEEN_FROM.has(STOP_IDS[seg.stop] as never) : ARCH_SEEN_ON.has(key as never);
      expect(archInPlay(state), key).toBe(expected);
    }
  });

  // Every pose on the journey (each stop and 300 samples per flight, wide and phone frames) that would frame the arch
  // or its reflection, with the line of sight clear over the baked heights, must be in a segment that draws it.
  // Inside the cave (Before dawn) the shell hides everything but the mouth, which faces away from the arch.
  it('is drawn at every pose that frames it, and every place it is drawn frames it at least once', () => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < meta.verts; i += 97) {
      const x = (arch.position[i * 3] ?? 0) + meta.x;
      const y = (arch.position[i * 3 + 1] ?? 0) + meta.y;
      const z = arch.position[i * 3 + 2] ?? 0;
      if (z < 0) continue;
      pts.push([x, y, z], [x, y, -z]); // the arch and its reflection in the sea
    }
    const { seen, missing } = framing(pts, archInPlay);
    expect(missing).toEqual([]);
    const drawn = [...ARCH_SEEN_FROM, ...ARCH_SEEN_ON].sort();
    expect(drawn.filter((k) => !seen.has(k))).toEqual([]);
  });

  it('stands clear of every stop camera and flight: no sample within 6 m of its rock, none inside it', () => {
    const { nearest, where, inside } = clearance(arch.position, arch.index, meta);
    expect(inside).toEqual([]);
    expect(nearest, where).toBeGreaterThan(6);
  });
});
