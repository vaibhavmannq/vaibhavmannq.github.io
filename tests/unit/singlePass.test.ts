import { readFileSync } from 'node:fs';
import { DataTexture, type Mesh, type Object3D } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import { type AuroraData, createAurora } from '../../src/world/aurora';
import { createCloudSea } from '../../src/world/cloudSea';
import { createLightUniforms } from '../../src/world/light';

// s12 trace: three.js draws a transparent two-sided material in two passes (back faces, then front), but compileAsync
// builds only the one-pass pipeline. The aurora and the cloud deck, first seen mid-flight, then built their real
// pipelines synchronously: 0.73 s and 0.82 s frames on the laptop. Drawn in one pass, stage B's compile is the one used.
const materials = (o: Object3D) => {
  const out: { transparent: boolean; side: number; forceSinglePass: boolean }[] = [];
  o.traverse((c) => {
    const m = (c as Mesh).material;
    if (m && !Array.isArray(m)) out.push(m);
  });
  return out;
};

describe('parts that first show mid-flight draw in one pass (s12)', () => {
  it('the aurora', () => {
    const data = JSON.parse(readFileSync('public/world/base/aurora.json', 'utf8')) as AuroraData;
    const { night, midnight } = SHOTS;
    if (!night.aurora || !midnight.aurora) throw new Error('no aurora in shots.json');
    const ms = materials(createAurora(data, night.aurora, midnight.aurora, false).object);
    expect(ms.length).toBeGreaterThan(0);
    for (const m of ms) expect(m.forceSinglePass).toBe(true);
  });

  it('the cloud deck', () => {
    const cfg = SHOTS.midnight.cloudsea;
    if (!cfg) throw new Error('no cloud sea in shots.json');
    const heights = new DataTexture(new Uint8Array(4), 1, 1);
    const meta = { cols: 1, rows: 1, x0: 0, y0: 0, cell: 8, zMin: 0, zMax: 1 } as never;
    const ms = materials(createCloudSea(cfg, heights, meta, createLightUniforms()).object);
    expect(ms.length).toBeGreaterThan(0);
    for (const m of ms) expect(m.forceSinglePass).toBe(true);
  });
});
