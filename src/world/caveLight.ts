/**
 * The light that comes into the cave through its mouth (plan M7 Task 3; owner cave 2, 3, 5: rock near the mouth is lit
 * and every crack reads; only far corners go dark). The mouth is an opening onto the dawn sky: what a point receives is
 * the sky's radiance times the opening's form factor seen from it (Σ cosθ_point · cosθ_opening · dA / π d²). A wall just
 * inside the mouth sees half its sky through the opening and is bright; cave.bin's Blender bake lit the cave with a flat
 * area light at the mouth, which leaves those walls almost black (grazing). Pure, run once at load.
 */

/** The opening as patches: x, y, z, then the area-weighted normal (its length is the patch's area). */
export function aperturePatches(
  position: Float32Array,
  open: Float32Array,
  index: Uint16Array | Uint32Array,
  cell = 1.2,
): Float32Array {
  const bins = new Map<string, number[]>();
  for (let t = 0; t < index.length; t += 3) {
    const i0 = index[t] ?? 0;
    const i1 = index[t + 1] ?? 0;
    const i2 = index[t + 2] ?? 0;
    if ((open[i0] ?? -1) + (open[i1] ?? -1) + (open[i2] ?? -1) <= 0) continue;
    const p = (i: number, k: number) => position[i * 3 + k] ?? 0;
    const ux = p(i1, 0) - p(i0, 0);
    const uy = p(i1, 1) - p(i0, 1);
    const uz = p(i1, 2) - p(i0, 2);
    const vx = p(i2, 0) - p(i0, 0);
    const vy = p(i2, 1) - p(i0, 1);
    const vz = p(i2, 2) - p(i0, 2);
    const nx = (uy * vz - uz * vy) / 2;
    const ny = (uz * vx - ux * vz) / 2;
    const nz = (ux * vy - uy * vx) / 2;
    const cx = (p(i0, 0) + p(i1, 0) + p(i2, 0)) / 3;
    const cy = (p(i0, 1) + p(i1, 1) + p(i2, 1)) / 3;
    const cz = (p(i0, 2) + p(i1, 2) + p(i2, 2)) / 3;
    const key = `${Math.round(cx / cell)},${Math.round(cy / cell)},${Math.round(cz / cell)}`;
    const b = bins.get(key) ?? [0, 0, 0, 0, 0, 0, 0];
    const a = Math.hypot(nx, ny, nz);
    // the opening's sides all face the same way (into the cave): orient each triangle toward the bin's first one
    const flip = b[6] && b[3]! * nx + b[4]! * ny + b[5]! * nz < 0 ? -1 : 1;
    b[0]! += cx * a;
    b[1]! += cy * a;
    b[2]! += cz * a;
    b[3]! += nx * flip;
    b[4]! += ny * flip;
    b[5]! += nz * flip;
    b[6]! += a;
    bins.set(key, b);
  }
  const out: number[] = [];
  for (const b of bins.values()) {
    const a = b[6] ?? 0;
    if (a <= 0) continue;
    out.push((b[0] ?? 0) / a, (b[1] ?? 0) / a, (b[2] ?? 0) / a, b[3] ?? 0, b[4] ?? 0, b[5] ?? 0);
  }
  return new Float32Array(out);
}

/**
 * The opening as one flat ellipse (plan M7 Task 4: the pool mirrors it from wherever the eye is): its middle `c`, the
 * way it faces `n` (unit, into the cave), and its half sizes across `a` (along the horizontal `u`) and up `b` (along
 * `v`), from the patches' area-weighted second moments (a uniform ellipse's variance is half-size² / 4). Pure.
 */
