import { describe, expect, it } from 'vitest';
import { HOURS } from '../../src/journey/hours';
import { SHOTS } from '../../src/journey/shots';
import { STOP_IDS, type StopId, toThree, type Vec3 } from '../../src/journey/types';
import { BED, fallsNear, fallsPan, LOOPS, mix, windLevel } from '../../src/sound/mixer';

const eyeAt = (id: StopId): Vec3 => {
  const s = SHOTS[id];
  return toThree([s.cam[0], s.cam[1], s.eyeZ]);
};
const at = (id: StopId) => mix({ a: id, b: id, w: 0, beaufort: HOURS[id].world.beaufort, eye: eyeAt(id) });
const loudest = (id: StopId) => {
  const l = at(id);
  return LOOPS.reduce((best, k) => (l[k] > l[best] ? k : best), LOOPS[0]);
};

// plan M8 Task 9; design 2026-11-20-sound-design.md; reference book §11
describe('the sound of each place', () => {
  it('gives every place a bed and keeps every level in 0..1.3', () => {
    for (const id of STOP_IDS) {
      const l = at(id);
      expect(Math.max(...LOOPS.map((k) => l[k])), id).toBeGreaterThan(0.3);
      for (const k of LOOPS) expect(l[k], `${id} ${k}`).toBeGreaterThanOrEqual(0);
      for (const k of LOOPS) expect(l[k], `${id} ${k}`).toBeLessThanOrEqual(1.3);
    }
  });

  it('is led by the right thing at each place', () => {
    expect(loudest('golden')).toBe('cove-lap');
    expect(loudest('dusk')).toBe('cove-evening');
    expect(loudest('bluehour')).toBe('open-sea');
    expect(loudest('night')).toBe('falls');
    expect(loudest('midnight')).toBe('ridge-wind');
    expect(loudest('beforedawn')).toBe('cave');
    expect(loudest('sunrise')).toBe('dawn-chorus');
  });

  it('plays the falls full at Night and not at all from the places beside it', () => {
    expect(fallsNear(eyeAt('night'))).toBeGreaterThan(0.8);
    for (const id of STOP_IDS) if (id !== 'night') expect(fallsNear(eyeAt(id)), id).toBe(0);
  });

  it('puts the falls on the side of the view they stand (Night looks at them, a little right: portraitYaw +9)', () => {
    const eye = eyeAt('night');
    const yaw = SHOTS.night.look[0];
    expect(Math.abs(fallsPan(eye, yaw))).toBeLessThan(0.5);
    expect(fallsPan(eye, yaw - 90)).toBeGreaterThan(0.5); // turned left, the falls are on the right
  });

  it('hears wind only with wind: none at force 0, full from force 3', () => {
    expect(windLevel(0)).toBe(0);
    expect(windLevel(3)).toBe(1);
    expect(windLevel(5)).toBe(1);
    expect(at('midnight')['ridge-wind']).toBeCloseTo(windLevel(HOURS.midnight.world.beaufort), 9);
  });

  it('cross-fades two places by the hour weight, the dawn chorus growing from First light to Sunrise', () => {
    const eye = eyeAt('firstlight');
    const half = mix({ a: 'firstlight', b: 'sunrise', w: 0.5, beaufort: 0, eye });
    expect(half['dawn-chorus']).toBeCloseTo(
      ((BED.firstlight['dawn-chorus'] ?? 0) + (BED.sunrise['dawn-chorus'] ?? 0)) / 2,
      9,
    );
    expect(at('firstlight')['dawn-chorus']).toBeLessThan(at('sunrise')['dawn-chorus']);
    expect(at('night')['dawn-chorus']).toBe(0);
    expect(at('midnight')['dawn-chorus']).toBe(0);
  });

  it('keeps the cove water louder at the water than up on the headland', () => {
    expect(at('golden')['cove-lap']).toBeGreaterThan(at('dusk')['cove-lap']);
  });
});
