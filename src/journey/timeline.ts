import { clamp01, smoothstep } from '../shared/math';
import type { JourneyState, RegionSegment, SectionId, Segment } from './types';

/** Floating-point slack so a value that lands exactly on an anchor counts as "reached". */
const EPSILON = 1e-9;

/** Plain loop instead of `.reduce()`: `resolve` calls this every frame, and `.reduce()` would
 *  allocate a fresh closure each time. */
export function totalLength(journey: readonly Segment[]): number {
  let sum = 0;
  for (let i = 0; i < journey.length; i++) sum += (journey[i] as Segment).length;
  return sum;
}

function sectionAt(segment: RegionSegment, local: number): SectionId {
  const first = segment.sections[0];
  if (first === undefined) throw new Error(`region ${segment.region} has no sections`);
  let current = first.id;
  for (const anchor of segment.sections) {
    if (local + EPSILON >= anchor.from) current = anchor.id;
  }
  return current;
}

// `resolve` is called every frame from the loop, so it writes into this one reusable object
// instead of allocating a fresh JourneyState (and fresh `a`/`b` objects) each time. Safe because
// every caller reads the fields it needs immediately, in the same synchronous step, before the
// next `resolve` call — see boot.ts. `b` starts undefined and only ever gets its own scratch
// object the first time a transition is actually resolved (phase 1's journey has none, so in
// production this never allocates at all).
const stateScratch: JourneyState = { a: { region: 'moonsink', local: 0 }, mix: 0, section: 'intro' };

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
        stateScratch.section = sectionAt(segment, local);
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
      stateScratch.section = local < 0.5 ? sectionAt(previousRegion, 1) : sectionAt(next, 0);
      return stateScratch;
    }

    if (segment.kind === 'region') previousRegion = segment;
    start = end;
  }

  throw new Error('journey is empty');
}

/** Global progress (0..1) where a text section begins, used by "Skip intro" and later by the region rail. */
export function progressForSection(journey: readonly Segment[], id: SectionId): number {
  const total = totalLength(journey);
  let start = 0;
  for (const segment of journey) {
    if (segment.kind === 'region') {
      const anchor = segment.sections.find((candidate) => candidate.id === id);
      if (anchor) return (start + anchor.from * segment.length) / total;
    }
    start += segment.length;
  }
  throw new Error(`section ${id} is not in the journey`);
}
