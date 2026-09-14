import { readFileSync } from 'node:fs';
import { z } from 'astro/zod';
import { eligibleClaim } from './schema.mjs';
import { loadGovernance } from './registry.mjs';

export const legacyLabels = new Set(['Skip to content', 'Page not found', 'Return home', 'Menu', 'Primary', 'Company', 'Mission statement', 'Company vision', 'About the founder', 'Coming Soon', 'Treatment', 'Baseline A', 'Baseline B', 'Arm R⁺', 'Comparison arms', '↗', 'Evidence generation', 'Generation', 'Evidence store', 'Evidence packets', 'Execution records', 'Artifact hashes', 'Packet', 'State', 'Content hash', 'Source', 'Run', 'Arm', 'Provenance hash', 'Artifact', 'Scope']);
export const draftBanner = 'DRAFT — pending founder approval';
const routeSchema = z.object({ path: z.string().regex(/^(?:\/|\/[a-z-]+(?:\/[a-z-]+)*\/|\/404\.html)$/), title_claim_or_label: z.string().min(1), claim_ids: z.array(z.string()).min(1), review_claim_ids: z.array(z.string()).default([]), nav: z.boolean(), publish: z.boolean() }).strict();
export function readRoutes(claims = loadGovernance().claims, input = JSON.parse(readFileSync('src/content/routes.json', 'utf8'))) {
  const routes = z.array(routeSchema).parse(input);
  if (new Set(routes.map(r => r.path)).size !== routes.length) throw new Error('Duplicate route');
  for (const route of routes) {
    for (const id of route.review_claim_ids) draftClaim(claims, id);
    for (const id of route.claim_ids) {
      const claim = claims.find(c => c.claim_id === id);
      if (!claim || claim.lifecycle_state === 'retired') throw new Error('Unknown or retired route claim');
      if (route.publish && (eligibleClaim(claim, id).approval_record !== 'founder_attestation')) throw new Error('Published route requires pinned attestation');
    }
    const title = claims.find(c => c.claim_id === route.title_claim_or_label);
    if (!title && !legacyLabels.has(route.title_claim_or_label)) throw new Error('Unapproved interface label');
    if (route.publish && title && (eligibleClaim(title, title.claim_id).approval_record !== 'founder_attestation')) throw new Error('Unapproved interface label');
    if (title && !route.claim_ids.includes(title.claim_id)) throw new Error(`Undeclared route title: ${route.path}`);
  }
  for (const route of routes.filter(r => r.publish)) {
    for (const id of reviewDependencies(route, routes, { review: false })) {
      if (eligibleClaim(claims.find(c => c.claim_id === id), id).approval_record !== 'founder_attestation') throw new Error('Published navigation requires pinned attestation');
    }
  }
  return routes;
}
export const routeFile = route => route.path === '/404.html' ? '404.html' : route.path.slice(1) + 'index.html';
// Navigation is a transitive dependency; production includes published destinations only.
export const navigationClaimId = route => route.path === '/demo/' ? 'label-demo' : route.title_claim_or_label;
export function reviewDependencies(route, routes, { review = true } = {}) {
  return new Set([...route.claim_ids, ...(review ? route.review_claim_ids : []),
    ...routes.filter(r => r.nav && (review || r.publish)).map(navigationClaimId)]);
}
export function routeClaim(claims, route, routes, id, { review = true } = {}) {
  if (!reviewDependencies(route, routes, { review }).has(id)) throw new Error(`Undeclared route claim: ${route.path}: ${id}`);
  return review ? draftClaim(claims, id) : eligibleClaim(claims.find(c => c.claim_id === id), id).statement;
}
export function draftClaim(claims, id) {
  const claim = claims.find(c => c.claim_id === id);
  if (!claim || claim.approval_state === 'rejected' || claim.lifecycle_state === 'retired') throw new Error(`Ineligible review claim ${id}`);
  return claim.statement;
}
