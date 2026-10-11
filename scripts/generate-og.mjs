import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadGovernance } from '../src/governance/registry.mjs';
import { draftClaim } from '../src/governance/routes.mjs';
const { claims } = loadGovernance();
const ids = ['brand-company', 'redesign-label-category', 'redesign-home-title'];
const text = ids.map(id => draftClaim(claims, id));
const font = (await readFile('public/fonts/inter-latin-600-normal.woff2')).toString('base64');
const mark = (await readFile('public/northcannon-mark.svg')).toString('base64');
const lattice = (await readFile('public/graphene-lattice.svg')).toString('base64');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const escape = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;');
  const titleWords = text[2].split(' ');
  const lastLine = titleWords.splice(-2).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><style>@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font})}text{font-family:Inter;font-weight:600}</style></defs><rect width="1200" height="630" fill="#0e0b14"/><image href="data:image/svg+xml;base64,${lattice}" width="1200" height="630" preserveAspectRatio="xMidYMid slice" opacity=".5"/><image href="data:image/svg+xml;base64,${mark}" x="70" y="76" width="66" height="44"/><text x="160" y="109" fill="#f5f7fb" font-size="34">${escape(text[0])}</text><path d="M70 190H1130" stroke="#8b5cf6" stroke-width="3"/><text x="70" y="245" fill="#c5addd" font-size="26">${escape(text[1])}</text><text x="70" y="345" fill="#f5f7fb" font-size="64"><tspan x="70">${escape(titleWords.join(' '))}</tspan><tspan x="70" dy="76">${escape(lastLine)}</tspan></text></svg>`;
  await page.setContent(`<style>body{margin:0;background:#0e0b14}</style>${svg}`);
  await page.evaluate(() => document.fonts.ready);
  const bytes = await page.screenshot({ type: 'png' });
  await mkdir('public/og', { recursive: true });
  await writeFile('public/og/northcannon-default.png', bytes);
  await writeFile('src/content/og-image.json', JSON.stringify({ path: '/og/northcannon-default.png', width: 1200, height: 630, sha256: createHash('sha256').update(bytes).digest('hex'), claim_ids: ids, status: 'pending' }, null, 2) + '\n');
} finally { await browser.close(); }
