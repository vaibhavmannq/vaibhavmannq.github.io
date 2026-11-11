import { Scene } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import type { SkyAmbient } from '../../src/assets/manifest';
import { HOURS } from '../../src/journey/hours';
import type { HourPreset } from '../../src/journey/types';
import { createLightUniforms, lightValues } from '../../src/world/light';

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

  it('lets the aurora green the ambient light (the render lit the ground with it)', () => {
    const base = lightValues({ ...HOURS.night, aurora: 0 }, ambA, ambB, 0).ambSky;
    const lit = lightValues({ ...HOURS.night, aurora: 1 }, ambA, ambB, 0).ambSky;
    expect(base).toEqual(ambA.ambientSky);
    expect(lit[1] - base[1]).toBeCloseTo(0.1, 9);
    expect(lit[1] - base[1]).toBeGreaterThan(lit[0] - base[0]);
    expect(lightValues(HOURS.midnight, ambA, ambB, 0).cloud).toBe(1);
  });

  it('installs the lights and no fog of its own (boot sets the one fog, D17)', () => {
    const scene = new Scene();
    createLightUniforms().install(scene);
    expect(scene.fogNode ?? null).toBeNull();
    expect(scene.children.length).toBeGreaterThan(0);
  });

  it('never tints the sky: the renders used the hybrid style, which ignores sky_tint', () => {
    expect(lightValues(HOURS.bluehour, ambA, ambB, 0).skyTint).toEqual([1, 1, 1]);
  });
});
