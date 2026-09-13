import type { Page } from '@playwright/test';

/** Start collecting console errors and uncaught exceptions; read the array at the end of the test. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Wait until boot has published window.__moonlit (after shaders compile, or immediately in stills mode). */
export async function waitForMoonlit(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__moonlit !== undefined, undefined, { timeout: 90_000 });
}
