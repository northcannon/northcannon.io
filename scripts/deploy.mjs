// scripts/deploy.mjs
//
// FIRST DRAFT, revised. The original draft shelled out to the `wrangler` npm package to push
// `dist/` to Cloudflare Pages directly. The founder flagged that `wrangler` caused a security
// vulnerability in a past project and rejected it -- removed entirely, including from
// package.json. No replacement CLI or npm package has been substituted.
//
// This script is a PRE-FLIGHT GATE ONLY. It does not upload anything to Cloudflare and holds no
// Cloudflare credential. It exists so a human can run one command and get the same fail-closed
// checks Cloudflare's own build would need, before deciding to push.
//
// Recommended actual deploy mechanism (not yet configured, and not something an agent should set
// up): Cloudflare Pages' native Git integration. The founder connects the Cloudflare Pages
// project to this GitHub repository once, in the Cloudflare dashboard, choosing the branch to
// track (almost certainly `main`, post-squash) and setting the build command (`npm run build`)
// and output directory (`dist`). After that one-time setup, every push to the tracked branch
// triggers a build and deploy on Cloudflare's own infrastructure -- no API token, no CLI, no
// third-party npm package, and no deploy credential ever has to exist in this repository, this
// script, or any agent's hands. That is a smaller attack surface than a direct-upload script by
// construction, independent of the wrangler-specific concern.
//
// If a scripted, non-Git-triggered deploy is later required instead of Git integration, that
// needs its own explicit design and founder review before being added here -- it is not drafted
// in this version.
//
// What this script actually does:
//   1. Validates PUBLIC_SOURCE_COMMIT via scripts/check-publication.mjs (fails closed unless it
//      is a 40-hex commit equal to `git rev-parse HEAD`, with a clean tree).
//   2. Runs the production build (`npm run build`, which already runs `npm run validate`).
//   3. Prints the exact commit and a reminder of the next manual step. It does not push, does not
//      touch any remote, and does not deploy.
//
// Usage:
//   PUBLIC_SOURCE_COMMIT="$(git rev-parse HEAD)" npm run predeploy

import { execFileSync } from 'node:child_process';
import { publicationIdentity } from './check-publication.mjs';

function run(command, args) {
  console.log(`+ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit' });
}

function main() {
  // Fails closed unless PUBLIC_SOURCE_COMMIT is a 40-hex commit equal to HEAD with a clean tree.
  const commit = publicationIdentity();
  console.log(`Publication identity validated: ${commit}`);

  console.log('Building production site (npm run build; includes npm run validate)...');
  run('npm', ['run', 'build']);

  console.log('');
  console.log(`Pre-flight checks passed for commit ${commit}.`);
  console.log('This script does not push or deploy. Cloudflare Pages Git integration (once');
  console.log('configured by the founder) deploys automatically from a push to the tracked');
  console.log('branch. No deploy credential is held here.');
}

main();
