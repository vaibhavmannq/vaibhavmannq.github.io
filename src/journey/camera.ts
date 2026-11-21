import { lerp, smootherstep, smoothstep } from '../shared/math';
import type { FlightPath } from './flights';
import { lookUpAt, SIDEWAYS, sampleFlight } from './flights';
import { STOPS } from './stops';
import type { FrameState } from './timeline';
import { type Stop, toThree, type Vec3 } from './types';

export interface Pose {
  /** three.js coordinates. */
  position: Vec3;
  /** Coast convention, degrees: yaw 0 = out to sea, positive east; pitch positive up. */
  yaw: number;
  pitch: number;
  /** Vertical field of view, degrees. */
  fov: number;
}

const deg = (r: number) => (r * 180) / Math.PI;

/** The slice's lens-to-field-of-view rule: a lens on 36 mm film; portrait keeps a useful width, capped at 80°. */
export function fovFor(lens: number, aspect: number): number {
  const hfov = 2 * Math.atan(18 / lens);
  if (aspect >= 1) return deg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
  return Math.min(80, deg(2 * Math.atan(Math.tan(hfov / 2) / Math.max(aspect, 0.5))) * 0.62);
}

/** A stop's yaw on a screen of this aspect: its landscape yaw, turned toward its subject as the screen goes portrait. */
export function yawFor(stop: Pick<Stop, 'landscape' | 'portraitYaw'>, aspect: number): number {
  return stop.landscape.yaw + stop.portraitYaw * smoothstep(1, 0.6, aspect);
}

/** Blend two yaws the short way round. */
export function shortestYaw(from: number, to: number, w: number): number {
  const d = ((((to - from) % 360) + 540) % 360) - 180;
  return from + d * w;
}

function stopAt(i: number): Stop {
  const stop = STOPS[i];
  if (!stop) throw new Error(`no stop ${i}`);
  return stop;
}

/** A drift of a few centimetres so a resting camera never looks frozen. */
export function drift(timeS: number): Vec3 {
  return [0.03 * Math.sin(0.21 * timeS), 0.03 * Math.sin(0.17 * timeS + 1), 0.02 * Math.sin(0.13 * timeS + 2)];
}

/** Under reduced motion the camera never flies: it stands at stop a, then at stop b, behind the cross-fade (spec §8.5). */
export function poseAt(
  frame: FrameState,
  paths: readonly FlightPath[],
  aspect: number,
  timeS: number,
  reducedMotion = false,
  /** how far along its walk a walking stop is, 0 (its start) .. 1 (its camera); walk.ts */
  walkS = 1,
): Pose {
  const a = stopAt(frame.a);
  const path = paths[frame.a];
  if (frame.kind === 'stop' || !path || reducedMotion) {
    const at = frame.kind === 'stop' || frame.t < 0.5 ? a : stopAt(frame.b);
    const d = drift(timeS);
    const from = frame.kind === 'stop' && !reducedMotion ? at.walkFrom : undefined;
    const base: Vec3 = from
      ? [lerp(from[0], at.cam[0], walkS), lerp(from[1], at.cam[1], walkS), lerp(from[2], at.cam[2], walkS)]
      : at.cam;
    const cam: Vec3 = [base[0] + d[0], base[1] + d[1], base[2] + d[2]];
    return {
      position: toThree(cam),
      yaw: yawFor(at, aspect),
      pitch: at.landscape.pitch,
      fov: fovFor(at.landscape.lens, aspect),
    };
  }
  const b = stopAt(frame.b);
  const { pos, tangent } = sampleFlight(path.points, smootherstep(frame.t));
  if (SIDEWAYS.has(`${path.from}>${path.to}`)) {
    const w = smootherstep(frame.t);
    return {
      position: toThree(pos),
      yaw: shortestYaw(yawFor(a, aspect), yawFor(b, aspect), w),
      pitch: lerp(a.landscape.pitch, b.landscape.pitch, w),
      fov: fovFor(lerp(a.landscape.lens, b.landscape.lens, w), aspect),
    };
  }
  const travelYaw = deg(Math.atan2(tangent[0], tangent[1]));
  const travelPitch = Math.min(10, Math.max(-20, deg(Math.atan2(tangent[2], Math.hypot(tangent[0], tangent[1])))));
  const w1 = smoothstep(0, 0.3, frame.t);
  const w2 = smoothstep(0.7, 1, frame.t);
  const yaw = shortestYaw(shortestYaw(yawFor(a, aspect), travelYaw, w1), yawFor(b, aspect), w2);
  const pitch =
    lerp(lerp(a.landscape.pitch, travelPitch, w1), b.landscape.pitch, w2) +
    lookUpAt(`${path.from}>${path.to}`, pos[0], pos[1]);
  const lens = lerp(a.landscape.lens, b.landscape.lens, smootherstep(frame.t));
  return { position: toThree(pos), yaw, pitch, fov: fovFor(lens, aspect) };
}
