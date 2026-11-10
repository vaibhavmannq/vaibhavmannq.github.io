import { stopIndex } from '../journey/stops';
import { nearestStop, stopCentre, type Track } from '../journey/timeline';
import { STOP_IDS } from '../journey/types';
import type { ScrollController } from '../scroll/scroll';

/** The stop a URL asks for: `#night`, or the test flag `?stop=night`. -1 when it names no stop. */
export function targetFromLocation(hash: string, search: string): number {
  const fromHash = stopIndex(hash.replace(/^#/, ''));
  if (fromHash >= 0) return fromHash;
  return stopIndex(new URLSearchParams(search).get('stop') ?? '');
}

/** A neighbour is close enough to fly to; anything further fades straight there (spec §8.4). */
export const jumpPlan = (from: number, to: number): 'glide' | 'fade' => (Math.abs(to - from) <= 1 ? 'glide' : 'fade');

/** Touch snap points as scroll progress: the top, every stop's middle, the bottom. */
export function snapStops(track: Track): number[] {
  return STOP_IDS.map((_, i) => (i === 0 ? 0 : i === STOP_IDS.length - 1 ? 1 : stopCentre(track, i) / track.total));
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export interface Jumps {
  go(index: number): Promise<void>;
  /** Jump with no fade (a link opened on load). */
  goNow(index: number): void;
  /** Resolves when a stop is ready to show (its sky loaded); set once the world exists. */
  ready: (index: number) => Promise<void>;
}

export function createJumps(scroll: ScrollController, track: Track, setVeil: (opacity: number) => void): Jumps {
  const at = (index: number) => stopCentre(track, index) / track.total;
  const jumps: Jumps = {
    ready: () => Promise.resolve(),
    goNow(index) {
      scroll.scrollToProgress(at(index), true);
    },
    async go(index) {
      const from = nearestStop(track, scroll.progress() * track.total);
      if (jumpPlan(from, index) === 'glide') {
        scroll.glideToProgress(at(index), true);
        return;
      }
      setVeil(1);
      await wait(400);
      scroll.scrollToProgress(at(index), true);
      await Promise.race([jumps.ready(index), wait(500)]);
      setVeil(0);
    },
  };
  return jumps;
}
