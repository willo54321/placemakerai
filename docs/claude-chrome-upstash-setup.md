# Claude in Chrome — add Upstash Redis for global rate limiting

Paste this whole document into Claude in Chrome. Will stays present for logins and
anything billing-related.

Completed 2026-10-02: the integration was installed and injects Vercel's own variable
names (`KV_REST_API_URL` / `KV_REST_API_TOKEN`, Production + Preview). `rate-limit.ts`
reads those since commit 000a713, and global enforcement was load-verified (40-pin
burst → exactly 15 accepted). Kept for reference / re-provisioning.

## Context

Placemaker's rate limiter (`src/lib/rate-limit.ts`) upgrades itself from per-instance
in-memory counting to a global Redis sliding window when Upstash REST credentials exist
(`KV_REST_API_URL`/`KV_REST_API_TOKEN` from the Marketplace integration, or manual
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, which win if both are set). Your
job is to provision that Redis database through the Vercel Marketplace and connect it
to the project. No code changes are involved.

## Hard rules

1. **Free plan only.** If any screen proposes a paid plan, usage-based billing above a
   free allowance, or a credit card, stop and ask Will before continuing.
2. Touch nothing else in the Vercel project — no other env vars, domains, or databases.
3. Never paste tokens, URLs containing credentials, or secrets into the chat transcript.
4. If a screen doesn't match these instructions, stop and ask Will rather than improvising.

## Steps

1. Go to https://vercel.com → team **will neale's projects** → project **placemakerai**
   → **Storage** tab.
2. **Create Database** → choose **Upstash** (Marketplace) → product **Redis**
   (sometimes shown as "Upstash KV"). Accept the marketplace/Upstash account linking if
   prompted (Will confirms).
3. Settings:
   - Plan: **Free**.
   - Region: **London** if offered, otherwise **Ireland (eu-west-1)** — the app's
     functions run in `lhr1`, so pick the closest.
   - Name: `placemaker-ratelimit`.
4. When asked which project to connect: **placemakerai**, environments **Production
   and Preview** (local dev deliberately keeps the in-memory fallback).
5. The connect dialog injects Vercel's standard names (`KV_REST_API_URL`,
   `KV_REST_API_TOKEN`, plus `KV_URL`/`REDIS_URL` variants) — the code accepts these
   directly; no prefix changes needed.
6. Verify: Project → **Settings → Environment Variables** should list
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` on Production and Preview.

## Done — hand back

Tell Will to tell Claude Code "done". Claude Code will redeploy staging and re-run the
pin-burst load test to confirm the limiter enforces globally (expect ~15 accepted +
~25 rejected out of 40). Production picks the change up on its next deploy.
