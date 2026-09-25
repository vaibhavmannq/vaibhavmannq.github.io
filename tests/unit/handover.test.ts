import { describe, expect, it } from 'vitest';
import type { SectionAnchor } from '../../src/journey/types';
import { CATCH_UP, createHandover, handoverAt, opacityFrom } from '../../src/overlay/sections';
import { damp } from '../../src/shared/math';

const anchors: readonly SectionAnchor[] = [
  { id: 'intro', from: 0 },
  { id: 'about', from: 0.25 },
  { id: 'projects', from: 0.5 },
  { id: 'contact', from: 0.75 },
];
const DT = 1 / 60;
const visibleCount = (shown: readonly { arrive: number; leave: number }[], above = 0.001) =>
  shown.filter((s) => opacityFrom(s.arrive, s.leave) > above).length;

/** Drive the handover along `path` (one local position per frame), then hold the last one for `holdFrames`. */
function drive(path: readonly number[], holdFrames: number, reducedMotion = false) {
  const handover = createHandover(anchors);
  const frames: { arrive: number; leave: number }[][] = [];
  const last = path[path.length - 1] as number;
  for (const local of [...path, ...Array(holdFrames).fill(last)]) {
    frames.push(handover.step(local, reducedMotion, frames.length === 0 ? 0 : DT).map((s) => ({ ...s })));
  }
  return frames;
}

const ramp = (from: number, to: number, frames: number) =>
  Array.from({ length: frames }, (_, i) => from + ((to - from) * (i + 1)) / frames);

describe('createHandover', () => {
  it('never shows two pages at once on a fast scroll down, and the destination arrives fully', () => {
    const frames = drive([0, ...ramp(0, 0.9, 5)], 180);
    for (const [i, frame] of frames.entries()) expect(visibleCount(frame), `frame ${i}`).toBeLessThanOrEqual(1);
    const end = frames[frames.length - 1] as { arrive: number; leave: number }[];
    expect(opacityFrom(end[3]?.arrive ?? 0, end[3]?.leave ?? 0)).toBe(1);
  });

  it('never shows two pages at once on a fast scroll up', () => {
    const frames = drive([0.9, ...ramp(0.9, 0, 5)], 180);
    for (const frame of frames) expect(visibleCount(frame)).toBeLessThanOrEqual(1);
    const end = frames[frames.length - 1] as { arrive: number; leave: number }[];
    expect(opacityFrom(end[0]?.arrive ?? 0, end[0]?.leave ?? 0)).toBe(1);
  });

  it('never shows the pages that were only flown past', () => {
    const frames = drive([0, ...ramp(0, 0.9, 5)], 180);
    const peak = (index: number) =>
      Math.max(...frames.map((frame) => opacityFrom(frame[index]?.arrive ?? 0, frame[index]?.leave ?? 0)));
    expect(peak(1)).toBeLessThan(0.001);
    expect(peak(2)).toBeLessThan(0.001);
  });

  // Review focus 3: the visitor changes their mind mid-flight.
  it('handles a fling that reverses before the exit has finished', () => {
    const frames = drive([0.36, ...ramp(0.36, 0.9, 3), ...ramp(0.9, 0.36, 3)], 180);
    for (const frame of frames) expect(visibleCount(frame)).toBeLessThanOrEqual(1);
    const end = frames[frames.length - 1] as { arrive: number; leave: number }[];
    expect(opacityFrom(end[1]?.arrive ?? 0, end[1]?.leave ?? 0)).toBe(1);
  });

  // Review focus 5: reduced motion is a hard switch, so exclusive by construction.
  it('under reduced motion follows the scroll exactly, one page at a time', () => {
    const frames = drive([0, ...ramp(0, 0.9, 5)], 10, true);
    for (const frame of frames) {
      expect(visibleCount(frame)).toBeLessThanOrEqual(1);
      for (const s of frame) {
        const opacity = opacityFrom(s.arrive, s.leave);
        expect(opacity === 0 || opacity === 1).toBe(true);
      }
    }
  });

  it('matches the old eased handover on a slow scroll (within 0.01)', () => {
    // A minute from top to bottom: the old per-page easing, reimplemented here as the reference.
    const path = ramp(0, 1, 3600);
    const old = anchors.map(() => ({ arrive: 0, leave: 0 }));
    const settle = (v: number, t: number) => (Math.abs(t - v) < 0.008 ? t : v);
    const handover = createHandover(anchors);
    path.forEach((local, frame) => {
      const next = handover.step(local, false, frame === 0 ? 0 : DT);
      anchors.forEach((_, i) => {
        const target = handoverAt(local, anchors, i, false);
        const o = old[i] as { arrive: number; leave: number };
        o.arrive = frame === 0 ? target.arrive : settle(damp(o.arrive, target.arrive, CATCH_UP, DT), target.arrive);
        o.leave = frame === 0 ? target.leave : settle(damp(o.leave, target.leave, CATCH_UP, DT), target.leave);
        const was = opacityFrom(o.arrive, o.leave);
        const now = opacityFrom(next[i]?.arrive ?? 0, next[i]?.leave ?? 0);
        expect(Math.abs(now - was), `frame ${frame}, page ${i}`).toBeLessThan(0.01);
      });
    });
  });
});
