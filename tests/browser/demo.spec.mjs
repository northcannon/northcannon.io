import { test, expect } from '@playwright/test';

for (const [mode, base] of [['review', 'http://127.0.0.1:4323'], ['production', 'http://127.0.0.1:4321']]) {
  test(`${mode} demo is coming soon and withdrawn from navigation`, async ({ page }) => {
    await page.goto(base + '/demo/');
    await expect(page).toHaveTitle(/Demo — Coming Soon/);
    await expect(page.locator('h1')).toHaveText('Demo — Coming Soon');
    await expect(page.locator('.site-header, .site-footer')).toHaveCount(2);
    await expect(page.locator('.primary-nav a[href="/demo/"]')).toHaveCount(0);
    await expect(page.locator('video, track, .demo-transcript, .ci-figure')).toHaveCount(0);
    await expect(page.locator('main .lede')).toHaveCount(1);
    await expect(page.locator('main .lede')).toHaveText('A product demonstration will be published once an approved demonstration exists.');
    if (mode === 'production') for (const file of ['northcannon-demo.mp4', 'northcannon-demo.en.vtt', 'northcannon-demo-poster.webp']) {
      expect((await page.request.get(base + '/demo/' + file)).status()).toBe(404);
    }
  });
}
