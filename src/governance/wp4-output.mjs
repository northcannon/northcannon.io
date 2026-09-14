import { parse } from 'parse5';
import { readFileSync } from 'node:fs';
import { draftBanner, legacyLabels, readRoutes, routeFile, reviewDependencies } from './routes.mjs';

export const readProductionProvenance = () => JSON.parse(readFileSync('dist/provenance.json', 'utf8'));

export function inspectReviewOutput(html, claims, name, { review = true } = {}) {
  const routes = readRoutes(claims);
  const route = routes.find(r => routeFile(r) === name);
  if (!route || (!review && !route.publish)) return ['Unknown or unpublished route'];
  const dependencies = reviewDependencies(route, routes, { review });
  const declared = claims.filter(c => dependencies.has(c.claim_id));
  const data = review && name === 'trust/provenance/index.html' ? readProductionProvenance() : null;
  const allowed = new Set([...legacyLabels, ...(review ? [draftBanner] : []), ...declared.filter(c => c.lifecycle_state !== 'retired' && (review ? c.approval_state !== 'rejected' : c.approval_state === 'approved')).flatMap(c => [c.statement, ...c.statement.split('\n\n')]).map(s => s.replace(/\s+/gu, ' ').trim())]);
  const company = claims.find(c => c.claim_id === 'brand-company').statement;
  allowed.add(`${company} home`);
  for (const c of declared.filter(c => route.path === '/trust/claims/' && c.approval_state === 'approved')) {
    for (const v of [c.claim_id, c.category, c.basis, c.review_date]) allowed.add(v);
  }
  // Exact machine data from the actual production provenance, never arbitrary paths.
  for (const group of data ? [data.sources, data.files, data.approval_events] : []) for (const [key, value] of Object.entries(group)) { allowed.add(key); allowed.add(value); }
  if (data) allowed.add(data.astro_version);
  if (data && data.source_commit !== null) allowed.add(data.source_commit);
  const errors = [];
  const visit = node => {
    if (node.nodeName === '#text' && node.value.trim() && !allowed.has(node.value.replace(/\s+/gu, ' ').trim())) errors.push('Unregistered review text');
    for (const a of node.attrs ?? []) if (['aria-label', 'alt', 'title'].includes(a.name) && a.value && !allowed.has(a.value)) errors.push('Unregistered review interface');
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parse(html));
  return errors;
}
