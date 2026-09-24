import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { inspectMarkup, readHeaders, disclosureErrors } from './policy.mjs';
import { parse, walk } from 'css-tree';
import { loadGovernance } from '../src/governance/registry.mjs';
import { inspectClaimOutput } from '../src/governance/output.mjs';
import { readRoutes, routeFile, draftBanner } from '../src/governance/routes.mjs';
import { inspectReviewOutput } from '../src/governance/wp4-output.mjs';
import { verifyProvenance } from './publication.mjs';
const { claims } = loadGovernance();
const routes = readRoutes(claims);
const wp4 = process.argv[3] === '--wp4';
const fixture = process.argv[3] === '--review';

const root = path.resolve(process.argv[2] ?? 'dist');
const files = new Map();
const errors = [];
async function collect(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if ((await lstat(full)).isSymbolicLink()) throw new Error('Symlinks are forbidden in output');
    if (item.isDirectory()) await collect(full);
    else {
      const name = path.relative(root, full).split(path.sep).join('/');
      if (/^fonts\/[\w.-]+\.woff2$/.test(name)) {
        // Self-hosted fonts are the only binary output; check the WOFF2 signature and keep them out of text scans.
        if ((await readFile(full)).subarray(0, 4).toString('latin1') !== 'wOF2') errors.push(`${name}: not a WOFF2 font`);
        continue;
      }
      if (!/\.(?:html|css|svg|txt|xml|json)$/.test(name) && name !== '_headers') {
        errors.push(`${name}: unexpected output type`);
        continue;
      }
      files.set(name, await readFile(full, 'utf8'));
    }
  }
}
await collect(root);
readHeaders(files.get('_headers') ?? '');
const expectedRoutes = fixture ? ['index.html'] : routes.filter(r => wp4 || r.publish).map(routeFile);
if (wp4 && root === path.resolve('dist')) throw new Error('Review output may never be dist');
const actualRoutes = [...files.keys()].filter(name => name.endsWith('.html')).sort();
if (JSON.stringify(actualRoutes) !== JSON.stringify(expectedRoutes.sort())) errors.push('Route inventory mismatch');
const documents = new Map();
for (const [name, text] of files) {
  errors.push(...disclosureErrors(text, name));
  if (name.endsWith('.html')) {
    errors.push(...(wp4 ? inspectReviewOutput(text, claims, name) : !fixture && name !== '404.html' ? [...inspectReviewOutput(text, claims, name, { review: false }), ...inspectClaimOutput(text, claims)] : inspectClaimOutput(text, claims, { review: fixture })));
    if (!wp4 && text.includes(draftBanner)) errors.push('Review banner in production');
    if (wp4 && name !== 'demo/index.html' && !text.includes(draftBanner)) errors.push('Missing review banner');
  }
  // Field names (Contact:, Allow:, …) are protocol syntax; check only field values for pending copy.
  if (!wp4 && !fixture && name.endsWith('.txt')) { const values = text.replace(/^[A-Za-z-]+:/gm, ''); for (const claim of claims.filter(c => c.approval_state !== 'approved')) if (values.includes(claim.statement)) errors.push(`Pending claim in production text artifact: ${claim.claim_id}`); }
  if (/\.(html|svg)$/.test(name)) {
    const document = inspectMarkup(text, name);
    errors.push(...document.errors);
    documents.set(name, document);
  }
  if (name.endsWith('.css')) {
    // At-rule conditions can use newer CSS syntax than the parser understands.
    // Parse every declaration value, including custom properties, for resources.
    const ast = parse(text, { parseAtrulePrelude: false, parseCustomProperty: true, onParseError: (error) => { throw error; } });
    // Self-hosted fonts are the only permitted CSS resource: @font-face whose every url() is a local /fonts/*.woff2 path.
    const localFont = /^\/fonts\/[\w.-]+\.woff2$/;
    const allowed = new Set();
    walk(ast, node => {
      if (node.type !== 'Atrule' || node.name.toLowerCase() !== 'font-face' || !node.block) return;
      allowed.add(node);
      const urls = [];
      walk(node.block, inner => { if (inner.type === 'Url' || (inner.type === 'Function' && inner.name.toLowerCase() === 'url') || (inner.type === 'Function' && ['image-set', '-webkit-image-set'].includes(inner.name.toLowerCase()))) urls.push(inner); });
      const ok = urls.every(inner => inner.type === 'Url' && localFont.test(inner.value));
      if (ok) { for (const inner of urls) allowed.add(inner); } else allowed.delete(node);
    });
    walk(ast, node => {
      if (allowed.has(node)) return;
      const decoded = (typeof node.name === 'string' ? node.name : '').replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (_, hex, char) => hex ? String.fromCodePoint(parseInt(hex, 16)) : char).toLowerCase();
      if (node.type === 'Url' || (node.type === 'Atrule' && ['import', 'font-face'].includes(decoded)) || (node.type === 'Function' && ['url', 'image-set', '-webkit-image-set'].includes(decoded))) {
        errors.push(`${name}: CSS resource loading is prohibited in WP1`);
      }
    });
  }
}
for (const [name, document] of documents) {
  for (const reference of document.references) {
    const url = new URL(reference, `https://northcannon.io/${name}`);
    let target = decodeURIComponent(url.pathname).slice(1);
    if (target === '' || target.endsWith('/')) target += 'index.html';
    if (!files.has(target)) errors.push(`${name}: broken local reference ${reference}`);
    if (url.hash && !documents.get(target)?.ids.has(decodeURIComponent(url.hash.slice(1)))) errors.push(`${name}: missing fragment ${reference}`);
  }
}
if (wp4) await verifyProvenance(path.resolve('dist'));
if (!wp4 && !fixture && files.has('provenance.json')) await verifyProvenance(root);
if (!wp4 && !fixture && root === path.resolve('dist') && !files.has('provenance.json')) errors.push('Missing production provenance');
if (errors.length) throw new Error(errors.join('\n'));
console.log(`Validated ${files.size} output files, ${actualRoutes.length} routes, local references, disclosure patterns, and strict headers; no JavaScript or inline styles.`);
