import { describe, expect, it } from 'vitest';
import { blendHours, HOURS } from '../../src/journey/hours';
import { STOP_IDS } from '../../src/journey/types';

const length = (v: readonly number[]) => Math.hypot(...v);

describe('hour presets from coast.py (spec §9.1)', () => {
  it('give every hour a unit key-light direction', () => {
    for (const id of STOP_IDS) expect(Math.abs(length(HOURS[id].key.dir) - 1)).toBeLessThan(1e-6);
  });

  it('light Golden by the sun and Night by the moon', () => {
    expect(HOURS.golden.key.strength).toBeGreaterThan(0);
    expect(HOURS.golden.moon).toBeNull();
    expect(HOURS.night.moon).not.toBeNull();
  });

  it('blend to either end exactly', () => {
    expect(blendHours(HOURS.golden, HOURS.sunset, 0)).toEqual(HOURS.golden);
    expect(blendHours(HOURS.golden, HOURS.sunset, 1)).toEqual(HOURS.sunset);
  });

  it('keep the blended light direction unit length', () => {
    const mid = blendHours(HOURS.golden, HOURS.sunrise, 0.5);
    expect(Math.abs(length(mid.key.dir) - 1)).toBeLessThan(1e-6);
  });

  it('fade the moon out when only one side has it', () => {
    const half = blendHours(HOURS.night, HOURS.sunrise, 0.5);
    expect(half.moon?.strength).toBeCloseTo((HOURS.night.moon?.strength ?? 0) / 2, 6);
  });
});
