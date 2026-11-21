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
    run(f, c, 1100);
    expect(f.state()).toBe('ready');
  });

  it('the light hint shows from the start', () => {
    const f = createLoadingFlow({ storage: memory(), nowMs: () => 0, capMs: 15000 });
    expect(f.state()).toBe('waiting');
    expect(f.hint()).toBe(true);
  });

  it('unlit, it lights itself at 70 % loaded', () => {
    const c = clock();
    const f = createLoadingFlow({ storage: memory(), nowMs: c.now, capMs: 15000 });
    f.progress(0.6);
    run(f, c, 3000);
    expect(f.state()).toBe('waiting');
    f.progress(0.7);
    run(f, c, 50);
    expect(f.state()).toBe('lit');
    expect(f.litByVisitor()).toBe(false);
  });

  it('the flame burns at least 1 s before the night', () => {
    const c = clock();
    const f = createLoadingFlow({ storage: memory(), nowMs: c.now, capMs: 15000 });
    f.progress(0.5);
    run(f, c, 4000);
    f.light();
    f.progress(1);
    run(f, c, 900);
    expect(f.state()).toBe('lit');
    run(f, c, 200);
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

  it("only the visitor's own gesture makes it theirs", () => {
    const c = clock();
    const mine = createLoadingFlow({ storage: memory(), nowMs: c.now, capMs: 15000 });
    mine.light();
    expect(mine.litByVisitor()).toBe(true);
    const auto = createLoadingFlow({ storage: memory(), nowMs: c.now, capMs: 15000 });
    auto.progress(1);
    run(auto, c, 2500);
    expect(auto.state()).toBe('ready');
    expect(auto.litByVisitor()).toBe(false);
  });

  it('Enter and Space light the lantern', () => {
    expect(lightsLantern('Enter')).toBe(true);
    expect(lightsLantern(' ')).toBe(true);
    expect(lightsLantern('Tab')).toBe(false);
  });
});
