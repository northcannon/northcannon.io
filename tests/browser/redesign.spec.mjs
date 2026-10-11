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
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://northcannon.io/about/company/');
  await expect(page.locator('.product-section')).toHaveCount(3); // Architect review 2026-10-11: the duplicate pillar block was removed.
  await expect(page.locator('#company, #founder')).toHaveCount(2);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content','https://northcannon.io/og/northcannon-default.png');
  // The About page is one route. The duplicate /about/ page is not in the review output.
  expect((await request.get(REVIEW + '/about/company/', { maxRedirects: 0 })).status()).toBe(200);
  expect((await request.get(REVIEW + '/about/', { maxRedirects: 0 })).status()).toBe(404);
  expect(await (await request.get(PRODUCTION + '/sitemap.xml')).text()).toContain('https://northcannon.io/about/company/');
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
    '/about/founder/ /about/company/#founder 301', '/founder/ /about/company/#founder 301', '/founder /about/company/#founder 301', '/vision/ /about/company/#company 301',
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
  await expect(page.getByRole('heading', { name:'Current product status', exact:true })).toHaveCount(1);
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

test('reference compositions: serif heroes, split panels, pillars and research pair at 1440', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop composition contract; reflow is covered by the width matrix.');
  await page.setViewportSize({ width:1440, height:1000 });
  for (const route of ['/', '/about/company/', '/products/', '/solutions/', '/evidence/', '/experiments/']) {
    await page.goto(REVIEW + route);
    await expect(page.locator('main.reference-page')).toBeVisible();
    const hero = page.locator('.product-hero');
    expect(await hero.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
    expect(await page.locator('.reference-section__copy h2').first().evaluate(el => getComputedStyle(el).fontFamily)).toContain('Georgia');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto(REVIEW + '/about/company/');
  // Architect review 2026-10-11: About states implemented capabilities once, through the status cards (F-1).
  await expect(page.locator('.reference-pillars')).toHaveCount(0);
  // Architect D-1: the six-stage loop appears on Home only; About shows the Phase A and planned status cards.
  await expect(page.locator('#about-process')).toHaveCount(0);
  await expect(page.locator('#status .scope-columns > .card')).toHaveCount(2);
  const photo = await page.locator('.founder-profile picture').boundingBox();
  const bio = await page.locator('.founder-profile__bio').boundingBox();
  const quote = await page.locator('.founder-profile blockquote').boundingBox();
  expect(photo.x + photo.width).toBeLessThan(bio.x);
  expect(bio.x + bio.width).toBeLessThan(quote.x);
  await page.goto(REVIEW + '/experiments/');
  const pi = await page.locator('#persistent-intelligence').boundingBox();
  const spc = await page.locator('#spc').boundingBox();
  expect(Math.abs(pi.y-spc.y)).toBeLessThan(2);
  expect(pi.x + pi.width).toBeLessThan(spc.x);
});

// Architect review 2026-10-11, B-5: below 48rem the founder block is one column and the name stays legible.
test('founder block is legible on phones: name box at least 200px and portrait loaded', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'Phone widths only; the desktop composition is covered above.');
  await page.goto(REVIEW + '/about/company/');
  const name = await page.locator('.founder-profile__name').boundingBox();
  expect(name.width).toBeGreaterThanOrEqual(200);
  expect(await page.locator('.founder-profile picture img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.founder-profile picture img')).not.toHaveAttribute('loading', 'lazy');
});

// Architect review 2026-10-11, D-4: section headings nest without skipping levels on the Home, Products and Solutions pages.
test('heading order does not skip levels on Home, Products and Solutions (D-4)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Structural check; run once.');
  for (const route of ['/', '/products/', '/solutions/']) {
    await page.goto(REVIEW + route);
    const levels = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(el => Number(el.tagName[1])));
    expect(levels[0], route).toBe(1);
    for (let index = 1; index < levels.length; index++) expect(levels[index] - levels[index - 1], `${route} heading ${index}`).toBeLessThanOrEqual(1);
  }
});

