import { abs, cameraPosition, exp, max, positionWorld, select, sin, uniform, vec2 } from 'three/tsl';
import { Group, Vector2 } from 'three/webgpu';
import { windVector } from '../journey/hours';
import type { WorldState } from '../journey/types';
import type { WorldPart } from './part';

/**
 * First light's mist (plan M3 Task 3), folded into the scene's one fog so it costs no draw. Reference book §4: radiation
 * fog, a flat-topped layer a metre or two deep, almost still, thinning as the sun arrives; the far shore's tops stand
 * clear. Owner `mist` 8: a band that takes the sky's colour, the mirror below it. The colour is the fog's own (the sky's
 * horizon, D17), so mist and distance are one colour.
 *
 * Ruling R53: three.js' built-in `exponentialHeightFogFactor` was tried first (plan); it fogs a surface by its own depth
 * under the top and ignores the eye, so from First light's eye (0.55 m, inside the layer) it gave a thin bright line at
 * the waterline, not a band. This is the usual closed form instead: density falls as exp(−k·y) over the sea, and the
 * fog is the density integrated along the ray from the eye to the surface.
 */

/** At full mist (First light): the density at the sea, per metre, and the band's top (where it is a tenth of that). */
export const MIST_DENSITY = 0.0135;
export const MIST_TOP = 2.0;
/** The thin rest at Sunrise lies lower: the top falls toward this as the mist thins. */
export const MIST_TOP_THIN = 0.8;
/** Mist hangs (reference book §4: "never streams"; plan: drift ≤ 0.1 m/s). */
export const MIST_DRIFT_MAX = 0.08;

/** Pure: the density at the sea (per metre) and the band's top (metres over the sea) for an amount of mist 0..1. */
export function mistFog(amount: number): { density: number; top: number } {
  const a = Math.min(Math.max(amount, 0), 1);
  return { density: MIST_DENSITY * a, top: MIST_TOP_THIN + (MIST_TOP - MIST_TOP_THIN) * a };
}

/**
 * Pure: how much of a surface the mist hides, 0..1, seen from an eye at height `eyeY`, the surface at height `y` and
 * `dist` metres away. Density ρ(y) = density·exp(−k·y), k = ln 10 / top, nothing under the sea; the integral along the
 * straight ray is density·dist·(e^(−k·y0) − e^(−k·y1)) / (k·(y1 − y0)). The shader below is the same formula.
 */
export function mistAmount(eyeY: number, y: number, dist: number, density: number, top: number): number {
  const k = Math.LN10 / top;
  const y0 = Math.max(eyeY, 0);
  const y1 = Math.max(y, 0);
  const dy = y1 - y0;
  const f = Math.abs(dy) > 0.01 ? (Math.exp(-k * y0) - Math.exp(-k * y1)) / (k * dy) : Math.exp(-k * (y0 + y1) * 0.5);
  return 1 - Math.exp(-density * dist * f);
}

/** Pure: how fast the mist's patches move, m/s in coast axes [x east, y north]: with the wind, capped. */
export function mistDrift(world: Pick<WorldState, 'windAz' | 'beaufort'>): [number, number] {
  const [vx, vy] = windVector(world);
  const s = Math.hypot(vx, vy);
  if (s <= MIST_DRIFT_MAX) return [vx, vy];
  return [(vx / s) * MIST_DRIFT_MAX, (vy / s) * MIST_DRIFT_MAX];
}

/** The mist's fog factor (for the scene's fog node) and the part that moves it each frame. */
export function createMist() {
  const density = uniform(0);
  const k = uniform(Math.LN10 / MIST_TOP);
  const offset = uniform(new Vector2());
  // Patches tens of metres across, so the band is never an even wash (reference book §4 "gives it away"). Cheap:
  // two products of sines, no noise texture; it runs in every material that takes fog.
  const q = vec2(positionWorld.x, positionWorld.z.negate()).sub(offset);
  const patch = sin(q.x.mul(0.11).add(sin(q.y.mul(0.07)).mul(1.7)))
    .mul(sin(q.y.mul(0.09).add(sin(q.x.mul(0.05)).mul(1.3))))
    .mul(0.3)
    .add(0.85);
  // mistAmount(), on the GPU. In the mirror pass the eye is under the sea; clamped to the sea it still crosses the band.
  const y0 = max(cameraPosition.y, 0);
  const y1 = max(positionWorld.y, 0);
  const dy = y1.sub(y0);
  const e0 = exp(k.negate().mul(y0));
  const f = select(
    abs(dy).greaterThan(0.01),
    e0.sub(exp(k.negate().mul(y1))).div(k.mul(dy)),
    exp(k.negate().mul(y0.add(y1).mul(0.5))),
  );
  const dist = positionWorld.sub(cameraPosition).length();
  const factor = exp(density.mul(patch).mul(dist).mul(f).negate()).oneMinus();
  const off: [number, number] = [0, 0];

  const part: WorldPart = {
    object: new Group(),
    update(fr) {
      const m = mistFog(fr.hour.mist);
      density.value = m.density;
      k.value = Math.LN10 / m.top;
      if (m.density > 0) {
        const [vx, vy] = mistDrift(fr.hour.world);
        off[0] = (off[0] + vx * fr.dtS) % 4000;
        off[1] = (off[1] + vy * fr.dtS) % 4000;
        offset.value.set(off[0], off[1]);
      }
    },
    setTier() {},
    dispose() {},
  };
  return { factor, part };
}
