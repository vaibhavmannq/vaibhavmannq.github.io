import { describe, expect, it } from 'vitest';
import { BUDGETS, checkBudgets, type FileEntry, type Manifest } from '../../src/assets/manifest';

const base: Manifest['base'] = {
  heights: { x0: 0, y0: 0, step: 8, nx: 2, ny: 2, lo: 0, hi: 1 },
  ring: { cx: 0, cy: 0, r0: 1, r1: 2, nr: 2, na: 3, lo: 0, hi: 1 },
};
const file = (path: string, bytes: number, stage: 'A' | 'B', stops: FileEntry['stops']): FileEntry => ({
  path,
  bytes,
  sha256: 'x',
  stage,
  stops,
});
const manifest = (files: FileEntry[]): Manifest => ({ version: 1, base, skies: {}, files });

describe('the pack budget check (spec §14)', () => {
  it('uses the spec budgets', () => {
    // D30: 5 MB per place; D53 (≈ 10 MB before the first place): base 6.8 MB since s33 (+ Golden's ~3.1 MB ≈ 9.9)
    expect(BUDGETS).toEqual({ stageABytes: 1.2e6, perStopBytes: 5e6, baseBytes: 6.8e6 });
  });

  it('passes a pack inside every budget', () => {
    const result = checkBudgets(
      manifest([file('sky/golden.jpg', 1.0e6, 'A', ['golden']), file('base/h.bin', 0.5e6, 'B', 'all')]),
      BUDGETS,
    );
    expect(result.ok).toBe(true);
  });

  it('fails when the first view needs too much', () => {
    const result = checkBudgets(manifest([file('sky/golden.jpg', 1.3e6, 'A', ['golden'])]), BUDGETS);
    expect(result.ok).toBe(false);
    expect(result.lines.some((l) => l.includes('stage A'))).toBe(true);
  });

  it('counts each stop by the files that list it, and fails the one over budget', () => {
    expect(checkBudgets(manifest([file('stops/night/a', 4.9e6, 'B', ['night'])]), BUDGETS).ok).toBe(true);
    const over = checkBudgets(
      manifest([
        file('stops/night/a', 4.0e6, 'B', ['night']),
        file('stops/night/b', 1.1e6, 'B', ['night', 'midnight']),
      ]),
      BUDGETS,
    );
    expect(over.ok).toBe(false);
    expect(over.lines.some((l) => l.includes('night') && l.includes('over'))).toBe(true);
    expect(over.lines.some((l) => l.includes('midnight') && l.includes('over'))).toBe(false);
  });
});

describe('the shared world base budget (M1)', () => {
  it('fails when the files every stop shares pass 5 MB (D53)', () => {
    const over = checkBudgets(manifest([file('base/heights.bin', 6.9e6, 'B', 'all')]), BUDGETS);
    expect(over.ok).toBe(false);
    expect(over.lines.some((l) => l.includes('world base') && l.includes('over'))).toBe(true);
    const under = checkBudgets(manifest([file('base/heights.bin', 6.7e6, 'B', 'all')]), BUDGETS);
    expect(under.ok).toBe(true);
  });
});
