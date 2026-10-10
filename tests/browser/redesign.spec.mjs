import { test, expect } from '@playwright/test';
import { readRoutes } from '../../src/governance/routes.mjs';
import { redesignRedirects, migratedReviewPaths } from '../../scripts/redesign-policy.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const REVIEW = 'http://127.0.0.1:4323';
const PRODUCTION = 'http://127.0.0.1:4321';
test.use({ bypassCSP: true });

test('review IA, aliases, native navigation, metadata and disclosure boundaries', async ({ page, request }) => {
  await page.goto(REVIEW + '/');
  await expect(page.locator('.desktop-navigation a')).toHaveText(['About','Products','Solutions','Evidence','Experiments','Contact']);
  await expect(page.locator('.submenu, .submenu-mobile, .status-chip')).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('Control what autonomous AI can change.');
  await expect(page.locator('.product-hero a').first()).toHaveAttribute('href','/products/');
  await expect(page.locator('main')).not.toContainText('NorthCannon Factory');
  await page.goto(REVIEW + '/about/company/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://northcannon.io/about/');
  await expect(page.locator('.product-section')).toHaveCount(2);
  await expect(page.locator('#company, #founder')).toHaveCount(2);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content','https://northcannon.io/og/northcannon-default.png');
  // A cached /about/ -> /about/company/ move terminates at a 200 alias.
  expect((await request.get(REVIEW + '/about/company/', { maxRedirects: 0 })).status()).toBe(200);
  expect((await request.get(PRODUCTION + '/sitemap.xml')).text()).resolves.not.toContain('/about/company/');
  await page.goto(REVIEW + '/solutions/');
  await expect(page.locator('#knowledge-blast-radius')).toContainText('Planned capability · illustrative example · not shipped');
  await expect(page.locator('#knowledge-blast-radius tbody tr')).toHaveCount(6);
  await expect(page.locator('#future .offering-card--future')).toContainText('FUTURE ADD-ON · CONCEPT');
  await page.goto(REVIEW + '/experiments/');
  await expect(page.locator('#gate-1')).toContainText('before execution');
  await expect(page.locator('#spc')).toContainText('no performance or hardware advantage claimed');
});

test('review redirects preserve fragments in one hop without changing production targets', async ({ request, page }) => {
  // The plan §39 pairs, hard-coded so the list under test cannot validate itself.
  const planRedirects = [
    '/gate-1/ /experiments/#gate-1 301', '/results/ /evidence/#experimental-results 301', '/about/features/ /products/ 301',
    '/about/founder/ /about/#founder 301', '/founder/ /about/#founder 301', '/founder /about/#founder 301', '/vision/ /about/#company 301',
  ];
  expect(redesignRedirects).toEqual(planRedirects);
  for (const line of planRedirects) {
    const [from,to] = line.split(' ');
    const response = await request.get(REVIEW + from, { maxRedirects: 0 });
    expect(response.status()).toBe(301); expect(response.headers().location).toBe(to);
    expect((await request.get(REVIEW + to.split('#')[0], { maxRedirects: 0 })).status()).toBe(200);
    await page.goto(REVIEW + from);
    await expect(page).toHaveURL(REVIEW + to);
    if (to.includes('#')) await expect(page.locator('#'+to.split('#')[1])).toBeVisible();
  }
  expect((await request.get(PRODUCTION + '/gate-1/', { maxRedirects: 0 })).status()).toBe(200);
});

test('evidence renders source-bound hashes and no numeric or historical KPI tiles', async ({ page }) => {
  const draft = JSON.parse(await readFile('src/content/redesign.json','utf8'));
  await page.goto(REVIEW + '/evidence/');
  await expect(page.locator('[data-evidence-hash="historical"]')).toHaveText(draft.historical.sha256);
  await expect(page.locator('[data-evidence-hash="site"]')).toHaveText(createHash('sha256').update(await readFile('dist/provenance.json')).digest('hex'));
  await expect(page.locator('#kpis [data-evidence-class="historical"], #status [data-evidence-class="historical"], .metric-card')).toHaveCount(0);
  await expect(page.locator('#kpis')).toContainText('Definitions only');
  await expect(page.locator('video, track')).toHaveCount(0);
});

test('seven-width matrix, six/seven-item fit and 200 percent reflow across both builds', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Matrix is independent of the project viewport; run once.');
  test.setTimeout(180000);
  for (const review of [false,true]) {
    const routes = readRoutes().filter(r => review ? !migratedReviewPaths.has(r.path) : r.publish);
    for (const width of [390,768,1024,1180,1280,1440,1920]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        await page.goto((review ? REVIEW : PRODUCTION)+route.path);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${review}:${route.path}:${width}`).toBe(true);
      }
      if (width >= 1024) {
        await page.goto(REVIEW+'/');
        for (const seven of [false,true]) {
          if (seven) await page.locator('.desktop-navigation li:last-child').evaluate(el => el.insertAdjacentHTML('beforebegin','<li><a href="/demo/">Demo</a></li>'));
          const boxes = await page.locator('.desktop-navigation a').evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
          expect(new Set(boxes).size).toBe(1);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
      }
    }
    await page.setViewportSize({ width:1280,height:1000 });
    for (const route of routes) {
      await page.goto((review ? REVIEW : PRODUCTION)+route.path);
      await page.evaluate(() => { document.documentElement.style.fontSize='200%'; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route.path).toBe(true);
    }
  }
});

test('every published and review page renders with browser JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  try {
    const page = await context.newPage();
    for (const review of [false,true]) for (const route of readRoutes().filter(r => review ? !migratedReviewPaths.has(r.path) : r.publish)) {
      expect((await page.goto((review ? REVIEW : PRODUCTION)+route.path)).status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('script')).toHaveCount(0);
    }
  } finally { await context.close(); }
});
