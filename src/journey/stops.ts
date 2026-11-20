import { WALKS, walkStart } from './flights';
import { SHOTS } from './shots';
import { STOP_IDS, type Stop, type StopId } from './types';

/**
 * Portrait turns (plan M8 Task 4): a phone held upright sees ~36° across, so a subject more than ~15° off the landscape
 * gaze leaves the frame. Each turn brings the subject about a third in: Golden's lantern (15° left), Sunset's lone tree
 * (23° right), Night's falls (17° right), Midnight's tree (25° left), Sunrise's grove and arch (right).
 */
const PORTRAIT_YAW: Partial<Record<StopId, number>> = { golden: -7, sunset: 15, night: 9, midnight: -17, sunrise: 8 };

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
  const walk = WALKS[id];
  const cam: [number, number, number] = [shot.cam[0], shot.cam[1], shot.eyeZ];
  return {
    ...(walk ? { walkFrom: walkStart(cam, shot.look[0], walk.depth) } : {}),
    id,
    numeral,
    hour,
    place,
    cam,
    landscape: { yaw: shot.look[0], pitch: shot.look[1], lens: shot.lens },
    portraitYaw: PORTRAIT_YAW[id] ?? 0,
  };
});

export const stopIndex = (id: string): number => STOP_IDS.indexOf(id as StopId);
