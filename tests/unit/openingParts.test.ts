import { describe, expect, it } from 'vitest';
import { joinedShare, openingParts } from '../../src/world/partOrder';

// plan M8 Task 5: the first view waited only for the sky, so a first visit saw the lantern over a bare plane, then the
// ground, then the cliffs and grove snap in (3.4 s and 5.1 s on 10 Mbit/s). The reveal waits for what the opening
// stop shows (capped), and the hairline under the name fills with it.
describe('openingParts', () => {
  it('names the ground, the sea and the parts the opening stop shows, and nothing it does not', () => {
    const golden = openingParts('golden');
    for (const n of ['terrain', 'sea', 'cliffs', 'grove', 'meadow', 'pebbles']) expect(golden).toContain(n);
    for (const n of ['cave', 'aurora', 'bowl', 'cloud']) expect(golden).not.toContain(n);
    expect(openingParts('beforedawn')).toContain('cave');
  });
  it('gives the share joined, 1 when nothing is wanted', () => {
    expect(joinedShare(new Set(['terrain']), ['terrain', 'sea'])).toBe(0.5);
    expect(joinedShare(new Set(['terrain', 'sea', 'x']), ['terrain', 'sea'])).toBe(1);
    expect(joinedShare(new Set(), [])).toBe(1);
  });
});
