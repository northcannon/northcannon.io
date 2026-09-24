import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { readRoutes, draftBanner } from '../../src/governance/routes.mjs';
import { loadGovernance } from '../../src/governance/registry.mjs';
import { requiredHeaders } from '../../scripts/policy.mjs';

// Acceptance tests for the approved public-site design (Wireframes A, implementation
// brief, Wireframes B). The review build (4323) renders the full composition with
// pending copy; production (4321) renders only founder-attested claims.
const REVIEW = 'http://127.0.0.1:4323';
const PRODUCTION = 'http://127.0.0.1:4321';
const status = 'Gate 1 is frozen, pending independent stress testing.';
const statusDate = loadGovernance().claims.find(c => c.claim_id === 'status-gate1-frozen-stress').review_date;
const fabricated = /Frozen —|Evidence System Operational|NC-\d|Jan \d|2025|[a-f0-9]{16,}|Not supplied/;
const desktop = testInfo => testInfo.project.name === 'desktop';

test.use({ bypassCSP: true });

for (const review of [true, false]) for (const route of readRoutes().filter(r => review || r.publish)) {
  test(`${review ? 'review' : 'production'} route ${route.path} is static, accessible and responsive`, async ({ page, browser }, testInfo) => {
    const base = review ? REVIEW : PRODUCTION;
    const response = await page.goto(base + route.path);
    expect(response.status()).toBe(200);
    for (const [name, value] of Object.entries(requiredHeaders)) expect(response.headers()[name]).toBe(value);
    await expect(page.locator('script, style, [style], form, input, button')).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(1);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (route.path === '/demo/') {
      expect(await page.locator('body').innerText()).toBe('Demo — Coming Soon');
      await expect(page.locator('a, details, nav')).toHaveCount(0);
    } else {
      if (review) await expect(page.getByText(draftBanner, { exact: true })).toBeVisible();
      else await expect(page.getByText(draftBanner, { exact: true })).toHaveCount(0);
      await expect(page.locator('.site-header')).toBeVisible();
      await expect(page.locator('.status-chip')).toHaveAttribute('aria-label', status);
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
      if (!route.path.startsWith('/trust/')) {
        const actual = await page.locator('main').evaluate(el => {
          const copy = el.cloneNode(true);
          return copy.textContent;
        });
        expect(actual).not.toMatch(fabricated);
      }
    }
    const name = route.path === '/' ? 'home' : route.path.replace(/^\/|\/$/g, '').replaceAll('/', '-').replace('.html', '');
    await mkdir(`test-results/site-${review ? 'review' : 'production'}`, { recursive: true });
    // Skip-link checks scroll the main into view; reset before full-page capture
    // so the sticky header does not cover the heading in visual evidence.
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `test-results/site-${review ? 'review' : 'production'}/${name}-${testInfo.project.use.viewport.width}.png`, fullPage: true });
    // 200% text at 320px must reflow without horizontal page scroll.
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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

test.describe('approved design acceptance (review build)', () => {
  const navigation = ['Gate 1', 'Results', 'Evidence', 'About', 'Company', 'Features', 'Founder', 'Contact'];
  const hrefs = ['/gate-1/', '/results/', '/evidence/', '/about/', '/about/company/', '/about/features/', '/about/founder/', '/contact/'];

  test('primary navigation, header and footer', async ({ page }, testInfo) => {
    for (const [index, path] of hrefs.entries()) {
      await page.goto(REVIEW + path);
      const links = desktop(testInfo) ? page.locator('.desktop-navigation a') : page.locator('.mobile-navigation .navigation a');
      if (!desktop(testInfo)) {
        await expect(page.locator('.desktop-navigation')).toBeHidden();
        await expect(page.locator('.status-chip')).toBeVisible();
        await expect(page.locator('.status-chip')).toHaveText(/Gate 1\s*Frozen/);
        await page.locator('.mobile-navigation summary').click();
      } else {
        await expect(page.locator('.status-chip')).toBeHidden();
        expect((await page.locator('.site-header__inner').boundingBox()).height).toBe(80);
        expect((await page.locator('main .site-container').boundingBox()).x).toBe(72);
        expect((await page.locator('main .site-container').boundingBox()).width).toBe(1296);
      }
      await expect(links).toHaveText(navigation);
      expect(await links.evaluateAll(els => els.map(el => el.getAttribute('href')))).toEqual(hrefs);
      await expect(links.nth(index)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('.site-footer__links a')).toHaveText(['Trust Center', 'Disclosure', 'Contact']);
    }
  });

  test('home: slim hero with calls to action and a decorative verification module', async ({ page }, testInfo) => {
    await page.goto(REVIEW + '/');
    await expect(page.locator('.home-hero .eyebrow')).toHaveText('Evidence over confidence.');
    await expect(page.locator('h1')).toHaveText('Designed to be falsified. Built for trust.');
    await expect(page.getByRole('link', { name: 'View Gate 1' })).toHaveAttribute('href', '/gate-1/');
    await expect(page.getByRole('link', { name: 'Explore Evidence' })).toHaveAttribute('href', '/evidence/');
    await expect(page.locator('.home-hero__copy').getByRole('link', { name: 'About', exact: true })).toHaveAttribute('href', '/about/');
    await expect(page.locator('.home-hero__visual')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.verify-module .support-cell')).toHaveCount(5);
    // Company content moved to /about/company/.
    await expect(page.locator('.capability-card, .truth, .interop, .contact-cta')).toHaveCount(0);
    if (desktop(testInfo)) {
      const copy = await page.locator('.home-hero__copy').boundingBox(), visual = await page.locator('.home-hero__visual').boundingBox();
      expect(visual.x).toBeGreaterThan(copy.x + copy.width);
    }
  });

  test('about company: capabilities, is / is not, interoperability and contact moved from the homepage', async ({ page }) => {
    await page.goto(REVIEW + '/about/company/');
    await expect(page.locator('h1')).toHaveText('Company');
    await expect(page.locator('.capability-card h3')).toHaveText(['Verification', 'Provenance', 'Change Intelligence']);
    await expect(page.locator('.truth--is li')).toHaveCount(4);
    await expect(page.locator('.truth--not li')).toHaveCount(4);
    await expect(page.locator('.interop__node h3')).toHaveText(['Data Sources', 'Outputs']);
    await expect(page.locator('.interop__modules li')).toHaveText(['Adapters', 'Evaluation', 'Provenance', 'Evidence']);
    await expect(page.locator('.contact-cta a')).toHaveAttribute('href', '/contact/');
  });

  test('gate 1: status banner, lifecycle, explanation, arms, falsification, readiness and links', async ({ page }) => {
    await page.goto(REVIEW + '/gate-1/');
    await expect(page.locator('h1')).toHaveText(/Gate 1\s*Frozen/);
    await expect(page.locator('.status-banner')).toContainText(status);
    await expect(page.locator('.status-banner')).toHaveClass(/status-banner--pending/);
    await expect(page.locator('.status-banner time')).toHaveText(statusDate);
    await expect(page.locator('.lifecycle__label')).toHaveText(['Defined', 'Frozen', 'Independent Review', 'Stress Test', 'Authorized', 'Executing', 'Results Published']);
    await expect(page.locator('.lifecycle [aria-current="step"]')).toHaveCount(1);
    await expect(page.locator('.lifecycle [aria-current="step"] .lifecycle__label')).toHaveText('Frozen');
    await expect(page.locator('.lifecycle .is-complete')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'What is Gate 1?' })).toBeVisible();
    await expect(page.locator('.arm-card__name')).toHaveText(['Treatment', 'Baseline A', 'Baseline B', 'R+']);
    await expect(page.locator('.criteria li')).toHaveCount(1);
    await expect(page.locator('.checklist li')).toHaveCount(8);
    await expect(page.locator('.checklist .checklist__state--pending')).toHaveCount(8);
    expect(await page.locator('.link-card').evaluateAll(els => els.map(el => el.getAttribute('href')))).toEqual(['/results/', '/evidence/']);
  });

  test('results: pre-execution, readiness, approved metrics, metadata, arm tabs and placeholder', async ({ page }) => {
    await page.goto(REVIEW + '/results/');
    await expect(page.locator('h1')).toHaveText('Pre-execution');
    await expect(page.locator('.status-banner')).toContainText(status);
    await expect(page.locator('.readiness__name')).toHaveText(['Definition', 'Datasets', 'Methods', 'Independent Review', 'Execution']);
    await expect(page.locator('.readiness__state')).toHaveText(Array(5).fill('Pending'));
    await expect(page.locator('.metric-card__name')).toHaveText(['Verification rate', 'Failed evaluations', 'Abstention rate', 'p95 latency', 'Token usage', 'Average context size']);
    await expect(page.locator('.metadata-grid dt')).toHaveCount(8);
    await expect(page.locator('.arm-tabs__tab')).toHaveText(['Treatment (T)', 'Baseline A', 'Baseline B', 'R+']);
    await expect(page.locator('.arm-tabs__panel:visible')).toHaveCount(1);
    await expect(page.locator('#arm-treatment')).toBeVisible();
    await page.locator('.arm-tabs__tab--arm-baseline-a').click();
    await expect(page.locator('#arm-baseline-a')).toBeVisible();
    await expect(page.locator('#arm-treatment')).toBeHidden();
    await expect(page.locator('#arm-baseline-a .chart-placeholder__title')).toHaveText('Results (coming soon)');
    await expect(page.locator('.link-card')).toHaveAttribute('href', '/evidence/');
  });

  test('evidence: status, explainers, ledger empty state, hash, viewer and change log', async ({ page }) => {
    await page.goto(REVIEW + '/evidence/');
    await expect(page.locator('h1')).toHaveText('From claims to verifiable evidence.');
    await expect(page.locator('.status-banner')).toContainText('Execution evidence will appear after Gate 1 runs.');
    await expect(page.locator('.explainer-card h2')).toHaveText(['What was frozen', 'What was executed', 'What supports the claim']);
    await expect(page.locator('.ledger th')).toHaveText(['Date (UTC)', 'Claim / Topic', 'Evidence Type', 'Artifact Hash', 'Status', '']);
    await expect(page.locator('.ledger tbody tr')).toHaveCount(1);
    await expect(page.locator('.ledger tbody')).toHaveText('No evidence records yet. Evidence will appear after execution.');
    await expect(page.locator('.hash-block')).toHaveText(/SHA-256\s*No public artifact hash yet\./);
    await expect(page.locator('.artifact-viewer')).toContainText('No public artifact available yet.');
    await expect(page.locator('.updated-strip a')).toHaveAttribute('href', '/trust/changelog/');
  });

  test('about overview: founder text first, company and why-now modules, links to the subpages', async ({ page }) => {
    await page.goto(REVIEW + '/about/');
    await expect(page.locator('main .eyebrow')).toHaveText('About NorthCannon');
    await expect(page.locator('h1')).toHaveText('Verification, evidence, and change intelligence for consequential machine decisions.');
    await expect(page.locator('.about-modules .module__head')).toHaveText(['NorthCannon', 'Why now']);
    expect(await page.locator('.link-cards a').evaluateAll(els => els.map(el => el.getAttribute('href')))).toEqual(['/about/company/', '/about/features/', '/about/founder/']);
    await expect(page.locator('.mock-panel, .mock-grid')).toHaveCount(0);
  });

  test('about subnav and dropdown mark the current page with aria-current', async ({ page }, testInfo) => {
    for (const [index, path] of ['/about/', '/about/company/', '/about/features/', '/about/founder/'].entries()) {
      await page.goto(REVIEW + path);
      const subnav = page.getByRole('navigation', { name: 'About sections' });
      await expect(subnav.getByRole('link')).toHaveText(['Overview', 'Company', 'Features', 'Founder']);
      await expect(subnav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(subnav.getByRole('link').nth(index)).toHaveAttribute('aria-current', 'page');
      if (desktop(testInfo)) await expect(page.locator('.desktop-navigation [aria-current="page"]')).toHaveAttribute('href', path);
    }
  });

  test('about dropdown opens on hover and keyboard focus with no JavaScript, and reaches every subpage', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(REVIEW + '/');
      const submenu = page.locator('.desktop-navigation .submenu');
      await expect(submenu).toBeHidden();
      await page.locator('.desktop-navigation > li > a', { hasText: 'About' }).hover();
      await expect(submenu).toBeVisible();
      await expect(submenu.getByRole('link')).toHaveText(['Company', 'Features', 'Founder']);
      await page.mouse.move(700, 600);
      await expect(submenu).toBeHidden();
      await page.locator('.desktop-navigation > li > a', { hasText: 'About' }).focus();
      await expect(submenu).toBeVisible();
      for (const name of ['Company', 'Features', 'Founder']) {
        await page.keyboard.press('Tab');
        await expect(page.locator('.submenu a', { hasText: name })).toBeFocused();
      }
      await page.keyboard.press('Tab');
      await expect(page.locator('.desktop-navigation a', { hasText: 'Contact' })).toBeFocused();
      await expect(submenu).toBeHidden();
    } finally { await context.close(); }
  });

  test('mobile menu lists About with its subpages indented', async ({ page }, testInfo) => {
    test.skip(desktop(testInfo), 'mobile menu only');
    await page.goto(REVIEW + '/');
    await page.locator('.mobile-navigation summary').click();
    await expect(page.locator('.mobile-navigation .submenu-mobile a')).toHaveText(['Company', 'Features', 'Founder']);
    await expect(page.locator('.mobile-navigation .submenu-mobile a').first()).toBeVisible();
  });

  test('founder: hero, why, background, credibility, currently building, contact and links', async ({ page }) => {
    await page.goto(REVIEW + '/about/founder/');
    await expect(page.locator('h1')).toHaveText('Building trust infrastructure for machine intelligence.');
    for (const heading of ['Why NorthCannon exists', 'Selected background', 'Currently building', 'Get in touch']) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.locator('.background-card')).toContainText('Max Brooks is the founder of NorthCannon.');
    await expect(page.locator('.credibility li')).toHaveCount(5);
    await expect(page.locator('.founder-section .prose .bullet-list li')).toHaveCount(4);
    await expect(page.locator('.contact-cta a')).toHaveAttribute('href', '/contact/');
    expect(await page.locator('.link-card').evaluateAll(els => els.map(el => el.getAttribute('href')))).toEqual(['/about/', '/gate-1/']);
  });

  test('contact: general and security destinations', async ({ page }) => {
    await page.goto(REVIEW + '/contact/');
    await expect(page.locator('main a[href="mailto:hello@northcannon.io"]')).toBeVisible();
    await expect(page.locator('main a[href="mailto:security@northcannon.io"]')).toBeVisible();
  });
});

