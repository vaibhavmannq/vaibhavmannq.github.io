import { MOONSINK_LENGTH } from '../journey/journey.config';
import { ANCHOR_EPSILON } from '../journey/timeline';
import type { SectionAnchor, SectionId } from '../journey/types';
import { damp, smoothstep } from '../shared/math';

export interface Sections {
  /**
   * Called every frame with the region-local scroll position (0..1). `dtSeconds` lets the text travel
   * toward its scroll position instead of jumping there; leave it out (or pass 0) to land at once, which
   * is what the first frame, a deep link and Skip intro all want.
   */
  show(local: number, reducedMotion: boolean, dtSeconds?: number): void;
}

/**
 * How much of the region (0..1) each text fade takes: 0.27 of a screen height of scroll. That is the
 * 0.1 of the 2.7-screen journey the owner tuned by feel (journey-flow design §5.1), kept in screens so
 * pages 1 and 2 feel the same now that the Projects page makes the journey longer.
 */
export const HANDOVER_FADE = 0.34 / MOONSINK_LENGTH;
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

/**
 * How quickly the text catches up with the scroll, as a damping rate (shared/math.ts). The handover is
 * still a pure function of scroll position; this only decides how fast the text travels toward it. A snap
 * glide covers a whole page in about a second, and following that exactly made the next chapter appear all
 * at once (owner, 2026-09-25: the text "suddenly pops"). At 4.5 the text trails the scroll by roughly a
 * quarter of a second and settles just after it, which reads as arriving rather than appearing. The camera
 * has followed the same way since 2026-09-14 (cameraPath.ts).
 */
export const CATCH_UP = 3.5;
/** Below this, land exactly: an asymptote never reaches 1, and the page needs exact 0 and 1 to settle. */
const SETTLED = 0.008;

/** Land exactly on the target once the difference stops being visible. */
const settle = (value: number, target: number): number => (Math.abs(target - value) < SETTLED ? target : value);

/**
 * How fast the shown page leaves when the scroll has already moved on to a different page: about 0.25 s. A fast
 * scroll used to leave every page it passed half faded at once, because each page eased toward its own target
 * (owner report, spec 2026-09-25 §4.12).
 */
export const LEAVE_FAST = 12;

/** Where a page is in its handover as shown on screen, which may trail the scroll. */
export interface Shown {
  arrive: number;
  leave: number;
}

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

/** A section's place in the handover: how far it has arrived, and how far it has left. Pure. */
export function handoverAt(
  local: number,
  anchors: readonly SectionAnchor[],
  index: number,
  reducedMotion: boolean,
): { arrive: number; leave: number } {
  const anchor = anchors[index];
  if (anchor === undefined) return { arrive: 0, leave: 0 };
  const next = anchors[index + 1];
  if (reducedMotion) {
    const started = local + ANCHOR_EPSILON >= anchor.from;
    const ended = next !== undefined && local + ANCHOR_EPSILON >= next.from;
    return { arrive: started ? 1 : 0, leave: ended ? 1 : 0 };
  }
  return { arrive: arriving(local, anchor, index), leave: leaving(local, next) };
}

/** Opacity from a place in the handover: fully arrived and not yet leaving is 1. Pure. */
export const opacityFrom = (arrive: number, leave: number): number => arrive * (1 - leave);

/** The companion drift in px: up on the way out, up from below on the way in. Pure. */
export function offsetFrom(arrive: number, leave: number, index: number): number {
  // `+ 0` turns -0 into 0, so an unchanged offset is written as 'none', not 'translateY(-0px)'.
  if (leave > 0) return EXIT_OFFSET_PX * leave + 0;
  if (index === 0) return 0;
  return ENTER_OFFSET_PX * (1 - arrive) + 0;
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
  const { arrive, leave } = handoverAt(local, anchors, index, reducedMotion);
  return opacityFrom(arrive, leave);
}

/**
 * True where the scroll shows this page at full opacity. The journey names a page from its anchor on, while it is
 * still fading in, so "the current section" is not "on screen": focus landing mid-glide was left half transparent
 * (final review I2). Pure.
 */
export function fullyShown(
  local: number,
  anchors: readonly SectionAnchor[],
  id: SectionId,
  reducedMotion: boolean,
): boolean {
  const index = anchors.findIndex((anchor) => anchor.id === id);
  return index >= 0 && sectionOpacity(local, anchors, index, reducedMotion) >= 0.999;
}

