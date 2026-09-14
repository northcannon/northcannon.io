import config from '../../../astro.config.mjs';
import { fileURLToPath } from 'node:url';
export default {
  ...config,
  outDir: fileURLToPath(new URL('../../../.review-dist-wp4/', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../../public/', import.meta.url)),
};
