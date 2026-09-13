import { clamp01, smoothstep } from '../shared/math';
import type { JourneyState, RegionSegment, SectionId, Segment } from './types';

/** Floating-point slack so a value that lands exactly on an anchor counts as "reached". */
const EPSILON = 1e-9;

export function totalLength(journey: readonly Segment[]): number {
  return journey.reduce((sum, segment) => sum + segment.length, 0);
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

/** Turn scroll progress p (0..1) into "where are we in the journey". Pure: no DOM, no time. */
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
        return { a: { region: segment.region, local }, mix: 0, section: sectionAt(segment, local) };
      }

      const next = journey[i + 1];
      if (next === undefined || next.kind !== 'region') throw new Error('a transition must sit between two regions');
      return {
        a: { region: previousRegion.region, local: 1 },
        b: { region: next.region, local: 0 },
        mix: smoothstep(0, 1, local),
        effect: segment.effect,
        section: local < 0.5 ? sectionAt(previousRegion, 1) : sectionAt(next, 0),
      };
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
