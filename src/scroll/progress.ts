import { clamp01 } from '../shared/math';

/** Scroll position as 0..1 of the scrollable distance. */
export const progressFrom = (scroll: number, limit: number): number => (limit > 0 ? clamp01(scroll / limit) : 0);
