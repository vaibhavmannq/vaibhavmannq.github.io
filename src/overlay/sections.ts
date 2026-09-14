import type { SectionId } from '../journey/types';
import { smoothstep } from '../shared/math';

export interface Sections {
  /** Called every frame with the resolved journey state. `mix` is `JourneyState.sectionMix` —
   *  a pure 0..1 position between this section's own anchor and the next one's. */
  show(id: SectionId, mix: number, reducedMotion: boolean): void;
}

/** Fraction of the gap between two section anchors, right before the next anchor's `from`, over
 *  which the outgoing and incoming section text crossfade. Keeping this well under 1 confines
 *  the handover to a brief moment near the boundary rather than smearing it across the whole
 *  time a section is on screen (owner check, brief step 6: "a brief moment where both are
 *  partly visible"). */
export const CROSSFADE_BAND = 0.3;

/** Pixel offset applied to text while it crossfades; dropped entirely under reduced motion. */
const EXIT_OFFSET_PX = -12;
const ENTER_OFFSET_PX = 16;

export type CrossfadeRole = 'outgoing' | 'incoming';

/** How far into the crossfade band `mix` sits: 0 before the band starts, 1 exactly at the next
 *  anchor. Pure — no DOM, no clock, no allocation. */
function crossfadeT(mix: number): number {
  return smoothstep(1 - CROSSFADE_BAND, 1, mix);
}

/**
 * Opacity for one side of a section crossfade, as a pure function of scroll position (§5.4a).
 * `mix` is `JourneyState.sectionMix`. Reduced motion is a hard switch exactly at the next anchor:
 * the text changes in the same frame as the section id and the reduced-motion camera cut, so the
 * visitor sees one cut, not two (§5.4a, §17 S24). It is still driven by `mix`, never by a clock.
 * Exported and side-effect free so it can be unit-tested directly; the DOM writes live in
 * `createSections` below.
 */
export function crossfadeOpacity(role: CrossfadeRole, mix: number, reducedMotion: boolean): number {
  if (reducedMotion) {
    const past = mix >= 1;
    return role === 'outgoing' ? (past ? 0 : 1) : past ? 1 : 0;
  }
  const t = crossfadeT(mix);
  return role === 'outgoing' ? 1 - t : t;
}

/** Companion translateY offset (px) for the same crossfade; always 0 under reduced motion
 *  (§5.4a: "no translate offset"). Pure, same shape as `crossfadeOpacity`. */
export function crossfadeOffset(role: CrossfadeRole, mix: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const t = crossfadeT(mix);
  // `+ 0` normalizes away -0 (e.g. EXIT_OFFSET_PX * 0), which would otherwise round-trip into
  // an unnecessary `translateY(-0px)` string instead of the plain 'none' used for "no offset".
  const value = role === 'outgoing' ? EXIT_OFFSET_PX * t : ENTER_OFFSET_PX * (1 - t);
  return value + 0;
}

interface Tracked {
  element: HTMLElement;
  lastOpacity: number | undefined;
  lastOffset: number | undefined;
  lastActive: boolean | undefined;
}

/**
 * Renders section text as a pure function of scroll position (§5.4a). No `element.animate()`,
 * no `setTimeout`, no CSS transition on the properties written here — opacity and transform are
 * assigned directly every frame, and the last value written per element is cached so an
 * unchanged value is never re-applied (avoids per-frame style invalidation).
 */
export function createSections(root: HTMLElement): Sections {
  const ids: SectionId[] = [];
  const tracked: Tracked[] = [];
  const indexById = new Map<SectionId, number>();

  for (const element of root.querySelectorAll<HTMLElement>('[data-section]')) {
    const id = element.dataset.section as SectionId | undefined;
    if (!id) continue;
    indexById.set(id, ids.length);
    ids.push(id);
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
    show(id, mix, reducedMotion) {
      const currentIndex = indexById.get(id);
      if (currentIndex === undefined) return;
      // Only the DOM-adjacent next section is a crossfade partner. When `id` is the last one,
      // there is nothing to hand off to — `mix` is pinned at 1 forever in that case (§5.2), so
      // it must be ignored rather than fed into the crossfade maths (that would fade the last
      // section to 0 and leave it there).
      const hasNext = currentIndex + 1 < tracked.length;

      for (let i = 0; i < tracked.length; i++) {
        const entry = tracked[i] as Tracked;
        if (i === currentIndex) {
          const opacity = hasNext ? crossfadeOpacity('outgoing', mix, reducedMotion) : 1;
          const offset = hasNext ? crossfadeOffset('outgoing', mix, reducedMotion) : 0;
          write(entry, opacity, offset, true);
        } else if (hasNext && i === currentIndex + 1) {
          write(
            entry,
            crossfadeOpacity('incoming', mix, reducedMotion),
            crossfadeOffset('incoming', mix, reducedMotion),
            false,
          );
        } else {
          write(entry, 0, 0, false);
        }
      }
    },
  };
}
