// Set the production DATABASE_URL in Vercel to the transaction-pooler form.
// Reads .env.prod locally; the value is piped to `vercel env add` and never printed.
//
//   node scripts/set-prod-dburl.mjs
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const m = fs.readFileSync('.env.prod', 'utf8').match(/^DATABASE_URL="(.+)"/m)
if (!m) { console.error('DATABASE_URL not found in .env.prod'); process.exit(1) }

const fixed = m[1].replace(
  ':5432/postgres?sslmode=require',
  ':6543/postgres?sslmode=require&pgbouncer=true&connection_limit=10&pool_timeout=20'
)
if (!fixed.includes(':6543/')) { console.error('rewrite failed'); process.exit(1) }

const res = spawnSync('npx', ['vercel', 'env', 'add', 'DATABASE_URL', 'production'], {
  input: fixed,
  stdio: ['pipe', 'inherit', 'inherit'],
})
process.exit(res.status ?? 1)
