import { describe, expect, it } from 'vitest';
import { loadThread, saveThread, THREAD_KEY, threadPlace } from '../../src/journey/thread';
import { STOP_IDS } from '../../src/journey/types';

/** A sessionStorage stand-in. */
function store(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    m,
  };
}
const broken = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('the lantern thread (plan M3 Task 5; ideas A; Review Focus 5)', () => {
  it('starts unclaimed: the lantern waits on the beach and appears nowhere else', () => {
    const t = loadThread(store());
    expect(t.claimed).toBe(false);
    expect(threadPlace(t, 'golden')).toBe('beach');
    for (const s of STOP_IDS.filter((x) => x !== 'golden')) expect(threadPlace(t, s), s).toBeNull();
  });

  it('once claimed at I, it is among the drifting lanterns at III and rests in the shallows at VIII and IX', () => {
    const t = { claimed: true };
    expect(threadPlace(t, 'golden')).toBe('beach');
    expect(threadPlace(t, 'dusk')).toBe('drifting');
    expect(threadPlace(t, 'firstlight')).toBe('shallows');
    expect(threadPlace(t, 'sunrise')).toBe('shallows');
    // IV–VII belong to their own milestones
    for (const s of ['sunset', 'bluehour', 'night', 'midnight', 'beforedawn'] as const)
      expect(threadPlace(t, s)).toBeNull();
  });

  it('survives a reload: what is saved is what loads', () => {
    const s = store();
    saveThread(s, { claimed: true });
    expect(s.m.has(THREAD_KEY)).toBe(true);
    expect(loadThread(s)).toEqual({ claimed: true });
  });

  it('never throws: blocked storage, no storage or a corrupt value all read as unclaimed', () => {
    expect(loadThread(broken)).toEqual({ claimed: false });
    expect(() => saveThread(broken, { claimed: true })).not.toThrow();
    expect(loadThread(null)).toEqual({ claimed: false });
    expect(() => saveThread(null, { claimed: true })).not.toThrow();
    expect(loadThread(store({ [THREAD_KEY]: '{oops' }))).toEqual({ claimed: false });
    expect(loadThread(store({ [THREAD_KEY]: '{"claimed":"yes"}' }))).toEqual({ claimed: false });
  });
});
