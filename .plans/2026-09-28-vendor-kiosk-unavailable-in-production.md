# Vendor kiosk shows "Temporarily unavailable" in production

**Date:** 2026-09-28
**App / scope:** `vendor/` — kiosk (`components/kiosk/KioskShell/`, `services/vendor-access.service.ts`). Read-only references: `backbone/supabase/migrations/`.
**Status:** CAUSE CONFIRMED (2026-09-28) — see B6: the test account had no `vendor` portal grant (fixed by you via Command). The code fixes shipped to production 2026-09-28 as [2026-09-28-vendor-login-full-access-check.md](2026-09-28-vendor-login-full-access-check.md) B1 + I3. B6 and I1 are awaiting your close.

> A production kiosk lands on "Temporarily unavailable". This plan records what the page
> actually means, what has already been ruled out **and why**, so the next session starts from
> evidence rather than from the symptom.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, F# = Finding; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "booker I1").

---

## The environment this was reported on

| | |
|---|---|
| App | `vendor`, production |
| Version | **0.55.6** |
| Commit | **`b94956ca23ace2bc1ad86f4107c95b49fd060e26`** — "patch-0.55.6: button spacing" |
| Reported | 2026-09-28, by the user, using a real kiosk |
| Database | Production. `supabase migration list` confirms it received `20260922000001_slot_occupancy_rpc` and `20260927000001_popular_offerings_rpc` and nothing unexpected |

⚠️ **The deployed build has not been confirmed to be this commit.** Local `package.json` says
0.55.6; what Vercel is actually serving the kiosk tablet is unverified. B3 covers it.

---

## What the page actually means — read this before theorising

> **Line references (re-pointed 2026-09-28):** every `file:line` in this plan points at the
> **current vendor working tree** — i.e. after
> [2026-09-28-vendor-login-full-access-check.md](2026-09-28-vendor-login-full-access-check.md)
> B1 and I3, uncommitted. The deployed build `b94956c` is the same code minus those changes;
> the investigation below describes `b94956c`'s **behaviour**, with notes where I3 changed it.

`KioskShell.tsx:27` renders "Temporarily unavailable" (`:38`) for **two** gate states and no
others: `signed_out` and `offline`.

| Gate | Set at | Cause |
|---|---|---|
| `signed_out` | `useKioskShell.ts:127` | `getUser()` returned no user |
| `signed_out` | `useKioskShell.ts:140` | `verifyVendorAdminFor(user, pinnedVendorId)` returned **not allowed** |
| `signed_out` | `useKioskShell.ts:166` | a Supabase `SIGNED_OUT` auth event |
| `offline` | `useKioskShell.ts:259` | `navigator.onLine` is false |

*Since login-plan I3 (2026-09-28, not yet deployed): a **third** gate, `unavailable`, is set at
`useKioskShell.ts:140` when the access check could not be completed, and renders the same
title with different copy — "This kiosk can't reach the booking service right now…" — plus
**Try again** and **Staff exit** instead of Staff sign-in. `signed_out` from that line now
means a genuine refusal only.*

A device that is **not** pinned as a kiosk never reaches this page — it redirects to `/`
(`useKioskShell.ts:120`, gate `leaving`). So the tablet's `localStorage` pin
(`lib/kioskMode.ts:31`) is intact; that is not the fault.

### ⚠️ B1 — the trap that will waste the most time  ⬜ TODO

`verifyVendorAdminFor` (`services/vendor-access.service.ts:124`) reads **four** tables in one
`Promise.all`: `profiles`, `user_portals`, `vendor_members`, `vendors` (plus the `statuses`,
`portals` and `roles` joins).

It destructures `{ data }` and **never inspects the error**. So if any of those queries fails —
RLS, a missing grant, a 400 on a changed column, an expired token — `data` is `null`,
`portalRows` is `[]`, `hasPortal` is false, and the function returns `no_access`
(`vendor-access.service.ts:171`).

**A permissions failure and "this user genuinely is not a vendor-admin" render the identical
screen.** Diagnose from the **network tab**, never from the page.

*(Worth fixing regardless of the cause — see I1.)*

*2026-09-28: fixed in the working tree by login-plan I3 (not yet deployed) — a failed query now
returns `unavailable` (`vendor-access.service.ts:146-148`), and the kiosk shows distinct copy
for it. Once deployed, the page itself tells the two cases apart. Status left for you to close.*

