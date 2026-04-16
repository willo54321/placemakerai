# 360° Panorama Viewer - Implementation Plan

## Overview

Add a new embed type for immersive 360° panorama experiences using **Marzipano** (Google-backed, open source). Supports equirectangular images with interactive hotspots for navigation, info panels, and video content.

**Embed URL:** `/embed/[projectId]/panorama`

---

## Tech Stack for Panorama Feature

| Library | Purpose |
|---------|---------|
| Marzipano | 360° panorama rendering (equirectangular images) |
| GSAP | Panel animations and view transitions |
| Video.js | Video player for video hotspots |

---

## Database Schema

### New Models

```prisma
model Panorama {
  id          String           @id @default(cuid())
  projectId   String
  name        String
  description String?
  imageUrl    String           // Equirectangular image URL
  initialYaw  Float            @default(0)    // Initial view direction (degrees)
  initialPitch Float           @default(0)    // Initial vertical angle (degrees)
  initialFov  Float            @default(100)  // Initial field of view (degrees)
  order       Int              @default(0)    // For multi-scene ordering
  active      Boolean          @default(true)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  project     Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  hotspots    PanoramaHotspot[]

  @@index([projectId])
}

model PanoramaHotspot {
  id          String    @id @default(cuid())
  panoramaId  String
  type        String    // "info" | "link" | "video" | "image"
  yaw         Float     // Horizontal position (degrees, -180 to 180)
  pitch       Float     // Vertical position (degrees, -90 to 90)
  title       String?
  content     String?   // Text content or URL depending on type
  icon        String?   // Icon identifier
  targetId    String?   // For "link" type - target panorama ID
  videoUrl    String?   // For "video" type
  imageUrl    String?   // For "image" type
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  panorama    Panorama  @relation(fields: [panoramaId], references: [id], onDelete: Cascade)

  @@index([panoramaId])
}
```

### Project Model Updates

Add to existing Project model:
```prisma
// Panorama embed settings
panoramaEnabled       Boolean   @default(false)
panoramas             Panorama[]
```

---

## API Routes

### Public Embed API (no auth)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/embed/[id]/panorama` | Get all active panoramas with hotspots |

**Response structure:**
```json
{
  "project": {
    "name": "...",
    "embedPrimaryColor": "#10B981",
    "embedFontFamily": "DM Sans"
  },
  "panoramas": [
    {
      "id": "...",
      "name": "Entrance View",
      "imageUrl": "https://...",
      "initialYaw": 0,
      "initialPitch": 0,
      "initialFov": 100,
      "hotspots": [
        {
          "id": "...",
          "type": "info",
          "yaw": 45.5,
          "pitch": -10.2,
          "title": "Welcome",
          "content": "This is the main entrance..."
        }
      ]
    }
  ]
}
```

### Admin API (auth required)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/projects/[id]/panoramas` | List all panoramas |
| POST | `/api/projects/[id]/panoramas` | Create panorama |
| PATCH | `/api/projects/[id]/panoramas/[panoId]` | Update panorama |
| DELETE | `/api/projects/[id]/panoramas/[panoId]` | Delete panorama |
| POST | `/api/projects/[id]/panoramas/[panoId]/hotspots` | Add hotspot |
| PATCH | `/api/projects/[id]/panoramas/[panoId]/hotspots/[hotspotId]` | Update hotspot |
| DELETE | `/api/projects/[id]/panoramas/[panoId]/hotspots/[hotspotId]` | Delete hotspot |
| POST | `/api/projects/[id]/panoramas/reorder` | Reorder panoramas |

---

## File Structure

```
/src
├── /app
│   ├── /embed/[id]/panorama
│   │   ├── page.tsx              # Public panorama embed page
│   │   ├── PanoramaViewer.tsx    # Marzipano viewer component
│   │   ├── HotspotRenderer.tsx   # Hotspot DOM element positioning
│   │   ├── InfoPanel.tsx         # Info panel overlay (GSAP animated)
│   │   ├── VideoPanel.tsx        # Video.js player panel
│   │   └── SceneNav.tsx          # Multi-scene navigation (thumbnails)
│   │
│   ├── /api/embed/[id]/panorama
│   │   └── route.ts              # Public API for panorama data
│   │
│   └── /api/projects/[id]/panoramas
│       ├── route.ts              # CRUD panoramas
│       ├── [panoId]/route.ts     # Single panorama operations
│       ├── [panoId]/hotspots/route.ts
│       └── reorder/route.ts
│
├── /components
│   └── /panorama
│       └── PanoramaAdmin.tsx     # Admin UI for managing panoramas
│
└── /app/projects/[id]
    └── panoramas.tsx             # Admin dashboard tab (lazy loaded)
```

---

## Implementation Steps

### Phase 1: Database & API Foundation

1. **Update Prisma schema**
   - Add `Panorama` and `PanoramaHotspot` models
   - Add `panoramaEnabled` and relation to Project
   - Run `npm run db:push`

2. **Create admin API routes**
   - `/api/projects/[id]/panoramas` - CRUD operations
   - Follow existing patterns from `/api/projects/[id]/tours`
   - Include permission checks with `requireProjectAccess`

3. **Create public embed API**
   - `/api/embed/[id]/panorama/route.ts`
   - Check `panoramaEnabled` on project
   - Return panoramas with hotspots, project styling
   - Add CORS headers for cross-origin embedding

### Phase 2: Public Panorama Viewer

4. **Install dependencies**
   ```bash
   npm install marzipano gsap video.js
   npm install -D @types/video.js
   ```

