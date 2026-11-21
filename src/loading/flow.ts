/** localStorage key: the visitor has been through the lantern room on this device (spec §4.1: skip for returning visitors; R215). */
export const LANTERN_KEY = 'eventide.lantern';
/** The room never ends sooner than this on a first visit, even with everything cached: a 2 s beat, not a flash. */
const MIN_MS = 2000;
/**
 * Unlit when the world is this far loaded, the lantern lights itself (nobody is held at the door; R213: lighting 3 s
 * after a full load kept a cached, untouching visitor 10 s on this laptop).
 */
const AUTO_LIGHT_AT = 0.7;
/** Once lit, the flame burns at least this long before the night begins. */
const BURN_MS = 1000;

export type LoadingState = 'waiting' | 'lit' | 'ready' | 'released' | 'stills';

export interface LoadingFlow {
  /** A returning visitor on this device: the room is skipped. */
  readonly skip: boolean;
  state(): LoadingState;
  /** Show "tap, click or Enter to light" (from the start, until it is lit). */
  hint(): boolean;
  /** The visitor lit it (pointer, touch, Enter, Space). */
  light(): void;
  /** It was the visitor who lit it (then it is theirs on the journey: the lantern thread's claim). */
  litByVisitor(): boolean;
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
  let loaded = 0;
  let litAt = 0;
  let skip = false;
  let byVisitor = false;
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
      if (state !== 'waiting') return;
      state = 'lit';
      litAt = opts.nowMs();
      byVisitor = true;
    },
    litByVisitor: () => byVisitor,
    progress(p) {
      loaded = Math.max(loaded, p);
      if (p >= 1 && fullAt === null) fullAt = opts.nowMs();
    },
    tick() {
      if (done()) return;
      const now = opts.nowMs();
      if (now - start >= opts.capMs) {
        state = 'ready';
        return;
      }
      if (state === 'waiting' && loaded >= AUTO_LIGHT_AT) {
        state = 'lit';
        litAt = now;
      }
      if (state === 'lit' && fullAt !== null && now - litAt >= BURN_MS && now - start >= MIN_MS) state = 'ready';
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
