# Login Modal Parity — academy + command

## Context

Two UX improvements were applied to the learner login modal and need to be ported identically to academy and command:

1. **Password visibility toggle** — eye icon lets users unmask password inputs
2. **Mobile info panel toggle** — on ≤640px screens the left panel is hidden by CSS; an "About" button in the top-right of the form lets users view the brand/features content without losing their place

Both academy and command have the same two-column login modal structure but neither has these features.

---

## Key Differences from Learner

| Concern | Learner | Academy | Command |
|---------|---------|---------|---------|
| Register form | Separate `RegisterField.tsx` + `useRegisterField.ts` | Inline `RF` component inside `LoginPage.tsx` — must be extracted | No register form |
| Login views | login, forgot, sent, register | login, forgot, sent, select_academy, register, reg_sent | login, forgot, sent only |
| Left panel icon | Car | Building2 | Shield |
| Mobile CSS | Already in globals.css | Missing — must be added | Missing — must be added |
| RFProps | has `label`, `type`, `placeholder`, `value`, `onChange`, `onEnter`, `required` | has extra `field` union key; no `onEnter` | no RF component |

---

## Changes

### Academy — 5 files

#### 1. `academy/app/globals.css`
Add 4 rules (identical to learner):
```css
.login-mobile-toggle { display: none; }

@media (max-width: 640px) {
  .login-left,
  .login-divider { display: none !important; }
  .login-right   { flex: 1 1 auto !important; padding: 40px 28px !important; }
  .login-mobile-toggle { display: flex !important; }
}
```

#### 2. `academy/components/auth/LoginPage/useRegisterField.ts` (NEW)
Exact copy of learner's hook — `show` state, `inputType` derived value, `toggleShow` handler.

#### 3. `academy/components/auth/LoginPage/RegisterField.tsx` (NEW — extracted from inline RF)
Extract the inline `RF` function from `LoginPage.tsx` (lines 12–32). Keep the academy-specific `field` union in `RFProps`. Import `useRegisterField`, `Eye`, `EyeOff`. Add password toggle identical to learner.

#### 4. `academy/components/auth/LoginPage/useLoginPage.ts`
- Add `useEffect` import
- Add `showLoginPassword: boolean` state + setter
- Add `mobileView: "form" | "info"` state + setter
- Add `useEffect(() => { setMobileView("form") }, [loginView])` — resets on all 6 view changes
- Return both from hook

#### 5. `academy/components/auth/LoginPage/LoginPage.tsx`
- Remove inline `RF` + `RFProps` — replace with `import { RF } from "./RegisterField"`
- Add `className="login-left"` to left panel div
- Add `className="login-divider"` to the `width: 1` divider div
- Add `className="login-right"` to right panel div
- Add `Eye`, `EyeOff`, `Info`, `X` to lucide-react import
- Destructure `showLoginPassword`, `setShowLoginPassword`, `mobileView`, `setMobileView` from hook
- Wrap login password input in relative div + absolute eye button (paddingRight: 40 on input)
- Add mobile toggle button (`className="login-mobile-toggle"`) at top-right of right panel inner div
- When `mobileView === "info"`: render inline brand panel (Building2 logo, badge, headline, feature list, Register CTA)
- Wrap all view conditionals in `mobileView === "form"` else branch

---

### Command — 3 files

#### 1. `command/app/globals.css`
Same 4 CSS rules as above.

#### 2. `command/components/auth/LoginPage/useLoginPage.ts`
- Add `useEffect` import
- Add `showLoginPassword: boolean` state + setter
- Add `mobileView: "form" | "info"` state + setter
- Add `useEffect(() => { setMobileView("form") }, [loginView])` — covers 3 view states
- Return both from hook

#### 3. `command/components/auth/LoginPage/LoginPage.tsx`
- Add `className="login-left"`, `className="login-divider"`, `className="login-right"` to panel divs
- Add `Eye`, `EyeOff`, `Info`, `X` to lucide-react import
- Destructure `showLoginPassword`, `setShowLoginPassword`, `mobileView`, `setMobileView` from hook
- Wrap login password input in relative div + absolute eye button
- Add mobile toggle button at top-right of right panel inner div
- When `mobileView === "info"`: render inline brand panel (Shield logo, "Restricted Access" badge, headline, 4 feature bullets — no register CTA)
- Wrap all view conditionals in `mobileView === "form"` else branch

---

## Files Summary

| File | Status |
|------|--------|
| `academy/app/globals.css` | Edit |
| `academy/components/auth/LoginPage/useRegisterField.ts` | New |
| `academy/components/auth/LoginPage/RegisterField.tsx` | New |
| `academy/components/auth/LoginPage/useLoginPage.ts` | Edit |
| `academy/components/auth/LoginPage/LoginPage.tsx` | Edit |
| `command/app/globals.css` | Edit |
| `command/components/auth/LoginPage/useLoginPage.ts` | Edit |
| `command/components/auth/LoginPage/LoginPage.tsx` | Edit |

**8 files total. No new dependencies. No schema changes.**

---

## Verification

1. **Desktop — both apps:** left panel always visible, no toggle button visible, eye icon on password field works
2. **Mobile (≤640px) — both apps:** left panel hidden, Info button visible top-right, tapping shows brand info panel, X button returns to form
3. **Academy register form:** Password and Confirm Password fields both have independent eye toggles
4. **View changes reset mobile view:** switching between any views always returns to form view on mobile
5. `npx tsc --noEmit` passes in `./academy` and `./command`
