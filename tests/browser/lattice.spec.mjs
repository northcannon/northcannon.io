import { test, expect } from '@playwright/test';
import { decodePNG, contrast, luminance } from '../helpers/pixels.mjs';
import { paintedBoxes } from '../helpers/boxes.mjs';

// Only pixel instrumentation bypasses CSP so screenshot glyph masks can apply.
// Separate static/security tests retain the delivered CSP without bypass.
test.use({ bypassCSP: true });

for (const [name, url, violet] of [
  ['home', '/', '.eyebrow'],
  ['404', '/404.html', '.page-title--recovery'],
  ['fixture', 'http://127.0.0.1:4322/', '.action-link--secondary'],
]) {
  test(`${name} has seamless text integration and rendered contrast`, async ({ page }, testInfo) => {
    await page.goto(url);
    expect(await paintedBoxes(page)).toEqual([]);
    const samples = [];
    const selectors = [name === '404' ? '.wordmark span' : 'h1', '.site-footer__inner p'];
    if (violet) selectors.push(violet);
    if (name === '404') selectors.push('.action-link--primary');
    for (const selector of selectors) {
      const el = page.locator(selector).first();
      const color = await el.evaluate(e => getComputedStyle(e).color.match(/[\d.]+/g).slice(0, 3).map(Number));
      const visible = decodePNG(await el.screenshot({ path: testInfo.outputPath(`${name}-${selectors.indexOf(selector)}-contrast.png`) }));
      // Test-only glyph masking preserves shadows, background, layout, and lattice.
      const backdrop = decodePNG(await el.screenshot({ style: `${selector} { color: transparent !important; -webkit-text-fill-color: transparent !important; }` }));
      expect(backdrop.width).toBe(visible.width);
      expect(backdrop.height).toBe(visible.height);
      const glyphs = new Set();
      for (let y = 0; y < visible.height; y++) for (let x = 0; x < visible.width; x++) {
        if (visible.rgb(x, y).some((v, i) => Math.abs(v - backdrop.rgb(x, y)[i]) > 20)) glyphs.add(y * visible.width + x);
      }
      expect(glyphs.size, `${selector}: detectable glyph pixels`).toBeGreaterThan(50);
      const adjacent = new Set();
      for (const index of glyphs) {
        const x = index % visible.width, y = Math.floor(index / visible.width);
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
          const nx = x + dx, ny = y + dy, ni = ny * visible.width + nx;
          if (nx >= 0 && nx < visible.width && ny >= 0 && ny < visible.height && !glyphs.has(ni) && visible.rgb(nx, ny).every((v, i) => Math.abs(v - backdrop.rgb(nx, ny)[i]) <= 2)) adjacent.add(ni);
        }
      }
      expect(adjacent.size, `${selector}: non-text samples beside glyphs`).toBeGreaterThan(50);
      const backgrounds = [...adjacent].map(i => visible.rgb(i % visible.width, Math.floor(i / visible.width))).sort((a, b) => luminance(b) - luminance(a));
      const lightest = backgrounds.slice(0, Math.ceil(backgrounds.length / 10));
      const minimum = Math.min(...lightest.map(rgb => contrast(color, rgb)));
      expect(minimum, `${selector}: worst contrast in lightest 10%`).toBeGreaterThanOrEqual(4.5);
      samples.push({ selector, samples: backgrounds.length, contrast: minimum });
    }
    console.log(`Rendered contrast ${name}/${testInfo.project.name}: ${JSON.stringify(samples)}`);
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  });
}

for (const [name, url, selector] of [
  ['home', '/', '.hero__copy'], ['404', '/404.html', '.site-container--narrow'],
]) {
  test(`${name} box guard rejects all six negative controls`, async ({ page }, testInfo) => {
    await page.goto(url);
    expect(await paintedBoxes(page)).toEqual([]);
    const bounds = await page.locator(selector).boundingBox();
    for (const [id, css, expected] of [
      ['a', `${selector} { background: rgb(5 5 10 / 0.94); box-shadow: 0 0 0 2rem rgb(5 5 10 / 0.94); }`, 'background-color'],
      ['b', `${selector} { box-shadow: 0 0 0 2rem rgb(5 5 10 / 0.94); }`, 'box-shadow'],
      ['c', `${selector} { backdrop-filter: brightness(0.2); }`, 'backdrop-filter'],
      ['d', `${selector}::before { content: ""; position: absolute; inset: -2rem; background: rgb(5 5 10 / 0.94); }`, '::before: background-color'],
      ['e', `body::after { content: ""; position: absolute; left: ${bounds.x}px; top: ${bounds.y}px; width: ${bounds.width}px; height: ${bounds.height}px; z-index: -1; background: rgb(5 5 10 / 0.94); }`, 'body::after: background-color'],
      ['f', `.graphene { inset: auto; left: ${bounds.x}px; top: ${bounds.y}px; width: ${bounds.width}px; height: ${bounds.height}px; }`, 'bounded lattice'],
    ]) {
      const tag = await page.addStyleTag({ content: css });
      const failures = await paintedBoxes(page);
      expect(failures.some(f => f.includes(expected)), `${id}: ${JSON.stringify(failures)}`).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${name}-control-${id}.png`), fullPage: true });
      await tag.evaluate(el => el.remove());
      expect(await paintedBoxes(page)).toEqual([]);
    }
  });
}

test('secondary border exception rejects background, wide border and shadow', async ({ page }, testInfo) => {
  await page.goto('http://127.0.0.1:4322/');
  expect(await paintedBoxes(page)).toEqual([]);
  const link = page.locator('.action-link--secondary');
  await link.hover();
  expect(await paintedBoxes(page)).toEqual([]);
  await link.focus();
  expect(await paintedBoxes(page)).toEqual([]);
  await page.mouse.down();
  expect(await paintedBoxes(page)).toEqual([]);
  await page.mouse.up();
  await page.emulateMedia({ forcedColors: 'active' });
  expect(await paintedBoxes(page)).toEqual([]);
  await page.emulateMedia({ forcedColors: 'none' });
  await link.blur();
  for (const [id, css, expected] of [
    ['g', 'background: rgb(5 5 10 / 0.94);', 'background-color'],
    ['h', 'border-width: 4px;', 'border-'],
    ['i', 'box-shadow: 0 0 0 2rem rgb(5 5 10 / 0.94);', 'box-shadow'],
  ]) {
    const tag = await page.addStyleTag({ content: `.action-link--secondary { ${css} }` });
    const failures = await paintedBoxes(page);
    expect(failures.some(f => f.includes('action-link--secondary') && f.includes(expected))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`fixture-control-${id}.png`), fullPage: true });
    await tag.evaluate(el => el.remove());
    expect(await paintedBoxes(page)).toEqual([]);
  }
});

test('open mobile menu pushes main down and closing restores layout', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('http://127.0.0.1:4322/');
      const main = page.locator('main');
      const before = await main.boundingBox();
      await page.locator('summary').click();
      expect(await paintedBoxes(page)).toEqual([]);
      const menu = await page.locator('.mobile-navigation .navigation').boundingBox();
      const after = await main.boundingBox();
      expect(menu.y + menu.height).toBeLessThanOrEqual(after.y);
      expect(after.y).toBeGreaterThan(before.y);
      await page.screenshot({ path: testInfo.outputPath(`menu-${width}.png`), fullPage: true });
      await page.locator('summary').click();
      expect((await main.boundingBox()).y).toBe(before.y);
    }
  } finally { await context.close(); }
});
