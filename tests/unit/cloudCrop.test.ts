import { describe, expect, it } from 'vitest';
import { CARD_ATLAS_W, cardCrops } from '../../src/world/cloudCards';

describe('cloud cards cropped to their visible cloud (Task 16a, s33)', () => {
  const H = 1536;
  const data = new Uint8Array(CARD_ATLAS_W * H * 4);
  // cell 0, a whole 256² card: cloud in x 20–99 and, counted up from the base row (254), rows 10–129
  for (let j = 10; j < 130; j++) for (let x = 20; x < 100; x++) data[((254 - j) * CARD_ATLAS_W + x) * 4] = 200;
  // a faint wisp under the visible limit does not widen the crop
  data[((254 - 200) * CARD_ATLAS_W + 200) * 4] = 10;
  const meta = {
    cols: 8,
    rows: 4,
    cards: [
      { cell: 0, w: 1, h: 1, lit: 1 },
      { cell: 1, w: 1, h: 1, lit: 1 },
    ],
  };
  const [crop, empty] = cardCrops(data, CARD_ATLAS_W, meta);

  it('keeps the cloud with 2 px to spare and drops the empty rest', () => {
    const [u0, u1, v0, v1] = crop as number[];
    expect(u0).toBeCloseTo(18 / 256, 5);
    expect(u1).toBeCloseTo(102 / 256, 5);
    expect(v0).toBeCloseTo(8 / 256, 5);
    expect(v1).toBeCloseTo(132 / 256, 5);
  });

  it('draws a card with no visible cloud whole (never a broken crop)', () => {
    expect(empty).toEqual([0, 1, 0, 1]);
  });
});
