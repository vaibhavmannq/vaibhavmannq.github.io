import { mulberry32 } from '../shared/random';
import type { HeightAt } from './heights';
import { coastFbm } from './scatter';

/**
 * The passage behind the cave's chamber (plan M7 Task 1; research m7 "the deeper start"; Fingal's Cave): Before dawn's
 * stop starts in it and walks out toward the mouth. A tunnel along the stop's view reversed, made here (no download):
 * walls of vertical basalt columns (each column two flat faces, so the mouth's grazing light picks out every one),
 * their tops lost in a rough vault (Fingal's colonnade under its entablature), a floor of wet rock. Its front follows
 * the chamber's back wall, where the shell is opened (`openShell`); its roof stays under the live hill.
 *
 * Everything is in cave-local coast axes (x east, y north, z up; origin on the floor under the chamber's centre),
 * as cave.bin is.
 */

/** How far behind the stop's camera the passage reaches, metres, and where the stop's walk starts (plan M7 Task 2). */
export const PASSAGE_END = 19;
export const WALK_DEPTH = 14;
/** The junction: the passage's front profile, where the chamber's back wall is opened. */
const JUNCTION_H = 3.0;
const VAULT_H = 5.0;
const HALF_W = 2.6;

export interface PassageSite {
  /** The stop's camera, cave-local (x, y). */
  cam: { x: number; y: number };
  /** The stop's view yaw (coast degrees); the passage runs the other way. */
  yaw: number;
  /** The mouth's middle, cave-local, and the direction it faces (into the cave). */
  mouth: { x: number; y: number; z: number };
  /** The chamber's centre (cave-local x, y) and the terrain's cut around it (rx, ry), so the roof test knows where the
   * hill is open. */
  cut: { rx: number; ry: number };
}

export interface PassageData {
  position: Float32Array;
  /** 1 on the floor's faces, 0 on the walls and the vault. */
  floor: Float32Array;
  /** 1 where a vertex was moved back onto the chamber's wall (the junction's collar): kept dark, it is never lit face-on */
  pushed: Float32Array;
  index: Uint32Array;
}

/** Basis of the passage: `d` into it, `r` to the right of the stop's view. */
export function passageFrame(site: PassageSite) {
  const a = (site.yaw * Math.PI) / 180;
  const f: [number, number] = [Math.sin(a), Math.cos(a)];
  const d: [number, number] = [-f[0], -f[1]];
  const r: [number, number] = [Math.cos(a), -Math.sin(a)];
  const at = (s: number, l: number): [number, number] => [
    site.cam.x + d[0] * s + r[0] * l,
    site.cam.y + d[1] * s + r[1] * l,
  ];
  const along = (x: number, y: number) => (x - site.cam.x) * d[0] + (y - site.cam.y) * d[1];
  const lateral = (x: number, y: number) => (x - site.cam.x) * r[0] + (y - site.cam.y) * r[1];
  return { d, r, at, along, lateral };
}

/** The opening's top at lateral `l` (the junction's profile): columns to 2 m, then an arch to JUNCTION_H. */
export function junctionTop(l: number): number {
  const k = Math.min(1, Math.abs(l) / HALF_W);
  return 1.9 + (JUNCTION_H - 1.9) * Math.sqrt(Math.max(0, 1 - k * k));
}

/**
 * The chamber's back wall, as seen from the stop's camera: for a lateral `l` and height `z`, how far behind the camera
 * the shell's inner surface is (the nearest shell vertex in that direction). Built from cave.bin's shell. Pure.
 */
export function shellSampler(shell: Float32Array, site: PassageSite) {
  const { along, lateral } = passageFrame(site);
  const cell = 0.3;
  const bins = new Map<string, number>();
  for (let i = 0; i < shell.length; i += 3) {
    const x = shell[i] ?? 0;
    const y = shell[i + 1] ?? 0;
    const z = shell[i + 2] ?? 0;
    const s = along(x, y);
    if (s < 0.3) continue;
    const key = `${Math.round(lateral(x, y) / cell)},${Math.round(z / cell)}`;
    bins.set(key, Math.min(bins.get(key) ?? Number.POSITIVE_INFINITY, s));
  }
  return (l: number, z: number): number => {
    const bl = Math.round(l / cell);
    const bz = Math.round(z / cell);
    let best = Number.POSITIVE_INFINITY;
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) best = Math.min(best, bins.get(`${bl + i},${bz + j}`) ?? Number.POSITIVE_INFINITY);
    return Number.isFinite(best) ? best : 6;
  };
}

/**
 * Opens the chamber's back wall where the passage meets it: raises cave.bin's `open` (the mouth's own cut, > 0 is cut)
 * inside the junction's profile, shrunk by `inset` so the passage's front, which follows the wall, is hidden behind
 * the cut's edge. Returns a new array. Pure.
 */
