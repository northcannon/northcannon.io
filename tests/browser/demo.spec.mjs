import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const REVIEW = 'http://127.0.0.1:4323';
const PRODUCTION = 'http://127.0.0.1:4321';
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
});

test('production shows the attested demo video (founder-approval-008) with its captions, poster, and transcript', async ({ page }) => {
  await page.goto(PRODUCTION + '/demo/');
  await expect(page).toHaveTitle(/Product demonstration/);
  await expect(page.locator('video[controls]')).toHaveCount(1);
  await expect(page.locator('#demo-video-disclosure')).toHaveText('Product demonstration · fictional cases · pre-production · not legal advice · synthetic narration');
  await expect(page.locator('details.demo-transcript p')).toHaveCount(14);
  for (const url of ['/demo/northcannon-demo.mp4', '/demo/northcannon-demo.en.vtt', '/demo/northcannon-demo-poster.webp']) expect((await page.request.get(PRODUCTION + url)).status()).toBe(200);
});

test('the change-intelligence illustration is removed (founder direction, 2026-09-26)', async ({ page }) => {
  for (const base of [REVIEW, PRODUCTION]) {
    await page.goto(base + '/demo/');
    await expect(page.locator('#demo-graphic-module, .ci-figure, svg.ci-svg')).toHaveCount(0);
    await expect(page.getByText('Change Intelligence', { exact: true })).toHaveCount(0);
  }
});
