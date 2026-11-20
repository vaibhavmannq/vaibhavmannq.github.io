import { describe, expect, it } from 'vitest';
import { fovFor, yawFor } from '../../src/journey/camera';
import { STOPS } from '../../src/journey/stops';

// plan M8 Task 4: on a portrait phone the view is ~36° wide, so a subject 15-25° off the gaze left the frame
// (Midnight's tree, s19). Each stop turns toward its subject as the screen goes portrait.
describe('yawFor', () => {
  const stop = (id: string) => {
    const s = STOPS.find((x) => x.id === id);
    if (!s) throw new Error(id);
    return s;
  };
  it('keeps the landscape yaw on a landscape or square screen', () => {
    for (const s of STOPS) {
      expect(yawFor(s, 16 / 9)).toBe(s.landscape.yaw);
      expect(yawFor(s, 1)).toBe(s.landscape.yaw);
    }
  });
  it('turns fully by a phone in portrait, and keeps the subject inside the frame', () => {
    const half = (aspect: number, lens: number) => {
      const v = (fovFor(lens, aspect) * Math.PI) / 180;
      return (Math.atan(Math.tan(v / 2) * aspect) * 180) / Math.PI;
    };
    // subjects' offsets from the landscape gaze (shots.json, s21): Sunset's lone tree, Midnight's, Night's falls
    for (const [id, off] of [
      ['sunset', 23],
      ['midnight', -24.9],
      ['night', 16.9],
    ] as const) {
      const s = stop(id);
      const turned = yawFor(s, 0.46) - s.landscape.yaw;
      expect(Math.abs(off - turned), id).toBeLessThan(half(0.46, s.landscape.lens) * 0.6);
    }
  });
});
