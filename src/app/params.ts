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
  /** `?pace=full`: render every vsync instead of an even divisor near 60 fps (owner review, spec §7). */
  pace?: 'full';
  /** `?march=old`: the sea's ray march as it was before the bounding plane (owner review, spec §7). */
  march?: 'old';
  /** `?glints=old`: sand glints strongest at the camera, as before (owner review, spec §7). */
  glints?: 'old';
  /** `?frame=old`: text sized by the window, not fitted to the scene's 16:9 frame (owner review, spec §7). */
  frame?: 'old';
  /** `?snap=wheel`: mouse and trackpad snap to pages like touch (owner review, spec §7). */
  snap?: 'wheel';
  hud: boolean;
  gui: boolean;
  forceWebGL: boolean;
  stills: boolean;
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
  const only = <T extends string>(key: string, value: T): T | undefined =>
    query.get(key) === value ? value : undefined;

  return {
    tier,
    p: progress === undefined ? undefined : clamp01(progress),
    time: number('time'),
    // Non-numeric or blank falls back to `undefined` (real date, via resolveMoonPhase);
    // a numeric but out-of-range value is clamped rather than thrown away.
    moon: moonValue === undefined ? undefined : clamp01(moonValue),
    length: lengthValue === undefined ? undefined : Math.min(4, Math.max(1.5, lengthValue)),
    pace: only('pace', 'full'),
    march: only('march', 'old'),
    glints: only('glints', 'old'),
    frame: only('frame', 'old'),
    snap: only('snap', 'wheel'),
    hud: query.has('hud'),
    gui: query.has('gui'),
    forceWebGL: query.has('webgl'),
    stills: query.has('stills'),
  };
}
