/**
 * Bake the eight flight paths over the world base heights (run: node tools/world/bake_flights.ts, after bake_base.py).
 * Writes src/journey/flightPaths.json. Tools import only modules without relative runtime imports, so Node runs them
 * directly with type stripping.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { APPROACH, FLIGHT_OVERRIDES, type FlightPath, generateWaypoints } from '../../src/journey/flights.ts';
import { STOP_IDS, type StopId, type Vec3 } from '../../src/journey/types.ts';
import { createHeightSampler, type GridMeta } from '../../src/world/heights.ts';

const root = new URL('../../', import.meta.url);
const base = JSON.parse(readFileSync(new URL('public/world/base/base.json', root), 'utf8')) as { heights: GridMeta };
const bytes = readFileSync(new URL('public/world/base/heights.bin', root));
const q = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
const heightAt = createHeightSampler(q, base.heights);
const shots = JSON.parse(readFileSync(new URL('src/journey/shots.json', root), 'utf8')) as Record<
  StopId,
  { cam: Vec3; eyeZ: number }
>;

const camOf = (id: StopId): Vec3 => [shots[id].cam[0], shots[id].cam[1], shots[id].eyeZ];
const paths: FlightPath[] = [];
for (let i = 0; i < STOP_IDS.length - 1; i++) {
  const from = STOP_IDS[i] as StopId;
  const to = STOP_IDS[i + 1] as StopId;
  const key = `${from}>${to}` as const;
  const a = camOf(from);
  const b = camOf(to);
  const override = FLIGHT_OVERRIDES[key];
  const points = override ? [a, ...override, b] : generateWaypoints(a, b, heightAt, APPROACH[key]);
  paths.push({ from, to, points: points.map((p) => p.map((v) => Math.round(v * 100) / 100) as Vec3) });
}
writeFileSync(new URL('src/journey/flightPaths.json', root), `${JSON.stringify(paths, null, 1)}\n`);
for (const p of paths)
  console.log(
    `${p.from} > ${p.to}: ${p.points.length} points, top ${Math.max(...p.points.map((x) => x[2])).toFixed(0)} m`,
  );
