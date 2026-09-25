import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { claimSchema, claimsSchema, statusSchema, referenceSchema } from '../src/governance/schema.mjs';
import { loadGovernance, verifyAttestations, provenanceWarnings, readAttestations } from '../src/governance/registry.mjs';
import { approvalEvents } from '../src/governance/approval-events.mjs';
import { inspectClaimOutput } from '../src/governance/output.mjs';

const current = loadGovernance();
const approved = current.claims.find(c => c.claim_id === 'brand-company');
const fixture = {
  claim_id: 'test-pending-status', statement: 'Synthetic pending status fixture.', category: 'status',
  basis: 'docs/public-conceptual-direction.md', approval_state: 'pending', lifecycle_state: 'review',
  review_date: null, approval_record: 'none', status_stage: 'preparation',
};

test('pinned approval events reject all five coordinated mutation controls', async () => {
  const events = readAttestations(await readFile('docs/FOUNDER_APPROVALS.md', 'utf8'));
  const markdown = value => '```json\n' + JSON.stringify(value) + '\n```';
  const sixth = { ...approved, claim_id: 'synthetic-sixth', statement: 'Synthetic unapproved addition.' };
  const extra = structuredClone(events);
  extra[0].claims.push({ claim_id: sixth.claim_id, statement: sixth.statement });
  assert.throws(() => verifyAttestations([...current.claims, sixth], markdown(extra)), /mismatch/);
  assert.throws(() => verifyAttestations(current.claims, markdown([...events, { ...events[0], event_id: 'synthetic-extra-event' }])), /mismatch/);
  const changed = structuredClone(events);
  changed[0].claims[0].statement += '!';
  const claims = current.claims.map(c => c.claim_id === changed[0].claims[0].claim_id ? { ...c, statement: changed[0].claims[0].statement } : c);
  assert.throws(() => verifyAttestations(claims, markdown(changed)), /digest mismatch/);
  const pins = structuredClone(approvalEvents);
  pins['founder-approval-001'].sha256 = '0'.repeat(64);
  assert.throws(() => verifyAttestations(current.claims, markdown(events), pins), /digest mismatch/);
  const moved = structuredClone(events);
  moved.push({ ...moved[0], event_id: 'synthetic-destination', claims: [moved[0].claims.pop()] });
  const destinationPins = { ...approvalEvents, 'synthetic-destination': { sha256: '0'.repeat(64), claim_ids: moved.at(-1).claims.map(c => c.claim_id) } };
  assert.throws(() => verifyAttestations(current.claims, markdown(moved), destinationPins), /digest mismatch/);
});

test('claim schema rejects missing fields, invalid approval combinations, dates and enums', () => {
  for (const field of ['claim_id', 'statement', 'category', 'basis', 'approval_state', 'lifecycle_state', 'review_date', 'approval_record']) {
    const invalid = { ...approved }; delete invalid[field];
    assert.equal(claimSchema.safeParse(invalid).success, false, field);
  }
  for (const change of [
    { review_date: null }, { review_date: '2026-02-30' }, { basis: '' }, { approval_record: 'none' },
    { lifecycle_state: 'draft' }, { category: 'unknown' }, { approval_state: 'unknown' },
    { lifecycle_state: 'unknown' }, { approval_record: 'unknown' }, { claim_id: 'Not kebab' },
    { basis: '../outside.md' }, { extra: true },
  ]) assert.equal(claimSchema.safeParse({ ...approved, ...change }).success, false, JSON.stringify(change));
  assert.equal(claimSchema.safeParse({ ...fixture, review_date: '2026-09-13' }).success, false);
});

test('unique IDs include retired entries and retired references fail closed', () => {
  const retired = current.claims.find(c => c.lifecycle_state === 'retired');
  assert.equal(claimsSchema.safeParse([...current.claims, { ...retired, claim_id: approved.claim_id }]).success, false);
  assert.equal(referenceSchema(current.claims).safeParse({ entry_id: 'example', claim_ids: [retired.claim_id] }).success, false);
  assert.equal(referenceSchema(current.claims).safeParse({ entry_id: 'example', claim_ids: ['unknown'] }).success, false);
});

