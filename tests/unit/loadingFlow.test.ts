import { describe, expect, it } from 'vitest';
import { createLoadingFlow, LANTERN_KEY, lightsLantern } from '../../src/loading/flow';

function clock() {
  let t = 0;
  return { now: () => t, go: (ms: number) => (t += ms) };
}
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const run = (flow: { tick(): void }, c: { go(ms: number): void }, ms: number) => {
  for (let i = 0; i < ms / 50; i++) {
    c.go(50);
    flow.tick();
  }
};

describe('the lantern room', () => {
  it('light then full progress is ready', () => {
    const c = clock();
    const f = createLoadingFlow({ storage: memory(), nowMs: c.now, capMs: 15000 });
    run(f, c, 1500);
    f.light();
    expect(f.state()).toBe('lit');
    f.progress(1);
    run(f, c, 600);
    expect(f.state()).toBe('ready');
  });

  it('the light hint shows from the start', () => {
    const f = createLoadingFlow({ storage: memory(), nowMs: () => 0, capMs: 15000 });
    expect(f.state()).toBe('waiting');
    expect(f.hint()).toBe(true);
  });

  it('unlit at full progress lights itself after 3 s', () => {
    const c = clock();
    const f = createLoadingFlow({ storage: memory(), nowMs: c.now, capMs: 15000 });
    run(f, c, 2000);
    f.progress(1);
    run(f, c, 2900);
    expect(f.state()).toBe('waiting');
    run(f, c, 200);
    expect(['lit', 'ready']).toContain(f.state());
    run(f, c, 600);
    expect(f.state()).toBe('ready');
  });

  it('the lantern gives up waiting at the cap', () => {
    const c = clock();
    const f = createLoadingFlow({ storage: memory(), nowMs: c.now, capMs: 15000 });
    f.progress(0.4);
    run(f, c, 14900);
    expect(f.state()).toBe('waiting');
    run(f, c, 200);
    expect(f.state()).toBe('ready');
  });

  it('a failed base load ends in stills', () => {
    const f = createLoadingFlow({ storage: memory(), nowMs: () => 0, capMs: 15000 });
    f.failed();
    expect(f.state()).toBe('stills');
  });

  it('blocked storage counts as a first visit', () => {
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    };
    const c = clock();
    const f = createLoadingFlow({ storage: blocked, nowMs: c.now, capMs: 15000 });
    expect(f.skip).toBe(false);
    f.light();
    f.progress(1);
    run(f, c, 2500);
    expect(() => f.release()).not.toThrow();
    expect(f.state()).toBe('released');
    expect(createLoadingFlow({ storage: null, nowMs: c.now, capMs: 15000 }).skip).toBe(false);
  });

  it('returning visitor skips', () => {
    const s = memory();
    s.setItem(LANTERN_KEY, '1');
    expect(createLoadingFlow({ storage: s, nowMs: () => 0, capMs: 15000 }).skip).toBe(true);
  });

  it('release remembers the visit', () => {
    const s = memory();
    const c = clock();
    const f = createLoadingFlow({ storage: s, nowMs: c.now, capMs: 15000 });
    f.light();
    f.progress(1);
    run(f, c, 2500);
    f.release();
    expect(s.getItem(LANTERN_KEY)).toBe('1');
  });

  it('cached first visit still lasts about 2 s', () => {
    const c = clock();
    const f = createLoadingFlow({ storage: memory(), nowMs: c.now, capMs: 15000 });
    f.progress(1);
    run(f, c, 1900);
    expect(f.state()).not.toBe('ready');
    run(f, c, 300);
    expect(f.state()).toBe('ready');
  });

  it('Enter and Space light the lantern', () => {
    expect(lightsLantern('Enter')).toBe(true);
    expect(lightsLantern(' ')).toBe(true);
    expect(lightsLantern('Tab')).toBe(false);
  });
});