---

## Already ruled out, with the reason

Each of these was checked by reading the code or the migrations on 2026-09-27/28. Do not
re-investigate without new evidence.

### F1 — the 2026-09-25 password-reset commit's `?code=` classifier  ✅ RULED OUT
`lib/supabase/client.ts` gained a module-load call to `classifyCodeCallback(location.search,
document.cookie)`, which runs on **every page that imports the browser client, including
`/kiosk`**, and can trigger `failRecovery()` → `history.replaceState` + `location.reload()`.
That looked like a strong candidate for a reload loop.

**It is not.** The classifier returns `"none"` unless the URL carries `?code=`
(`lib/authCodeCallback.ts:28`). The kiosk's only query parameter is `?payment=success`, the
PayMongo return (`useKioskShell.ts:79`). Vendor no longer mails `?code=` links at all.

### F2 — the new second Supabase client  ✅ RULED OUT
`lib/supabase/recoveryRequestClient.ts` (new in the same commit) creates a second
`createClient`. Two clients sharing a storage key would fight over the session — a real way to
lose one.

**It cannot touch the kiosk.** It is created lazily on first use (only when requesting a reset),
and carries `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false` and
its own `storageKey: "rs-recovery-request"`.

### F3 — a migration breaking the gate's tables  ✅ RULED OUT
Every migration dated 2026-08-15 or later was grepped for `alter table` / `drop column` /
`create policy` / `drop policy` / `grant` / `revoke` against `profiles`, `user_portals`,
`vendor_members`, `vendors`, `statuses`, `portals`, `roles`.

**One hit, and it is irrelevant:** `20260821000001_account_deletion_requests.sql:134` creates a
policy on its own new table.

### F4 — the `schedules.end_time` drop  ✅ RULED OUT
`20260828000002_schedule_window_minutes_contract.sql` carries the warning *"RUN ONLY AFTER BOTH
APP BUILDS ARE DEPLOYED… will 400 on every schedule query the moment this lands."* That is
exactly the shape of "a kiosk broke after a database push".

**It is not this.** Vendor stopped selecting `schedules.end_time` on the same day
(`41eec36`, 2026-08-28), the one remaining `end_time` select is on `bookings`
(`services/schedules.service.ts:209`), whose column still exists — and production already had
that migration long before the recent push. It would also break the **booking step**, not the
auth gate.

### F6 — production serving an older build  ✅ RULED OUT (2026-09-28)
Fetched `https://vendor.ezzy.ph/kiosk` and its chunks directly. The served `useKioskShell`,
`verifyVendorAdminFor` and `lib/kioskMode` code matches `b94956c` line for line, and the baked
Supabase URL matches the CSP `connect-src` (`pdkejyjidrfxksaczvfy`). The *server* build is
current; a stale service worker on one specific device (B3) is still possible but cannot
serve stale code for a fresh browser — `sw.js` is network-first for navigations and only
caches fingerprinted `/_next/static/` files.

### F7 — the kiosk gate and the portal gate cannot disagree on a correctly pinned device  ✅ READ
`verifyVendorAdminFor` runs the same three queries as the portal's `verifyVendorAccess`, plus
`.eq("vendor_id", pinned).maybeSingle()`. `vendor_members` has `primary key (user_id,
vendor_id)`, so `maybeSingle` cannot hit a multi-row error. The launcher pins
`selectedVendorId`, which comes from the same active-vendor-admin filter the portal used to
let the user in. **So if the portal admitted the user and the pin was written by the
launcher in that session, the gate's queries should pass** — the failure has to come from
a query *error* (B1), a pin that was **not** written in that session (B5), or `getUser()`
returning no user.

### F5 — the two migrations pushed on 2026-09-27  ✅ RULED OUT
`get_slot_occupancy` and `get_popular_offerings` are both `create function` plus grants. Neither
touches auth, RLS, or any table. The user confirmed prod received these and nothing unexpected.

---

## Candidates, most likely first

### B2 — the session simply ended  ⬜ TODO
The gate's own comment (`useKioskShell.ts:106`) names the causes: *"a session can end with
nobody touching the tablet: an overnight refresh failure, a sign-out on another device, **a
password change**."*

