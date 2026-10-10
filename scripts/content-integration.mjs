import { execFileSync } from 'node:child_process';
import { redesignRedirects } from './redesign-policy.mjs';
import { readdir, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadGovernance } from '../src/governance/registry.mjs';
import { inspectClaimOutput } from '../src/governance/output.mjs';
import { inspectReviewOutput } from '../src/governance/wp4-output.mjs';
import { readRoutes } from '../src/governance/routes.mjs';
import { finalizeProduction, verifyProvenance } from './publication.mjs';

// Project root from this file, never from the process cwd.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.NORTHCANNON_PRODUCTION_PROVENANCE = path.join(projectRoot, 'dist/provenance.json');
export default function contentGovernance() {
  let review = false;
  let wp4 = false;
  return {
    name: 'public-content-governance',
    hooks: {
      'astro:config:done': ({ config }) => { wp4 = fileURLToPath(config.root).includes(`${path.sep}fixtures${path.sep}wp4${path.sep}`); readRoutes(); review = fileURLToPath(config.root).includes(`${path.sep}tests${path.sep}fixtures${path.sep}design-system${path.sep}`); },
      'astro:build:start': () => { if (review) execFileSync('npm', ['run', 'build'], { cwd: projectRoot, stdio: 'pipe', env: { ...process.env, NORTHCANNON_SKIP_REVIEW_INVENTORY: '1' } }); },
      'astro:build:done': async ({ dir }) => {
        const { claims } = loadGovernance();
        const root = fileURLToPath(dir);
        if (review || wp4) {
          await writeFile(path.join(root, '_redirects'), redesignRedirects.join('\n') + '\n');
          // The Evidence ledger links the production manifest; review output carries a byte-identical copy so the link resolves.
          await copyFile(path.join(projectRoot, 'dist/provenance.json'), path.join(root, 'provenance.json'));
          for (const file of ['demo/northcannon-demo.mp4', 'demo/northcannon-demo.en.vtt', 'demo/northcannon-demo-poster.webp']) await rm(path.join(root, file), { force: true });
        }
        for (const name of await readdir(root, { recursive: true })) {
          if (!name.endsWith('.html')) continue;
          const html = await readFile(path.join(root, name), 'utf8');
          const errors = name === 'specimen/index.html' ? inspectClaimOutput(html, claims, { review: true, rejectUnregistered: true }) : inspectReviewOutput(html, claims, name, { review: wp4 || review });
          if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
        }
        if (wp4 || review) await verifyProvenance(path.resolve('dist'));
        if (!review && !wp4) await finalizeProduction(root);
      },
    },
  };
}
