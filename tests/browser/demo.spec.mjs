import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

const REVIEW = 'http://127.0.0.1:4323';
const PRODUCTION = 'http://127.0.0.1:4321';
const alt = 'Illustration: when a rule or fact changes, only the decisions that depended on it are flagged for re-evaluation; unrelated decisions are left untouched.';
// Review screenshots go to a gitignored directory that Playwright never wipes.
const shots = '.review-shots';
test.use({ bypassCSP: true });

test.describe('demo page (review build)', () => {
  test('uses the full site shell with Demo in the navigation', async ({ page }, testInfo) => {
    await page.goto(REVIEW + '/demo/');
    await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.locator('.site-footer')).toBeVisible();
    await expect(page.locator('.graphene')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Demo — Coming Soon');
    if (testInfo.project.name !== 'desktop') await page.locator('.mobile-navigation summary').click();
    const nav = testInfo.project.name === 'desktop' ? page.locator('.desktop-navigation') : page.locator('.mobile-navigation .navigation');
    await expect(nav.getByRole('link', { name: 'Demo', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Demo', exact: true })).toHaveAttribute('href', '/demo/');
    // Order: ... About, Company, Features, Founder, Demo, Contact.
    const labels = await nav.getByRole('link').allTextContents();
    expect(labels.slice(-2)).toEqual(['Demo', 'Contact']);
  });

  test('the graphic is static markup with a resolvable accessible name and no text elements', async ({ page }) => {
    await page.goto(REVIEW + '/demo/');
    await expect(page.locator('script')).toHaveCount(0);
    const svg = page.locator('svg.ci-svg');
    await expect(svg).toHaveAttribute('role', 'img');
    await expect(svg).toHaveAttribute('viewBox', '0 0 1200 560');
    await expect(svg.locator('text, tspan, animate, set, animateTransform, script, foreignObject')).toHaveCount(0);
    await expect(svg.locator('[style]')).toHaveCount(0);
    await expect(page.getByRole('img', { name: alt })).toBeVisible();
    await expect(page.locator('.ci-caption')).toHaveText(alt);
    await expect(page.locator('.ci-figure .disclosure-line')).toHaveText('Illustrative animation · not a live system');
    await expect(page.locator('.module__head')).toHaveText('Change Intelligence');
    // The disclosure note itself says "not a live system"; every other string avoids these words.
    const copy = await page.locator('main').evaluate(el => { const clone = el.cloneNode(true); clone.querySelectorAll('.disclosure-line').forEach(node => node.remove()); return clone.textContent; });
    expect(copy).not.toMatch(/\blive\b|real-time|production|customer|Gate 1|confidence|benchmark/i);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  });

  test('motion is CSS-only and runs one 8s loop', async ({ page }) => {
    await page.goto(REVIEW + '/demo/');
    const animated = await page.locator('.ci-svg [class*="ci-"]').evaluateAll(els => els.map(el => { const s = getComputedStyle(el); return { name: s.animationName, duration: s.animationDuration, count: s.animationIterationCount }; }).filter(a => a.name !== 'none'));
    expect(animated.length).toBe(19);
    for (const a of animated) expect(a).toMatchObject({ duration: '8s', count: 'infinite' });
    // Unaffected plates and the steady beacon never animate.
    for (const selector of ['.ci-plate--still', '.ci-beacon--steady', '.ci-edge', '.ci-bar']) {
      for (const name of await page.locator(selector).evaluateAll(els => els.map(el => getComputedStyle(el).animationName))) expect(name).toBe('none');
    }
  });

  test('reduced motion removes all animation and shows the final state', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    try {
      const page = await context.newPage();
      await page.goto(REVIEW + '/demo/');
      const names = await page.locator('.ci-svg, .ci-svg *').evaluateAll(els => els.map(el => getComputedStyle(el).animationName));
      expect(names.length).toBeGreaterThan(30);
      expect(names.every(name => name === 'none')).toBe(true);
      const style = selector => page.locator(selector).first().evaluate(el => { const s = getComputedStyle(el); return { stroke: s.stroke, fill: s.fill, opacity: s.opacity, offset: s.strokeDashoffset }; });
      expect((await style('.ci-pulse--h1')).offset).toBe('0px');
      expect((await style('.ci-pulse--h3')).offset).toBe('0px');
      expect((await style('.ci-plate--h2')).stroke).toBe('rgb(229, 122, 116)');
      expect((await style('.ci-fold--h3')).opacity).toBe('1');
      expect((await style('.ci-beacon--live')).fill).toBe('rgb(229, 122, 116)');
      expect((await style('.ci-beacon--steady')).fill).toBe('rgb(94, 196, 139)');
      await mkdir(shots, { recursive: true });
      await page.locator('.ci-figure').screenshot({ path: `${shots}/demo-reduced-motion-final-state.png` });
    } finally { await context.close(); }
  });

  test('screenshots: page, and one frame at 0, 30, 50 and 70 percent of the loop', async ({ page }, testInfo) => {
    await page.goto(REVIEW + '/demo/');
    const width = testInfo.project.use.viewport.width;
    await mkdir(shots, { recursive: true });
    await page.screenshot({ path: `${shots}/demo-${width}.png`, fullPage: true });
    // Test-only: pause CSS animations and seek them with the Web Animations API.
    for (const percent of [0, 30, 50, 70]) {
      await page.evaluate(p => { for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = p * 80; } }, percent);
      await page.locator('.ci-figure').screenshot({ path: `${shots}/demo-frame-${String(percent).padStart(2, '0')}pct-${width}.png` });
    }
    // Sanity at 70%: the final state is held (affected decision beacon red, unaffected steady green).
    const fills = await page.evaluate(() => [...document.querySelectorAll('.ci-beacon')].map(el => getComputedStyle(el).fill));
    expect(fills).toEqual(['rgb(229, 122, 116)', 'rgb(94, 196, 139)']);
  });
});

test('production omits pending demo copy and hides the unlabeled graphic from assistive technology', async ({ page }) => {
  await page.goto(PRODUCTION + '/demo/');
  await expect(page.locator('h1')).toHaveText('Demo — Coming Soon');
  await expect(page.locator('.site-header')).toBeVisible();
  const svg = page.locator('svg.ci-svg');
  await expect(svg).toHaveAttribute('aria-hidden', 'true');
  await expect(svg).not.toHaveAttribute('role', /./);
  await expect(page.locator('.ci-caption, .lede, .disclosure-line')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('walkthrough');
  await expect(page.locator('main')).not.toContainText('Illustration');
  await expect(page.locator('main')).not.toContainText('Illustrative animation');
});
