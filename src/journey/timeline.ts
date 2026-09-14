import { clamp01, smoothstep } from '../shared/math';
import type { JourneyState, RegionSegment, SectionId, Segment } from './types';

/** Floating-point slack so a value that lands exactly on an anchor counts as "reached". Shared by
 *  section text (overlay/sections.ts) and the reduced-motion camera cut, so all three agree. */
export const ANCHOR_EPSILON = 1e-9;

/** Plain loop instead of `.reduce()`: `resolve` calls this every frame, and `.reduce()` would
 *  allocate a fresh closure each time. */
export function totalLength(journey: readonly Segment[]): number {
  let sum = 0;
  for (let i = 0; i < journey.length; i++) sum += (journey[i] as Segment).length;
  return sum;
}

/** Finds the anchor covering `local` and how far local sits between it and the next anchor's
 *  `from` (1 when there is no next anchor — the section holds at fully "arrived"). Writes both
 *  into `out` instead of returning a fresh object: `resolve` calls this every frame and `out` is
 *  always its own reusable `stateScratch` (frame-loop contract — no allocation). */
function sectionAt(segment: RegionSegment, local: number, out: JourneyState): void {
  const sections = segment.sections;
  const first = sections[0];
  if (first === undefined) throw new Error(`region ${segment.region} has no sections`);
  let index = 0;
  for (let i = 0; i < sections.length; i++) {
    if (local + ANCHOR_EPSILON >= (sections[i] as { from: number }).from) index = i;
  }
  const anchor = sections[index] as { id: SectionId; from: number };
  const next = sections[index + 1];
  out.section = anchor.id;
  out.sectionMix = next === undefined ? 1 : clamp01((local - anchor.from) / (next.from - anchor.from));
}

// `resolve` is called every frame from the loop, so it writes into this one reusable object
// instead of allocating a fresh JourneyState (and fresh `a`/`b` objects) each time. Safe because
// every caller reads the fields it needs immediately, in the same synchronous step, before the
// next `resolve` call — see boot.ts. `b` starts undefined and only ever gets its own scratch
// object the first time a transition is actually resolved (phase 1's journey has none, so in
// production this never allocates at all).
const stateScratch: JourneyState = {
  a: { region: 'moonsink', local: 0 },
  mix: 0,
  section: 'intro',
  sectionMix: 0,
};

/** Turn scroll progress p (0..1) into "where are we in the journey". No DOM, no time — but, like
 *  the loop it feeds, it hands back the same object every call rather than a fresh one. */
export function resolve(p: number, journey: readonly Segment[]): JourneyState {
  const first = journey[0];
  if (first === undefined || first.kind !== 'region') throw new Error('journey must start with a region');

  const position = clamp01(p) * totalLength(journey);
  let start = 0;
  let previousRegion: RegionSegment = first;

  for (let i = 0; i < journey.length; i++) {
    const segment = journey[i] as Segment;
    const end = start + segment.length;
    const isLast = i === journey.length - 1;

    if (position < end || isLast) {
      const local = segment.length > 0 ? clamp01((position - start) / segment.length) : 1;

      if (segment.kind === 'region') {
        stateScratch.a.region = segment.region;
        stateScratch.a.local = local;
        stateScratch.b = undefined;
        stateScratch.mix = 0;
        stateScratch.effect = undefined;
        sectionAt(segment, local, stateScratch);
        return stateScratch;
      }

      const next = journey[i + 1];
      if (next === undefined || next.kind !== 'region') throw new Error('a transition must sit between two regions');
      stateScratch.a.region = previousRegion.region;
      stateScratch.a.local = 1;
      if (stateScratch.b === undefined) stateScratch.b = { region: next.region, local: 0 };
      else {
        stateScratch.b.region = next.region;
        stateScratch.b.local = 0;
      }
      stateScratch.mix = smoothstep(0, 1, local);
      stateScratch.effect = segment.effect;
      if (local < 0.5) sectionAt(previousRegion, 1, stateScratch);
      else sectionAt(next, 0, stateScratch);
      return stateScratch;
    }

    if (segment.kind === 'region') previousRegion = segment;
    start = end;
  }

  throw new Error('journey is empty');
}

/**
 * Global progress (0..1) where a text section begins, used by "Skip intro" and later by the region
 * rail. `offset` aims past the anchor, in region-local units: Skip intro uses it to land where the
 * section is fully shown rather than in the handover gap (journey-flow review I1).
 */
export function progressForSection(journey: readonly Segment[], id: SectionId, offset = 0): number {
  const total = totalLength(journey);
  let start = 0;
  for (const segment of journey) {
    if (segment.kind === 'region') {
      const anchor = segment.sections.find((candidate) => candidate.id === id);
      if (anchor) return (start + (anchor.from + offset) * segment.length) / total;
    }
    start += segment.length;
  }
  throw new Error(`section ${id} is not in the journey`);
}
