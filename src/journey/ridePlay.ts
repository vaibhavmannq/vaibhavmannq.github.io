import { drift, type Pose, poseAt } from './camera';
import type { FlightPath } from './flights';
import { follow, rideMs } from './pace';
import { frameAt, stopCentre, type Track } from './timeline';

/** One tick of a replayed ride. */
export interface RideSample {
  tS: number;
  /** Where the camera is on the track. */
  u: number;
  pose: Pose;
}

/**
 * Replays what the Next button does (overlay/ride.ts): the scroll runs linearly from stop `from`'s centre to stop
 * `to`'s over `rideMs`, the camera chases it with `follow` every tick, and the pose is `poseAt` of where the camera is.
 * It ends once the scroll has landed and the camera stands in the destination's stop. The resting drift is left out (it would read as a few-centimetre jump where a stop hands over to a flight). Pure.
 */
export function simulateRide(
  track: Track,
  paths: readonly FlightPath[],
  from: number,
  to: number,
  opts: { hz?: number; aspect?: number } = {},
): RideSample[] {
  const hz = opts.hz ?? 120;
  const aspect = opts.aspect ?? 16 / 9;
  const dt = 1 / hz;
  const fromU = stopCentre(track, from);
  const toU = stopCentre(track, to);
  const durS = rideMs(track, fromU, toU) / 1000;
  const out: RideSample[] = [];
  let cam = fromU;
  for (let i = 0; ; i++) {
    const tS = i * dt;
    if (i > 0) {
      const target = fromU + (toU - fromU) * Math.min(1, tS / durS);
      cam = follow(track, cam, target, dt);
    }
    const frame = frameAt(track, cam, false);
    const pose = poseAt(frame, paths, aspect, 0);
    if (frame.kind === 'stop') {
      const d = drift(0);
      pose.position = [pose.position[0] - d[0], pose.position[1] - d[2], pose.position[2] + d[1]];
    }
    out.push({ tS, u: cam, pose });
    // Once the camera is inside the destination's stop it stands still: the ride is over for the eye.
    if ((tS >= durS && frame.kind === 'stop' && frame.a === to) || tS > durS + 10) return out;
  }
}
