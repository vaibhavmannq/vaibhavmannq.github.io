import { MOONSINK_LENGTH } from '../journey/journey.config';
import { ANCHOR_EPSILON } from '../journey/timeline';
import type { SectionAnchor } from '../journey/types';
import { smoothstep } from '../shared/math';

export interface Sections {
  /** Called every frame with the region-local scroll position (0..1). */
  show(local: number, reducedMotion: boolean): void;
}

/**
 * How much of the region (0..1) each text fade takes: 0.27 of a screen height of scroll. That is the
 * 0.1 of the 2.7-screen journey the owner tuned by feel (journey-flow design §5.1), kept in screens so
 * pages 1 and 2 feel the same now that the Projects page makes the journey longer.
 */
export const HANDOVER_FADE = 0.27 / MOONSINK_LENGTH;
/** The quiet stretch around an anchor where no text shows, only the scene: 0.216 of a screen. */
export const HANDOVER_GAP = 0.216 / MOONSINK_LENGTH;
/**
 * From a section's anchor to where it is fully shown, plus a hair (0.027 of a screen) so a scroll
 * position rounded to whole pixels still lands on full opacity. Skip intro, deep links and the touch
 * snap all aim here, never at a handover gap (journey-flow review I1).
 */
export const SHOWN_OFFSET = HANDOVER_GAP / 2 + HANDOVER_FADE + 0.027 / MOONSINK_LENGTH;

/** Pixel drift while a section leaves (up) and arrives (from below). Dropped under reduced motion. */
const EXIT_OFFSET_PX = -12;
const ENTER_OFFSET_PX = 16;

/** 0..1 progress of a section's outgoing fade (0 before it starts, 1 once gone). */
function leaving(local: number, next: SectionAnchor | undefined): number {
  if (next === undefined) return 0;
  const end = next.from - HANDOVER_GAP / 2;
  return smoothstep(end - HANDOVER_FADE, end, local);
}

/** 0..1 progress of a section's incoming fade (0 before it starts, 1 once fully in). */
function arriving(local: number, anchor: SectionAnchor, index: number): number {
  if (index === 0) return 1;
  const start = anchor.from + HANDOVER_GAP / 2;
  return smoothstep(start, start + HANDOVER_FADE, local);
}

/**
 * Opacity of one section as a pure function of scroll position. The outgoing text is fully gone
 * before the incoming text starts, so two texts never share the screen (spec §5.4a, amended).
 * Under reduced motion it is a hard switch exactly at the anchor, matching the camera cut (§17 S24).
 */
export function sectionOpacity(
  local: number,
  anchors: readonly SectionAnchor[],
  index: number,
  reducedMotion: boolean,
): number {
  const anchor = anchors[index];
  if (anchor === undefined) return 0;
  const next = anchors[index + 1];
  if (reducedMotion) {
    const started = local + ANCHOR_EPSILON >= anchor.from;
    const ended = next !== undefined && local + ANCHOR_EPSILON >= next.from;
    return started && !ended ? 1 : 0;
  }
  return arriving(local, anchor, index) * (1 - leaving(local, next));
}

/** Companion translateY in px for the same handover; always 0 under reduced motion. Pure. */
export function sectionOffset(
  local: number,
  anchors: readonly SectionAnchor[],
  index: number,
  reducedMotion: boolean,
): number {
  const anchor = anchors[index];
  if (reducedMotion || anchor === undefined) return 0;
  const out = leaving(local, anchors[index + 1]);
  // `+ 0` turns -0 into 0, so an unchanged offset is written as 'none', not 'translateY(-0px)'.
  if (out > 0) return EXIT_OFFSET_PX * out + 0;
  if (index === 0) return 0;
  return ENTER_OFFSET_PX * (1 - arriving(local, anchor, index)) + 0;
}

interface Tracked {
  element: HTMLElement;
  lastOpacity: number | undefined;
  lastOffset: number | undefined;
  lastActive: boolean | undefined;
}

/**
 * Writes the handover to the DOM every frame. No timers, no `element.animate()`, no CSS transition
 * on these properties. The last value per element is cached so an unchanged value is never re-applied.
 */
export function createSections(root: HTMLElement, anchors: readonly SectionAnchor[]): Sections {
  const tracked: Tracked[] = [];
  for (const anchor of anchors) {
    const element = root.querySelector<HTMLElement>(`[data-section="${anchor.id}"]`);
    if (element === null) throw new Error(`section ${anchor.id} is missing from index.html`);
    tracked.push({ element, lastOpacity: undefined, lastOffset: undefined, lastActive: undefined });
  }

  const write = (entry: Tracked, opacity: number, offsetPx: number, active: boolean) => {
    if (entry.lastOpacity !== opacity) {
      entry.element.style.opacity = String(opacity);
      entry.lastOpacity = opacity;
    }
    if (entry.lastOffset !== offsetPx) {
      entry.element.style.transform = offsetPx === 0 ? 'none' : `translateY(${offsetPx}px)`;
      entry.lastOffset = offsetPx;
    }
    if (entry.lastActive !== active) {
      entry.element.classList.toggle('is-active', active);
      entry.lastActive = active;
    }
  };

  return {
    show(local, reducedMotion) {
      for (let i = 0; i < tracked.length; i++) {
        const next = anchors[i + 1];
        const active =
          local + ANCHOR_EPSILON >= (anchors[i] as SectionAnchor).from &&
          (next === undefined || local + ANCHOR_EPSILON < next.from);
        write(
          tracked[i] as Tracked,
          sectionOpacity(local, anchors, i, reducedMotion),
          sectionOffset(local, anchors, i, reducedMotion),
          active,
        );
      }
    },
  };
}
