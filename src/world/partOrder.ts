import { STOP_IDS, type StopId } from '../journey/types';
import { ARCH_SEEN_FROM } from './headland';

/**
 * Where each stage-B part shows (plan M2.5 Task 8): the parts the opening stop shows compile first, then the rest by
 * how many stops away they first show. s09, opening at Night: the falls joined 5.2–6.6 s after the scene showed,
 * the cave 7.4–8.4 s, because every part compiled in a fixed sequence.
 */
const EVERYWHERE = new Set<StopId>(STOP_IDS);
export const PART_STOPS: Record<string, ReadonlySet<StopId>> = {
  terrain: EVERYWHERE,
  sea: EVERYWHERE,
  dressing: EVERYWHERE,
  aurora: new Set(['night', 'midnight']),
  falls: new Set(['night']),
  cloud: new Set(['midnight']),
  cave: new Set(['beforedawn']),
  arch: ARCH_SEEN_FROM,
  stacks: ARCH_SEEN_FROM, // the stacks are seen with the arch (STACKS_SEEN_FROM aliases it)
};

/** Pure: the order to compile and add `names`, opening at `stop`. Ties keep the given order; unknown names go last. */
export function partOrder(names: readonly string[], stop: StopId): string[] {
  const from = STOP_IDS.indexOf(stop);
  const distance = (name: string) => {
    const shows = PART_STOPS[name];
    if (!shows) return Number.POSITIVE_INFINITY;
    let d = Number.POSITIVE_INFINITY;
    for (const s of shows) d = Math.min(d, Math.abs(STOP_IDS.indexOf(s) - from));
    return d;
  };
  return names
    .map((name, i) => ({ name, i, d: distance(name) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((p) => p.name);
}
