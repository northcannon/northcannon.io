import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { readRoutes, draftBanner } from '../../src/governance/routes.mjs';
import { paintedBoxes } from '../helpers/boxes.mjs';
import { requiredHeaders } from '../../scripts/policy.mjs';

test.use({ bypassCSP: true });
for (const review of [true, false]) for (const route of readRoutes().filter(r => review || r.publish)) {
  test(`WP4 ${review ? 'review' : 'production'} acceptance ${route.path}`, async ({ page, browser }, testInfo) => {
    const url = `http://127.0.0.1:${review ? 4323 : 4321}` + route.path;
    const response = await page.goto(url);
    expect(response.status()).toBe(200);
    for (const [name, value] of Object.entries(requiredHeaders)) expect(response.headers()[name]).toBe(value);
    await expect(page.locator('script, style, [style], form, input')).toHaveCount(0);
    expect(await page.locator('main h1').evaluate(el => getComputedStyle(el).color)).toBe(route.path.startsWith('/about/') ? 'rgb(247, 244, 255)' : 'rgb(156, 107, 244)');
    if (review || route.path !== '/404.html') {
      await expect(page.locator('.desktop-navigation a').first()).toHaveText('About');
      await expect(page.locator('.mobile-navigation .navigation a').first()).toHaveText('About');
    }
    if (page.viewportSize().width > 1024 && !['/results/', '/evidence/'].includes(route.path)) {
      const copy = await page.locator(route.path === '/' ? '.hero__copy' : route.path === '/about/' ? '.about-split > div' : 'main > .site-container').boundingBox();
      expect(copy.x + copy.width).toBeLessThanOrEqual(page.viewportSize().width / 2);
    }
    expect(await paintedBoxes(page)).toEqual([]);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    const demo = route.path === '/demo/';
    if (demo) {
      expect(await page.locator('main').innerText()).toBe('Demo\nComing Soon');
      expect(await page.locator('.demo-subtitle').evaluate(el => getComputedStyle(el).color)).toBe('rgb(183, 175, 201)');
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
      const title = await page.locator('h1').boundingBox();
      expect(Math.abs(title.y + title.height / 2 - page.viewportSize().height / 2)).toBeLessThan(2);
    } else {
      if (review) await expect(page.getByText(draftBanner, { exact: true })).toBeVisible();
      else await expect(page.getByText(draftBanner, { exact: true })).toHaveCount(0);
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
      await page.locator('main').blur();
    }
    if (['/results/', '/trust/status/'].includes(route.path)) {
      await expect(page.locator('main')).toContainText('Gate 1 — preparation in progress. The evaluation has not been executed, and no results exist yet.');
      await expect(page.locator('table')).toHaveCount(0);
      if (route.path === '/results/') {
        await expect(page.locator('.result-arms h2')).toHaveText(['Treatment', 'Baseline A', 'Baseline B', 'Arm R⁺']);
        for (const arm of await page.locator('.metric-list').all()) {
          await expect(arm.locator('dt')).toHaveCount(14);
          expect(await arm.locator('dd').allTextContents()).toEqual(['Preparation', ...Array(13).fill('Not supplied')]);
        }
      } else expect((await page.locator('main').innerText()).replaceAll('Gate 1', 'Gate')).not.toMatch(/\d/);
    }
    if (route.path.startsWith('/about/')) await expect(page.locator('.about-navigation a')).toHaveText(['Company', 'About the founder']);
    if (route.path === '/about/company/') await expect(page.locator('.company-sections p')).toHaveCount(7);
    if (route.path === '/about/') {
      await expect(page.locator('.concept-preview')).toHaveCount(review ? 1 : 0);
      if (review) {
        await expect(page.locator('.concept-disclaimer')).toContainText('fictional data');
        if (page.viewportSize().width > 1024) expect((await page.locator('.concept-preview').boundingBox()).x).toBeGreaterThanOrEqual(page.viewportSize().width / 2);
        await page.locator('.packet-details summary').click();
        await expect(page.locator('.packet-details p')).toBeVisible();
      }
    }
    if (route.path === '/evidence/') await expect(page.locator('table')).toHaveCount(3);
    if (route.path === '/about/founder/') await expect(page.locator('main')).toContainText('Max Brooks is the founder of NorthCannon.');
    const name = route.path === '/' ? 'home' : route.path.replace(/^\/|\/$/g, '').replaceAll('/', '-').replace('.html', '');
    await mkdir(`test-results/wp4-${review ? 'review' : 'production'}`, { recursive: true });
    await page.screenshot({ path: `test-results/wp4-${review ? 'review' : 'production'}/${name}-${testInfo.project.name === 'mobile' ? 375 : 1440}.png`, fullPage: true });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(page.locator('.graphene')).toBeHidden();
    const normal = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const zoom = await browser.newContext({ viewport: { width: 720, height: 500 }, deviceScaleFactor: 2 });
    try {
      const p1 = await normal.newPage(), p2 = await zoom.newPage();
      await p1.goto(url); await p2.goto(url);
      const size = p => p.locator('h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize) * devicePixelRatio);
      expect(await size(p2) / await size(p1)).toBeCloseTo(2, 2);
      expect(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { await normal.close(); await zoom.close(); }
  });
}

for (const review of [true, false]) test(`WP4 ${review ? 'review' : 'production'} mobile menu works without JavaScript and stays above main`, async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`http://127.0.0.1:${review ? 4323 : 4321}/`);
      const before = await page.locator('main').boundingBox();
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      await expect(page.locator('summary')).toBeFocused();
      await page.keyboard.press('Enter');
      const menu = await page.locator('.mobile-navigation .navigation').boundingBox();
      const after = await page.locator('main').boundingBox();
      expect(menu.y + menu.height).toBeLessThanOrEqual(after.y);
      expect(after.y).toBeGreaterThan(before.y);
      await page.screenshot({ path: testInfo.outputPath(`wp4-menu-${width}.png`), fullPage: true });
      await page.keyboard.press('Space');
      expect((await page.locator('main').boundingBox()).y).toBe(before.y);
    }
  } finally { await context.close(); }
});
