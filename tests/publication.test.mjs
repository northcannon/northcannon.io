import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, copyFile, mkdir, symlink, lstat, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readRoutes, draftBanner, routeCopy, navigationRoutes, navigationTree } from '../src/governance/routes.mjs';
import { loadGovernance, verifyAttestations } from '../src/governance/registry.mjs';
import { approvalEvents } from '../src/governance/approval-events.mjs';
import { inspectClaimOutput } from '../src/governance/output.mjs';
import { publicationIdentity } from '../scripts/check-publication.mjs';
import { provenance, verifyProvenance, sitemap, finalizeProduction } from '../scripts/publication.mjs';
import { createHash } from 'node:crypto';
import { inspectReviewOutput } from '../src/governance/wp4-output.mjs';
import { env as environment } from 'node:process';

const attest = (claims, ids) => claims.map(c => ids.includes(c.claim_id) ? { ...c, approval_state: 'approved', lifecycle_state: 'approved', review_date: '2026-09-14', approval_record: 'founder_attestation' } : c);

test('redesign routes stay unpublished and flat navigation obeys approval and CTA rules', () => {
  const claims = loadGovernance().claims, routes = readRoutes(claims);
  assert.deepEqual(navigationRoutes(routes, { review: true, claims }).map(r => r.path), ['/about/', '/products/', '/solutions/', '/evidence/', '/experiments/', '/contact/']);
  assert.deepEqual(navigationRoutes(routes, { review: false, claims }).map(r => r.path), ['/about/company/', '/evidence/', '/contact/']);
  assert.ok(navigationTree(routes).every(item => item.children.length === 0));
  for (const path of ['/about/', '/products/', '/solutions/', '/experiments/']) assert.equal(routes.find(r => r.path === path).publish, false);
  const invalid = structuredClone(routes); invalid.find(r => r.path === '/products/').publish = true;
  assert.throws(() => readRoutes(claims, invalid), /ineligible/);
  const two = structuredClone(routes); two[0].nav_cta = true;
  assert.throws(() => readRoutes(claims, two), /CTA/);
  const alias = structuredClone(routes); alias.find(r => r.alias_of).nav = true;
  assert.throws(() => readRoutes(claims, alias), /alias|CTA/);
  const pending = claims.map(c => c.claim_id === 'methodology-evidence' ? { ...c, approval_state: 'pending', lifecycle_state: 'review', review_date: null, approval_record: 'none' } : c);
  assert.throws(() => readRoutes(pending, routes), /ineligible/);
  const label = structuredClone(routes); label[0].title_claim_or_label = 'Unapproved label';
  assert.throws(() => readRoutes(claims, label), /Unapproved interface/);
  assert.throws(() => verifyAttestations([...claims, { ...claims[0], claim_id: 'synthetic-approval' }], '```json\n[]\n```'), /mismatch/);
});

test('pending redesign copy is review-only and undeclared, retired and unknown copy fail closed', () => {
  const claims = loadGovernance().claims, routes = readRoutes(claims);
  const home = routes.find(r => r.path === '/');
  const id = 'redesign-home-title';
  assert.equal(routeCopy(claims, home, routes, id, { review: false }), undefined);
  assert.equal(routeCopy(claims, home, routes, id, { review: true }), claims.find(c => c.claim_id === id).statement);
  assert.equal(routeCopy(attest(claims,[id]), home, routes, id, { review: false }), claims.find(c => c.claim_id === id).statement);
  for (const id of ['unknown', 'status-gate1-frozen-stress', 'brand-mission']) assert.throws(() => routeCopy(claims, home, routes, id), /Undeclared/);
  assert.ok(inspectReviewOutput('<p>View Gate 1</p>', claims, 'index.html', { review: false }).length);
  assert.ok(inspectReviewOutput('<p>View Gate 1</p>', claims, 'index.html', { review: true }).length);
});

