---
name: verify
description: Build, run and drive this app locally to verify a change end-to-end.
---

# Verifying changes in placemakerai

## Launch

```bash
export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"   # npm is NOT on the default background-shell PATH
npm run db:dev        # embedded Postgres on :54322 (background; keep running)
npm run db:seed       # super-admin: dev@placemaker.local / devpassword
npm run dev           # Next.js on http://localhost:3002 (background)
```

Local `.env` has no `RESEND_API_KEY`, no `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and no
`BLOB_READ_WRITE_TOKEN`: email sends are skipped silently, the map shows a
"can't load Google Maps" dialog (UI chrome still renders fine for screenshots),
and image uploads fall back to base64 data URLs.

## Seed data

Write a `.mjs` script importing `@prisma/client` and place it INSIDE the repo
before running (`node script.mjs`) — ESM resolves packages from the script's
own path, so a script in the session scratchpad can't find `@prisma/client`.
Delete it afterwards.

## Auth from curl

```bash
CSRF=$(curl -s -c jar http://localhost:3002/api/auth/csrf | jq -r .csrfToken)
curl -s -b jar -c jar -X POST http://localhost:3002/api/auth/callback/credentials \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "email=dev@placemaker.local" \
  --data-urlencode "password=devpassword" --data-urlencode "json=true"
# then -b jar on any /api/projects/... call
```

## Browser screenshots

Playwright isn't a repo dependency: `npm i playwright` in the scratchpad and run
the script from there with `chromium.launch({ channel: 'chrome' })` (system
Chrome, no browser download). Login page is `/login` (email + password inputs,
submit button). On first dashboard visit a **product tour dialog intercepts all
clicks** — dismiss with `page.locator('[aria-label="Close tour"]').click()`.
Dashboard tabs have ids like `#issues-tab`, `#website-tab`, `#overview-tab`.