test('status rejects result fields and requires replacement attestation on stage change', () => {
  const schema = statusSchema(current.claims);
  const entry = current.status[0];
  assert.equal(schema.safeParse(entry).success, true);
  for (const field of ['metric', 'metrics', 'benchmark', 'benchmarks', 'result', 'results', 'score', 'accuracy']) {
    assert.equal(schema.safeParse({ ...entry, [field]: 0.95 }).success, false, field);
  }
  for (const stage of ['preparation', 'executing', 'complete']) assert.equal(schema.safeParse({ ...entry, stage }).success, false);
  assert.equal(statusSchema([...current.claims, fixture]).safeParse({ ...entry, claim_id: fixture.claim_id }).success, false);
  assert.ok(current.claims.find(c => c.claim_id === entry.claim_id).statement.includes('Gate 1'));
});

test('founder-approved frozen status replaces preparation without execution authorization', () => {
  assert.deepEqual(current.status, [{ entry_id: 'gate1', stage: 'frozen', claim_id: 'status-gate1-frozen-stress' }]);
  assert.equal(current.claims.find(c => c.claim_id === current.status[0].claim_id).statement, 'Gate 1 is frozen, pending independent stress testing.');
  assert.deepEqual(current.gate1, []);
  assert.ok(approvalEvents['founder-approval-001'].claim_ids.includes('status-gate1-preparation'), 'historical approval remains intact');
});

// Frozen snapshot of `public_claims/public_claim_registry.yaml` at commit 8bf774a, the legacy
// registry this repository's history retired before its pre-publication squash (see decision H1
// in CONTRIBUTING.md). That commit is intentionally unreachable from the pushed history, so this
// migration-completeness check is pinned to a literal copy instead of `git show <sha>`.
const LEGACY_REGISTRY_8bf774a = [
  ['brand-company', 'approved'],
  ['brand-company-motto', 'approved'],
  ['brand-core-principle', 'approved'],
  ['brand-mission', 'approved'],
  ['tagline-know-the-answer-show-the-proof', 'pending'],
  ['mission-trust-infrastructure', 'pending'],
  ['evidence-lifecycle-current-status', 'pending'],
  ['trust-no-analytics-or-tracking', 'pending'],
  ['trust-repo-isolated-from-private-infra', 'pending'],
];

test('migration preserves each baseline ID and approval state once, with a single authority', async () => {
  const old = LEGACY_REGISTRY_8bf774a;
  assert.equal(old.length, 9);
  for (const [id, state] of old) {
    const matches = current.claims.filter(c => c.claim_id === id);
    assert.equal(matches.length, 1); assert.equal(matches[0].approval_state, state);
  }
  await assert.rejects(access('public_claims/public_claim_registry.yaml'));
  await assert.rejects(access('src/content/foundation.json'));
  assert.ok(current.claims.length >= 13);
  // Nine baseline retirements, 21 pending mock-* claims, 4 pending About-overview claims retired by the redesign,
  // 6 pending claims of the earlier two-way interoperability diagram, 1 pending duplicate (feat-wl-row-source),
  // and 5 pending lending-only diagram claims replaced by industry-agnostic ones.
  assert.equal(current.claims.filter(c => c.lifecycle_state === 'retired').length, 46);
  for (const id of ['interop-origin-title', 'interop-origin-enterprise', 'interop-origin-devices', 'interop-origin-workflow', 'interop-arrow-out', 'interop-arrow-back']) {
    const claim = current.claims.find(c => c.claim_id === id);
    assert.equal(claim.lifecycle_state, 'retired'); assert.equal(claim.approval_state, 'pending');
  }
});

test('no two active claims share a statement, except one founder-attested pair awaiting a founder decision', () => {
  const byText = new Map();
  for (const claim of current.claims.filter(c => c.lifecycle_state !== 'retired')) byText.set(claim.statement, [...(byText.get(claim.statement) ?? []), claim.claim_id]);
  const duplicates = [...byText.values()].filter(ids => ids.length > 1);
  assert.deepEqual(duplicates, [['ledger-hash', 'mock-hash-title']]);
});

test('both founder events match exactly and single-character mutations fail on either side', async () => {
  const markdown = await readFile('docs/FOUNDER_APPROVALS.md', 'utf8');
  const attested = current.claims.filter(c => c.approval_record === 'founder_attestation');
  assert.equal(attested.length, 415);
  assert.deepEqual(attested.map(c => c.claim_id).sort(), Object.values(approvalEvents).flatMap(e => e.claim_ids).sort());
  assert.equal(approvalEvents['founder-approval-002'].claim_ids.length, 38);
  assert.doesNotThrow(() => verifyAttestations(current.claims, markdown));
  for (const claim of attested) {
    const mutated = current.claims.map(c => c.claim_id === claim.claim_id ? { ...c, statement: c.statement + '!' } : c);
    assert.throws(() => verifyAttestations(mutated, markdown), /mismatch/);
    // Modify only the statement field, preserving any occurrence in other statements.
    const original = JSON.stringify(claim.statement);
    assert.throws(() => verifyAttestations(current.claims, markdown.replace(`"statement": ${original}`, `"statement": ${JSON.stringify(claim.statement + '!')}`)), /mismatch/);
  }
});