// Architect review 2026-10-11, D-6: About rows and the biography reach at least 80% of their column at 1440.
// Rows are measured by their box (the layout's column). The biography is measured against the grid track it occupies.
test('About rows and biography reach at least 80% of their column at 1440 (D-6)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop measure; run once.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(REVIEW + '/about/company/');
  const column = await page.locator('#company .reference-section__content').boundingBox();
  for (const row of await page.locator('#company .editorial-rows__row').all()) {
    expect((await row.boundingBox()).width / column.width).toBeGreaterThanOrEqual(0.8);
  }
  const bioShare = await page.evaluate(() => {
    const body = document.querySelector('#founder .founder-profile__body');
    const track = parseFloat(getComputedStyle(body).gridTemplateColumns.split(' ')[0]);
    return document.querySelector('.founder-profile__bio').getBoundingClientRect().width / track;
  });
  expect(bioShare).toBeGreaterThanOrEqual(0.8);
});

// Architect remediation 2026-10-11 (D-2, D-3, E-1, E-2, E-5, E-6, F-2). Desktop text checks run once.
test('PI and SPC are expanded on first use and the study-arm chips are replaced by one sentence (E-1)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop text check; run once.');
  await page.goto(REVIEW + '/experiments/');
  const text = await page.locator('main').innerText();
  expect(text).toContain('Persistent Intelligence (PI)');
  expect(text).toContain('Structure-Proportional Computing (SPC)');
  expect(text).toContain('Gate 1 compared the system against two baselines.');
  expect(text).not.toContain('BASELINE A');
  expect(text).not.toMatch(/R\+/);
  await page.goto(REVIEW + '/evidence/');
  expect(await page.locator('main').innerText()).toContain('Structure-Proportional Computing (SPC)');
});

test('the founder lede is retired from About; the approved bio is the only introduction (E-2)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop text check; run once.');
  await page.goto(REVIEW + '/about/company/');
  await expect(page.locator('main')).not.toContainText('working full-time on the control foundation');
});

test('Factory is absent and the add-on name appears once on Solutions (F-2)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop text check; run once.');
  await page.goto(REVIEW + '/solutions/');
  const text = await page.locator('main').innerText();
  expect(text).not.toContain('Factory');
  expect(text.split('Governed Extensions').length - 1).toBe(1);
});

test('each contact topic has one description and keeps its mailto subject (E-6)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop text check; run once.');
  await page.goto(REVIEW + '/contact/');
  const items = page.locator('#intents .editorial-list > li');
  await expect(items).toHaveCount(4);
  for (const li of await items.all()) {
    await expect(li.locator(':scope > p')).toHaveCount(1);
    expect(await li.locator('a').getAttribute('href')).toMatch(/^mailto:.+\?subject=/);
  }
});

test('the historical prototype carries its version-history line and spans the full width at 1440 (E-5, D-2)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop measure; run once.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(REVIEW + '/evidence/');
  await expect(page.locator('#historical')).toContainText('The recording remains in version history only.');
  const section = await page.locator('#historical').boundingBox();
  const content = await page.locator('#historical .reference-section__content').boundingBox();
  expect(content.width / section.width).toBeGreaterThanOrEqual(0.8);
});

test('PI and SPC cards on Experiments have equal size at 1440 (D-2)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop measure; run once.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(REVIEW + '/experiments/');
  const pi = await page.locator('#persistent-intelligence').boundingBox();
  const spc = await page.locator('#spc').boundingBox();
  expect(Math.abs(pi.height - spc.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(pi.width - spc.width)).toBeLessThanOrEqual(2);
});

test('Solutions console panels are disclosures on phones and keep their text (D-3)', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Phone check; run on the 390 project.');
  await page.goto(REVIEW + '/solutions/');
  const panels = page.locator('.reference-console__panel');
  expect(await panels.count()).toBeGreaterThanOrEqual(4);
  for (const panel of await panels.all()) {
    expect(await panel.evaluate(el => el.tagName)).toBe('DETAILS');
    expect(await panel.evaluate(el => el.textContent.trim().length)).toBeGreaterThan(10);
  }
});

test('the trust claims register is one table with one row per approved claim on its route (D-3)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Register count; run once.');
  const route = readRoutes().find(r => r.path === '/trust/claims/');
  const claims = JSON.parse(await readFile('public_claims/claims.json', 'utf8'));
  const expected = claims.filter(c => c.approval_state === 'approved' && route.claim_ids.includes(c.claim_id)).length;
  await page.goto(REVIEW + '/trust/claims/');
  await expect(page.locator('table.claim-table tbody tr[data-claim-id]')).toHaveCount(expected);
  await expect(page.locator('table.claim-table thead th')).toHaveCount(5);
});
