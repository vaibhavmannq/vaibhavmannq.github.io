import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import { BOWL, wallRadius } from '../../src/world/bowl';
import { MAX_LANTERNS, projectLanternField, wander } from '../../src/world/projectLanterns';

describe("Night's project lanterns (plan M5 Task 5; book §7)", () => {
  const field = projectLanternField(MAX_LANTERNS);
  const [cx, cy] = SHOTS.night.cam;
  const yaw = SHOTS.night.look[0];

  it('float on the lagoon in front of the stop, 9-21 m out, inside the bowl', () => {
    for (const l of field) {
      const d = Math.hypot(l.x - cx, l.y - cy);
      expect(d).toBeGreaterThan(8.5);
      expect(d).toBeLessThan(21);
      const az = (Math.atan2(l.x - BOWL.x, l.y - BOWL.y) * 180) / Math.PI;
      expect(Math.hypot(l.x - BOWL.x, l.y - BOWL.y)).toBeLessThan(wallRadius(az) - 5);
    }
  });

  it('keep the falls clear and stay out of the drums on the left', () => {
    for (const l of field.slice(0, 4)) {
      const b = (((Math.atan2(l.x - cx, l.y - cy) * 180) / Math.PI - yaw + 540) % 360) - 180;
      expect(b < 10 || b > 24).toBe(true);
      expect(b).toBeGreaterThan(-25);
    }
  });

  it('drift slowly, never keeping station: under a lantern width a minute, within half a metre', () => {
    let far = 0;
    for (let t = 0; t < 600; t += 1) {
      const [x, y] = wander(t, 1.3);
      far = Math.max(far, Math.hypot(x, y));
      const [x2, y2] = wander(t + 1, 1.3);
      expect(Math.hypot(x2 - x, y2 - y)).toBeLessThan(0.03); // m/s (book §7: at most 0.03 m/s)
    }
    expect(far).toBeGreaterThan(0.2);
    expect(far).toBeLessThan(0.6);
  });
});
