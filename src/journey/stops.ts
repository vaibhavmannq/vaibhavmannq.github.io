import { WALKS, walkStart } from './flights';
import { OLD_CAMS_ON, SHOTS } from './shots';
import { STOP_IDS, type Stop, type StopId } from './types';

/** Placeholder labels until the site's text is written (spec §16). */
const LABELS: Record<StopId, [string, string, string]> = {
  golden: ['I', 'Golden hour', 'The beach'],
  sunset: ['II', 'Sunset', 'The clifftop meadow'],
  dusk: ['III', 'Dusk', 'The headland'],
  bluehour: ['IV', 'Blue hour', 'The arch flats'],
  night: ['V', 'Night', 'The lagoon'],
  midnight: ['VI', 'Deep midnight', 'The ridge'],
  beforedawn: ['VII', 'Before dawn', 'The cave'],
  firstlight: ['VIII', 'First light', 'The far end of the beach'],
  sunrise: ['IX', 'Sunrise', 'The rise'],
};

/** The nine stops, at the render cameras (spec §5). */
export const STOPS: readonly Stop[] = STOP_IDS.map((id) => {
  const shot = SHOTS[id];
  const [numeral, hour, place] = LABELS[id];
  const walk = OLD_CAMS_ON ? undefined : WALKS[id];
  const cam: [number, number, number] = [shot.cam[0], shot.cam[1], shot.eyeZ];
  return {
    ...(walk ? { walkFrom: walkStart(cam, shot.look[0], walk.depth) } : {}),
    id,
    numeral,
    hour,
    place,
    cam,
    landscape: { yaw: shot.look[0], pitch: shot.look[1], lens: shot.lens },
  };
});

export const stopIndex = (id: string): number => STOP_IDS.indexOf(id as StopId);
