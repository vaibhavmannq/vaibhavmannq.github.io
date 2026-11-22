import { describe, expect, it } from 'vitest';
import type { Pose } from '../../src/journey/camera';
import { AA_MODES, aaFor, aaModesFor, cutBetween } from '../../src/render/aa';

const pose = (x: number, yaw: number): Pose => ({ position: [x, 10, 0], yaw, pitch: 0, fov: 40 });

describe('anti-aliasing mode (plan world-to-100 Task 8)', () => {
  it('the param wins', () => {
    for (const m of AA_MODES) expect(aaFor(0, 'webgpu', m)).toBe(m);
  });
  it('a visit builds every mode its tiers can switch to', () => {
    for (const b of ['webgpu', 'webgl2'] as const)
      for (const t of [0, 1, 2, 3] as const) expect(aaModesFor(b, null)).toContain(aaFor(t, b, null));
    expect(aaModesFor('webgpu', 'smaa')).toEqual(['smaa']);
  });
  it('low on this laptop never pays for temporal smoothing (R219: +4–5 ms)', () => {
    expect(aaFor(0, 'webgpu', null)).not.toBe('taau');
  });
  it('ultra keeps its size: temporal smoothing cost the phone 2–4 ms there (R219)', () => {
    expect(aaFor(3, 'webgpu', null)).not.toBe('taau');
    expect(aaFor(2, 'webgpu', null)).toBe('taau');
  });
  it('every tier and backend gets a known mode', () => {
    for (const t of [0, 1, 2, 3] as const)
      for (const b of ['webgpu', 'webgl2'] as const) expect(AA_MODES).toContain(aaFor(t, b, null));
  });
});

describe('when the temporal history is thrown away (Review Focus 1, 2)', () => {
  it('a jump resets the history', () => {
    // a rail click: one frame at Golden, the next at Night, hundreds of metres away
    expect(cutBetween(pose(0, 10), pose(400, 10), false)).toBe(true);
  });
  it('a snap of the gaze resets it', () => {
    expect(cutBetween(pose(0, 10), pose(0.2, 60), false)).toBe(true);
  });
  it('a tier change resets the history', () => {
    expect(cutBetween(pose(0, 10), pose(0, 10), true)).toBe(true);
  });
  it('a ride does not reset it', () => {
    // the fastest ride: ~60 m/s and the gaze's worst whip (~700 °/s) at 60 fps
    expect(cutBetween(pose(0, 10), pose(1, 21.7), false)).toBe(false);
  });
});
