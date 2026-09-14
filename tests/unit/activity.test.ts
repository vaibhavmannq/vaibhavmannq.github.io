import { describe, expect, it } from 'vitest';
import { createScrollActivity, SCROLL_SETTLE_MS } from '../../src/scroll/activity';

describe('createScrollActivity', () => {
  it('is still on the very first frame, whatever the progress', () => {
    expect(createScrollActivity().update(0.2, 1000)).toBe(false);
  });

  it('is scrolling from the frame the progress changes', () => {
    const activity = createScrollActivity();
    activity.update(0, 0);
    expect(activity.update(0.01, 16)).toBe(true);
  });

  it('stays scrolling until the progress has held still for the settle time', () => {
    const activity = createScrollActivity();
    activity.update(0, 0);
    activity.update(0.01, 100);
    expect(activity.update(0.01, 100 + SCROLL_SETTLE_MS - 1)).toBe(true);
    expect(activity.update(0.01, 100 + SCROLL_SETTLE_MS)).toBe(false);
  });

  it('counts scrolling back up as scrolling', () => {
    const activity = createScrollActivity();
    activity.update(0.5, 0);
    activity.update(0.5, 1000);
    expect(activity.update(0.4, 1016)).toBe(true);
  });
});
