# Recovery gate is escapable by refresh, and there is no way to change a password in-app

**Date:** 2026-08-10
**App / scope:** `command`, `vendor`, `booker` — post-recovery gating; plus a password
section in Settings
**Status:** ✅ COMPLETE (2026-08-10) — B1, B2, I1, I2, I3 all executed, and B1's
blocking live check **passed: user confirmed manual testing of the real recovery flow on
production, 2026-08-10.** That was the one piece of evidence the plan was waiting on.

**I1 also live-verified by the user (2026-08-10):** password changed through the new
Settings section, signed out, signed back in with the new password — the full round trip.

One residual check is *not* claimed: the create-user toast (I2), which fires only on a
real `POST /api/users` by a signed-in admin. The set-password **email** half of I2 stays
parked — see DEFERRED.

**Shipped.** All three repos committed and clean as of 2026-08-10 — `command` on
`master` (`312de00`), `vendor` on `master` (`0e2533e`), `booker` on
`feature/password_reset_fix` (`33bcad2`).

> One-line framing: a valid recovery link hands you a real session and then loses the
> "you must set a password" signal on the first refresh, so the only password-setting
> path in the product is skippable. Optimize for *nobody ends up with an account they
> cannot log into*.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

---

## Confirmed — this is real, and here is the mechanism

Reported 2026-08-10: clicking the production recovery link and refreshing Command logs
you straight in, with no password ever set. Reproduced by the user twice.

**The cause is that a valid token makes Supabase erase its own evidence.**

`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:3090-3105`:

```js
const { data, error } = await this._getUser(access_token);
if (error) throw error;              // ← invalid token exits here
const session = { …, user: data.user };
window.location.hash = '';           // ← valid token reaches here
```

So the fragment is cleared **only when the token is good**. Trace the consequence:

| Step | Evidence |
|---|---|
| Recovery is latched once, at module load, from the fragment | `lib/supabase/client.ts:17-18` |
| A valid token → session created → `window.location.hash = ''` | `GoTrueClient.js:3104` |
| **Refresh:** no fragment, so the latch is `false` | `client.ts:17-18` re-evaluates on reload |
| `PASSWORD_RECOVERY` does not fire either — it fires when *processing a recovery URL*, not when restoring a session from storage | `client.ts:20-24`, `useAppShell.ts:63-65` |
| So the auto-login short-circuit no longer applies | `useAppShell.ts:43` — `if (isRecoveryDetected()) return` |
| `getUser()` returns the recovery session's user; the access gate passes | `useAppShell.ts:45-53` |
| `recoveryMode` false + `loggedIn` true → the full app renders | `AppShell.tsx:37-41` |

Identical code in all three portals (`client.ts` byte-identical; verified).

### The local repro *failed*, and that is the corroboration

I drove Chromium against a `command` dev server with a synthetic
`#access_token=fake…&type=recovery` fragment and refreshed. The reset form **survived**
the refresh — the opposite of the report. That is not a contradiction: the fake token
throws at `_getUser` (line 3091), so line 3104 never runs and the fragment is still
in the URL on reload, re-arming the latch. The bug requires a *valid* token, which is
exactly why it only shows up against real Supabase. Recorded here so nobody re-runs
that experiment and concludes the bug isn't real.

### Severity — and what this is *not*

**Not a security vulnerability.** The session came from a legitimate recovery link sent
to the account's own address; letting its holder into the app grants nothing the link
did not already grant. Anyone claiming privilege escalation here is wrong.

**It is still a blocker,** because of who it hits. `command/app/api/users/route.ts:59-63`
creates every user with **no password**:

```ts
await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: … })
```

Recovery is therefore not an edge case — it is the *only* onboarding path for every
Command-created user, and the set-password step in it is skippable by a page refresh.
Each user who refreshes ends up permanently dependent on an email round-trip to log in,
and will not discover this until their session expires. Vendors who self-register are
unaffected: `vendor/app/api/auth/register/route.ts:162-163` does pass a `password`.

---

## BLOCKERS

### B1 — Recovery mode is lost on refresh, letting users skip setting a password  ✅ DONE (2026-08-10)

