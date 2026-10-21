import { defineConfig, devices } from '@playwright/test';

// Tests run against a production web build (minified, static, cached) on its own port,
// so they don't share the slow 9 MB dev bundle or the dev server you're iterating on.
const PORT = 8090;

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 7_000 },
  // Each test gets a fresh browser context (own localStorage), so they can run side by side.
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['iPhone 13'],
    browserName: 'chromium',
    // The app follows the system scheme; tests and baselines default to dark (light has its own).
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: 'e2e-results',
  webServer: {
    command: `npx expo export -p web --output-dir dist && node e2e/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Always rebuild so tests see the current code.
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
