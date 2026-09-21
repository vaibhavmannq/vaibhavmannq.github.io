import { describe, expect, it } from 'vitest';
import type { SectionAnchor } from '../../src/journey/types';
import { HANDOVER_FADE, HANDOVER_GAP, sectionOffset, sectionOpacity } from '../../src/overlay/sections';

const ABOUT = 0.45;
const anchors: readonly SectionAnchor[] = [
  { id: 'intro', from: 0 },
  { id: 'about', from: ABOUT },
];
const outEnd = ABOUT - HANDOVER_GAP / 2;
const outStart = outEnd - HANDOVER_FADE;
const inStart = ABOUT + HANDOVER_GAP / 2;
const inEnd = inStart + HANDOVER_FADE;
const everyPosition = Array.from({ length: 1001 }, (_, i) => i / 1000);

describe('sectionOpacity', () => {
  it('shows the intro fully until its fade begins, and About fully once its fade ends', () => {
    expect(sectionOpacity(0, anchors, 0, false)).toBe(1);
    expect(sectionOpacity(outStart, anchors, 0, false)).toBe(1);
    expect(sectionOpacity(inEnd, anchors, 1, false)).toBe(1);
    expect(sectionOpacity(1, anchors, 1, false)).toBe(1);
  });

  it('never shows two sections at the same scroll position', () => {
    for (const local of everyPosition) {
      const intro = sectionOpacity(local, anchors, 0, false);
      const about = sectionOpacity(local, anchors, 1, false);
      expect(Math.min(intro, about), `local ${local}`).toBe(0);
    }
  });

  it('leaves a quiet gap around the anchor where only the scene shows', () => {
    for (const local of [outEnd, ABOUT, inStart]) {
      expect(sectionOpacity(local, anchors, 0, false)).toBe(0);
      expect(sectionOpacity(local, anchors, 1, false)).toBe(0);
    }
  });

  it('is half faded exactly midway through each fade', () => {
    expect(sectionOpacity((outStart + outEnd) / 2, anchors, 0, false)).toBeCloseTo(0.5, 10);
    expect(sectionOpacity((inStart + inEnd) / 2, anchors, 1, false)).toBeCloseTo(0.5, 10);
  });

  it('runs backwards exactly: the value depends only on position, not on the direction of travel', () => {
    const forward = everyPosition.map((local) => sectionOpacity(local, anchors, 0, false));
    const backward = [...everyPosition]
      .reverse()
      .map((local) => sectionOpacity(local, anchors, 0, false))
      .reverse();
    expect(backward).toEqual(forward);
  });

  it('under reduced motion switches exactly at the anchor, with no in-between values', () => {
    expect(sectionOpacity(ABOUT - 1e-6, anchors, 0, true)).toBe(1);
    expect(sectionOpacity(ABOUT - 1e-6, anchors, 1, true)).toBe(0);
    expect(sectionOpacity(ABOUT, anchors, 0, true)).toBe(0);
    expect(sectionOpacity(ABOUT, anchors, 1, true)).toBe(1);
    for (const local of everyPosition) {
      const value = sectionOpacity(local, anchors, 0, true);
      expect(value === 0 || value === 1).toBe(true);
    }
  });

  it('would reject the old overlapping crossfade (proves the no-overlap test bites)', () => {
    // The Phase 1R handover at local 0.4: t = smoothstep(0.7, 1, local / ABOUT); intro = 1 − t, About = t.
    const smooth = (x: number) => {
      const t = Math.min(1, Math.max(0, x));
      return t * t * (3 - 2 * t);
    };
    const t = smooth((0.4 / ABOUT - 0.7) / 0.3);
    expect(Math.min(1 - t, t)).toBeGreaterThan(0);
  });
});

describe('three pages: intro, About, Projects', () => {
  const three: readonly SectionAnchor[] = [
    { id: 'intro', from: 0 },
    { id: 'about', from: 0.3 },
    { id: 'projects', from: 0.65 },
  ];

  it('never shows two sections at the same scroll position', () => {
    for (const local of everyPosition) {
      const shown = [0, 1, 2].filter((index) => sectionOpacity(local, three, index, false) > 0);
      expect(shown.length, `local ${local}`).toBeLessThanOrEqual(1);
    }
  });

  it('holds About fully between its arrival and the Projects handover, then Projects to the end', () => {
    expect(sectionOpacity(0.3 + HANDOVER_GAP / 2 + HANDOVER_FADE, three, 1, false)).toBe(1);
    expect(sectionOpacity(0.65 - HANDOVER_GAP / 2 - HANDOVER_FADE, three, 1, false)).toBe(1);
    expect(sectionOpacity(0.65, three, 1, false)).toBe(0);
    expect(sectionOpacity(0.65, three, 2, false)).toBe(0);
    expect(sectionOpacity(1, three, 2, false)).toBe(1);
  });
});

describe('sectionOffset', () => {
  it('drifts the outgoing text up and brings the incoming text up from below', () => {
    expect(sectionOffset(outStart, anchors, 0, false)).toBe(0);
    expect(sectionOffset(outEnd, anchors, 0, false)).toBe(-12);
    expect(sectionOffset(inStart, anchors, 1, false)).toBe(16);
    expect(sectionOffset(inEnd, anchors, 1, false)).toBe(0);
  });

  it('never offsets under reduced motion', () => {
    for (const local of everyPosition) {
      expect(sectionOffset(local, anchors, 0, true)).toBe(0);
      expect(sectionOffset(local, anchors, 1, true)).toBe(0);
    }
  });
});
