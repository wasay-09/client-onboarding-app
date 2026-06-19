import { defineConfig } from 'drizzle-kit'

// Generates SQL migrations from the kernel schema (no DB connection needed).
// Applied at runtime/tests via src/db/migrate.ts.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/kernel.ts',
  out: './drizzle',
})
