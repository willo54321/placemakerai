// Local development database (real Postgres, no system install).
//
// Boots an embedded Postgres server on port 54322 with its data directory in
// .devdb/ (gitignored). First run initialises the cluster and creates the
// `placemaker_dev` database; after that it just starts. Leave it running in
// its own terminal alongside `npm run dev`; Ctrl-C shuts it down cleanly.
//
//   npm run db:dev        # start (and initialise on first run)
//   npm run db:push       # apply prisma schema (DATABASE_URL in .env points here)
//
// The production database URL lives only in .env.prod — see db:push:prod.
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const databaseDir = path.join(root, '.devdb')
const port = 54322
const dbName = 'placemaker_dev'

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  // UTF-8, not the SQL_ASCII the C locale would default to — public feedback
  // text contains accented characters.
  initdbFlags: ['--encoding=UTF8', '--locale=en_US.UTF-8'],
})

const firstRun = !existsSync(path.join(databaseDir, 'PG_VERSION'))
if (firstRun) {
  console.log('Initialising local Postgres cluster in .devdb/ …')
  await pg.initialise()
}

await pg.start()

if (firstRun) {
  await pg.createDatabase(dbName)
}

console.log(
  `\nDev database running:\n  postgresql://postgres:postgres@localhost:${port}/${dbName}\n\nCtrl-C to stop.`
)

let stopping = false
async function shutdown() {
  if (stopping) return
  stopping = true
  console.log('\nStopping dev database…')
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
