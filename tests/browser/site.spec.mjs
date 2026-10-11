import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readRoutes, draftBanner } from '../../src/governance/routes.mjs';
import { migratedReviewPaths } from '../../scripts/redesign-policy.mjs';
import { requiredHeaders } from '../../scripts/policy.mjs';

// Acceptance tests for the approved public-site design (Wireframes A, implementation
// brief, Wireframes B). The review build (4323) renders the full composition with
// pending copy; production (4321) renders only founder-attested claims.
const REVIEW = 'http://127.0.0.1:4323';
const PRODUCTION = 'http://127.0.0.1:4321';
const fabricated = /Frozen —|Evidence System Operational|NC-\d|Jan \d|2025|[a-f0-9]{16,}|Not supplied/;
const concept = JSON.parse(await readFile('src/content/concept-scenario.json', 'utf8'));
const syntheticHashes = new Set(concept.evidence.map(record => record.sha256));
const draftHistoricalHash = JSON.parse(await readFile('src/content/redesign.json', 'utf8')).historical.sha256;
const siteManifestHash = createHash('sha256').update(await readFile('dist/provenance.json')).digest('hex');
const desktop = testInfo => testInfo.project.name === 'desktop';

test.use({ bypassCSP: true });

for (const review of [true, false]) for (const route of readRoutes().filter(r => review ? !migratedReviewPaths.has(r.path) : r.publish)) {
  test(`${review ? 'review' : 'production'} route ${route.path} is static, accessible and responsive`, async ({ page, browser }, testInfo) => {
    const base = review ? REVIEW : PRODUCTION;
    const response = await page.goto(base + route.path);
    expect(response.status()).toBe(200);
    for (const [name, value] of Object.entries(requiredHeaders)) expect(response.headers()[name]).toBe(value);
    await expect(page.locator('script, style, [style], form, input, button')).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(1);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (review) await expect(page.getByText(draftBanner, { exact: true })).toBeVisible();
    else await expect(page.getByText(draftBanner, { exact: true })).toHaveCount(0);
    await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.locator('.status-chip')).toHaveCount(0);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    if (!route.path.startsWith('/trust/')) {
      // Only registered synthetic hashes inside explicitly labeled concepts are exempt, in review and (founder
      // decision 2026-10-11, option a) in production; fabricated text and hashes elsewhere remain prohibited.
      for (const panel of await page.locator('main .ci-console, main .ci-authority, main .ci-packet, .reference-console').all()) {
        await expect(panel).toContainText('Concept visualization — synthetic engineering scenario');
        for (const code of await panel.locator('.ci-hash code').all()) {
          expect(syntheticHashes.has(await code.textContent())).toBe(true);
        }
      }
      // Exact matches to registered hashes are removed before the fabricated-text check: the synthetic concept hashes and the two
      // real artifact hashes (the site provenance manifest and the historical recording), which are verified byte for byte elsewhere.
      const allowedHashes = [...syntheticHashes, ...(route.path === '/evidence/' ? [draftHistoricalHash, siteManifestHash] : [])];
      const actual = await page.locator('main').evaluate((el, { allowed }) => {
        const copy = el.cloneNode(true);
        copy.querySelectorAll('.ci-console .ci-hash code, .ci-authority .ci-hash code').forEach(code => code.remove());
        for (const node of copy.querySelectorAll('*')) if (node.children.length === 0 && allowed.includes(node.textContent.trim())) node.remove();
        return copy.textContent;
      }, { allowed: allowedHashes });
      expect(actual).not.toMatch(fabricated);
    }
    const name = route.path === '/' ? 'home' : route.path.replace(/^\/|\/$/g, '').replaceAll('/', '-').replace('.html', '');
    await mkdir(`test-results/site-${review ? 'review' : 'production'}`, { recursive: true });
    // Skip-link checks scroll the main into view; reset before full-page capture
    // so the sticky header does not cover the heading in visual evidence.
    await page.evaluate(() => scrollTo(0, 0));
    // The claims register has hundreds of rows; full-page PNGs can exceed 50 MB
    // and exhaust the CI test budget. Keep a viewport capture; all DOM checks still cover the page.
    await page.screenshot({ path: `test-results/site-${review ? 'review' : 'production'}/${name}-${testInfo.project.use.viewport.width}.png`, fullPage: route.path !== '/trust/claims/' });
    // 200% text at 320px must reflow without horizontal page scroll.
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(await page.locator('main *').evaluateAll(els => els.filter(el => el.getBoundingClientRect().right > innerWidth).slice(0,12).map(el => ({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right}))))).toBe(true);
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(page.locator('.graphene')).toBeHidden();
    const normal = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const zoom = await browser.newContext({ viewport: { width: 720, height: 500 }, deviceScaleFactor: 2 });
    try {
      const p1 = await normal.newPage(), p2 = await zoom.newPage();
      await p1.goto(base + route.path); await p2.goto(base + route.path);
      const size = p => p.locator('h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize) * devicePixelRatio);
      // Responsive breakpoints can change heading size; verify actual text enlargement
      // at a fixed viewport, then check the half-width zoom layout separately.
      const before = await size(p1);
      await p1.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      expect(await size(p1) / before).toBeCloseTo(2, 2);
      expect(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { await normal.close(); await zoom.close(); }
  });
}

test('production uses the approved redesign with labelled concepts and consolidated About', async ({ page }) => {
  for (const path of ['/', '/about/company/', '/products/', '/solutions/', '/evidence/', '/experiments/']) {
    await page.goto(PRODUCTION + path);
    await expect(page.locator('.draft-bar')).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.site-header .reference-graphene')).toHaveCount(1);
    for (const panel of await page.locator('.ci-console, .ci-authority, .ci-packet, .reference-console').all()) {
      await expect(panel).toContainText('Concept visualization — synthetic engineering scenario');
    }
  }
  await page.goto(PRODUCTION + '/about/company/');
  await expect(page.locator('#company, #founder')).toHaveCount(2);
  await page.goto(PRODUCTION + '/evidence/');
  await expect(page.getByRole('heading', { name: 'Current product status', exact: true })).toHaveCount(1);
  await expect(page.locator('a[href="/provenance.json"]').first()).toBeVisible();
});

test('production renders only attested navigation and publishes all approved primary routes', async ({ page }, testInfo) => {
  await page.goto(PRODUCTION + '/');
  if (!desktop(testInfo)) await page.locator('.mobile-navigation summary').click();
  const links = desktop(testInfo) ? page.locator('.desktop-navigation a') : page.locator('.mobile-navigation .navigation a');
  // Features is published (founder direction after approval 006).
  await expect(links).toHaveText(['About', 'Products', 'Solutions', 'Evidence', 'Experiments', 'Contact']);
  for (const path of ['/about/company/', '/products/', '/solutions/', '/evidence/', '/experiments/', '/contact/']) expect((await page.goto(PRODUCTION + path)).status()).toBe(200);
  await page.goto(PRODUCTION + '/results/');
  await expect(page).toHaveURL(PRODUCTION + '/evidence/#experimental-results');
});

for (const review of [true, false]) test(`${review ? 'review' : 'production'} mobile menu works by keyboard without JavaScript`, async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto(`${review ? REVIEW : PRODUCTION}/`);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.locator('.wordmark')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('navigation', { name: 'Primary' }).locator('summary')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.mobile-navigation .navigation')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('.mobile-navigation .navigation a').first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Space');
    await expect(page.locator('.mobile-navigation .navigation')).toBeHidden();
  } finally { await context.close(); }
});

