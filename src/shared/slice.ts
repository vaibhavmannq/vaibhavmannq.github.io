/**
 * Long builds written as generators: each `yield` marks a point where the work may stop for the browser (s29, plan
 * world-to-100 Task 7b: the lantern room froze while the world was built behind it). The same generator runs in one go
 * (`runAll`, tests and tools) or in slices (`runSliced`, the page), with the same result.
 */
export function runAll<T>(steps: Generator<void, T>): T {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}

/** Runs `steps`, pausing (`pause()`) whenever a slice has run `budgetMs` or more. */
export async function runSliced<T>(
  steps: Generator<void, T>,
  budgetMs: number,
  pause: () => Promise<void>,
  now: () => number = () => performance.now(),
): Promise<T> {
  let since = now();
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
    if (now() - since >= budgetMs) {
      await pause();
      since = now();
    }
  }
}
