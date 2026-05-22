# Academy Dashboard — Guide Panel

## Context

Add the same user-guide panel to the academy dashboard that was built for learner. The panel teaches new academy admins how to use the portal. It is collapsible and its state persists in localStorage.

---

## Layout

Stat cards stay full-width (unchanged). Below them, the existing content moves into a left column and the guide panel occupies a fixed right column.

```
┌────────────────────────────────────────────────┐
│  [Stat] [Stat] [Stat] [Stat]                   │  ← unchanged, full width
├─────────────────────────┬──────────────────────┤
│  PendingApprovalsCard   │  GuidePanel          │
│  NotificationsCard      │  (280px, collapsible)│
│  BookingTrendsCard      │                      │
└─────────────────────────┴──────────────────────┘
```

When the guide is hidden, the left column expands to full width. A "Show guide" button appears top-right above the left column.

---

## Guide Items (confirmed by user)

| Icon | Title | Colour |
|------|-------|--------|
| `Clock` | Pending Approvals | `#f59e0b` (amber) |
| `CalendarDays` | Schedule Management | `#3b82f6` (blue) |
| `BookOpen` | Bookings | `#10b981` (green) |
| `Package` | Offerings & Instructors | `#6366f1` (indigo) |

---

## Key Differences from Learner

| Concern | Learner | Academy |
|---------|---------|---------|
| CSS card class | `db-card` | `sp-card` |
| CSS tokens | `--db-*` | `--sp-*` |
| Sub-bg token | `--db-sub-bg` | `--sp-sub-bg` |
| Card border token | `--db-card-border` | `--sp-card-bdr` |
| localStorage key | `"db-guide-hidden"` | `"sp-guide-hidden"` |
| Dashboard hook | `useDashboardPage` (existed) | New — only owns guide state; dashboard props stay on component |

---

## Files

### New files
- `components/dashboard/GuidePanel/guideItems.ts` — guide content config
- `components/dashboard/GuidePanel/GuidePanel.tsx` — visual component; props: `onHide: () => void`
- `components/dashboard/DashboardPage/useDashboardPage.ts` — owns only `guideVisible`, `hideGuide()`, `showGuide()`

### Modified files
- `components/dashboard/DashboardPage/DashboardPage.tsx` — add hook, restructure below-stats layout, add GuidePanel and show-guide button

### Unchanged files
- All existing dashboard cards (`PendingApprovalsCard`, `NotificationsCard`, `BookingTrendsCard`, `StatCard`)

---

## Implementation Detail

### `useDashboardPage.ts`
```ts
"use client"
import { useState, useEffect } from "react"

const GUIDE_KEY = "sp-guide-hidden"

export function useDashboardPage() {
  const [guideVisible, setGuideVisible] = useState(true)

  useEffect(() => {
    if (localStorage.getItem(GUIDE_KEY) === "true") setGuideVisible(false)
  }, [])

  function hideGuide() {
    localStorage.setItem(GUIDE_KEY, "true")
    setGuideVisible(false)
  }

  function showGuide() {
    localStorage.setItem(GUIDE_KEY, "false")
    setGuideVisible(true)
  }

  return { guideVisible, hideGuide, showGuide }
}
```

### `guideItems.ts`
```ts
export const GUIDE_ITEMS = [
  { Icon: Clock,       title: "Pending Approvals",     color: "#f59e0b", body: "..." },
  { Icon: CalendarDays, title: "Schedule Management",  color: "#3b82f6", body: "..." },
  { Icon: BookOpen,    title: "Bookings",               color: "#10b981", body: "..." },
  { Icon: Package,     title: "Offerings & Instructors", color: "#6366f1", body: "..." },
]
```

### `GuidePanel.tsx`
Same visual structure as learner's GuidePanel but using `sp-card`, `sp-sub`, and `--sp-*` tokens throughout.

### `DashboardPage.tsx` layout
```tsx
<div className="space-y-4">
  {/* Stat cards — full width, unchanged */}
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    ...
  </div>

  {/* Show-guide button when panel is hidden */}
  {!guideVisible && (
    <div className="flex justify-end">
      <button onClick={showGuide}>...</button>
    </div>
  )}

  {/* Two-column layout */}
  <div className="flex flex-col xl:flex-row gap-5 items-start">
    {/* Left column */}
    <div className="flex-1 min-w-0 space-y-4">
      <PendingApprovalsCard ... />
      <NotificationsCard ... />
      <BookingTrendsCard ... />
    </div>

    {/* Right column */}
    {guideVisible && (
      <div className="w-full xl:w-[280px] xl:shrink-0">
        <GuidePanel onHide={hideGuide} />
      </div>
    )}
  </div>
</div>
```

---

## Verification

1. `npx tsc --noEmit` in `./academy` — clean
2. Dashboard renders stat cards full-width, guide panel on the right
3. Clicking "Hide" collapses panel, left column expands, "Show guide" button appears
4. Clicking "Show guide" restores the panel
5. Refresh — hidden/shown state persists
6. Mobile (≤ xl breakpoint) — guide stacks below left column
