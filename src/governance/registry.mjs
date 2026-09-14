import { readFileSync, lstatSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { approvalEvents } from './approval-events.mjs';
import { claimsSchema, statusSchema, referenceSchema } from './schema.mjs';

export function canonicalJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJSON(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

export function readAttestations(markdown) {
  const blocks = [...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)];
  if (blocks.length !== 1) throw new Error('Attestation record must contain exactly one JSON record');
  const events = JSON.parse(blocks[0][1]);
  if (!Array.isArray(events) || new Set(events.map(e => e.event_id)).size !== events.length) throw new Error('Attestation event inventory mismatch');
  return events;
}

export function verifyAttestations(claims, markdown, pins = approvalEvents) {
  const events = readAttestations(markdown);
  if (JSON.stringify(events.map(e => e.event_id).sort()) !== JSON.stringify(Object.keys(pins).sort())) throw new Error('Attestation pinned event inventory mismatch');
  const recorded = new Map();
  for (const event of events) {
    if (Object.keys(event).sort().join(',') !== 'claims,event_id,founder_words,relay,timestamp' || !Array.isArray(event.claims) || typeof event.relay !== 'string' || !event.relay) throw new Error('Attestation event shape mismatch');
    const pin = pins[event.event_id];
    const digest = createHash('sha256').update(canonicalJSON(event)).digest('hex');
    if (digest !== pin.sha256) throw new Error('Attestation event digest mismatch');
    if (JSON.stringify(event.claims.map(c => c.claim_id).sort()) !== JSON.stringify([...pin.claim_ids].sort())) throw new Error('Attestation pinned claim inventory mismatch');
    for (const entry of event.claims) {
      if (recorded.has(entry.claim_id)) throw new Error('Attestation duplicate claim event mismatch');
      recorded.set(entry.claim_id, { ...entry, timestamp: event.timestamp });
    }
  }
  const attested = claims.filter(c => c.approval_record === 'founder_attestation');
  if (attested.length !== recorded.size) throw new Error('Attestation inventory mismatch');
  for (const claim of attested) {
    const entry = recorded.get(claim.claim_id);
    if (!entry || entry.statement !== claim.statement || claim.basis !== 'docs/FOUNDER_APPROVALS.md' || claim.review_date !== entry.timestamp.slice(0, 10)) throw new Error(`Attestation exact-text/provenance mismatch: ${claim.claim_id}`);
  }
}

export function provenanceWarnings(claims) {
  return claims.filter(c => c.approval_state === 'approved' && c.approval_record !== 'founder_attestation').map(c => c.claim_id).sort();
}

export function loadGovernance(root = process.cwd()) {
  if (existsSync(path.join(root, 'public_claims/public_claim_registry.yaml')) || existsSync(path.join(root, 'src/content/foundation.json'))) throw new Error('Duplicate legacy claim authority is prohibited');
  const claims = claimsSchema.parse(JSON.parse(readFileSync(path.join(root, 'public_claims/claims.json'), 'utf8')));
  for (const claim of claims) {
    const [file, fragment] = claim.basis.split('#');
    const stat = lstatSync(path.join(root, file));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Unresolvable public basis: ${claim.claim_id}`);
    if (fragment && !readFileSync(path.join(root, file), 'utf8').includes(`id="${fragment}"`)) throw new Error(`Unresolvable basis fragment: ${claim.claim_id}`);
  }
  verifyAttestations(claims, readFileSync(path.join(root, 'docs/FOUNDER_APPROVALS.md'), 'utf8'));
  const raw = JSON.parse(readFileSync(path.join(root, 'src/content/collections.json'), 'utf8'));
  if (Object.keys(raw).sort().join(',') !== 'changelog,gate1,methodology,status') throw new Error('Collection inventory mismatch');
  const collections = {};
  for (const [name, entries] of Object.entries(raw)) {
    if (!Array.isArray(entries)) throw new Error('Collection must be an array');
    const schema = name === 'status' ? statusSchema(claims) : referenceSchema(claims);
    collections[name] = entries.map(entry => schema.parse(entry));
    if (new Set(collections[name].map(entry => entry.entry_id)).size !== entries.length) throw new Error(`Duplicate entry_id: ${name}`);
  }
  if (collections.status.length !== 1 || collections.status[0].entry_id !== 'gate1') throw new Error('Exactly one Gate 1 status is required');
  return { claims, status: collections.status, gate1: collections.gate1, methodology: collections.methodology, changelog: collections.changelog };
}
