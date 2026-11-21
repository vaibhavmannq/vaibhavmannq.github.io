import type { StopId } from '../journey/types';
import type { WorldPart } from './part';

/** What the streamer needs from the app (boot.ts); pure otherwise, so its life cycle is tested alone. */
export interface SetDeps {
  /** Download and build a place's set; [] when the place has none yet. */
  fetchSet(id: StopId): Promise<WorldPart[]>;
  /** Compile for the eye and the mirror before it may show (R38). */
  compile(parts: WorldPart[]): Promise<void>;
  add(parts: WorldPart[]): void;
  remove(parts: WorldPart[]): void;
}

export type SetState = 'none' | 'fetching' | 'ready' | 'shown';

export interface SetStreamer {
  /** Each frame: what is wanted (sets.ts wantedSets), and whether a set may appear or leave now (passages.ts). */
  update(w: { keep: readonly StopId[]; fetch: StopId | null }, canSwap: boolean): void;
  state(id: StopId): SetState;
}

interface Entry {
  state: 'fetching' | 'ready' | 'shown';
  parts: WorldPart[];
  /** No longer wanted while it was still on its way: disposed when it arrives. */
  dropped: boolean;
}

/**
 * Close-up sets in and out (spec §4.2): fetched and compiled off-screen, shown only where a swap is hidden (a passage,
 * a fade), released the same way. A failed fetch leaves the far version and is tried again the next time it is wanted.
 */
export function createSetStreamer(deps: SetDeps): SetStreamer {
  const sets = new Map<StopId, Entry>();
  const release = (parts: WorldPart[]) => {
    for (const p of parts) p.dispose();
  };
  const start = (id: StopId) => {
    const entry: Entry = { state: 'fetching', parts: [], dropped: false };
    sets.set(id, entry);
    deps
      .fetchSet(id)
      .then(async (parts) => {
        entry.parts = parts;
        if (!entry.dropped) await deps.compile(parts);
        if (entry.dropped) {
          release(parts);
          sets.delete(id);
          return;
        }
        entry.state = 'ready';
      })
      .catch((error: unknown) => {
        console.warn(`the ${id} set failed to load`, error);
        release(entry.parts);
        sets.delete(id);
      });
  };
  return {
    update(w, canSwap) {
      const wanted = new Set<StopId>(w.keep);
      if (w.fetch) wanted.add(w.fetch);
      for (const id of wanted) {
        const e = sets.get(id);
        if (!e) start(id);
        else e.dropped = false;
      }
      for (const id of w.keep) {
        const e = sets.get(id);
        if (e?.state === 'ready' && canSwap) {
          deps.add(e.parts);
          e.state = 'shown';
        }
      }
      for (const [id, e] of sets) {
        if (wanted.has(id)) continue;
        if (e.state === 'fetching') e.dropped = true;
        else if (e.state === 'ready') {
          release(e.parts);
          sets.delete(id);
        } else if (canSwap) {
          deps.remove(e.parts);
          release(e.parts);
          sets.delete(id);
        }
      }
    },
    state: (id) => sets.get(id)?.state ?? 'none',
  };
}
