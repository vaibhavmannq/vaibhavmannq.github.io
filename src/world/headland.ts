import type { FlightKey } from '../journey/flights';
import type { StopId } from '../journey/types';

/**
 * The headland's place pack (spec §11.3: rocks live in place packs, loaded in stage B; ruling R15): the arch and the
 * stacks. The manifest counts its files against the per-place budget of the stops below, not the world base.
 * Pure data (no three.js), so tools/world/manifest.ts can read it.
 */
export const HEADLAND_PACK = 'stops/headland/';

/**
 * Where the arch is in play: the stops whose approved renders show it (public/world/stills: Golden, Sunset and Dusk
 * see it far out on the flats, Blue hour stands under it, Sunrise sees it on the horizon), the flights that leave or
 * reach them, and the high glide from the ridge to the cave, which looks over the cove to the flats. Elsewhere it is
 * hidden (tests/unit/arch.test.ts checks every pose on the journey that frames it).
 */
export const ARCH_SEEN_FROM: ReadonlySet<StopId> = new Set<StopId>(['golden', 'sunset', 'dusk', 'bluehour', 'sunrise']);
export const ARCH_SEEN_ON: ReadonlySet<FlightKey> = new Set<FlightKey>([
  'golden>sunset',
  'sunset>dusk',
  'dusk>bluehour',
  'bluehour>night',
  'midnight>beforedawn',
  'firstlight>sunrise',
]);

/**
 * Where the headland stacks are in play (tests/unit/stacks.test.ts checks every pose on the journey that frames them).
 * The same places as the arch: they stand on its line, landward and seaward of it.
 */
export const STACKS_SEEN_FROM: ReadonlySet<StopId> = ARCH_SEEN_FROM;
export const STACKS_SEEN_ON: ReadonlySet<FlightKey> = ARCH_SEEN_ON;
