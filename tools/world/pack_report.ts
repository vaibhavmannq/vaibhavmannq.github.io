/** Print the world's download sizes and fail if a budget is broken (run: npm run world:report; CI runs it). */
import { readFileSync } from 'node:fs';
import { BUDGETS, checkBudgets, type Manifest } from '../../src/assets/manifest.ts';

const manifest = JSON.parse(
  readFileSync(new URL('../../public/world/manifest.json', import.meta.url), 'utf8'),
) as Manifest;
const kb = (n: number) => `${(n / 1e3).toFixed(1).padStart(8)} kB`;
for (const f of manifest.files) {
  const stops = f.stops === 'all' ? 'all' : f.stops.join(',');
  console.log(`${f.path.padEnd(28)} ${kb(f.bytes)}  ${f.stage}  ${stops}`);
}
const result = checkBudgets(manifest, BUDGETS);
console.log('');
for (const line of result.lines) console.log(line);
if (!result.ok) {
  console.error('\nA world pack is over budget (spec §14).');
  process.exit(1);
}
