/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ArchMeta } from '../../src/assets/manifest';
import { poseAt } from '../../src/journey/camera';
import type { FlightPath } from '../../src/journey/flights';
import { SHOTS } from '../../src/journey/shots';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, frameAt } from '../../src/journey/timeline';
import { STOP_IDS } from '../../src/journey/types';
import { ARCH_SEEN_FROM, ARCH_SEEN_ON, archInPlay, decodeArch } from '../../src/world/arch';
import { createHeightSampler } from '../../src/world/heights';

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const meta = base.arch as ArchMeta | undefined;
if (!meta) throw new Error('base.json has no arch: run `npm run world:blender`');
const buf = readFileSync('public/world/base/arch.bin');
const arch = decodeArch(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), meta);

describe('the arch (M2.5 Task 3b)', () => {
  it("decodeArch returns the meta's counts, in metres around the arch", () => {
    expect(arch.position.length).toBe(meta.verts * 3);
    expect(arch.index.length).toBe(meta.tris * 3);
    expect(arch.light.length).toBe(meta.verts);
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
    const bytes = readFileSync('public/world/base/heights.bin');
    const heightAt = createHeightSampler(
      new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2),
      base.heights,
    );
    const paths = JSON.parse(readFileSync('src/journey/flightPaths.json', 'utf8')) as FlightPath[];
    const cave = SHOTS.beforedawn.cave;
    const pts: [number, number, number][] = [];
    for (let i = 0; i < meta.verts; i += 97) {
      const x = (arch.position[i * 3] ?? 0) + meta.x;
      const y = (arch.position[i * 3 + 1] ?? 0) + meta.y;
      const z = arch.position[i * 3 + 2] ?? 0;
      if (z < 0) continue;
      pts.push([x, y, z], [x, y, -z]); // the arch and its reflection in the sea
    }
    const rad = (d: number) => (d * Math.PI) / 180;
    const track = buildTrack(STOPS);
    const seen = new Set<string>();
    const missing = new Set<string>();
    for (const seg of track.segments) {
      const key = seg.kind === 'stop' ? STOP_IDS[seg.stop] : `${STOP_IDS[seg.from]}>${STOP_IDS[seg.to]}`;
      const n = seg.kind === 'stop' ? 1 : 300;
      for (let k = 0; k < n; k++) {
        const u = seg.kind === 'stop' ? (seg.start + seg.end) / 2 : seg.start + ((seg.end - seg.start) * (k + 0.5)) / n;
        const state = frameAt(track, u, false);
        for (const aspect of [16 / 9, 412 / 915]) {
          const pose = poseAt(state, paths, aspect, 0);
          const [cx, cy, cz] = [pose.position[0], -pose.position[2], pose.position[1]];
          if (cave && Math.hypot(cx - cave.x, cy - cave.y) < 11 && cz < cave.centreZ + cave.radii[2]) continue;
          const tv = Math.tan(rad(pose.fov) / 2);
          const th = tv * aspect;
          const [sy, cyw, sp, cp] = [
            Math.sin(rad(pose.yaw)),
            Math.cos(rad(pose.yaw)),
            Math.sin(rad(pose.pitch)),
            Math.cos(rad(pose.pitch)),
          ];
          const fwd = [sy * cp, cyw * cp, sp];
          const right = [cyw, -sy, 0];
          const up = [-sy * sp, -cyw * sp, cp];
          const frames = pts.some(([x, y, z]) => {
            const d = [x - cx, y - cy, z - cz];
            const f = d[0] * (fwd[0] ?? 0) + d[1] * (fwd[1] ?? 0) + d[2] * (fwd[2] ?? 0);
            if (f <= 1) return false;
            const h = (d[0] * (right[0] ?? 0) + d[1] * (right[1] ?? 0)) / f;
            const v = (d[0] * (up[0] ?? 0) + d[1] * (up[1] ?? 0) + d[2] * (up[2] ?? 0)) / f;
            if (Math.abs(h) > th || Math.abs(v) > tv) return false;
            const dist = Math.hypot(d[0], d[1]);
            for (let t = 4; t < dist - 80; t += 8) {
              const w = t / dist;
              if (cz + d[2] * w < heightAt(cx + d[0] * w, cy + d[1] * w) - 0.3) return false;
            }
            return true;
          });
          if (!frames) continue;
          seen.add(key as string);
          if (!archInPlay(state)) missing.add(`${key} at u=${u.toFixed(2)}`);
        }
      }
    }
    expect([...missing]).toEqual([]);
    const drawn = [...ARCH_SEEN_FROM, ...ARCH_SEEN_ON].sort();
    expect(drawn.filter((k) => !seen.has(k))).toEqual([]);
  });

  it('stands clear of every flight: no camera sample within 6 m of its rock', () => {
    const paths = JSON.parse(readFileSync('src/journey/flightPaths.json', 'utf8')) as FlightPath[];
    const track = buildTrack(STOPS);
    let nearest = Number.POSITIVE_INFINITY;
    for (const seg of track.segments) {
      const n = seg.kind === 'stop' ? 1 : 400;
      for (let k = 0; k < n; k++) {
        const u = seg.start + ((seg.end - seg.start) * (k + 0.5)) / n;
        const p = poseAt(frameAt(track, u, false), paths, 16 / 9, 0).position;
        const [cx, cy, cz] = [p[0] - meta.x, -p[2] - meta.y, p[1]];
        if (Math.hypot(cx, cy) > 150) continue;
        for (let i = 0; i < meta.verts; i += 7) {
          const d = Math.hypot(
            (arch.position[i * 3] ?? 0) - cx,
            (arch.position[i * 3 + 1] ?? 0) - cy,
            (arch.position[i * 3 + 2] ?? 0) - cz,
          );
          nearest = Math.min(nearest, d);
        }
      }
    }
    expect(nearest).toBeGreaterThan(6);
  });
});
