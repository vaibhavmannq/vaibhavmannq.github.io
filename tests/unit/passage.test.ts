/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import { caveLight, decodeCave } from '../../src/world/cave';
import { createSurfaceSampler } from '../../src/world/heights';
import {
  buildPassage,
  junctionVisible,
  openShell,
  PASSAGE_END,
  passageColumns,
  passageFrame,
  passageSite,
  shellSampler,
  WALK_DEPTH,
} from '../../src/world/passage';

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const shot = SHOTS.beforedawn.cave;
if (!shot) throw new Error('no cave');
const buf = readFileSync('public/world/base/cave.bin');
const cave = decodeCave(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), base.cave);
const hb = readFileSync('public/world/base/heights.bin');
const surface = createSurfaceSampler(new Uint16Array(hb.buffer, hb.byteOffset, hb.byteLength / 2), base.heights);
const site = passageSite(shot, SHOTS.beforedawn);
const wall = shellSampler(cave.shell.position, site);
const passage = buildPassage(site, wall, surface, shot.floor, shot);
const frame = passageFrame(site);

describe('the passage behind the chamber (plan M7 Task 1)', () => {
  it('runs from the chamber back to beyond the walk’s start, along the stop’s view reversed', () => {
    let far = 0;
    for (let i = 0; i < passage.position.length; i += 3)
      far = Math.max(far, frame.along(passage.position[i] ?? 0, passage.position[i + 1] ?? 0));
    expect(far).toBeGreaterThan(WALK_DEPTH + 2);
    expect(far).toBeLessThanOrEqual(PASSAGE_END + 0.5);
  });

  it('keeps its roof 0.5 m under the live hill wherever the terrain is not cut open', () => {
    for (let i = 0; i < passage.position.length; i += 3) {
      const x = passage.position[i] ?? 0;
      const y = passage.position[i + 1] ?? 0;
      if ((x / site.cut.rx) ** 2 + (y / site.cut.ry) ** 2 < 1) continue;
      const z = (passage.position[i + 2] ?? 0) + shot.floor;
      expect(z).toBeLessThan(surface(x + shot.x, y + shot.y) - 0.5);
    }
  });

  it('leaves 3 m of headroom over the walk’s line, and starts behind the chamber’s wall', () => {
    for (let i = 0; i < passage.position.length; i += 3) {
      const x = passage.position[i] ?? 0;
      const y = passage.position[i + 1] ?? 0;
      const z = passage.position[i + 2] ?? 0;
      const s = frame.along(x, y);
      const l = frame.lateral(x, y);
      // nothing of the passage stands in front of the shell's inner surface
      expect(s).toBeGreaterThanOrEqual(wall(l, z) + 0.1);
      if (Math.abs(l) < 0.5 && z > 0.5 && s > 1) expect(z).toBeGreaterThan(2.8);
    }
  });

  it('opens the shell only behind the camera, inside the junction', () => {
    const open = openShell(cave.shell.position, cave.shell.open, site);
    let opened = 0;
    for (let i = 0; i < open.length; i++) {
      if ((open[i] ?? 0) <= 0 || (cave.shell.open[i] ?? 0) > 0) continue;
      opened++;
      const x = cave.shell.position[i * 3] ?? 0;
      const y = cave.shell.position[i * 3 + 1] ?? 0;
      expect(frame.along(x, y)).toBeGreaterThan(0.5);
      expect(Math.abs(frame.lateral(x, y))).toBeLessThan(2.6);
    }
    expect(opened).toBeGreaterThan(20);
  });

  it('stands columns 0.6–0.95 m wide (Fingal’s, Svartifoss)', () => {
    for (const c of passageColumns(0, 18)) {
      expect(c.s1 - c.s0).toBeGreaterThanOrEqual(0.6);
      expect(c.s1 - c.s0).toBeLessThanOrEqual(0.95);
    }
  });
});

describe('the mouth’s light (plan M7 Task 3)', () => {
  const ff = caveLight(cave, {
    passage,
    mouthOpen: cave.shell.open,
    throughJunction: junctionVisible(site),
  });
  const mean = (a: Float32Array, keep: (i: number) => boolean) => {
    let s = 0;
    let n = 0;
    for (let i = 0; i < a.length; i++)
      if (keep(i)) {
        s += a[i] ?? 0;
        n++;
      }
    return s / Math.max(1, n);
  };
  const along = (p: Float32Array, i: number) => frame.along(p[i * 3] ?? 0, p[i * 3 + 1] ?? 0);
  it('lights the walls by the mouth much more than the back, and the passage fades with depth', () => {
    const nearMouth = mean(ff.shell, (i) => along(cave.shell.position, i) < -10 && (cave.shell.open[i] ?? 0) < -0.3);
    const back = mean(ff.shell, (i) => along(cave.shell.position, i) > 1.5);
    const p1 = mean(ff.passage, (i) => along(passage.position, i) > 3 && along(passage.position, i) < 7);
    const p2 = mean(ff.passage, (i) => along(passage.position, i) > 12);
    console.log({ nearMouth, back, p1, p2 });
    expect(nearMouth).toBeGreaterThan(back);
    expect(p1).toBeGreaterThan(p2);
    expect(p2).toBeGreaterThan(0);
  });
});
