import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadGovernance } from '../src/governance/registry.mjs';
import { inspectClaimOutput } from '../src/governance/output.mjs';
import { inspectReviewOutput } from '../src/governance/wp4-output.mjs';
import { readRoutes } from '../src/governance/routes.mjs';
import { finalizeProduction, verifyProvenance } from './publication.mjs';

export default function contentGovernance() {
  let review = false;
  let wp4 = false;
  return {
    name: 'public-content-governance',
    hooks: {
      'astro:config:done': ({ config }) => { wp4 = fileURLToPath(config.root).includes(`${path.sep}fixtures${path.sep}wp4${path.sep}`); readRoutes(); review = fileURLToPath(config.root).includes(`${path.sep}tests${path.sep}fixtures${path.sep}design-system${path.sep}`); },
      'astro:build:done': async ({ dir }) => {
        const { claims } = loadGovernance();
        const root = fileURLToPath(dir);
        if (wp4) await verifyProvenance(path.resolve('dist'));
        for (const name of await readdir(root, { recursive: true })) {
          if (!name.endsWith('.html')) continue;
          const html = await readFile(path.join(root, name), 'utf8');
          const errors = wp4 || (!review && name !== '404.html') ? inspectReviewOutput(html, claims, name, { review: wp4 }) : inspectClaimOutput(html, claims, { review, rejectUnregistered: true });
          if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
        }
        if (!review && !wp4) await finalizeProduction(root);
      },
    },
  };
}
