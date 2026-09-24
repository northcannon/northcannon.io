import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectMarkup, readHeaders, disclosureErrors } from '../scripts/policy.mjs';

for (const markup of [
  '<script src="/local.js"></script>', '<script>alert(1)</script>',
  '<p style="color:red">text</p>', '<style>p{color:red}</style>',
  '<img src="https://example.com/pixel">', '<img src="//example.com/pixel">',
  '<a href="java&#x73;cript:alert(1)">link</a>', '<p onclick="alert(1)">text</p>',
  '<form action="/submit"></form>', '<iframe src="/frame"></iframe>',
  '<link rel="preconnect" href="/">', '<img srcset="/local 1x, https://example.com/img 2x">',
  '<meta http-equiv="refresh" content="0;url=https://example.com">',
]) {
  test(`rejects prohibited markup: ${markup}`, () => {
    assert.ok(inspectMarkup(markup, 'fixture').errors.length);
  });
}
test('allows local markup and approved contact links', () => {
  assert.deepEqual(inspectMarkup('<main id="main"><a href="#main">Top</a><a href="mailto:hello@northcannon.io">Contact</a></main>', 'fixture').errors, []);
});
test('rejects relaxed, duplicate, missing, or partial headers', async () => {
  const policy = await readFile('public/_headers', 'utf8');
  assert.doesNotThrow(() => readHeaders(policy));
  for (const invalid of [policy.replace("script-src 'none'", "script-src 'unsafe-inline'"), policy.replace('/*', '/only/'), policy.replace(/.*Referrer-Policy.*\n/, ''), policy + '  Set-Cookie: test=true\n', policy + '  X-Frame-Options: SAMEORIGIN\n']) {
    assert.throws(() => readHeaders(invalid));
  }
});
test('rejects private paths without printing their contents', () => {
  assert.ok(disclosureErrors(['', 'Users', 'example', 'private'].join('/'), 'fixture').length);
  assert.ok(disclosureErrors(['docs', 'internal', 'example.md'].join('/'), 'fixture').length);
});

test('repository and well-known security disclosure files agree', async () => {
  assert.equal(await readFile('security.txt', 'utf8'), await readFile('public/.well-known/security.txt', 'utf8'));
});

test('output validator fails on actual artifact violations', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'northcannon-policy-'));
  const html = '<!doctype html><html lang="en"><head><title>Fixture</title><link rel="stylesheet" href="/site.css"></head><body><main><h1>Fixture</h1></main></body></html>';
  const policy = await readFile('public/_headers', 'utf8');
  const run = () => spawnSync(process.execPath, ['scripts/validate.mjs', dir, '--review'], { encoding: 'utf8' });
  try {
    await writeFile(path.join(dir, '_headers'), policy);
    await writeFile(path.join(dir, 'index.html'), html);
    await writeFile(path.join(dir, 'site.css'), 'body{color:white}');
    assert.equal(run().status, 0);
    for (const css of ['@import "https://example.com/font.css";', 'p{background:url(https://example.com/pixel)}', 'p{background:u\\72l(https://example.com/pixel)}', 'p{background:image-set("https://example.com/pixel" 1x)}', ':root{--image:url(https://example.com/pixel)}']) {
      await writeFile(path.join(dir, 'site.css'), css);
      assert.notEqual(run().status, 0, `must reject CSS resource loading: ${css}`);
    }
    await writeFile(path.join(dir, 'site.css'), 'body{color:white}');
    for (const markup of ['<script src="/app.js"></script>', '<a href="/missing/">Missing</a>', '<a href="#missing">Missing</a>', '<p style="color:red">Inline</p>', '<p>' + ['docs', 'internal', 'private.md'].join('/') + '</p>']) {
      await writeFile(path.join(dir, 'index.html'), html.replace('</main>', `${markup}</main>`));
      assert.notEqual(run().status, 0);
    }
    await writeFile(path.join(dir, 'index.html'), html);
    await writeFile(path.join(dir, 'app.js'), '// prohibited output');
    assert.notEqual(run().status, 0);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('review output uses the same rejection policy with a separate route inventory', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'northcannon-review-policy-'));
  const run = review => spawnSync(process.execPath, ['scripts/validate.mjs', dir, ...(review ? ['--review'] : [])], { encoding: 'utf8' });
  try {
    await writeFile(path.join(dir, '_headers'), await readFile('public/_headers', 'utf8'));
    const html = '<!doctype html><html lang="en"><head><title>Review</title></head><body><h1>Review</h1></body></html>';
    await writeFile(path.join(dir, 'index.html'), html);
    assert.equal(run(true).status, 0);
    assert.notEqual(run(false).status, 0, 'review inventory is not production inventory');
    await writeFile(path.join(dir, 'index.html'), html.replace('</body>', '<script src="/app.js"></script></body>'));
    assert.notEqual(run(true).status, 0, 'review mode must still reject scripts');
    await writeFile(path.join(dir, 'index.html'), html);
    await writeFile(path.join(dir, '404.html'), html);
    assert.notEqual(run(true).status, 0, 'review mode rejects extra routes');
  } finally { await rm(dir, { recursive: true }); }
});

test('output validator permits only self-hosted woff2 @font-face', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'northcannon-font-policy-'));
  const html = '<!doctype html><html lang="en"><head><title>Fixture</title><link rel="stylesheet" href="/site.css"></head><body><main><h1>Fixture</h1></main></body></html>';
  const run = () => spawnSync(process.execPath, ['scripts/validate.mjs', dir, '--review'], { encoding: 'utf8' });
  try {
    await writeFile(path.join(dir, '_headers'), await readFile('public/_headers', 'utf8'));
    await writeFile(path.join(dir, 'index.html'), html);
    await writeFile(path.join(dir, 'site.css'), '@font-face{font-family:Inter;src:url(/fonts/inter-latin-400-normal.woff2) format("woff2")}');
    assert.equal(run().status, 0, 'local font must be accepted');
    for (const css of [
      '@font-face{font-family:X;src:url(https://example.com/x.woff2)}',
      '@font-face{font-family:X;src:url(//example.com/x.woff2)}',
      '@font-face{font-family:X;src:url(/other/x.woff2)}',
      '@font-face{font-family:X;src:url(/fonts/x.woff2),url(https://example.com/x.woff2)}',
      '@font-face{font-family:X;src:url("https://example.com/x.woff2")}',
      '@font-face{font-family:X;src:url(/fonts/../x.woff2)}',
      '@font-face{font-family:X;src:url(/fonts/x.woff)}',
      'p{background:url(/fonts/inter-latin-400-normal.woff2)}',
    ]) {
      await writeFile(path.join(dir, 'site.css'), css);
      assert.notEqual(run().status, 0, `must reject: ${css}`);
    }
  } finally {
    await rm(dir, { recursive: true });
  }
});
