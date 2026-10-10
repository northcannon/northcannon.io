import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
const f = JSON.parse(await readFile('src/content/concept-scenario.json', 'utf8'));
const REVIEW = 'http://127.0.0.1:4323';
const changed = ['/', '/solutions/', '/products/', '/evidence/', '/experiments/'];
test.use({ bypassCSP: true });

test('each graph fragment selects its inspector and exactly its upstream/downstream evidence paths', async ({ page }) => {
  await page.goto(REVIEW + '/solutions/');
  const mobileInspector = page.locator('.ci-inspector.ci-panel--collapsed');
  if (await mobileInspector.isVisible()) await mobileInspector.locator(':scope > summary').click();
  await expect(page.locator('.ci-inspection:visible')).toHaveAttribute('data-inspector', 'sdk');
  for (const n of f.nodes) {
    await page.locator(`.ci-node[data-node="${n.id}"]`).click();
    await expect(page).toHaveURL(REVIEW + '/solutions/#ci-node-' + n.id);
    await expect(page.locator('.ci-inspection:visible')).toHaveAttribute('data-inspector', n.id);
    await expect.poll(() => page.locator(`.ci-node[data-node="${n.id}"] rect`).evaluate(el => getComputedStyle(el).strokeWidth)).toBe('5px');
    const up = new Set([n.id]), down = new Set([n.id]);
    for (let step = 0; step < f.nodes.length; step++) for (const e of f.edges) {
      if (up.has(e.target)) up.add(e.source);
      if (down.has(e.source)) down.add(e.target);
    }
    for (const e of f.edges) {
      const expected = (up.has(e.source) && up.has(e.target)) || (down.has(e.source) && down.has(e.target));
      expect(await page.locator(`[data-edge="${e.id}"] path`).evaluate(el => getComputedStyle(el).strokeWidth), n.id + ':' + e.id).toBe(expected ? '3px' : '1.5px');
    }
  }
  const unknown = await page.locator('.ci-node.UNKNOWN_COVERAGE rect').first().evaluate(el => getComputedStyle(el).strokeDasharray);
  const unaffected = await page.locator('.ci-node.SUPPORTED_UNAFFECTED rect').evaluate(el => getComputedStyle(el).strokeDasharray);
  expect(unknown).not.toBe(unaffected);
});

test('direct/transitive and comparison fragments switch views without scripts', async ({ page }) => {
  await page.goto(REVIEW + '/solutions/');
  await page.locator('a[href="#ci-mode-direct"]').click();
  await expect.poll(() => page.locator('[data-edge="edge-4"]').evaluate(el => getComputedStyle(el).opacity)).toBe('0.2');
  await page.locator('a[href="#ci-mode-transitive"]').click();
  await expect.poll(() => page.locator('[data-edge="edge-4"]').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  await page.locator('a[href="#ci-mode-compare"]').click();
  await expect(page.locator('.ci-comparison')).toBeVisible();
  await expect(page.locator('.ci-workspace')).toBeHidden();
  await expect(page.locator('.ci-comparison')).toContainText('lattice-fixture-sdk 2.4.1');
  await expect(page.locator('.ci-comparison')).toContainText('lattice-fixture-sdk 2.5.0');
  await page.locator('a[href="#ci-mode-transitive"]').click();
  await expect(page.locator('.ci-workspace')).toBeVisible();
  await expect(page.locator('.ci-comparison')).toBeHidden();
  await expect(page.locator('script')).toHaveCount(0);
  const graph = page.locator('.ci-graph-scroll');
  await graph.focus();
  await expect(graph).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.ci-node').first()).toBeFocused();
});

test('concept pages pass WCAG AA and preserve explicit truth and mismatched outcomes', async ({ page }) => {
  for (const route of changed) {
    await page.goto(REVIEW + route);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations, route).toEqual([]);
    if (route !== '/experiments/') await expect(page.locator('main')).toContainText('Concept visualization — synthetic engineering scenario');
  }
  await page.goto(REVIEW + '/evidence/');
  await expect(page.locator('.ci-ladder')).toContainText('2.4.1 — mismatch');
  await expect(page.locator('.ci-ladder')).toContainText('Not reconciled');
  await expect(page.locator('.evidence-ledger')).not.toContainText('lattice-fixture-sdk');
  await page.goto(REVIEW + '/about/');
  await expect(page.locator('.ci-console, .ci-authority, .ci-packet, .ci-preview')).toHaveCount(0);
});

test('changed pages and every console mode reflow at 375, 390 and 320 with 200 percent text', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'One explicit viewport matrix.');
  test.setTimeout(120000);
  for (const width of [375,390,320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [...changed, '/solutions/#ci-node-config', '/solutions/#ci-mode-compare']) {
      await page.goto(REVIEW + route);
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      for (const panel of await page.locator('.ci-panel--collapsed:visible').all()) await panel.locator(':scope > summary').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + ':' + width).toBe(true);
    }
  }
});

test('native fragments and full evidence hashes work with JavaScript disabled', async ({ browser }, info) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: info.project.use.viewport });
  const page = await context.newPage();
  try {
    await page.goto(REVIEW + '/solutions/');
    await page.locator('.ci-node[data-node="config"]').click();
    const inspector = page.locator('.ci-inspector.ci-panel--collapsed');
    if (await inspector.isVisible()) await inspector.locator(':scope > summary').click();
    await expect(page.locator('.ci-inspection:visible')).toHaveAttribute('data-inspector', 'config');
    await page.locator('a[href="#ci-mode-compare"]').click();
    await expect(page.locator('.ci-comparison')).toBeVisible();
    await page.goto(REVIEW + '/evidence/');
    const record = page.locator('.ci-evidence').first();
    await record.locator(':scope > summary').focus();
    await page.keyboard.press('Enter');
    await expect(record).toHaveAttribute('open', '');
    const hash = record.locator('.ci-hash > details:not(.hash)');
    await hash.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(hash.locator('code')).toBeVisible();
    await expect(hash.locator('code')).toHaveText(f.evidence[0].sha256);
  } finally { await context.close(); }
});
