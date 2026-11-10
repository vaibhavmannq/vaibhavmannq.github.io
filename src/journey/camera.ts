import { lerp, smootherstep, smoothstep } from '../shared/math';
import type { FlightPath } from './flights';
import { sampleFlight } from './flights';
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
function drift(timeS: number): Vec3 {
  return [0.03 * Math.sin(0.21 * timeS), 0.03 * Math.sin(0.17 * timeS + 1), 0.02 * Math.sin(0.13 * timeS + 2)];
}

export function poseAt(frame: FrameState, paths: readonly FlightPath[], aspect: number, timeS: number): Pose {
  const a = stopAt(frame.a);
  const path = paths[frame.a];
  if (frame.kind === 'stop' || !path) {
    const at = frame.kind === 'stop' || frame.t < 0.5 ? a : stopAt(frame.b);
    const d = drift(timeS);
    const cam: Vec3 = [at.cam[0] + d[0], at.cam[1] + d[1], at.cam[2] + d[2]];
    return {
      position: toThree(cam),
      yaw: at.landscape.yaw,
      pitch: at.landscape.pitch,
      fov: fovFor(at.landscape.lens, aspect),
    };
  }
  const b = stopAt(frame.b);
  const { pos, tangent } = sampleFlight(path.points, smootherstep(frame.t));
  const travelYaw = deg(Math.atan2(tangent[0], tangent[1]));
  const travelPitch = Math.min(10, Math.max(-20, deg(Math.atan2(tangent[2], Math.hypot(tangent[0], tangent[1])))));
  const w1 = smoothstep(0, 0.3, frame.t);
  const w2 = smoothstep(0.7, 1, frame.t);
  const yaw = shortestYaw(shortestYaw(a.landscape.yaw, travelYaw, w1), b.landscape.yaw, w2);
  const pitch = lerp(lerp(a.landscape.pitch, travelPitch, w1), b.landscape.pitch, w2);
  const lens = lerp(a.landscape.lens, b.landscape.lens, smootherstep(frame.t));
  return { position: toThree(pos), yaw, pitch, fov: fovFor(lens, aspect) };
}
