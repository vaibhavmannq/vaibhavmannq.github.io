import { mulberry32 } from '../shared/random';

/**
 * A gust through Sunset's meadow (plan Task 16e, spec §4.5, s33; prep-16e.md): a gust is a ~3 s peak (WMO), at force
 * 2–3 running ~5–8 m/s; across a canopy it reads as a band of bent, brighter blades that rolls in with a sharp front and
 * a slower recovery (honami; Raupach, Finnigan & Brunet 1996). Sunset's wind blows from the sea toward the eye, so the
 * band starts at the crest and passes the lens. Every 24–40 s, 18 s long, pure and seeded.
 */
export const GUST = {
  /** first gust after this many seconds (+ up to 10) */
  first: 6,
  /** gap between gusts: this + up to 16 s */
  gap: 24,
  length: 18,
  /** m/s along the wind */
  speed: 7,
  /** where the front starts, metres along the wind from the eye (negative: upwind, toward the crest) */
  start: -110,
} as const;

/** Event start times, seeded: [T0, T1, …] covering at least `untilS`. */
export function gustTimes(untilS: number, seed = 4): number[] {
  const r = mulberry32(seed);
  const t = [GUST.first + 10 * r()];
  while ((t[t.length - 1] as number) < untilS) t.push((t[t.length - 1] as number) + GUST.gap + 16 * r());
  return t;
}

/**
 * The night's gust times, shared by the meadow's blades, the petals and the wind's sound (s34) so all three see the same
 * gust; `?gust=now` puts one 2 s in (a test aid).
 */
export const GUST_TIMES: readonly number[] = (() => {
  const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('gust');
  const t = gustTimes(24 * 3600);
  return q === 'now' ? [2, ...t.map((x) => x + 24)] : t;
})();

const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/**
 * The gust at time `timeS`: `amp` 0..1 (0 between gusts; up over 2 s, down over the last 3 s; each gust's own peak
 * 0.7–1) and `front`, metres along the wind from the eye. Pure.
 */
export function gustAt(timeS: number, times: readonly number[]): { amp: number; front: number } {
  let lo = 0;
  let hi = times.length - 1;
  let k = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if ((times[m] as number) <= timeS) {
      k = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  if (k < 0) return { amp: 0, front: GUST.start };
  const dt = timeS - (times[k] as number);
  if (dt >= GUST.length) return { amp: 0, front: GUST.start };
  const peak = 0.7 + 0.3 * mulberry32(1000 + k)();
  const amp = peak * smooth(0, 2, dt) * (1 - smooth(GUST.length - 3, GUST.length, dt));
  return { amp, front: GUST.start + GUST.speed * dt };
}
