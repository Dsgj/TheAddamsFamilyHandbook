import eslintPluginAstro from 'eslint-plugin-astro';
import playwright from 'eslint-plugin-playwright';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'public/**',
      'tools/**',
      'kit-docs/**',
      '.claude/**',
    ],
  },
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  ...eslintPluginSvelte.configs.recommended,
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: tseslint.parser, svelteConfig } },
  },
  // The e2e specs (audit TT2-13): an un-awaited action or assertion, a focused test, a fixed sleep.
  {
    ...playwright.configs['flat/recommended'],
    files: ['tests/e2e/**/*.ts'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-wait-for-timeout': 'error',
      // the shared asserting helpers: `home` (hubs), the axe scan and the 44 px sweep (P4 item 1)
      'playwright/expect-expect': [
        'warn',
        { assertFunctionNames: ['expect', 'home', 'nothingNew', 'targets'] },
      ],
      // One spec serves three projects: a skip that gives its reason, and a branch on the viewport
      // or the browser, are how it does that.
      'playwright/no-skipped-test': 'off',
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-conditional-expect': 'off',
    },
  },
  // Type-aware where a dropped promise hides a failure: the app's modules (TT2-13) and its
  // islands' scripts (TT3-07). The Svelte parser hands the script to typescript-eslint, which
  // needs to know `.svelte` is a file of the project; tests/unit/lint.test.ts proves the rule
  // fires in a .svelte file.
  {
    files: ['src/**/*.ts', 'src/**/*.svelte', 'src/**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: { '@typescript-eslint/no-floating-promises': 'error' },
  },
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
