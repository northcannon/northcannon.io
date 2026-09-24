import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { scanTracked } from '../scripts/scan-source.mjs';

test('bracket ignore glob preserves all six original ignore decisions', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'public-ignore-equivalence-'));
  try {
    execFileSync('git', ['init'], { cwd: dir, stdio: 'pipe' });
    const names = ['', '.local', '.production', '.example'].map(s => ['.en', 'v', s].join('')).concat(['envfile', ['x.en', 'v'].join('')]);
    const decisions = [];
    for (const glob of [['.en', 'v*'].join(''), '.en[v]*']) {
      await writeFile(path.join(dir, '.gitignore'), glob + '\n');
      decisions.push(names.map(name => {
        try { execFileSync('git', ['check-ignore', '--no-index', '--quiet', name], { cwd: dir }); return true; }
        catch (error) { assert.equal(error.status, 1); return false; }
      }));
    }
    assert.deepEqual(decisions[0], [true, true, true, true, false, false]);
    assert.deepEqual(decisions[1], decisions[0]);
    console.log('Ignore equivalence passed: four environment basenames ignored; envfile and prefixed basename not ignored; 6/6 identical.');
  } finally { await rm(dir, { recursive: true }); }
});

test('tracked source scan rejects disclosures, never reads secret files, and has zero whole-file exemptions', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'public-source-scan-'));
  const git = args => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  try {
    git(['init']);
    await writeFile(path.join(dir, 'README.md'), 'Public copy');
    await writeFile(path.join(dir, '.gitignore'), '.en[v]*\n');
    git(['add', 'README.md', '.gitignore']);
    assert.deepEqual((await scanTracked(dir)).errors, []);
    await writeFile(path.join(dir, 'README.md'), ['', 'Users', 'example', 'local'].join('/'));
    assert.match((await scanTracked(dir)).errors.join('\n'), /README.md/);
    await writeFile(path.join(dir, 'README.md'), 'Public copy');
    await writeFile(path.join(dir, ['.en', 'v.local'].join('')), 'synthetic fixture; must not be read');
    git(['add', '-f', ['.en', 'v.local'].join('')]);
    const readNames = [];
    const result = await scanTracked(dir, async (file, encoding) => {
      readNames.push(path.basename(file));
      return readFile(file, encoding);
    });
    assert.ok(!readNames.includes(['.en', 'v.local'].join('')));
    assert.match(result.errors.join('\n'), /contents not read/);
    git(['rm', '--cached', '-f', ['.en', 'v.local'].join('')]);
    await writeFile(path.join(dir, '.gitignore'), ['.en[v]*\n', ['', 'Users', 'example', 'local'].join('/'), '\n'].join(''));
    assert.match((await scanTracked(dir)).errors.join('\n'), /\.gitignore/);
    await writeFile(path.join(dir, '.gitignore'), '.en[v]*\n');
    await symlink('README.md', path.join(dir, 'linked.md'));
    git(['add', 'linked.md']);
    assert.match((await scanTracked(dir)).errors.join('\n'), /linked or non-regular/);
  } finally { await rm(dir, { recursive: true }); }
});

test('all disclosure pattern families reject runtime fixtures with no exemptions', async () => {
  const { disclosureErrors } = await import('../scripts/policy.mjs');
  const fixtures = [
    ...['Users', 'private', 'home'].map(segment => ['', segment, 'example'].join('/')),
    ['docs', 'internal'].join('/'), ['repo', 'buildout'].join('_'),
    ['founder', 'planning'].join('_'), ['.en', 'v'].join(''),
    ['github.com', 'northcannon', 'northcannon'].join('/'),
    ['-----BEGIN ', 'PRIVATE KEY-----'].join(''),
    ['ghp', 'a'.repeat(20)].join('_'), ['AK', 'IA', 'A'.repeat(16)].join(''),
  ];
  for (const fixture of fixtures) assert.equal(disclosureErrors(fixture, 'fixture').length, 1);
  const result = await scanTracked('.');
  assert.deepEqual(result.errors, []);
  for (const name of ['scripts/policy.mjs', 'tests/policy.test.mjs', 'tests/source.test.mjs']) {
    const observed = [];
    await scanTracked('.', async (file, encoding) => { observed.push(file); return readFile(file, encoding); });
    assert.ok(observed.some(file => file.endsWith(name)), `must scan ${name}`);
  }
});

test('lattice is deterministic decorative artwork with no resources or scripts', async () => {
  const svg = await readFile('public/graphene-lattice.svg', 'utf8');
  assert.doesNotMatch(svg, /<script|<foreignObject|<animate|<set|href=|url\((?!#)/i);
  const result = spawnSync(process.execPath, ['scripts/generate-lattice.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const css = await readFile('src/styles/global.css', 'utf8');
  assert.match(css, /\.graphene \{ position: absolute; inset: 0;/);
  assert.match(svg, /<pattern id="lattice" patternUnits="userSpaceOnUse"/);
  assert.match(css, /forced-colors: active\) \{\n  \.graphene \{ display: none; \}/);
});

test('public documentation markdown links resolve after conceptual rename', async () => {
  const { access } = await import('node:fs/promises');
  const names = execFileSync('git', ['ls-files', '-z', '*.md'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const name of names) {
    const text = await readFile(name, 'utf8');
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^[a-z]+:/i.test(target) || target.startsWith('/')) continue;
      await access(path.resolve(path.dirname(name), target));
    }
  }
});

test('font provenance document matches the shipped font and license files', async () => {
  const { createHash } = await import('node:crypto');
  const doc = await readFile('docs/design/FONTS.md', 'utf8');
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir('public/fonts')).sort();
  assert.equal(files.length, 7);
  for (const file of files) {
    const digest = createHash('sha256').update(await readFile(`public/fonts/${file}`)).digest('hex');
    assert.ok(doc.includes(file) && doc.includes(digest), `docs/design/FONTS.md must list ${file} with its sha256`);
  }
});