5. **Create embed page** (`/embed/[id]/panorama/page.tsx`)
   - Server component that fetches project config
   - Passes data to client components
   - Apply white-label styling (colors, fonts)

6. **Build PanoramaViewer component**
   - Initialize Marzipano with equirectangular geometry
   - Handle scene loading and transitions
   - Expose view control methods
   - Register hotspot containers

7. **Build HotspotRenderer component**
   - Create DOM elements for each hotspot
   - Position using Marzipano's `hotspotContainer`
   - Handle click events to open panels

8. **Build InfoPanel component**
   - Slide-in panel with GSAP animation
   - Display title and rich text content
   - Close button and click-outside handling

9. **Build VideoPanel component**
   - Video.js player in modal overlay
   - Auto-pause when closed
   - Responsive sizing

10. **Build SceneNav component** (if multiple panoramas)
    - Thumbnail strip at bottom
    - Click to switch scenes
    - GSAP transition between views

### Phase 3: Admin UI

11. **Create PanoramaAdmin component**
    - Similar structure to ToursTab
    - List view with panorama cards
    - Upload/URL input for equirectangular images
    - Preview thumbnail

12. **Hotspot editor**
    - Interactive placement on panorama preview
    - Click to add hotspot at current yaw/pitch
    - Form for hotspot type and content
    - Drag to reposition

13. **Add to project dashboard**
    - New "Panoramas" tab in project settings
    - Dynamic import for code splitting
    - Enable/disable toggle in embed settings

### Phase 4: Polish & Integration

14. **Loading states**
    - Progressive image loading
    - Skeleton UI while loading
    - Error handling for missing images

15. **Mobile optimization**
    - Touch controls for panorama navigation
    - Responsive panel sizing
    - Device orientation support (optional)

16. **Embed settings integration**
    - Add panorama embed URL to embed settings tab
    - Copy embed code button
    - Preview link

---

## Marzipano Integration Details

### Viewer Initialization

```typescript
import Marzipano from 'marzipano'

const viewer = new Marzipano.Viewer(container, {
  controls: {
    mouseViewMode: 'drag'
  }
})

const geometry = new Marzipano.EquirectGeometry([{ width: 4096 }])
const limiter = Marzipano.RectilinearView.limit.traditional(
  4096, // max resolution
  100 * Math.PI / 180 // max FOV
)
const view = new Marzipano.RectilinearView({ yaw, pitch, fov }, limiter)

const source = Marzipano.ImageUrlSource.fromString(imageUrl)
const scene = viewer.createScene({ source, geometry, view })
scene.switchTo()
```

### Hotspot Positioning

```typescript
// Create hotspot container
const hotspotContainer = scene.hotspotContainer()

// Add DOM element at yaw/pitch coordinates
const element = document.createElement('div')
element.className = 'hotspot'
hotspotContainer.createHotspot(element, { yaw, pitch })
```

### View Transitions (GSAP)

```typescript
import gsap from 'gsap'

function transitionToView(targetYaw: number, targetPitch: number) {
  const view = scene.view()
  gsap.to(view, {
    duration: 1,
    yaw: targetYaw,
    pitch: targetPitch,
    ease: 'power2.inOut',
    onUpdate: () => view.setYaw(view.yaw)
  })
}
```

---

## Hotspot Types

| Type | Icon | Behavior |
|------|------|----------|
| `info` | ℹ️ | Opens info panel with title/content |
| `link` | → | Transitions to another panorama scene |
| `video` | ▶️ | Opens video player modal |
| `image` | 🖼️ | Opens image lightbox |

---

## White-Label Styling

Reuse existing embed styling patterns:

```typescript
// Apply project colors
const primaryColor = project.embedPrimaryColor || '#10B981'
const fontFamily = project.embedFontFamily || 'DM Sans'

// CSS variables injection (same as existing embeds)
<style>{`
  :root {
    --embed-primary: ${primaryColor};
  }
  .hotspot { background: var(--embed-primary); }
  .panel { font-family: '${fontFamily}', sans-serif; }
`}</style>
```

---

## Files to Create/Modify

### New Files
- `prisma/schema.prisma` (modify - add models)
- `src/app/embed/[id]/panorama/page.tsx`
- `src/app/embed/[id]/panorama/PanoramaViewer.tsx`
- `src/app/embed/[id]/panorama/HotspotRenderer.tsx`
- `src/app/embed/[id]/panorama/InfoPanel.tsx`
- `src/app/embed/[id]/panorama/VideoPanel.tsx`
- `src/app/embed/[id]/panorama/SceneNav.tsx`
- `src/app/api/embed/[id]/panorama/route.ts`
- `src/app/api/projects/[id]/panoramas/route.ts`
- `src/app/api/projects/[id]/panoramas/[panoId]/route.ts`
- `src/app/api/projects/[id]/panoramas/[panoId]/hotspots/route.ts`
- `src/app/api/projects/[id]/panoramas/[panoId]/hotspots/[hotspotId]/route.ts`
- `src/app/api/projects/[id]/panoramas/reorder/route.ts`
- `src/app/projects/[id]/panoramas.tsx`

### Modified Files
- `prisma/schema.prisma` - Add Panorama, PanoramaHotspot models
- `src/app/projects/[id]/map.tsx` - Add panorama embed URL to settings
- `package.json` - Add marzipano, gsap, video.js dependencies

---

## Estimated Scope

- **Database:** 2 new models, 1 field on Project
- **API Routes:** 8 new routes (2 public, 6 admin)
- **Components:** ~10 new components
- **Admin UI:** 1 new tab with panorama/hotspot management
