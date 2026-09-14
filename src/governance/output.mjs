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
    for (const attr of node.attrs ?? []) if (['aria-label', 'alt', 'title'].includes(attr.name) && attr.value) texts.push(normalize(attr.value));
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(document);
  const errors = [];
  // Approved full statements may contain a shorter pending interface label.
  // Remove exact approved statements before checking remaining ineligible prose.
  for (const claim of claims) {
    let combined = texts.join(' ');
    const pending = normalize(claim.statement);
    for (const approved of claims.filter(c => c.approval_state === 'approved' && c.lifecycle_state === 'approved' && normalize(c.statement).includes(pending)).sort((a, b) => b.statement.length - a.statement.length)) combined = combined.split(normalize(approved.statement)).join(' ');
    if (review) for (const label of [...reviewText].filter(label => label.includes(pending)).sort((a, b) => b.length - a.length)) combined = combined.split(label).join(' ');
    if ((claim.approval_state !== 'approved' || claim.lifecycle_state !== 'approved') && combined.includes(normalize(claim.statement))) errors.push(`Ineligible rendered statement: ${claim.claim_id}`);
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
