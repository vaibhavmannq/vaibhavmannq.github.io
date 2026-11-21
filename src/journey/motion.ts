import type { RideSample } from './ridePlay';

/** How a ride moves (spec §4.3): metres, seconds, degrees. */
export interface RideStats {
  durationS: number;
  speed: { max: number; p50: number };
  accel: { max: number };
  jerk: { max: number; p95: number };
  gaze: { maxDegS: number; maxDegS2: number; maxDegS3: number };
  /** Ticks where the speed jumps instead of easing: a kink a visitor feels as a jolt. */
  speedSteps: { tS: number; dv: number }[];
}

type V = [number, number, number];
const sub = (a: readonly number[], b: readonly number[], k: number): V => [
  (a[0]! - b[0]!) * k,
  (a[1]! - b[1]!) * k,
  (a[2]! - b[2]!) * k,
];
const len = (v: readonly number[]) => Math.hypot(v[0]!, v[1]!, v[2]!);
const pct = (xs: number[], q: number) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};
const median = (xs: number[]) => pct(xs, 0.5);

/** A speed change in one tick this large (m/s) can be a step; below it is easing (6 m/s² at 120 Hz). */
const STEP_FLOOR = 0.05;
/** ... and it must stand this many times above the ticks around it. */
const STEP_RATIO = 4;
/** ... and move the camera off its course by at least this much (m): a 5 mm handover is not seen. */
const STEP_SEEN_M = 0.01;

/** Finite differences over equally spaced samples. Pure. */
export function motionStats(samples: readonly RideSample[]): RideStats {
  const n = samples.length;
  const dt = n > 1 ? samples[1]!.tS - samples[0]!.tS : 1;
  const k = 1 / dt;
  const vel: V[] = [];
  const gz: [number, number][] = [];
  for (let i = 0; i + 1 < n; i++) {
    const a = samples[i]!.pose;
    const b = samples[i + 1]!.pose;
    vel.push(sub(b.position, a.position, k));
    const dy = ((((b.yaw - a.yaw) % 360) + 540) % 360) - 180;
    const cos = Math.cos((((a.pitch + b.pitch) / 2) * Math.PI) / 180);
    gz.push([dy * cos * k, (b.pitch - a.pitch) * k]);
  }
  const acc = vel.slice(1).map((v, i) => sub(v, vel[i]!, k));
  const jerk = acc.slice(1).map((a, i) => sub(a, acc[i]!, k));
  const gAcc = gz.slice(1).map((g, i) => [(g[0] - gz[i]![0]) * k, (g[1] - gz[i]![1]) * k] as [number, number]);
  const gJerk = gAcc.slice(1).map((g, i) => [(g[0] - gAcc[i]![0]) * k, (g[1] - gAcc[i]![1]) * k]);
  const speeds = vel.map(len);
  const dSpeed = speeds.slice(1).map((s, i) => s - speeds[i]!);
  const steps: { tS: number; dv: number }[] = [];
  for (let i = 0; i < dSpeed.length; i++) {
    const d = dSpeed[i]!;
    if (Math.abs(d) < STEP_FLOOR || Math.abs(d) * dt < STEP_SEEN_M) continue;
    const around: number[] = [];
    for (let j = i - 6; j <= i + 6; j++) if (j !== i && j >= 0 && j < dSpeed.length) around.push(Math.abs(dSpeed[j]!));
    if (Math.abs(d) < STEP_RATIO * median(around)) continue;
    const tS = samples[i + 1]!.tS;
    const last = steps[steps.length - 1];
    if (last && tS - last.tS <= 2 * dt * 1.0001 && Math.sign(last.dv) === Math.sign(d)) last.dv += d;
    else steps.push({ tS, dv: d });
  }
  const mags = (xs: number[][]) => xs.map((x) => Math.hypot(x[0]!, x[1]!));
  const jm = jerk.map(len);
  return {
    durationS: n > 0 ? samples[n - 1]!.tS - samples[0]!.tS : 0,
    speed: { max: Math.max(0, ...speeds), p50: median(speeds) },
    accel: { max: Math.max(0, ...acc.map(len)) },
    jerk: { max: Math.max(0, ...jm), p95: pct(jm, 0.95) },
    gaze: {
      maxDegS: Math.max(0, ...mags(gz)),
      maxDegS2: Math.max(0, ...mags(gAcc)),
      maxDegS3: Math.max(0, ...mags(gJerk)),
    },
    speedSteps: steps,
  };
}
