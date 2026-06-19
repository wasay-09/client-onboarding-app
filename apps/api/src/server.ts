import { loadConfig } from './config'
import { createDatabase } from './db/client'
import { runMigrations } from './db/migrate'
import { buildApp } from './app'

const config = loadConfig()
const database = createDatabase(config)
await runMigrations(database)
const app = buildApp(config, database)

try {
  const address = await app.listen({ port: config.port, host: '0.0.0.0' })
  console.log(`api listening on ${address} (db: ${database.kind})`)
} catch (err) {
  console.error(err)
  process.exit(1)
}
