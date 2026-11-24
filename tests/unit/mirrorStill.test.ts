import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { TIERS } from '../../src/quality/tiers';
import { stillSince } from '../../src/world/sea';

describe('the mirror redrawn less often while the camera rests, low only (s33, R252)', () => {
  const a = new Matrix4().makeTranslation(86, 19, -96);
  it('counts the resting drift (~0.1 mm a frame) as still', () => {
    expect(stillSince(a, a.clone().multiply(new Matrix4().makeTranslation(0.0001, 0, 0)))).toBe(true);
  });
  it('counts a step or a turn as moving', () => {
    expect(stillSince(a, a.clone().multiply(new Matrix4().makeTranslation(0.01, 0, 0)))).toBe(false);
    expect(stillSince(a, a.clone().multiply(new Matrix4().makeRotationAxis(new Vector3(0, 1, 0), 0.001)))).toBe(false);
  });
  it('only low skips; every other tier redraws every frame', () => {
    expect(TIERS[0].mirrorEvery).toBe(3);
    for (const t of [1, 2, 3] as const) expect(TIERS[t].mirrorEvery).toBe(1);
  });
});
