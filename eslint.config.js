import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['**/dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Module boundary: the shared package is a single contract. Import it via its
      // package root (@fbsi/shared), never through deep internal paths. (Boundaries
      // between future apps/api modules will be added alongside the API in Phase 2.)
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@fbsi/shared/*'],
          message: 'Import from the @fbsi/shared package root (its public barrel), not deep paths.',
        }],
      }],
    },
  },
  {
    // Node-context code (the API + dev scripts) — allow Node globals (process, Buffer, etc.).
    files: ['apps/api/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx}', '**/drizzle.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
