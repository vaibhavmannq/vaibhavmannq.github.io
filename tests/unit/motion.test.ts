import { describe, expect, it } from 'vitest';
import type { Pose } from '../../src/journey/camera';
import { motionStats } from '../../src/journey/motion';
import type { RideSample } from '../../src/journey/ridePlay';

const HZ = 120;
const pose = (x: number, yaw = 0): Pose => ({ position: [x, 0, 0], yaw, pitch: 0, fov: 40 });
const line = (seconds: number, at: (t: number) => number, yaw: (t: number) => number = () => 0): RideSample[] =>
  Array.from({ length: Math.round(seconds * HZ) + 1 }, (_, i) => {
    const tS = i / HZ;
    return { tS, u: 0, pose: pose(at(tS), yaw(tS)) };
  });

describe('motion numbers of a ride', () => {
  it('constant speed has zero accel and jerk', () => {
    const s = motionStats(line(2, (t) => 10 * t));
    expect(s.speed.max).toBeCloseTo(10, 6);
    expect(s.accel.max).toBeLessThan(1e-6);
    expect(s.jerk.max).toBeLessThan(1e-6);
    expect(s.speedSteps).toHaveLength(0);
  });

  it('a velocity step is found', () => {
    const s = motionStats(line(2, (t) => (t <= 1 ? 10 * t : 10 + 20 * (t - 1))));
    expect(s.speedSteps).toHaveLength(1);
    expect(s.speedSteps[0]?.tS).toBeCloseTo(1, 1);
    expect(s.speedSteps[0]?.dv).toBeCloseTo(10, 0);
  });

  it('a gaze snap is found', () => {
    const s = motionStats(
      line(
        1,
        () => 0,
        (t) => (t < 0.5 ? 0 : 30),
      ),
    );
    expect(s.gaze.maxDegS).toBeGreaterThanOrEqual(3000);
  });

  it('a smooth ease has no speed steps', () => {
    const ease = (t: number) => t * t * t * (t * (6 * t - 15) + 10);
    const s = motionStats(line(4, (t) => 100 * ease(t / 4)));
    expect(s.speedSteps).toHaveLength(0);
    expect(s.speed.max).toBeCloseTo((100 / 4) * 1.875, 1);
  });
});
