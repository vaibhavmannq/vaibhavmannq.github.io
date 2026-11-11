import { RGBAFormat, UnsignedByteType } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { pickSkyTexture, skiesToHold, skyTextureFromPixels } from '../../src/assets/skies';

describe('which skies stay loaded (spec §12)', () => {
  it('holds the current stop, the next, the previous, and the one after next', () => {
    expect(skiesToHold(4, 'stop', 4)).toEqual([4, 5, 3, 6]);
  });

  it('asks for nothing new when a flight starts: everything it needs was fetched while resting (s04 phone hitches)', () => {
    for (let i = 0; i < 8; i++) {
      const atStop = new Set(skiesToHold(i, 'stop', i));
      for (const need of skiesToHold(i, 'flight', i + 1)) expect(atStop.has(need)).toBe(true);
    }
  });

  it('never asks for a stop before the first or after the last', () => {
    expect(skiesToHold(0, 'stop', 0)).toEqual([0, 1, 2]);
    expect(skiesToHold(8, 'stop', 8)).toEqual([8, 7]);
  });

  it('in flight holds both ends first', () => {
    expect(skiesToHold(2, 'flight', 3)).toEqual([2, 3, 4, 1]);
  });
});

describe('the sky shown while one is still loading (Review Focus 1)', () => {
  const F = 'fallback';
  it('uses the nearest loaded sky on the journey', () => {
    const loaded = new Map([
      [4, 'four'],
      [5, 'five'],
    ]);
    expect(pickSkyTexture(6, loaded, F)).toBe('five');
    expect(pickSkyTexture(4, loaded, F)).toBe('four');
  });

  it('falls back when nothing is loaded', () => {
    expect(pickSkyTexture(3, new Map(), F)).toBe(F);
  });
});

describe('the sky store', async () => {
  const { Texture } = await import('three/webgpu');
  const { createSkyStore } = await import('../../src/assets/skies');
  const { STOP_IDS } = await import('../../src/journey/types');
  const manifest = {
    version: 1 as const,
    base: {} as never,
    files: [],
    skies: Object.fromEntries(
      STOP_IDS.map((id) => [id, { file: `sky/${id}.jpg`, ambientSky: [0, 0, 0], ambientGround: [0, 0, 0] }]),
    ),
  };
  const stopFrame = (i: number) => ({
    kind: 'stop' as const,
    a: i,
    b: i,
    t: 0.5,
    resting: true,
    hourWeight: 0,
    skyWeight: 0,
    stillWeight: 1,
    fade: 0,
  });
  const flightFrame = (a: number) => ({ ...stopFrame(a), kind: 'flight' as const, b: a + 1, resting: false });
  const flush = () => new Promise((r) => setTimeout(r, 0));

  /** A loader whose loads finish only when the test says so. */
  function controlled() {
    const waiting = new Map<
      string,
      { resolve: (t: InstanceType<typeof Texture>) => void; reject: (e: Error) => void }
    >();
    const calls: string[] = [];
    const loadTexture = (url: string) =>
      new Promise<InstanceType<typeof Texture>>((resolve, reject) => {
        calls.push(url);
        waiting.set(url, { resolve, reject });
      });
    const finish = (id: string) => waiting.get(`/world/sky/${id}.jpg`)?.resolve(new Texture());
    const fail = (id: string) => waiting.get(`/world/sky/${id}.jpg`)?.reject(new Error('404'));
    return { loadTexture, finish, fail, calls };
  }

  it('keeps showing the old sky while a fling waits for new ones (C1, Review Focus 1)', async () => {
    const fallback = new Texture();
    const c = controlled();
    const store = createSkyStore(manifest, fallback, { loadTexture: c.loadTexture });
    store.update(stopFrame(0));
    c.finish('golden');
    c.finish('sunset');
    await flush();
    const sunset = store.get(1);
    store.update(flightFrame(3)); // a fling into flight IV -> V: nothing there is loaded yet
    await flush();
    expect(store.get(3)).toBe(sunset);
    expect(store.get(3)).not.toBe(fallback);
  });

  it('releases far skies only once the near ones have arrived', async () => {
    const c = controlled();
    const store = createSkyStore(manifest, new Texture(), { loadTexture: c.loadTexture });
    store.update(stopFrame(0));
    c.finish('golden');
    c.finish('sunset');
    await flush();
    const golden = store.get(0);
    store.update(stopFrame(4));
    for (const id of ['bluehour', 'night', 'midnight', 'beforedawn']) c.finish(id);
    await flush();
    store.update(stopFrame(4));
    expect(store.get(0)).not.toBe(golden);
  });

  it('warns once on a failed download and retries after a pause (I1)', async () => {
    let now = 0;
    const warnings: unknown[] = [];
    const c = controlled();
    const store = createSkyStore(manifest, new Texture(), {
      loadTexture: c.loadTexture,
      now: () => now,
      retryMs: 2000,
      warn: (...args) => warnings.push(args),
    });
    store.update(stopFrame(8));
    c.fail('sunrise');
    await flush();
    for (let i = 0; i < 30; i++) store.update(stopFrame(8));
    expect(c.calls.filter((u) => u.endsWith('sunrise.jpg'))).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    now = 2500;
    store.update(stopFrame(8));
    expect(c.calls.filter((u) => u.endsWith('sunrise.jpg'))).toHaveLength(2);
  });
});

// s05: uploading an ImageBitmap to WebGL2 converted it on the main thread (25–53 ms per 2048 px sky at 6x slowdown, the
// hitch at every arrival); raw bytes copy in 9 ms. The worker decodes and flips the rows; the texture uploads them as is.
describe('skyTextureFromPixels', () => {
  it('wraps decoded RGBA rows in a texture that uploads them unflipped', () => {
    const data = new Uint8Array(4 * 4 * 2);
    const t = skyTextureFromPixels({ width: 4, height: 2, data });
    expect(t.image).toEqual({ width: 4, height: 2, data });
    expect(t.format).toBe(RGBAFormat);
    expect(t.type).toBe(UnsignedByteType);
    expect(t.flipY).toBe(false);
    expect(t.version).toBeGreaterThan(0);
  });
});
