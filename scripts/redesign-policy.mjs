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

// Production forbidden-copy guard: phrases and the "never name" list (models, vendors, tools, hardware, team handles).
// Names match on word boundaries so ordinary words such as "solution" never match; "Sol" and "Cursor" are case-sensitive.
const forbiddenPhrases = /trust infrastructure|after Gate 1 runs|will be published after the run|pending independent stress testing|Gate 1 will run/i;
const forbiddenNames = /\b(?:GPT(?:-?\d[\w.]*)?|Claude|OpenAI|Anthropic|NVIDIA|Astra|Luna|Sonnet|Opus|Haiku|Codex|Ollama|Gemini|Llama|Mistral|Postgres(?:QL)?|H100|A100)\b/i;
const forbiddenProperNames = /\b(?:Sol|Cursor)\b/;
export function forbiddenCopyErrors(text, name) {
  return conceptOutputErrors(text, name).length || forbiddenPhrases.test(text) || forbiddenNames.test(text) || forbiddenProperNames.test(text) ? [`${name}: forbidden public copy`] : [];
}

// Synthetic identifiers and fixture dependency names cannot enter any production text asset.
export function conceptOutputErrors(text, name) {
  return /\bconcept-[a-z0-9-]+\b|\blattice-fixture-sdk\b/i.test(text) ? [`${name}: synthetic concept in production`] : [];
}
