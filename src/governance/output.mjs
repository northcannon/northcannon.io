import { parse } from 'parse5';
const normalize = value => value.replace(/\s+/gu, ' ').trim();
// Interface labels describe navigation/errors and review specimens, not company facts.
const interfaceText = new Set(['Skip to content', 'Page not found', 'Return home', 'Menu', 'Primary']);
const reviewText = new Set(['WP2 component review', 'Home', 'About', 'Research', 'Product', 'Evidence', 'Trust Center', 'Early Access', 'Contact', 'Primary link', 'Secondary link', 'Panel heading', 'Presentation fixture for text wrapping, contrast, and keyboard review.', 'Review fixture']);

export function inspectClaimOutput(html, claims, { review = false, rejectUnregistered = false } = {}) {
  const document = parse(html);
  const texts = [];
  const visit = node => {
    if (node.nodeName === '#text' && normalize(node.value)) texts.push(normalize(node.value));
    for (const attr of node.attrs ?? []) if (['aria-label', 'aria-description', 'alt', 'title'].includes(attr.name) && attr.value) texts.push(normalize(attr.value));
    const attrs = Object.fromEntries((node.attrs ?? []).map(a => [a.name, a.value]));
    if (node.tagName === 'meta' && ['description', 'og:title', 'og:description', 'og:image:alt'].includes(attrs.name ?? attrs.property)) texts.push(normalize(attrs.content ?? ''));
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(document);
  const errors = [];
  // Approved full statements may contain a shorter pending interface label.
  // Remove exact approved statements before checking remaining ineligible prose.
  const combinedText = texts.join(' ');
  const approvedStatements = claims.filter(c => c.approval_state === 'approved' && c.lifecycle_state === 'approved').map(c => normalize(c.statement)).sort((a,b) => b.length-a.length);
  for (const claim of claims.filter(c => c.approval_state !== 'approved' || c.lifecycle_state !== 'approved')) {
    const pending = normalize(claim.statement);
    if (!combinedText.includes(pending)) continue;
    let combined = combinedText;
    for (const approved of approvedStatements) if (approved.includes(pending)) combined = combined.split(approved).join(' ');
    if (review) for (const label of [...reviewText].filter(label => label.includes(pending)).sort((a,b) => b.length-a.length)) combined = combined.split(label).join(' ');
    if (combined.includes(pending)) errors.push(`Ineligible rendered statement: ${claim.claim_id}`);
  }
  if (rejectUnregistered) {
    const approved = claims.filter(c => c.approval_state === 'approved' && c.lifecycle_state === 'approved');
    const allowed = new Set([...interfaceText, ...approved.map(c => normalize(c.statement)), ...(review ? reviewText : [])]);
    const company = approved.find(c => c.claim_id === 'brand-company');
    if (company) {
      allowed.add(`${company.statement} home`);
      allowed.add(`Page not found — ${company.statement}`);
    }
    for (const text of texts) if (!allowed.has(text)) errors.push('Unregistered rendered text (not a governed claim or reviewed interface label)');
  }
  return errors;
}

// Register completeness is checked against actual production text, not merely a
// hand-maintained list of route dependencies. Exact paragraph matches count too.
export function claimRegisterErrors(documents, claims) {
  const register = documents.get('trust/claims/index.html') ?? '';
  const registered = new Set([...register.matchAll(/data-claim-id="([a-z0-9-]+)"/g)].map(m => m[1]));
  const approved = claims.filter(c => c.approval_state === 'approved' && c.lifecycle_state === 'approved');
  const byText = new Map();
  for (const c of approved) for (const text of [c.statement,...c.statement.split('\n\n')]) {
    const key = normalize(text); byText.set(key,[...(byText.get(key) ?? []),c.claim_id]);
  }
  const errors = [];
  for (const [name, html] of documents) {
    if (!name.endsWith('.html') || name === 'trust/claims/index.html') continue;
    const check = text => {
      const ids = byText.get(normalize(text));
      if (ids && !ids.some(id => registered.has(id))) errors.push(`${name}: rendered claim absent from public register: ${ids.join(', ')}`);
    };
    const visit = node => {
      if (node.nodeName === '#text') check(node.value);
      for (const a of node.attrs ?? []) if (['alt','aria-label','aria-description','title'].includes(a.name)) check(a.value);
      for (const child of node.childNodes ?? []) visit(child);
    };
    visit(parse(html));
  }
  return errors;
}
