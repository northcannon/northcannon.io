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

test('status rejects result fields and mismatched stages', () => {
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

test('discontinued status replaces retired frozen status without losing history', () => {
  assert.deepEqual(current.status, [{ entry_id: 'pi-gate1', stage: 'discontinued', claim_id: 'status-gate1-discontinued' }]);
  assert.match(current.claims.find(c => c.claim_id === current.status[0].claim_id).statement, /discontinued/);
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
  // 5 pending lending-only diagram claims replaced by industry-agnostic ones, and the approved mission (retired by
  // founder decision N-11, approval history preserved), plus 20 pending run-1 drafts superseded by split or reused claims.
  assert.equal(current.claims.filter(c => c.lifecycle_state === 'retired').length, 69);
  const mission = current.claims.find(c => c.claim_id === 'brand-mission');
  assert.deepEqual([mission.approval_state, mission.lifecycle_state, mission.approval_record], ['approved', 'retired', 'founder_attestation']);
  assert.ok(approvalEvents['founder-approval-001'].claim_ids.includes('brand-mission'), 'mission approval history remains pinned');
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
  assert.equal(attested.length, 441);
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

test('retirement preserves pinned history but is ineligible in every accessor', async () => {
  const { eligibleClaim } = await import('../src/governance/schema.mjs');
  const { draftClaim } = await import('../src/governance/routes.mjs');
  for (const id of ['status-gate1-preparation', 'status-gate1-frozen-stress']) {
    const retired = current.claims.find(c => c.claim_id === id);
    assert.equal(retired.lifecycle_state, 'retired');
    assert.equal(retired.approval_record, 'founder_attestation');
    assert.throws(() => eligibleClaim(retired, id), /ineligible/);
    assert.throws(() => draftClaim(current.claims, id), /Ineligible/);
  }
  verifyAttestations(current.claims, await readFile('docs/FOUNDER_APPROVALS.md', 'utf8'));
});

test('evidence classes and complete KPI payloads fail closed', async () => {
  const { evidenceMetric, evidenceRecord, validateEvidencePlacement } = await import('../src/governance/evidence.mjs');
  assert.equal(evidenceRecord.safeParse({ subject: 'fixture', status: 'fixture' }).success, false);
  assert.throws(() => validateEvidencePlacement({ evidence_class: 'historical', subject: 'fixture', status: 'fixture' }, 'kpis'));
  assert.equal(evidenceMetric.safeParse({ evidence_class: 'product', value: 1 }).success, false);
});

test('template parser rejects dormant prose but accepts governed expressions', async () => {
  const { templateCopyErrors } = await import('../scripts/check-template-copy.mjs');
  assert.equal((await templateCopyErrors('<p>Unregistered dormant prose</p>', 'fixture')).length, 1);
  assert.deepEqual(await templateCopyErrors('<p>{t("label-about")}</p>', 'fixture'), []);
});

test('rendered prose, SVG, accessibility and metadata have the same claim boundary', async () => {
  const { inspectReviewOutput } = await import('../src/governance/wp4-output.mjs');
  for (const html of ['<p>Unregistered sentence.</p>', '<svg><text>Unregistered sentence.</text></svg>', '<img alt="Unregistered sentence.">', '<div aria-description="Unregistered sentence."></div>', '<meta name="description" content="Unregistered sentence.">', '<meta property="og:description" content="Unregistered sentence.">']) {
    assert.ok(inspectReviewOutput(html, current.claims, 'index.html', { review: true }).length, html);
    assert.ok(inspectReviewOutput(html, current.claims, 'index.html', { review: false }).length, html);
  }
  const statement = current.claims.find(c => c.claim_id === 'redesign-home-title').statement;
  assert.deepEqual(inspectReviewOutput(`<svg><text>${statement}</text></svg>`, current.claims, 'index.html', { review: true }), []);
  assert.ok(inspectReviewOutput(`<meta name="description" content="${statement}">`, current.claims, 'index.html', { review: false }).length);
});

test('actual production claims must be present in the public register', async () => {
  const { claimRegisterErrors } = await import('../src/governance/output.mjs');
  const docs = new Map([['index.html','<h1>NorthCannon</h1>'],['trust/claims/index.html','<li data-claim-id="brand-company">NorthCannon</li>']]);
  assert.deepEqual(claimRegisterErrors(docs,current.claims), []);
  docs.set('trust/claims/index.html','');
  assert.ok(claimRegisterErrors(docs,current.claims).length);
});


function checkPendingInventory(claims, routes, events, text) {
  const listed = new Map();
  let batch;
  for (const section of text.split(/(?=^## E-)/m)) {
    const match = /^## (E-\d+)/m.exec(section);
    if (!match) continue;
    batch = match[1];
    for (const entry of section.matchAll(/^### (\S+)\n\n([\s\S]*?)(?=\n### |\n## |$)/gm)) {
      const id = entry[1];
      assert.ok(!listed.has(id), `${id}: duplicate inventory entry`);
      listed.set(id, { batch, statement: entry[2].trim() });
    }
  }
  const pending = claims.filter(c => c.approval_state === 'pending');
  const review = pending.filter(c => c.lifecycle_state === 'review');
  const retired = pending.filter(c => c.lifecycle_state === 'retired');
  assert.equal(review.length + retired.length, pending.length, 'pending lifecycle is exhaustively review or retired');
  assert.equal(listed.size, review.length, 'only active pending claims request approval');
  const eventIds = Object.values(events).flat();
  assert.equal(eventIds.length, review.length, 'event inventory is exhaustive');
  for (const c of review) {
    assert.equal(listed.get(c.claim_id)?.statement, c.statement, `${c.claim_id}: exact statement`);
    assert.equal(eventIds.filter(id => id === c.claim_id).length, 1, `${c.claim_id}: exactly one batch`);
    assert.ok(events[listed.get(c.claim_id).batch].includes(c.claim_id), `${c.claim_id}: correct batch`);
  }
  for (const c of retired) {
    assert.ok(!listed.has(c.claim_id) && !eventIds.includes(c.claim_id), `${c.claim_id}: retired is not requesting approval`);
    assert.ok(!routes.some(r => [...r.claim_ids, ...r.review_claim_ids].includes(c.claim_id)), `${c.claim_id}: retired route reference`);
  }
}

test('pending inventory exhaustively accounts for review and retired claims with exact text and batches', async () => {
  const { readRoutes, draftClaim } = await import('../src/governance/routes.mjs');
  const { eligibleClaim } = await import('../src/governance/schema.mjs');
  const text = await readFile('docs/design/POST_PIVOT_COPY.md', 'utf8');
  const { events } = JSON.parse(await readFile('src/content/redesign.json', 'utf8'));
  checkPendingInventory(current.claims, readRoutes(), events, text);
  for (const c of current.claims.filter(c => c.approval_state === 'pending' && c.lifecycle_state === 'retired')) {
    assert.throws(() => draftClaim(current.claims, c.claim_id), /Ineligible/);
    assert.throws(() => eligibleClaim(c, c.claim_id), /ineligible/);
  }
});

test('pending inventory rejects omissions, duplicates, altered text, wrong batches, retired requests and route references', () => {
  const active = { ...fixture, claim_id: 'inventory-active' };
  const retired = { ...fixture, claim_id: 'inventory-retired', lifecycle_state: 'retired' };
  const claims = [active, retired], events = { 'E-010': [active.claim_id] };
  const text = `## E-010\n\n### ${active.claim_id}\n\n${active.statement}\n`;
  const check = (cs = claims, rs = [], es = events, md = text) => checkPendingInventory(cs, rs, es, md);
  check();
  assert.throws(() => check(claims, [], events, '## E-010\n'));
  assert.throws(() => check(claims, [], events, text + text));
  assert.throws(() => check(claims, [], events, text.replace(active.statement, 'Wrong text.')));
  assert.throws(() => check(claims, [], { 'E-011': [active.claim_id] }));
  assert.throws(() => check(claims, [], { 'E-010': [active.claim_id, active.claim_id] }));
  assert.throws(() => check(claims, [], { 'E-010': [active.claim_id, retired.claim_id] }, text + `\n### ${retired.claim_id}\n\n${retired.statement}\n`));
  for (const slot of ['claim_ids', 'review_claim_ids']) {
    const route = { claim_ids: [], review_claim_ids: [], [slot]: [retired.claim_id] };
    assert.throws(() => check(claims, [route]), /retired route reference/);
  }
  for (const lifecycle_state of ['draft', 'approved']) assert.throws(() => check([active, { ...retired, lifecycle_state }]), /exhaustively/);
});

function checkMetadataConfirmation(claims, draft, text) {
  const claim = claims.find(c => c.claim_id === 'status-gate1-discontinued');
  assert.deepEqual(draft.metadata_confirmation_requests?.['E-013'], [{ claim_id: claim.claim_id, fields: { category: claim.category, status_stage: claim.status_stage }, state: 'requested' }]);
  const section = text.split('## E-013')[1]?.split(/\n## /)[0];
  assert.ok(section?.includes('#### Metadata confirmation requested'));
  for (const value of [claim.claim_id, `category=${claim.category}`, `status_stage=${claim.status_stage}`]) assert.ok(section.includes('`' + value + '`'), value);
}

test('E-013 explicitly requests founder confirmation of actual category and stage metadata', async () => {
  const draft = JSON.parse(await readFile('src/content/redesign.json', 'utf8'));
  const text = await readFile('docs/design/POST_PIVOT_COPY.md', 'utf8');
  checkMetadataConfirmation(current.claims, draft, text);
  const absent = structuredClone(draft); delete absent.metadata_confirmation_requests;
  assert.throws(() => checkMetadataConfirmation(current.claims, absent, text));
  for (const field of ['category', 'status_stage']) {
    const wrong = structuredClone(draft); wrong.metadata_confirmation_requests['E-013'][0].fields[field] = 'wrong';
    assert.throws(() => checkMetadataConfirmation(current.claims, wrong, text));
    assert.throws(() => checkMetadataConfirmation(current.claims, draft, text.replace(`${field}=`, 'missing=')));
  }
  assert.throws(() => checkMetadataConfirmation(current.claims, draft, text.replace('#### Metadata confirmation requested', '')));
});

test('synthetic scenario identities, counts, relations and obligations are internally consistent', async () => {
  const { createHash } = await import('node:crypto');
  const f = JSON.parse(await readFile('src/content/concept-scenario.json', 'utf8'));
  assert.equal(f.synthetic, true);
  const ids = new Set(f.nodes.map(n => n.id));
  assert.equal(ids.size, f.nodes.length);
  for (const e of f.edges) { assert.ok(ids.has(e.source)); assert.ok(ids.has(e.target)); assert.ok(f.evidence.some(r => r.id === e.evidence)); }
  for (const o of f.obligations) { assert.ok(ids.has(o.node)); assert.ok(f.evidence.some(r => r.id === o.evidence)); }
  const counts = {
    changed: f.nodes.filter(n => n.state === 'CHANGED').length,
    potential: f.nodes.filter(n => n.state === 'POTENTIALLY_AFFECTED').length,
    services: f.nodes.filter(n => n.kind === 'service').length,
    tests: f.nodes.filter(n => n.kind === 'test' && n.state !== 'SUPPORTED_UNAFFECTED').length,
    knowledge: f.nodes.filter(n => n.kind === 'knowledge' && n.state === 'POTENTIALLY_AFFECTED').length,
    obligations: f.obligations.length,
    unresolved: f.edges.filter(e => e.state !== 'admitted').length,
    gaps: f.coverage_gaps.length,
  };
  assert.deepEqual(Object.keys(f.count_claims).sort(), Object.keys(counts).sort());
  for (const [key, count] of Object.entries(counts)) assert.equal(current.claims.find(c => c.claim_id === f.count_claims[key]).statement, `${count} ${f.count_labels[key]}`);
  for (const e of f.evidence) {
    assert.equal(e.sha256, createHash('sha256').update(e.seed).digest('hex'));
    assert.equal(current.claims.find(c => c.claim_id === e.hash_claim).statement, e.sha256);
  }
  for (const [, id] of JSON.stringify(f).matchAll(/"(concept-[a-z0-9-]+)"/g)) {
    const claim = current.claims.find(c => c.claim_id === id);
    assert.equal(claim?.approval_state, 'pending', id);
    assert.equal(claim?.lifecycle_state, 'review', id);
  }
});
