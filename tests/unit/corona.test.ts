import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import { auroraGeometry } from '../../src/world/aurora';
import { APEX, CORONA_SAMPLES, coronaCurves, coronaShot, skyAngle } from '../../src/world/corona';

const curves = coronaCurves();

describe("Night's corona (plan M5 Task 3; book §5; owner aurora 3, 9)", () => {
  it('is one line per curtain, the size the aurora part takes', () => {
    expect(curves.length).toBe(3);
    for (const c of curves) expect(c.length).toBe(CORONA_SAMPLES * 3);
  });

  it('runs every ray toward one point: the rays converge (a corona), they never run parallel', () => {
    const aurora = SHOTS.night.aurora;
    if (!aurora) throw new Error('Night has no aurora');
    const g = auroraGeometry(curves, coronaShot(aurora), 0);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    // three.js (x, y, z) -> coast (x, -z, y): azimuth and elevation of each vertex
    const sky = (i: number): [number, number] => {
      const x = pos.getX(i);
      const y = -pos.getZ(i);
      const z = pos.getY(i);
      return [(Math.atan2(x, y) * 180) / Math.PI, (Math.asin(z) * 180) / Math.PI];
    };
    for (let i = 0; i < pos.count; i++) {
      if (uv.getY(i) !== 0) continue;
      const top = i + 10; // ROWS rows up the same ray
      expect(skyAngle(sky(top), APEX)).toBeLessThan(skyAngle(sky(i), APEX));
    }
  });

  it('lays one band low over the open west side, under 13° (Amendment 1 §5)', () => {
    const low = curves[2] as number[];
    for (let i = 0; i < low.length; i += 3) {
      expect(low[i + 1]).toBeLessThan(13.6);
      expect(low[i]).toBeLessThan(0); // west of north, over the low rim
    }
  });
});
