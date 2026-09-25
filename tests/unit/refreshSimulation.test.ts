import { describe, expect, it } from 'vitest';
import { createPacer, MEASURE_SAMPLES } from '../../src/app/refresh';
import { Governor } from '../../src/quality/governor';
import type { Tier } from '../../src/quality/tiers';

// The real pacer and the real governor, wired the way boot.ts wires them: the governor judges only rendered frames,
// only once the pacer knows the screen, never the first frame after a quiet measurement, and the pacer is re-armed
// when the tier changes.
function simulate(options: {
  hzAt: (ms: number) => number;
  /** GPU cost of one rendered frame at a tier. The next animation frame waits for it, as a browser's does. */
  costMs: (tier: Tier) => number;
  seconds: number;
  startTier?: Tier;
}) {
  const pacer = createPacer();
  const governor = new Governor(options.startTier ?? 4, true);
  const changes: Tier[] = [];
  const intervals: number[] = [];
  let t = 1000;
  let last = -1;
  while (t < 1000 + options.seconds * 1000) {
    const vsync = 1000 / options.hzAt(t);
    if (!pacer.tick(t, false)) {
      t += vsync;
      continue;
    }
    if (last >= 0 && pacer.refreshHz !== null && !pacer.resumed) {
      const interval = t - last;
      intervals.push(interval);
      governor.setTargetInterval(pacer.targetIntervalMs);
      const next = governor.sample(interval, t, true);
      if (next !== null) {
        changes.push(next);
        pacer.rearm();
      }
    }
    last = t;
    t += Math.max(1, Math.ceil(options.costMs(governor.current) / vsync - 1e-9)) * vsync;
  }
  return { pacer, governor, changes, intervals };
}

// The regression from the 2026-09-25 review: with a GPU that costs nothing, 75, 90 and 144 Hz screens fell to
// tier 0 within 7 s.
describe('a free GPU on any refresh rate', () => {
  for (const hz of [60, 75, 90, 100, 120, 144, 165]) {
    it(`${hz} Hz: evenly spaced frames and no tier change in 30 s`, () => {
      const { changes, intervals, governor } = simulate({ hzAt: () => hz, costMs: () => 2, seconds: 30 });
      expect(changes).toEqual([]);
      expect(new Set(intervals.slice(MEASURE_SAMPLES * 4).map((ms) => ms.toFixed(2))).size).toBe(1);
      expect(governor.current).toBe(4);
    });
  }
});

// Final review C1 (2026-09-26): a slow GPU delays the next animation frame, so the pacer used to measure the frame
// rate it achieved as if it were the screen, the governor judged frames "on time", and never stepped down.
describe('a GPU that cannot keep up', () => {
  const cost: Record<Tier, number> = { 4: 50, 3: 35, 2: 24, 1: 15, 0: 10 };

  it('still measures the screen, and the governor steps down until frames are on time', () => {
    const { pacer, governor, changes } = simulate({ hzAt: () => 60, costMs: (tier) => cost[tier], seconds: 30 });
    expect(pacer.refreshHz).toBeCloseTo(60, 5);
    expect(changes.length).toBeGreaterThan(0);
    expect(governor.current).toBeLessThanOrEqual(1);
  });

  it('does the same on a 120 Hz phone', () => {
    const { pacer, governor } = simulate({ hzAt: () => 120, costMs: (tier) => cost[tier], seconds: 30 });
    expect(pacer.refreshHz).toBeCloseTo(120, 5);
    expect(governor.current).toBeLessThanOrEqual(1);
  });
});

describe('the screen changes rate mid-visit', () => {
  // A phone going into low-power mode, or its 120 Hz setting switched off.
  it('follows a drop from 120 to 60 Hz without costing a tier', () => {
    const { pacer, changes, intervals } = simulate({
      hzAt: (ms) => (ms < 4000 ? 120 : 60),
      costMs: () => 3,
      seconds: 12,
    });
    expect(pacer.refreshHz).toBeCloseTo(60, 5);
    expect(changes).toEqual([]);
    expect(new Set(intervals.slice(-60).map((ms) => ms.toFixed(2)))).toEqual(new Set([(1000 / 60).toFixed(2)]));
  });

  // The window dragged to a faster monitor with no resize event (final review I4).
  it('follows a rise from 60 to 144 Hz without costing a tier', () => {
    const { pacer, changes } = simulate({ hzAt: (ms) => (ms < 4000 ? 60 : 144), costMs: () => 3, seconds: 12 });
    expect(pacer.refreshHz).toBeCloseTo(144, 5);
    expect(changes).toEqual([]);
  });
});
