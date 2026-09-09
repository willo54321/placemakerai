# Inbound email activation — browser setup guide

Instructions for completing the Resend + Vercel dashboard steps that switch on
inbound email threading for Placemaker.ai. Written to be handed to an agent
driving the browser; every value needed is included.

## Context

- Product: Placemaker.ai, live at `https://platform.placemakerai.io`
- The codebase already contains the webhook endpoint (`/api/inbound/resend`)
  and reply routing. It activates only when the `RESEND_WEBHOOK_SECRET`
  environment variable exists — until then nothing changes in production.
- Resend already sends for the verified domain `placemakerai.io`.
- DNS for `placemakerai.io` is hosted on Vercel nameservers
  (`ns1.vercel-dns.com` / `ns2.vercel-dns.com`), managed from the Vercel
  team `will-neales-projects`. The Vercel project is `placemakerai`.
- The domain currently has **no MX records** — adding one for Resend conflicts
  with nothing.

## Prerequisites (done outside the browser, not part of this guide)

- `npm run db:push` has been run from the repo (adds the inbound columns).
- The inbound-email code has been committed and deployed to Vercel.

## Step 1 — Enable receiving in Resend

1. Go to `https://resend.com` and open the dashboard (log in if needed).
2. Navigate to **Domains** → `placemakerai.io`.
3. Find the **Receiving** section (may be labelled "Receiving" or "Inbound";
   docs: `https://resend.com/docs/dashboard/receiving/introduction`) and
   enable it for this domain.
4. Resend displays an **MX record** to add. Copy its exact **name/host**,
   **priority**, and **value** — do not guess or substitute values from
   documentation.

## Step 2 — Add the MX record in Vercel DNS

1. Go to `https://vercel.com`, team **will-neales-projects**.
2. Open the team-level **Domains** section → `placemakerai.io` → **DNS
   Records** (this is domain DNS, not project settings).
3. Add a new record: type **MX**, name/host exactly as Resend specified
   (blank or `@` for the apex), and the priority + value from Step 1.
4. **Do not modify or delete any existing records** — the A/CNAME records
   serve the sites and the TXT/CNAME records are Resend's sending
   authentication (SPF/DKIM). Only add the one MX record.
5. Return to the Resend domain page and confirm the receiving record shows
   as verified (propagation is usually minutes; if it stays pending, move on
   and re-check at the end).

## Step 3 — Create the webhook in Resend

1. In the Resend dashboard, go to **Webhooks** → **Add webhook/endpoint**.
2. Endpoint URL, exactly:
   `https://platform.placemakerai.io/api/inbound/resend`
3. Subscribe to **only** the `email.received` event.
4. Save, then open the endpoint's settings and copy the **signing secret**
   (starts `whsec_`). Keep it only long enough to paste into Vercel in the
   next step — don't record it anywhere else.

## Step 4 — Set the secret in Vercel

1. In Vercel, open the **placemakerai** project → **Settings** →
   **Environment Variables**.
2. Add: key `RESEND_WEBHOOK_SECRET`, value = the `whsec_…` secret from
   Step 3. Environment: **Production** only. Mark it **Sensitive** if the
   option is offered.
3. Redeploy so the variable takes effect: **Deployments** → latest
   production deployment → **⋯** → **Redeploy**.

## Step 5 — Verify end to end

1. Send an email from any personal account to
   `magnaparkcorby@placemakerai.io` (or any project's sending address shown
   in that project's Settings tab).
2. Within a minute or two, a new enquiry with an **Email** badge should
   appear in that project's **Enquiries** tab on
   `https://platform.placemakerai.io`, and project admins should receive a
   notification email.
3. If nothing arrives: check Resend **Webhooks** → the endpoint's delivery
   log (2xx = platform accepted it; 401 = wrong secret; 503 = env var not
   live yet — redeploy). Resend retries failed deliveries automatically.

## Cautions

- Never reveal, rotate, or delete the existing `RESEND_API_KEY` or any other
  environment variable.
- Add exactly one DNS record; change nothing else.
- If a UI doesn't match these steps (dashboards change), stop and describe
  what's on screen rather than improvising a different change.
