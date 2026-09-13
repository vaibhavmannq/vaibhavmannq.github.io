import { describe, expect, it } from 'vitest';
import { Governor, percentile } from '../../src/quality/governor';
import type { Tier } from '../../src/quality/tiers';

/** Feed ~1 s of frames (62 samples at 60 Hz). Returns the tier change reported during that window, if any. */
function runWindow(governor: Governor, frameMs: number, startMs: number): { change: Tier | null; endMs: number } {
  let change: Tier | null = null;
  let t = startMs;
  for (let i = 0; i < 62; i++) {
    t = startMs + i * (1000 / 60);
    const result = governor.sample(frameMs, t);
    if (result !== null) change = result;
  }
  return { change, endMs: t + 1000 / 60 };
}

describe('percentile', () => {
  it('returns the value below which the given share of samples fall', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 0.95)).toBe(95);
    expect(percentile(values, 0.5)).toBe(50);
    expect(percentile([7], 0.95)).toBe(7);
  });

  it('does not reorder the caller array', () => {
    const values = [3, 1, 2];
    percentile(values, 0.5);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('Governor', () => {
  it('waits for a full window before deciding', () => {
    const governor = new Governor(2, true);
    expect(governor.sample(40, 0)).toBeNull();
    expect(governor.sample(40, 500)).toBeNull();
  });

  it('steps down when the slow frames exceed 15 ms', () => {
    const governor = new Governor(2, true);
    const { change } = runWindow(governor, 20, 0);
    expect(change).toBe(1);
    expect(governor.current).toBe(1);
  });

  it('holds during the cooldown after a change, then steps again', () => {
    const governor = new Governor(3, true);
    const first = runWindow(governor, 20, 0);
    expect(first.change).toBe(2);
    const second = runWindow(governor, 20, first.endMs);
    expect(second.change).toBeNull();
    const third = runWindow(governor, 20, second.endMs);
    expect(third.change).toBe(1);
  });

  it('steps up only after three consecutive fast windows', () => {
    const governor = new Governor(1, true);
    const a = runWindow(governor, 8, 0);
    const b = runWindow(governor, 8, a.endMs);
    const c = runWindow(governor, 8, b.endMs);
    expect(a.change).toBeNull();
    expect(b.change).toBeNull();
    expect(c.change).toBe(2);
  });

  it('resets the fast-window count after an in-between window', () => {
    const governor = new Governor(1, true);
    const a = runWindow(governor, 8, 0);
    const b = runWindow(governor, 8, a.endMs);
    const c = runWindow(governor, 13, b.endMs);
    const d = runWindow(governor, 8, c.endMs);
    expect(d.change).toBeNull();
  });

  it('never goes above tier 3 on WebGL2 or below tier 0', () => {
    const webgl = new Governor(3, false);
    let t = 0;
    for (let i = 0; i < 3; i++) t = runWindow(webgl, 8, t).endMs;
    expect(webgl.current).toBe(3);

    const floor = new Governor(0, true);
    expect(runWindow(floor, 40, 0).change).toBeNull();
    expect(floor.current).toBe(0);
  });
});
