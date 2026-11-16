import type { StopId } from './types';

/**
 * The lantern thread (plan M3 Task 5; inspiration-and-ideas A; Amendment 1): the visitor takes Golden's lantern as
 * theirs, and it turns up again later in the night. Pure state; the lantern parts read it.
 *   I Golden      it waits on the wet sand; a hover or a tap claims it
 *   III Dusk      it drifts among the 44 lanterns, a little warmer than the rest
 *   VIII First light, IX Sunrise   it rests in the shallows, dim; at Sunrise the sun takes over
 * IV–VII belong to their own milestones. Kept for the visit only (sessionStorage), never across visits.
 */
export interface Thread {
  claimed: boolean;
}

export type ThreadPlace = 'beach' | 'drifting' | 'shallows' | null;

export const THREAD_KEY = 'eventide.thread';

/** Pure: where the visitor's lantern is at a stop, or null where it is not shown. */
export function threadPlace(t: Thread, stop: StopId): ThreadPlace {
  if (stop === 'golden') return 'beach';
  if (!t.claimed) return null;
  if (stop === 'dusk') return 'drifting';
  if (stop === 'firstlight' || stop === 'sunrise') return 'shallows';
  return null;
}

type Reader = Pick<Storage, 'getItem'> | null | undefined;
type Writer = Pick<Storage, 'setItem'> | null | undefined;

/** The saved thread; anything missing, blocked (private windows, blocked site data) or malformed reads as unclaimed. */
export function loadThread(storage: Reader): Thread {
  try {
    const raw = storage?.getItem(THREAD_KEY);
    if (!raw) return { claimed: false };
    const v = JSON.parse(raw) as unknown;
    return { claimed: typeof v === 'object' && v !== null && (v as { claimed?: unknown }).claimed === true };
  } catch {
    return { claimed: false };
  }
}

/** Saves the thread; a storage that refuses is ignored (the thread then lasts until the page closes). */
export function saveThread(storage: Writer, t: Thread): void {
  try {
    storage?.setItem(THREAD_KEY, JSON.stringify({ claimed: t.claimed }));
  } catch {
    // blocked or full: the in-memory thread still holds for this page
  }
}
