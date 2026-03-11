# Plan: Improved Sidebar Menu Structure

## Current Problem

The sidebar currently has **9 flat menu items** with no grouping:
1. Overview
2. Stakeholders
3. Feedback
4. Tours
5. Embed
6. AI Analytics
7. Inbox
8. Mailing List
9. Settings

**Issues:**
- No logical grouping - related items are scattered
- Feedback and AI Analytics are related but separated
- Inbox and Mailing List are both communication but separated
- Embed and Tours are both public-facing content but separated
- Hard to find things quickly

---

## Proposed Solution: Grouped Menu with Section Headers

Reorganize into **4 logical groups** with section headers:

```
┌─────────────────────────┐
│ Project Name            │
│ Description...          │
├─────────────────────────┤
│                         │
│ Overview          ●     │
│                         │
│ ─── COLLECT ──────────  │
│ Feedback           12   │
│ AI Analytics            │
│                         │
│ ─── ENGAGE ───────────  │
│ Stakeholders       8    │
│ Inbox              3    │
│ Mailing List      156   │
│                         │
│ ─── PUBLISH ──────────  │
│ Embed                   │
│ Tours              2    │
│                         │
│ ─── CONFIGURE ────────  │
│ Settings                │
│                         │
└─────────────────────────┘
```

### Group Definitions

| Group | Purpose | Items |
|-------|---------|-------|
| (Top level) | At-a-glance status | Overview |
| **COLLECT** | Gathering feedback & insights | Feedback, AI Analytics |
| **ENGAGE** | Managing people & communication | Stakeholders, Inbox, Mailing List |
| **PUBLISH** | Public-facing content | Embed, Tours |
| **CONFIGURE** | Project settings | Settings |

---

## Implementation

### Changes to `src/app/projects/[id]/page.tsx`

1. **Add section groups to tab definitions:**

```typescript
type TabGroup = {
  id: string
  label: string
  tabs: Tab[]
}

const tabGroups: TabGroup[] = [
  {
    id: 'top',
    label: '', // No header for overview
    tabs: ['overview']
  },
  {
    id: 'collect',
    label: 'Collect',
    tabs: ['feedback', 'analytics']
  },
  {
    id: 'engage',
    label: 'Engage',
    tabs: ['stakeholders', 'inbox', 'mailing']
  },
  {
    id: 'publish',
    label: 'Publish',
    tabs: ['embed', 'tours']
  },
  {
    id: 'configure',
    label: 'Configure',
    tabs: ['settings']
  }
]
```

2. **Update the navigation render to show grouped items:**

```tsx
<nav className="flex-1 p-3 overflow-y-auto">
  {tabGroups.map(group => {
    const groupTabs = allTabs.filter(t => group.tabs.includes(t.id))
    const visibleTabs = groupTabs.filter(tab => isAdmin || !tab.adminOnly)

    if (visibleTabs.length === 0) return null

    return (
      <div key={group.id} className="mb-4">
        {group.label && (
          <p className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {group.label}
          </p>
        )}
        <ul className="space-y-1">
          {visibleTabs.map(tab => (
            // ... existing tab button code
          ))}
        </ul>
      </div>
    )
  })}
</nav>
```

---

## Alternative: Collapsible Groups

If the menu still feels too long, we could make groups collapsible:

```
Overview

▼ COLLECT
  Feedback           12
  AI Analytics

▶ ENGAGE             11  (collapsed, shows total count)

▼ PUBLISH
  Embed
  Tours              2

Settings
```

This would require:
- State to track which groups are expanded
- localStorage to remember user preference
- More complex UI logic

**Recommendation:** Start with the simple section headers approach. Add collapsible functionality later if users request it.

---

## Files to Modify

1. **`src/app/projects/[id]/page.tsx`**
   - Add `tabGroups` array defining the groupings
   - Update navigation render to loop through groups
   - Add section header styling

---

## Visual Styling

Section headers should be:
- Small (text-xs)
- Uppercase
- Muted color (slate-400)
- Wide letter spacing
- Small margin above/below

Example CSS classes:
```
text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 mt-4
```

---

## Summary

**Minimal change, big UX improvement:**
- Keep all existing tabs
- Add visual grouping with section headers
- Reorder to group related items together
- Single file to modify
- No breaking changes
