import type { Tier } from '../quality/tiers';
import { clamp01 } from '../shared/math';

/** Debug and test hooks read from the URL (spec §12.2). */
export interface DebugParams {
  tier?: Tier;
  p?: number;
  time?: number;
  /** `?moon=`: 0..1 override for the lunar phase (0 = new, 0.5 = full). Undefined falls back to tonight's real phase. */
  moon?: number;
  /** `?length=`: Moonsink's scroll length in screen heights, for tuning by feel (clamped 1.5–4). */
  length?: number;
  hud: boolean;
  gui: boolean;
  forceWebGL: boolean;
  stills: boolean;
  /** `?bare`: hide the text layer, for rendering the stills and the project cover (scripts/capture.mjs). */
  bare: boolean;
  /** `?fit=inset`: keep the normal window's margin on a laptop instead of the edge (owner review, 2026-09-26). */
  fit?: 'inset';
  /** `?demo`: three placeholder projects beside Moonlit, to judge the Projects page with several (owner review). */
  demo: boolean;
  /** `?cards=list|row`: how several projects are laid out, on every screen (owner review). */
  cards?: 'list' | 'row';
}

export function readDebugParams(search: string): DebugParams {
  const query = new URLSearchParams(search);

  const number = (key: string): number | undefined => {
    const raw = query.get(key);
    if (raw === null || raw.trim() === '') return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };

  const tierValue = number('tier');
  const tier =
    tierValue !== undefined && Number.isInteger(tierValue) && tierValue >= 0 && tierValue <= 4
      ? (tierValue as Tier)
      : undefined;
  const progress = number('p');
  const moonValue = number('moon');
  const lengthValue = number('length');
  const only = <T extends string>(key: string, values: readonly T[]): T | undefined =>
    values.find((value) => value === query.get(key));

  return {
    tier,
    p: progress === undefined ? undefined : clamp01(progress),
    time: number('time'),
    // Non-numeric or blank falls back to `undefined` (real date, via resolveMoonPhase);
    // a numeric but out-of-range value is clamped rather than thrown away.
    moon: moonValue === undefined ? undefined : clamp01(moonValue),
    length: lengthValue === undefined ? undefined : Math.min(4, Math.max(1.5, lengthValue)),
    hud: query.has('hud'),
    gui: query.has('gui'),
    forceWebGL: query.has('webgl'),
    stills: query.has('stills'),
    bare: query.has('bare'),
    fit: only('fit', ['inset']),
    demo: query.has('demo'),
    cards: only('cards', ['list', 'row']),
  };
}
