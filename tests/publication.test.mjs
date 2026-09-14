import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, copyFile, mkdir, symlink, lstat, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readRoutes, draftBanner } from '../src/governance/routes.mjs';
import { loadGovernance, verifyAttestations } from '../src/governance/registry.mjs';
import { inspectClaimOutput } from '../src/governance/output.mjs';
import { publicationIdentity } from '../scripts/check-publication.mjs';
import { provenance, verifyProvenance, sitemap } from '../scripts/publication.mjs';
import { createHash } from 'node:crypto';
import { inspectReviewOutput } from '../src/governance/wp4-output.mjs';
import { env as environment } from 'node:process';

test('manifest rejects published pending copy and unapproved labels', () => {
  const claims = loadGovernance().claims, routes = readRoutes(claims);
  assert.equal(routes.filter(r => r.publish).length, 19);
  assert.equal(routes.length, 19);
  const pending = claims.map(c => c.claim_id === 'methodology-evidence' ? { ...c, approval_state: 'pending', lifecycle_state: 'review', review_date: null, approval_record: 'none' } : c);
  assert.throws(() => readRoutes(pending, routes), /ineligible/);
  const label = structuredClone(routes); label[0].title_claim_or_label = 'Unapproved label';
  assert.throws(() => readRoutes(claims, label), /Unapproved interface/);
  const unpinned = [...claims, { ...claims[0], claim_id: 'synthetic-approval' }];
  assert.throws(() => verifyAttestations(unpinned, '```json\n[]\n```'), /mismatch/);
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
  const pending = claims.map(c => c.claim_id === 'label-demo' ? { ...c, approval_state: 'pending', lifecycle_state: 'review', review_date: null, approval_record: 'none' } : c);
  assert.throws(() => readRoutes(pending), /ineligible/);
  const vision = claims.find(c => c.claim_id === 'vision-statement').statement;
  const html = vision.split('\n\n').map(p => `<p>${p}</p>`).join('');
  assert.deepEqual(inspectReviewOutput(html, claims, 'vision/index.html', { review: false }), []);
  assert.ok(inspectReviewOutput(html.replace('AI should', 'AI definitely should'), claims, 'vision/index.html', { review: false }).length);
  assert.ok(inspectReviewOutput(html, claims, 'evidence/index.html', { review: false }).length);
  assert.ok(inspectReviewOutput(`<p>${draftBanner}</p>`, claims, 'vision/index.html', { review: false }).length);
  assert.ok(inspectReviewOutput('<p>vision-statement</p>', claims, 'vision/index.html', { review: false }).length);
});

test('provenance detects modified output and sitemap equals the publish set', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'public-provenance-'));
  try {
    await writeFile(path.join(root, 'index.html'), '<p>NorthCannon</p>');
    const xml = sitemap(readRoutes());
    assert.ok(!xml.includes('lastmod'));
    assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]), readRoutes().filter(r => r.publish).map(r => 'https://northcannon.io' + r.path));
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

test('standalone WP4 rebuilds current provenance from source only and rejects missing dependencies', { timeout: 120000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wp4-source-export-'));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  try {
    // Explicit public build inputs only. Never enumerate or copy local config,
    // credentials, ignored output, or the entire checkout.
    const files = [
      'astro.config.mjs', 'tsconfig.json', 'package.json', 'package-lock.json',
      'public_claims/claims.json', 'docs/FOUNDER_APPROVALS.md', 'docs/public-conceptual-direction.md',
      'public/_headers', 'public/robots.txt', 'public/.well-known/security.txt',
      'public/graphene-lattice.svg', 'public/northcannon-mark.svg',
      'src/content.config.ts', 'src/content/collections.json', 'src/content/routes.json',
      'src/governance/approval-events.mjs', 'src/governance/claim.ts',
      'src/governance/output.mjs', 'src/governance/registry.mjs', 'src/governance/routes.mjs',
      'src/governance/schema.mjs', 'src/governance/wp4-output.mjs',
      'src/components/ActionLink.astro', 'src/components/Container.astro', 'src/components/Graphene.astro',
      'src/components/SiteFooter.astro', 'src/components/SiteHeader.astro', 'src/components/WP4Review.astro',
      'src/layouts/Document.astro', 'src/pages/404.astro', 'src/pages/index.astro', 'src/pages/[...route].astro', 'src/styles/global.css',
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
      cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
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
    for (const [route, id] of [
      ['/trust/status/', 'label-preparation'], ['/trust/claims/', 'brand-company-motto'],
      ['/trust/claims/', 'label-category'], ['/trust/provenance/', 'label-output-files'],
      ['/trust/', 'label-disclosure'],
    ]) {
      const changed = structuredClone(manifest);
      const entry = changed.find(r => r.path === route);
      entry.claim_ids = entry.claim_ids.filter(value => value !== id);
      await writeFile(manifestPath, JSON.stringify(changed));
      assert.throws(() => run('node', [path.resolve('node_modules/astro/bin/astro.mjs'), 'build', '--root', 'tests/fixtures/wp4']), error => {
        assert.match(String(error.stdout) + String(error.stderr), /Undeclared route claim/);
        return true;
      }, `${route} must declare ${id}`);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
