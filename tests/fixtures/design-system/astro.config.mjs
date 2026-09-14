import config from '../../../astro.config.mjs';
import { fileURLToPath } from 'node:url';

// Separate review build, never written to the publication directory.
export default {
  ...config,
  outDir: fileURLToPath(new URL('../../../.review-dist/', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../../public/', import.meta.url)),
};