export function apertureEllipse(patches: Float32Array) {
  let area = 0;
  const c = [0, 0, 0];
  const n = [0, 0, 0];
  for (let k = 0; k < patches.length; k += 6) {
    const a = Math.hypot(patches[k + 3] ?? 0, patches[k + 4] ?? 0, patches[k + 5] ?? 0);
    area += a;
    for (let j = 0; j < 3; j++) {
      c[j]! += (patches[k + j] ?? 0) * a;
      n[j]! += Math.abs(patches[k + 3 + j] ?? 0) * (j === 2 ? 0 : 1) * Math.sign(patches[k + 3 + j] ?? 0);
    }
  }
  for (let j = 0; j < 3; j++) c[j]! /= area || 1;
  // the opening faces the cave's middle (cave-local origin, raised): flip n toward it
  const toMid = [-(c[0] ?? 0), -(c[1] ?? 0), 0];
  let nl = Math.hypot(n[0] ?? 0, n[1] ?? 0) || 1;
  let nx = (n[0] ?? 0) / nl;
  let ny = (n[1] ?? 0) / nl;
  if (nx * (toMid[0] ?? 0) + ny * (toMid[1] ?? 0) < 0) {
    nx = -nx;
    ny = -ny;
  }
  nl = 1;
  const u = [-ny, nx, 0];
  const v = [0, 0, 1];
  let su = 0;
  let sv = 0;
  for (let k = 0; k < patches.length; k += 6) {
    const a = Math.hypot(patches[k + 3] ?? 0, patches[k + 4] ?? 0, patches[k + 5] ?? 0);
    const dx = (patches[k] ?? 0) - (c[0] ?? 0);
    const dy = (patches[k + 1] ?? 0) - (c[1] ?? 0);
    const dz = (patches[k + 2] ?? 0) - (c[2] ?? 0);
    su += (dx * (u[0] ?? 0) + dy * (u[1] ?? 0)) ** 2 * a;
    sv += dz ** 2 * a;
  }
  return {
    c: c as [number, number, number],
    n: [nx, ny, 0] as [number, number, number],
    u: u as [number, number, number],
    v: v as [number, number, number],
    a: 2 * Math.sqrt(su / (area || 1)),
    b: 2 * Math.sqrt(sv / (area || 1)),
  };
}

/**
 * The opening's form factor at each vertex (0..1): Σ |n·d| |m·d| A / π d², the vertex's normal `n` taken either way
 * (the shell is drawn from both sides), `visible` (default 1) for anything between the vertex and a patch (the passage's
 * junction). A patch nearer than its own size counts as if at that size (no blow-up at the rim). Pure.
 */
export function formFactor(
  position: Float32Array,
  normal: Float32Array,
  patches: Float32Array,
  visible: (i: number, px: number, py: number, pz: number) => number = () => 1,
): Float32Array {
  const n = position.length / 3;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = position[i * 3] ?? 0;
    const y = position[i * 3 + 1] ?? 0;
    const z = position[i * 3 + 2] ?? 0;
    const nx = normal[i * 3] ?? 0;
    const ny = normal[i * 3 + 1] ?? 0;
    const nz = normal[i * 3 + 2] ?? 0;
    let sum = 0;
    for (let k = 0; k < patches.length; k += 6) {
      const dx = (patches[k] ?? 0) - x;
      const dy = (patches[k + 1] ?? 0) - y;
      const dz = (patches[k + 2] ?? 0) - z;
      const ax = patches[k + 3] ?? 0;
      const ay = patches[k + 4] ?? 0;
      const az = patches[k + 5] ?? 0;
      const area = Math.hypot(ax, ay, az);
      const d2 = Math.max(dx * dx + dy * dy + dz * dz, area);
      const d = Math.sqrt(d2);
      const cosP = Math.abs(nx * dx + ny * dy + nz * dz) / d;
      const cosM = Math.abs(ax * dx + ay * dy + az * dz) / (d * (area || 1));
      if (cosP * cosM <= 0) continue;
      const v = visible(i, patches[k] ?? 0, patches[k + 1] ?? 0, patches[k + 2] ?? 0);
      sum += (cosP * cosM * area * v) / (Math.PI * d2);
    }
    out[i] = Math.min(1, sum);
  }
  return out;
}
