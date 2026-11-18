/** Print the world's download sizes and fail if a budget is broken (run: npm run world:report; CI runs it). */
import { readFileSync, statSync } from 'node:fs';
import { BUDGETS, checkBudgets, type Manifest } from '../../src/assets/manifest.ts';

const manifest = JSON.parse(
  readFileSync(new URL('../../public/world/manifest.json', import.meta.url), 'utf8'),
) as Manifest;
const kb = (n: number) => `${(n / 1e3).toFixed(1).padStart(8)} kB`;
for (const f of manifest.files) {
  const stops = f.stops === 'all' ? 'all' : f.stops.join(',');
  console.log(`${f.path.padEnd(28)} ${kb(f.bytes)}  ${f.stage}  ${stops}`);
}
// s16: a pack re-exported without `node tools/world/manifest.ts` kept its old size here, and the site refused the
// new file at load (grove.bin: read 183800 of 183840 bytes) while this report still passed
const stale = manifest.files.filter(
  (f) => statSync(new URL(`../../public/world/${f.path}`, import.meta.url)).size !== f.bytes,
);
for (const f of stale)
  console.error(`stale manifest: ${f.path} is not ${f.bytes} bytes (run node tools/world/manifest.ts)`);
const result = checkBudgets(manifest, BUDGETS);
console.log('');
for (const line of result.lines) console.log(line);
if (stale.length) process.exit(1);
if (!result.ok) {
  console.error('\nA world pack is over budget (spec §14).');
  process.exit(1);
}
