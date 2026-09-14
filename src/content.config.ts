import { defineCollection } from 'astro:content';
import type { Loader } from 'astro/loaders';
import { loadGovernance } from './governance/registry.mjs';
import { claimSchema, referenceSchema, statusSchema } from './governance/schema.mjs';

const data = loadGovernance();
function loader(name: string, entries: Record<string, unknown>[], key: string): Loader {
  return {
    name: `governed-${name}`,
    async load({ store, parseData, generateDigest }) {
      store.clear();
      for (const entry of entries) {
        const id = String(entry[key]);
        const parsed = await parseData({ id, data: entry });
        store.set({ id, data: parsed, digest: generateDigest(parsed) });
      }
    },
  };
}
export const collections = {
  claims: defineCollection({ loader: loader('claims', data.claims, 'claim_id'), schema: claimSchema }),
  status: defineCollection({ loader: loader('status', data.status, 'entry_id'), schema: statusSchema(data.claims) }),
  gate1: defineCollection({ loader: loader('gate1', data.gate1, 'entry_id'), schema: referenceSchema(data.claims) }),
  methodology: defineCollection({ loader: loader('methodology', data.methodology, 'entry_id'), schema: referenceSchema(data.claims) }),
  changelog: defineCollection({ loader: loader('changelog', data.changelog, 'entry_id'), schema: referenceSchema(data.claims) }),
};