/** Companion translateY in px for the same handover; always 0 under reduced motion. Pure. */
export function sectionOffset(
  local: number,
  anchors: readonly SectionAnchor[],
  index: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion || anchors[index] === undefined) return 0;
  const { arrive, leave } = handoverAt(local, anchors, index, reducedMotion);
  return offsetFrom(arrive, leave, index);
}

/**
 * The handover as shown: at most one page is visible, ever. The page under the scroll eases toward its
 * scroll-derived target as before. When the scroll lands on a different page, the shown one leaves fast
 * (up and out when the new page is further on, sinking back when it is earlier) and only then does the new
 * page start to arrive. Pages that were only flown past never appear. Pure: no DOM, no clock.
 */
export function createHandover(anchors: readonly SectionAnchor[]) {
  const state: Shown[] = anchors.map(() => ({ arrive: 0, leave: 0 }));
  let shown = -1;
  let started = false;

  return {
    step(local: number, reducedMotion: boolean, dtSeconds = 0): readonly Shown[] {
      let wanted = -1;
      for (let i = 0; i < anchors.length; i++) {
        const target = handoverAt(local, anchors, i, reducedMotion);
        if (opacityFrom(target.arrive, target.leave) > 0) wanted = i;
      }

      const smooth = dtSeconds > 0 && !reducedMotion && started;
      started = true;
      if (!smooth) {
        for (let i = 0; i < anchors.length; i++) {
          const target = handoverAt(local, anchors, i, reducedMotion);
          const entry = state[i] as Shown;
          entry.arrive = target.arrive;
          entry.leave = target.leave;
        }
        shown = wanted;
        return state;
      }

      if (shown !== -1 && wanted !== -1 && wanted !== shown) {
        const leaving = state[shown] as Shown;
        if (wanted > shown) leaving.leave = settle(damp(leaving.leave, 1, LEAVE_FAST, dtSeconds), 1);
        else leaving.arrive = settle(damp(leaving.arrive, 0, LEAVE_FAST, dtSeconds), 0);
        if (opacityFrom(leaving.arrive, leaving.leave) <= SETTLED) {
          leaving.arrive = 0;
          leaving.leave = 0;
          shown = wanted;
        }
      }
      if (shown === -1) shown = wanted;

      for (let i = 0; i < anchors.length; i++) {
        if (i === shown) continue;
        const hidden = state[i] as Shown;
        hidden.arrive = 0;
        hidden.leave = 0;
      }
      if (shown !== -1 && (wanted === shown || wanted === -1)) {
        const target = handoverAt(local, anchors, shown, reducedMotion);
        const entry = state[shown] as Shown;
        entry.arrive = settle(damp(entry.arrive, target.arrive, CATCH_UP, dtSeconds), target.arrive);
        entry.leave = settle(damp(entry.leave, target.leave, CATCH_UP, dtSeconds), target.leave);
      }
      return state;
    },
  };
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
/** A chapter's text motion (overlay/sectionMotion.ts), driven by the same handover as its opacity. */
export interface SectionMotionHook {
  /** arrive: 0..1 of the incoming handover; leave: 0..1 of the outgoing one. */
  set(arrive: number, leave: number): void;
}

export function createSections(
  root: HTMLElement,
  anchors: readonly SectionAnchor[],
  motions: ReadonlyMap<SectionId, SectionMotionHook> = new Map(),
): Sections {
  const tracked: Tracked[] = [];
  for (const anchor of anchors) {
    const element = root.querySelector<HTMLElement>(`[data-section="${anchor.id}"]`);
    if (element === null) throw new Error(`section ${anchor.id} is missing from index.html`);
    tracked.push({
      element,
      lastOpacity: undefined,
      lastOffset: undefined,
      lastActive: undefined,
    });
  }
  const handover = createHandover(anchors);

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
    show(local, reducedMotion, dtSeconds = 0) {
      // Travel toward the scroll's handover, one page at a time; land on it at once when asked (dtSeconds 0).
      const shown = handover.step(local, reducedMotion, dtSeconds);
      for (let i = 0; i < tracked.length; i++) {
        const entry = tracked[i] as Tracked;
        const anchor = anchors[i] as SectionAnchor;
        const next = anchors[i + 1];
        const active =
          local + ANCHOR_EPSILON >= anchor.from && (next === undefined || local + ANCHOR_EPSILON < next.from);
        const { arrive, leave } = shown[i] as Shown;
        write(entry, opacityFrom(arrive, leave), reducedMotion ? 0 : offsetFrom(arrive, leave, i), active);
        // Under reduced motion the text stays still: fully arrived, never leaving (it switches instead).
        motions.get(anchor.id)?.set(arrive, leave);
      }
    },
  };
}
