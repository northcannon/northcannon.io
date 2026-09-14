import { getEntry } from 'astro:content';
import { eligibleClaim } from './schema.mjs';

/** Build-time only: missing approval is an error, never empty or fallback copy. */
export async function claim(id: string): Promise<string> {
  const entry = await getEntry('claims', id);
  return eligibleClaim(entry?.data, id).statement;
}
