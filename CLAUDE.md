# CLAUDE.md - Placemaker.ai Project Guide

## Overview

Placemaker.ai is a public consultation platform for planning projects. It focuses on three core products: collecting feedback via interactive maps, custom feedback forms, and AI-powered analysis of all collected feedback (including public enquiries).

**Domain:** placemakerai.io

**Key differentiator — embed-first, no design system lock-in:** Placemaker works *with* an
organisation's existing consultation website rather than replacing it. The map, forms and enquiry
capture are embeds (`/embed/{projectId}`, `/forms/{formId}`) that drop into the client's own site
and inherit their branding via per-project styling (`embedPrimaryColor`, `embedFontFamily`,
`embedHideStreetLabels`, etc.). Competitors (Commonplace, Go Vocal/CitizenLab) are *destination*
platforms: the whole consultation site is hosted on their domain, so every project is forced into
their page templates and design system. Placemaker deliberately does not do this — the client's
site stays the client's site, on their domain, in their brand.

See `MARKETING.md` for the competitor teardown (Go Vocal, Commonplace), positioning, messaging and
the marketing-site build plan.

**Scope note (2026-08-28):** The product was deliberately descoped to the three core features above. Guided tours, construction issues mode, email campaigns, mailing lists/subscribers and panoramas were removed (recoverable from git history if ever needed).

**Re-added since (2026-09):** a lean **Stakeholder tracker/CRM** (register + power/interest matrix + engagement log; `/projects/[id]` Stakeholders tab, `api/projects/[id]/stakeholders/**`) and an **Enquiry inbox with outbound replies** (thread view + reply-by-email via Resend, `api/projects/[id]/enquiries/[enquiryId]/messages`). Public enquiry *submission* still also feeds AI analysis. Client-domain sending remains unbuilt. Both features are marketed on the homepage (`Services.tsx` items 05/06 with `StakeholderCrmDemo`/`EnquiryInboxDemo`).

**Inbound email threading (2026-09-09):** replies to platform emails land in the enquiries inbox
via Resend receiving — `POST /api/inbound/resend` handles the `email.received` webhook (svix
signature verified in `src/lib/webhook-verify.ts`, full message fetched via
`resend.emails.receiving.get`). Outbound Reply-To uses tagged project addresses
(`<localPart>+e-<threadToken>@` threads into an enquiry, `+c-<campaignId>@` marks a campaign
reply; bare `<localPart>@` creates a new enquiry) — only when `RESEND_WEBHOOK_SECRET` is set,
otherwise Reply-To stays the sending admin. Email-origin enquiries get `channel: 'email'`;
webhook retries dedup on `externalId`; auto-replies are skipped; project admins get a
notification email. Requires MX on placemakerai.io pointing at Resend (DNS is on Vercel).

