import { describe, expect, it } from 'vitest';
import { createPacer, frameDivisor, MEASURE_SAMPLES, refreshFromDeltas } from '../../src/app/refresh';

/** Feed a pacer animation frames at `hz` for `seconds`; returns the intervals between rendered frames. */
function run(pacer: ReturnType<typeof createPacer>, hz: number, seconds: number, startMs = 1000): number[] {
  const rendered: number[] = [];
  for (let n = 0; n < hz * seconds; n++) {
    const now = startMs + (n * 1000) / hz;
    if (pacer.tick(now, false)) rendered.push(now);
  }
  return rendered.slice(1).map((t, i) => t - (rendered[i] as number));
}

describe('refreshFromDeltas', () => {
  it('reads the display rate from the median frame delta', () => {
    expect(refreshFromDeltas(Array(30).fill(1000 / 60))).toBeCloseTo(60, 5);
    expect(refreshFromDeltas(Array(30).fill(1000 / 144))).toBeCloseTo(144, 5);
  });

  // Review focus 1: a shader compile or a GC pause during measurement must not read as a slow screen.
  it('ignores a few long frames among the samples', () => {
    const deltas = [...Array(26).fill(1000 / 60), 250, 90, 48, 33];
    expect(refreshFromDeltas(deltas)).toBeCloseTo(60, 5);
  });

  it('falls back to 60 Hz with no samples', () => {
    expect(refreshFromDeltas([])).toBe(60);
  });
});

describe('frameDivisor', () => {
  it('renders every vsync up to ~90 Hz, every second one to ~150 Hz, every third above', () => {
    expect([60, 75, 90, 100, 120, 144, 165].map((hz) => frameDivisor(hz))).toEqual([1, 1, 2, 2, 2, 2, 3]);
    expect(frameDivisor(59.94)).toBe(1);
    expect(frameDivisor(119.88)).toBe(2);
  });
});

describe('createPacer', () => {
  it('keeps frames evenly spaced on every common refresh rate once measured', () => {
    for (const hz of [60, 75, 90, 100, 120, 144, 165]) {
      const intervals = run(createPacer(), hz, 5).slice(MEASURE_SAMPLES);
      const distinct = new Set(intervals.map((ms) => ms.toFixed(2)));
      expect(distinct.size, `${hz} Hz`).toBe(1);
      const expected = (frameDivisor(hz) * 1000) / hz;
      expect(intervals[0], `${hz} Hz`).toBeCloseTo(expected, 5);
    }
  });

  it('reports the measured refresh and the target interval the governor should judge against', () => {
    const pacer = createPacer();
    expect(pacer.refreshHz).toBeNull();
    expect(pacer.targetIntervalMs).toBeCloseTo(1000 / 60, 5);
    run(pacer, 90, 1);
    expect(pacer.refreshHz).toBeCloseTo(90, 5);
    expect(pacer.targetIntervalMs).toBeCloseTo(2000 / 90, 5);
  });

  it('renders every vsync when asked for full pace', () => {
    const intervals = run(createPacer({ full: true }), 90, 2).slice(MEASURE_SAMPLES);
    expect(intervals.every((ms) => Math.abs(ms - 1000 / 90) < 1e-6)).toBe(true);
  });

  it('halves the rate when idle', () => {
    const pacer = createPacer();
    run(pacer, 60, 1);
    const rendered: number[] = [];
    for (let n = 0; n < 60; n++) {
      const now = 5000 + (n * 1000) / 60;
      if (pacer.tick(now, true)) rendered.push(now);
    }
    expect(rendered.length).toBeGreaterThanOrEqual(29);
    expect(rendered.length).toBeLessThanOrEqual(31);
  });

  it('still counts a vsync the browser skipped', () => {
    const pacer = createPacer();
    run(pacer, 120, 1);
    // Next callbacks arrive 3 vsyncs apart (a busy main thread): each one renders, none waits for a 4th.
    const vsync = 1000 / 120;
    let t = 10_000;
    expect(pacer.tick(t, false)).toBe(true);
    t += 3 * vsync;
    expect(pacer.tick(t, false)).toBe(true);
  });

  // Found running the build (plan 1, Task 3): Chrome throttled an obscured window to one frame a second, the
  // pacer measured "1 Hz", and kept rendering at 1 fps after the throttle lifted. Throttling, a phone's
  // low-power mode or a refresh-rate setting all change the rate without a resize.
  it('measures again when frames stop matching the measured refresh, without being told', () => {
    const pacer = createPacer();
    run(pacer, 1, 40);
    expect(pacer.refreshHz).toBeCloseTo(1, 5);
    const intervals = run(pacer, 60, 2, 100_000).slice(MEASURE_SAMPLES + 10);
    expect(pacer.refreshHz).toBeCloseTo(60, 5);
    expect(new Set(intervals.map((ms) => ms.toFixed(2)))).toEqual(new Set([(1000 / 60).toFixed(2)]));
  });

  it('follows a phone switched from 60 to 120 Hz mid-visit', () => {
    const pacer = createPacer();
    run(pacer, 60, 1);
    const intervals = run(pacer, 120, 2, 50_000).slice(MEASURE_SAMPLES + 10);
    expect(pacer.refreshHz).toBeCloseTo(120, 5);
    expect(intervals.every((ms) => Math.abs(ms - 1000 / 60) < 1e-6)).toBe(true);
  });

  it('shrugs off a short hitch without measuring again', () => {
    const pacer = createPacer();
    run(pacer, 60, 1);
    const vsync = 1000 / 60;
    let t = 30_000;
    for (let i = 0; i < 4; i++) {
      t += 3 * vsync;
      pacer.tick(t, false);
    }
    expect(pacer.refreshHz).toBeCloseTo(60, 5);
  });

  // Final review C1: measuring while rendering reads a slow GPU's frame rate as the screen's. Measure quietly.
  it('renders nothing while it measures, so the GPU cannot skew the reading', () => {
    const pacer = createPacer();
    expect(pacer.quiet).toBe(true);
    for (let n = 0; n <= MEASURE_SAMPLES; n++) expect(pacer.tick(1000 + (n * 1000) / 60, false)).toBe(false);
    expect(pacer.quiet).toBe(false);
    expect(pacer.tick(1000 + ((MEASURE_SAMPLES + 1) * 1000) / 60, false)).toBe(true);
    expect(pacer.resumed).toBe(true);
    expect(pacer.tick(1000 + ((MEASURE_SAMPLES + 2) * 1000) / 60, false)).toBe(true);
    expect(pacer.resumed).toBe(false);
  });

  // Review focus 2: a window dragged from a 60 Hz laptop screen to a 144 Hz monitor.
  it('re-measures after remeasure() and adopts the new cadence', () => {
    const pacer = createPacer();
    run(pacer, 60, 1);
    expect(pacer.refreshHz).toBeCloseTo(60, 5);
    pacer.remeasure();
    expect(pacer.refreshHz).toBeNull();
    const intervals = run(pacer, 144, 2, 20_000).slice(MEASURE_SAMPLES);
    expect(pacer.refreshHz).toBeCloseTo(144, 5);
    expect(new Set(intervals.map((ms) => ms.toFixed(2))).size).toBe(1);
    expect(intervals[0]).toBeCloseTo(2000 / 144, 5);
  });
});
