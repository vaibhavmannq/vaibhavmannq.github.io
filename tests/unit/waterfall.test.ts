import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import { FOAM_SEGMENTS, fallsGeometry, SHEET_COLS, SHEET_ROWS, SPRAY_COUNT } from '../../src/world/waterfall';

const f = SHOTS.night.falls;
if (!f) throw new Error('shots.json has no waterfall');
const g = fallsGeometry(f);
const pos = g.getAttribute('position');
const info = g.getAttribute('info');
const sheetVerts = (SHEET_ROWS + 1) * (SHEET_COLS + 1);

describe('the waterfall (spec §9.9)', () => {
  it('starts at the lip, half a metre under the wall top, and ends on the water', () => {
    // three.js axes: y up, z = -north
    expect(pos.getY(0)).toBeCloseTo(f.zTop + 0.05, 4);
    expect(-pos.getZ(0)).toBeCloseTo(f.yLip, 4);
    const last = sheetVerts - 1;
    expect(pos.getY(last)).toBeCloseTo(0.05, 4);
    expect(-pos.getZ(last)).toBeCloseTo(f.yPool, 4);
  });

  it('is 20 m wide at the lip and 28 m at the pool, centred on the falls', () => {
    expect(pos.getX(SHEET_COLS) - pos.getX(0)).toBeCloseTo(2 * f.w0, 4);
    expect(pos.getX(sheetVerts - 1) - pos.getX(sheetVerts - 1 - SHEET_COLS)).toBeCloseTo(2 * f.w1, 4);
    expect((pos.getX(SHEET_COLS) + pos.getX(0)) / 2).toBeCloseTo(f.x, 4);
  });

  it('is one mesh of three kinds: the sheet, the foam on the pool, 28 spray sprites', () => {
    const count = [0, 0, 0];
    for (let i = 0; i < info.count; i++) count[info.getX(i)] = (count[info.getX(i)] ?? 0) + 1;
    expect(count).toEqual([sheetVerts, 1 + 2 * FOAM_SEGMENTS, SPRAY_COUNT * 4]);
    expect(SPRAY_COUNT).toBe(28);
    expect(g.index?.count).toBe((SHEET_ROWS * SHEET_COLS * 2 + FOAM_SEGMENTS * 3 + SPRAY_COUNT * 2) * 3);
  });

  it('lays the foam on the water around where the sheet lands', () => {
    const centre = sheetVerts;
    expect(pos.getY(centre)).toBeCloseTo(0.04, 4);
    expect(pos.getX(centre)).toBeCloseTo(f.x, 4);
    expect(-pos.getZ(centre)).toBeCloseTo(f.poolY, 4);
  });
});
