/**
 * Write public/world/manifest.json: every world file with its size, hash, loading stage and the stops that need it,
 * plus the base grids' meta and the skies' ambient light (run: node tools/world/manifest.ts, last step of `npm run world`).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FileEntry, Manifest } from '../../src/assets/manifest.ts';
import { STOP_IDS, type StopId } from '../../src/journey/types.ts';

const world = fileURLToPath(new URL('../../public/world/', import.meta.url));
const INLINED = new Set(['manifest.json', 'base/base.json', 'sky/sky.json']);
/** What the first view needs (spec §12): the Golden sky and still, and the poster behind the name. */
const STAGE_A = new Set(['sky/golden.jpg', 'stills/golden.webp', 'stills/poster.webp']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function stopsOf(path: string): StopId[] | 'all' {
  if (path === 'stills/poster.webp') return ['golden'];
  const id = path.split('/')[1]?.split('.')[0] as StopId;
  if ((path.startsWith('sky/') || path.startsWith('stills/')) && STOP_IDS.includes(id)) return [id];
  if (path.startsWith('base/')) return 'all';
  throw new Error(`no stop rule for ${path}`);
}

const files: FileEntry[] = walk(world)
  .map((full) => relative(world, full).split(sep).join('/'))
  .filter((path) => !INLINED.has(path))
  .sort()
  .map((path) => {
    const bytes = readFileSync(join(world, path));
    return {
      path,
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      stage: STAGE_A.has(path) ? 'A' : 'B',
      stops: stopsOf(path),
    };
  });

const base = JSON.parse(readFileSync(join(world, 'base/base.json'), 'utf8'));
const skies = JSON.parse(readFileSync(join(world, 'sky/sky.json'), 'utf8'));
const manifest: Manifest = {
  version: 1,
  base: { heights: base.heights, ring: base.ring, dressing: base.dressing, aurora: base.aurora, cave: base.cave },
  skies,
  files,
};
writeFileSync(join(world, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`manifest: ${files.length} files`);
