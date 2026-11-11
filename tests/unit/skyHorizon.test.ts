import { describe, expect, it } from 'vitest';
import { HORIZON_BINS, HORIZON_ROWS, paintHorizon } from '../../src/assets/skyHorizon';

/** A sky of one stored grey, rows bottom-first, with an optional brighter block of columns just above the horizon. */
function sky(width: number, height: number, grey: number, bright?: { from: number; to: number; value: number }) {
  const data = new Uint8Array(width * height * 4).fill(grey);
  if (bright)
    for (let y = height / 2; y < height / 2 + height / 30; y++)
      for (let x = bright.from; x < bright.to; x++)
        data.fill(bright.value, (y * width + x) * 4, (y * width + x) * 4 + 3);
  return { width, height, data };
}
const W = 256;
const BIN = W / HORIZON_BINS;
/** The red value painted in row `row` at column `x`. */
const at = (s: { width: number; data: Uint8Array }, x: number, row = 0) => s.data[(row * s.width + x) * 4] as number;

describe('the soft horizon painted into a sky photo’s bottom rows', () => {
  it('paints an even sky’s own colour, in every painted row and nowhere else', () => {
    const s = sky(W, 128, 128);
    s.data.fill(7, 0, W * 4 * (HORIZON_ROWS + 1)); // whatever the photo had straight down
    paintHorizon(s);
    for (let row = 0; row < HORIZON_ROWS; row++) for (const x of [0, 100, 255]) expect(at(s, x, row)).toBe(128);
    expect(at(s, 100, HORIZON_ROWS)).toBe(7);
  });

  it('is brighter only toward the bright part of the horizon, blending between directions', () => {
    const s = sky(W, 128, 60, { from: 0, to: BIN, value: 230 });
    paintHorizon(s);
    expect(at(s, BIN / 2)).toBe(230); // the bright direction's centre
    expect(at(s, 8 * BIN + BIN / 2)).toBe(60); // the far side
    expect(at(s, BIN)).toBeCloseTo((230 + 60) / 2, -1); // the edge between two directions
    expect(at(s, 0)).toBeCloseTo((230 + 60) / 2, -1); // wraps around the compass
  });

  it('is the typical colour of its direction, not ruled by a small glare (the sun, the moon)', () => {
    // A sun 4 px wide in a direction 16 px wide: in raw light its mean would be ~130× the sky around it.
    const s = sky(W, 128, 60, { from: 6, to: 10, value: 250 });
    paintHorizon(s);
    expect(at(s, BIN / 2)).toBeGreaterThan(60);
    expect(at(s, BIN / 2)).toBeLessThan(120);
  });
});
