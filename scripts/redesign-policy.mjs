// Review-only migration set. Production retains its Phase 0.5 targets until coordinated route promotion.
export const redesignRedirects = [
  '/gate-1/ /experiments/#gate-1 301',
  '/results/ /evidence/#experimental-results 301',
  '/about/features/ /products/ 301',
  '/about/founder/ /about/#founder 301',
  '/founder/ /about/#founder 301',
  '/founder /about/#founder 301',
  '/vision/ /about/#company 301',
];
export const migratedReviewPaths = new Set(['/gate-1/', '/about/features/', '/about/founder/', '/vision/']);
