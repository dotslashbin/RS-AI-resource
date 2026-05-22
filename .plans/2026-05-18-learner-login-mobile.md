# Learner Login — Mobile Responsive Fix

## Context

The login page uses a two-column layout (marketing left panel + form right panel). On mobile, the marketing panel sits above the form, forcing users to scroll to reach the login inputs. No changes should be made to the desktop layout.

---

## Root Cause

All layout is inline styles — no media queries. The two-panel flex row never collapses on narrow viewports. The right panel (form) is `flex: 0 0 340px`, which forces it to the right of the left panel at all screen sizes.

---

## Approach

**On mobile (≤ 640px):** hide the left panel and divider entirely, expand the form panel to full width, and add a compact brand header above the form so users know what app they're on.

**On desktop (> 640px):** zero changes.

This avoids any scrolling — the form is the only thing on screen on mobile, and it fits without scrolling on all modern phones (the form is ~380px tall at most).

---

## Files to Change

### 1. `learner/app/globals.css`

Add at the bottom (outside existing `@layer` blocks):

```css
/* Login page — mobile layout */
.login-mobile-brand { display: none; }

@media (max-width: 640px) {
  .login-card    { border-radius: 20px; }
  .login-left,
  .login-divider { display: none; }
  .login-right   { flex: 1 1 auto !important; padding: 36px 28px !important; }
  .login-mobile-brand { display: flex; }
}
```

### 2. `learner/components/auth/LoginPage/LoginPage.tsx`

Four `className` additions (no style changes):

| Element | Add |
|---------|-----|
| Outer card `div` (the white-ish bordered card) | `className="login-card"` |
| Left panel `div` | `className="login-left"` |
| Divider `div` | `className="login-divider"` |
| Right panel `div` | `className="login-right"` |

Plus one new element — a compact brand header inserted at the **top of the right panel's inner `<div style={{ width: "100%" }}>`**, hidden on desktop, visible on mobile:

```tsx
{/* Mobile-only brand header */}
<div className="login-mobile-brand" style={{ alignItems: "center", gap: 9, marginBottom: 28 }}>
  <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#1a3a8f,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <Car size={15} color="#fff" />
  </div>
  <div>
    <p style={{ color: "#fff", fontWeight: 800, fontSize: 13, lineHeight: 1 }}>RS Learner</p>
    <p style={{ color: "#FFC200", fontSize: 10, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", marginTop: 2 }}>Student Portal</p>
  </div>
</div>
```

`Car` is already imported in this file — no new imports needed.

---

## What Does NOT Change

- Desktop layout: untouched
- All four views (login, forgot, sent, register): only layout classes added, no logic or content changes
- `RegisterField.tsx`: untouched
- Any other component: untouched

---

## Verification

1. Resize browser to < 640px — only the form panel should be visible, no scrolling needed to reach inputs
2. Resize to > 640px — both panels visible, layout identical to before
3. Test all four views on mobile: login, forgot password, sent confirmation, register
4. `npx tsc --noEmit` — clean
