/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import { decodeCave, FUNGI_REACH, fungiLight, mouthMask } from '../../src/world/cave';

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const meta = base.cave;
const shot = SHOTS.beforedawn.cave;
if (!shot || !meta) throw new Error('no cave in the shots or base.json');
const buf = readFileSync('public/world/base/cave.bin');
const cave = decodeCave(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), meta);

describe('the cave (spec §9.11, M2 Task 6)', () => {
  it("decodes the meta's counts, in metres", () => {
    expect(cave.shell.position.length).toBe(meta.shellVerts * 3);
    expect(cave.shell.index.length).toBe(meta.shellTris * 3);
    expect(cave.floor.position.length).toBe(meta.floorVerts * 3);
    expect(cave.floor.index.length).toBe(meta.floorTris * 3);
    expect(cave.fungi.length).toBe(meta.fungi * 4);
    // cave-local coast axes, origin on the floor under the centre; the shell is a 12 x 10 x 7.5 m bubble
    const centreZ = shot.centreZ - shot.floor;
    for (let i = 0; i < meta.shellVerts; i++) {
      const x = cave.shell.position[i * 3] ?? 0;
      const y = cave.shell.position[i * 3 + 1] ?? 0;
      const z = (cave.shell.position[i * 3 + 2] ?? 0) - centreZ;
      expect(Math.hypot(x, y, z)).toBeLessThan(13.5);
    }
  });

  it('faces its mouth to the cove', () => {
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < meta.shellVerts; i++) {
      if ((cave.shell.open[i] ?? 0) <= 0) continue;
      sx += cave.shell.position[i * 3] ?? 0;
      sy += cave.shell.position[i * 3 + 1] ?? 0;
    }
    const az = (Math.atan2(sx, sy) * 180) / Math.PI;
    expect(Math.abs(az - shot.az)).toBeLessThan(12);
  });

  it('carries the baked light from the mouth: some rock fully dark, some well lit', () => {
    const light = [...cave.shell.light];
    expect(Math.min(...light)).toBe(0);
    expect(Math.max(...light)).toBeGreaterThan(0.8);
  });

  it('lets a fungus light only the rock right beside it (reference book §6: never lamps)', () => {
    const rock = new Float32Array([0.1, 0, 0, 3, 0, 0]);
    const lit = fungiLight(rock, new Float32Array([0, 0, 0, 0.02]));
    expect(lit[0]).toBeGreaterThan(0.5);
    expect(lit[1]).toBeLessThan(0.02);
    expect(FUNGI_REACH).toBeLessThan(0.5);
  });

  it("shows the mouth in the floor's puddles: a mirrored ray out of the mouth is inside, one to the back wall is not", () => {
    expect(mouthMask(shot.az, 8, shot)).toBe(1);
    expect(mouthMask(shot.az + 180, 8, shot)).toBe(0);
    expect(mouthMask(shot.az, 60, shot)).toBe(0);
  });
});
