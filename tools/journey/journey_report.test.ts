/// <reference types="node" />
// The journey's numbers per ride (plan world-to-100 Tasks 1–2; spec §4.3). Run: npm run journey
// Node cannot run src modules (extensionless relative imports), so this report runs under Vitest.
// Writes .superpowers/w100/journey.txt; reads .superpowers/w100/edges.json (ride-frames.mjs) for the dead share.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import type { FlightPath } from '../../src/journey/flights';
import { motionStats } from '../../src/journey/motion';
import { simulateRide } from '../../src/journey/ridePlay';
import { nearestHit, screenMotion } from '../../src/journey/sightline';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, frameAt } from '../../src/journey/timeline';
import { createDrawnHeightSampler, type GridMeta } from '../../src/world/heights';

const NUM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const f = (x: number, d = 1) => x.toFixed(d).padStart(7);
/** The dead measure (spec §4.3; R209: calibrated by eye, the stops read 0.06–0.15 and the empty frames 0.00–0.02). */
const EDGE_DEAD = 0.03;
const pct = (xs: number[], q: number) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))] ?? 0;

it('prints the journey report', () => {
  const paths = JSON.parse(readFileSync('src/journey/flightPaths.json', 'utf8')) as FlightPath[];
  const track = buildTrack(STOPS);
  const meta = JSON.parse(readFileSync('public/world/manifest.json', 'utf8')).base.heights as GridMeta;
  const buf = readFileSync('public/world/base/heights.bin');
  const heightAt = createDrawnHeightSampler(new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2), meta);
  const edgesPath = '.superpowers/w100/edges.json';
  const edges = existsSync(edgesPath)
    ? (JSON.parse(readFileSync(edgesPath, 'utf8')) as Record<string, { t: number; edge: number }[]>)
    : null;
  const lines = ['ride        secs  wait  v p50  v max  a max  j p95  j max  g°/s  g°/s² g°/s³  steps (t s: dv m/s)'];
  const look = ['ride      far%   scr p50  scr max  max/p50   dead%  longest dead s  longest far s'];
  for (let i = 0; i + 1 < STOPS.length; i++) {
    const s = simulateRide(track, paths, i, i + 1);
    const m = motionStats(s);
    const p0 = s[0]!.pose.position;
    const moved = s.find(
      (x) => Math.hypot(x.pose.position[0] - p0[0], x.pose.position[1] - p0[1], x.pose.position[2] - p0[2]) > 0.01,
    );
    const wait = moved ? moved.tS : 0;
    const steps = m.speedSteps.map((x) => `${x.tS.toFixed(2)}:${x.dv.toFixed(2)}`).join(' ');
    const name = `${NUM[i]}→${NUM[i + 1]}`.padEnd(9);
    lines.push(
      `${name}${f(m.durationS)}${f(wait, 2).slice(1)}${f(m.speed.p50)}${f(m.speed.max)}${f(m.accel.max)}${f(m.jerk.p95)}${f(m.jerk.max, 0)}${f(m.gaze.maxDegS, 0)}${f(m.gaze.maxDegS2, 0)}${f(m.gaze.maxDegS3, 0)}  ${m.speedSteps.length} ${steps}`,
    );
    // 30 Hz from the moment the camera moves to the moment it stands at the next stop
    const live = s.filter((x, k) => k % 4 === 0 && x.tS >= wait && frameAt(track, x.u, false).kind === 'flight');
    const dist = live.map((x) => nearestHit(x.pose, heightAt));
    const scr = live.slice(1).map((x, k) => screenMotion(live[k]!, x, Math.min(dist[k]!, dist[k + 1]!)));
    const far = dist.filter((d) => !Number.isFinite(d)).length / Math.max(1, dist.length);
    // the stricter measure (s28 note): nothing within 300 m at the frame's centre, sky or not, however busy the sky
    let farRun = 0;
    let longestFar = 0;
    for (const d of dist) {
      farRun = Number.isFinite(d) ? 0 : farRun + 1 / 30;
      longestFar = Math.max(longestFar, farRun);
    }
    let deadShare = Number.NaN;
    let longest = Number.NaN;
    const rideEdges = edges?.[String(i)];
    if (rideEdges && rideEdges.length > 0) {
      const edgeAt = (t: number) =>
        rideEdges.reduce((best, e) => (Math.abs(e.t - t) < Math.abs(best.t - t) ? e : best)).edge;
      let run = 0;
      let dead = 0;
      longest = 0;
      for (let k = 0; k < live.length; k++) {
        const ft = frameAt(track, live[k]!.u, false).t;
        const isDead = !Number.isFinite(dist[k]!) && edgeAt(ft) < EDGE_DEAD;
        if (isDead) {
          dead++;
          run += 1 / 30;
          longest = Math.max(longest, run);
        } else run = 0;
      }
      deadShare = dead / Math.max(1, live.length);
    }
    const p50 = pct(scr, 0.5);
    const mx = Math.max(0, ...scr);
    look.push(
      `${name}${f(far * 100, 0)}${f(p50, 2).padStart(10)}${f(mx, 2).padStart(9)}${f(mx / Math.max(1e-6, p50), 1).padStart(9)}${f(deadShare * 100, 0)}${f(longest, 1).padStart(10)}${f(longestFar, 1).padStart(12)}`,
    );
  }
  mkdirSync('.superpowers/w100', { recursive: true });
  writeFileSync('.superpowers/w100/journey.txt', `${lines.join('\n')}\n\n${look.join('\n')}\n`);
});
