import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import pluginImport from 'eslint-plugin-import';
import pluginNode from 'eslint-plugin-node';
import pluginSecurity from 'eslint-plugin-security';

export default [
  js.configs.recommended,
  pluginSecurity.configs.recommended,
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', 'pnpm-lock.yaml', '.pnpm-store/'],
  },
  {
    files: [
      'src/**/*.js',
      'eslint.config.js',
      'commitlint.config.js',
      'vitest.config.js',
      'vitest.config.integration.js',
    ],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Buffer: 'readonly',
      },
    },
    plugins: {
      import: pluginImport,
      node: pluginNode,
    },
    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'error',
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc' },
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        },
      ],
      'security/detect-object-injection': 'warn',
    },
  },
  prettierConfig,
];
