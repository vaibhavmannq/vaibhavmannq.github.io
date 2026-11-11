import { describe, expect, it } from 'vitest';
import { poseAt } from '../../src/journey/camera';
import flightPaths from '../../src/journey/flightPaths.json';
import type { FlightPath } from '../../src/journey/flights';
import { blendHours, HOURS } from '../../src/journey/hours';
import { SHOTS } from '../../src/journey/shots';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, frameAt } from '../../src/journey/timeline';
import { STOP_IDS } from '../../src/journey/types';
import { CLOUD_STEP, cloudGrid, cloudTop, deckWeight } from '../../src/world/cloudSea';

const cfg = SHOTS.midnight.cloudsea;
if (!cfg) throw new Error('shots.json has no sea of cloud');
const [x0, x1, y0, y1] = cfg.box;

describe('the sea of cloud (spec §9.10)', () => {
  it("covers the render's box with one flat grid at 8 m", () => {
    expect(CLOUD_STEP).toBe(8);
    const g = cloudGrid(cfg.box, CLOUD_STEP);
    g.computeBoundingBox();
    const b = g.boundingBox;
    if (!b) throw new Error('no bounds');
    // three.js axes: x east, z = -y
    expect(b.min.x).toBe(x0);
    expect(b.max.x).toBeGreaterThanOrEqual(x1 - CLOUD_STEP);
    expect(-b.max.z).toBe(y0);
    expect(-b.min.z).toBeGreaterThanOrEqual(y1 - CLOUD_STEP);
    expect(b.min.y).toBe(0);
    expect(b.max.y).toBe(0);
    expect(g.getAttribute('position').count).toBeLessThan(60_000);
  });

  it('never reaches higher than its top', () => {
    expect(cloudTop(cfg)).toBeCloseTo(cfg.z + 0.95 * cfg.amp, 9);
    expect(cloudTop(cfg)).toBeLessThan(SHOTS.midnight.eyeZ - 60);
  });

  it('shows fully from the ridge, and not at all from the lagoon under its edge', () => {
    expect(deckWeight(1, SHOTS.midnight.eyeZ, cfg)).toBe(1);
    expect(deckWeight(1, SHOTS.night.eyeZ, cfg)).toBe(0);
    expect(deckWeight(1, cloudTop(cfg) + 8, cfg)).toBe(0);
    expect(deckWeight(0.5, 400, cfg)).toBe(0.5);
  });

  it('is never flown through: every flight stays 8 m above the deck while it is there', () => {
    const track = buildTrack(STOPS);
    const paths = flightPaths as FlightPath[];
    const top = cloudTop(cfg) + 8;
    const low: string[] = [];
    for (const seg of track.segments) {
      if (seg.kind !== 'flight') continue;
      for (let k = 0; k <= 200; k++) {
        const frame = frameAt(track, seg.start + ((seg.end - seg.start) * k) / 200, false);
        const hour = blendHours(
          HOURS[STOP_IDS[frame.a] ?? 'golden'],
          HOURS[STOP_IDS[frame.b] ?? 'golden'],
          frame.hourWeight,
        );
        const [x, z, negY] = poseAt(frame, paths, 16 / 9, 0).position;
        if (deckWeight(hour.cloud, z, cfg) <= 0.05) continue;
        const y = -negY;
        if (x > x0 && x < x1 && y > y0 && y < y1 && z < top)
          low.push(`${STOP_IDS[seg.from]}>${STOP_IDS[seg.to]} t=${(k / 200).toFixed(2)} z=${z.toFixed(0)}`);
      }
    }
    expect(low).toEqual([]);
  });
});
