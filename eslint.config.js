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
    // Dev scripts run in Node via vite-node — allow Node globals (process, etc.).
    files: ['scripts/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
