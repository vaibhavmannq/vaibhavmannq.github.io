import { describe, expect, it } from 'vitest';
import { createLook, LOOK } from '../../src/journey/look';

const W = 1000;
const settle = (look: ReturnType<typeof createLook>, resting: boolean, seconds: number) => {
  let head = { yaw: 0, pitch: 0 };
  for (let t = 0; t < seconds; t += 1 / 60) head = look.update(resting, 1 / 60);
  return head;
};

describe('look-around (Amendment 1 §6; plan M2.5 Task 6)', () => {
  it('a full-width drag turns the head 80°, grabbing the world (drag right, look left)', () => {
    const look = createLook();
    look.drag(W / 4, 0, W);
    expect(settle(look, true, 2).yaw).toBeCloseTo(-20, 3);
    expect(LOOK.fullWidthDeg).toBe(80);
  });

  it('stops at ±40° yaw and ±15° pitch however far you drag', () => {
    const look = createLook();
    look.drag(-5 * W, -5 * W, W);
    const head = settle(look, true, 2);
    expect(head.yaw).toBeCloseTo(40, 3);
    expect(head.pitch).toBeCloseTo(-15, 3);
    look.drag(10 * W, 10 * W, W);
    const back = settle(look, true, 2);
    expect(back.yaw).toBeCloseTo(-40, 3);
    expect(back.pitch).toBeCloseTo(15, 3);
  });

  it('eases toward the drag (rate 8/s) instead of jumping', () => {
    const look = createLook();
    look.drag(W / 4, 0, W);
    const one = look.update(true, 0.1).yaw;
    expect(one).toBeCloseTo(-20 * (1 - Math.exp(-0.8)), 6);
  });

  it('holds the turn while resting, and eases back to the path within 1.2 s once the journey moves (Review Focus 2)', () => {
    const look = createLook();
    look.drag(-W / 2, W / 8, W);
    expect(settle(look, true, 3).yaw).toBeCloseTo(40, 3);
    const away = settle(look, false, 1.2);
    expect(Math.abs(away.yaw)).toBeLessThan(0.5);
    expect(Math.abs(away.pitch)).toBeLessThan(0.5);
  });

  it('a drag while moving does not stick: it is let go as soon as the journey moves', () => {
    const look = createLook();
    look.drag(-W / 2, 0, W);
    expect(Math.abs(settle(look, false, 1.2).yaw)).toBeLessThan(0.5);
  });
});
