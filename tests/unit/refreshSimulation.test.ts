import { describe, expect, it } from 'vitest';
import { createPacer, MEASURE_SAMPLES } from '../../src/app/refresh';
import { Governor } from '../../src/quality/governor';

// The regression from the 2026-09-25 review: with a GPU that costs nothing, 75, 90 and 144 Hz screens fell to
// tier 0 within 7 s. This runs the real pacer and the real governor, the way boot.ts wires them.
describe('a free GPU on any refresh rate', () => {
  for (const hz of [60, 75, 90, 100, 120, 144, 165]) {
    it(`${hz} Hz: evenly spaced frames and no tier change in 30 s`, () => {
      const pacer = createPacer();
      const governor = new Governor(4, true);
      let last = -1;
      let changes = 0;
      const intervals = new Set<string>();
      for (let n = 0; n < hz * 30; n++) {
        const now = 1000 + (n * 1000) / hz;
        if (!pacer.tick(now, false)) continue;
        // boot.ts never lets the governor judge frames while the pacer is still measuring the screen: until
        // then frames follow the old time-based cap, which on a 75 or 144 Hz screen is uneven and would read
        // as slow (found by this test; plan 1, Task 2 ruling).
        if (last >= 0 && pacer.refreshHz !== null) {
          const interval = now - last;
          if (n > MEASURE_SAMPLES * 4) intervals.add(interval.toFixed(2));
          governor.setTargetInterval(pacer.targetIntervalMs);
          if (governor.sample(interval, now, true) !== null) changes++;
        }
        last = now;
      }
      expect(changes).toBe(0);
      expect(intervals.size).toBe(1);
      expect(governor.current).toBe(4);
    });
  }
});
