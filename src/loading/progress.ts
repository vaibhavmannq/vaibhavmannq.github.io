/** Share of the lantern's glow that compiling fills, after every byte has arrived (plan world-to-100 Task 6). */
const COMPILE_SHARE = 0.15;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * The lantern room's progress, 0..1: the downloads by bytes, then compiling as the last 15 %. Pure.
 * `compiled` is the share of the first view's parts compiled (0..1).
 */
export function loadProgress(parts: readonly { bytes: number; done: number }[], compiled: number): number {
  const total = parts.reduce((s, p) => s + Math.max(0, p.bytes), 0);
  const done = parts.reduce((s, p) => s + clamp01(p.done / Math.max(1, p.bytes)) * Math.max(0, p.bytes), 0);
  const bytes = total > 0 ? done / total : 1;
  return clamp01((1 - COMPILE_SHARE) * bytes + COMPILE_SHARE * clamp01(compiled));
}
