/// <reference types="node" />
// The journey's numbers per ride (plan world-to-100 Task 1; spec §4.3). Run: npm run journey
// Node cannot run src modules (extensionless relative imports), so this report runs under Vitest.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import type { FlightPath } from '../../src/journey/flights';
import { motionStats } from '../../src/journey/motion';
import { simulateRide } from '../../src/journey/ridePlay';
import { STOPS } from '../../src/journey/stops';
import { buildTrack } from '../../src/journey/timeline';

const NUM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const f = (x: number, d = 1) => x.toFixed(d).padStart(7);

it('prints the journey report', () => {
  const paths = JSON.parse(readFileSync('src/journey/flightPaths.json', 'utf8')) as FlightPath[];
  const track = buildTrack(STOPS);
  const lines = ['ride        secs  wait  v p50  v max  a max  j p95  j max  g°/s  g°/s² g°/s³  steps (t s: dv m/s)'];
  for (let i = 0; i + 1 < STOPS.length; i++) {
    const s = simulateRide(track, paths, i, i + 1);
    const m = motionStats(s);
    const p0 = s[0]!.pose.position;
    const moved = s.find(
      (x) => Math.hypot(x.pose.position[0] - p0[0], x.pose.position[1] - p0[1], x.pose.position[2] - p0[2]) > 0.01,
    );
    const wait = moved ? moved.tS : 0;
    const steps = m.speedSteps.map((x) => `${x.tS.toFixed(2)}:${x.dv.toFixed(2)}`).join(' ');
    lines.push(
      `${`${NUM[i]}→${NUM[i + 1]}`.padEnd(9)}${f(m.durationS)}${f(wait, 2).slice(1)}${f(m.speed.p50)}${f(m.speed.max)}${f(m.accel.max)}${f(m.jerk.p95)}${f(m.jerk.max, 0)}${f(m.gaze.maxDegS, 0)}${f(m.gaze.maxDegS2, 0)}${f(m.gaze.maxDegS3, 0)}  ${m.speedSteps.length} ${steps}`,
    );
  }
  mkdirSync('.superpowers/w100', { recursive: true });
  writeFileSync('.superpowers/w100/journey.txt', `${lines.join('\n')}\n`);
});