**Re-added 2026-09-10 — Guided tours** (explicit user decision; redesigned rather than restored
from the pre-descope version): admins author map tours — ordered stops, each with a title, story
text, optional image (Vercel Blob upload) / YouTube-or-Vimeo video, a camera position captured
WYSIWYG from the live editor map, an optional spotlight polygon (map dims outside it), and
per-stop image-overlay visibility. Authored in the **Guided Tours** dashboard tab (`Publish`
group, admin-only, map-first editor at `src/app/projects/[id]/tours.tsx`) with an in-editor
preview that reuses the real public player. Public playback lives on the map embed ("Take the
tour" button) and a dedicated iframe route `/embed/{projectId}/tour[?tour={tourId}]`; the player
(`src/app/embed/[id]/TourPlayer.tsx`) is a left-docked panel (bottom sheet on mobile) with a
cinematic fly-to between stops (driven via EmbedMap's `tourCamera` prop — deliberately not the
`center` prop, which react-google-maps snaps instantly). **Per-stop responses are PublicPins**
(`PublicPin.tourStopId`, SetNull on stop deletion) so they inherit moderation, appear on the
feedback map, and feed AI analysis with no extra pipeline; approved ones render under each stop.
Only `active: true` tours appear publicly (`/api/embed/{id}` returns `tours`).

**Re-added 2026-09-18 — Construction issues** (explicit user decision; rebuilt from the
pre-descope design with additions): residents report construction issues (noise, dust,
traffic/access, property damage, safety, working hours, other) on a dedicated map embed at
`/embed/{projectId}/issues` — pin or area, **name + email required** (unlike feedback pins),
**optional photo evidence** (public upload endpoint `/api/embed/{id}/issue-photo` → Vercel Blob
under `issues/{projectId}/`, base64 data-URL fallback locally; submitted `photoUrl` is validated
against that prefix so external URLs are rejected). Issue reports are `PublicPin`s with
`mode: 'issues'` (+ `photoUrl`, `resolved`, `resolvedAt`, `resolvedNotes`) so they feed AI
analysis automatically, but they are kept out of every feedback surface (feedback tab, counts,
default embed GET filter on `mode`). Admin **Construction Issues** tab (`Collect` group,
`src/app/projects/[id]/issues.tsx`): publish/unpublish, resolve-with-notes/reopen, delete,
category stats, open/resolved filters. Public map shows approved reports — resolved ones stay
visible (green check pin + "What was done" notes; visitor-toggleable) as a you-said-we-did log;
"I'm affected too" voting. Enabled per project via `issuesEnabled` (Website settings) with
`issueNotifyEmails` (comma-separated, parsed by `src/lib/issues.ts`) notifying e.g. the site
manager on each new report from the platform address. Mailing-consent opt-in feeds the
subscriber list (`source: 'issue_report'`).

**Re-added 2026-09-09 — Mailing list + campaigns** (explicit user decision to rebuild the descoped
feature): consented subscriber capture (`mailingConsent` on enquiry/external-feedback submissions,
public `POST /api/embed/{id}/subscribe`, manual add), a Mailing List tab (subscribers register +
CSV export + compose-and-send campaigns), campaign sending via Resend from the platform domain
(batches of 100, `{{name}}`/`{{project}}` personalisation, per-recipient unsubscribe token with
List-Unsubscribe/RFC 8058 one-click headers, confirm-page at `/unsubscribe`). Sent campaigns are
immutable send records; drafts are editable. Client-domain sending is still future work.

**Per-project sending addresses (2026-09-09):** each project sends campaigns and enquiry replies
from its own address on the platform domain — `Project.emailLocalPart` (unique, derived from the
project name at creation, editable in Settings) builds
`"<Project Name> <localpart@EMAIL_FROM-domain>"` via `getFromAddress(project)` in `src/lib/email.ts`
(helpers in `src/lib/email-identity.ts`). Falls back to the plain `EMAIL_FROM` platform address when
unset. Account emails (invite/reset) always use the platform address.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19
- **Language:** TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js (JWT strategy)
- **UI:** Tailwind CSS, Lucide icons
- **Maps:** Google Maps (`@react-google-maps/api`); Turf.js for server-side geometry.
- **Data Fetching:** TanStack React Query
- **Email:** Resend (account emails only: invite / password reset)
- **AI:** Anthropic Claude (claude-opus-4-8 via @anthropic-ai/sdk)

## Quick Commands

```bash
npm run dev          # Start dev server (port 3002)
npm run db:dev       # Start the LOCAL dev Postgres (embedded, port 54322, data in .devdb/)
npm run db:seed      # Seed local super-admin: dev@placemaker.local / devpassword
npm run build        # Build for production
npm run db:push      # Push Prisma schema to the LOCAL dev database (.env)
npm run db:push:prod # Push schema to PRODUCTION (reads .env.prod) — user runs this, not Claude
npm run db:backup:prod # pg_dump snapshot of prod into backups/ — run before every db:push:prod
npm run db:studio    # Open Prisma Studio
npm test             # Vitest unit tests
```

**Environments (2026-09-10):** local dev uses an embedded Postgres (`npm run db:dev`;
`DATABASE_URL` in `.env`/`.env.local` points at localhost:54322). The production database
URL lives only in the gitignored `.env.prod`, used by `db:push:prod`. On Vercel,
`DATABASE_URL` is scoped to Production only — preview/development deploys have no
database access. CI (`.github/workflows/ci.yml`) runs lint, vitest, build and a
non-blocking `npm audit` on every push/PR.

## Project Structure

```
/src
├── /app
│   ├── /api              # API routes
│   │   ├── /projects     # Project CRUD + sub-resources
│   │   ├── /embed        # Public embed APIs (no auth)
│   │   ├── /forms        # Public form submission
│   │   └── /admin        # Super-admin endpoints
│   ├── /projects/[id]    # Project dashboard (tabs)
│   ├── /embed/[id]       # Public embed pages (map + enquiry form)
│   └── /forms/[id]       # Public form pages
├── /components           # React components
│   └── InteractiveMap.tsx  # Main map component
├── /lib
│   ├── auth.ts           # NextAuth config
│   ├── db.ts             # Prisma client
│   ├── permissions.ts    # Role-based access
│   ├── email.ts          # Account emails (invite/reset)
│   └── ai.ts             # AI analysis (Anthropic Claude)
└── /hooks
    └── usePermissions.ts
```

## Key Database Models

| Model | Purpose |
|-------|---------|
| User | System users (systemRole: SUPER_ADMIN, USER) |
| Project | Main entity - consultation projects |
| ProjectAccess | User-project role (ADMIN, CLIENT) |
| PublicPin | Map feedback (pins, lines, polygons); `mode: 'issues'` rows are construction-issue reports with photo + resolution workflow |
| FeedbackForm | Custom forms with JSON field config |
| FeedbackResponse | Form submissions (data as JSON) |
| Enquiry | Public enquiry submissions (analyzed by AI; thread + outbound replies) |
| Tour | Guided map tour (draft/active) per project |
| TourStop | Ordered tour stop: story text, media, camera (lat/lng/zoom), spotlight polygon, overlay visibility |
| Subscriber | Mailing-list contact per project (consent record + unsubscribe token) |
| Campaign | Mailing-list email (draft → immutable sent record) |
| GeoLayer | GeoJSON boundaries |
| ImageOverlay | Custom map image overlays |
| MapMarker | Admin-authored map markers |
| AnalysisResult | Cached AI analysis per project |

## Authentication & Permissions

**System Roles:** SUPER_ADMIN (full access), USER (project-based access)

**Project Roles:** ADMIN (full), CLIENT (read-only)

**Key Functions (lib/permissions.ts):**
- `requireAuth()` - Throw if not authenticated
- `requireProjectAccess(projectId, role)` - Check project permission
- `hasProjectPermission(projectId, permission)` - Boolean check

**Public Routes (no auth):** /embed/*, /api/embed/*, /forms/*, /api/forms/*

## API Patterns

```typescript
// Standard API route structure
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await requireAuth()
  await requireProjectAccess(params.id, 'ADMIN')

  const data = await prisma.model.findMany({ where: { projectId: params.id } })
  return NextResponse.json(data)
}
```

**Public embed APIs include CORS headers for cross-origin access.**

## Core Features

### 1. Interactive Map Feedback
- Public map embed: `/embed/{projectId}` (customizable colors, fonts, street labels)
- Visitors drop pins (positive, negative, question, comment) or draw lines/polygons
- Pin voting; admin approval workflow before pins appear publicly
- GeoJSON boundary layers and image overlays on the map
- Enquiry form embed: `/embed/{projectId}/enquiry` (submissions stored for AI analysis)
- Guided tours: authored per project (Guided Tours tab), played on the map embed or the
  dedicated `/embed/{projectId}/tour` iframe; per-stop responses are moderated PublicPins
- Construction issue reporting: dedicated embed `/embed/{projectId}/issues` (name/email
  required, optional photo); triaged and resolved-with-notes in the Construction Issues tab

### 2. Custom Feedback Forms
- Drag-drop form builder with JSON field config
- Public form pages: `/forms/{formId}`
- External form submissions: `POST /api/projects/{id}/feedback` (auto-detects fields)
- GDPR consent required on all submissions

### 3. AI Analysis
- Sentiment analysis, theme extraction, and summary generation over map pins, form responses, and enquiries
- Uses Anthropic Claude (claude-opus-4-8) with structured outputs — see `src/lib/ai.ts`
- Results cached in AnalysisResult table

## Environment Variables

```bash
DATABASE_URL=          # PostgreSQL connection
NEXTAUTH_SECRET=       # JWT signing secret
NEXTAUTH_URL=          # Base URL (e.g., https://placemakerai.io)
RESEND_API_KEY=        # Email delivery (invite/reset emails)
RESEND_WEBHOOK_SECRET= # Svix signing secret for the inbound email.received webhook (enables inbound threading)
ANTHROPIC_API_KEY=     # AI analysis (Claude)
UPSTASH_REDIS_REST_URL=   # Optional: global rate limiting (Vercel Upstash integration)
UPSTASH_REDIS_REST_TOKEN= # Optional: without these, rate limiting falls back to per-instance memory
```

## Common Tasks

### Add a new API endpoint
1. Create route file in `/src/app/api/...`
2. Use `requireAuth()` / `requireProjectAccess()` for protected routes
3. Return `NextResponse.json(data)`

### Add a new database model
1. Update `/prisma/schema.prisma`
2. Run `npm run db:push`
3. Import from `@/lib/db`

### External form integration
Projects can receive form submissions from external websites:
```
POST https://placemakerai.io/api/projects/{projectId}/feedback
Body: { name, email, ...fields, gdprConsent: true }
```
Requires `embedEnabled: true` on the project.

## Important Conventions

- All public submissions require `gdprConsent: true`
- Pin comments limited to 2000 characters
- Geographic clustering uses 3 decimal places (~100m precision)
- Dynamic imports for heavy components (FeedbackTab, EmbedSettingsTab)
- **No filler subtitle/annotation text.** Never add descriptive sub-headings that
  restate what a section/component shows or add marketing gloss (e.g. "The same
  feedback, sliced by zone — see where support and objection concentrate", "Where
  to focus engagement — each stakeholder plotted by…"). Let the heading and the
  data speak for themselves. Only add helper text when it conveys genuinely
  necessary, non-obvious information (e.g. a units caveat or a required action).
- **Embed-first:** the client's own website is the CMS. Do not build a page builder, homepage
  builder, or general content management surface — content that needs to be authored in Placemaker
  belongs in structured, themeable fields on the project, not a freeform canvas.

## Testing

- Mock auth context available for dev testing
- Test map page at `/test-map`
- Use Prisma Studio for database inspection

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
