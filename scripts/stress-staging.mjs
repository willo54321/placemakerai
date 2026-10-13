// Staged load test against the STAGING deployment.
//
//   set -a && . ./.env.staging && set +a && node scripts/stress-staging.mjs
//
// Requires VERCEL_AUTOMATION_BYPASS_SECRET (Vercel → Settings → Deployment
// Protection → Protection Bypass for Automation) to get past the SSO gate.
// Refuses to run against production hosts.
//
// Load is deliberately bounded (max 30 concurrent, short phases): the Vercel
// account's function concurrency is shared with production.
//
// All write submissions are tagged "[stress-test]" so they can be deleted
// afterwards (scripts/stress-cleanup.mjs).

const BASE = process.env.STRESS_BASE_URL || 'https://staging.placemakerai.io'
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || ''
const PROJECT = 'untypical-demo'
const FORM = 'stress-test-form'

if (/placemakerai\.io\/?$/.test(BASE) && !/staging\./.test(BASE)) {
  console.error('Refusing: BASE looks like production.')
  process.exit(1)
}
if (!BYPASS) {
  console.error('VERCEL_AUTOMATION_BYPASS_SECRET is not set — cannot pass deployment protection.')
  process.exit(1)
}

const HEADERS = {
  'x-vercel-protection-bypass': BYPASS,
  'content-type': 'application/json',
  'user-agent': 'placemaker-stress-test',
}

async function hit(method, path, body) {
  const t0 = performance.now()
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: HEADERS,
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual', // a 302 means the bypass failed — count it, don't follow
      signal: AbortSignal.timeout(20000),
    })
    const text = await res.text()
    return { status: res.status, ms: performance.now() - t0, len: text.length, body: text }
  } catch (e) {
    return { status: 'ERR:' + (e.name || 'unknown'), ms: performance.now() - t0, len: 0, body: String(e.message || e) }
  }
}

function pct(sorted, p) {
  if (!sorted.length) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

function summarize(label, results, seconds) {
  const statuses = {}
  for (const r of results) statuses[r.status] = (statuses[r.status] || 0) + 1
  const ok = results.filter(r => typeof r.status === 'number' && r.status < 400)
  const lat = ok.map(r => r.ms).sort((a, b) => a - b)
  const row = {
    phase: label,
    requests: results.length,
    rps: seconds ? +(results.length / seconds).toFixed(1) : null,
    statuses,
    p50: Math.round(pct(lat, 50)),
    p90: Math.round(pct(lat, 90)),
    p99: Math.round(pct(lat, 99)),
    max: Math.round(lat[lat.length - 1] || 0),
  }
  console.log(JSON.stringify(row))
  const bad = results.find(r => typeof r.status !== 'number' || (r.status >= 400 && r.status !== 429))
  if (bad) console.log('  sample failure:', bad.status, String(bad.body).slice(0, 200).replace(/\n/g, ' '))
  return row
}

// N workers looping a task until the deadline.
async function loadFor(seconds, concurrency, task) {
  const deadline = performance.now() + seconds * 1000
  const results = []
  await Promise.all(
    Array.from({ length: concurrency }, async (_, vu) => {
      let i = 0
      while (performance.now() < deadline) results.push(await task(vu, i++))
    })
  )
  return results
}

// Fire `total` requests at fixed concurrency (burst mode).
async function burst(total, concurrency, task) {
  const results = []
  let next = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < total) results.push(await task(next++))
    })
  )
  return results
}

const pinBody = i => ({
  mode: 'feedback',
  shapeType: 'pin',
  latitude: 52.3 + (i % 50) * 0.0001,
  longitude: -0.68 + (i % 50) * 0.0001,
  category: ['positive', 'negative', 'question', 'comment'][i % 4],
  comment: `[stress-test] synthetic load submission ${i}`,
  name: '[stress-test]',
  gdprConsent: true,
})

const enquiryBody = i => ({
  submitterName: '[stress-test]',
  submitterEmail: 'stress-test@example.com',
  subject: `[stress-test] enquiry ${i}`,
  message: 'Synthetic load-test enquiry — safe to delete.',
  gdprConsent: true,
})

