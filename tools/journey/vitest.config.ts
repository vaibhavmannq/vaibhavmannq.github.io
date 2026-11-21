import { defineConfig } from 'vitest/config';

// The journey's reports run under Vitest (they import src modules); `npm run journey`.
export default defineConfig({
  test: { include: ['tools/journey/*_report.test.ts'], environment: 'node', root: '.' },
});
