import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { requiredHeaders } from '../../scripts/policy.mjs';

test('home brand title stays on one line at default text size', async ({ page }, testInfo) => {
  const measurements = [];
  for (const width of [320, 360, 375, 390, 414, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const title = await page.locator('.hero__title').evaluate(el => {
      const style = getComputedStyle(el);
      const range = document.createRange();
      range.selectNodeContents(el);
      return {
        fontSize: style.fontSize,
        lineHeight: parseFloat(style.lineHeight),
        height: el.getBoundingClientRect().height,
        columnWidth: el.getBoundingClientRect().width,
        textWidth: range.getBoundingClientRect().width,
        lines: range.getClientRects().length,
      };
    });
    expect(title.lines, `title line count at ${width}px`).toBe(1);
    expect(title.height, `title height at ${width}px`).toBeLessThan(title.lineHeight * 1.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow at ${width}px`).toBe(true);
    measurements.push({ width, ...title });
    if ([320, 375, 1440].includes(width)) {
      await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });
    }
  }
  await testInfo.attach('title-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
  console.log(`N1 title measurements (${testInfo.project.name}): ${JSON.stringify(measurements)}`);
});

test('component review supports wrapping, contrast, keyboard use, and static security', async ({ page, context }, testInfo) => {
  const unexpected = [];
  await page.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4322' || request.resourceType() === 'script') {
      unexpected.push(request.url());
      await route.abort();
    } else await route.continue();
  });
  page.on('response', response => {
    if (response.headers()['set-cookie']) unexpected.push('Set-Cookie');
  });
  const response = await page.goto('http://127.0.0.1:4322/');
  for (const [key, value] of Object.entries(requiredHeaders)) expect(response.headers()[key]).toBe(value);
  await expect(page.locator('script, style, form, [style], [onclick]')).toHaveCount(0);
  const menu = page.locator('.mobile-navigation summary');
  const mobile = await menu.isVisible();
  if (mobile) {
    await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(0);
    await menu.click();
  }
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link')).toHaveCount(8);
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (mobile) {
    await page.screenshot({ path: testInfo.outputPath('menu-open.png'), fullPage: true });
    await menu.click();
    await page.reload();
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Primary link' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Secondary link' })).toBeFocused();
  expect(unexpected).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('components.png'), fullPage: true });
});

test('native mobile menu works by keyboard with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4322/');
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Wordmark
    await page.keyboard.press('Tab');
    const menu = page.locator('.mobile-navigation summary');
    await expect(menu).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(8);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Home', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Space');
    await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(0);
  } finally { await context.close(); }
});

test('headings and motto double in the 720px 2x zoom simulation', async ({ browser }, testInfo) => {
  // Half the CSS viewport and twice the device scale models desktop zoom geometry.
  // This is not automation of the browser toolbar's zoom setting.
  const normal = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const zoomed = await browser.newContext({ viewport: { width: 720, height: 500 }, deviceScaleFactor: 2 });
  try {
    const before = await normal.newPage();
    const after = await zoomed.newPage();
    for (const [url, selectors, name] of [
      ['http://127.0.0.1:4321/', ['.hero__title', '.hero__motto'], 'home'],
      ['http://127.0.0.1:4321/404.html', ['.page-title'], '404'],
      ['http://127.0.0.1:4322/', ['.page-title'], 'components'],
    ]) {
      await before.goto(url);
      await after.goto(url);
      for (const selector of selectors) {
        const physicalSize = locator => locator.evaluate(el => parseFloat(getComputedStyle(el).fontSize) * window.devicePixelRatio);
        expect(await physicalSize(after.locator(selector)) / await physicalSize(before.locator(selector))).toBeCloseTo(2, 2);
        await expect(after.locator(selector)).toBeVisible();
      }
      expect(await after.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await after.screenshot({ path: testInfo.outputPath(`${name}-zoom.png`), fullPage: true });
    }
  } finally { await normal.close(); await zoomed.close(); }
});

test('graphene remains decorative and content reflows at narrow width and large text', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await expect(page.locator('.graphene')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.graphene img')).toHaveAttribute('alt', '');
  expect(await page.locator('.graphene').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await page.evaluate(() => {
    const lattice = document.querySelector('.graphene').getBoundingClientRect();
    const body = document.body.getBoundingClientRect();
    return lattice.width >= body.width && lattice.height >= body.height;
  })).toBe(true);
  // Browser-side test instrumentation, not emitted site code or inline CSS.
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('heading', { name: 'NorthCannon', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('large-text.png'), fullPage: true });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expect(page.locator('.graphene')).toBeHidden();
});
