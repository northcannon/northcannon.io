import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import contentGovernance from './scripts/content-integration.mjs';

export default defineConfig({
  site: 'https://northcannon.io',
  output: 'static',
  integrations: [contentGovernance()],
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  prefetch: false,
  build: { inlineStylesheets: 'never' },
  vite: {
    plugins: [tailwindcss()],
    build: { assetsInlineLimit: 0, sourcemap: false },
  },
});
