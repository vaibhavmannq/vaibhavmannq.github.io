import type { FrameState } from '../journey/timeline';
import { STOP_IDS, type StopId } from '../journey/types';

/**
 * The far layer (spec §4.2, D53): what is always drawn, so the whole coast stays in view from high places. Phase 0
 * names today's parts that play that role: the ground, the sea and its dressing, the ranges, the headland's arch and
 * stacks, the cove's cliffs and grove (R211: those two packs feed five and six places, not one).
 */
export const FAR_PARTS: ReadonlySet<string> = new Set([
  'terrain',
  'sea',
  'dressing',
  'peaks',
  'arch',
  'stacks',
  'cliffs',
  'grove',
]);

/**
 * Each place's close-up set: built, compiled and drawn only around its own place, released after (spec §4.2). Phase 0
 * streams Before dawn's cave; the other places' sets are filled in Phase 3. Parts not named here or in FAR_PARTS still
 * load with the base, as before.
 */
export const SET_PARTS: Readonly<Record<StopId, readonly string[]>> = {
  golden: [],
  sunset: [],
  dusk: [],
  bluehour: [],
  night: [],
  midnight: [],
  beforedawn: ['cave', 'vines', 'skylight'],
  firstlight: [],
  sunrise: [],
};

/**
 * Which sets should be in memory this frame. Pure.
 * - At a stop: its own set (a jump lands here unprepared: it is wanted at once) and the one behind it (a visitor may
 *   go back); while resting, the next place's set is fetched ahead.
 * - In flight: both ends; nothing new is fetched while the camera moves.
 */
export function wantedSets(frame: FrameState, resting: boolean): { keep: StopId[]; fetch: StopId | null } {
  const id = (i: number) => STOP_IDS[i];
  if (frame.kind === 'flight') {
    const keep = [id(frame.a), id(frame.b)].filter((s): s is StopId => s !== undefined);
    return { keep, fetch: null };
  }
  const keep = [id(frame.a), id(frame.a - 1)].filter((s): s is StopId => s !== undefined);
  return { keep, fetch: resting ? (id(frame.a + 1) ?? null) : null };
}
