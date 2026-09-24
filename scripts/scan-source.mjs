import { execFileSync } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { disclosureErrors, isSecretLikeFile } from './policy.mjs';

const textExtensions = new Set(['.md', '.mdx', '.json', '.yaml', '.yml', '.ts', '.mjs', '.astro', '.css', '.svg', '.txt']);

export async function scanTracked(root, read = readFile) {
  const base = await realpath(root);
  const names = execFileSync('git', ['ls-files', '-z'], { cwd: base, encoding: 'utf8' }).split('\0').filter(Boolean);
  const errors = [];
  let checked = 0;
  for (const name of names) {
    const basename = path.basename(name);
    // Reject secret-like filenames before reading any bytes. Only example baselines
    // are eligible; no whole-file scan exemptions exist.
    if (isSecretLikeFile(basename)) {
      errors.push(`${name}: secret-like tracked file; contents not read`);
      continue;
    }
    const full = path.resolve(base, name);
    if (!full.startsWith(base + path.sep)) { errors.push('Invalid tracked path'); continue; }
    let stat;
    try { stat = await lstat(full); } catch (error) {
      // A tracked deletion is safe; Git will record its removal.
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (!stat.isFile() || await realpath(full) !== full) {
      errors.push(`${name}: linked or non-regular source is prohibited`);
      continue;
    }
    // Self-hosted fonts are the only tracked binaries: verify the WOFF2 signature instead of scanning text.
    if (/^public\/fonts\/[\w.-]+\.woff2$/.test(name)) {
      if ((await readFile(full)).subarray(0, 4).toString('latin1') !== 'wOF2') errors.push(`${name}: not a WOFF2 font`);
      continue;
    }
    if (!textExtensions.has(path.extname(name)) && !['.gitignore', '_headers', '_redirects'].includes(basename) && !name.endsWith('.example')) {
      errors.push(`${name}: unsupported source format requires explicit review`);
      continue;
    }
    const text = await read(full, 'utf8');
    errors.push(...disclosureErrors(text, name));
    checked++;
  }
  return { checked, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await scanTracked(process.argv[2] ?? '.');
  if (result.errors.length) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
  } else console.log(`Source disclosure scan passed for ${result.checked} tracked text files.`);
}