> **Executed** in `command`, `vendor`, `booker`. `lib/supabase/client.ts` gains a
> `sessionStorage` mirror (`rs.recovery`) written whenever recovery is detected — from
> the fragment at load or from the `PASSWORD_RECOVERY` event — plus an exported
> `clearRecovery()`. Both storage helpers are try/catch-wrapped so privacy modes
> degrade to the old behaviour instead of throwing. `useLoginPage.ts` calls
> `clearRecovery()` on a successful `updatePassword()` before the existing `signOut()`.
>
> **Verified — machine:** `npx tsc --noEmit` clean in all three; `vendor` suite 50 pass,
> 0 fail (unchanged — no new unit tests, see below).
>
> **Verified — live browser (Chromium, `command` dev server):** the latch finally makes
> the failing condition reproducible without a valid token, by navigating to the bare
> origin instead of relying on Supabase to strip the fragment:
> 1. land on recovery link → reset form **YES**, latch stored **1**
> 2. **reload with no fragment — the exact case that used to escape** → reset form held
>    **YES**
> 3. Back to Sign In → login form **YES**, latch cleared **YES**
> 4. reload again → not re-trapped **YES**
>
> **No unit tests added, deliberately.** The only pure logic here is a one-line OR; the
> real failure surface is the *wiring* (clear on success, clear on cancel), which a unit
> test cannot reach. The four-step browser sequence above exercises exactly that, so a
> pure-helper module extracted solely to be testable would have been an abstraction for
> a single call site — AGENTS.md Simplicity First.
>
> **Still outstanding:** a real recovery token on production. The browser test simulates
> the fragment-less arrival; it does not prove Supabase's own clearing path interacts
> correctly with the latch. See the verification table.

**Files:** `lib/supabase/client.ts:17-26`, `components/layout/AppShell/useAppShell.ts:43,61-67`
(all three apps)

Mechanism and blast radius as above. The recovery signal lives only in a URL fragment
that Supabase deletes the moment it succeeds, so it cannot survive a reload.

**Fix approach — persist the latch in `sessionStorage`.**

1. In `client.ts`, when recovery is detected (fragment at load **or** the
   `PASSWORD_RECOVERY` event), write a `sessionStorage` key. Have
   `isRecoveryDetected()` return `fragment || event || storedFlag`.
2. Clear the key on a successful `updatePassword()` in
   `useLoginPage.ts:74-81`, before the existing `signOut()`.
3. Clear it on the B2 escape hatch.

`sessionStorage` (not `localStorage`) is deliberate: the latch dies with the tab, so an
abandoned recovery cannot wedge the app permanently on some future visit.

**Why not read `amr` from the JWT.** Technically available — `getClaims()` exists at
`auth-js/GoTrueClient.js:4821` and `amr?: AMREntry[]` at `lib/types.d.ts:1665` — and it
would survive across tabs. Rejected on two grounds: (a) GoTrue records recovery and
magic-link sign-ins under the same OTP method, so the claim likely cannot distinguish
"must set a password" from "signed in via magic link", and I cannot confirm the exact
value without a live recovery token; (b) `amr` describes how the session *began* and
does not change when `updateUser({password})` succeeds, so it would keep forcing the
reset form after the user has already complied. A flag that can be cleared is the right
shape for a one-shot obligation.

**Coupled to B2 — must ship together.** Making the latch sticky without an exit traps a
user who opened the link but does not want to continue.

**Verification:** machine — unit-test the latch helper (set/read/clear) in `vendor`,
the only app with a runner. Live — needs a **real** recovery token against production,
because a synthetic one provably cannot reproduce the condition.

### B2 — The reset form has no way out  ✅ DONE (2026-08-10)

> **Executed** in all three. `handleCancelReset` added to each `useLoginPage.ts`
> (`clearRecovery()` → `signOut()` → reload to a clean origin, mirroring the existing
> success path), exposed from the hook, and rendered in the reset view as a
> "Back to Sign In" button using the **existing** `styles.secondaryBtn` — the same class
> and wording the "sent" view already uses, so no new CSS and no new visual idiom.
> Confirmed `.secondaryBtn` is defined in all three `LoginPage.module.css` files
> (TypeScript cannot catch a missing CSS-module class, so this was grepped, not assumed).
>
> **Component separation:** no new component; handler in the hook, markup in the render
> layer, styling from the existing module CSS. No `useState`/`useEffect`/inline `style`
> added to any `.tsx`.
>
> **Verified:** steps 3 and 4 of the browser sequence under B1 — the button returns to
> the login form, clears the latch, and a subsequent reload does not re-trap.

