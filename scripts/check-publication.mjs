import { execFileSync } from 'node:child_process';
import { env } from 'node:process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export function publicationIdentity(commit = env.PUBLIC_SOURCE_COMMIT, root = process.cwd()) {
  if (!commit || !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Publication requires PUBLIC_SOURCE_COMMIT as a 40-hex commit');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  if (commit !== git(['rev-parse', 'HEAD'])) throw new Error('Publication source commit does not match HEAD');
  if (git(['status', '--porcelain'])) throw new Error('Publication requires a clean tree');
  return commit;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  publicationIdentity();
  console.log('Publication identity validated: exact HEAD and clean tree. No publication performed.');
}