export function openShell(shell: Float32Array, open: Float32Array, site: PassageSite, inset = 0.3): Float32Array {
  const { along, lateral } = passageFrame(site);
  const out = Float32Array.from(open);
  for (let i = 0; i < out.length; i++) {
    const x = shell[i * 3] ?? 0;
    const y = shell[i * 3 + 1] ?? 0;
    const z = shell[i * 3 + 2] ?? 0;
    if (along(x, y) < 0.5) continue;
    const l = lateral(x, y);
    const sd = Math.min(HALF_W - inset - Math.abs(l), junctionTop(l) - inset - z, z + 1.5);
    out[i] = Math.max(out[i] ?? -2, Math.min(0.6, Math.max(-2, sd * 2)));
  }
  return out;
}

interface Column {
  s0: number;
  s1: number;
  /** column tops on the left and right walls */
  topL: number;
  topR: number;
}

/** Columns along the passage: 0.6–0.95 m wide, tops 1.7–2.9 m (Fingal's, Svartifoss: joints 0.5–1 m apart). Pure. */
export function passageColumns(from: number, to: number, seed = 707): Column[] {
  const rnd = mulberry32(seed);
  const out: Column[] = [];
  for (let s = from; s < to; ) {
    const w = 0.6 + rnd() * 0.35;
    out.push({ s0: s, s1: s + w, topL: 1.7 + rnd() * 1.2, topR: 1.7 + rnd() * 1.2 });
    s += w;
  }
  return out;
}

/**
 * The passage's mesh, every face its own four vertices so each column face is lit flat. `ground` is the live surface
 * (absolute heights, coast x, y) and `floorZ` the cave's floor level: the roof keeps 0.7 m under the hill wherever the
 * terrain is not cut open around the chamber. Pure.
 */
