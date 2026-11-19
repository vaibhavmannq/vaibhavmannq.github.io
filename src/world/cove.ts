import type { FlightKey } from '../journey/flights';
import type { StopId } from '../journey/types';

/**
 * The cove's place pack (plan M3 Task 2; spec §11.3, ruling R15): the cliff columns at Golden and Sunrise and the
 * grove (cliffs.bin, grove.bin; tools/world/blender/export_parts.py export_cove). The manifest counts its files against
 * the cove's five stops. Pure data (no three.js), so tools/world/manifest.ts can read it.
 */
export const COVE_PACK = 'stops/cove/';

/** The five cove places: where the cliffs and the grove are drawn. */
export const COVE_SEEN_FROM: ReadonlySet<StopId> = new Set<StopId>([
  'golden',
  'sunset',
  'dusk',
  'firstlight',
  'sunrise',
]);

/**
 * The flights that draw them: those between cove places, and those that look over the cove on their way (the glide
 * from the ridge down to the cave and the flight out of it; s14: both frame the cove within 400 m). tests/unit/
 * grove.test.ts checks every pose on the journey that frames them; the test of a frame is cliffs.ts `coveInPlay`.
 */
export const COVE_SEEN_ON: ReadonlySet<FlightKey> = new Set<FlightKey>([
  'golden>sunset',
  'sunset>dusk',
  'dusk>bluehour',
  'night>midnight', // M5: over the falls' lip the camera looks north to the coast
  'midnight>beforedawn',
  'beforedawn>firstlight',
  'firstlight>sunrise',
]);

/** Flights that draw them only over part of their length (plan M3 Global Constraints: hidden from the far third on). */
export const COVE_SPAN: Partial<Record<FlightKey, readonly [number, number]>> = { 'dusk>bluehour': [0, 2 / 3] };