**File:** `components/auth/LoginPage/LoginPage.tsx:200-217`

The reset view renders two password fields and an "Update Password" button — no cancel,
no back-to-sign-in. Today that is survivable because a refresh escapes (which is B1).
Once B1 makes the latch sticky, this becomes a trap for the rest of the tab session.

**Fix approach:** add a "Back to sign in" text button beside the submit, calling a
handler that clears the B1 flag, signs out, and returns to `loginView === "login"`.
`goLogin` already exists at `useLoginPage.ts:25`; the handler wraps it with the clear +
`signOut()`.

**Component separation:** no new component. The button is markup in the existing render
layer; the handler lives in the existing `useLoginPage.ts` hook; styling reuses the
established `styles.*` classes in `LoginPage.module.css`. Nothing moves logic into the
`.tsx`.

**Coupled to B1 — same batch, in both directions.**

---

## IMPORTANT

### I1 — No way to change your password from inside the app  ✅ DONE (2026-08-10)

> **Executed in all three**, each following that app's own Settings idiom rather than
> imposing one shape on three unrelated pages:
>
> | App | Shape | Files |
> |---|---|---|
> | `command` | 4th tab, "Password" | `components/settings/SecuritySettingsPage/` (`.tsx` + `useSecuritySettingsPage.ts` + `.module.css`), registered in `useSettingsPage.ts:4` and `SettingsPage.tsx` |
> | `vendor` | card below Appearance | `components/settings/SecurityCard/` (`.tsx` + `useSecurityCard.ts`), Tailwind on `sp-*` tokens, no CSS module — matching its sibling card |
> | `booker` | card below Appearance | `components/settings/SecurityCard/` (`.tsx` + `useSecurityCard.ts`), Tailwind on `db-*` tokens |
>
> The hook is identical in all three (8-char minimum mirroring `useLoginPage.ts`,
> deferred mismatch warning, `sonner` toast + inline error). Only the render layer
> differs, which is the part that genuinely had to.
>
> **Deliberately does not sign out on success.** The recovery form does, because there
> the session exists only to set a password. Here the user is mid-task and ejecting them
> would punish good hygiene; Supabase keeps the session valid across
> `updateUser({ password })`.
>
> **Component separation:** every `.tsx` is render-only — no `useState`, no `useEffect`,
> no inline `style`. All state, validation and the service call live in the hook.
> Command uses a co-located `.module.css`; `vendor`/`booker` use Tailwind token
> utilities, which is the RN-style exception their own Settings pages already follow.
>
> **Verified — machine:** `npx tsc --noEmit` clean ×3; vendor suite 50 pass, 0 fail.
>
> **Verified — live browser (Chromium, all three):**
> ```
>                       command   vendor   booker
> card/tab renders        YES      YES      YES
> idle: button disabled   YES      YES      YES
> too-short message       YES      YES      YES
> mismatch message        YES      YES      YES
> valid: button enabled   YES      YES      YES
> page errors             none     none     none
> ```
> Show/hide toggle flips `type` password→text (command). Light and dark screenshotted
> for command and visually checked — tokens carry both themes, no second ruleset needed.
>
> **Test fixtures added to reach the above:** `command` gained a `mode=security` branch
> in `app/ui-gallery/page.tsx`; `vendor` gained `mode=settings`. Booker's gallery already
> rendered `<SettingsPage />`, so its card was covered for free. These are two lines each
> in the app's own existing fixture route — the mechanism this repo already uses for
> isolated component rendering, and a hook for future visual-regression coverage.
>
> **Not verified:** an actual password change against Supabase. `updatePassword()` is the
> pre-existing service call already used by the recovery form, but no round-trip was run.

**File:** `components/settings/SettingsPage/SettingsPage.tsx:11-27`

Today the *only* way to set or change a password anywhere in the product is the
forgot-password email round-trip. A logged-in user who wants to change theirs — or a
Command-created user who skipped the step via B1 — has no in-app path. This is the
feature you asked for, and it is also the standing remedy that makes B1 recoverable
rather than terminal.

**Fix approach — a new tab, following the pattern already in this file.** Command's
Settings is a tab strip with one folder per tab
(`NotificationSettingsPage`, `DivisionsSettingsPage`, `PlatformFeeSettingsPage`).
Add a fourth in exactly that shape:

