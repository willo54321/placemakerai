# Enquiries Management System — design sketch

Status: design. Nothing here is built yet beyond the existing public capture
form and the `Enquiry` model. This is the plan to turn one-way enquiry capture
into a tracked, two-way enquiry desk.

## Why this, why now

Every competitor (Go Vocal, Commonplace, Zencity — see
`memory/competitor-email-mechanisms.md`) sends **outbound-only** email from
**their** domain, and resident replies either dead-end or leak to the vendor's
support desk. **None** offers: send from the client's own address + thread the
reply back + track it in a per-project desk. That combination is the open gap,
and it extends the embed-first pitch to email: *your website, your brand, your
email address — one database, one AI analysis underneath.*

Resend is now verified on placemakerai.io, so the outbound half is unblocked.

## What exists today

- `Enquiry` model: submitterName/Email/Phone/Org, subject, message, category,
  gdprConsent(+date), projectId, timestamps.
- Public capture: `/embed/{projectId}/enquiry` form + rate-limited, GDPR-gated
  `POST /api/embed/[id]/enquiries` with CORS.
- Enquiries are **excluded** from the AI analysis corpus (`collectFeedback`
  has them commented out) — a bug to fix regardless of this system.
- No inbox, no status, no reply, no threading.

## Domain model (additions)

```
Enquiry (extend)
  + status        EnquiryStatus @default(NEW)   // NEW | OPEN | WAITING | RESOLVED | CLOSED
  + assignedToId  String?                        // a project user
  + readAt        DateTime?                       // unread badge
  + threadToken   String @unique                  // routes inbound replies back
  + lastMessageAt DateTime                         // sort key for the inbox
  (existing submitter fields become the Creator-equivalent "correspondent")

EnquiryMessage (new — the thread)
  id, enquiryId
  direction   INBOUND | OUTBOUND
  body        String
  sender      String            // correspondent email (in) or sending user (out)
  channel     FORM | EMAIL      // how it arrived
  // outbound delivery tracking (mirror Go Vocal's Mailgun ladder via Resend)
  providerId  String?           // Resend message id
  deliveryStatus SENT|DELIVERED|BOUNCED|COMPLAINED|FAILED?
  error       String?
  attachments Json?             // {name,url,contentType}[]
  createdAt

ProjectEmailSettings (new — per-project sender identity)
  projectId (unique)
  fromName        String?        // "Ford Airfield Consultation"
  replyToEmail    String?        // where the first reply's Reply-To points (Phase 1)
  customDomain    String?        // client's verified domain (Phase 3)
  domainStatus    UNSET|PENDING|VERIFIED
  resendDomainId  String?        // Resend domain object for verification polling
  ingestAddress   String         // enquiry+{projectToken}@in.placemakerai.io (Phase 2)

EmailSuppression (new — deliverability hygiene)
  email (unique), reason BOUNCE|COMPLAINT|MANUAL, createdAt
```

The `Correspondent` (resident) is just the submitter fields on the enquiry —
no account, mirroring Capture's "creator never onboards" and Placemaker's
"embed-first" principles. One enquiry = one thread with one correspondent.

## Ingestion — three ways in, one desk

1. **Embed form** (exists): `POST /api/embed/[id]/enquiries` creates the
   `Enquiry` + the first INBOUND `EnquiryMessage(channel=FORM)`.
2. **Inbound email** (Phase 2): the client forwards their public address
   (`enquiries@client.co.uk`) to the project's `ingestAddress`
   (`enquiry+{token}@in.placemakerai.io`). MX on `in.placemakerai.io` → Resend
   inbound → `POST /api/webhooks/email-inbound`. Parser: verify signature,
   resolve `token` → project (new enquiry) or `threadToken` (reply appends to
   the thread), strip quoted history ("On … wrote:"), store attachments,
   set status NEW/OPEN.
3. **Reply capture** (Phase 2): every OUTBOUND email sets
   `Reply-To: enquiry+{threadToken}@in.placemakerai.io`, so the resident's
   reply lands back on the same thread automatically.

## Outbound — replying as the client

