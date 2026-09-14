import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { requiredHeaders } from '../../scripts/policy.mjs';

for (const route of ['/', '/404.html']) {
  test(`${route} is accessible, local, and static`, async ({ page, context }, testInfo) => {
    const unexpected = [];
    await page.route('**/*', async request => {
      if (new URL(request.request().url()).origin !== 'http://127.0.0.1:4321' || request.request().resourceType() === 'script') {
        unexpected.push(request.request().url());
        await request.abort();
      } else await request.continue();
    });
    page.on('response', response => {
      if (response.headers()['set-cookie']) unexpected.push('Set-Cookie');
    });
    const response = await page.goto(route);
    expect(response.status()).toBe(200);
    for (const [key, value] of Object.entries(requiredHeaders)) expect(response.headers()[key]).toBe(value);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('script, style, form, [style]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('main .site-container').evaluate(el => el.getBoundingClientRect().left)).toBeGreaterThanOrEqual(20);
    // Axe is test-runner instrumentation, never a page dependency or output script.
    const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(report.violations).toEqual([]);
    expect(unexpected).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('page.png'), fullPage: true });
    if (route === '/404.html') {
      const left = selector => page.locator(selector).evaluate(el => el.getBoundingClientRect().left);
      expect(await left('main .site-container')).toBeCloseTo(await left('.site-header__inner'), 1);
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Return home' })).toBeFocused();
      expect(await page.getByRole('link', { name: 'Return home' }).evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    }
  });
}

test('works with browser JavaScript disabled and handles missing routes', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.getByRole('heading', { name: 'NorthCannon', exact: true })).toBeVisible();
  const response = await page.goto('http://127.0.0.1:4321/missing/');
  expect(response.status()).toBe(404);
  await page.getByRole('link', { name: 'Return home' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4321/');
  await context.close();
});