test('publication identity requires exact commit and clean tree', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'public-identity-'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git(['init']); await writeFile(path.join(root, 'README.md'), 'Synthetic public fixture'); git(['add', 'README.md']);
    git(['-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-m', 'Fixture']);
    const head = git(['rev-parse', 'HEAD']);
    assert.throws(() => publicationIdentity('', root), /requires PUBLIC_SOURCE_COMMIT/);
    assert.throws(() => publicationIdentity('0'.repeat(40), root), /does not match/);
    assert.equal(publicationIdentity(head, root), head);
    await writeFile(path.join(root, 'README.md'), 'Dirty fixture');
    assert.throws(() => publicationIdentity(head, root), /clean tree/);
  } finally { await rm(root, { recursive: true }); }
});

test('production gates reject pending navigation and undeclared text while accepting exact approved paragraphs', () => {
  const claims = loadGovernance().claims;
  const pending = claims.map(c => c.claim_id === 'label-evidence' ? { ...c, approval_state: 'pending', lifecycle_state: 'review', review_date: null, approval_record: 'none' } : c);
  assert.throws(() => readRoutes(pending), /ineligible/);
  const vision = claims.find(c => c.claim_id === 'vision-statement').statement;
  const html = vision.split('\n\n').map(p => `<p>${p}</p>`).join('');
  assert.deepEqual(inspectReviewOutput(html, claims, 'vision/index.html', { review: false }), []);
  assert.ok(inspectReviewOutput(html.replace('AI should', 'AI definitely should'), claims, 'vision/index.html', { review: false }).length);
  assert.ok(inspectReviewOutput(html, claims, 'evidence/index.html', { review: false }).length);
  assert.ok(inspectReviewOutput(`<p>${draftBanner}</p>`, claims, 'vision/index.html', { review: false }).length);
  assert.ok(inspectReviewOutput('<p>vision-statement</p>', claims, 'vision/index.html', { review: false }).length);
  const date = claims.find(c => c.claim_id === 'status-gate1-frozen-stress').review_date;
  assert.ok(inspectReviewOutput(`<time>${date}</time>`, claims, 'evidence/index.html', { review: false }).length, 'withdrawn status date cannot render');
  assert.ok(inspectReviewOutput('<time>2025-01-15</time>', claims, 'evidence/index.html', { review: false }).length, 'undeclared dates cannot render');
});

test('provenance detects modified output and sitemap equals the publish set', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'public-provenance-'));
  try {
    await writeFile(path.join(root, 'index.html'), '<p>NorthCannon</p>');
    const xml = sitemap(readRoutes());
    assert.ok(!xml.includes('lastmod'));
    assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]), readRoutes().filter(r => r.publish && !r.alias_of && r.path !== '/404.html').map(r => 'https://northcannon.io' + r.path));
    assert.ok(!xml.includes('404'), 'the sitemap omits the 404 page');
    await writeFile(path.join(root, 'sitemap.xml'), xml);
    const data = await provenance(root);
    assert.equal(data.source_commit, null);
    assert.deepEqual(Object.keys(data).sort(), ['approval_events', 'astro_version', 'files', 'source_commit', 'sources']);
    assert.ok(Object.values(data.sources).every(v => /^[a-f0-9]{64}$/.test(v)));
    await writeFile(path.join(root, 'provenance.json'), JSON.stringify(data));
    await verifyProvenance(root);
    await writeFile(path.join(root, 'index.html'), '<p>Edited</p>');
    await assert.rejects(verifyProvenance(root), /mismatch/);
  } finally { await rm(root, { recursive: true }); }
});

test('new pending label cannot render alone but may occur within an approved statement', () => {
  const claims = loadGovernance().claims.map(c => c.claim_id === 'label-evidence' ? { ...c, approval_state: 'pending', lifecycle_state: 'review', review_date: null, approval_record: 'none' } : c);
  assert.deepEqual(inspectClaimOutput('<p>Evidence over confidence.</p>', claims, { rejectUnregistered: true }), []);
  assert.ok(inspectClaimOutput('<p>Evidence</p>', claims).length);
  assert.ok(inspectClaimOutput(`<p>${draftBanner}</p>`, claims, { rejectUnregistered: true }).length);
});

