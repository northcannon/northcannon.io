import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', '.astro/**', '.review-dist/**', '.review-dist-wp4/**', '**/.astro/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
];
