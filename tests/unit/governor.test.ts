import { describe, expect, it } from 'vitest';
import { Governor, percentile } from '../../src/quality/governor';
import type { Tier } from '../../src/quality/tiers';

/** Feed ~1 s of frames (62 samples at 60 Hz). Returns the tier change reported during that window, if any. */
function runWindow(
  governor: Governor,
  frameMs: number,
  startMs: number,
  canChange = true,
): { change: Tier | null; endMs: number } {
  let change: Tier | null = null;
  let t = startMs;
  for (let i = 0; i < 62; i++) {
    t = startMs + i * (1000 / 60);
    const result = governor.sample(frameMs, t, canChange);
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
  // The owner, 2026-09-25: the scene blinked a few seconds after coming to rest on every page. A tier
  // change is visible, and scrolling frames are slower than standing-still ones, so the governor stepped
  // down at each stop and back up during each quiet spell, forever.
  it('never returns to a tier that has already proved too slow', () => {
    const governor = new Governor(3, true);
    let t = 0;

    ({ endMs: t } = runWindow(governor, 40, t));
    expect(governor.current).toBe(2);

    // However fast it gets from here, tier 3 is shut for this visit.
    for (let i = 0; i < 8; i++) ({ endMs: t } = runWindow(governor, 16, t + 2100));
    expect(governor.current).toBe(2);
  });

  it('stops stepping up once the journey has settled, but still steps down', () => {
    const governor = new Governor(1, true);
    let t = 0;

    ({ endMs: t } = runWindow(governor, 16, t));
    ({ endMs: t } = runWindow(governor, 16, t));
    ({ endMs: t } = runWindow(governor, 16, t));
    expect(governor.current).toBe(2);

    // Well past the settle window: quiet, fast frames no longer change the picture under the visitor.
    t = 30_000;
    for (let i = 0; i < 6; i++) ({ endMs: t } = runWindow(governor, 16, t + 2100));
    expect(governor.current).toBe(2);

    // A device that starts struggling is still helped, whenever that happens.
    ({ endMs: t } = runWindow(governor, 40, t + 2100));
    expect(governor.current).toBe(1);
  });

  it('waits for a full window before deciding', () => {
    const governor = new Governor(2, true);
    expect(governor.sample(40, 0)).toBeNull();
    expect(governor.sample(40, 500)).toBeNull();
  });

  // Real caller: boot.ts feeds the interval between rendered frames, capped at 60 fps by
  // loop.ts, so a device that is missing vsyncs sits around 33 ms (one dropped frame), not
  // some arbitrary "slow" number below the frame cap.
  it('steps down when the frame interval exceeds 20 ms (a missed vsync)', () => {
    const governor = new Governor(2, true);
    const { change } = runWindow(governor, 33, 0);
    expect(change).toBe(1);
    expect(governor.current).toBe(1);
  });

  it('holds during the cooldown after a change, then steps again', () => {
    const governor = new Governor(3, true);
    const first = runWindow(governor, 33, 0);
    expect(first.change).toBe(2);
    const second = runWindow(governor, 33, first.endMs);
    expect(second.change).toBeNull();
    const third = runWindow(governor, 33, second.endMs);
    expect(third.change).toBe(1);
  });

  // 16.7 ms is what a perfectly healthy 60 fps device produces (this is the C1 signal, not an
  // arbitrary fast number) — it must read as "fast" and, after 3 windows, step up.
  it('steps up only after three consecutive fast windows', () => {
    const governor = new Governor(1, true);
    const a = runWindow(governor, 16.7, 0);
    const b = runWindow(governor, 16.7, a.endMs);
    const c = runWindow(governor, 16.7, b.endMs);
    expect(a.change).toBeNull();
    expect(b.change).toBeNull();
    expect(c.change).toBe(2);
  });

  it('resets the fast-window count after an in-between window', () => {
    const governor = new Governor(1, true);
    const a = runWindow(governor, 16.7, 0);
    const b = runWindow(governor, 16.7, a.endMs);
    const c = runWindow(governor, 18.5, b.endMs); // between the two thresholds: neither fast nor slow
    const d = runWindow(governor, 16.7, c.endMs);
    expect(d.change).toBeNull();
  });

  it('never goes above tier 3 on WebGL2 or below tier 0', () => {
    const webgl = new Governor(3, false);
    let t = 0;
    for (let i = 0; i < 3; i++) t = runWindow(webgl, 16.7, t).endMs;
    expect(webgl.current).toBe(3);

    const floor = new Governor(0, true);
    expect(runWindow(floor, 40, 0).change).toBeNull();
    expect(floor.current).toBe(0);
  });

  // Regression test for C1: boot.ts feeds the vsync-capped frame interval, which is pinned at
  // ~16.7 ms on a flawless 60 Hz device. Under the old thresholds (down > 15 ms) that value was
  // itself "slow", so every healthy device ratcheted down to tier 0 within a few seconds and
  // could never recover (upThresholdMs: 11 was unreachable under the 60 fps cap). Starting at
  // the WebGL2 ceiling makes the assertion exact: repeated "fast" windows have nowhere to climb
  // to, so if the tier moves AT ALL over 10 simulated seconds of steady 16.7 ms samples, the
  // thresholds are wrong again.
  it('a steady 60 fps machine stays at its starting tier for 10 simulated seconds', () => {
    const governor = new Governor(3, false); // tier 3 is the WebGL2 ceiling
    let t = 0;
    for (let i = 0; i < 10; i++) {
      t = runWindow(governor, 16.7, t).endMs;
    }
    expect(governor.current).toBe(3);
  });

  it('never changes tier while the visitor is scrolling, however slow the frames', () => {
    const governor = new Governor(2, true);
    let t = 0;
    for (let i = 0; i < 5; i++) {
      const window = runWindow(governor, 33, t, false);
      expect(window.change).toBeNull();
      t = window.endMs;
    }
    expect(governor.current).toBe(2);
  });

  it('applies a slow verdict on the first window after scrolling stops', () => {
    const governor = new Governor(2, true);
    const scrolling = runWindow(governor, 33, 0, false);
    const settled = runWindow(governor, 33, scrolling.endMs, true);
    expect(settled.change).toBe(1);
  });

  it('keeps counting fast windows while scrolling, then steps up once it may', () => {
    const governor = new Governor(1, true);
    let t = 0;
    for (let i = 0; i < 3; i++) t = runWindow(governor, 16.7, t, false).endMs;
    expect(governor.current).toBe(1);
    expect(runWindow(governor, 16.7, t, true).change).toBe(2);
  });

  it('ignores a stale window left over from idle, so resuming never steps down on its own (review I4)', () => {
    const governor = new Governor(2, true);
    let t = 0;
    for (let i = 0; i < 18; i++) {
      t = i * (1000 / 60);
      expect(governor.sample(16.7, t)).toBeNull();
    }
    // Idle for 9 s (the loop stops feeding the governor); the first frame back spans the gap.
    expect(governor.sample(33, t + 9000)).toBeNull();
    expect(governor.current).toBe(2);
  });

  it('remembers a slow window closed while scrolling and steps down as soon as it may (review M10)', () => {
    const governor = new Governor(2, true);
    const scrolling = runWindow(governor, 33, 0, false);
    expect(scrolling.change).toBeNull();
    // Scrolling has stopped and frames are smooth at rest: the verdict from the scroll still applies.
    expect(governor.sample(16.7, scrolling.endMs, true)).toBe(1);
  });

  // Spec 2026-09-25 §4.1: on a 90 Hz screen the pacer renders every second vsync, 22.2 ms apart. That is
  // healthy, not slow.
  it('judges frames against the target interval it is given', () => {
    const governor = new Governor(3, false);
    governor.setTargetInterval(2000 / 90);
    let t = 0;
    for (let i = 0; i < 10; i++) t = runWindow(governor, 2000 / 90, t).endMs;
    expect(governor.current).toBe(3);
    expect(runWindow(governor, 30, t + 2100).change).toBe(2);
  });

  it('keeps S16 exactly at 60 Hz: slow above 20 ms, fast below 17.5 ms', () => {
    const governor = new Governor(2, true);
    expect(runWindow(governor, 19.9, 0).change).toBeNull();
    expect(runWindow(governor, 20.1, 2100).change).toBe(1);
  });

  it('keeps a remembered step-down waiting while the visitor is still scrolling', () => {
    const governor = new Governor(2, true);
    const first = runWindow(governor, 33, 0, false);
    const stillScrolling = runWindow(governor, 16.7, first.endMs, false);
    expect(stillScrolling.change).toBeNull();
    expect(governor.current).toBe(2);
    expect(governor.sample(16.7, stillScrolling.endMs, true)).toBe(1);
  });
});
