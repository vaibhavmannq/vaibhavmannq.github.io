/**
 * Where the water has been stirred (plan M4 Task 1; reference book §6; owner `plankton` 2–6): the pointer's trail and a
 * wading visitor's feet. Pure state: a ring of STIR_N points the plankton's shader reads as one uniform array.
 * Each point is (x, z, time laid in seconds, strength), three.js axes on the water plane (y = 0).
 * Sea sparkle flashes where water is sheared, and a cell stirred again at once is dimmer: it tires and recovers when
 * left alone (book §6, [search]). How long it takes to recover is not in the sources; 4 s is my call.
 */
export const STIR_N = 24;
/** A trail, not a pile: a new point only once the last is this far behind (metres). */
export const STIR_SPACING = 0.35;
/** Water this close to an earlier point, stirred again within RECOVER_S, is tired. */
const TIRED_RADIUS = 0.5;
const RECOVER_S = 4;
const TIRED = 0.4;
/** The points just laid are the same stroke, not the water stirred again. */
const SAME_STROKE = 3;

export interface Stirs {
  data: Float32Array;
  next: number;
  last: [number, number] | null;
}

export function createStirs(): Stirs {
  // laid at -1e4 s with strength 0: long dead
  const data = new Float32Array(STIR_N * 4);
  for (let i = 0; i < STIR_N; i++) data[i * 4 + 2] = -1e4;
  return { data, next: 0, last: null };
}

/**
 * Stir the water at (x, z) at time `now` (seconds). Returns whether a point was laid. `spacing` grows with distance
 * from the eye (boot.ts), so a sweep far out keeps its whole trail in the ring.
 */
export function stir(s: Stirs, x: number, z: number, now: number, strength = 1, spacing = STIR_SPACING): boolean {
  if (s.last && Math.hypot(x - s.last[0], z - s.last[1]) < spacing) return false;
  let k = 1;
  for (let back = SAME_STROKE + 1; back <= STIR_N; back++) {
    const i = (s.next - back + STIR_N * 2) % STIR_N;
    const age = now - (s.data[i * 4 + 2] as number);
    if ((s.data[i * 4 + 3] as number) <= 0 || age > RECOVER_S || age < 0) continue;
    if (Math.hypot(x - (s.data[i * 4] as number), z - (s.data[i * 4 + 1] as number)) < TIRED_RADIUS) {
      k = TIRED;
      break;
    }
  }
  s.data.set([x, z, now, strength * k], s.next * 4);
  s.next = (s.next + 1) % STIR_N;
  s.last = [x, z];
  return true;
}

/** Pure: where a ray from `eye` along `dir` (three.js axes) meets the water (y = 0), as (x, z); null past `maxM`. */
export function waterHit(
  eye: readonly [number, number, number],
  dir: readonly [number, number, number],
  maxM = 60,
): [number, number] | null {
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const dy = dir[1] / len;
  if (dy > -0.005) return null;
  const t = -eye[1] / dy;
  if (t <= 0 || t > maxM) return null;
  return [eye[0] + (dir[0] / len) * t, eye[2] + (dir[2] / len) * t];
}