- `components/settings/SecuritySettingsPage/SecuritySettingsPage.tsx` — render only
- `components/settings/SecuritySettingsPage/useSecuritySettingsPage.ts` — new/confirm
  state, 8-char + match validation mirroring `useLoginPage.ts:64-71`, calls the existing
  `updatePassword()` from `services/auth.service.ts:23`, surfaces success/error
- `components/settings/SecuritySettingsPage/SecuritySettingsPage.module.css`
- register `"security"` in `useSettingsPage.ts:4` and add the tab button + render line

**Component separation** (`.claude/skills/component-separation/SKILL.md`): satisfied
explicitly — all state, handlers and the service call sit in the hook; the `.tsx` holds
no `useState`/`useEffect` and no inline `style={{}}`; styling is co-located in the
module CSS. This mirrors the three sibling tabs exactly rather than inventing a shape.

**UX** (`.claude/skills/ux-design/SKILL.md`): must handle all four states — idle,
submitting (disabled button + "Updating…", matching `LoginPage.tsx:216`), success
(explicit confirmation, not a silent no-op), and error. Reuse the show/hide eye toggle
pattern from `LoginPage.tsx:203-208`. Light and dark both checked.

**No re-authentication prompt** — see DEFERRED, this is a deliberate call, not an
oversight.

**Access:** Settings is not root-gated (`AppShell.tsx:86`), so this is available to
every Command user, which is the intent.

**Verification:** machine — type-check, plus a unit test of the validation predicate if
it is extracted. Live — change a password in the deployed app, sign out, sign back in
with the new one.

### I2 — Command-created users are never told they have no password  ✅ DONE (2026-08-10, UI scope)

**File:** `command/app/api/users/route.ts:59-63`

A user created in Command receives no password and no notification, so they cannot know
to run Forgot Password.

**Decision (resolved 2026-08-10): UI only — no email.** The email option was
investigated and rejected *for now* on a concrete blocker, not a preference: the route
grants whatever portals the form selected (`route.ts:70,81-85`), so a set-password link
must target the user's own portal — and Command has no configuration that knows the
vendor or booker origins. Its entire env surface is `NEXT_PUBLIC_APP_DOMAIN`,
`NEXT_PUBLIC_APP_NAME` and the Supabase pair; `grep` for any portal URL across
`lib/ services/ app/` returns nothing. Adding them is an AGENTS.md approval gate
(environment-variable handling), and sending with no redirect would drop a vendor user
on Command, where they would set a password and then be told they have no access.

> **Executed** — `command` only; no other app creates users this way.
>
> **Three findings drove the shape of this:**
> 1. The UI *already claimed* to invite — "Failed to **invite** user"
>    (`useUsers.ts:64`), "Invite New User", "Invite User", the toolbar's "Invite User".
>    The product promised an email it never sent, which is the root of users not knowing.
> 2. On success there was **no feedback at all** (`useUsers.ts:66-69`) — the modal simply
>    closed.
> 3. Nothing anywhere mentioned the password state.
>
> **Changes:**
> - `components/users/UserModal/UserModal.tsx` — add-mode-only note: *"creates the
>   account with no password and sends no email … use Forgot Password"*. Titles/labels
>   corrected `Invite New User` → `Add New User`, `Invite User` → `Create User`.
> - `components/users/UserModal/UserModal.module.css` — three classes for the note,
>   using `--rs-*` tokens so both themes come free.
> - `components/users/UserToolbar/UserToolbar.tsx:52` — `Invite User` → `Add User`.
> - `components/users/UsersPage/useUsers.ts` — success toast on create, with an
>   8-second duration because it is an instruction rather than an acknowledgement;
>   error copy corrected off "invite".
> - `app/ui-gallery/page.tsx` — new `useraddmodal` fixture; the existing `usermodal`
>   renders `mode="edit"`, which can never show an add-only note.
>
> **Wording change disclosed deliberately:** renaming the primary action is slightly
> beyond "tell the user about the password", but leaving a button reading *Invite User*
> next to a note reading *sends no email* would have been incoherent on one screen. The
> internal identifiers (`onInvite`, `.inviteBtn`) were left alone — renaming those is
> churn with no user-visible benefit.
>
> **Component separation:** no new component, no state added. The note is markup in the
> existing render layer, styled from the existing co-located module CSS.
>
> **Verified — machine:** `npx tsc --noEmit` clean; `grep -rni invite` across
> `components/users`, `app/api/users`, `services/users.service.ts` leaves only internal
> identifiers and one explanatory comment.
>
> **Verified — live browser (Chromium):**
> ```
>                      add mode        edit mode
> no-password note     SHOWN           absent
> title                Add New User    Edit User
> primary button       Create User     Save Changes
> stale "Invite"       none            none
> page errors          none            none
> ```
> Screenshot reviewed — note renders above the form, reads clearly, tokens carry theming.
>
> **Not verified:** the toast itself. It fires only after a real `POST /api/users`
> round-trip, which needs a signed-in admin against a live database.