test('provenance reports exactly approved non-attested claims and ignores pending contacts', () => {
  assert.deepEqual(provenanceWarnings(current.claims), []);
  const transcription = { ...approved, claim_id: 'test-transcribed-contact', category: 'contact', statement: 'Synthetic contact.', approval_record: 'transcription' };
  assert.deepEqual(provenanceWarnings([...current.claims, transcription]), ['test-transcribed-contact']);
  const result = spawnSync(process.execPath, ['scripts/check-content.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr.trim(), '');
  assert.match(result.stdout, /Publication attestation gate passed/);
});

test('built HTML rejects pending, rejected and retired statements, including split text nodes', async () => {
  const dir = '.review-dist/governance-output';
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(`${dir}/_headers`, await readFile('public/_headers', 'utf8'));
    for (const change of [{}, { approval_state: 'rejected' }, { lifecycle_state: 'retired' }]) {
      const claim = { ...fixture, ...change };
      assert.ok(inspectClaimOutput(`<p>Synthetic pending <span>status</span> fixture.</p>`, [claim]).length);
    }
    // Exercise the actual validator against real ineligible registry entries.
    // A retired statement that is word-for-word an active approved statement is legitimately renderable.
    const approvedText = new Set(current.claims.filter(c => c.approval_state === 'approved' && c.lifecycle_state !== 'retired').map(c => c.statement));
    for (const claim of current.claims.filter(c => c.approval_state !== 'approved' && !approvedText.has(c.statement))) {
      const html = `<html lang="en"><head><title>Fixture</title></head><body><p>${claim.statement}</p></body></html>`;
      await writeFile(`${dir}/index.html`, html); await writeFile(`${dir}/404.html`, html);
      const result = spawnSync(process.execPath, ['scripts/validate.mjs', dir], { encoding: 'utf8' });
      assert.notEqual(result.status, 0); assert.match(result.stderr, /Ineligible rendered statement/);
    }
    assert.ok(inspectClaimOutput('<p>Unregistered factual assertion.</p>', current.claims, { rejectUnregistered: true }).length);
    assert.deepEqual(inspectClaimOutput(`<p>${approved.statement}</p>`, current.claims, { rejectUnregistered: true }), []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('Astro builds fail at the accessor for pending, rejected, retired and unknown IDs', async () => {
  const root = '.review-dist/governance-gate';
  await mkdir(`${root}/src/pages`, { recursive: true });
  try {
    await writeFile(`${root}/astro.config.mjs`, "import base from '../../astro.config.mjs';\nexport default { ...base, integrations: [], outDir: './out/', publicDir: '../../public/' };\n");
    for (const [name, change, id] of [
      ['pending', {}, fixture.claim_id], ['rejected', { approval_state: 'rejected' }, fixture.claim_id],
      ['retired', { lifecycle_state: 'retired' }, fixture.claim_id], ['unknown', {}, 'unknown-claim'],
    ]) {
      const data = { ...fixture, ...change };
      await writeFile(`${root}/src/content.config.ts`, `import { defineCollection } from 'astro:content';\nimport { claimSchema } from '../../../src/governance/schema.mjs';\nconst entry = ${JSON.stringify(data)};\nexport const collections = { claims: defineCollection({ schema: claimSchema, loader: { name: 'negative-claim-fixture', async load({store,parseData}) { store.clear(); const data = await parseData({id:entry.claim_id,data:entry}); store.set({id:entry.claim_id,data}); } } }) };\n`);
      await writeFile(`${root}/src/pages/index.astro`, `---\nimport { claim } from '../../../../src/governance/claim';\nconst text = await claim(${JSON.stringify(id)});\n---\n<p>{text}</p>\n`);
      const result = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--root', root], { encoding: 'utf8', timeout: 60000 });
      assert.notEqual(result.status, 0, `${name} must fail`);
      assert.match(result.stdout + result.stderr, /Claim gate: (unknown|ineligible) claim/, `${name}: ${result.stdout}${result.stderr}`);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