⚠️ **Password recovery was being changed and tested on 2026-09-25**
(`.plans/2026-09-25-vendor-password-recovery-cross-browser-fix.md`). A password reset on the
vendor-admin account whose session the kiosk holds invalidates that session. This needs **no
code fix** — signing in again on the kiosk resolves it.

**Check:** sign in on the kiosk. If it recovers and stays recovered, this was it.

### B3 — a stale service worker serving an old build  ⬜ TODO
⚠️ **There is precedent.** `.plans/2026-09-14-vendor-kiosk-next-customer-reset.md` (I3) found
`/kiosk?_rsc=…` responses being served from the SW cache so a navigation never committed. Its
D1 narrowed `public/sw.js`. A tablet that has been running for weeks may still hold the **old,
wide** service worker and a stale bundle — i.e. running pre-0.55.6 code against today's
database.

**Check:** DevTools → Application → Service Workers on the kiosk. Compare the registered SW and
the served bundle against the deployed commit. "Update on reload" + hard reload as the test.

### B6 — the test account fails the portal/profile layers, and the LOGIN FORM does not check them  🔄 IN PROGRESS — cause CONFIRMED; data fixed; code fix in the login plan

*2026-09-28: the login-form fix is login-plan B1 (✅ verified locally, not deployed). Status left for you to close.*

**Confirmed 2026-09-28** by the user's production query: `profile_status = active`,
`portals = {booker}`, with **no `vendor` portal**. Traced through the deployed code (F6):
`verifyVendorAdminFor` → `hasPortal` false → `no_access` (`vendor-access.service.ts:170-171`) →
gate `signed_out` → "Temporarily unavailable". The same layer in `verifyVendorAccess` is what
signs the account out after the kiosk exit.

**How the account got into this state:** not through the app. The only app code that inserts
`vendor_members` is `vendor/app/api/auth/register/route.ts:253`, which also grants the
`vendor` portal (`:233`) and rolls back if either fails. A `booker` grant alone means a
booker-registered account whose vendor-admin row was added outside the app (SQL editor or
seed). No record of it in `architecture/` or `.plans/`.
**Evidence (user, 2026-09-28):** all four requests 200; `vendor_members` returned exactly one
row (`Content-Range: 0-0/*`) for user `2022a260-29e6-4272-818e-1705764e5c59` at the pinned
vendor; `navigator.onLine` true; button reads "Staff sign-in" (so gate `signed_out`, not
`offline`); no other tabs. **And:** confirming the password in the kiosk's exit dialog lands
on the **login page, not the dashboard.**

That last point is decisive. After exit, `/` mounts `useAppShell`, whose session-restore path
runs `verifyVendorAccess` (`useAppShell.ts:227`) and **signs the user out** on
`no_access` / `suspended` / `pending_profile`. So the portal rejects this account too — the
kiosk is not the fault, it is just the first surface that re-checks.

**Why the account could sign in at all:** the login form (`useLoginPage.ts:317`) checks only
`getUserVendors()` — vendor-admin of an active vendor — and then `handleLoginSuccess` enters
the dashboard **without** `verifyVendorAccess`. It never checks `user_portals` or the profile
status. So an account with a vendor-admin row but **no `vendor` portal grant, or a profile
not `active`**, signs in fine, and is rejected by every *later* check: a reload, the kiosk.

**Check:**
1. Sign in, then reload the dashboard. Prediction: dropped to the login page.
2. In the production SQL editor (read-only):
   ```sql
   select s.name as profile_status,
          (select array_agg(po.name) from public.user_portals up
             join public.portals po on po.id = up.portal_id
            where up.user_id = p.id) as portals
     from public.profiles p join public.statuses s on s.id = p.status_id
    where p.id = '2022a260-29e6-4272-818e-1705764e5c59';
   ```
   Expect `profile_status <> 'active'` or `portals` missing `vendor`.

*2026-09-28: the user granted the `vendor` portal via Command; the production kiosk now works for this account, which confirms the cause. Status left for you to close.*

**Fix directions (not started — need a decision):**
- *Data:* grant the `vendor` portal / activate the profile via Command for this account.
- *Code (I2) — planned in [2026-09-28-vendor-login-full-access-check.md](2026-09-28-vendor-login-full-access-check.md):* the login form's gate disagrees with the restore gate — the plan B-I2 comment
  in `vendor-access.service.ts` says the three layers must be checked "in one place", and
  login is the place that was missed. Make `handleLogin` use `verifyVendorAccess` so a
  rejected account is told why at sign-in instead of failing later.

