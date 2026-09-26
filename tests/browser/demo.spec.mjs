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
    await expect(page.locator('h1')).toHaveText('Product demonstration');
    if (testInfo.project.name !== 'desktop') await page.locator('.mobile-navigation summary').click();
    const nav = testInfo.project.name === 'desktop' ? page.locator('.desktop-navigation') : page.locator('.mobile-navigation .navigation');
    await expect(nav.getByRole('link', { name: 'Demo', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Demo', exact: true })).toHaveAttribute('href', '/demo/');
    // Order: ... About, Company, Features, Founder, Demo, Contact.
    const labels = await nav.getByRole('link').allTextContents();
    expect(labels.slice(-2)).toEqual(['Demo', 'Contact']);
  });

  test('the demo video is user-started, captioned, disclosed, and transcribed', async ({ page }) => {
    await page.goto(REVIEW + '/demo/');
    await expect(page).toHaveTitle(/Product demonstration/);
    const video = page.locator('video');
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute('controls', '');
    for (const attr of ['autoplay', 'loop', 'muted']) expect(await video.getAttribute(attr)).toBeNull();
    await expect(video).toHaveAttribute('aria-label', 'NorthCannon product demonstration video, with captions');
    await expect(page.locator('#demo-video-disclosure')).toHaveText('Product demonstration · fictional cases · pre-production · not legal advice · synthetic narration');
    await expect(page.locator('video track[kind="captions"]')).toHaveAttribute('srclang', 'en');
    // Playwright's Chromium has no H.264 decoder, so check delivery rather than playback: each file is served with
    // its media type, and the video answers byte-range requests as the production host does.
    for (const [url, type] of [['/demo/northcannon-demo.mp4', 'video/mp4'], ['/demo/northcannon-demo.en.vtt', 'text/vtt'], ['/demo/northcannon-demo-poster.webp', 'image/webp']]) {
      const response = await page.request.get(REVIEW + url);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain(type);
    }
    const partial = await page.request.get(REVIEW + '/demo/northcannon-demo.mp4', { headers: { range: 'bytes=0-15' } });
    expect(partial.status()).toBe(206);
    expect((await partial.body()).toString('latin1', 4, 8)).toBe('ftyp');
    const transcript = page.locator('details.demo-transcript');
    await transcript.locator('summary').click();
    await expect(transcript.locator('p')).toHaveCount(14);
    await expect(transcript.locator('p').first()).toContainText('An AI servicing agent wants to take a consequential action');
    expect((await new AxeBuilder({ page }).include('.demo-video').include('.demo-transcript').analyze()).violations).toEqual([]);
  });

  test('the graphic is static markup with a resolvable accessible name and no text elements', async ({ page }) => {
    await page.goto(REVIEW + '/demo/');
    await expect(page.locator('script')).toHaveCount(0);
    const svg = page.locator('svg.ci-svg');
    await expect(svg).toHaveAttribute('role', 'img');
    await expect(svg).toHaveAttribute('viewBox', '0 0 1200 760');
    await expect(svg.locator('text, tspan, animate, set, animateTransform, script, foreignObject')).toHaveCount(0);
    await expect(svg.locator('[style]')).toHaveCount(0);
    await expect(page.getByRole('img', { name: alt })).toBeVisible();
    await expect(page.locator('.ci-caption')).toHaveText(alt);
    await expect(page.locator('.ci-figure .disclosure-line')).toHaveText('Illustrative animation · not a live system');
    await expect(page.locator('.module__head')).toHaveText('Change Intelligence');
    // Stage labels are HTML (never SVG text): the change, the persistent state, the blast radius.
    await expect(page.locator('.ci-label')).toHaveText(['Regulation change is now effective', 'Persistent verified state', 'Calculating blast radius']);
    await expect(page.locator('.ci-steps li')).toHaveText(['Regulation change is now effective', 'Persistent verified state', 'Calculating blast radius']);
    // The disclosure note itself says "not a live system"; every other string avoids these words. The video's
    // transcript is excluded: it is the attested narration ("does not treat that confidence as evidence").
    const copy = await page.locator('main').evaluate(el => { const clone = el.cloneNode(true); clone.querySelectorAll('.disclosure-line, .demo-transcript').forEach(node => node.remove()); return clone.textContent; });
    expect(copy).not.toMatch(/\blive\b|real-time|production|customer|Gate 1|confidence|benchmark/i);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  });

  test('motion is CSS-only and runs one 10s loop', async ({ page }) => {
    await page.goto(REVIEW + '/demo/');
    const animated = await page.locator('.ci-svg [class*="ci-"]').evaluateAll(els => els.map(el => { const s = getComputedStyle(el); return { name: s.animationName, duration: s.animationDuration, count: s.animationIterationCount }; }).filter(a => a.name !== 'none'));
    expect(animated.length).toBe(26);
    for (const a of animated) expect(a).toMatchObject({ duration: '10s', count: 'infinite' });
    // Unaffected plates and the steady beacon never animate.
    for (const selector of ['.ci-plate--still', '.ci-beacon--steady', '.ci-edge', '.ci-bar']) {
      for (const name of await page.locator(selector).evaluateAll(els => els.map(el => getComputedStyle(el).animationName))) expect(name).toBe('none');
    }
  });

  test('"Calculating blast radius" types out as the red lines propagate and restarts each loop', async ({ page }, testInfo) => {
    await page.goto(REVIEW + '/demo/');
    const blast = page.locator('.ci-label--blast');
    const text = (await blast.textContent()).trim();
    // One step per character: the CSS steps(24) must match the governed label.
    expect(text.length).toBe(24);
    const style = await blast.evaluate(el => { const s = getComputedStyle(el); return { name: s.animationName, duration: s.animationDuration, timing: s.animationTimingFunction, count: s.animationIterationCount }; });
    expect(style).toMatchObject({ duration: '10s', timing: 'steps(24)', count: 'infinite' });
    const seek = ms => page.evaluate(v => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = v; } }, ms);
    // Fraction of the label shown by its clip-path; inset() may compute to one to four values.
    const revealed = () => blast.evaluate(el => { const inset = getComputedStyle(el).clipPath.match(/inset\(([^)]*)\)/); if (!inset) return 1; const values = inset[1].trim().split(/\s+/); const right = values[1] ?? values[0]; return right.endsWith('%') ? 1 - parseFloat(right) / 100 : 1 - parseFloat(right) / el.getBoundingClientRect().width; });
    // Hidden while the change and state stages run, typing while red propagates, complete as the last red line lands.
    await seek(1000); expect(await revealed()).toBe(0);
    await seek(2500); expect(await revealed()).toBe(0);
    await seek(5000); const mid = await revealed(); expect(mid).toBeGreaterThan(0.3); expect(mid).toBeLessThan(0.7);
    await seek(7400); expect(await revealed()).toBe(1);
    await seek(8500); expect(await revealed()).toBe(1);
    // The next loop starts empty again.
    await seek(10000 + 1000); expect(await revealed()).toBe(0);
    // Wide screens keep the change and state labels still (the SVG boxes animate); narrow screens animate the boxes themselves.
    const narrow = (testInfo.project.use.viewport?.width ?? 0) <= 640;
    for (const [selector, name] of [['.ci-label--change', 'ci-box-change'], ['.ci-label--state', 'ci-box-state']]) expect(await page.locator(selector).evaluate(el => getComputedStyle(el).animationName), selector).toBe(narrow ? name : 'none');
  });

  test('narrow screens: the change and state labels are boxes that contain their text; the blast connector meets the curve', async ({ page }, testInfo) => {
    test.skip((testInfo.project.use.viewport?.width ?? 0) > 640, 'narrow layout only');
    await page.goto(REVIEW + '/demo/');
    for (const selector of ['.ci-label--change', '.ci-label--state']) {
      const box = page.locator(selector);
      await expect(box).toBeVisible();
      const m = await box.evaluate(el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(el); const t = range.getBoundingClientRect(); return { width: s.borderTopWidth, fits: el.scrollWidth <= el.clientWidth + 1, inside: t.left >= r.left && t.right <= r.right && t.top >= r.top && t.bottom <= r.bottom }; });
      expect(parseFloat(m.width), selector).toBeGreaterThanOrEqual(1);
      expect(m.fits, selector).toBe(true);
      expect(m.inside, selector).toBe(true);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.locator('.ci-label--change').evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgb(245, 158, 11)');
    expect(await page.locator('.ci-label--state').evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgb(94, 196, 139)');
    // Order: change box, state box, blast label, then the cropped graph.
    const layout = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      const svg = r('.ci-svg');
      // The SVG is cropped to the graph: its visible top is 234 of 760 units down its box.
      return { change: r('.ci-label--change').top, state: r('.ci-label--state').top, blast: r('.ci-label--blast'), graph: svg.top + svg.height * 234 / 760 };
    });
    expect(layout.change).toBeLessThan(layout.state);
    expect(layout.state).toBeLessThan(layout.blast.top);
    expect(Math.abs(layout.graph - layout.blast.bottom)).toBeLessThan(2);
    // The dashed connector sits at 29% of the graph width, where the SVG blast-radius curve crosses the crop line.
    const join = await page.evaluate(() => { const svg = document.querySelector('.ci-svg').getBoundingClientRect(); const blast = document.querySelector('.ci-label--blast'); const before = getComputedStyle(blast, '::before'); const left = blast.getBoundingClientRect().left + parseFloat(before.left) + 1; return { ratio: (left - svg.left) / svg.width, state: document.querySelector('.ci-label--state').getBoundingClientRect().bottom, top: blast.getBoundingClientRect().top }; });
    expect(join.ratio).toBeGreaterThan(0.28); expect(join.ratio).toBeLessThan(0.30);
    expect(Math.abs(join.top - join.state)).toBeLessThan(1);
    // The boxes hug their text (close in scale to the plates) yet the connector still leaves from inside the state box.
    const state = await page.locator('.ci-label--state').boundingBox(), graph = await page.locator('.ci-svg').boundingBox();
    expect(state.width).toBeLessThan(graph.width * 0.9);
    expect(graph.x + graph.width * 0.29).toBeGreaterThan(state.x + 8);
    expect(graph.x + graph.width * 0.29).toBeLessThan(state.x + state.width - 8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // The step list stays available to assistive technology but is not shown twice.
    await expect(page.locator('.ci-steps')).toHaveCSS('position', 'absolute');
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
      expect((await style('.ci-in')).offset).toBe('0px');
      expect((await style('.ci-calc')).offset).toBe('0px');
      expect((await style('.ci-head--calc')).opacity).toBe('1');
      expect((await style('.ci-state')).stroke).toBe('rgb(94, 196, 139)');
      expect((await style('.ci-plate--source')).stroke).toBe('rgb(245, 158, 11)');
      await mkdir(shots, { recursive: true });
      await page.locator('.ci-figure').screenshot({ path: `${shots}/demo-reduced-motion-final-state.png` });
    } finally { await context.close(); }
  });

  test('screenshots: page, and frames across the loop', async ({ page }, testInfo) => {
    await page.goto(REVIEW + '/demo/');
    const width = testInfo.project.use.viewport.width;
    await mkdir(shots, { recursive: true });
    await page.screenshot({ path: `${shots}/demo-${width}.png`, fullPage: true });
    // Test-only: pause CSS animations and seek them with the Web Animations API.
    for (const percent of [0, 12, 22, 34, 46, 60, 76, 85]) {
      await page.evaluate(p => { for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = p * 100; } }, percent);
      await page.locator('.ci-figure').screenshot({ path: `${shots}/demo-frame-${String(percent).padStart(2, '0')}pct-${width}.png` });
    }
    // Ordering: red propagation waits until the blast-radius line has reached the source plate.
    await page.evaluate(() => { for (const animation of document.getAnimations()) animation.currentTime = 3900; });
    const at39 = await page.evaluate(() => ['.ci-calc', '.ci-pulse--h1'].map(s => parseFloat(getComputedStyle(document.querySelector(s)).strokeDashoffset)));
    expect(at39[0]).toBeLessThan(0.1);
    expect(at39[1]).toBe(1);
    await page.evaluate(() => { for (const animation of document.getAnimations()) animation.currentTime = 8500; });
    // Sanity at 85%: the final state is held (affected decision beacon red, unaffected steady green).
    const fills = await page.evaluate(() => [...document.querySelectorAll('.ci-beacon')].map(el => getComputedStyle(el).fill));
    expect(fills).toEqual(['rgb(229, 122, 116)', 'rgb(94, 196, 139)']);
  });
});

test('production keeps the coming-soon page, with no video or media files, until the demo video copy is attested', async ({ page }) => {
  await page.goto(PRODUCTION + '/demo/');
  await expect(page.locator('video')).toHaveCount(0);
  for (const url of ['/demo/northcannon-demo.mp4', '/demo/northcannon-demo.en.vtt', '/demo/northcannon-demo-poster.webp']) expect((await page.request.get(PRODUCTION + url)).status()).toBe(404);
});

test('production renders the attested demo copy and labels the graphic', async ({ page }) => {
  await page.goto(PRODUCTION + '/demo/');
  await expect(page.locator('h1')).toHaveText('Demo — Coming Soon');
  await expect(page.locator('.site-header')).toBeVisible();
  const svg = page.locator('svg.ci-svg');
  await expect(svg).toHaveAttribute('role', 'img');
  await expect(page.getByRole('img', { name: alt })).toBeVisible();
  await expect(page.locator('.ci-figure .disclosure-line')).toHaveText('Illustrative animation · not a live system');
  await expect(page.locator('.ci-label')).toHaveText(['Regulation change is now effective', 'Persistent verified state', 'Calculating blast radius']);
});