const formBody = i => ({
  gdprConsent: true,
  data: { q1: `[stress-test] response ${i}`, q2: 'Neutral' },
})

const all = []
const run = async (label, promise, seconds) => all.push(summarize(label, await promise, seconds))

// ---------------------------------------------------------------- phases ---
console.log(`# target: ${BASE}  project: ${PROJECT}  ${new Date().toISOString()}`)

// 0. SMOKE — one of everything; abort if the basics don't work.
{
  const smoke = [
    ['GET /', () => hit('GET', '/')],
    ['GET map data', () => hit('GET', `/api/embed/${PROJECT}`)],
    ['GET embed page', () => hit('GET', `/embed/${PROJECT}`)],
    ['GET form page', () => hit('GET', `/forms/${FORM}`)],
    ['POST pin', () => hit('POST', `/api/embed/${PROJECT}/pins`, pinBody(0))],
    ['POST enquiry', () => hit('POST', `/api/embed/${PROJECT}/enquiries`, enquiryBody(0))],
    ['POST form response', () => hit('POST', `/api/forms/${FORM}/responses`, formBody(0))],
  ]
  let fatal = false
  for (const [name, fn] of smoke) {
    const r = await fn()
    const ok = typeof r.status === 'number' && r.status < 400
    console.log(`SMOKE ${ok ? 'ok ' : 'FAIL'} ${String(r.status).padEnd(3)} ${Math.round(r.ms)}ms  ${name}${ok ? '' : '  → ' + String(r.body).slice(0, 300).replace(/\n/g, ' ')}`)
    if (!ok && name.startsWith('GET')) fatal = true
  }
  if (fatal) {
    console.error('Smoke reads failed — aborting load phases.')
    process.exit(1)
  }
}

// 1. READ RAMP — map data API at increasing concurrency.
for (const c of [5, 15, 30]) {
  await run(`read map-data c=${c} 20s`, loadFor(20, c, () => hit('GET', `/api/embed/${PROJECT}`)), 20)
}

// 2. PAGE RAMP — SSR embed page.
for (const c of [5, 15]) {
  await run(`read embed-page c=${c} 20s`, loadFor(20, c, () => hit('GET', `/embed/${PROJECT}`)), 20)
}

// 3. MIXED — launch-night simulation: browse-heavy with occasional votes.
{
  let pinIds = []
  try {
    const map = await hit('GET', `/api/embed/${PROJECT}`)
    pinIds = (JSON.parse(map.body).pins || []).map(p => p.id).slice(0, 20)
  } catch { /* vote journey skipped if map shape differs */ }
  await run('mixed c=20 45s', loadFor(45, 20, async (vu, i) => {
    const roll = i % 10
    if (roll < 6) return hit('GET', `/api/embed/${PROJECT}`)
    if (roll < 8) return hit('GET', `/embed/${PROJECT}`)
    if (roll === 8) return hit('GET', '/')
    if (pinIds.length) return hit('POST', `/api/embed/${PROJECT}/pins/${pinIds[(vu + i) % pinIds.length]}/vote`, { voteType: 'up' })
    return hit('GET', `/forms/${FORM}`)
  }), 45)
}

// 4. WRITE BURSTS — rate limiter behaviour (limits are per-IP per-instance).
await run('burst pins 40 @c10', burst(40, 10, i => hit('POST', `/api/embed/${PROJECT}/pins`, pinBody(i))))
await run('burst enquiries 10 @c5', burst(10, 5, i => hit('POST', `/api/embed/${PROJECT}/enquiries`, enquiryBody(i))))
await run('burst form 15 @c5', burst(15, 5, i => hit('POST', `/api/forms/${FORM}/responses`, formBody(i))))

// ---------------------------------------------------------------- output ---
const fs = await import('node:fs')
fs.writeFileSync('.stress-results.json', JSON.stringify(all, null, 2))
console.log('# raw results → .stress-results.json')
