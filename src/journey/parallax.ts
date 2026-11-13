import { smoothstep } from '../shared/math';
import type { FrameState } from './timeline';
import type { Vec3 } from './types';

/**
 * Pointer parallax (D28; owner-references §1, from the owner's motion video): the view answers the pointer at once.
 * The camera slides sideways and keeps its direction, so the sky and far land stay put and near things move; with
 * the pointer at the screen's edge the nearest thing in view slides this share of the screen width. Pure.
 */
export const PARALLAX_SHARE = 0.03;
/** Up and down moves this much of the sideways amount. */
export const PARALLAX_VERTICAL = 0.5;
/** How fast the camera answers: the share of the gap closed per second is 1 - e^(-rate) (about 0.15 s). */
export const PARALLAX_RATE = 7;
const NEAR_MIN = 2;
const NEAR_MAX = 60;
/** The slide never exceeds this: things the ground rays cannot see (trees, rocks) must not swing across the view. */
export const MAX_SLIDE_M = 0.6;

const rad = (d: number) => (d * Math.PI) / 180;
const tanHalfH = (vfovDeg: number, aspect: number) => Math.tan(rad(vfovDeg) / 2) * aspect;

/** The camera's slide [right, up] in metres for a pointer at (x, y), each -1..1 (y up). */
export function parallaxOffset(
  pointer: readonly [number, number],
  nearM: number,
  vfovDeg: number,
  aspect: number,
): [number, number] {
  // a point at distance d moves T / (2 d tan(hfov/2)) of the screen width for a slide T
  const full = Math.min(MAX_SLIDE_M, PARALLAX_SHARE * 2 * nearM * tanHalfH(vfovDeg, aspect));
  return [full * pointer[0], full * PARALLAX_VERTICAL * pointer[1]];
}

/** Share of the screen width a thing at `distanceM` moves for a sideways slide of `slideM` (for the tests). */
export const shiftShare = (slideM: number, distanceM: number, vfovDeg: number, aspect: number): number =>
  Math.abs(slideM) / (2 * distanceM * tanHalfH(vfovDeg, aspect));

/** Full at a stop, fading out as a flight leaves it and in as the next one arrives. */
export const parallaxWeight = (frame: FrameState): number =>
  frame.kind === 'stop' ? 1 : Math.max(smoothstep(0.15, 0, frame.t), smoothstep(0.85, 1, frame.t));

/** Where the screen points (-1..1) the nearest-thing rays go through: the lower three quarters, side to side. */
const RAYS_X = [-0.9, -0.45, 0, 0.45, 0.9];
const RAYS_Y = [-0.85, -0.45, -0.05, 0.35];

/**
 * Distance to the nearest thing in view: rays through a grid over the lower three quarters of the frame to the ground
 * or the sea, whichever each meets first; the nearest, within 2 to 60 m. Coast axes (z up); yaw 0 = north, positive
 * east. (s09: one ray through the bottom-centre missed Sunrise's cliff at the side.)
 */
export function nearDistance(
  cam: Vec3,
  yawDeg: number,
  pitchDeg: number,
  vfovDeg: number,
  heightAt: (x: number, y: number) => number,
  aspect = 16 / 9,
): number {
  const yaw = rad(yawDeg);
  const pitch = rad(pitchDeg);
  const fwd: Vec3 = [Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch)];
  const right: Vec3 = [Math.cos(yaw), -Math.sin(yaw), 0];
  const up: Vec3 = [-Math.sin(yaw) * Math.sin(pitch), -Math.cos(yaw) * Math.sin(pitch), Math.cos(pitch)];
  const tv = Math.tan(rad(vfovDeg) / 2);
  const th = tv * aspect;
  let nearest = NEAR_MAX;
  for (const sy of RAYS_Y)
    for (const sx of RAYS_X) {
      const dir = [0, 1, 2].map((i) => (fwd[i] ?? 0) + (right[i] ?? 0) * sx * th + (up[i] ?? 0) * sy * tv);
      const len = Math.hypot(dir[0] ?? 0, dir[1] ?? 0, dir[2] ?? 0);
      let d = 0.25;
      while (d < nearest) {
        const k = d / len;
        const z = cam[2] + (dir[2] ?? 0) * k;
        if (z <= Math.max(0, heightAt(cam[0] + (dir[0] ?? 0) * k, cam[1] + (dir[1] ?? 0) * k))) {
          nearest = d;
          break;
        }
        d += Math.max(0.25, d * 0.03);
      }
    }
  return Math.max(NEAR_MIN, nearest);
}
