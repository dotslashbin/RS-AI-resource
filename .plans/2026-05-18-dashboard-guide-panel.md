# Dashboard — Two-Column Layout with Guide Panel

## Context

Redesign the learner dashboard from its current layout (left: bookings/in-progress, right: notifications widget) to a new two-column layout:

- **Left column**: Notifications (top) → InProgressCard → Current Bookings list
- **Right column**: Collapsible guide/tips panel with artwork, explaining the UI sections to new users

The guide panel is toggleable and its hidden/shown state is persisted to localStorage.

---

## Current Layout

```
┌─────────────────────────┬──────────────────┐
│  InProgressCard         │  Notifications   │
│  Current Bookings list  │                  │
└─────────────────────────┴──────────────────┘
```

## New Layout

```
┌──────────────────────────────┬─────────────────────────┐
│  NotificationsWidget         │  GuidePanel             │
│  InProgressCard              │  (collapsible)          │
│  Current Bookings list       │                         │
└──────────────────────────────┴─────────────────────────┘
```

When guide is hidden, left column expands to full width.

---

## Design — GuidePanel

**Theme:** Dark, consistent with existing `--db-card-*` tokens. Uses gold (`#FFC200`) and blue (`#2563eb`) accents already present in the app.

**Structure:**
- Header bar: "Getting Started" title + compass/sparkle icon + "Hide guide" toggle button
- Decorative gradient arc/glow behind the header (matches the login page orb style)
- 4 guide cards stacked vertically, each with:
  - Coloured icon badge (circle with lucide icon)
  - Bold title
  - Short description (2 sentences max)
  - Subtle left-border accent in the card's colour

**Guide items:**

| Icon | Title | Colour |
|------|-------|--------|
| `Calendar` | Book an Exam | `#2563eb` (blue) |
| `BarChart2` | In-Progress Bookings | `#FFC200` (gold) |
| `Bell` | Notifications | `#10b981` (green) |
| `Receipt` | Transactions | `#8b5cf6` (purple) |

**Toggle behaviour:**
- Header has a `ChevronRight` / "Hide guide" button
- Clicking it calls `onHide()` → parent sets `guideVisible = false` → panel disappears
- Left column gets `flex: 1` (expands to fill)
- A small floating "?" button appears in the top-right of the dashboard to re-show the guide
- State persisted to `localStorage` key `"db-guide-hidden"`

**Mobile (≤ 640px):**
- Guide panel stacks below the left column (flex column direction)
- Hidden by default on first load on mobile (set `"db-guide-hidden"` default based on screen width)

---

## Files

### New files
- `components/dashboard/GuidePanel/GuidePanel.tsx` — visual component; props: `onHide: () => void`
- `components/dashboard/GuidePanel/guideItems.ts` — guide content config (data separated from render)

### Modified files
- `components/dashboard/DashboardPage/DashboardPage.tsx` — new two-column layout, move notifications to left, add GuidePanel on right, add "?" re-show button
- `components/dashboard/DashboardPage/useDashboardPage.ts` — add `guideVisible` state + `toggleGuide()` + localStorage persistence

### Unchanged files
- `NotificationsWidget.tsx` — no changes, just moves position in layout
- `InProgressCard.tsx` — no changes
- `BookingCard.tsx` — no changes
- `BookingDetailModal.tsx` — no changes

---

## Implementation Detail

### `useDashboardPage.ts` additions
```ts
const [guideVisible, setGuideVisible] = useState(true)

useEffect(() => {
  if (localStorage.getItem("db-guide-hidden") === "true") setGuideVisible(false)
}, [])

function hideGuide() {
  localStorage.setItem("db-guide-hidden", "true")
  setGuideVisible(false)
}
function showGuide() {
  localStorage.setItem("db-guide-hidden", "false")
  setGuideVisible(true)
}
```

### `guideItems.ts`
```ts
import { Calendar, BarChart2, Bell, Receipt } from "lucide-react"

export const GUIDE_ITEMS = [
  { Icon: Calendar, title: "Book an Exam",           color: "#2563eb", body: "..." },
  { Icon: BarChart2, title: "In-Progress Bookings",  color: "#FFC200", body: "..." },
  { Icon: Bell,      title: "Notifications",         color: "#10b981", body: "..." },
  { Icon: Receipt,   title: "Transactions",          color: "#8b5cf6", body: "..." },
]
```

### `DashboardPage.tsx` layout structure
```tsx
<div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

  {/* Left column */}
  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
    <NotificationsWidget />
    {draft && <InProgressCard ... />}
    {/* bookings list */}
  </div>

  {/* Right column — guide panel */}
  {guideVisible && (
    <div style={{ flex: "0 0 300px" }}>
      <GuidePanel onHide={hideGuide} />
    </div>
  )}

  {/* Re-show button when guide is hidden */}
  {!guideVisible && (
    <button onClick={showGuide} ...>?</button>
  )}

</div>
```

---

## Verification

1. `npx tsc --noEmit` — clean
2. Dashboard renders with notifications on top-left, guide on right
3. Clicking "Hide guide" collapses the right panel, left column expands
4. Clicking "?" re-shows the guide
5. Refresh page — hidden/shown state persists correctly
6. Mobile (≤ 640px) — guide stacks below or is hidden by default
