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
    if (review) await expect(page.getByText(draftBanner, { exact: true })).toBeVisible();
    else await expect(page.getByText(draftBanner, { exact: true })).toHaveCount(0);
    await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.locator('.status-chip')).toHaveAttribute('aria-label', status);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    if (!route.path.startsWith('/trust/')) {
      const actual = await page.locator('main').evaluate(el => el.textContent);
      expect(actual).not.toMatch(fabricated);
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
  const navigation = ['About', 'Company', 'Features', 'Founder', 'Gate 1', 'Results', 'Evidence', 'Demo', 'Contact'];
  const hrefs = ['/about/company/', '/about/company/', '/about/features/', '/about/founder/', '/gate-1/', '/results/', '/evidence/', '/demo/', '/contact/'];

  test('primary navigation, header and footer', async ({ page }, testInfo) => {
    for (const path of [...new Set(hrefs)]) {
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
      // The About link marks the section; the page's own link carries aria-current.
      await expect(links.locator('xpath=self::*[@aria-current="page"]')).toHaveCount(1);
      await expect(links.and(page.locator('[aria-current="page"]'))).toHaveAttribute('href', path);
      await expect(page.locator('.site-footer__links a')).toHaveText(['Trust Center', 'Disclosure', 'Contact']);
    }
  });

  test('home: slim hero with calls to action and a decorative verification module', async ({ page }, testInfo) => {
    await page.goto(REVIEW + '/');
    await expect(page.locator('.home-hero .eyebrow')).toHaveText('Evidence over confidence.');
    await expect(page.locator('h1')).toHaveText('Designed to be falsified. Built for trust.');
    await expect(page.getByRole('link', { name: 'View Gate 1' })).toHaveAttribute('href', '/gate-1/');
    await expect(page.getByRole('link', { name: 'Explore Evidence' })).toHaveAttribute('href', '/evidence/');
    await expect(page.locator('.home-hero__copy').getByRole('link', { name: 'About', exact: true })).toHaveCount(0);
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
    await expect(page.locator('.capability-card h3')).toHaveText(['Verification', 'Provenance', 'Change Intelligence']);
    await expect(page.locator('.truth--is li')).toHaveCount(4);
    await expect(page.locator('.truth--not li')).toHaveCount(4);
    await expect(page.locator('.lmap__band--sources h3')).toHaveText('Authoritative sources');
    await expect(page.locator('.lmap__band--sources .lmap__intro')).toContainText('State and federal statutes and regulations');
    await expect(page.locator('.lmap__outputs h3')).toHaveText('Outputs');
    // Attested in founder-approval-006: production shows the same interoperability diagram, not the basic fallback.
    await page.goto(PRODUCTION + '/about/company/');
    await expect(page.locator('.lmap__band--sources h3')).toHaveText('Authoritative sources');
    await expect(page.locator('.lmap--basic')).toHaveCount(0);
    await page.goto(REVIEW + '/about/company/');
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

  test('about company opens with the overview: eyebrow, headline, mission and two intro cards', async ({ page }) => {
    await page.goto(REVIEW + '/about/company/');
    await expect(page.locator('main .eyebrow').first()).toHaveText('About NorthCannon');
    await expect(page.locator('h1')).toHaveText('Verification, evidence, and change intelligence for consequential machine decisions.');
    expect(await page.locator('main .site-container > *').first().evaluate(el => el.className)).toContain('about-subnav');
    // The NorthCannon banner sits above the page text, directly on the page background: no box, border, frame or band.
    const banner = page.locator('.about-banner');
    await expect(banner.locator('.about-banner__name')).toHaveText('NorthCannon');
    await expect(banner.locator('.about-banner__motto')).toHaveText('Designed to be falsified. Built for trust.');
    await expect(banner.locator('img[src="/northcannon-mark.svg"]')).toHaveCount(1);
    await expect(banner.locator('.module__head, h1, h2, h3')).toHaveCount(0);
    expect(await banner.evaluate(el => el.closest('.module'))).toBeNull();
    const style = await banner.evaluate(el => { const s = getComputedStyle(el); return { border: s.borderTopWidth, image: s.backgroundImage, color: s.backgroundColor }; });
    expect(style).toEqual({ border: '0px', image: 'none', color: 'rgba(0, 0, 0, 0)' });
    const hero = await page.locator('main .page-hero').boundingBox(), box = await banner.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(hero.y + 1);
    const container = await page.locator('main .site-container').boundingBox();
    // Mark on the left, name and motto beside it (stacked only on the narrowest screens).
    if ((page.viewportSize()?.width ?? 0) > 480) expect((await banner.locator('img').boundingBox()).x).toBeLessThan((await banner.locator('.about-banner__name').boundingBox()).x);
    expect(parseFloat(await banner.locator('.about-banner__name').evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThan(parseFloat(await page.locator('#about-why').evaluate(el => getComputedStyle(el).fontSize)) * 2);
    // Why now follows as its own full-width section with a charcoal body.
    const why = page.locator('section:has(> #about-why)');
    expect(Math.abs((await why.boundingBox()).width - container.width)).toBeLessThan(1);
    await expect(why.locator('.box .icon')).toHaveCount(1);
    expect(await page.evaluate(() => { const b = document.querySelector('.about-banner'), w = document.querySelector('section:has(> #about-why)'); return !!(b.compareDocumentPosition(w) & Node.DOCUMENT_POSITION_FOLLOWING); })).toBe(true);
  });

  test('features: labelled illustrative mocks with no scores, dollars, penalties or Gate 1 language', async ({ page }) => {
    await page.goto(REVIEW + '/about/features/');
    await expect(page.locator('h1')).toHaveText('Change Intelligence and Evidence, illustrated');
    await expect(page.locator('.disclosure-line').first()).toHaveText('Illustrative · fictional data · designed behavior, not yet implemented');
    await expect(page.locator('.disclosure-line--inline')).toHaveCount(3);
    await expect(page.locator('main .module > .module__head')).toHaveText(['Mock Change Intelligence', 'Mock downstream lineage', 'Mock Evidence', 'Decision provenance']);
    await expect(page.locator('.feature-summary').first()).toHaveText('1 of 4 prior decisions affected · 3 unaffected — not re-run');
    await expect(page.locator('.readout__value')).toHaveText(['Amended return of service recorded', 'SEP 18', 'SEP 28', 'SEP 24']);
    await expect(page.locator('.verdict__word')).toHaveText(['Proceed', 'Refuse']);
    await expect(page.locator('table.workload caption')).toHaveText('Open action for the affected decision');
    await expect(page.locator('table.workload thead th')).toHaveText(['Status', 'ID', 'Action', 'Assigned to', 'Source', 'Closes when']);
    // The fictional institution is never shown without its label.
    await expect(page.locator('.feature-institution')).toHaveText('Harbor National Bank · FICTIONAL DEMO INSTITUTION');
    expect(await page.locator('main').innerText()).not.toMatch(/Harbor National Bank(?! · FICTIONAL DEMO INSTITUTION)/);
    const svg = page.locator('.lineage__svg');
    await expect(svg).toHaveAttribute('role', 'img');
    await expect(svg.locator('text')).toHaveCount(0);
    // The changed source plus five affected downstream assets (of ten); five unaffected.
    await expect(page.locator('.lineage__plate--affected')).toHaveCount(6);
    await expect(page.locator('.lineage__fold')).toHaveCount(6);
    await expect(page.locator('.lineage__plate--neutral')).toHaveCount(5);
    await expect(page.getByRole('img', { name: /Five of the ten downstream assets are affected/ })).toBeVisible();
    await expect(page.locator('.support-cell__label')).toHaveText(['Evidence', 'Rule', 'Time', 'Authority', 'State']);
    // The story fails on timing only: Time is unsupported; Evidence, Rule, Authority and State are supported.
    await expect(page.locator('.support-cell--unsupported .support-cell__label')).toHaveText(['Time']);
    await expect(page.locator('.support-cell--supported .support-cell__label')).toHaveText(['Evidence', 'Rule', 'Authority', 'State']);
    await expect(page.locator('.readout__label')).toHaveText(['Change event', 'Earliest permitted date (before the change)', 'Earliest permitted date (after the change)', 'Proposed date', 'Prior decision', 'Re-evaluated decision']);
    for (const cell of ['ACT-0003', 'Propose a date on or after SEP 28', 'Proposing agent (fictional)', 'Re-evaluated decision', 'A revised date verifies on or after SEP 28']) await expect(page.locator('table.workload tbody tr')).toContainText(cell);
    expect(await page.locator('main').innerText()).not.toMatch(/deadline/i);
    await expect(page.locator('.drawer dt')).toHaveText(['Decision', 'Evidence', 'Rule', 'Time', 'Authority', 'State', 'Record hash']);
    await expect(page.locator('main')).not.toContainText(/confidence meter|\$\d|penalt|Gate 1|U\.S\.C|C\.F\.R|§/i);
    await expect(page.locator('.meter, [role="meter"], progress')).toHaveCount(0);
  });

  test('features workload table stacks on narrow screens without clipping or broken words', async ({ page }, testInfo) => {
    await page.goto(REVIEW + '/about/features/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const cells = await page.locator('.workload td, .workload tbody th').evaluateAll(els => els.map(el => ({ fits: el.scrollWidth <= el.clientWidth + 1, text: el.textContent.trim() })));
    for (const cell of cells) expect(cell.fits, cell.text).toBe(true);
    const caption = await page.locator('.workload__caption').evaluate(el => ({ fits: el.scrollWidth <= el.clientWidth + 1, clipped: el.getBoundingClientRect().right > innerWidth }));
    expect(caption).toEqual({ fits: true, clipped: false });
    // A short status word stays on one line: never "OP EN" or "STATU S".
    const status = await page.locator('.workload__status').evaluate(el => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) }));
    expect(status.height).toBeLessThan(status.line * 2);
    const width = testInfo.project.use.viewport.width;
    if (width <= 640) {
      // Stacked: every row is a block of label/value pairs, and headers stay in the DOM for assistive technology.
      expect(await page.locator('.workload tbody tr').evaluate(el => getComputedStyle(el).display)).toBe('block');
      await expect(page.locator('.workload thead th')).toHaveCount(6);
      expect(await page.locator('.workload td').first().evaluate(el => getComputedStyle(el, '::before').content)).toContain('ID');
    } else {
      expect(await page.locator('.workload').evaluate(el => getComputedStyle(el).display)).toBe('table');
    }
  });

  test('lineage graph keeps a readable scale inside a labelled scroll region on narrow screens', async ({ page }, testInfo) => {
    await page.goto(REVIEW + '/about/features/');
    const region = page.getByRole('region', { name: /Lineage graph: one changed source/ });
    await expect(region).toHaveAttribute('tabindex', '0');
    const svg = await page.locator('.lineage__svg').boundingBox();
    if (testInfo.project.use.viewport.width <= 640) {
      // 860 units drawn at 720px: at least 0.83 scale, never the unreadable ~0.4 of a shrunken graph.
      expect(svg.width).toBeGreaterThanOrEqual(720);
      expect(await region.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('About pages use charcoal inner boxes inside purple modules', async ({ page }) => {
    for (const [path, selector] of [['/about/company/', '.box--intro, .capability-card, .truth, .lmap__band.box, .lmap__flow'], ['/about/features/', '.event-strip, .readout-row, .lineage, .support-cells, .drawer'], ['/about/founder/', '.box']]) {
      await page.goto(REVIEW + path);
      const boxes = await page.locator(selector).evaluateAll(els => els.map(el => { const s = getComputedStyle(el); return { border: s.borderTopWidth + ' ' + s.borderTopColor, radius: s.borderTopLeftRadius, image: s.backgroundImage }; }));
      expect(boxes.length, path).toBeGreaterThan(2);
      for (const box of boxes) {
        expect(box.radius, path).toBe('16px');
        expect(box.image, path).toContain('rgb(18, 18, 22)');
        expect(box.image, path).toContain('rgb(13, 13, 16)');
        if (!path.includes('company') || !/^3px/.test(box.border)) expect(box.border, path).toBe('1px rgb(46, 46, 59)');
      }
      // The section modules keep the purple outline and header band.
      expect(await page.locator('.module').first().evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgba(197, 173, 221, 0.72)');
    }
  });

  test('About pages carry no module numbering; other pages keep it', async ({ page }) => {
    const numbers = () => page.locator('main .module__head').evaluateAll(els => els.map(el => getComputedStyle(el, '::before').content));
    for (const base of [REVIEW, PRODUCTION]) for (const path of ['/about/company/', '/about/features/', '/about/founder/']) {
      await page.goto(base + path);
      const heads = await numbers();
      expect(heads.length, path).toBeGreaterThan(0);
      for (const content of heads) expect(content, path).toBe('none');
      expect(await page.locator('main').innerText(), path).not.toMatch(/\b0\d ·/);
    }
    await page.goto(REVIEW + '/gate-1/');
    expect((await numbers()).some(content => /counter|0\d/.test(content) || content.includes('·'))).toBe(true);
  });

  test('company page order: banner, eyebrow, headline, mission, Why now, Vision, capabilities, is / is not, interoperate, contact', async ({ page }) => {
    for (const base of [REVIEW, PRODUCTION]) {
      await page.goto(base + '/about/company/');
      const order = await page.locator('main .site-container > *').evaluateAll(els => els.map(el => {
        if (el.matches('.about-subnav')) return 'subnav';
        if (el.matches('.page-hero')) return [...el.children].map(child => child.matches('.eyebrow') ? 'eyebrow' : child.matches('h1') ? 'h1' : child.matches('.lede') ? 'mission' : '?').join('>');
        if (el.matches('.about-banner')) return 'banner';
        if (el.matches('.contact-cta')) return 'contact';
        return el.querySelector(':scope > .module__head')?.textContent.trim() ?? el.className;
      }));
      // label-about-sections is attested (founder-approval-006), so both builds carry the subnav.
      expect(order, base).toEqual(['subnav', 'banner', 'eyebrow>h1>mission', 'Why now', 'Vision', 'Core Capabilities', 'What NorthCannon is / is not', 'Built to interoperate', 'contact']);
      await expect(page.locator('main .page-hero .lede')).toHaveText(loadGovernance().claims.find(c => c.claim_id === 'brand-mission').statement);
      await expect(page.locator('main .contact-cta')).toContainText('Get in touch');
    }
  });

  test('non-About pages keep the Module treatment', async ({ page }) => {
    for (const path of ['/gate-1/', '/results/', '/evidence/', '/contact/', '/demo/']) {
      await page.goto(REVIEW + path);
      const module = page.locator('main .module').first();
      expect(await module.evaluate(el => getComputedStyle(el).borderTopColor), path).toBe('rgba(197, 173, 221, 0.72)');
      expect(await module.locator('.module__head').first().evaluate(el => getComputedStyle(el).backgroundImage), path).toContain('rgb(51, 31, 88)');
    }
  });

  test('About prose uses the full inner width of its box at 1440 and 1920, at the same body size', async ({ browser }, testInfo) => {
    test.skip(!desktop(testInfo), 'desktop widths only');
    for (const width of [1440, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      try {
        const page = await context.newPage();
        for (const base of [REVIEW, PRODUCTION]) for (const path of ['/about/company/', '/about/founder/']) {
          await page.goto(base + path);
          const prose = await page.locator('main .module .prose p, main .module .prose-lead, main .module .vision-box__p').evaluateAll(els => els.map(el => {
            const box = el.closest('.box'), s = getComputedStyle(box), inner = box.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
            const module = el.closest('.module__body'), m = getComputedStyle(module);
            const style = getComputedStyle(el);
            return { vision: el.matches('.vision-box__p'), text: el.textContent.slice(0, 40), width: el.getBoundingClientRect().width, inner, boxWidth: box.getBoundingClientRect().width, moduleInner: module.clientWidth - parseFloat(m.paddingLeft) - parseFloat(m.paddingRight), maxWidth: style.maxWidth, boxMax: s.maxWidth, font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) };
          }));
          expect(prose.length, path).toBeGreaterThan(0);
          for (const p of prose) {
            expect(p.maxWidth, p.text).toBe('none');
            expect(p.boxMax, p.text).toBe('none');
            expect(Math.abs(p.width - p.inner), p.text).toBeLessThan(2);
            expect(Math.abs(p.boxWidth - p.moduleInner), p.text).toBeLessThan(2);
            // One type scale on every page and at every width (founder direction): body prose is 15px.
            expect(p.font, p.text).toBe(15); expect(p.line / p.font, p.text).toBeGreaterThanOrEqual(1.5);
          }
          await page.screenshot({ path: `test-results/g3-${base === REVIEW ? 'review' : 'production'}${path.replaceAll('/', '-').replace(/-$/, '')}-${width}.png`, fullPage: true });
        }
      } finally { await context.close(); }
    }
  });

  test('company vision section: verbatim approved statement in one charcoal box, anchored at #vision', async ({ page }) => {
    const statement = loadGovernance().claims.find(c => c.claim_id === 'vision-statement').statement.split('\n\n');
    expect(statement).toHaveLength(6);
    for (const base of [REVIEW, PRODUCTION]) {
      await page.goto(base + '/about/company/#vision');
      await expect(page.locator('h2#vision')).toHaveText('Vision');
      await expect(page.locator('.vision-box')).toHaveCount(1);
      await expect(page.locator('.vision-box p')).toHaveText(statement);
      await expect(page.locator('.vision-box .pull-quote')).toHaveCount(2);
      await expect(page.locator('.vision-box .pull-quote').first()).toContainText('AI should be able to reason');
      await expect(page.locator('.vision-box .pull-quote').last()).toContainText('Trusted machine intelligence should not only know what is true');
      // Order: banner, Why now, Vision, then Core Capabilities.
      const heads = await page.locator('main .module__head').allTextContents();
      expect(heads.slice(0, 3)).toEqual(['Why now', 'Vision', 'Core Capabilities']);
      await expect(page.locator('main .about-banner__name')).toHaveText('NorthCannon');
      expect(await page.locator('.vision-box').evaluate(el => getComputedStyle(el).maxWidth)).toBe('none');
    }
    // The Vision lives on Company only; the Founder page no longer repeats or links it. /vision/ stays published.
    await page.goto(REVIEW + '/about/founder/');
    await expect(page.locator('main')).not.toContainText('AI should be able to reason');
    expect((await page.goto(PRODUCTION + '/vision/')).status()).toBe(200);
  });

  test('interoperability diagram: four layers, three checkpoint paths through NorthCannon, the change loop and outputs', async ({ page }) => {
    const claims = loadGovernance().claims;
    const text = id => claims.find(c => c.claim_id === id).statement;
    await page.goto(REVIEW + '/about/company/');
    const map = page.locator('.lmap');
    // Four layers top to bottom; the sources label reuses interop-auth-title and the band reuses the approved interop-layer.
    await expect(map.locator('.lmap__grid > .lmap__band h3')).toHaveText(['Authoritative sources', 'Reasoning', 'NorthCannon Verification + Change Intelligence Layer', 'Systems of record and actions']);
    expect(claims.filter(c => c.statement === 'Authoritative sources').map(c => c.claim_id)).toEqual(['interop-auth-title']);
    expect(claims.filter(c => c.statement === text('interop-layer')).map(c => c.claim_id)).toEqual(['interop-layer']);
    await expect(map.locator('.lmap__band--sources .lmap__intro')).toHaveText(text('interop-auth-body'));
    await expect(map.locator('.lmap__band--sources .lmap__chips li')).toHaveText(['State and federal statutes', 'Regulations and agency rules', 'Official agency guidance and notices', 'Court filings and public records', 'Contracts and internal policies', 'System-of-record data', 'APIs and documents']);
    await expect(map.locator('.lmap__band--reasoning .lmap__chips li')).toHaveText(['Models', 'AI agents', 'Workflow automation', 'Rules and decision engines', 'Robotic process automation']);
    await expect(map.locator('.lmap__band--nc .interop__modules li')).toHaveText(['Adapters', 'Evaluation', 'Provenance', 'Evidence', 'Change Intelligence']);
    // The badges read as design intent: a "Designed to be:" label precedes them.
    await expect(map.locator('.lmap__band--nc .lmap__agnostic-row > :first-child')).toHaveText('Designed to be:');
    await expect(map.locator('.lmap__band--nc .lmap__agnostic li')).toHaveText(['Industry-agnostic', 'Model-agnostic', 'Agent-agnostic', 'Cloud-agnostic']);
    expect(text('interop-anywhere')).toContain('is designed to sit wherever');
    expect(text('interop-anywhere')).not.toContain('built to');
    for (const id of ['interop-agnostic-label', 'interop-agnostic-industry', 'interop-agnostic-model', 'interop-agnostic-agent', 'interop-agnostic-cloud']) expect(claims.find(c => c.claim_id === id).approval_state).toBe('approved');
    // Systems of record are industry-agnostic, grouped by kind.
    await expect(map.locator('.lmap__band--records .lmap__group-label')).toHaveText(['Data platforms', 'Enterprise systems', 'Channels and endpoints', 'Industry systems', 'Actions and outcomes']);
    await expect(map.locator('.lmap__band--records .lmap__chips li')).toHaveCount(33);
    const groups = await map.locator('.lmap__band--records .lmap__group').evaluateAll(els => els.map(el => [...el.querySelectorAll('.lmap__chips li')].map(li => li.textContent.trim())));
    // The founder's full systems-of-record list, grouped as directed.
    expect(groups).toEqual([
      ['Data warehouses and lakehouses', 'Data lakes and event streams', 'Operational databases'],
      ['CRM', 'ERP', 'HR and payroll', 'Procurement and supplier management', 'Identity and access management', 'IT service management', 'Document and records management'],
      ['Email and messaging', 'Client-facing web applications', 'Court e-filing and docket systems', 'Government portals and agency websites', 'Proprietary firmware and embedded devices'],
      ['Core banking and payments', 'Loan-servicing and case systems', 'Claims and policy administration', 'Trading and risk systems', 'Electronic health records', 'Clinical trial and safety systems', 'Supply chain and logistics', 'Warehouse and inventory management', 'Manufacturing execution and quality', 'Fleet and transportation management', 'Energy and utility operations', 'Network and telecom operations', 'Public-sector benefits and case management'],
      ['Decisions and approvals', 'Customer communications', 'Payments and transfers', 'Orders and shipments', 'Regulatory filings'],
    ]);
    // Worked-flow endpoints are chips that remain in the list.
    const chipTexts = groups.flat();
    for (const endpoint of ['Decisions and approvals', 'Proprietary firmware and embedded devices', 'Court e-filing and docket systems', 'Email and messaging']) expect(chipTexts).toContain(endpoint);
    // Persistent verified state reuses the approved arm-treatment-sub claim; the legend explains the two-way links.
    await expect(map.locator('.lmap__band--nc .lmap__state-label')).toHaveText(text('arm-treatment-sub'));
    expect(claims.filter(c => c.statement === 'Persistent verified state' && c.lifecycle_state !== 'retired').map(c => c.claim_id)).toEqual(['arm-treatment-sub']);
    await expect(map.locator('.lmap__legend .card-text')).toHaveText(text('interop-state-caption'));
    // Worked paths span industries and targets, not only the Features demo or a CRM.
    await expect(map.locator('.lmap__flow-title')).toHaveText(['AI agent → decision', 'Model → firmware update', 'Court docket → client email']);
    await expect(map.locator('.lmap__flow .card-text')).toHaveText(['interop-flow-agent-body', 'interop-flow-firmware-body', 'interop-flow-docket-body'].map(text));
    // Industry-agnostic scope line and badge.
    await expect(page.locator('.lmap__scope')).toHaveText(text('interop-anywhere'));
    expect(await map.locator('.lmap__band--records').innerText()).not.toMatch(/borrower/i);
    await expect(map.locator('.lmap__loop-caption')).toHaveText(text('interop-change-loop'));
    await expect(map.locator('.lmap__outputs')).toContainText('Outputs');
    await expect(map.locator('.lmap__outputs .card-text')).toHaveText(text('interop-outputs-body'));
    await expect(page.locator('.lmap__note')).toHaveText('Integration categories are illustrative design targets, not current integrations.');
    // The NorthCannon band is dominant: purple outline and header band.
    const band = await map.locator('.lmap__band--nc').evaluate(el => ({ border: getComputedStyle(el).borderTopWidth, color: getComputedStyle(el).borderTopColor, head: getComputedStyle(el.querySelector('.lmap__nc-head')).backgroundImage }));
    expect(band.border).toBe('2px');
    expect(band.color).toBe('rgb(139, 92, 246)');
    expect(band.head).toContain('rgb(51, 31, 88)');
    // Hidden description: layers, then the three flows and the loop, in order.
    const description = page.locator('#lmap-desc');
    await expect(map).toHaveAttribute('aria-describedby', 'lmap-desc');
    await expect(description.locator('ol').first().locator('li')).toHaveText(['Authoritative sources', 'Reasoning', /^NorthCannon Verification \+ Change Intelligence Layer\s+Designed to be:\s+Industry-agnostic\s+Model-agnostic\s+Agent-agnostic\s+Cloud-agnostic\s+Persistent verified state$/, 'Systems of record and actions']);
    await expect(description.locator('ol').last().locator('li')).toHaveCount(5);
    await expect(description.locator('ol').last().locator('li').last()).toHaveText(text('interop-state-caption'));
    await expect(description.locator('ol').last().locator('li').first()).toContainText('AI agent → decision');
    await expect(map.locator('svg text')).toHaveCount(0);
    expect(await map.innerText()).not.toMatch(/salesforce|\bsap\b|oracle|openai|anthropic|microsoft|workday|servicenow/i);
    await expect(page.locator('main')).not.toContainText(/Where decisions originate|Proposed decisions and context|Devices and firmware/);
    const width = page.viewportSize()?.width ?? 0;
    const box = sel => map.locator(sel).first().boundingBox();
    const nc = await box('.lmap__band--nc');
    if (width >= 1024) {
      // Each path has an arrow into the band and one out of it; the loop runs from sources to the band.
      await expect(map.locator('.lmap__conn--in')).toHaveCount(3);
      await expect(map.locator('.lmap__conn--out')).toHaveCount(3);
      // Two-way: reasoning <-> NorthCannon and NorthCannon <-> systems of record for the agent and model paths.
      // One-way: court docket -> NorthCannon -> email (flow c) and NorthCannon -> outputs -> systems.
      await expect(map.locator('.lmap__conn--in .lmap__wire--both')).toHaveCount(2);
      await expect(map.locator('.lmap__conn--out .lmap__wire--both')).toHaveCount(2);
      // Flow c is one straight one-way path: court docket -> gate -> email, no U-turn.
      await expect(map.locator('.lmap__conn--in.lmap__col-3 .lmap__wire--down')).toHaveCount(1);
      await expect(map.locator('.lmap__conn--in.lmap__col-3 .lmap__step')).toHaveText('Court e-filing and docket systems');
      await expect(map.locator('.lmap__conn--out.lmap__col-3 .lmap__wire--down')).toHaveCount(1);
      await expect(map.locator('.lmap__conn--out.lmap__col-3 .lmap__step')).toHaveText('Email and messaging');
      await expect(map.locator('.lmap__wire--up, .lmap__check--turn, .lmap__conn--turn')).toHaveCount(0);
      await expect(map.locator('.lmap__outputs .lmap__wire--down')).toHaveCount(2);
      await expect(map.locator('.lmap__check')).toHaveCount(3);
      // Every wire meets both bands it joins.
      const reasoning = await box('.lmap__band--reasoning'), records = await box('.lmap__band--records');
      for (const wire of await map.locator('.lmap__conn--in .lmap__wire').all()) {
        const w = await wire.boundingBox();
        expect(Math.abs(w.y - (reasoning.y + reasoning.height))).toBeLessThan(2);
        expect(Math.abs(w.y + w.height - nc.y)).toBeLessThan(2);
      }
      for (const wire of await map.locator('.lmap__conn--out .lmap__wire').all()) {
        const w = await wire.boundingBox();
        expect(Math.abs(w.y - (nc.y + nc.height))).toBeLessThan(2);
        expect(Math.abs(w.y + w.height - records.y)).toBeLessThan(2);
      }
      // Wires line up with their gates inside the band; the state store sits on the gates' bus.
      const gates = await map.locator('.lmap__check-ring').all();
      // Each path's in-wire and out-wire share its gate's centre line (flow c included).
      for (const [index, gate] of gates.entries()) for (const side of ['in', 'out']) {
        const w = await box(`.lmap__conn--${side}.lmap__col-${index + 1} .lmap__wire`), g = await gate.boundingBox();
        expect(Math.abs(w.x + w.width / 2 - (g.x + g.width / 2))).toBeLessThan(2);
      }
      const state = await box('.lmap__state'), gate = await gates[0].boundingBox();
      expect(Math.abs(state.y + state.height / 2 - (gate.y + gate.height / 2))).toBeLessThan(3);
      for (const wire of await map.locator('.lmap__outputs .lmap__wire').all()) {
        const w = await wire.boundingBox();
        expect(w.y + w.height).toBeGreaterThan(nc.y + nc.height - 1);
        expect(w.y).toBeLessThan(records.y + 1);
      }
      const loop = await box('.lmap__loop'), sources = await box('.lmap__band--sources');
      expect(loop.y).toBeGreaterThan(sources.y);
      expect(loop.y).toBeLessThan(sources.y + sources.height);
      // The loop drops into the band from above; the band spans wider than every other layer.
      expect(Math.abs(loop.y + loop.height - nc.y)).toBeLessThan(3);
      for (const sel of ['.lmap__band--sources', '.lmap__band--reasoning', '.lmap__band--records']) {
        const other = await box(sel);
        expect(nc.x).toBeLessThan(other.x); expect(nc.x + nc.width).toBeGreaterThan(other.x + other.width);
      }
      expect(await map.locator('.lmap__loop').evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('dashed');
      const outputs = await box('.lmap__outputs');
      expect(outputs.y).toBeGreaterThan(nc.y + nc.height);
      expect(outputs.y + outputs.height).toBeLessThan(records.y);
    } else {
      // Narrow: stacked layers, each path a vertical source -> NorthCannon -> destination sequence.
      await expect(map.locator('.lmap__conn').first()).toBeHidden();
      for (const flow of await map.locator('.lmap__flow').all()) {
        await expect(flow.locator('.lmap__steps-node')).toHaveCount(3);
        await expect(flow.locator('.lmap__steps-node').nth(1)).toHaveText('NorthCannon');
        await expect(flow.locator('.lmap__steps-link')).toHaveCount(2);
        const steps = await flow.locator('.lmap__steps-node').evaluateAll(els => els.map(el => el.getBoundingClientRect().y));
        expect(steps[0]).toBeLessThan(steps[1]); expect(steps[1]).toBeLessThan(steps[2]);
        expect(await flow.locator('.lmap__steps-link').first().evaluate(el => getComputedStyle(el, '::after').borderTopStyle)).toBe('solid');
      }
      const order = await Promise.all(['.lmap__band--sources', '.lmap__band--reasoning', '.lmap__band--nc', '.lmap__band--records'].map(sel => box(sel).then(b => b.y)));
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Attested in founder-approval-006: production shows the same four-layer diagram.
    await page.goto(PRODUCTION + '/about/company/');
    await expect(page.locator('.lmap__grid')).toHaveCount(1);
    await expect(page.locator('.lmap--basic')).toHaveCount(0);
    await expect(page.locator('.lmap__band--records .lmap__chips li')).toHaveCount(33);
  });

  test('founder portrait: circle-masked picture with alt text in both builds', async ({ page }) => {
    for (const [base, alt] of [[REVIEW, 'Max Brooks, founder of NorthCannon'], [PRODUCTION, 'Max Brooks, founder of NorthCannon']]) {
      await page.goto(base + '/about/founder/');
      const img = page.locator('.founder-hero__portrait img');
      await expect(img).toHaveAttribute('alt', alt);
      expect((await img.getAttribute('alt')).length).toBeLessThanOrEqual(80);
      await expect(img).toHaveAttribute('loading', 'eager');
      await expect(img).toHaveAttribute('width', '480');
      await expect(img).toHaveAttribute('height', '480');
      await expect(page.locator('.founder-hero__portrait source')).toHaveAttribute('type', 'image/webp');
      await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
      const mask = await page.locator('.founder-hero__portrait').evaluate(el => { const s = getComputedStyle(el); return { radius: s.borderTopLeftRadius, overflow: s.overflow, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }; });
      expect(mask.overflow).toBe('hidden');
      expect(Math.abs(mask.width - mask.height)).toBeLessThan(1);
      expect(mask.radius === '50%' || parseFloat(mask.radius) >= mask.width / 2 - 1).toBe(true);
      // No extra CSS ring: the image already carries one.
      expect(await page.locator('.founder-hero__portrait').evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
    }
  });

  test('about subnav and dropdown mark the current page with aria-current', async ({ page }, testInfo) => {
    for (const [index, path] of ['/about/company/', '/about/features/', '/about/founder/'].entries()) {
      await page.goto(REVIEW + path);
      const subnav = page.getByRole('navigation', { name: 'About sections' });
      await expect(subnav.getByRole('link')).toHaveText(['Company', 'Features', 'Founder']);
      await expect(subnav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(subnav.getByRole('link').nth(index)).toHaveAttribute('aria-current', 'page');
      if (desktop(testInfo)) await expect(page.locator('.desktop-navigation [aria-current="page"]')).toHaveAttribute('href', path);
      await expect(page.getByRole('navigation', { name: 'About sections' }).getByRole('link')).toHaveCount(3);
    }
  });

  test('about dropdown opens on hover and keyboard focus with no JavaScript, and reaches every subpage', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(REVIEW + '/');
      const submenu = page.locator('.desktop-navigation .submenu');
      const about = page.locator('.desktop-navigation > li > a').first();
      await expect(about).toHaveText('About');
      await expect(about).toHaveAttribute('href', '/about/company/');
      await expect(submenu).toBeHidden();
      await about.hover();
      await expect(submenu).toBeVisible();
      await expect(submenu.getByRole('link')).toHaveText(['Company', 'Features', 'Founder']);
      await page.mouse.move(700, 600);
      await expect(submenu).toBeHidden();
      await about.focus();
      await expect(submenu).toBeVisible();
      for (const name of ['Company', 'Features', 'Founder']) {
        await page.keyboard.press('Tab');
        await expect(page.locator('.submenu a', { hasText: name })).toBeFocused();
      }
      await page.keyboard.press('Tab');
      await expect(page.locator('.desktop-navigation a', { hasText: 'Gate 1' })).toBeFocused();
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
    await expect(page.locator('.prose .bullet-list li')).toHaveCount(4);
    await expect(page.locator('.contact-cta a')).toHaveAttribute('href', '/contact/');
    expect(await page.locator('.link-card').evaluateAll(els => els.map(el => el.getAttribute('href')))).toEqual(['/about/company/', '/gate-1/']);
    await expect(page.getByRole('link', { name: 'Vision' })).toHaveCount(0);
  });

  test('founder: Why NorthCannon exists renders the attested narrative in both builds', async ({ page }) => {
    const claims = loadGovernance().claims;
    const body = claims.find(c => c.claim_id === 'founder-why-body');
    expect(body.approval_state).toBe('approved');
    const why = body.statement.split('\n\n');
    expect(why).toHaveLength(4);
    const section = page.locator('section:has(> #why-title)');
    await page.goto(REVIEW + '/about/founder/');
    await expect(section.locator('.module__head')).toHaveText('Why NorthCannon exists');
    await expect(section.locator('.box .prose p')).toHaveText(why);
    await expect(section.locator('.box .prose .pull-quote')).toHaveText(why[3]);
    await expect(section.getByRole('link', { name: 'Vision' })).toHaveCount(0);
    expect(await section.innerText()).not.toMatch(/§|U\.S\.C|C\.F\.R|\b(?:Alabama|Alaska|Arizona|California|Colorado|Florida|Georgia|Illinois|New York|Texas|Washington)\b/);
    // Attested in founder-approval-006: production renders the same narrative, still with no vision fallback.
    await page.goto(PRODUCTION + '/about/founder/');
    await expect(section.locator('.box .prose p')).toHaveText(why);
    await expect(page.locator('main')).not.toContainText('AI should be able to reason');
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
  // Features is published (founder direction after approval 006).
  await expect(links).toHaveText(['About', 'Company', 'Features', 'Founder', 'Gate 1', 'Results', 'Evidence', 'Demo', 'Contact']);
  for (const path of ['/gate-1/', '/about/company/', '/about/features/', '/about/founder/', '/contact/']) expect((await page.goto(PRODUCTION + path)).status()).toBe(200);
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

test('production keeps the removed routes alive with permanent redirects', async ({ request }) => {
  for (const [from, to] of [['/founder/', '/about/founder/'], ['/founder', '/about/founder/'], ['/about/', '/about/company/'], ['/about', '/about/company/']]) {
    const response = await request.get(PRODUCTION + from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(301);
    expect(response.headers().location, from).toBe(to);
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

test('changelog records the redesign in both builds once attested', async ({ page }) => {
  for (const base of [REVIEW, PRODUCTION]) {
    await page.goto(base + '/trust/changelog/');
    await expect(page.locator('.claim-list li')).toHaveCount(1);
    await expect(page.locator('.claim-list li')).toContainText('New visual system across the site');
    await expect(page.locator('main')).not.toContainText('No changelog entries are listed.');
  }
});

test('founder origin quote and detailed Why now render in both builds once attested', async ({ page }) => {
  await page.goto(REVIEW + '/about/founder/');
  const quote = page.locator('.founder-hero .founder-quote');
  await expect(quote.locator('blockquote p')).toHaveText('Why should an agent regenerate an answer probabilistically if an answer that was factually correct was already generated?');
  await expect(quote.locator('.founder-quote__note')).toHaveCSS('font-style', 'italic');
  await expect(quote.locator('figcaption')).toHaveText('Max Brooks, Founder, NorthCannon');
  await page.goto(REVIEW + '/about/company/');
  await expect(page.locator('section:has(> #about-why) .prose-lead')).toHaveCount(3);
  await page.goto(PRODUCTION + '/about/company/');
  await expect(page.locator('section:has(> #about-why) .prose-lead')).toHaveCount(3);
  await page.goto(PRODUCTION + '/about/founder/');
  await expect(page.locator('.founder-quote__note')).toHaveText('The question that sparked the idea for NorthCannon.');
  // The redundant hero line was removed (founder direction); the biography keeps its sentence.
  await expect(page.locator('.founder-hero')).not.toContainText('Max Brooks is the founder of NorthCannon.');
});
