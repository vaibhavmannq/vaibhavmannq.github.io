/** sessionStorage key: the visitor has been through the lantern room in this tab (spec §4.1: skip for returning visitors). */
export const LANTERN_KEY = 'eventide.lantern';
/** The room never ends sooner than this on a first visit, even with everything cached: a 2 s beat, not a flash. */
const MIN_MS = 2000;
/** Everything loaded and the lantern still unlit: it lights itself this long after (nobody is held at the door). */
const AUTO_LIGHT_MS = 3000;
/** Everything was already cached (full within this long of the start): the lantern lights itself almost at once. */
const CACHED_MS = 1000;
const CACHED_LIGHT_MS = 800;

export type LoadingState = 'waiting' | 'lit' | 'ready' | 'released' | 'stills';

export interface LoadingFlow {
  /** A returning visitor in this tab: the room is skipped. */
  readonly skip: boolean;
  state(): LoadingState;
  /** Show "tap, click or Enter to light" (from the start, until it is lit). */
  hint(): boolean;
  /** The visitor lit it (pointer, touch, Enter, Space). */
  light(): void;
  /** 0..1 (progress.ts). */
  progress(p: number): void;
  /** Each frame: lights itself when the visitor has not, ends the wait at the cap. */
  tick(): void;
  /** The lantern has floated out: the journey begins. */
  release(): void;
  /** The world could not load: the stills take over. */
  failed(): void;
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

/** Keys that light the lantern. */
export const lightsLantern = (key: string): boolean => key === 'Enter' || key === ' ';

/** The lantern room's flow (spec §4.1; plan world-to-100 Task 6). Pure: time comes from `nowMs`. */
export function createLoadingFlow(opts: { storage: Storage | null; nowMs: () => number; capMs: number }): LoadingFlow {
  const start = opts.nowMs();
  let state: LoadingState = 'waiting';
  let fullAt: number | null = null;
  let skip = false;
  try {
    skip = opts.storage?.getItem(LANTERN_KEY) === '1';
  } catch {
    skip = false; // storage blocked (private mode): a first visit
  }
  const done = () => state === 'ready' || state === 'released' || state === 'stills';
  return {
    skip,
    state: () => state,
    hint: () => state === 'waiting',
    light() {
      if (state === 'waiting') state = 'lit';
    },
    progress(p) {
      if (p >= 1 && fullAt === null) fullAt = opts.nowMs();
    },
    tick() {
      if (done()) return;
      const now = opts.nowMs();
      if (now - start >= opts.capMs) {
        state = 'ready';
        return;
      }
      if (state === 'waiting' && fullAt !== null) {
        const autoAt = fullAt - start < CACHED_MS ? start + CACHED_LIGHT_MS : fullAt + AUTO_LIGHT_MS;
        if (now >= autoAt) state = 'lit';
      }
      if (state === 'lit' && fullAt !== null && now - start >= MIN_MS) state = 'ready';
    },
    release() {
      state = 'released';
      try {
        opts.storage?.setItem(LANTERN_KEY, '1');
      } catch {
        // storage blocked: the next visit sees the room again, which is fine
      }
    },
    failed() {
      state = 'stills';
    },
  };
}