test('production renders only attested navigation and publishes all approved primary routes', async ({ page }, testInfo) => {
  await page.goto(PRODUCTION + '/');
  if (!desktop(testInfo)) await page.locator('.mobile-navigation summary').click();
  const links = desktop(testInfo) ? page.locator('.desktop-navigation a') : page.locator('.mobile-navigation .navigation a');
  // Unpublished About subpages never appear in production navigation, and the removed /founder/ route does not exist.
  await expect(links).toHaveText(['Gate 1', 'Results', 'Evidence', 'About', 'Contact']);
  await expect(page.locator('.submenu, .submenu-mobile, .about-subnav')).toHaveCount(0);
  for (const path of ['/gate-1/', '/about/', '/contact/']) expect((await page.goto(PRODUCTION + path)).status()).toBe(200);
  for (const path of ['/founder/', '/about/company/', '/about/features/', '/about/founder/']) expect((await page.goto(PRODUCTION + path)).status()).toBe(404);
  await page.goto(PRODUCTION + '/results/');
  await expect(page.locator('h1')).toHaveText('Pre-execution');
  await expect(page.locator('.status-banner')).toContainText(status);
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
    await expect(page.locator('.status-chip')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('summary')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.mobile-navigation .navigation')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('.mobile-navigation .navigation a').first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Space');
    await expect(page.locator('.mobile-navigation .navigation')).toBeHidden();
  } finally { await context.close(); }
});
