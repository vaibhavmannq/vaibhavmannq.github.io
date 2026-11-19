import { mulberry32 } from '../shared/random';

/**
 * Scrub caps on the stacks and the arch (plan M4 Task 3; reference book §8, §9; owner `cove-and-stacks` 6, 8, 12;
 * research/m4-blue-hour-references.md). The render's rule (coast.py `build_caps`): the searsia shrub, scale 1.6–3.2,
 * on faces that look up (normal within 53° of up) high on each rock, never on a sheer face. Plants only on the tops.
 * Pure: placed in the browser from the rock meshes the headland pack already holds, so caps cost no download.
 */
export const CAP_MODEL = 3; // grove.bin's searsia_burchellii
/** Faces this much higher than the rock's own top within CAP_NEAR metres are not a top. */
export const CAP_BELOW_TOP = 4;
const CAP_NEAR = 8;
/** No cap lower than this over the sea: the shelves and fallen blocks stay bare. */
export const CAP_MIN_Z = 8;
/** About one shrub per 12 m² of top, none closer than 1.9 m to the next (the render: 14 on a 6 m top). */
const PER_M2 = 0.085;
const SPACING = 1.9;

/**
 * Pure: shrubs on the tops of one rock part (coast axes, z up, positions relative to `at`). Returns grove instances,
 * 10 floats each: model, x, y, z (absolute), scale x, y, z, turn x, y, z (grove.ts layout), at most `max`.
 */
export function capInstances(
  position: Float32Array,
  index: ArrayLike<number>,
  at: { x: number; y: number },
  seed: number,
  max = 400,
): Float32Array {
  // the highest rock within CAP_NEAR of each 4 m cell
  const cell = 4;
  const top = new Map<string, number>();
  const key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (let i = 0; i < position.length; i += 3) {
    const k = key(position[i] as number, position[i + 1] as number);
    top.set(k, Math.max(top.get(k) ?? -1e9, position[i + 2] as number));
  }
  const near = CAP_NEAR / cell;
  const localTop = (x: number, y: number) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    let m = -1e9;
    for (let dx = -near; dx <= near; dx++)
      for (let dy = -near; dy <= near; dy++) m = Math.max(m, top.get(`${cx + dx},${cy + dy}`) ?? -1e9);
    return m;
  };
  // up-facing faces near their rock's top, with their area
  const faces: { a: number; b: number; c: number; area: number }[] = [];
  let total = 0;
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = index[t] as number;
    const b = index[t + 1] as number;
    const c = index[t + 2] as number;
    const ux = (position[b * 3] as number) - (position[a * 3] as number);
    const uy = (position[b * 3 + 1] as number) - (position[a * 3 + 1] as number);
    const uz = (position[b * 3 + 2] as number) - (position[a * 3 + 2] as number);
    const vx = (position[c * 3] as number) - (position[a * 3] as number);
    const vy = (position[c * 3 + 1] as number) - (position[a * 3 + 1] as number);
    const vz = (position[c * 3 + 2] as number) - (position[a * 3 + 2] as number);
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) continue;
    // the arch's faces may wind either way: |n| (coast.py's rule)
    if (Math.abs(nz) / len < 0.6) continue;
    const zc =
      ((position[a * 3 + 2] as number) + (position[b * 3 + 2] as number) + (position[c * 3 + 2] as number)) / 3;
    if (zc < CAP_MIN_Z) continue;
    const xc = ((position[a * 3] as number) + (position[b * 3] as number) + (position[c * 3] as number)) / 3;
    const yc =
      ((position[a * 3 + 1] as number) + (position[b * 3 + 1] as number) + (position[c * 3 + 1] as number)) / 3;
    if (zc < localTop(xc, yc) - CAP_BELOW_TOP) continue;
    // the underside of the arch's span faces down with |n| up: keep only faces with open sky above
    if (nz < 0 && zc < localTop(xc, yc) - 0.5) continue;
    const area = len / 2;
    faces.push({ a, b, c, area });
    total += area;
  }
  const r = mulberry32(seed);
  const want = Math.min(max, Math.round(total * PER_M2));
  const out: number[] = [];
  const placed: [number, number][] = [];
  const cum: number[] = [];
  let acc = 0;
  for (const f of faces) {
    acc += f.area;
    cum.push(acc);
  }
  for (let tries = 0; tries < want * 8 && placed.length < want; tries++) {
    const pick = r() * acc;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((cum[mid] as number) < pick) lo = mid + 1;
      else hi = mid;
    }
    const f = faces[lo];
    if (!f) break;
    let u = r();
    let v = r();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;
    const p = (i: number) =>
      (position[f.a * 3 + i] as number) * w +
      (position[f.b * 3 + i] as number) * u +
      (position[f.c * 3 + i] as number) * v;
    const x = p(0) + at.x;
    const y = p(1) + at.y;
    if (placed.some(([px, py]) => Math.hypot(px - x, py - y) < SPACING)) continue;
    placed.push([x, y]);
    const s = 1.6 + r() * 1.6;
    // a little lean, every way, and any turn: no two alike
    out.push(
      CAP_MODEL,
      x,
      y,
      p(2),
      s,
      s,
      s * (0.75 + r() * 0.35),
      (r() - 0.5) * 0.16,
      (r() - 0.5) * 0.16,
      r() * 2 * Math.PI,
    );
  }
  return Float32Array.from(out);
}
