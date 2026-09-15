import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { requiredHeaders } from '../../scripts/policy.mjs';

test('home hero headline stays within two lines at default text size', async ({ page }, testInfo) => {
  const measurements = [];
  for (const width of [320, 360, 375, 390, 414, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const title = await page.locator('.home-hero__title').evaluate(el => ({ lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)) }));
    expect(title.lines, `headline lines at ${width}px`).toBeLessThanOrEqual(width >= 390 ? 2 : 3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow at ${width}px`).toBe(true);
    measurements.push({ width, ...title });
  }
  await testInfo.attach('headline-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
});

test('design tokens and layout system match the implementation brief', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:4323/');
  const tokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return Object.fromEntries(['--color-bg', '--color-panel', '--color-elevated', '--color-text', '--color-muted', '--color-border', '--color-violet', '--color-indigo', '--color-verified', '--color-pending', '--color-failed', '--margin', '--gutter', '--section-space', '--radius-card', '--nav-height', '--text-width', '--canvas'].map(k => [k, s.getPropertyValue(k).trim()]));
  });
  expect(tokens).toEqual({ '--color-bg': '#0a0a0d', '--color-panel': '#121216', '--color-elevated': '#1c1c22', '--color-text': '#f5f7fb', '--color-muted': '#a7b1c2', '--color-border': '#2e2e3b', '--color-violet': '#8b5cf6', '--color-indigo': '#6366f1', '--color-verified': '#22c55e', '--color-pending': '#f59e0b', '--color-failed': '#ef4444', '--margin': '72px', '--gutter': '24px', '--section-space': '96px', '--radius-card': '16px', '--nav-height': '80px', '--text-width': '760px', '--canvas': '1440px' });
  expect(await page.locator('.panel').first().evaluate(el => getComputedStyle(el).borderRadius)).toBe('16px');
  expect(await page.locator('.home-hero').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(12);
  expect(await page.locator('.home-hero').evaluate(el => getComputedStyle(el).columnGap)).toBe('24px');
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await page.locator('main .site-container').boundingBox()).x).toBe(24);
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
  page.on('response', response => { if (response.headers()['set-cookie']) unexpected.push('Set-Cookie'); });
  const response = await page.goto('http://127.0.0.1:4322/');
  for (const [key, value] of Object.entries(requiredHeaders)) expect(response.headers()[key]).toBe(value);
  await expect(page.locator('script, style, form, [style], [onclick]')).toHaveCount(0);
  const menu = page.locator('.mobile-navigation summary');
  const mobile = await menu.isVisible();
  if (mobile) await menu.click();
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Company', exact: true }).first()).toHaveAttribute('aria-current', 'page');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (mobile) await page.reload();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Primary link' })).toBeFocused();
  expect(await page.getByRole('link', { name: 'Primary link' }).evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  expect(unexpected).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('components.png'), fullPage: true });
});

test('hex pattern remains decorative and content reflows at narrow width and large text', async ({ page }) => {
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
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expect(page.locator('.graphene')).toBeHidden();
});

// Explicitly retain the keyboard-only/no-script acceptance control.
test('native menu opens and closes by keyboard with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4322/');
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    await expect(page.locator('summary')).toBeFocused();
    await page.keyboard.press('Enter');
    const links = page.locator('.mobile-navigation .navigation a');
    await expect(links).toHaveCount(8);
    await expect(links.first()).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(links.first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Space');
    await expect(page.locator('.mobile-navigation .navigation')).toBeHidden();
  } finally { await context.close(); }
});

test('200 percent text doubles heading size and reflows at 720px', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 500 });
  await page.goto('/');
  const size = () => page.locator('h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  const before = await size();
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await size() / before).toBeCloseTo(2, 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
