import type { FlightKey } from './flights';
import type { FrameState } from './timeline';
import { STOP_IDS } from './types';

export type PassageKind = 'canopy' | 'edge' | 'arch' | 'cloud' | 'spray' | 'cloudsea' | 'glare' | 'mist';

/**
 * One passage per ride (spec §4.2): the stretch of the flight, as ride t, where close-up sets may appear and leave
 * unseen. Phase 0 (R212) puts each window where today's frames carry the least detail (edge share, ride-frames.mjs at
 * low: 0.004–0.094); Phase 3 builds the enclosure itself (the canopy, the arch, the cloud bank...) around it.
 */
export const PASSAGES: Readonly<Partial<Record<FlightKey, { from: number; to: number; kind: PassageKind }>>> = {
  'golden>sunset': { from: 0.71, to: 0.83, kind: 'canopy' },
  'sunset>dusk': { from: 0.25, to: 0.37, kind: 'edge' },
  'dusk>bluehour': { from: 0.33, to: 0.46, kind: 'arch' },
  'bluehour>night': { from: 0.63, to: 0.75, kind: 'cloud' },
  'night>midnight': { from: 0.54, to: 0.67, kind: 'spray' },
  'midnight>beforedawn': { from: 0.54, to: 0.67, kind: 'cloudsea' },
  'beforedawn>firstlight': { from: 0.42, to: 0.54, kind: 'glare' },
  'firstlight>sunrise': { from: 0.58, to: 0.71, kind: 'mist' },
};

export interface SwapContext {
  reducedMotion: boolean;
  /** The first view has shown (before it, anything may join: the lantern room hides the world). */
  firstShown: boolean;
  /** The jump veil's opacity (overlay/links.ts). */
  veil: number;
  /** The camera rests at a place whose own set is not shown yet (a jump that outran its download). */
  ownSetMissing: boolean;
}

/**
 * May a close-up set appear or leave now? Inside a ride's passage (either direction), at the middle of a reduced-motion
 * cross-fade, behind a jump's veil, before the first view; and, as a last resort, at a place whose own set came late
 * (a pop beats an empty place, R212). Pure.
 */
export function canSwap(frame: FrameState, ctx: SwapContext): boolean {
  if (!ctx.firstShown || ctx.veil >= 0.9) return true;
  if (frame.kind === 'stop') return ctx.ownSetMissing;
  if (ctx.reducedMotion) return frame.fade > 0.5;
  const lo = Math.min(frame.a, frame.b);
  const key = `${STOP_IDS[lo]}>${STOP_IDS[lo + 1]}` as FlightKey;
  const p = PASSAGES[key];
  if (!p) return false;
  // going back the ride runs t from 1 to 0 over the same path: the window is the same stretch of it
  return frame.t >= p.from && frame.t <= p.to;
}
