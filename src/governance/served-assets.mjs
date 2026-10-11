// Every served image or SVG must have a manifest entry whose SHA-256 matches its exact bytes, so the
// provenance and review status of each visual is stated rather than assumed (architect review B-4).
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

export const servedAssetPattern = /\.(?:svg|png|webp|jpe?g|gif|avif)$/i;
export const sha256 = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

/** Relative paths of every served image or SVG under `root`, in sorted order. */
export async function listServedAssets(root, prefix = '') {
  const found = [];
  for (const item of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) found.push(...await listServedAssets(root, relative));
    else if (servedAssetPattern.test(item.name)) found.push(relative);
  }
  return found.sort();
}

/** `assets` maps served paths (such as `/graphene-lattice.svg`) to their bytes. */
export function servedAssetErrors(assets, manifest) {
  const entries = new Map((manifest.served_assets ?? []).map(entry => [entry.path, entry]));
  const errors = [];
  for (const [name, bytes] of assets) {
    const entry = entries.get(name);
    if (!entry) errors.push(`${name}: no served-asset manifest entry`);
    else if (entry.sha256 !== sha256(bytes)) errors.push(`${name}: sha256 mismatch with its manifest entry`);
  }
  return errors;
}
