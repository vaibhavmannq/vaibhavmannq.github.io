import { describe, expect, it, vi } from 'vitest';
import type { StopId } from '../../src/journey/types';
import type { WorldPart } from '../../src/world/part';
import { createSetStreamer, type SetDeps } from '../../src/world/setStreamer';

const part = () => ({ object: {}, update() {}, setTier() {}, dispose: vi.fn() }) as unknown as WorldPart;
const tick = () => new Promise((r) => setTimeout(r, 0));

function deps(fail = false) {
  const made: Record<string, WorldPart[]> = {};
  const d: SetDeps = {
    fetchSet: vi.fn(async (id: StopId) => {
      await tick();
      if (fail) throw new Error('offline');
      made[id] = [part()];
      return made[id];
    }),
    compile: vi.fn(async () => {}),
    add: vi.fn(),
    remove: vi.fn(),
  };
  return { d, made };
}

describe('the set streamer', () => {
  it('a set is shown only when canSwap', async () => {
    const { d } = deps();
    const s = createSetStreamer(d);
    s.update({ keep: ['beforedawn'], fetch: null }, false);
    await tick();
    await tick();
    expect(s.state('beforedawn')).toBe('ready');
    expect(d.add).not.toHaveBeenCalled();
    s.update({ keep: ['beforedawn'], fetch: null }, true);
    expect(s.state('beforedawn')).toBe('shown');
    expect(d.add).toHaveBeenCalledTimes(1);
  });

  it('a released set is disposed once', async () => {
    const { d, made } = deps();
    const s = createSetStreamer(d);
    s.update({ keep: ['beforedawn'], fetch: null }, true);
    await tick();
    await tick();
    s.update({ keep: ['beforedawn'], fetch: null }, true);
    s.update({ keep: [], fetch: null }, true);
    s.update({ keep: [], fetch: null }, true);
    expect(d.remove).toHaveBeenCalledTimes(1);
    expect(made.beforedawn?.[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(s.state('beforedawn')).toBe('none');
  });

  it('a set is released only where a swap may happen', async () => {
    const { d } = deps();
    const s = createSetStreamer(d);
    s.update({ keep: ['beforedawn'], fetch: null }, true);
    await tick();
    await tick();
    s.update({ keep: ['beforedawn'], fetch: null }, true);
    s.update({ keep: [], fetch: null }, false);
    expect(d.remove).not.toHaveBeenCalled();
  });

  it('a set asked again while fetching is fetched once', async () => {
    const { d } = deps();
    const s = createSetStreamer(d);
    s.update({ keep: [], fetch: 'beforedawn' }, false);
    s.update({ keep: [], fetch: 'beforedawn' }, false);
    s.update({ keep: ['beforedawn'], fetch: null }, false);
    await tick();
    await tick();
    expect(d.fetchSet).toHaveBeenCalledTimes(1);
  });

  it('a set released while still fetching is disposed when it arrives', async () => {
    const { d, made } = deps();
    const s = createSetStreamer(d);
    s.update({ keep: ['beforedawn'], fetch: null }, true);
    s.update({ keep: [], fetch: null }, true);
    await tick();
    await tick();
    expect(made.beforedawn?.[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(d.add).not.toHaveBeenCalled();
    expect(s.state('beforedawn')).toBe('none');
  });

  it('a failed fetch leaves the far version and retries on the next rest', async () => {
    const { d } = deps(true);
    const s = createSetStreamer(d);
    s.update({ keep: [], fetch: 'beforedawn' }, false);
    await tick();
    await tick();
    expect(s.state('beforedawn')).toBe('none');
    s.update({ keep: [], fetch: 'beforedawn' }, false);
    expect(d.fetchSet).toHaveBeenCalledTimes(2);
  });
});