export function buildPassage(
  site: PassageSite,
  wallAt: (l: number, z: number) => number,
  ground: HeightAt,
  floorZ: number,
  caveXY: { x: number; y: number },
): PassageData {
  const { at, along, lateral } = passageFrame(site);
  const pos: number[] = [];
  const floorFlag: number[] = [];
  const pushedFlag: number[] = [];
  const idx: number[] = [];
  const cols = passageColumns(0.4, PASSAGE_END);
  const rough = (s: number, k: number) => coastFbm(s * 0.9 + 3.1, k * 1.7 + 11.3, 3) - 0.5;
  // the roof's cap from the hill above, metres over the cave's floor
  const capAt = (s: number, l: number) => {
    const [x, y] = at(s, l);
    const open = ((x - 0) / site.cut.rx) ** 2 + ((y - 0) / site.cut.ry) ** 2 < 1;
    return open ? VAULT_H : ground(x + caveXY.x, y + caveXY.y) - floorZ - 0.7;
  };
  const vaultTop = (s: number) => {
    const design = Math.min(VAULT_H, JUNCTION_H + 0.55 * Math.max(0, s - 2.5));
    return Math.min(design, capAt(s, 0), capAt(s, HALF_W), capAt(s, -HALF_W));
  };
  const halfW = (s: number) => HALF_W + 0.35 * rough(s, 1);
  // a point on the profile: walls at |l| = w (ridge or groove), floor at z ~ 0, vault above `spring`
  const quad = (a: number[], b: number[], c: number[], e: number[], onFloor: boolean) => {
    // the front follows the chamber's wall: no vertex in front of it
    const fix = (p: number[]) => {
      const [x, y] = [p[0] ?? 0, p[1] ?? 0];
      const s = along(x, y);
      const l = lateral(x, y);
      const wall = wallAt(l, p[2] ?? 0) + 0.15;
      if (s >= wall) {
        pushedFlag.push(0);
        return p;
      }
      pushedFlag.push(1);
      const [nx, ny] = at(wall, l);
      return [nx, ny, p[2] ?? 0];
    };
    const base = pos.length / 3;
    for (const p of [a, b, c, e]) pos.push(...fix(p));
    for (let k = 0; k < 4; k++) floorFlag.push(onFloor ? 1 : 0);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const P = (s: number, l: number, z: number): number[] => [...at(s, l), z];
  const VAULT_N = 7;
  for (const c of cols) {
    const sm = (c.s0 + c.s1) / 2;
    for (const side of [-1, 1] as const) {
      const top = side < 0 ? c.topL : c.topR;
      const spring = Math.min(top, vaultTop(sm) - 0.6);
      // groove, ridge, groove: two flat faces, one toward the mouth and one away (Fingal's grazing light)
      const g0 = side * (halfW(c.s0) + 0.04);
      const rg = side * (halfW(sm) - 0.16);
      const g1 = side * (halfW(c.s1) + 0.04);
      const w = (a: number[], b: number[], cc: number[], e: number[]) =>
        side < 0 ? quad(a, b, cc, e, false) : quad(e, cc, b, a, false);
      w(P(c.s0, g0, -0.1), P(sm, rg, -0.1), P(sm, rg, spring), P(c.s0, g0, spring));
      w(P(sm, rg, -0.1), P(c.s1, g1, -0.1), P(c.s1, g1, spring), P(sm, rg, spring));
    }
  }
  // the vault: from each wall's spring line up to the top, rough (the entablature's chaotic joints)
  const stations: number[] = [];
  for (let s = 0.4; s <= PASSAGE_END + 1e-6; s += 0.45) stations.push(s);
  const vaultPoint = (s: number, k: number): number[] => {
    // k = 0 left spring .. VAULT_N right spring
    const t = k / VAULT_N;
    const ang = Math.PI * (1 - t);
    const w = halfW(s);
    const spring = Math.min(2.1 + 0.4 * rough(s, 5), vaultTop(s) - 0.6);
    const lift = vaultTop(s) - spring;
    const bump = k === 0 || k === VAULT_N ? 0 : 0.28 * rough(s * 2.2, k * 3.1);
    const l = Math.cos(ang) * (w + 0.05) * (1 - Math.abs(bump) * 0.3);
    const z = spring + Math.sin(ang) * lift - Math.max(0, bump) * 0.8 + Math.min(0, bump) * 0.3;
    return P(s, l, z);
  };
  for (let i = 0; i + 1 < stations.length; i++) {
    const s0 = stations[i] ?? 0;
    const s1 = stations[i + 1] ?? 0;
    for (let k = 0; k < VAULT_N; k++)
      quad(vaultPoint(s0, k), vaultPoint(s1, k), vaultPoint(s1, k + 1), vaultPoint(s0, k + 1), false);
  }
  // the floor: wet rock, a little uneven, a hand's breadth under the chamber's (which covers it where both are)
  const FLOOR_N = 6;
  const floorPoint = (s: number, k: number): number[] => {
    const l = (k / FLOOR_N - 0.5) * 2 * (halfW(s) + 0.12);
    return P(s, l, -0.06 + 0.1 * rough(s * 1.7, k * 2.3 + 40));
  };
  for (let i = 0; i + 1 < stations.length; i++) {
    const s0 = stations[i] ?? 0;
    const s1 = stations[i + 1] ?? 0;
    for (let k = 0; k < FLOOR_N; k++)
      quad(floorPoint(s0, k), floorPoint(s0, k + 1), floorPoint(s1, k + 1), floorPoint(s1, k), true);
  }
  // the end: a rough wall closing the passage
  const end = stations[stations.length - 1] ?? PASSAGE_END;
  for (let k = 0; k < VAULT_N; k++) {
    const a = vaultPoint(end, k);
    const b = vaultPoint(end, k + 1);
    const lo = (p: number[]): number[] => [p[0] ?? 0, p[1] ?? 0, -0.1];
    quad(lo(a), a, b, lo(b), false);
  }

  const position = new Float32Array(pos);
  const index = new Uint32Array(idx);
  return { position, floor: new Float32Array(floorFlag), pushed: new Float32Array(pushedFlag), index };
}

/**
 * How much of the line from a passage vertex (p) to a point of the mouth (q) passes the junction's opening, 0..1, with a
 * soft 0.5 m edge (caveLight.ts `formFactor`): the passage sees the mouth only through it. Pure.
 */
export function junctionVisible(site: PassageSite) {
  const { along, lateral } = passageFrame(site);
  const J = 2.6;
  return (px: number, py: number, pz: number, qx: number, qy: number, qz: number): number => {
    const s = along(px, py);
    const s1 = along(qx, qy);
    if (s <= J || s1 >= J) return 1;
    const k = (s - J) / (s - s1);
    const lp = lateral(px, py);
    const l = lp + (lateral(qx, qy) - lp) * k;
    const z = pz + (qz - pz) * k;
    const edge = Math.min(HALF_W - Math.abs(l), junctionTop(l) - z, z + 0.2);
    return Math.min(1, Math.max(0, edge / 0.5 + 0.5));
  };
}

/** The passage's site from the shots: the stop's camera and the mouth, cave-local; the terrain's cut (boot.ts). */
export function passageSite(
  cave: { x: number; y: number; az: number; centreZ: number; floor: number },
  stop: { cam: readonly number[]; look: readonly number[] },
): PassageSite {
  const a = (cave.az * Math.PI) / 180;
  return {
    cam: { x: (stop.cam[0] ?? 0) - cave.x, y: (stop.cam[1] ?? 0) - cave.y },
    yaw: stop.look[0] ?? 0,
    mouth: { x: 10 * Math.sin(a), y: 10 * Math.cos(a), z: cave.centreZ - cave.floor + 1.9 },
    cut: { rx: 12.2, ry: 10.2 },
  };
}
