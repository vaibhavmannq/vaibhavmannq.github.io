import { SHOWN_OFFSET } from '../overlay/sections';
import { ANCHOR_EPSILON } from './timeline';
import type { SectionAnchor } from './types';

/**
 * The moon each chapter shows once its text is fully shown (spec 2026-09-25 §4.3; owner's pick: a half cycle).
 * A waxing crescent (6% lit) at Adrift, first quarter at The shore, waxing gibbous (85%) at What washed ashore, full
 * at The water's edge. Never new, so the moon is always there to look at; never waning, so the ending is the
 * brightest moment.
 */
export const CHAPTER_PHASES = [0.08, 0.25, 0.375, 0.5] as const;

/**
 * The phase at this point of the journey: each chapter's phase where its text is fully shown, straight lines in
 * between, held before the first and after the last. A pure function of scroll, like the camera and the text, so
 * scrolling back wanes the moon exactly as it waxed.
 */
export function journeyPhase(local: number, anchors: readonly SectionAnchor[]): number {
  let previousAt = 0;
  let previousPhase: number = CHAPTER_PHASES[0];
  if (local <= 0) return previousPhase;
  for (let i = 1; i < anchors.length && i < CHAPTER_PHASES.length; i++) {
    const at = (anchors[i] as SectionAnchor).from + SHOWN_OFFSET;
    const phase = CHAPTER_PHASES[i] as number;
    if (local <= at) return previousPhase + ((local - previousAt) / (at - previousAt)) * (phase - previousPhase);
    previousAt = at;
    previousPhase = phase;
  }
  return previousPhase;
}

/** Under reduced motion the moon steps with the chapters, cutting at each anchor with the camera and the text. */
export function reducedMotionPhase(local: number, anchors: readonly SectionAnchor[]): number {
  let phase: number = CHAPTER_PHASES[0];
  for (let i = 0; i < anchors.length && i < CHAPTER_PHASES.length; i++) {
    if (local + ANCHOR_EPSILON >= (anchors[i] as SectionAnchor).from) phase = CHAPTER_PHASES[i] as number;
  }
  return phase;
}
