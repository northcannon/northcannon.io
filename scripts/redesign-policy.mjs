// The migration set: founder-approved for production at cutover (founder-approval-010, legacy routes option a).
export const redesignRedirects = [
  '/gate-1/ /experiments/#gate-1 301',
  '/results/ /evidence/#experimental-results 301',
  '/about/features/ /products/ 301',
  '/about/founder/ /about/company/#founder 301',
  '/founder/ /about/company/#founder 301',
  '/founder /about/company/#founder 301',
  '/vision/ /about/company/#company 301',
];
export const migratedReviewPaths = new Set(['/gate-1/', '/about/features/', '/about/founder/', '/vision/']);

// Production forbidden-copy guard: phrases and the "never name" list (models, vendors, tools, hardware, team handles).
// Names match on word boundaries so ordinary words such as "solution" never match; "Sol" and "Cursor" are case-sensitive.
const forbiddenPhrases = /trust infrastructure|after Gate 1 runs|will be published after the run|pending independent stress testing|Gate 1 will run/i;
const forbiddenNames = /\b(?:GPT(?:-?\d[\w.]*)?|Claude|OpenAI|Anthropic|NVIDIA|Astra|Luna|Sonnet|Opus|Haiku|Codex|Ollama|Gemini|Llama|Mistral|Postgres(?:QL)?|H100|A100)\b/i;
const forbiddenProperNames = /\b(?:Sol|Cursor)\b/;
export function forbiddenCopyErrors(text, name) {
  return conceptOutputErrors(text, name).length || forbiddenPhrases.test(text) || forbiddenNames.test(text) || forbiddenProperNames.test(text) ? [`${name}: forbidden public copy`] : [];
}

// Claim identifiers never enter a built text asset. Synthetic scenario identifiers are governed per page by
// conceptPanelErrors: founder decision 2026-10-11 (option a) admits labelled concept visualizations to production.
export function conceptOutputErrors(text, name) {
  // Section-kind attributes (data-kind="concept-console" and similar) name a layout, not a claim.
  const stripped = text.replace(/data-kind="concept-(?:console|authority|evidence|preview)"/g, '');
  if (/\bconcept-[a-z0-9-]+\b/i.test(stripped)) return [`${name}: claim identifier in built output`];
  return /\.html$/.test(name) || !syntheticMarker.test(text) ? [] : [`${name}: synthetic concept outside a labelled panel`];
}

// A concept panel is the root of a synthetic visualization. Each must carry the label, and synthetic identifiers
// and registered synthetic hashes may appear only inside such a panel.
export const conceptPanelClasses = ['ci-console', 'ci-authority', 'ci-packet', 'reference-console'];
export const conceptLabel = 'Concept visualization — synthetic engineering scenario';
const syntheticMarker = /\blattice-scenario-sdk\b|\bsynthetic-(?:revision|config)-\d+\b|\bSYN-PACKET-\d+\b|\bsynthetic\/harbor-scenario\b/;
export function conceptPanelErrors(document, name, syntheticHashes = []) {
  const errors = [];
  const outside = [];
  const text = node => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');
  const classes = node => (node.attrs ?? []).find(attr => attr.name === 'class')?.value.split(/\s+/) ?? [];
  const visit = node => {
    if (classes(node).some(c => conceptPanelClasses.includes(c))) {
      if (!text(node).replace(/\s+/g, ' ').includes(conceptLabel)) errors.push(`${name}: concept panel without its label`);
      return;
    }
    if (node.nodeName === '#text') outside.push(node.value);
    for (const attr of node.attrs ?? []) outside.push(attr.value);
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(document);
  const prose = outside.join(' ');
  if (syntheticMarker.test(prose)) errors.push(`${name}: synthetic identifier outside a labelled concept panel`);
  if (syntheticHashes.some(hash => prose.includes(hash))) errors.push(`${name}: synthetic hash outside a labelled concept panel`);
  return errors;
}
