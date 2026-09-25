import { describe, expect, it } from 'vitest';
import { sandTopAt, surfaceTopAt, WAVE_TOP } from '../../src/regions/moonsink/surfaceTop';

// These mirror sea.ts's waterH and sandH (six wave layers; sand slope, ridge and grain). If either shader function
// changes, change these too: the bound is what lets a ray skip the empty air above the sea.
function waterH(x: number, z: number, time: number): number {
  let h = 0;
  let amp = 0.16;
  let freq = 0.32;
  let speed = 0.85;
  let qx = x;
  let qz = z;
  for (let i = 0; i < 6; i++) {
    const ang = Math.sin(i * 1.73) * 0.9;
    const dx = Math.sin(ang);
    const dz = Math.cos(ang);
    const phase = (qx * dx + qz * dz) * freq + time * speed;
    const w = Math.exp(Math.sin(phase) - 1);
    h += amp * w;
    qx -= dx * w * Math.cos(phase) * amp * 0.55;
    qz -= dz * w * Math.cos(phase) * amp * 0.55;
    amp *= 0.74;
    freq *= 1.3;
    speed *= 1.06;
  }
  h += Math.sin(time * 0.55 - z * 0.35) * 0.1;
  return h - 0.16;
}

/** sandH with its grain at the worst case (noise = 1). */
function sandHMax(x: number, z: number): number {
  const t = Math.min(1, Math.max(0, -z / 6));
  const ridge = Math.sin(x * 0.23 + Math.sin(z * 0.4)) * 0.12 * t * t * (3 - 2 * t);
  return Math.min(-0.07 * z - 0.12 + ridge + 0.025, 2.2);
}

describe('surfaceTop', () => {
  it('bounds the water from above everywhere', () => {
    let highest = Number.NEGATIVE_INFINITY;
    for (let x = -40; x <= 40; x += 0.37) {
      for (let z = -20; z <= 60; z += 0.41) {
        for (const time of [0, 3.3, 12, 47.9]) highest = Math.max(highest, waterH(x, z, time));
      }
    }
    expect(highest).toBeLessThanOrEqual(WAVE_TOP);
  });

  it('bounds the sand from above at the camera and everywhere ahead of it', () => {
    for (let x = -20; x <= 20; x += 0.5) {
      for (let z = -20; z <= 40; z += 0.25) expect(sandHMax(x, z)).toBeLessThanOrEqual(sandTopAt(z) + 1e-12);
    }
    // Ahead of the camera (+z) the sand only falls away, so the camera's own z bounds the whole view.
    for (let z = -20; z < 40; z += 0.25) expect(sandTopAt(z + 0.25)).toBeLessThan(sandTopAt(z));
  });

  it('sits above both, with a margin, wherever the camera is', () => {
    for (const cameraZ of [34, 26, 9, 0, -5.5, -12, -12.5]) {
      expect(surfaceTopAt(cameraZ)).toBeGreaterThan(Math.max(WAVE_TOP, sandTopAt(cameraZ)));
    }
    expect(surfaceTopAt(34)).toBeCloseTo(WAVE_TOP + 0.05, 10);
  });
});
