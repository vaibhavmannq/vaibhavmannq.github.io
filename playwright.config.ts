import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  // Headless browsers render WebGL on the CPU; compiling the Phase 1 sea alone can take ~20 s there
  timeout: 120_000,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  // Tests always run against the production build, never the dev server.
  // CI already builds in an earlier workflow step, so skip rebuilding here.
  webServer: {
    command: isCI ? 'npm run preview' : 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