**Remaining, not done:** the set-password email. Parked behind the portal-URL config
decision above; see DEFERRED.

### I3 — Pre-existing hydration mismatch on Booker's dark-mode toggle  ✅ DONE (2026-08-10)

> **Root cause, measured not guessed.** The untruncated React diff is
> `transform: translateX(22px)` (client) vs `translateX(3px)` (server). `resolvedTheme`
> is `undefined` during SSR so the server always renders the knob "off"; the client
> resolves immediately and — because `ThemeProvider` sets **`defaultTheme="dark"`**
> (`app/layout.tsx:31`) — a visitor with no stored preference resolves to *dark*, i.e.
> "on". This therefore fired for **every first-time visitor**, in light and dark
> preference alike, not just for dark-mode users as first assumed.
>
> **Scope checked before fixing.** `resolvedTheme` drives a `dark` flag in four places
> (`TopBar.tsx:40-41`, `Step2Vendor.tsx:18-19`, `AppToaster.tsx:6`, plus Settings).
> Measured each across fresh browser contexts in both colour schemes: **only Settings
> produced a hydration warning** (6/6 runs). The others were left alone rather than
> "fixed" speculatively.
>
> **Change:** theme handling moved out of `SettingsPage.tsx` into its companion
> `useSettingsPage.ts` — which also satisfies the render/hook split the `.tsx` was
> quietly breaking by calling `useTheme()` itself — with the standard `mounted` guard.
> `dark` is `false` until mounted so the first client render matches the HTML exactly;
> the real value lands on the next render. `SettingsPage.tsx` now consumes
> `{ dark, setDark }` and no longer imports `next-themes`.
>
> **Verified — machine:** `npx tsc --noEmit` clean.
>
> **Verified — live browser:**
> ```
>                      before        after
> prefers-dark         1 warning     0 warnings
> prefers-light        1 warning     0 warnings
> theme=dark   → html "dark",  knob translateX(22px)   ← guard still resolves correctly
> theme=light  → html "light", knob translateX(3px)
> ```
> The knob reaching 22px matters as much as the zero: it proves the guard suppresses the
> mismatch without freezing `dark` at `false`.
>
> **One thing the fixture cannot test.** Clicking the toggle does not stick in
> `/ui-gallery` — its `useEffect` (`app/ui-gallery/page.tsx:103`) re-forces the theme from
> the URL param. Confirmed as a fixture artifact, not a regression, by running the same
> click against **TopBar's untouched toggle**, which fails identically. The click logic
> is unchanged regardless: `setDark(!dark)` expands to the previous
> `setTheme(dark ? "light" : "dark")`.
>
> **Note for later:** if `TopBar`/`Step2Vendor` ever need the same guard, promote it into
> `booker/hooks/useTheme.ts` — currently a one-line stub — rather than repeating it.
> Not done now: single call site, and AGENTS.md forbids abstractions for single-use code.

<!-- original finding, kept for the record -->

**File:** `booker/components/settings/SettingsPage/SettingsPage.tsx:8-9,46`

Found while verifying I1, **not caused by it.** React logs *"a tree hydrated but some
attributes of the server rendered HTML didn't match"*, and the diff points at the
toggle `<div>`, whose `className` is derived from `resolvedTheme === "dark"`.
`next-themes` resolves to `undefined` on the server and on the first client render, so
the class differs between the two passes. `SecurityCard` does not appear anywhere in the
reported diff path, and `?mode=grid` (no card) is clean while `?mode=settings` is not —
i.e. the trigger is the toggle, not the new card.

