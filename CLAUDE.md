# CLAUDE.md - Placemaker.ai Project Guide

## Overview

Placemaker.ai is a stakeholder engagement and public consultation platform for planning projects. It enables organizations to collect feedback via interactive maps, manage stakeholders, track construction issues, and analyze public sentiment using AI.

**Domain:** placemaker.io

## Tech Stack

- **Framework:** Next.js 14.1 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js (JWT strategy)
- **UI:** Tailwind CSS, Lucide icons
- **Maps:** Leaflet, react-leaflet, Turf.js
- **Data Fetching:** TanStack React Query
- **Email:** Resend
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
│   ├── /embed/[id]       # Public embed pages
│   └── /forms/[id]       # Public form pages
├── /components           # React components
│   └── InteractiveMap.tsx  # Main map component
├── /lib
│   ├── auth.ts           # NextAuth config
│   ├── db.ts             # Prisma client
│   ├── permissions.ts    # Role-based access
│   ├── email.ts          # Email utilities
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
| PublicPin | Map feedback/issues (pins, lines, polygons) |
| FeedbackForm | Custom forms with JSON field config |
| FeedbackResponse | Form submissions (data as JSON) |
| Enquiry | Stakeholder enquiries with message threads |
| Stakeholder | Key stakeholders with influence/interest |
| Subscriber | Mailing list per project |
| Tour/TourStop | Guided map tours |
| GeoLayer | GeoJSON boundaries |
| ImageOverlay | Custom map image overlays |

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

## Key Features

### 1. Feedback Collection
- Interactive map pins (positive, negative, question, comment)
- Custom feedback forms with drag-drop builder
- External form submissions: `POST /api/projects/{id}/feedback`
- GDPR consent tracking on all submissions

### 2. Issue Reporting
- Construction issue tracking (mode: 'issues')
- Categories: noise, dust, traffic, damage, safety, hours, other
- Resolution workflow with notes
- Email notifications to configured addresses

### 3. AI Analysis
- Sentiment analysis of feedback
- Theme extraction
- Summary generation
- Uses OpenAI GPT-4o-mini
- Results cached in AnalysisResult table

### 4. Embed System
- Public map embed: `/embed/{projectId}`
- Issues mode: `/embed/{projectId}?mode=issues`
- Enquiry form: `/embed/{projectId}/enquiry`
- Customizable: colors, fonts, street label visibility

### 5. Tours
- Guided map tours with stops
- Show/hide overlays at stops
- Highlight areas with polygons

## Environment Variables

```bash
DATABASE_URL=          # PostgreSQL connection
NEXTAUTH_SECRET=       # JWT signing secret
NEXTAUTH_URL=          # Base URL (e.g., https://placemaker.io)
RESEND_API_KEY=        # Email delivery
OPENAI_API_KEY=        # AI analysis
EMAIL_WEBHOOK_SECRET=  # Cloudflare email worker auth
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
POST https://placemaker.io/api/projects/{projectId}/feedback
Body: { name, email, ...fields, gdprConsent: true }
```
Requires `embedEnabled: true` on the project.

## Important Conventions

- All public submissions require `gdprConsent: true`
- Pin comments limited to 2000 characters
- Geographic clustering uses 3 decimal places (~100m precision)
- Dynamic imports for heavy components (FeedbackTab, EmbedSettingsTab)
- Email templates support placeholders: {{name}}, {{subject}}, {{project}}

## Testing

- Mock auth context available for dev testing
- Test map page at `/test-map`
- Use Prisma Studio for database inspection
