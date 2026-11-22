import { readFileSync } from 'node:fs';
import { BufferGeometry } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { runAll, runSliced } from '../../src/shared/slice';
import { bakeGrove, bakeGroveSteps, decodeGrove } from '../../src/world/grove';
import { createSurfaceSampler } from '../../src/world/heights';
import { scatterCove, scatterCoveSteps } from '../../src/world/scatter';
import { baseGeometry, baseGeometrySteps } from '../../src/world/terrain';

function* counter(n: number): Generator<void, number> {
  let s = 0;
  for (let i = 0; i < n; i++) {
    s += i;
    yield;
  }
  return s;
}

describe('runSliced (s29 Task 7b: the lantern room draws between slices)', () => {
  it('returns what running it all at once returns', async () => {
    expect(await runSliced(counter(100), 8, async () => undefined)).toBe(runAll(counter(100)));
  });
  it('pauses whenever a slice has used its budget', async () => {
    let clock = 0;
    let pauses = 0;
    // every step costs 1 ms: 100 steps in 8 ms slices pause 12 times
    function* slow(): Generator<void, string> {
      for (let i = 0; i < 100; i++) {
        clock += 1;
        yield;
      }
      return 'done';
    }
    const out = await runSliced(
      slow(),
      8,
      async () => void pauses++,
      () => clock,
    );
    expect(out).toBe('done');
    expect(pauses).toBe(12);
  });
  it('never pauses work that fits one slice', async () => {
    let pauses = 0;
    await runSliced(
      counter(10),
      8,
      async () => void pauses++,
      () => 0,
    );
    expect(pauses).toBe(0);
  });
});

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const hb = readFileSync('public/world/base/heights.bin');
const surface = createSurfaceSampler(new Uint16Array(hb.buffer, hb.byteOffset, hb.byteLength / 2), base.heights);

describe('the room-blocking builds, sliced', () => {
  it('the sliced cove scatter equals the one-shot scatter exactly', async () => {
    const one = scatterCove(surface);
    const sliced = await runSliced(scatterCoveSteps(surface), 1, async () => undefined);
    expect(sliced.count).toBe(one.count);
    expect(Array.from(sliced.data)).toEqual(Array.from(one.data));
  });
  it('the sliced grove bake equals the one-shot bake exactly', async () => {
    const b = readFileSync(`public/world/${base.grove.file}`);
    const grove = decodeGrove(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), base.grove);
    const one = bakeGrove(grove, surface);
    const sliced = await runSliced(bakeGroveSteps(grove, surface), 1, async () => undefined);
    expect(Array.from(sliced.position)).toEqual(Array.from(one.position));
    expect(Array.from(sliced.index)).toEqual(Array.from(one.index));
    expect(Array.from(sliced.aux)).toEqual(Array.from(one.aux));
    expect(sliced.kept).toEqual(one.kept);
  });
});

describe('the base ground, sliced', () => {
  it('the sliced base geometry equals the one-shot geometry exactly, normals included', async () => {
    const q = new Uint16Array(hb.buffer, hb.byteOffset, hb.byteLength / 2);
    const one = baseGeometry(q, base.heights);
    const sliced = await runSliced(baseGeometrySteps(q, base.heights), 1, async () => undefined);
    for (const name of ['position', 'uv', 'normal'])
      expect(Array.from(sliced.getAttribute(name).array as Float32Array)).toEqual(
        Array.from(one.getAttribute(name).array as Float32Array),
      );
    expect(Array.from(sliced.index?.array ?? [])).toEqual(Array.from(one.index?.array ?? []));
  });
  it("its normals are three's computeVertexNormals to the bit", () => {
    const q = new Uint16Array(hb.buffer, hb.byteOffset, hb.byteLength / 2);
    const ours = baseGeometry(q, base.heights);
    const ref = new BufferGeometry();
    ref.setAttribute('position', ours.getAttribute('position'));
    ref.setIndex(ours.index);
    ref.computeVertexNormals();
    expect(Array.from(ours.getAttribute('normal').array as Float32Array)).toEqual(
      Array.from(ref.getAttribute('normal').array as Float32Array),
    );
  });
});
