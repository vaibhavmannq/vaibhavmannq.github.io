import { describe, expect, it } from 'vitest';
import { journey } from '../../src/journey/journey.config';
import { resolve } from '../../src/journey/timeline';
import type { RegionSegment } from '../../src/journey/types';
import { fullyShown, SHOWN_OFFSET } from '../../src/overlay/sections';

const anchors = (journey[0] as RegionSegment).sections;

// Final review I2: focus that landed mid-glide, once the journey already named the page but before it had faded in,
// counted as "shown" and never glided on, leaving the focused element half transparent.
describe('fullyShown', () => {
  it('is false where the journey already names the page but it is still fading in', () => {
    const about = anchors[1];
    if (about === undefined) throw new Error('no about anchor');
    const local = about.from + 1e-4;
    expect(resolve(local, journey).section).toBe('about');
    expect(fullyShown(local, anchors, 'about', false)).toBe(false);
  });

  it('is true at every page’s shown point, and for no other page there', () => {
    for (const anchor of anchors) {
      const local = anchor.id === 'intro' ? 0 : anchor.from + SHOWN_OFFSET;
      for (const other of anchors) {
        expect(fullyShown(local, anchors, other.id, false), `${other.id} at ${anchor.id}`).toBe(other.id === anchor.id);
      }
    }
  });
});