### B5 — a stale kiosk pin from an earlier session  ✖ ABORTED — ruled out 2026-09-28
*Ruled out by the user on the affected browser: `ezzy.kioskMode` and `rs_selected_vendor`
both hold `3dafc0c2-7fa3-47b0-82f4-b7df5f132a18`, which the user confirmed in Supabase is the
intended test vendor. The pin is correct, so the failure is in the check itself (B1 / B4 /
`getUser()`), not in which vendor it checks against.*
The pin (`localStorage["ezzy.kioskMode"]`) is per browser, not per account, and **only the
password-confirmed exit clears it** (`lib/kioskMode.ts:54`). While it is set, `AppShell`
redirects every visit to `/` straight to `/kiosk` (`AppShell.tsx:64`) — **before the login
form renders**. The kiosk then checks the signed-in user against the **old** vendor id,
which fails with `no_access` → "Temporarily unavailable".

So a browser that ran a kiosk earlier — for a different vendor, a vendor since deleted or
re-created, or before a re-seed — will show this page no matter who signs in, and signing
in again (B2) does not help. "Staff sign-in" on that page is really the exit dialog: it asks
for the signed-in user's password and then clears the pin.

**Check:** DevTools → Application → Local Storage → `https://vendor.ezzy.ph` →
`ezzy.kioskMode`. Compare it with the test vendor's id (the `vendor_id` in the
`vendor_members` response in the Network tab). Different = this.

### B4 — `navigator.onLine` false negative  ⬜ TODO
The `offline` gate is a separate branch to the same screen, and the hook's own comment notes
`navigator.onLine` "is false-negative-prone on some platforms"
(`useKioskShell.ts:94`). The copy differs — offline says *"This kiosk has lost its connection"*
— so this is distinguishable **on screen**.

**Check:** read the second line of the message. If it mentions the connection, it is B4, not an
auth problem at all.

---

## IMPORTANT

### I1 — `verifyVendorAdminFor` swallows query errors  ⬜ TODO

*2026-09-28: done as login-plan I3, widened to `verifyVendorAccess` and all three callers; verified locally, not deployed. Status left for you to close.*
**File:** `vendor/services/vendor-access.service.ts:127-141`
The `Promise.all` destructures `{ data }` from all three queries and discards every `error`. A
transport or permissions failure becomes `no_access`, which the kiosk renders as
"Temporarily unavailable" and the portal renders as a plain access denial.

**Fix direction:** capture the errors and return a distinct reason (e.g. `"unavailable"`) when a
query *failed* rather than returned no rows, so the two are distinguishable in the UI and in
logs. ⚠️ This is a genuine fix whatever the cause of the current incident — it is the reason
this report needed a network tab to progress.

**Verification:** a unit test per arm; the kiosk shows different copy for "cannot check" vs
"not permitted".

---

## Execution order

1. **B4** — read the second line of the message. Free, and settles offline vs auth immediately.
2. ~~**B5**~~ — ruled out 2026-09-28: the pin matches the test vendor.
   *(The user reports the page appears right after signing in to the test vendor account,
   which also weakens B2.)*
3. **B2** — sign in again on the kiosk.
   *(2026-09-28: Network tab on `/kiosk` — `auth/v1/user`, `profiles`, `user_portals`,
   `vendor_members` all **200**. A transport/permission failure is unlikely; since the
   portal gate admits this user on the same queries, the remaining suspects are the
   `offline` gate (B4) and a `SIGNED_OUT` event after the check. Response bodies not yet
   inspected.)*
4. **B1 / B3** — if none of the above: open the network tab on `/kiosk` and record which of
   the four queries fails and with what status, and check the registered service worker.
4. **I1** — worth doing regardless, once the cause is known.

## Verification

| Item | How | Kind |
|---|---|---|
| F1–F5 | Read the cited code and migrations | Machine-verifiable — **done 2026-09-27/28** |
| B2, B3, B4 | The production kiosk device | **Needs the live device** — cannot be done from here |
| I1 | Unit tests + the kiosk's rendered copy | Machine-verifiable |

⚠️ **Nothing in `vendor/` was modified while producing this plan.** The investigation was
entirely read-only.
