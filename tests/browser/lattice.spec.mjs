import { test, expect } from '@playwright/test';
import { decodePNG, contrast, luminance } from '../helpers/pixels.mjs';

// Only pixel instrumentation bypasses CSP so screenshot glyph masks can apply.
// Separate static/security tests retain the delivered CSP without bypass.
test.use({ bypassCSP: true });

// Rendered WCAG AA contrast for text over panels and the decorative hex pattern.
for (const [name, url, selectors] of [
  ['home', 'http://127.0.0.1:4323/', ['h1', '.home-hero .eyebrow', '.home-hero .lede', '.action-link--primary', '.site-footer__brand span']],
  ['results', 'http://127.0.0.1:4323/results/', ['.status-banner__text', '.metric-card__name']],
  ['404', '/404.html', ['.wordmark span', '.action-link--primary']],
  ['fixture', 'http://127.0.0.1:4322/', ['.action-link--secondary', '.module__body p']],
]) {
  test(`${name} text keeps rendered AA contrast`, async ({ page }, testInfo) => {
    await page.goto(url);
    const samples = [];
    for (const selector of selectors) {
      const el = page.locator(selector).first();
      const color = await el.evaluate(e => getComputedStyle(e).color.match(/[\d.]+/g).slice(0, 3).map(Number));
      const visible = decodePNG(await el.screenshot({ path: testInfo.outputPath(`${name}-${selectors.indexOf(selector)}-contrast.png`) }));
      // Test-only glyph masking preserves background, layout, and pattern.
      const backdrop = decodePNG(await el.screenshot({ style: `${selector} { color: transparent !important; -webkit-text-fill-color: transparent !important; }` }));
      expect(backdrop.width).toBe(visible.width);
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
      samples.push({ selector, contrast: Number(minimum.toFixed(2)) });
    }
    console.log(`Rendered contrast ${name}/${testInfo.project.name}: ${JSON.stringify(samples)}`);
  });
}

test('semantic status colours meet AA against panels', async () => {
  const panel = [28, 28, 34]; // elevated charcoal, the lightest text surface
  for (const [label, rgb] of [['verified', [34, 197, 94]], ['pending', [245, 158, 11]], ['failed text', [248, 113, 113]], ['violet text', [167, 139, 250]], ['secondary text', [167, 177, 194]]]) {
    expect(contrast(rgb, panel), label).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrast([255, 255, 255], [124, 58, 237]), 'filled action').toBeGreaterThanOrEqual(4.5);
});
