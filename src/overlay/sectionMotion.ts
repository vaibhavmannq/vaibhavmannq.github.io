import gsap from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { SplitText } from 'gsap/SplitText';
import type { SectionMotionHook } from './sections';

gsap.registerPlugin(SplitText, ScrambleTextPlugin);

const KICKER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ·';

/**
 * A chapter's text motion (redesign, 2026-09-22). As it arrives, its lines rise through masks and its
 * log-style title types itself in; as it leaves, the lines lift away and the title fades.
 *
 * It is one paused GSAP timeline, 0..1 arriving then 1..2 leaving, whose position is set from the
 * scroll handover (sections.ts), never played on a clock, so scrolling back reverses it exactly (spec
 * §5.4a). Screen readers get the real text: SplitText labels what it splits, and the typed title is an
 * aria-hidden copy of a visually hidden one (index.html).
 */
export function createSectionMotion(section: HTMLElement): SectionMotionHook {
  const kicker = section.querySelector<HTMLElement>('[data-kicker]');
  const kickerText = kicker?.dataset.kicker ?? '';
  const revealed = [...section.querySelectorAll<HTMLElement>('[data-reveal]')];
  const lineSplits = new Map<HTMLElement, SplitText>();
  let timeline = gsap.timeline({ paused: true });
  let position = -1;
  let queued = false;

  const build = () => {
    queued = false;
    timeline.kill();
    const parts: Element[] = [];
    for (const element of revealed) parts.push(...(lineSplits.get(element)?.lines ?? [element]));
    if (kicker) kicker.textContent = '';

    const arrive = gsap.timeline();
    arrive.fromTo(
      parts,
      { yPercent: 115 },
      { yPercent: 0, duration: 0.6, stagger: 0.07, ease: 'expo.out', immediateRender: false },
      0.1,
    );
    if (kicker) {
      arrive.to(
        kicker,
        { scrambleText: { text: kickerText, chars: KICKER_CHARS, speed: 0.6 }, duration: 0.5, ease: 'none' },
        0,
      );
    }
    arrive.duration(1);

    const leave = gsap.timeline();
    leave.fromTo(
      parts,
      { yPercent: 0 },
      { yPercent: -115, duration: 0.45, stagger: 0.04, ease: 'power3.in', immediateRender: false },
      0,
    );
    if (kicker) leave.fromTo(kicker, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3, immediateRender: false }, 0);
    leave.duration(1);

    timeline = gsap.timeline({ paused: true }).add(arrive, 0).add(leave, 1);
    if (position >= 0) timeline.seek(position);
  };
  const rebuildSoon = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(build);
  };

  for (const element of revealed) {
    if (element.dataset.reveal !== 'lines') continue;
    // Lines move behind masks; SplitText splits again when fonts load or the width changes.
    SplitText.create(element, {
      type: 'lines',
      mask: 'lines',
      // No aria-label: it is not allowed on a paragraph (axe aria-prohibited-attr), and line wrappers
      // leave the words intact for screen readers anyway.
      aria: 'none',
      autoSplit: true,
      onSplit: (split) => {
        lineSplits.set(element, split);
        rebuildSoon();
      },
    });
  }
  build();

  return {
    set(arrive, leave) {
      const next = arrive < 1 ? arrive : 1 + leave;
      if (next === position) return;
      position = next;
      timeline.seek(next);
    },
  };
}