test('standalone review build rebuilds current provenance from source only and rejects missing dependencies', { timeout: 180000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wp4-source-export-'));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  try {
    // Explicit public build inputs only. Never enumerate or copy local config,
    // credentials, ignored output, or the entire checkout.
    const components = ['ActionLink', 'Container', 'ContactCTA', 'Graphene', 'Icon', 'LinkCard', 'SiteFooter', 'SiteHeader', 'SitePage', 'StatusBanner', 'Module', 'AboutSubnav', 'Readout', 'Verdict', 'SupportCells', 'WorkloadTable', 'LineageGraph', 'EvidenceDrawer', 'InteropDiagram'].map(name => `src/components/${name}.astro`);
    const pages = ['AboutCompanyPage', 'AboutFeaturesPage', 'ContactPage', 'DemoPage', 'EvidencePage', 'FounderPage', 'GatePage', 'HomePage', 'ResultsPage', 'SupportingPage'].map(name => `src/components/pages/${name}.astro`);
    const files = [
      'src/content/redesign.json', 'src/content/og-image.json', 'public/og/northcannon-default.png', 'docs/design/POST_PIVOT_COPY.md',
      'scripts/redesign-policy.mjs', 'scripts/check-redesign-output.mjs', 'scripts/check-template-copy.mjs', 'src/governance/evidence.mjs', 'src/styles/redesign.css',
      ...['PageHero','Section','OfferingCard','FlowSteps','ControlLoop','Distinction','StatusTriad','LifecycleStepper','DataTable','ControlStack','FounderProfile','EvidenceMetric','StateChip','HashValue'].map(n => `src/components/${n}.astro`),
      'src/components/pages/RedesignPage.astro',
      'src/content/concept-scenario.json', 'src/styles/concept.css',
      ...['ChangeConsole', 'AuthorityBoundary', 'ChangeHeader', 'ChangeTimeline', 'ConsequenceGraph', 'ConsequenceInspector', 'ContextPanel', 'CoverageGap', 'EvidencePacket', 'HashBlock', 'ObligationRow', 'ReconciliationLadder', 'RevalidationQueue', 'StateComparison', 'StatusChip'].map(n => `src/components/concept/${n}.astro`),
      'astro.config.mjs', 'tsconfig.json', 'package.json', 'package-lock.json',
      'public_claims/claims.json', 'docs/FOUNDER_APPROVALS.md', 'docs/public-conceptual-direction.md', 'docs/design/PUBLIC_SITE_COPY.md', 'docs/CONCEPT_PREVIEW.md', 'docs/phase-0-5-draft-claims.md',
      'public/_headers', 'public/_redirects', 'public/robots.txt', 'public/.well-known/security.txt',
      'public/graphene-lattice.svg', 'public/northcannon-mark.svg',
      'public/founder/max-brooks-480.webp', 'public/founder/max-brooks-960.webp', 'public/founder/max-brooks-480.png',
      'public/demo/northcannon-demo.mp4', 'public/demo/northcannon-demo.en.vtt', 'public/demo/northcannon-demo-poster.webp',
      ...['ibm-plex-mono-latin-400-normal', 'ibm-plex-mono-latin-500-normal', 'inter-latin-400-normal', 'inter-latin-500-normal', 'inter-latin-600-normal'].map(name => `public/fonts/${name}.woff2`),
      'src/content.config.ts', 'src/content/collections.json', 'src/content/routes.json',
      'src/governance/approval-events.mjs', 'src/governance/claim.ts',
      'src/governance/output.mjs', 'src/governance/registry.mjs', 'src/governance/routes.mjs',
      'src/governance/schema.mjs', 'src/governance/wp4-output.mjs',
      ...components, ...pages, 'src/components/copy.ts',
      'src/layouts/Document.astro', 'src/pages/404.astro', 'src/pages/index.astro', 'src/pages/[...route].astro',
      'src/styles/global.css', 'src/styles/pages.css',
      'scripts/content-integration.mjs', 'scripts/publication.mjs', 'scripts/check-publication.mjs',
      'scripts/validate.mjs', 'scripts/policy.mjs',
      'tests/fixtures/wp4/astro.config.mjs', 'tests/fixtures/wp4/src/content.config.ts',
      'tests/fixtures/wp4/src/pages/404.astro', 'tests/fixtures/wp4/src/pages/[...route].astro',
    ];
    for (const name of files) {
      assert.equal((await lstat(name)).isFile(), true);
      await mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await copyFile(name, path.join(root, name));
    }
    await symlink(path.resolve('node_modules'), path.join(root, 'node_modules'), 'dir');
    for (const name of ['dist', '.review-dist-wp4', 'test-results']) await assert.rejects(access(path.join(root, name)), { code: 'ENOENT' });
    const run = (command, args) => execFileSync(command, args, {
      cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024,
      env: { ...environment, ASTRO_TELEMETRY_DISABLED: '1', PUBLIC_SOURCE_COMMIT: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const checkDisplayed = async () => {
      const data = JSON.parse(await readFile(path.join(root, 'dist/provenance.json'), 'utf8'));
      const html = await readFile(path.join(root, '.review-dist-wp4/trust/provenance/index.html'), 'utf8');
      for (const [name, digest] of Object.entries(data.sources)) {
        assert.equal(digest, hash(await readFile(path.join(root, name))));
        assert.ok(html.includes(digest), `Displayed source digest: ${name}`);
      }
      for (const [name, digest] of Object.entries(data.files)) {
        assert.equal(digest, hash(await readFile(path.join(root, 'dist', name))));
        assert.ok(html.includes(digest), `Displayed output digest: ${name}`);
      }
      return data;
    };
    run('npm', ['run', 'build:wp4']);
    const before = await checkDisplayed();
    const claimsPath = path.join(root, 'public_claims/claims.json');
    const claims = JSON.parse(await readFile(claimsPath, 'utf8'));
    claims.find(c => c.claim_id === 'tagline-know-the-answer-show-the-proof').statement += ' Draft.';
    await writeFile(claimsPath, JSON.stringify(claims));
    for (const args of [
      ['scripts/validate.mjs', '.review-dist-wp4', '--wp4'],
      [path.resolve('node_modules/astro/bin/astro.mjs'), 'build', '--root', 'tests/fixtures/wp4'],
    ]) {
      assert.throws(() => run('node', args), error => {
        assert.match(String(error.stdout) + String(error.stderr), /Provenance digest or inventory mismatch/);
        return true;
      }, 'Review validation and direct builds must reject stale production provenance');
    }
    run('npm', ['run', 'build:wp4']);
    const after = await checkDisplayed();
    assert.notEqual(before.sources['public_claims/claims.json'], after.sources['public_claims/claims.json']);

    const manifestPath = path.join(root, 'src/content/routes.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    for (const [route, id, list] of [
      ['/trust/status/', 'status-gate1-discontinued', 'claim_ids'], ['/trust/claims/', 'brand-company-motto', 'claim_ids'],
      ['/evidence/', 'methodology-evidence', 'claim_ids'], ['/trust/', 'label-disclosure', 'claim_ids'],
      ['/gate-1/', 'gate1-historical-statement', 'claim_ids'], ['/about/company/', 'about-headline', 'review_claim_ids'],
    ]) {
      const changed = structuredClone(manifest);
      const entry = changed.find(r => r.path === route);
      entry[list] = entry[list].filter(value => value !== id);
      entry.claim_ids = entry.claim_ids.filter(value => value !== id);
      entry.review_claim_ids = entry.review_claim_ids.filter(value => value !== id);
      assert.throws(() => routeCopy(loadGovernance().claims, entry, changed, id, { review: true }), /Undeclared route claim/);
      await writeFile(manifestPath, JSON.stringify(changed));
      assert.throws(() => run('node', [path.resolve('node_modules/astro/bin/astro.mjs'), 'build', '--root', 'tests/fixtures/wp4']), error => {
        assert.match(String(error.stdout) + String(error.stderr), /Undeclared route claim|Provenance digest or inventory mismatch/);
        return true;
      }, `${route} must declare ${id}`);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});


test('Phase 0.5 claims are founder-attested by event 009, required on their routes, and withdrawn claims have no route references', () => {
  const claims = loadGovernance().claims, routes = readRoutes(claims);
  const ids = ['status-gate1-discontinued', 'gate1-historical-statement', 'evidence-status-current', 'ledger-empty-current', 'demo-coming-soon-lede', 'changelog-2026-10-truth-correction'];
  assert.deepEqual([...approvalEvents['founder-approval-009'].claim_ids].sort(), [...ids].sort());
  const designatedOwners = {
    'status-gate1-discontinued': ['/trust/status/', '/trust/claims/'], 'gate1-historical-statement': ['/gate-1/', '/trust/claims/'],
    'evidence-status-current': ['/evidence/', '/trust/claims/'], 'ledger-empty-current': ['/evidence/', '/trust/claims/'],
    'demo-coming-soon-lede': ['/demo/', '/trust/claims/'], 'changelog-2026-10-truth-correction': ['/trust/claims/', '/trust/changelog/'],
  };
  for (const id of ids) {
    const claim = claims.find(c => c.claim_id === id);
    assert.equal(claim.approval_state, 'approved');
    assert.equal(claim.lifecycle_state, 'approved');
    assert.equal(claim.approval_record, 'founder_attestation');
    assert.equal(claim.review_date, '2026-10-09');
    assert.equal(claim.basis, 'docs/FOUNDER_APPROVALS.md');
    // One content owner plus the public claims register; no published review slots.
    assertNoPublishedReviewSlot(routes, id);
    const owners = routes.filter(r => r.claim_ids.includes(id));
    assert.deepEqual(owners.map(r => r.path).sort(), [...designatedOwners[id]].sort(), id);
    assert.equal(routeCopy(claims, owners[0], routes, id, { review: false }), claim.statement);
    assert.equal(routeCopy(claims, owners[0], routes, id, { review: true }), claim.statement);
    assert.deepEqual(inspectReviewOutput(`<p>${claim.statement}</p>`, claims, owners[0].path.slice(1) + 'index.html', { review: false }), []);
  }
  const referenced = new Set(routes.flatMap(r => [...r.claim_ids, ...r.review_claim_ids]));
  for (const claim of claims.filter(c => /^(results-|demo-video-|demo-transcript-|founder-gate-)/.test(c.claim_id))) assert.ok(!referenced.has(claim.claim_id), claim.claim_id);
  for (const id of ['brand-mission', 'status-gate1-frozen-stress', 'cta-view-gate-1', 'evidence-status-title', 'ledger-empty', 'evidence-executed-title', 'evidence-executed-body']) assert.ok(!referenced.has(id), id);
  assert.ok(!routes.some(r => r.path === '/results/'));
});


test('production finalization removes withdrawn demo assets even though historical claims remain attested', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'withdrawn-demo-'));
  try {
    await mkdir(path.join(root, 'demo'));
    await mkdir(path.join(root, '.well-known'));
    await copyFile('public/.well-known/security.txt', path.join(root, '.well-known/security.txt'));
    const files = ['northcannon-demo.mp4', 'northcannon-demo.en.vtt', 'northcannon-demo-poster.webp'];
    for (const file of files) await writeFile(path.join(root, 'demo', file), 'Synthetic copied asset');
    await finalizeProduction(root);
    for (const file of files) await assert.rejects(access(path.join(root, 'demo', file)), { code: 'ENOENT' });
    const inventory = JSON.parse(await readFile(path.join(root, 'provenance.json'), 'utf8')).files;
    assert.ok(!Object.keys(inventory).some(name => /\.(mp4|vtt)$|demo-poster/.test(name)));
  } finally { await rm(root, { recursive: true }); }
});

function assertNoPublishedReviewSlot(routes, id) {
  assert.ok(!routes.some(r => r.publish && r.review_claim_ids.includes(id)), `${id}: prohibited published review slot`);
}

test('N-4 rejects each event-009 claim in every published route review slot', () => {
  const routes = readRoutes();
  for (const id of approvalEvents['founder-approval-009'].claim_ids) {
    for (const route of routes.filter(r => r.publish)) {
      const invalid = structuredClone(routes);
      invalid.find(r => r.path === route.path).review_claim_ids.push(id);
      assert.throws(() => assertNoPublishedReviewSlot(invalid, id), /prohibited published review slot/);
    }
  }
});
