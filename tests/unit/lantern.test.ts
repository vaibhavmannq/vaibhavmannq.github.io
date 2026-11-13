import { describe, expect, it } from 'vitest';
import { fovFor } from '../../src/journey/camera';
import { STOPS } from '../../src/journey/stops';
import { LANTERN_AT, lanternFlicker } from '../../src/world/lantern';

const golden = STOPS[0];
const rad = (d: number) => (d * Math.PI) / 180;
/** Where a coast-axes point falls across a frame, 0 left … 1 right, from a camera's yaw and lens. */
function screenX(p: readonly number[], cam: readonly number[], yaw: number, lens: number, aspect: number) {
  const bearing = (Math.atan2((p[0] ?? 0) - (cam[0] ?? 0), (p[1] ?? 0) - (cam[1] ?? 0)) * 180) / Math.PI;
  const rel = rad(((bearing - yaw + 540) % 360) - 180);
  const halfH = Math.atan(Math.tan(rad(fovFor(lens, aspect)) / 2) * aspect);
  return 0.5 + Math.tan(rel) / (2 * Math.tan(halfH));
}

describe("Golden's paper lantern (Amendment 1 §4 I; owner lanterns video 4)", () => {
  it('stands 2–4 m from the camera, left of centre in a 16:9 frame and inside a phone frame', () => {
    if (!golden) throw new Error('no golden stop');
    const d = Math.hypot(LANTERN_AT[0] - golden.cam[0], LANTERN_AT[1] - golden.cam[1]);
    expect(d).toBeGreaterThanOrEqual(2);
    expect(d).toBeLessThanOrEqual(4);
    const wide = screenX(LANTERN_AT, golden.cam, golden.landscape.yaw, golden.landscape.lens, 16 / 9);
    expect(wide).toBeGreaterThan(0.15);
    expect(wide).toBeLessThan(0.45);
    const phone = screenX(LANTERN_AT, golden.cam, golden.landscape.yaw, golden.landscape.lens, 412 / 915);
    expect(phone).toBeGreaterThan(0.05);
    expect(phone).toBeLessThan(0.95);
  });

  it('keeps a steady flame in calm air and shivers at ~10 Hz from force 2 (reference book §7)', () => {
    for (let t = 0; t < 1; t += 0.013) expect(lanternFlicker(t, 1)).toBe(1);
    const values = Array.from({ length: 100 }, (_, i) => lanternFlicker(i / 100, 2));
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.04);
    expect(Math.max(...values)).toBeLessThan(1.15);
  });
});
