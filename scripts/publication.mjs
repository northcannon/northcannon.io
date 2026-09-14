import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { env } from 'node:process';
import path from 'node:path';
import { approvalEvents } from '../src/governance/approval-events.mjs';
import { loadGovernance } from '../src/governance/registry.mjs';
import { eligibleClaim } from '../src/governance/schema.mjs';
import { readRoutes } from '../src/governance/routes.mjs';
import { publicationIdentity } from './check-publication.mjs';

export const sourceFiles = ['public_claims/claims.json', 'src/content/collections.json', 'src/content/routes.json', 'docs/FOUNDER_APPROVALS.md', 'package-lock.json'];
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function fileInventory(root) {
  return (await readdir(root, { recursive: true, withFileTypes: true })).filter(e => e.isFile()).map(e => path.relative(root, path.join(e.parentPath, e.name))).sort();
}
export const sitemap = routes => '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + routes.filter(r => r.publish).map(r => `<url><loc>https://northcannon.io${r.path}</loc></url>`).join('') + '</urlset>\n';
export async function provenance(root) {
  const sources = {};
  for (const name of sourceFiles) sources[name] = sha256(await readFile(name));
  const files = {};
  for (const name of await fileInventory(root)) if (name !== 'provenance.json') files[name] = sha256(await readFile(path.join(root, name)));
  const astro = JSON.parse(await readFile('node_modules/astro/package.json', 'utf8')).version;
  return { source_commit: env.PUBLIC_SOURCE_COMMIT ? publicationIdentity() : null, sources, approval_events: Object.fromEntries(Object.entries(approvalEvents).map(([id, pin]) => [id, pin.sha256])), files, astro_version: astro };
}
export async function finalizeProduction(root) {
  const security = loadGovernance().claims.find(c => c.claim_id === 'contact-security');
  if (security?.approval_state !== 'approved') await rm(path.join(root, '.well-known/security.txt'), { force: true });
  else {
    eligibleClaim(security, 'contact-security');
    if (security.approval_record !== 'founder_attestation' || !(await readFile(path.join(root, '.well-known/security.txt'), 'utf8')).includes(`Contact: mailto:${security.statement}\n`)) throw new Error('Security contact must match its pinned approval');
  }
  await writeFile(path.join(root, 'sitemap.xml'), sitemap(readRoutes()));
  await writeFile(path.join(root, 'provenance.json'), JSON.stringify(await provenance(root), null, 2) + '\n');
}
export async function verifyProvenance(root) {
  const actual = JSON.parse(await readFile(path.join(root, 'provenance.json'), 'utf8'));
  const expected = await provenance(root);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Provenance digest or inventory mismatch');
  if (await readFile(path.join(root, 'sitemap.xml'), 'utf8') !== sitemap(readRoutes())) throw new Error('Sitemap does not match published routes');
}
