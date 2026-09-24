import { readFileSync } from 'node:fs';
import { z } from 'astro/zod';
import { eligibleClaim } from './schema.mjs';
import { loadGovernance } from './registry.mjs';

export const legacyLabels = new Set(['Skip to content', 'Page not found', 'Return home', 'Menu', 'Primary']);
export const draftBanner = 'DRAFT — pending founder approval';
const routeSchema = z.object({ path: z.string().regex(/^(?:\/|\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/|\/404\.html)$/), title_claim_or_label: z.string().min(1), claim_ids: z.array(z.string()).min(1), review_claim_ids: z.array(z.string()).default([]), nav: z.boolean(), publish: z.boolean(), parent: z.string().optional() }).strict();
const isApproved = claim => claim?.approval_state === 'approved' && claim.lifecycle_state === 'approved' && claim.approval_record === 'founder_attestation';

// claim_ids are required: a published route needs every one approved.
// review_claim_ids are slots that render in review builds and, once founder-attested,
// in production. Until then production omits them; it never renders pending copy.
export function readRoutes(claims = loadGovernance().claims, input = JSON.parse(readFileSync('src/content/routes.json', 'utf8'))) {
  const routes = z.array(routeSchema).parse(input);
  if (new Set(routes.map(r => r.path)).size !== routes.length) throw new Error('Duplicate route');
  // A parent is a top-level route that prefixes its child's path; nesting is one level deep.
  for (const route of routes.filter(r => r.parent !== undefined)) {
    const parent = routes.find(r => r.path === route.parent);
    if (!parent || parent.parent !== undefined || !route.path.startsWith(parent.path) || route.path === parent.path) throw new Error(`Invalid parent route: ${route.path}`);
  }
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
    for (const id of reviewDependencies(route, routes, { review: false, claims })) {
      if (eligibleClaim(claims.find(c => c.claim_id === id), id).approval_record !== 'founder_attestation') throw new Error('Published navigation requires pinned attestation');
    }
  }
  return routes;
}
export const routeFile = route => route.path === '/404.html' ? '404.html' : route.path.slice(1) + 'index.html';
// Navigation is a transitive dependency; production includes published destinations
// whose navigation label is founder-attested, and a child only beside a visible parent.
export const navigationClaimId = route => route.path === '/demo/' ? 'label-demo' : route.title_claim_or_label;
const navigationVisible = (route, routes, review, claims) => route.nav && (review || (route.publish && isApproved(claims.find(c => c.claim_id === navigationClaimId(route)))
  && (route.parent === undefined || navigationVisible(routes.find(r => r.path === route.parent), routes, review, claims))));
// Every route that appears in navigation, parents and children alike, in registry order.
export function navigationRoutes(routes, { review = true, claims = loadGovernance().claims } = {}) {
  return routes.filter(r => navigationVisible(r, routes, review, claims));
}
// The same routes as a tree: top-level items with their visible children.
export function navigationTree(routes, options = {}) {
  const visible = navigationRoutes(routes, options);
  return visible.filter(r => r.parent === undefined).map(route => ({ route, children: visible.filter(r => r.parent === route.path) }));
}
export function reviewDependencies(route, routes, { review = true, claims = loadGovernance().claims } = {}) {
  const optional = review ? route.review_claim_ids : route.review_claim_ids.filter(id => isApproved(claims.find(c => c.claim_id === id)));
  return new Set([...route.claim_ids, ...optional,
    ...navigationRoutes(routes, { review, claims }).map(navigationClaimId)]);
}
export function routeClaim(claims, route, routes, id, { review = true } = {}) {
  if (!reviewDependencies(route, routes, { review, claims }).has(id)) throw new Error(`Undeclared route claim: ${route.path}: ${id}`);
  return review ? draftClaim(claims, id) : eligibleClaim(claims.find(c => c.claim_id === id), id).statement;
}
// Optional copy: the statement when this build may render it, otherwise undefined.
export function routeCopy(claims, route, routes, id, { review = true } = {}) {
  if (!route.claim_ids.includes(id) && !route.review_claim_ids.includes(id) && !reviewDependencies(route, routes, { review: true, claims }).has(id)) throw new Error(`Undeclared route claim: ${route.path}: ${id}`);
  return reviewDependencies(route, routes, { review, claims }).has(id) ? routeClaim(claims, route, routes, id, { review }) : undefined;
}
export function draftClaim(claims, id) {
  const claim = claims.find(c => c.claim_id === id);
  if (!claim || claim.approval_state === 'rejected' || claim.lifecycle_state === 'retired') throw new Error(`Ineligible review claim ${id}`);
  return claim.statement;
}
