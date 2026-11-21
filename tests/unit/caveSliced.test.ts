/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { caveLight, caveLightSliced, decodeCave, fungiLight, fungiLightSliced } from '../../src/world/cave';

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const meta = base.cave;
const buf = readFileSync('public/world/base/cave.bin');
const parts = () => decodeCave(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), meta);

describe('the cave light in slices (s28: one block froze the phone 529 ms)', () => {
  it('gives exactly the one-shot light', async () => {
    const one = caveLight(parts());
    let breaths = 0;
    const sliced = await caveLightSliced(
      parts(),
      {},
      async () => {
        breaths++;
      },
      500,
    );
    expect(Array.from(sliced.shell)).toEqual(Array.from(one.shell));
    expect(Array.from(sliced.floor)).toEqual(Array.from(one.floor));
    expect(breaths).toBeGreaterThan(1);
  });

  it('the fungi glow in slices is the one-shot glow', async () => {
    const c = parts();
    const one = fungiLight(c.shell.position, c.fungi);
    const sliced = await fungiLightSliced(c.shell.position, c.fungi, async () => undefined, 300);
    expect(Array.from(sliced)).toEqual(Array.from(one));
  });
});
