import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.0.1:4321', browserName: 'chromium' },
  webServer: [
    { command: 'node scripts/serve.mjs .review-dist-wp4 4323', url: 'http://127.0.0.1:4323', reuseExistingServer: false },
    { command: 'npm run preview', url: 'http://127.0.0.1:4321', reuseExistingServer: false },
    { command: 'npm run build:review && node scripts/serve.mjs .review-dist 4322', url: 'http://127.0.0.1:4322', reuseExistingServer: false },
  ],
  projects: [
    { name: 'mobile', use: { viewport: { width: 375, height: 812 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
  ],
});
