import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const expected = JSON.parse(await readFile('tests/fixtures/rendering-parity.json', 'utf8'));
for (const [name, hash] of Object.entries(expected.html)) {
  const html = await readFile(name, 'utf8');
  const normalized = html.replace(/\/_astro\/[^"\s]+\.css/g, '/_astro/ASSET.css');
  const actual = createHash('sha256').update(normalized).digest('hex');
  if (actual !== hash) throw new Error(`HTML rendering parity failed: ${name}`);
  console.log(`Rendering parity passed: ${name}; byte-for-byte HTML unchanged except CSS asset hashes (base ${expected.bases?.[name] ?? expected.base}).`);
}