test('production keeps the removed routes alive with permanent redirects', async ({ request }) => {
  for (const [from, to] of [['/founder/', '/about/company/#founder'], ['/founder', '/about/company/#founder'], ['/about/', '/about/company/'], ['/about', '/about/company/'], ['/results/', '/evidence/#experimental-results'], ['/gate-1/', '/experiments/#gate-1'], ['/vision/', '/about/company/#company'], ['/about/features/', '/products/'], ['/about/founder/', '/about/company/#founder']]) {
    const response = await request.get(PRODUCTION + from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(301);
    expect(response.headers().location, from).toBe(to);
  }
});

test('approved research status and retained historical disclosures render exactly in production', async ({ page }) => {
  for (const [route, text] of [
    ['/trust/status/', 'Gate 1: discontinued before execution on 29 September 2026.'],
    ['/trust/status/', 'No experimental results or Structure-Proportional Computing (SPC) performance advantage is claimed.'],
    ['/experiments/', 'Gate 1 was discontinued on 29 September 2026, before execution. No results were produced, and none are forthcoming.'],
    ['/trust/changelog/', 'October 2026: removed discontinued Gate 1, results and demonstration content. Gate 1 was discontinued on 29 September 2026, before execution.'],
  ]) {
    await page.goto(PRODUCTION + route);
    await expect(page.locator('main')).toContainText(text);
  }
});

test('production links only target published pages', async ({ page }) => {
  const published = new Set(readRoutes().filter(r => r.publish).map(r => r.path));
  for (const path of published) {
    if (path === '/404.html') continue;
    await page.goto(PRODUCTION + path);
    const hrefs = await page.locator('a[href^="/"]').evaluateAll(els => els.map(el => el.getAttribute('href').split('#')[0]));
    for (const href of hrefs) expect(published.has(href) || /\.(svg|txt|xml|json)$/.test(href), `${path} links to ${href}`).toBe(true);
  }
});

test('changelog records the redesign and the October truth correction in both builds once attested', async ({ page }) => {
  for (const base of [REVIEW, PRODUCTION]) {
    await page.goto(base + '/trust/changelog/');
    await expect(page.locator('.claim-list li')).toHaveCount(base === REVIEW ? 3 : 2);
    await expect(page.locator('.claim-list')).toContainText('New visual system across the site');
    await expect(page.locator('.claim-list')).toContainText('October 2026: removed discontinued Gate 1, results and demonstration content. Gate 1 was discontinued on 29 September 2026, before execution.');
    await expect(page.locator('main')).not.toContainText('No changelog entries are listed.');
  }
});
