import { describe, expect, it } from 'vitest';
import { partOrder } from '../../src/world/partOrder';

const ALL = ['terrain', 'sea', 'dressing', 'aurora', 'cloud', 'falls', 'cave', 'arch', 'stacks'];

describe('parts load nearest-first (plan M2.5 Task 8)', () => {
  it('opening at Night compiles falls and aurora before cloud and cave', () => {
    const order = partOrder(ALL, 'night');
    const at = (n: string) => order.indexOf(n);
    expect(at('falls')).toBeLessThan(at('cloud'));
    expect(at('falls')).toBeLessThan(at('cave'));
    expect(at('aurora')).toBeLessThan(at('cloud'));
    expect(at('aurora')).toBeLessThan(at('cave'));
  });

  it('keeps the ground first everywhere, and the rock first at Golden', () => {
    for (const stop of ['golden', 'night', 'beforedawn'] as const)
      expect(partOrder(ALL, stop).slice(0, 2)).toEqual(['terrain', 'sea']);
    const golden = partOrder(ALL, 'golden');
    expect(golden.indexOf('arch')).toBeLessThan(golden.indexOf('aurora'));
    expect(golden.indexOf('stacks')).toBeLessThan(golden.indexOf('cave'));
  });

  it('opening at Before dawn compiles the cave first after the ground', () => {
    const order = partOrder(ALL, 'beforedawn');
    expect(order.indexOf('cave')).toBeLessThan(order.indexOf('falls'));
    expect(order.indexOf('cave')).toBeLessThan(order.indexOf('arch'));
  });

  it('loses no part and keeps unknown names at the end', () => {
    const order = partOrder([...ALL, 'mystery'], 'midnight');
    expect([...order].sort()).toEqual([...ALL, 'mystery'].sort());
    expect(order[order.length - 1]).toBe('mystery');
  });
});
