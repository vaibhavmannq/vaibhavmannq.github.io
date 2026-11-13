import { clamp01, smootherstep, smoothstep } from '../shared/math';
import type { Stop } from './types';

/** Scroll length of a stop, in screen heights (Amendment 1 §7: was 1.0). */
export const STOP_SCREENS = 1.5;

/**
 * Scroll length of a flight: longer flights get more scroll, within 2 to 6 screens. Amendment 1 §7 (D26: "never over
 * in a blink of an eye"): the night is about 41 screens, up from 21 (spec §8.1 had 0.8 + d / 900 within 1 to 2.2).
 */
export const flightScreens = (distanceM: number): number => Math.min(6, Math.max(2, 1.5 + distanceM / 400));

export type Segment =
  | { kind: 'stop'; stop: number; start: number; end: number }
  | {
      kind: 'flight';
      from: number;
      to: number;
      start: number;
      end: number /** metres, camera to camera */;
      distance: number;
    };

export interface Track {
  segments: readonly Segment[];
  /** Total scroll length in screen heights. */
  total: number;
}

/** What the scroll position means this frame. Everything visible is a function of this (spec §7 rule 1). */
export interface FrameState {
  kind: 'stop' | 'flight';
  /** Stop index the frame comes from, and goes to (equal at a stop). */
  a: number;
  b: number;
  /** 0..1 through the flight; 0.5 at a stop. */
  t: number;
  /** The camera rests at a stop: heavy settings may change, the text shows. */
  resting: boolean;
  /** How far the light has turned from a's hour to b's. */
  hourWeight: number;
  /** How far b's sky photo has faded in (spec §8.3: the middle 40 % of the flight). */
  skyWeight: number;
  /** How much of the stop's render still shows (M0: the places are stills). */
  stillWeight: number;
  /** Veil over the scene; only reduced motion uses it, to cross-fade instead of flying (spec §8.5). */
  fade: number;
}

export function buildTrack(stops: readonly Stop[]): Track {
  const segments: Segment[] = [];
  let u = 0;
  stops.forEach((stop, i) => {
    segments.push({ kind: 'stop', stop: i, start: u, end: u + STOP_SCREENS });
    u += STOP_SCREENS;
    const next = stops[i + 1];
    if (!next) return;
    const distance = Math.hypot(next.cam[0] - stop.cam[0], next.cam[1] - stop.cam[1]);
    const length = flightScreens(distance);
    segments.push({ kind: 'flight', from: i, to: i + 1, start: u, end: u + length, distance });
    u += length;
  });
  return { segments, total: u };
}

export function segmentAt(track: Track, u: number): Segment {
  const found = track.segments.find((s) => u < s.end) ?? track.segments[track.segments.length - 1];
  if (!found) throw new Error('empty track');
  return found;
}

export function frameAt(track: Track, u: number, reducedMotion: boolean): FrameState {
  const x = Math.min(track.total, Math.max(0, u));
  const s = segmentAt(track, x);
  if (s.kind === 'stop')
    return {
      kind: 'stop',
      a: s.stop,
      b: s.stop,
      t: 0.5,
      resting: true,
      hourWeight: 0,
      skyWeight: 0,
      stillWeight: 1,
      fade: 0,
    };
  const t = clamp01((x - s.start) / (s.end - s.start));
  const stillWeight = Math.max(smoothstep(0.15, 0, t), smoothstep(0.85, 1, t));
  if (reducedMotion) {
    const after = t < 0.5 ? 0 : 1;
    return {
      kind: 'flight',
      a: s.from,
      b: s.to,
      t,
      resting: false,
      hourWeight: after,
      skyWeight: after,
      stillWeight,
      fade: clamp01(1 - Math.abs(t - 0.5) / 0.15),
    };
  }
  return {
    kind: 'flight',
    a: s.from,
    b: s.to,
    t,
    resting: false,
    // Hold the light, then turn it in the middle third (owner-references §17, from the game's weather study: each
    // place sits in a stable light and the change happens in a short band between places).
    hourWeight: smootherstep(clamp01((t - 1 / 3) * 3)),
    skyWeight: smoothstep(0.3, 0.7, t),
    stillWeight,
    fade: 0,
  };
}

/** The scroll position (screens) of a stop's middle: where links, the rail and touch snap land. */
export function stopCentre(track: Track, index: number): number {
  const s = track.segments.find((seg) => seg.kind === 'stop' && seg.stop === index);
  if (!s) throw new Error(`no stop ${index}`);
  return (s.start + s.end) / 2;
}

export function nearestStop(track: Track, u: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const s of track.segments) {
    if (s.kind !== 'stop') continue;
    const d = Math.abs((s.start + s.end) / 2 - u);
    if (d < bestDistance) {
      bestDistance = d;
      best = s.stop;
    }
  }
  return best;
}
