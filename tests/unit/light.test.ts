import { Scene } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import type { SkyAmbient } from '../../src/assets/manifest';
import { HOURS } from '../../src/journey/hours';
import type { HourPreset } from '../../src/journey/types';
import {
  auroraDim,
  createLightUniforms,
  FOG_SCALE,
  glitterPower,
  lightValues,
  MOON_SIZE_DEG,
  moonCover,
  NIGHT_HAZE,
  shadowFloor,
} from '../../src/world/light';

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

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (c: readonly number[]) => 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0);
// owner-references §17: "shadows no darker than about #10123a"
const FLOOR_MIN = luminance([0x10, 0x12, 0x3a].map((v) => toLinear(v / 255)));

describe('shadows keep colour (plan M2.5 Task 4; owner-references §14.4, §17)', () => {
  it('no hour’s shadow floor is darker than #10123a in linear light', () => {
    for (const h of Object.values(HOURS)) expect(luminance(shadowFloor(h)), h.id).toBeGreaterThanOrEqual(FLOOR_MIN);
  });

  it('the floor is tinted, not grey', () => {
    for (const h of Object.values(HOURS)) {
      const f = shadowFloor(h);
      expect(Math.max(...f) - Math.min(...f), h.id).toBeGreaterThan(0.002);
    }
    const dusk = shadowFloor(HOURS.dusk);
    expect(dusk[2]).toBeGreaterThan(dusk[1]); // violet
    const night = shadowFloor(HOURS.night);
    expect(night[2]).toBeGreaterThan(night[0]); // teal-blue
  });

  it('reaches the materials through the light values', () => {
    expect(lightValues(HOURS.night, ambA, ambB, 0).shadowFloor).toEqual(shadowFloor(HOURS.night));
  });
});

describe('far layers pale at night (design review §3.3)', () => {
  it('thickens the haze 1.6× at night and leaves daylight alone', () => {
    const n = HOURS.night;
    expect(lightValues(n, ambA, ambB, 0).fogDensity).toBeCloseTo(n.fogAmount * FOG_SCALE * NIGHT_HAZE, 12);
    const g = HOURS.golden;
    expect(lightValues(g, ambA, ambB, 0).fogDensity).toBeCloseTo(g.fogAmount * FOG_SCALE, 12);
    expect(NIGHT_HAZE).toBe(1.6);
  });
});

describe('the moon and the aurora (reference book §1: a bright moon washes an aurora out)', () => {
  it('leaves the aurora at full strength under a crescent moon and halves it under a full one', () => {
    expect(auroraDim(0.12)).toBe(1);
    expect(auroraDim(0.2)).toBe(1);
    expect(auroraDim(0.5)).toBeCloseTo(0.5, 9);
    expect(auroraDim(0.85)).toBeCloseTo(auroraDim(0.15), 9);
    expect(auroraDim(0.35)).toBeCloseTo(0.75, 9);
  });
});

describe('a real moon (plan M2.5 Task 5; owner night-sky-and-moon 3, 4, 5, 8)', () => {
  it('draws a styled 1.6° disc at Midnight and Night', () => {
    for (const h of [HOURS.midnight, HOURS.night]) {
      const v = lightValues(h, ambA, ambB, 0);
      expect(v.moonStrength, h.id).toBeGreaterThan(0);
      expect(v.moonSize, h.id).toBeGreaterThanOrEqual(MOON_SIZE_DEG);
    }
    expect(MOON_SIZE_DEG).toBe(1.6);
  });

  it('tests the disc on squared angles, so a 0.8° radius survives float32 (WGSL cos is only good to 5e-4)', () => {
    const r = (0.8 * Math.PI) / 180;
    const at = (deg: number) => moonCover(Math.fround(Math.cos((deg * Math.PI) / 180)), r);
    expect(at(0)).toBe(1);
    expect(at(0.7)).toBe(1);
    expect(at(0.9)).toBe(0);
  });

  it('lights a crescent where the aurora is strong: its dark disc sits above, the lit limb faces the sun below', () => {
    const v = lightValues(HOURS.midnight, ambA, ambB, 0);
    const lit = (1 - Math.cos(2 * Math.PI * HOURS.midnight.world.moonPhase)) / 2;
    expect(v.moonShadowDir[1]).toBeGreaterThan(v.moonDir[1]); // shifted up in the sky
    const sep = Math.acos(
      v.moonShadowDir[0] * v.moonDir[0] + v.moonShadowDir[1] * v.moonDir[1] + v.moonShadowDir[2] * v.moonDir[2],
    );
    expect(sep).toBeCloseTo(2 * (((MOON_SIZE_DEG / 2) * Math.PI) / 180) * lit, 4);
  });
});

describe('sun and moon roads as glitter (plan M2.5 Task 5; reference book §3)', () => {
  it('narrows the road on calmer water', () => {
    expect(glitterPower(0.3)).toBeGreaterThan(glitterPower(0.55));
    expect(glitterPower(0.55)).toBeCloseTo(220, 6);
    expect(glitterPower(0.8)).toBeLessThan(220);
  });
});
