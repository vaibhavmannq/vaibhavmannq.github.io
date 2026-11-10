import { describe, expect, it } from 'vitest';
import type { SkyAmbient } from '../../src/assets/manifest';
import { HOURS } from '../../src/journey/hours';
import type { HourPreset } from '../../src/journey/types';
import { lightValues } from '../../src/world/light';

const ambA: SkyAmbient = { ambientSky: [0.5, 0.4, 0.3], ambientGround: [0.1, 0.1, 0.1] };
const ambB: SkyAmbient = { ambientSky: [0.1, 0.2, 0.3], ambientGround: [0.0, 0.0, 0.2] };
const north: HourPreset = { ...HOURS.golden, key: { ...HOURS.golden.key, dir: [0, 1, 0] } };

describe('light values from an hour (spec §9.1)', () => {
  it('turns the coast light direction into three.js axes', () => {
    const v = lightValues(north, ambA, ambB, 0);
    expect(v.keyDir[0]).toBeCloseTo(0, 9);
    expect(v.keyDir[1]).toBeCloseTo(0, 9);
    expect(v.keyDir[2]).toBeCloseTo(-1, 9);
  });

  it('takes the ambient light from the sky that is showing', () => {
    expect(lightValues(north, ambA, ambB, 0).ambSky).toEqual(ambA.ambientSky);
    expect(lightValues(north, ambA, ambB, 1).ambSky).toEqual(ambB.ambientSky);
    expect(lightValues(north, ambA, ambB, 1).ambGround).toEqual(ambB.ambientGround);
  });

  it('has no moon when the hour has none, and a moon at night', () => {
    expect(lightValues(HOURS.golden, ambA, ambB, 0).moonStrength).toBe(0);
    expect(lightValues(HOURS.night, ambA, ambB, 0).moonStrength).toBeGreaterThan(0);
  });

  it('never tints the sky: the renders used the hybrid style, which ignores sky_tint', () => {
    expect(lightValues(HOURS.bluehour, ambA, ambB, 0).skyTint).toEqual([1, 1, 1]);
  });
});
