# CLAUDE.md - Placemaker.ai Project Guide

## Overview

Placemaker.ai is a public consultation platform for planning projects. It focuses on three core products: collecting feedback via interactive maps, custom feedback forms, and AI-powered analysis of all collected feedback (including public enquiries).

**Domain:** placemakerai.io

**Scope note (2026-08-28):** The product was deliberately descoped to the three core features above. Stakeholder CRM, guided tours, construction issues mode, email campaigns, mailing lists/subscribers, panoramas, and the enquiry inbox/messaging workflow were all removed (recoverable from git history if ever needed). Public enquiry *submission* remains as a data-collection channel feeding AI analysis — there is no inbox UI or reply workflow.

## Tech Stack

- **Framework:** Next.js 14.1 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js (JWT strategy)
- **UI:** Tailwind CSS, Lucide icons
- **Maps:** Leaflet, react-leaflet, Turf.js
- **Data Fetching:** TanStack React Query
- **Email:** Resend (account emails only: invite / password reset)
- **AI:** OpenAI (GPT-4o-mini)

## Quick Commands

```bash
npm run dev          # Start dev server (port 3002)
npm run build        # Build for production
npm run db:push      # Push Prisma schema to database
npm run db:studio    # Open Prisma Studio
```

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
│   └── openai.ts         # AI analysis
└── /hooks
    └── usePermissions.ts
```

## Key Database Models

| Model | Purpose |
|-------|---------|
| User | System users (systemRole: SUPER_ADMIN, USER) |
| Project | Main entity - consultation projects |
| ProjectAccess | User-project role (ADMIN, CLIENT) |
| PublicPin | Map feedback (pins, lines, polygons) |
| FeedbackForm | Custom forms with JSON field config |
| FeedbackResponse | Form submissions (data as JSON) |
| Enquiry | Public enquiry submissions (analyzed by AI; no reply workflow) |
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

### 2. Custom Feedback Forms
- Drag-drop form builder with JSON field config
- Public form pages: `/forms/{formId}`
- External form submissions: `POST /api/projects/{id}/feedback` (auto-detects fields)
- GDPR consent required on all submissions

### 3. AI Analysis
- Sentiment analysis, theme extraction, and summary generation over map pins, form responses, and enquiries
- Uses OpenAI GPT-4o-mini
- Results cached in AnalysisResult table

## Environment Variables

```bash
DATABASE_URL=          # PostgreSQL connection
NEXTAUTH_SECRET=       # JWT signing secret
NEXTAUTH_URL=          # Base URL (e.g., https://placemakerai.io)
RESEND_API_KEY=        # Email delivery (invite/reset emails)
OPENAI_API_KEY=        # AI analysis
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

## Testing

- Mock auth context available for dev testing
- Test map page at `/test-map`
- Use Prisma Studio for database inspection