**Fix approach:** the standard `next-themes` guard — track a `mounted` flag in a hook
and render the toggle in a deterministic state until after mount. Out of scope for this
plan; recorded so it is not rediscovered.

**Verification:** machine — the dev overlay's issue count on
`/ui-gallery?mode=settings` drops to zero.

---

## DECISIONS

<!-- No item may execute while any OPEN: line remains — see skill §7. -->

- **Which apps get B1 + B2?** → **All three** (resolved 2026-08-10) — `client.ts` is
  byte-identical across the portals, so this is one change applied three times.

- **Which apps get the Settings password section (I1)?** → **All three** (resolved
  2026-08-10) — chosen over the `command`-only recommendation. Accepted cost: the three
  Settings pages share no code, so this is three separate UI builds in three idioms
  (Command tab strip + CSS modules; `vendor` single Tailwind card list with no hook;
  Booker card list with a hook), not one change repeated.

**Branches (recorded 2026-08-10, per user).** `command` → `feature/password_reset_fix_2`
(clean, cut from `develop` @ `4147008`). `vendor` → `release/v0.30.4` (clean).
`booker` → `feature/password_reset_fix` (clean). No commits or pushes from this side.

⚠️ **`command`'s `production` branch is stale** — `c5e924a` (v0.18.3) does not contain
`ded6444 Password reset fix`, yet the fix *is* live on `command.ezzy.ph` (verified by
grepping the deployed bundle for its error copy). Vercel therefore builds from `develop`
or `master`, not `production`. Not blocking; recorded because the branch name now
misrepresents what is deployed.

No open decisions remain.

---

## DEFERRED / COSMETIC

- **No current-password re-authentication on the Settings form.** Standard practice is
  to require the existing password before changing it, as a control against someone
  using a hijacked session. Deliberately skipped: a large share of this product's users
  — every Command-created account — have **no password at all**, so the prompt would
  lock out precisely the people the feature exists for. The session remains the auth
  boundary, consistent with the existing recovery form which also requires no prior
  secret. Revisit if step-up auth is ever introduced.
- **The set-password email for Command-created users (the other half of I2).** Blocked
  on a real design question, not effort: Command has no configuration describing the
  vendor and booker origins, so it cannot address a link to the portal a new user
  actually belongs to. Unblocks once portal URLs are configured — worth deciding once,
  across all three apps, rather than bolting env vars onto Command alone.
- **Recovery latch does not survive closing the tab.** By design (`sessionStorage`).
  Someone who opens the link, closes the tab, and returns later is simply logged in
  without a password — and now has I1's Settings section to fix that. Choosing
  `localStorage` to close this would risk wedging the app on a later visit with no
  in-flight recovery, which is worse.

---

## Execution order

1. ~~**B1 + B2 together**~~ ✅ done 2026-08-10 — landed as one batch, as required.
2. ~~**I1**~~ ✅ done 2026-08-10.
3. ~~**I2**~~ ✅ done 2026-08-10 in its UI scope; the email half is parked (see DEFERRED).
4. ~~**I3**~~ ✅ done 2026-08-10.

---

## Verification summary

| Item | Machine-verifiable | Needs live environment |
|---|---|---|
| B1 | ✅ `tsc --noEmit` ×3 clean; vendor suite 50/50 | ✅ **real recovery token on production — user-confirmed 2026-08-10** |
| B2 | ✅ `tsc --noEmit` ×3; `.secondaryBtn` confirmed present in all three CSS modules | ✅ escape hatch clicked in a real browser — returns to sign-in, clears the latch, no re-trap |
| I1 | ✅ `tsc --noEmit` ×3; vendor 50/50; browser-driven state matrix across all three apps | ✅ **user-confirmed 2026-08-10** — password changed, signed out, signed back in |
| I2 | ✅ `tsc --noEmit`; invite-wording grep sweep; browser-verified add-vs-edit matrix | ⬜ the create toast — needs a real `POST /api/users` with a signed-in admin |
| I3 | ✅ `tsc --noEmit`; hydration-warning count 1→0 across fresh contexts in both colour schemes; knob position confirms the guard still resolves | ✅ browser-measured |

**The honest limit:** B1 is the one item in this plan whose fix cannot be proven locally.
The synthetic-token repro above is now understood to be incapable of reproducing the
condition, so B1 stays 🔄 until a real recovery link has been clicked, refreshed, and
observed to hold the reset form on production.