- **Send** via Resend from `ProjectEmailSettings`:
  - Phase 1: `From: {fromName} <enquiries@placemakerai.io>`,
    `Reply-To: {client team address}`. Honest "via Placemaker", zero DNS.
  - Phase 3: `From: {fromName} <enquiries@client.co.uk>` once the client's
    domain is VERIFIED (SPF/DKIM). This is the differentiator no competitor
    ships as self-serve.
- Store each send as an OUTBOUND `EnquiryMessage`; flip status → WAITING;
  audit-log `enquiry.reply`.
- **Delivery tracking**: Resend webhook (`/api/webhooks/resend`) updates
  `deliveryStatus` per message (delivered/bounced/complained), the same
  forward-only ladder Go Vocal runs on Mailgun. Bounces/complaints add to
  `EmailSuppression`; a suppressed address blocks further sends with a clear
  UI reason.

## The desk (UI) — `/projects/[id]` new "Enquiries" tab

- **List**: rows sorted by `lastMessageAt`, unread in bold, status chip,
  assignee avatar, channel icon (form/email), snippet. Filters: status,
  assignee, unread, channel, search. Counts in the tab label.
- **Thread view**: correspondent header (name/email/org, mailto), the message
  timeline (inbound left / outbound right, delivery ticks on outbound), and a
  **reply composer** (send-as identity shown, attach files, canned "thank you /
  we've logged your enquiry" snippets). Status control + assign control.
- **Empty/'5 or more' style gates** and honest disclaimers reused from the
  product's existing patterns.
- Surfaces on the **project card** (pending/unanswered enquiry count) and the
  **health card** (enquiries unanswered > N days).

## Statuses & workflow

`NEW` (just arrived, unread) → `OPEN` (being handled) → `WAITING` (we replied,
awaiting them) → `RESOLVED` (done) → `CLOSED` (archived). Inbound reply on a
WAITING/RESOLVED thread reopens it to OPEN. All transitions audit-logged.

## AI analysis integration

Fix `collectFeedback` to include enquiries (subject + message) so they flow
into the same classify-every-response pipeline as pins and forms — enquiries
become another counted channel in sentiment/themes/material analysis and the
cross-reference engine. (Do this immediately; it's independent of the desk.)

## Deliverability & compliance

- **DMARC alignment** is non-negotiable for Phase 3 — no verified client
  domain, no sending as them; fall back to placemaker From + client Reply-To.
- **Suppression list** from bounce/complaint webhooks, honoured on every send.
- **GDPR**: enquiry data already consent-gated; erasure (`/admin/gdpr`) must
  cascade to `EnquiryMessage`; export includes threads. Retention policy per
  project (auto-close/delete after the consultation ends).
- **Spam/loops** on inbound: drop auto-replies (`Auto-Submitted`, `no-reply`
  senders), rate-limit, basic spam scoring.

## Phasing (build order)

- **Phase 0 (now, ~½ day):** put enquiries into the analysis corpus; add
  status + read + `EnquiryMessage` model + a read-only thread view in a new
  Enquiries tab. Immediate value, no email sending.
- **Phase 1 (~1–2 days):** outbound replies via Resend from
  `@placemakerai.io` with client Reply-To; delivery tracking + suppression;
  the reply composer. Needs only the existing Resend key.
- **Phase 2 (~2 days):** inbound subdomain + webhook threading — the desk
  becomes truly two-way; forwarding-rule ingest for email enquiries.
- **Phase 3 (~1–2 days):** self-serve client-domain verification (copy
  Zencity's TXT-record + Verify UX via Resend's domains API) so mail sends as
  the client's own address.

## Open decisions (need Will)

1. **Reply-To in Phase 1** — a single project team address, or the replying
   user's own address? (Team address is cleaner for handover.)
2. **Ingest subdomain** — confirm `in.placemakerai.io` for MX (keeps the apex
   clean).
3. **Auto-status from consultation dates?** — or fully manual, like the new
   project lifecycle status.
4. **Assignment** — needed at launch, or single-team inbox first?
5. **Retention** — auto-close resolved enquiries after N days?
```
