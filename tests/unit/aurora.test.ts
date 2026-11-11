import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, frameAt, stopCentre } from '../../src/journey/timeline';
import { STOP_IDS } from '../../src/journey/types';
import { type AuroraData, auroraGeometry, auroraWeights, ROWS } from '../../src/world/aurora';

const data = JSON.parse(readFileSync('public/world/base/aurora.json', 'utf8')) as AuroraData;
const night = SHOTS.night.aurora;
const midnight = SHOTS.midnight.aurora;
if (!night || !midnight) throw new Error('shots.json has no aurora');
const track = buildTrack(STOPS);
const at = (id: (typeof STOP_IDS)[number]) => frameAt(track, stopCentre(track, STOP_IDS.indexOf(id)), false);

describe('the aurora (spec §9.4, D4)', () => {
  it('hangs each curtain on the unit sphere, its foot at the baked elevation', () => {
    const g = auroraGeometry(data.night, night, 0);
    const p = g.getAttribute('position');
    expect(p.count).toBe(3 * data.samples * (ROWS + 1));
    for (let i = 0; i < p.count; i += 37) expect(Math.hypot(p.getX(i), p.getY(i), p.getZ(i))).toBeCloseTo(1, 5);
    // first vertex: the first curtain's first sample, at its foot; three.js y is up
    const el = (data.night[0]?.[1] ?? 0) * (Math.PI / 180);
    expect(p.getY(0)).toBeCloseTo(Math.sin(el), 5);
    expect(g.index?.count).toBe(3 * (data.samples - 1) * ROWS * 6);
  });

  it('tells the two hours apart by the set flag, and carries each curtain its brightness', () => {
    const n = auroraGeometry(data.night, night, 0).getAttribute('band');
    const m = auroraGeometry(data.midnight, midnight, 1).getAttribute('band');
    expect(n.getW(0)).toBe(0);
    expect(m.getW(0)).toBe(1);
    expect(n.getY(0)).toBe(night.bands[0]?.[6]);
    expect(m.getY(m.count - 1)).toBeCloseTo(midnight.bands[2]?.[6] ?? 0, 6);
  });

  it("shows Night's curtains at Night, Midnight's at Midnight, none at Dusk", () => {
    expect(auroraWeights(at('night'))).toEqual([1, 0]);
    expect(auroraWeights(at('midnight'))).toEqual([0, 1]);
    expect(auroraWeights(at('dusk'))).toEqual([0, 0]);
  });

  it('cross-fades the two on the flight between, and fades in from Blue hour', () => {
    const flight = track.segments.find((s) => s.kind === 'flight' && s.from === STOP_IDS.indexOf('night'));
    const before = track.segments.find((s) => s.kind === 'flight' && s.to === STOP_IDS.indexOf('night'));
    if (!flight || !before) throw new Error('no flight');
    const [n, m] = auroraWeights(frameAt(track, (flight.start + flight.end) / 2, false));
    expect(n).toBeGreaterThan(0);
    expect(m).toBeGreaterThan(0);
    expect(n + m).toBeCloseTo(1, 6);
    const [n0, m0] = auroraWeights(frameAt(track, (before.start + before.end) / 2, false));
    expect(n0).toBeGreaterThan(0);
    expect(n0).toBeLessThan(1);
    expect(m0).toBe(0);
  });
});
