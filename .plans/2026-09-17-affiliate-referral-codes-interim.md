# Affiliate Referral Codes — Interim (vendor signup attribution)

**Date:** 2026-09-17
**App / scope:** `backbone/` (migration) · `command/` (create Affiliate users) · `vendor/` (signup captures a referral code)
**Status:** ✅ **COMPLETE (2026-09-19)** — live in production on vendor and Command, verified by
probe and by the user's own production signup test. The WordPress companion check (K10) was
taken out of scope by the user; the local-data incident (K16) is parked with the user. See
"On completion" at the end of this file.

> Give Command a way to create **Affiliate** users who each own a unique referral
> code, let vendor signup capture that code from a `?ref=` link, store who referred
> each vendor, and report on it with one SQL query. Build only the parts the future
> affiliate portal will reuse. Build nothing we would have to undo.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** S# = execution stage, B#/I# = items inside this plan,
> D# = decision. Numbers are plan-local; qualify cross-plan refs by app.

> ⚠️ **Approval gates in play:** schema change (new role, 2 tables, RLS, grants),
> security-related change (who can sign in), and **three apps in one task**
> (`backbone` + `command` + `vendor`). Each app is committed in its own repo.

---

## Scope

**In:** `affiliates` table with an admin-typed referral code · Command can make **any**
user an affiliate (create-with-code, or assign later) and change or remove it · `?ref=`
link captured at vendor signup · server-side validation · `vendor_referrals` attribution
table · a read-only referred-vendors list · export SQL.

**Out (this phase):** affiliate login/portal/dashboard, commissions, payouts,
analytics UI (charts/totals), self-service, managing multiple codes or links per
affiliate, a dedicated Affiliates page, attributing vendors that Command creates by
hand (`VendorFormModal`), changing attribution after signup, and any mobile work.

**Added 2026-09-18 (D8–D10):** affiliate management is full CRUD on the Users page —
the referral code is **editable** after creation, and an affiliate's detail view
**lists the vendors they referred**. Neither needs a schema change; S1 stands as
written.
`ezzy-vendor-mobile` has no registration screen (`src/app/` has sign-in only),
so it has nothing to change.

---

## Simplest Flow

**End to end**

```
Creating the Affiliate  (two ways, same result)
  a) NEW person:      Users → Add User → name, email, no portals,
                      referral code TYPED BY THE ADMIN (e.g. JUAN2026)
  b) EXISTING user:   Users → open them → "Affiliate" → assign a code.
                      Their role and portals are untouched (D11)
        │
Storing the code
  POST /api/users → checks the code is free → creates the user → saves the code
  in affiliates → toast + the user's detail view show the code and the share link
        │
Sharing the referral URL
  admin (or, later, the affiliate) shares  https://vendor.ezzy.ph/?ref=JUAN2026
        │
Vendor signup
  vendor opens link → registration opens at step 1 → the code rides along
  INVISIBLY (no field on the form) → steps 1–6 exactly as they are today → Submit
        │
Storing the attribution
  register route looks the code up → valid + affiliate active → creates the
  user + vendor + vendor_referrals row in one rollback-safe request
        │
Reporting
  ops runs the export SQL (below) → one row per referred vendor → into a spreadsheet
```

**Signup without a referral**
```
vendor opens https://vendor.ezzy.ph/ → registers normally
→ vendor created → NO vendor_referrals row → not in the report
```

**Signup with a valid referral**
```
?ref=JUAN2026 → code carried invisibly through the wizard → Submit
→ server checks: code exists AND the affiliate's profile is active
→ vendor created → vendor_referrals row written → shows up in the report
```

**Signup with an invalid referral** (D2 — silently ignored)
```
?ref=JUAN206 (typo), or a code belonging to a suspended affiliate
→ the wizard behaves identically; the vendor sees nothing and is never blocked
→ Submit succeeds → vendor created → NO vendor_referrals row is saved
→ the vendor simply does not appear in the report
```

> ⚠️ **Accepted consequence of D2 + D4:** a mistyped or stale link — including one
> retired by a code change (D9) — is invisible to everyone: the vendor, the affiliate
> and Command, until someone runs the export and notices a vendor missing. Mitigations: codes are admin-chosen and memorable,
> Command shows the full share link for copying, and the register route logs a
> warning whenever a `ref` was present but did not resolve, so it is diagnosable
> after the fact.

---

## Command walkthrough — what the admin actually does (2026-09-18)

Everything happens on **Command → Users**. There is no separate Affiliates page in this
phase (D8), and affiliate status never changes a user's role or portals (D11).

### A. Make a brand-new person an affiliate

```
Users → [+ Add User]
   Name            Nina Villanueva
   Email           nina@bookdeck.com
   Role            Member            (unchanged — affiliate is not a role)
   Portals         none ticked       (no portal = cannot sign in anywhere)
   Referral code   NINA2026          ← optional field; filling it makes them an affiliate
   [Create User]
        │
        ├─ code is normalised (NINA2026), format-checked and checked for uniqueness
        │  BEFORE the account is created — a clash creates nothing
        │
        └─ toast: "Nina Villanueva created — referral code NINA2026"
                  "Share https://vendor.ezzy.ph/?ref=NINA2026"
```

### B. Make an **existing** user an affiliate — the D11 case

```
Users → click Liza Cruz (an existing booker) → detail view
   → [Make affiliate]                      ← footer button, beside "Set password"
        │
        Referral code   [ LIZA2026 ]
        ⚠ shown if she is suspended/pending: her code won't attribute until she's active
        [Assign]
        │
        └─ one INSERT into `affiliates`. Her role stays Member, her booker portal stays,
           she still signs in to booker exactly as before. Nothing else changes.
```

### C. Where the code and the link live afterwards

```
Users → click the affiliate → detail view

   [Active] [Member] [Affiliate]            ← badge row

   Account Details
     ✉  Email             nina@bookdeck.com
     🛡  Role              Member
     ✓  Status            Active
     🔗 Referral code     NINA2026                        ← here
     🔗 Share link        https://vendor.ezzy.ph/?ref=NINA2026   ← copyable
     👥 Referred vendors  3

   Portal Access
     [vendor]  [booker]  [command]          ← unchanged; see "the affiliate portal" below

   Referred vendors (3)
     Citywide Sports Center      17 Sep 2026
     Harbor Sports Complex       21 Sep 2026
     Summit Athletics Club       03 Oct 2026

   Footer:  [Close] [Affiliate] [Edit User]
                     └─ change the code, or remove affiliate status
```

**The code is configured in exactly two places and nowhere else:** the Add User form
(new person) and the Affiliate modal (existing person). The **link is never configured** —
it is derived, always `<vendor origin>/?ref=<CODE>`, with the origin coming from
`PORTAL_URL_VENDOR` per environment, so the same affiliate's link is automatically
`localhost:3001` locally and `vendor.ezzy.ph` in production. Nobody types a URL, and a
link can never drift from the code.

### D. Where the affiliate portal slots in later

The detail view's **Portal Access** section renders from `ALL_PORTALS`
(`UserModal.tsx:100-110`). When the affiliate portal ships, adding an `affiliate` row to
`portals` + `ALL_PORTALS` + `PORTAL_CFG` makes a fourth chip appear there on its own,
and granting it becomes an ordinary portal grant — the same control, the same audit
trail, no rework of this modal. Until then no chip is shown, deliberately: a portal chip
for a portal nobody can enter would be a lie, and it would collide with the real row.

### E. Changing or removing

```
detail view → [Affiliate]
   Change code   NINA2026 → NINAV2026
      ⚠ "Links already shared using NINA2026 will stop being credited, and nobody
         will be told." Past signups keep their original code in the report.
   Remove affiliate
      ⚠ same warning, and REFUSED outright while they have referred vendors
        ("Remove the referrals first, or keep the affiliate and suspend the user.")
```

---

## Findings from investigation (what the design is built on)

These were checked in the code, not assumed.

1. **There is no `/vendor/signup` route.** The vendor app is a single-route SPA.
   Registration is a 6-step wizard inside the login screen at `/`
   (`vendor/components/auth/LoginPage/`). Deep links already work there:
   `/?division=<slug>` opens registration at step 1 with the division filled in
   (`vendor/lib/divisionDeepLink.ts`, applied in `useLoginPage.ts:106-164`).
   **`?ref=` should use exactly the same method.**
2. **Query params must be read when the module loads.** `AppShell` rewrites the
   query string before `LoginPage` mounts and drops any param it doesn't recognise.
   `divisionDeepLink.ts:1-25` explains why reading it any later fails. A `ref`
   param read in a React effect would already be gone.
3. **Roles are rows in `roles`** (`20260504000001_lookup_tables.sql:41`, ids 1–4,
   identity). Platform roles go in `user_roles`, which has no role constraint.
   `vendor_members` is limited to roles 3 and 4 (`20260504000002_schema.sql:98`),
   and that doesn't change.
4. **Portal membership is the login gate.** Each portal refuses a user with no
   `user_portals` row for it: vendor `verifyVendorAccess`
   (`vendor/services/vendor-access.service.ts:64-65`), command
   `verifyCommandAccess` (`command/services/command.service.ts:19-20`, which also
   needs admin or root), and booker `verifyBookerAccess`. An Affiliate with **no
   portals** is refused everywhere without any Affiliate-specific check.
5. **Command-created users have no password.** The set-password email only goes
   out if the user has a portal (`command/app/api/users/route.ts:108-125` →
   `resolvePortalOrigin`). An Affiliate with no portals gets no email, so by
   default it has no way to sign in.
6. **A leftover risk:** the Affiliate could still use *Forgot Password* on any
   portal, set a password, and get a valid Supabase session. The portal gate
   then signs them out. With the raw JWT, RLS would still let an active user
   with no portals read **active vendors** (`20260515000001`, gated only by
   `is_active()`), plus the lookup tables and `divisions`. That is public
   catalogue data. Accepted — see D3.
7. **The referral can't be a column on `vendors`.** The `vendors` UPDATE policy
   lets a vendor-admin update their **whole row**
   (`20260504000003_rls.sql:159-162`), so a vendor could change or erase their own
   `referred_by`. A separate table with no write grant for `authenticated` avoids
   that. It also gives commission fields a place to go later.
8. **Command's Users page would show an Affiliate as "Member".**
   `command/services/users.service.ts:57-61` only recognises root, admin and
   member and falls back to `"member"`. `UserRole` (`command/lib/types.ts:3`) and
   `ALL_ROLES` (`command/lib/constants.ts:35`) only list those three.
9. **There is no "owner" column for a vendor.** A vendor can have several
   `vendor-admin` members, and payout statements email all of them
   (`20260913000001_payout_statements.sql:266-273`). But the registering user's
   membership is always the first one written for a self-registered vendor
   (`register/route.ts`, step 4). **Primary vendor user = the vendor-admin with the
   earliest `vendor_members.granted_at`** (ties broken by `user_id`). The export
   query uses this definition.
10. **The email check blocks self-referral by email.** `isEmailAvailable` reads
    `profiles` (`vendor/lib/emailAvailability.ts`). An Affiliate's email already
    has a profile, so an affiliate cannot register a vendor with their own email.
    That is acceptable for now.
11. **Registration validation lives in one module.** Both routes use it
    (`vendor/lib/registration.ts:17-21`: "if you add a rule, add it here, not in a
    route"), so referral normalising goes there.
12. **No new public endpoint is needed.** D2 + D4 removed the planned
    `check-referral` route, which would have been an unauthenticated
    code-guessing oracle needing its own rate-limit rule (`check-email/route.ts:18`).
    Not adding it is strictly safer.

---

## Gap review (2026-09-17) — what the first draft got wrong or missed

Each was checked in the code. Corrections are folded into the items below; this
section keeps the reasoning.

| # | Gap | Category | Where it landed |
|---|-----|----------|-----------------|
| G1 | ✖ **SUPERSEDED 2026-09-18 (D11)** — no affiliate role, so no role map to update. For the record: **"type-check will catch every role map" — false.** `ROLE_CFG` is `Record<string, BadgeConfig>` with a `??` fallback (`command/lib/constants.ts:95-99`, `components/ui/RoleBadge/RoleBadge.tsx:9`). A missing `affiliate` entry compiles fine and renders a grey badge reading "affiliate". | Escalate | B1 — explicit `ROLE_CFG` entry |
| G2 | **`useCreateUser` whitelists fields in both directions.** It builds the POST body from six named fields and rebuilds the result object (`command/hooks/mutations/users/useCreateUser.ts:6-27`), so `referralCode` must be added to the body, to `UserFormData` (`lib/types.ts:138-145`) and to the returned object, or it is silently dropped at both ends. | Missed | B1, B4, B6 |
| G3 | **The ui-gallery `User` fixture breaks.** `USERS: User[]` (`command/app/ui-gallery/page.tsx:426`) is a typed literal, so a required `referralCode` on `User` is a compile error there. | Missed | B1 (nullable field + an Affiliate row added to the fixture) |
| G4 | **Command visual baselines: verified NOT affected.** The committed specs cover `mode=vendors`, `payouts`, `markpaid`, `withholding`, `seo` (`command/visual-tests/`), and none render `UserModal`. The gallery has user modes but nothing screenshots them. So the UserModal change adds no baseline churn. | False alarm (good news) | S2 verification note |
| G5 | **`architecture/conventions.md:586-619` was missing from the doc list.** "The shell owns the query string" names the two module-load readers by file; a third one has to be listed there or the next person re-learns it the hard way. | Missed | I1 |
| G6 | **D4 removes the only observable signal.** The `?division=` deep link is regression-tested through the DOM (`vendor/visual-tests/division-deeplink.spec.ts`) because the selected division is *visible*. A hidden referral code has nothing to assert, and `conventions.md:619` records that this exact class of bug (an effect-ordering regression) survived eleven days behind a green suite. | Escalate | **D7 (OPEN)** + B17, B18 |
| G7 | **An Affiliate created as `pending_activation` silently attributes nothing** — B9 requires an active profile. The create form defaults to `active`, but the operator can change it. | Missed | B6 (inline hint) |
| G8 | ✖ **VOID 2026-09-18 (D11)** — affiliate is not a role, so no switch can strip access. For the record: **switching an existing user to Affiliate through Edit** would write the role row with no `affiliates` row, producing a role with no code. `useUpdateUser` reconciles roles directly against Supabase (`hooks/mutations/users/useUpdateUser.ts:88-95`), so the UI alone is not a boundary. | Missed | B2 (guard in the shared helper), B7 |
| G9 | **Vendor account closure keeps the referral.** Closure *scrubs* the vendor row and deletes its `vendor_members` (`command/lib/accountDeletion/execute.server.ts:260-321`); it does **not** delete the vendor and does **not** scrub `vendors.name`. So a closed vendor still appears in the report, with its name and blank user columns. Correct behaviour — the referral happened — but it must be documented, not discovered. | Missed | Export SQL notes |
| G10 | **PostgREST embed shape is not guaranteed.** `affiliates(referral_code)` embedded from `profiles` is a one-to-one via the child's PK; supabase-js may hand back an object or a single-element array depending on how the relationship is detected. | Missed | B6 (read it defensively) |
| G11 | **No local seed data for the new tables**, so the export SQL can't be exercised on a fresh `db reset` without hand-writing rows. | Missed | S1.4 |
| G12 | **`vendor/lib` has no `registration.test.ts`**, so the B10 contract change has no existing unit-test home. Claiming "unit tested" without adding one would be a lie. | Missed | B10 verification — a new test file, or an honest "covered live" |

Also re-checked and **confirmed correct**: `useUpdateUser` already applies
`commandAccessError` where B7 assumed (`:36-38`) — now moot, B7 is aborted; the role
filter is driven by `ALL_ROLES` (`UserToolbar.tsx:36`), which under D11 means affiliates
need their **own** filter control rather than a free role entry (B1); `seed.sql` assigns
roles through variables, never literal ids; `set_updated_at()` exists
(`20260504000002_schema.sql:157`); and the vendor login wizard needs **no**
`LoginPage.tsx` change under D4, so `/ui-gallery?mode=loginregister` baselines are
untouched.

---

## Pre-apply review (2026-09-18) — is this migration safe to run?

Asked before executing S1, with staging and production in mind. **One blocker, one
change needed, five verified-clean.**

### J1 — ⛔ BLOCKER: account closure would half-fail for an affiliate

**Files:** `command/lib/accountDeletion/execute.server.ts:423-431` (Step 6) ·
`20260917000001_…sql` (`vendor_referrals.affiliate_user_id … on delete restrict`)

Account closure's **Step 6 deletes the auth user** — and its own comment calls it *"the
last step, and the only one with no undo"*. That delete cascades `auth.users` →
`profiles` → `affiliates`, and then hits `vendor_referrals.affiliate_user_id`, which is
**`ON DELETE RESTRICT`**. Postgres raises, and the closure fails **after** steps 1–5 have
already run: KYC documents purged, vendor scrubbed, vendor suspended, memberships
revoked, and **the confirmation email already sent**. The person is told their account
is closed while it still exists, and no step can be undone.

**Zero impact today** (no affiliates exist), and it cannot fire until S2 ships. But D11
made it *likely* rather than theoretical: affiliate is now a capability, so an ordinary
booker — the seeded Liza is exactly this — can hold a referral code and then request
closure like any other user.

**Blocking closure is not an acceptable fix.** Closing your account is a user right; it
must not be held hostage to referral bookkeeping.

**Fix — ✅ APPLIED to the migration file (2026-09-18, D14):** `affiliate_user_id` is now
nullable with `ON DELETE SET NULL`. The
referral row survives with its `referral_code` snapshot intact — the vendor was still
referred under that code — and only the personal link drops. This is the schema's own
established pattern for records that must outlive an account:
`account_deletion_requests.requested_by` (`20260821000001:22-26`: *"This row must SURVIVE
the deletion it records"*), `legal_acceptances.user_id`, `vendor_status_log.changed_by`.

**Checked and clean:** the other `deleteUser` call sites are all rollback paths for
just-created accounts (`booker/app/api/register/route.ts`, `vendor/app/api/auth/register/route.ts:167`,
`vendor/lib/kioskCustomer.ts`) — none can own an affiliates row. Only Command's
`DELETE /api/users` (covered by B5) and this closure path reach a user who might.

### J2 — Staging is exactly one migration behind: this one

`supabase migration list --linked` (run 2026-09-18) shows every migration through
`20260913000001` applied remotely, and `20260917000001` as local-only. So a push to
staging applies **exactly this migration** — no surprise backlog riding along.
⚠️ **The CLI is linked to STAGING, not production.** Production's state is unverified;
check it the same way before pushing there.

### J3 — Grants are necessary *and* sufficient  ✔ verified

`20260620000001_api_role_grants.sql:29-30` runs `alter default privileges in schema
public revoke all on tables from anon / authenticated`, so a new table starts with no
API-role privileges at all. The migration's explicit `grant select … to authenticated`
is therefore required, and granting nothing to `anon` leaves anon with nothing.

### J4 — Realtime correctly omitted  ✔ verified

Two migrations add tables to the `supabase_realtime` publication
(`20260525000002`, `20260718000001`); this one does not, and should not. Command's
Users page is not Realtime-subscribed — it has a Refresh button (`portals.md`) — and a
referral appearing live buys nothing.

### J5 — `affiliates.created_by` has no index  ⏸ accepted

Deleting a Command admin's profile does a `SET NULL` pass over `affiliates` without an
index. On a table with tens of rows that is a sequential scan of nothing. Not added;
revisit only if affiliates ever number in the thousands.

### J6 — PostgREST schema cache

Supabase reloads the API schema automatically on DDL. If the new tables 404 from the API
immediately after a push, reload the schema cache from the dashboard rather than
re-running anything.

### J7 — Hosted environments get no seed data

`db push` never runs `seed.sql`, so nina/liza exist **locally only**. On staging and
production, S1.3 parts 3 and 4 have no seeded users to assert against — run part 1
(structure and grants) there, and substitute real uuids if you want the RLS check.

---

## Found during S2 execution (2026-09-18)

### K1 — ⛔ the affiliate embed was ambiguous and broke the WHOLE users query

**File:** `command/services/users.service.ts:14` (the `SELECT` constant)

`affiliates(referral_code)` — exactly as this plan specified it in B6 — is **ambiguous**:
`affiliates` has **two** foreign keys to `profiles`, `user_id` (who the affiliate is) and
`created_by` (which admin added them). PostgREST refuses the request with `PGRST201` and
returns **no rows at all**, so the failure is not a missing affiliate column — it is the
entire Users page showing a load error.

Caught by querying the live local PostgREST with the app's exact `SELECT` string rather
than trusting the embed to resolve. **Fixed:** the FK is now named —
`affiliates!affiliates_user_id_fkey(referral_code)` — and re-verified against the same
endpoint: 17 rows, no error, Liza and Nina each returning `{ referral_code: … }`.

Two things worth keeping from this:
- **The embed returns an OBJECT**, measured, not assumed (gap G10 guessed at
  object-vs-array and guessed the wrong risk). The array branch stays as a cheap guard.
- **`created_by` is what created the ambiguity.** Any future embed of `affiliates` from
  `profiles` must name its FK too.

### K7 — the hidden input lives on every registration step, not just step 1  ✅ changed in code

The plan put B16's hidden input on step 1. But a vendor resuming a saved draft is sent
straight to the step they reached (`goRegister` → `computeResumeStep`), so the input would
be absent on exactly the path B17's "draft restored" test needs to observe — and absent
for any support engineer looking at a half-finished application. It now renders once at
the top of the registration view, so it is present on all six steps. Still invisible, still
`readOnly`, still not submitted by the form — the hook sends the value itself.

### K11 — ⛔ the deployed vendor app does not contain the referral feature (2026-09-19)

**Symptom (reported):** on staging, an affiliate created in Command with code `TESTREF`
got no credit for a signup through
`https://staging-vendor.ezzy.ph/?division=ezzyWell&ref=TESTREF`.

**Diagnosis — read-only headless probes of the live sites, nothing submitted:**

| | Staging (your URL) | Production (`/?ref=PROBE0000`) |
|---|---|---|
| Registration opens | yes — but via `?division=`, which is **old** code | **no** — new code opens it for `?ref=` alone |
| Hidden `referral-code` input (B16) | **absent** | **absent** |
| `referral-code` in any loaded script | **no** (14 scripts) | **no** (13 scripts) |

The signup page's own code was loaded (registration rendered), so a deployed B16 would
have shown up. **Staging vendor predates this feature**: the browser never captured
`?ref=`, never sent it, and the register route had nothing to record. The affiliate, the
code and the database are not the problem. Command *was* deployed with the feature
(staging can create affiliates), so this is vendor-specific.

⚠️ **Correction (same day): the production column is NOT a fault.** Production had not
been deployed at all yet — the app deploy was staging-only — so it lacking the feature is
expected. Only the **staging** column is a real finding. The probe ran in a fresh
headless context with no service worker, reading scripts straight from the server, so the
staging result is the server's build, not a stale client cache.

**Most likely cause** — one of: (1) the staging deploy covered Command but not vendor;
(2) vendor built from a branch without `feature/referral_codes` (`b3ac33d`) — flagged as
a risk at S4.3; (3) the vendor build failed and the previous one is still live. The
staging vendor deployment's commit in the hosting dashboard settles which.

**Narrowed down (2026-09-19, with git access on `vendor` granted for read + fetch):**

| Question | Answer | How it was established |
|---|---|---|
| Is the code on the release branch? | **Yes.** `release/version-0.55.1` = `40dae40`, local = remote, contains `b3ac33d` | `merge-base --is-ancestor`; file contents read from `origin/…` |
| Does it build? | **Yes** — `npm run build` at `40dae40` exits 0 | local production build (dev server alone had not proven this) |
| What is staging serving? | A **0.55.x build from before `b3ac33d`**: the 0.55 kiosk text is present, `referral-code` is absent. Vercel deployment **`dpl_h83Qk38ib1Jzh6G1XRdRZWSpsPeR`** | fingerprinting 17 served scripts; the `?dpl=` id Vercel appends to static files |

So the push of `40dae40` did not become the live deployment. `40dae40` ("Deploying
referral stuff") is an **empty commit** — no file changes — which matters if the Vercel
project has an *Ignored Build Step* that diffs `HEAD^..HEAD`: that sees nothing and
skips the build. Other possibilities: the deployment went to a preview URL because
`staging-vendor.ezzy.ph` is bound to a different branch, or it errored on Vercel. All three
are visible only in Vercel. The fix is a deploy action, not a code change.

**Narrowed further (2026-09-19) — the empty-commit theory was WRONG.** The user then
pushed two real version bumps (`e54b561` 0.55.2, `4abf681` 0.55.3, both changing
`package.json`) and Vercel still produced no deployment. A diff-based skip rule would
have let those through, so the cause is upstream of the build.

Eliminated: the pushes reached GitHub (all three on `origin/release/version-0.55.1`); the
code builds; the commit author is identical (`thumbtapers@gmail.com`) on the commits that
deployed and the ones that did not, so it is not Vercel's non-member-author block. GitHub's
own deployment records could not be read — the repo is private, `gh` is not installed.

**Most likely cause — the staging project deploys from a branch that no longer exists.**
`0799dc3` ("Merge branch 'release/version-0.55.0'") has `95d0aa9` as its second parent, so
`release/version-0.55.0` ended at **`95d0aa9`** — which is exactly what staging serves
(0.55 kiosk text present, `referral-code` absent). That branch was then finished and
**deleted from origin**. A Vercel project whose production branch is
`release/version-0.55.0` would behave exactly like this: nothing ever pushes to it again,
and pushes to `release/version-0.55.1` do not reach the staging domain. The branch names
`release/staging-0.32.1` ("Deploying staging vendor") and the "deploying version …"
commits point to a per-release branch convention, which makes this likely rather than
certain. It is confirmed or refuted in one place: the staging vendor project's
**Production Branch** setting in Vercel.

**❌ RETRACTED (same day) — the deleted-branch theory is wrong too.** The Vercel vendor
project's environments (screenshot from the user): **Production** tracks branch
`production` → `vendor.ezzy.ph`; a custom **staging** environment tracks the pattern
**`release/*`** → `staging-vendor.ezzy.ph`; Preview takes all other branches. So staging is
bound to a pattern, not to the deleted `release/version-0.55.0`, and
`release/version-0.55.1` matches it. The `95d0aa9` match stands (it is still what staging
serves), but it no longer explains *why* later pushes do not deploy. Two theories have now
been ruled out by evidence; the next step is the Deployments list, not another theory.

**RESOLVED on staging (2026-09-19) — verified, cause unknown.** After the user promoted a
deployment (see K12), a probe showed `staging-vendor.ezzy.ph` serving
**`dpl_5oPYEi3Ft8BrPkBYF6xBDHkSG7zD`** — the Staging deployment of `40dae40` that the Vercel
list shows as Ready — with `?ref=` opening signup, the hidden input carrying the code,
`referral-code` in the served scripts, and the bundle and CSP pointing at the **staging**
project. Why the domain served the older `dpl_h83Qk38…` earlier is **not established**;
two theories were retracted, and a third is not offered. Still open and minor: the two
version-bump pushes (`e54b561`, `4abf681`) do not appear as deployments at all —
**confirmed** by the Deployments list filtered to `release/version-0.55.1`, which holds only the
`40dae40` Staging deployment and the production rebuild. The code in
them is identical to `40dae40` apart from the version number, so this does not block
anything, but the next push to a `release/*` branch should be checked to see whether it
deploys on its own.

**Side observation for the production deploy:** `origin/master` is still at `2c1359f`
(0.54.1). The 0.55.0 finish-merge `0799dc3` was never pushed to master, so whatever
production builds from will need the release actually merged and pushed.

**When retesting:** vendor is a PWA, so the tester's own browser can keep serving the
old build from its service worker after a correct redeploy. Retest in a private window or
after clearing the service worker, or a good deploy will look broken.

**Fix:** get `b3ac33d` into vendor's deploy branch and redeploy staging, then production.
**Verify** by re-running the same probe: the hidden input must read the code.

**Exposure: none.** (Corrected — the first version assumed production was deployed.)
Production Command has no affiliate UI yet, so no real affiliate code can exist there and
no real attribution can have been lost. On staging only the test signup is affected, and
it can be backfilled by hand. Keep the order for production: vendor and Command deployed
together, after staging passes.

### K14 — staging Command showed "Referred vendors: 0" while the row existed (2026-09-19)  ✅ ROOT-CAUSED → K15

**Symptom:** after "Dance" was credited to `TESTREF` (K13 — row confirmed by staging SQL,
`affiliate_user_id = b427e8fc-5733-4115-a55a-3fcb7cd00603`) and then activated, REF one's
detail view on staging Command still shows **Referred vendors 0** with the empty-state
text. The share link **does** render — and it only comes from `GET /api/affiliates` — so
that request succeeded and returned `referrals: []` without an error.

**Reproduced locally — the code is correct.** Logged into local Command as an admin in a
real browser, opened Nina: panel shows **2**, and the captured `GET /api/affiliates`
response lists both vendors (Tig, Citywide Sports Center). The handler reads
`vendor_referrals` by `affiliate_user_id` with no vendor-status filter.

**So the fault is specific to staging.** Candidates, each with the evidence that would
decide it: (1) staging Command serving an older build — deploys were slow today, as K11
showed for vendor; (2) the response cached between Vercel and the browser — an
`x-vercel-cache: HIT` header, or a payload older than the Dance signup; (3) the panel not
refetching — clears on a full reload. Next.js fetch caching was checked and ruled out as a
likely cause: Command is Next 16.2.4 with no `cacheComponents`/`fetchCache` config, and
the handler is dynamic (it reads cookies). **Root cause found (same day): Command's service worker.** A hard reload showed the
correct count (1). A hard reload bypasses the service worker, and `command/public/sw.js`
serves **every** same-origin non-navigation GET cache-first — including
`/api/affiliates?userId=…`. The panel's first load (before Dance existed) was cached and
replayed on every later open. The hard reload's fresh response was never stored, so the
stale 0 is likely to **come back on the next normal load**. Not a data or code fault in this
feature — see K15, which is the real finding.

---

### K18 — why the vendor promote did not go live at first  ✅ resolved (2026-09-19)

After the K12 rollback, Vercel stopped assigning `vendor.ezzy.ph` to new production
deployments. The first production builds from the user's promote and redeploy therefore came
out **"Production · Staged"**: built, but with only `*.vercel.app` domains attached — and
probes kept showing the rolled-back `dpl_ETomWCbSx…` live. Using **Promote** on the staged
`e54b561` deployment attached the domain. Lesson: after an Instant Rollback, *Redeploy*
produces another staged build; only *Promote* puts one live.

**Production probe after the promote (read-only, nothing submitted):**

| Check | Result |
|---|---|
| `vendor.ezzy.ph` deployment | `dpl_8zXk851y8io78zkjHM7eC7ELDQJx` |
| `/?ref=PROBE0000` | opens signup; hidden input `PROBE0000`; `referral-code` served; param gone from the URL |
| `/?division=ezzy-well&ref=nina-2026` (the WordPress plugin's link shape) | EzzyWell selected; code normalised to `NINA2026` |
| `/` with no parameter | login screen untouched |
| Database | **production** (bundle + CSP) |
| `command.ezzy.ph` | `sw.js` = `offline-v2` + `/_next/static/` guard; **production** DB |

---

### K17 — ⚠️ production is now ahead of its branches — sync them (2026-09-19)  ✅ DONE by the user

Both apps reached production by **Promote**, not by pushing the `production` branch. Each
Vercel project's Production environment tracks `production` — for vendor that branch is still
at **0.52.0** (`0ca90e0`). So git no longer describes what is live, and **the next push to a
`production` branch rebuilds from it and silently replaces the promoted build.**

For **Command** that is worse than a feature regression: its `production` branch predates the
K15 fix, so a push there would **put the vulnerable service worker back in production** —
caching decrypted payout details again and bypassing the view audit.

**Fix:** merge the released code into each app's `production` branch (and `master`, per your
release flow) and push, so the branch matches what is live. Until then, treat a push to
either `production` branch as a rollback.

**✅ Done (2026-09-19), on the user's report** — both `production` branches synced to what is
deployed. Not verified by me: the user handles git. The one property worth confirming is that
Command's `production` branch has `public/sw.js` at `offline-v2`, since that is what keeps the
K15 fix from being undone by a future push.

---

### K16 — ⚠️ my verification changed local data it could not revert (2026-09-19)  ⏸ PARKED

While testing D15/K15 against the local database, a harness set the local test vendor
**Tig** from `pending_activation` to `active`, intending to set it back. It could not:
`validate_vendor_status_transition()` allows only pending→active/suspended,
active→suspended and suspended→active — **there is no path back to pending**. The harness
aborted on the failed restore, so that first attempt produced no test result.

**Left behind (local only — staging and production untouched):** Tig is `active`, and one
`vendor_status_log` row records it (`2026-09-18 23:38:04 UTC`, pending→active,
`changed_by` null). The K15 check was then redone with a trigger-free, fully reverted lever
(a temporary `vendor_referrals` row).

**⏸ PARKED (2026-09-19) — user's decision: leave it.** Local data only, with no effect on
staging or production; the user will `supabase db reset` when they need a clean local database,
which removes it. Nothing further to do here.
**Options, not taken without the user's say:** (1) leave it — local test data, harmless;
(2) restore exactly: bypass the trigger for one statement and delete that log row, which
means overriding a guard and deleting audit data, even locally; (3) `supabase db reset` —
also removes Tig and every other hand-made local record. **Lesson recorded:** check a
table's triggers before a test mutates it, and prefer a lever that has none.

---

### K15 — ⛔ SECURITY: Command's service worker caches API responses, including decrypted bank details  ✅ FIXED 2026-09-19 (approved)

**Pre-existing — not introduced by this plan — and live in production since 2026-08-18.**
Found while root-causing K14.

`command/public/sw.js:44-60` is commented *"Cache-first for same-origin static assets
(JS/CSS/images/fonts) only"* — but the code never checks for a static asset. Every
same-origin GET that is not a page navigation is served from Cache Storage if present,
and stored there on first fetch, with no expiry. Command has four GET API routes, and all
four are affected: `/api/affiliates`, `/api/vendor-payout`, `/api/account-deletion`,
`/api/notification-health`.

The serious one is **`/api/vendor-payout`**, which returns **decrypted payout details —
account name and full account number** (`route.ts:~150-160`). Because the service worker
caches it:

1. **Decrypted bank details persist at rest** in the admin's browser (Cache Storage,
   `offline-v1`), indefinitely, surviving sign-out — readable by anyone with that browser
   profile.
2. **The audit trail is bypassed.** The route deliberately refuses to return details
   unless the view is written to `vendor_payout_view_log` (`route.ts:122`). A re-view
   served from cache never reaches the server, so it is **never logged** — the log
   undercounts exactly the access it exists to record.
3. **Stale data:** changed payout details, a resolved closure, or a new referral keep
   showing their first-seen values (K14 was this).

**Scope in the other apps:** `vendor/public/sw.js:50` already does it right —
`if (!url.pathname.startsWith("/_next/static/")) return` before its cache-first block.
`booker/public/sw.js` has Command's flaw, but booker has **no** GET API routes, so nothing
sensitive is exposed there today (latent only).

**Proposed fix — Command only, two lines, following vendor's existing pattern:**
- add `if (!url.pathname.startsWith("/_next/static/")) return` before the cache-first
  block, so `/api/*` always goes to the network;
- bump `OFFLINE_CACHE` from `"offline-v1"` to `"offline-v2"`. The activate handler already
  deletes every cache whose name is not current (`sw.js:22-24`), so this **purges the API
  responses — decrypted account numbers included — already sitting on admins' devices**.
  Without the bump, the fix stops new caching but leaves the old copies in place.

Approval gate: security-related change (AGENTS.md). Booker's latent copy of the flaw is
recorded, not fixed — different app, nothing exposed.

**✅ Fixed and verified (2026-09-19), approved by the user.** Staging: deployed, and the user
confirmed counts update without a hard reload. **Production: LIVE and verified** — probe of
`https://command.ezzy.ph/sw.js` shows `offline-v2` and the `/_next/static/` guard, and the
page's CSP points at the production project. Each admin's next visit activates the new worker,
which deletes `offline-v1` and the payout details cached in it. ⚠️ See K17: a push to Command's
`production` branch would currently bring the vulnerable worker back. `command/public/sw.js`: the
`/_next/static/`-only guard added (vendor's exact line and reasoning, including the RSC
`?_rsc=` payloads vendor's plan I3 found), and `OFFLINE_CACHE` bumped to `offline-v2`.

Verified in a real browser against local Command, with the page confirmed to be controlled
by the service worker, **against both versions of `sw.js`** so the test is known to detect
the bug: open Nina's panel → add a referral row directly in the DB → reopen the panel
normally (no reload).

| `sw.js` | cache | 2nd open | `/api/` entries in Cache Storage |
|---|---|---|---|
| old | `offline-v1` | **2 → 2, stale** — reproduces K14 exactly | **1** |
| fixed | `offline-v2` | **2 → 3, fresh** | **0** |

The temporary referral row was deleted in a `finally` block and confirmed gone.
Machine-verified alongside: 136 tests pass, `tsc` clean, lint unchanged at the 25-problem
baseline, `npm run build` exit 0. **On deploy**, the new worker installs on each admin's next
visit (`skipWaiting` + `clients.claim` are already in place), and its `activate` deletes
`offline-v1` — including any decrypted payout details cached there.

---

### K13 — ✅ staging end-to-end verified with a real signup (2026-09-19)

With staging on the referral build (deployment from `e54b561`, the 0.55.2 bump — code
identical to `40dae40`), the user signed up through
`https://staging-vendor.ezzy.ph/?division=ezzyWell&ref=TESTREF`. Staging SQL (user-run):

- **Query 1** — affiliate `TESTREF` ("REF one"), status **`active`**, **`referrals: 1`**.
- **Query 2** — vendor **"Dance"**, created 23:07 UTC, `pending_activation`, **credited
  `TESTREF`**, registered by a real self-signup user. Not a backfill: the backfill targets
  (the two earlier failed attempts) remain uncredited.

This is the full chain on a hosted environment: link → capture at module load → form →
submit → server resolve → `vendor_referrals` row. It also confirms, on real data, that a
referral is **credited at signup while the vendor is still pending** — the count does not
wait for activation.

**Not a defect, but worth knowing:** "Vendor from REF 1" and "Vendor + Ref 2" have **no
vendor-admin at all** (`registered_by` null). A self-signup always creates one, so these
were most likely created from Command's Vendors page (or later closed, which removes
members). Command-created vendors cannot carry a referral — out of scope for this plan.

**The Command "0" the user saw** was a stale view: the Affiliate panel fetches when the
detail view opens, and the database already held the row.

**D15 — what "Referred vendors" counts → (c) only ACTIVATED vendors** (resolved
2026-09-19). Implemented as a **display rule only**:
- `GET /api/affiliates` now returns every referral **with its vendor's status**, still
  unfiltered — the Affiliate modal's "Remove" guard must see pending referrals too, since a
  pending signup is still a record that must not be orphaned;
- `command/lib/affiliateReferrals.ts` holds the rule (`vendorStatus === "active"`), with
  8 tests including "a fresh pending-only affiliate shows 0 activated";
- the panel reads **"Referred vendors (activated)"** and lists only activated vendors.
- **Judgement call, flagged to the user:** when the activated count is 0 but some vendors
  did sign up, the empty state says so ("N signed up through this code but aren't active")
  instead of the old text, which would have been false and sent an admin hunting for a
  broken link. Not counted, not listed.
- Unchanged: the vendor app (the row is still written at signup) and the CSV export, which
  already labels both numbers.
Browser check: the panel renders the new label and count correctly. The *exclusion* of a
pending vendor could not be shown in the browser locally afterwards — see K16 — so it rests
on the unit tests.

### K12 — ⚠️ production vendor was promoted ahead of plan (2026-09-19)  ⬜ decision needed

To check the staging build for errors, the user clicked **Promote** on it. In Vercel,
Promote goes to **Production**: the list shows *"Production rebuild of 5oPYEi3Ft"*, and a
probe confirms `vendor.ezzy.ph` now serves **`dpl_5YsAmoV671Rumhd7CJZ1UL9z3PDN`** — the
referral build (`40dae40`, the 0.55.x line).

**What is fine — verified:**
- It is a *rebuild* with production settings: bundle and CSP point at the **production**
  project `pdkejyjidrfxksaczvfy`, not staging. No crossover of the 2026-08-10 kind.
- It works against production: the migration is already there (S4.1), so the register
  route's lookup finds the tables. Production Command is not deployed, so no production
  affiliate code can exist yet — every `?ref=` resolves to nothing and signups proceed
  unattributed, as designed. Nothing breaks, and nothing is lost.

**What is not fine:**
- **Production is now ahead of its branch.** The Production environment tracks the
  `production` branch, which is still at **0.52.0** (`0ca90e0`). The next push to
  `production` rebuilds from there and silently takes `vendor.ezzy.ph` back to 0.52.0 —
  dropping referral capture and every 0.53–0.55 change with it. Git no longer describes
  what is live.
- **It shipped more than referrals.** `40dae40` carries the whole 0.55.x line (the kiosk
  work included). Whether that was already approved for production is the user's call.
- Production vendor is now ahead of production Command — harmless, per the above.

**Decision (2026-09-19): ROLL BACK.** Vercel **Instant Rollback** to the production
deployment that was live before the rebuild, finish the staging signup test, then release
vendor + Command to production together through the `production` branch, as the plan
always intended. Rejected: keeping it and syncing the branch — it would have shipped the
whole 0.55.x line to production before staging had passed its end-to-end test.
⚠️ After an Instant Rollback, Vercel **stops auto-assigning the production domain** to new
production deployments until one is promoted (or the rollback is undone). The eventual
production release must therefore be **promoted**, or `vendor.ezzy.ph` will keep serving
the rolled-back build while the new one sits ready and unused — the same symptom K11 had
on staging.
**✅ Rolled back and verified (2026-09-19).** Probe of `vendor.ezzy.ph`: deployment
`dpl_ETomWCbSxmtaVMyUYTESxQNhPaX4`, `?ref=` does not open signup, no `referral-code` in the
12 served scripts, CSP/bundle on the **production** project. Staging in the same probe:
still the referral build and still the staging DB — but on a **new** deployment,
`dpl_9NgwVVEq7j7xMvoJCaVwY7QtmgYb`, with **no new commit** on any branch. So something on
the Vercel side changed staging's live deployment. Which commit that deployment is built
from would tell whether a version-bump push finally built late (relevant to the open
"bumps never deployed" question in K11).

### K10 — the WordPress partner-routing plan is now UNBLOCKED  ✖ OUT OF SCOPE (2026-09-19)

> **Descoped by the user on 2026-09-19:** "We don't have to handle the WordPress related thing
> right now." Kept as a record, not deleted. The vendor side it depends on **is** live and
> verified: a production probe of `/?division=ezzy-well&ref=nina-2026` — the exact shape the
> plugin emits — selected the division and captured `NINA2026` (K18). What remains belongs to
> `.plans/2026-09-17-wordpress-partner-routing-referral-code.md` (its V5), not to this plan.

`.plans/2026-09-17-wordpress-partner-routing-referral-code.md` is a companion to this
plan: the `ezzy.ph` plugin captures a referral code and appends `&ref=CODE` to the
vendor-signup link it builds. Its final check, **V5 — an actual `vendor_referrals` row**,
was recorded as *"blocked on affiliate-interim S3/B14, which is unstarted"*. S3 is now
complete, and the parameter matches: the plugin emits `ref=`, this plan captures `ref`,
and `referral-deeplink.spec.ts` already covers the `?division=…&ref=…` combination the
plugin produces. **V5 can be run once staging has this migration and vendor deploy** —
an `ezzy.ph` link through to a signup, then the export query. That plan's own "blocked"
line was left untouched; it belongs to that plan's owner to update.

### K9 — "not in a useState initialiser" needed a clarification  ✅ docs

`conventions.md` said an arrival parameter must not be read "in a `useState`
initialiser" — which K6 appears to contradict. It does not: the rule is about reading
`window.location`, and K6's initialiser applies a value **already captured at module
load**. The doc now separates the two steps explicitly, so the next reader does not
"fix" K6 back into an effect.

### K8 — B17 was mutation-tested, not just run  ✅ verified

A regression spec that has only ever passed proves little, so the mechanism was broken on
purpose and the spec run against it:

| Mutation | Tests that failed | Should they? |
|---|---|---|
| Read `?ref=` inside the hook, not at module load — **the eleven-day `?division=` bug** | 5 of 8 | Yes. The 3 that passed are the no-op, no-param and draft-only cases, which must not depend on capture |
| Let the saved draft beat the URL — undoing K6 | 1 of 8 | Yes — exactly the test written for it |

The file was restored from a copy and diffed byte-identical afterwards.

### K6 — the deep link applies through initialisers, not an effect  ✅ changed in code

B15 first did what the plan described: an effect that sets the code, switches to the
registration view, and relies on **being declared after the draft-restore effect** so the
URL wins. It worked, and `npm run lint` flagged exactly one new error —
*"Calling setState synchronously within an effect"* — taking the file from 34 problems to
35.

Rewritten to seed `loginView` and `regForm` from **lazy initialisers**, following
`loginError` a few lines below, which already reads a module-load value
(`getAuthUrlError()`) that way. Three things improved, not just the lint count:

- the form never renders a frame without the code;
- no setState inside an effect (back to the 34-problem baseline, no new errors);
- **URL-beats-draft became explicit** — the draft restore now keeps whatever the URL
  supplied (`f.referralCode || (draft.referralCode ?? "")`) instead of depending on which
  effect happens to be declared first. The original plan called that ordering
  "guaranteed"; it was, but it was also a tripwire for anyone reordering two effects.

The remaining one-shot `consumeDeepLinkReferral()` effect sets no state, so it stays a
plain synchronisation effect.

### K5 — storage rows cannot be deleted with SQL  ✅ worked around (no code change)

Cleaning up test data, `delete from storage.objects` was refused by
`storage.protect_delete()`: *"Direct deletion from storage tables is not allowed. Use the
Storage API instead."* A good guard — it prevents orphaned bytes — but worth knowing
because the refusal **aborted the whole multi-statement psql call**, so the vendor and
user deletes in the same command silently did not run either. Files must go through the
Storage API (`DELETE /storage/v1/object/<bucket>` with `{prefixes:[…]}`), and row deletes
belong in their own statement. Relevant to any future cleanup or data-fix script.

### K4 — sibling imports in `vendor/lib` carry the `.ts` extension  ✅ fixed in code

`vendor/lib/referralLookup.ts` first imported `./referralCode` extensionless. That
type-checks and builds — Next resolves it — but this codebase writes sibling imports
**with** the extension (`financials.ts:29`, `kioskAvailability.ts:1-4`), which is exactly
why `tsconfig.json` sets `allowImportingTsExtensions: true`: it lets a module be loaded
directly by `node --test` or a plain Node script, with no bundler. The extensionless form
silently gives that up. Caught because the live harness could not load it; corrected to
`./referralCode.ts`.

### K3 — two design corrections made while building  ✅ resolved in code

- **`AffiliateReferralsPanel` → `AffiliatePanel`.** The plan had the panel rendering only
  the referred-vendors list, with B21 putting the share link in the Account Details rows.
  Both need the same `GET /api/affiliates` response, and splitting them meant either two
  fetches or threading the result through `UserModal`. One component now owns the fetch
  and renders code, link, count and list as a single "Affiliate" section; B21's badge
  stays in the badge row, where it needs no fetch at all because the list already carries
  the code.
- **The referral count moved into `useAffiliateModal`.** The first pass had the panel
  reporting its count upward through an `onCount` callback — which fires *during render*,
  a side effect in the render path. The modal now fetches its own count, and tracks
  `null` (unknown) separately from `0` so "Remove" is not offered before the answer is
  known.

### K7 — the hidden input lives on every registration step, not just step 1  ✅ changed in code

The plan put B16's hidden input on step 1. But a vendor resuming a saved draft is sent
straight to the step they reached (`goRegister` → `computeResumeStep`), so the input would
be absent on exactly the path B17's "draft restored" test needs to observe — and absent
for any support engineer looking at a half-finished application. It now renders once at
the top of the registration view, so it is present on all six steps. Still invisible, still
`readOnly`, still not submitted by the form — the hook sends the value itself.

### K11 — ⛔ the deployed vendor app does not contain the referral feature (2026-09-19)

**Symptom (reported):** on staging, an affiliate created in Command with code `TESTREF`
got no credit for a signup through
`https://staging-vendor.ezzy.ph/?division=ezzyWell&ref=TESTREF`.

**Diagnosis — read-only headless probes of the live sites, nothing submitted:**

| | Staging (your URL) | Production (`/?ref=PROBE0000`) |
|---|---|---|
| Registration opens | yes — but via `?division=`, which is **old** code | **no** — new code opens it for `?ref=` alone |
| Hidden `referral-code` input (B16) | **absent** | **absent** |
| `referral-code` in any loaded script | **no** (14 scripts) | **no** (13 scripts) |

The signup page's own code was loaded (registration rendered), so a deployed B16 would
have shown up. **Staging vendor predates this feature**: the browser never captured
`?ref=`, never sent it, and the register route had nothing to record. The affiliate, the
code and the database are not the problem. Command *was* deployed with the feature
(staging can create affiliates), so this is vendor-specific.

⚠️ **Correction (same day): the production column is NOT a fault.** Production had not
been deployed at all yet — the app deploy was staging-only — so it lacking the feature is
expected. Only the **staging** column is a real finding. The probe ran in a fresh
headless context with no service worker, reading scripts straight from the server, so the
staging result is the server's build, not a stale client cache.

**Most likely cause** — one of: (1) the staging deploy covered Command but not vendor;
(2) vendor built from a branch without `feature/referral_codes` (`b3ac33d`) — flagged as
a risk at S4.3; (3) the vendor build failed and the previous one is still live. The
staging vendor deployment's commit in the hosting dashboard settles which.

**When retesting:** vendor is a PWA, so the tester's own browser can keep serving the
old build from its service worker after a correct redeploy. Retest in a private window or
after clearing the service worker, or a good deploy will look broken.

**Fix:** get `b3ac33d` into vendor's deploy branch and redeploy staging, then production.
**Verify** by re-running the same probe: the hidden input must read the code.

**Exposure: none.** (Corrected — the first version assumed production was deployed.)
Production Command has no affiliate UI yet, so no real affiliate code can exist there and
no real attribution can have been lost. On staging only the test signup is affected, and
it can be backfilled by hand. Keep the order for production: vendor and Command deployed
together, after staging passes.

### K10 — the WordPress partner-routing plan is now UNBLOCKED  ⬜ yours to verify

`.plans/2026-09-17-wordpress-partner-routing-referral-code.md` is a companion to this
plan: the `ezzy.ph` plugin captures a referral code and appends `&ref=CODE` to the
vendor-signup link it builds. Its final check, **V5 — an actual `vendor_referrals` row**,
was recorded as *"blocked on affiliate-interim S3/B14, which is unstarted"*. S3 is now
complete, and the parameter matches: the plugin emits `ref=`, this plan captures `ref`,
and `referral-deeplink.spec.ts` already covers the `?division=…&ref=…` combination the
plugin produces. **V5 can be run once staging has this migration and vendor deploy** —
an `ezzy.ph` link through to a signup, then the export query. That plan's own "blocked"
line was left untouched; it belongs to that plan's owner to update.

### K9 — "not in a useState initialiser" needed a clarification  ✅ docs

`conventions.md` said an arrival parameter must not be read "in a `useState`
initialiser" — which K6 appears to contradict. It does not: the rule is about reading
`window.location`, and K6's initialiser applies a value **already captured at module
load**. The doc now separates the two steps explicitly, so the next reader does not
"fix" K6 back into an effect.

### K8 — B17 was mutation-tested, not just run  ✅ verified

A regression spec that has only ever passed proves little, so the mechanism was broken on
purpose and the spec run against it:

| Mutation | Tests that failed | Should they? |
|---|---|---|
| Read `?ref=` inside the hook, not at module load — **the eleven-day `?division=` bug** | 5 of 8 | Yes. The 3 that passed are the no-op, no-param and draft-only cases, which must not depend on capture |
| Let the saved draft beat the URL — undoing K6 | 1 of 8 | Yes — exactly the test written for it |

The file was restored from a copy and diffed byte-identical afterwards.

### K6 — the deep link applies through initialisers, not an effect  ✅ changed in code

B15 first did what the plan described: an effect that sets the code, switches to the
registration view, and relies on **being declared after the draft-restore effect** so the
URL wins. It worked, and `npm run lint` flagged exactly one new error —
*"Calling setState synchronously within an effect"* — taking the file from 34 problems to
35.

Rewritten to seed `loginView` and `regForm` from **lazy initialisers**, following
`loginError` a few lines below, which already reads a module-load value
(`getAuthUrlError()`) that way. Three things improved, not just the lint count:

- the form never renders a frame without the code;
- no setState inside an effect (back to the 34-problem baseline, no new errors);
- **URL-beats-draft became explicit** — the draft restore now keeps whatever the URL
  supplied (`f.referralCode || (draft.referralCode ?? "")`) instead of depending on which
  effect happens to be declared first. The original plan called that ordering
  "guaranteed"; it was, but it was also a tripwire for anyone reordering two effects.

The remaining one-shot `consumeDeepLinkReferral()` effect sets no state, so it stays a
plain synchronisation effect.

### K5 — storage rows cannot be deleted with SQL  ✅ worked around (no code change)

Cleaning up test data, `delete from storage.objects` was refused by
`storage.protect_delete()`: *"Direct deletion from storage tables is not allowed. Use the
Storage API instead."* A good guard — it prevents orphaned bytes — but worth knowing
because the refusal **aborted the whole multi-statement psql call**, so the vendor and
user deletes in the same command silently did not run either. Files must go through the
Storage API (`DELETE /storage/v1/object/<bucket>` with `{prefixes:[…]}`), and row deletes
belong in their own statement. Relevant to any future cleanup or data-fix script.

### K4 — sibling imports in `vendor/lib` carry the `.ts` extension  ✅ fixed in code

`vendor/lib/referralLookup.ts` first imported `./referralCode` extensionless. That
type-checks and builds — Next resolves it — but this codebase writes sibling imports
**with** the extension (`financials.ts:29`, `kioskAvailability.ts:1-4`), which is exactly
why `tsconfig.json` sets `allowImportingTsExtensions: true`: it lets a module be loaded
directly by `node --test` or a plain Node script, with no bundler. The extensionless form
silently gives that up. Caught because the live harness could not load it; corrected to
`./referralCode.ts`.

### K3 — two design corrections made while building  ✅ resolved in code

- **`AffiliateReferralsPanel` → `AffiliatePanel`.** The plan split the share link (B21,
  in the Account Details rows) from the referred-vendors list (B20, its own panel), but
  both need the same `GET /api/affiliates` response — splitting them meant two fetches or
  threading the result through `UserModal`. One component now owns the fetch and renders
  code, link, count and list as a single "Affiliate" section. B21's badge stays in the
  badge row and needs no fetch, because the users list already carries the code.
- **The referral count moved into `useAffiliateModal`.** The first pass had the panel
  reporting its count upward through an `onCount` callback fired *during render* — a side
  effect in the render path. The modal now fetches its own count and tracks `null`
  (unknown) separately from `0`, so "Remove" is never offered before the answer is known.

### K2 — `UserFormData.referralCode` is optional, deliberately  ✅ resolved in code

Making it required would have forced every update path that builds a `UserFormData` —
including `toggleStatus`, which only wants to flip a status — to carry a field it does
not own. Optional keeps the create path the only reader, which is what D11 intends.

---

## Gap review #2 (2026-09-18) — after the D11 model change

Re-checked at `file:line`, because a model change is exactly when a plan quietly stops
matching the code. **One blocker, one design improvement, five smaller items, one false
alarm.**

| # | Gap | Severity | Where it landed |
|---|-----|----------|-----------------|
| H1 | **Command has no vendor origin in the browser — the share link cannot be displayed.** `PORTAL_URL_VENDOR` is server-only *by an explicit documented decision* (`command/lib/portalOrigins.server.ts:16-20`: `NEXT_PUBLIC_*` is inlined at build time and needs a cache-disabled redeploy, which burned two deploys on 2026-08-10). Command's only public config is `APP_NAME` / `APP_DOMAIN` (`lib/constants.ts:122-123`). B4 can return the link at *create* time, but B6/B19/B20 promise it for an affiliate viewed **later**, and nothing in the browser can build it. | **BLOCKER** | **D12 (OPEN)** — blocks B19/B20 |
| H2 | `resolvePortalOrigin(["vendor"])` — **verified safe**: it resolves by priority from whatever list it is handed, so passing a literal `["vendor"]` returns the vendor origin no matter which portals the *user* holds, and `[]` returns `not_configured` rather than throwing (`portalOrigins.server.ts:101-117`). No gap; recorded so nobody "fixes" B4 into passing the user's portals. | False alarm | B4 note |
| H3 | **"Affiliates only" filter needs real plumbing**, not a free ride: `useUsers.ts:120` filters on `u.role === usrRole`, and the toolbar builds its options from `ALL_ROLES` (`UserToolbar.tsx:36`). Under D11 affiliates are not a role, so this needs its own state + filter line + prop. | IMPORTANT | B1 |
| H4 | **`liza` in `send-notification-email/handler.test.ts:14` — false alarm.** It is a hard-coded `liza@example.com` literal in a hermetic Deno test, unrelated to the seed. Giving the seeded Liza an affiliate row breaks nothing. | False alarm | — |
| H5 | **The detail view already has the right shape for this** — `UserModal.tsx:82-110` renders a badge row, an "Account Details" list of icon rows, and a "Portal Access" section built from `ALL_PORTALS`. The affiliate surface should reuse all three rather than invent a panel style. | IMPORTANT | B21 |
| H6 | **No per-affiliate totals.** The export SQL returns one row per *vendor*; nothing answers "how many signups did this affiliate bring?" for all affiliates at once, including those with zero. | IMPORTANT | New **Affiliate summary SQL** |
| H7 | **Remove-affiliate has the same silent-link consequence as changing a code** (D2 + D9), and the earlier draft only warned on change. | IMPORTANT | B19 |
| H8 | **Assigning a code to a suspended user attributes nothing**, exactly as G7 noted for creation — but the assign path is new, so it needs the same inline hint. | IMPORTANT | B19 |

Also re-verified after D11: deleting an affiliate who has **no** referrals cascades the
`affiliates` row cleanly through `profiles` and frees the code for reuse; the export SQL
needs no change; and S3 (the whole vendor side) is **untouched by D11**, because
`resolveReferralCode` only ever cared about the table row and the profile status, never
about roles.

---

## Design

### How Affiliate users are represented  (rewritten 2026-09-18 — D11)

**Affiliate is a capability, not a role.** A user is an affiliate if and only if
they have a row in `affiliates`. There is no `affiliate` role, nothing is added to
`profiles`, and a user's role and portals are never changed by becoming one.

Why not a role, given that was the first design: `user_roles` is modelled
one-role-per-user, and portal access is checked *through* the role — the booker
portal requires `member` (Finding 4). Making affiliate a role would therefore force
an existing booker to **surrender the role their access depends on** in order to
hold a referral code. That is not a trade anyone should have to make, and it is
exactly the "assign an existing user" flow this is meant to support.

What follows from the capability model:

- **Any user can be an affiliate**, including one who is also a booker or a vendor
  admin. Their access is unchanged, and the code is orthogonal to it.
- **A person who exists only to be an affiliate** is simply a user with no portals.
  Every portal gate already refuses them (Finding 4) — by the platform's ordinary
  rule, not one invented for affiliates.
- **No new access guards.** `affiliateAccessError` and `affiliateRoleChangeError`
  from the earlier draft are **gone**: with affiliate decoupled from roles and
  portals there is nothing to guard. So is gap G8, which only existed because a
  role switch could strip access. Fewer moving parts than the role design.
- **`profiles.status_id` stays the on/off switch** (D3): suspending the user makes
  the code stop attributing, because the register route requires an active profile.
- **Promotion later is one INSERT** — which is what makes the future Affiliates
  section additive rather than a rework.

### How referral codes are stored and generated

New table **`affiliates`**, one row per Affiliate user. When the affiliate portal
is built, this becomes the affiliate record (and later holds payout details,
commission rate, etc.):

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` PK | FK → `profiles(id)` ON DELETE CASCADE |
| `referral_code` | `text NOT NULL UNIQUE` | `CHECK (referral_code ~ '^[A-Z0-9]{4,32}$')` |
| `created_by` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL. The Command admin who created it |
| `created_at` / `updated_at` | `timestamptz` | `set_updated_at()` trigger, as elsewhere |

- **Typed by the Command admin (D1).** The code is entered in the Add User form
  (optional — filling it makes the new user an affiliate) or in the Affiliate modal
  for an existing user (D11). Memorable codes (`JUAN2026`, `EZZYPH01`) make a
  mistyped link less likely, which matters because D2 means a bad code fails
  silently.
- **Normalising:** input is upper-cased and stripped of everything except letters
  and digits before it is stored or looked up. `juan-2026` and ` JUAN 2026 ` both
  become `JUAN2026`. Same forgiving matching as the `?division=` slug.
- **Format:** 4–32 characters, `A–Z` and `0–9` only, enforced by the check
  constraint and pre-validated in the form so the admin gets a clear message
  rather than a database error.
- **Uniqueness:** the `UNIQUE` constraint is the real rule. The create route
  **checks the code is free before creating the auth user**, so the normal
  duplicate case returns "That referral code is already in use — choose another"
  with nothing created. A `23505` from a race is still handled: the just-created
  auth user is deleted and the same message returned.
- **Editable after creation (D9, 2026-09-18)** through a dedicated action, not the
  main edit form — see B18/B19. `vendor_referrals` snapshots the code used, so past
  attributions keep reading correctly under the code the vendor actually typed.
  ⚠️ **Changing a code silently retires every link already in circulation**: an old
  `?ref=` stops attributing and, under D2, says nothing to anyone. The change dialog
  must say so before saving.

### How the vendor-to-affiliate relationship is stored

New table **`vendor_referrals`**, one row per referred vendor:

| Column | Type | Notes |
|---|---|---|
| `vendor_id` | `uuid` PK | FK → `vendors(id)` ON DELETE CASCADE. PK = a vendor has at most one referrer |
| `affiliate_user_id` | `uuid` (nullable) | FK → `affiliates(user_id)` **ON DELETE SET NULL** (D14/J1) · indexed. NULL = the affiliate's account was deleted; `referral_code` still names who referred the vendor |
| `referral_code` | `text NOT NULL` | The code as used, normalised. Stored separately so history survives if codes are rotated or split out later |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Time of attribution (= signup) |

It answers every required question: which affiliate (`affiliate_user_id`),
which vendors (`WHERE affiliate_user_id = …`), which code (`referral_code`),
when (`vendors.created_at` / `created_at`), and the primary user (Finding 9).

**A row is written only when the code resolves.** No code, an unknown code, a
suspended affiliate, or a failed lookup all produce the same result: no row,
and registration continues (D2).

### RLS and grants (per `20260620000001_api_role_grants.sql` and the AGENTS.md invariant)

| Table | RLS | `authenticated` grant | `service_role` |
|---|---|---|---|
| `affiliates` | SELECT: Command admin/root (`is_portal_member('command') and (has_role('admin') or has_role('root'))`) | `select` | `select, insert, update, delete` |
| `vendor_referrals` | SELECT: same Command admin/root policy | `select` | `select, insert, update, delete` |

- **No `authenticated` write path on either table.** Codes and attribution are
  written only by service-role routes. Nobody can grant themselves a referral
  from the browser.
- `anon`: no grants.
- Neither table is append-only (ops may need to fix a wrong attribution), so the
  `revoke all … from service_role` pattern from `20260911000003` does not apply.
- Affiliates reading their own rows is **left out on purpose**. It arrives with
  the affiliate portal.

---

## Referral URL

**Sample URLs** (hosts from `command/README.md` → "The `PORTAL_URL_*` trio"):

| Environment | URL |
|---|---|
| Production | `https://vendor.ezzy.ph/?ref=JUAN2026` |
| Staging | `https://staging-vendor.ezzy.ph/?ref=JUAN2026` |
| Local | `http://localhost:3001/?ref=JUAN2026` |
| With a division (both apply) | `https://vendor.ezzy.ph/?division=ezzy-drive&ref=JUAN2026` |

**How it behaves** (a copy of the `?division=` mechanism, Finding 1):

- `vendor/lib/referralDeepLink.ts` reads `ref` **when the module loads** (Finding 2),
  normalises it, and exposes `peekDeepLinkReferral()` / `consumeDeepLinkReferral()`.
  One-shot, so signing out doesn't reopen registration.
- If present on the plain sign-in view, registration opens at step 1 and the code
  is held in wizard state. Recovery and vendor-picker sessions ignore it, exactly
  as they ignore `division`.
- **Hidden (D4).** No field is added to any step, and nothing is shown on the
  review screen. `LoginPage.tsx` is untouched, so there is **no visual change and
  no Playwright baseline to regenerate**.
- The code is saved in the existing `localStorage` draft, so a vendor who opens
  the link and finishes the next day still gets credited (7-day draft TTL). A code
  arriving in the URL beats one restored from the draft.
- The URL value is never trusted: the **register route is the only thing that
  decides** whether a referral is real, by looking up the code and requiring the
  affiliate's profile to be active.
- **Not built:** cookies or cross-visit attribution, click tracking, per-campaign
  codes, short links.

---

## Stages and items

### S1 — Migration  ✅ DONE (2026-09-18, local)  ·  🔒 approval gate (schema + RLS)

**File (new):** `backbone/supabase/migrations/20260917000001_affiliates_and_vendor_referrals.sql`
✅ **written 2026-09-17.** The DDL below is what shipped; the file additionally carries a
header comment explaining the design. Per standing rule, **you** apply migrations.

```sql
-- Interim affiliate referrals: one referral code per affiliate user, and
-- vendor → affiliate attribution captured at self-registration. Affiliate is a
-- CAPABILITY (a row in `affiliates`), not a role — see D11.
-- See .plans/2026-09-17-affiliate-referral-codes-interim.md.

-- (No role is inserted — D11: affiliate is a capability, not a role. The file's
--  header comment carries the full reasoning.)

-- ── affiliates ───────────────────────────────────────────────────────────────
create table public.affiliates (
  user_id       uuid        primary key references public.profiles (id) on delete cascade,
  referral_code text        not null unique
                            constraint affiliates_referral_code_format
                            check (referral_code ~ '^[A-Z0-9]{4,32}$'),
  created_by    uuid        references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  public.affiliates is
  'One row per affiliate user — membership of THIS TABLE is what makes someone an affiliate; there is no affiliate role. Any user may be given a row without changing their role or portals.';
comment on column public.affiliates.referral_code is
  'Upper-case A-Z0-9, 4-32 chars. Stored normalised, so the unique index is effectively case-insensitive.';

create trigger set_affiliates_updated_at
  before update on public.affiliates
  for each row execute function public.set_updated_at();

alter table public.affiliates enable row level security;

create policy "command admin or root can read affiliates"
  on public.affiliates for select
  to authenticated
  using (
    public.is_portal_member('command')
    and (public.has_role('admin') or public.has_role('root'))
  );

grant select                         on public.affiliates to authenticated;
grant select, insert, update, delete on public.affiliates to service_role;

-- ── vendor_referrals ─────────────────────────────────────────────────────────
create table public.vendor_referrals (
  vendor_id         uuid        primary key references public.vendors (id) on delete cascade,
  -- RESTRICT: an affiliate with attributed vendors cannot be hard-deleted; the
  -- command DELETE route checks first and tells the operator to suspend instead.
  affiliate_user_id uuid        not null references public.affiliates (user_id) on delete restrict,
  referral_code     text        not null,
  created_at        timestamptz not null default now()
);

comment on table public.vendor_referrals is
  'Which affiliate referred a self-registered vendor. Written only by vendor /api/auth/register (service role), and only when the ?ref= code resolves to an ACTIVE affiliate.';
comment on column public.vendor_referrals.referral_code is
  'The code as used at signup (normalised) — a snapshot, kept even if the affiliate''s code later changes.';

create index vendor_referrals_affiliate_user_id_idx
  on public.vendor_referrals (affiliate_user_id);

alter table public.vendor_referrals enable row level security;

create policy "command admin or root can read vendor referrals"
  on public.vendor_referrals for select
  to authenticated
  using (
    public.is_portal_member('command')
    and (public.has_role('admin') or public.has_role('root'))
  );

grant select                         on public.vendor_referrals to authenticated;
grant select, insert, update, delete on public.vendor_referrals to service_role;
```

**Blast radius**
- **Data:** no existing rows are rewritten or checked. One `roles` row is added.
  Its id will be 5 on a clean chain, but code **always looks roles up by name**,
  never by id (as the register route already does).
- **Locks:** the FKs to `vendors` and `profiles` take a brief
  `SHARE ROW EXCLUSIVE` lock on each. Both tables are small; milliseconds.
- **Downstream:** hand-written types in `command/lib/types.ts`. The `vendor` app
  writes `vendor_referrals` but never reads it, so it needs no new interface.
  Also `architecture/schema.md` and `auth-and-roles.md`.
- **Chain effect (revised 2026-09-18, D14):** deleting a user cascades to `profiles`
  and `affiliates`, and `vendor_referrals.affiliate_user_id` is then **set to NULL** —
  the referral survives, the delete succeeds, and account closure cannot half-fail (J1).
  Careless admin deletion is stopped one layer up by B5's route check, not by the FK.
- **Reversible:** yes — see the section below for the exact undo and its two caveats.

#### Reversibility (asked 2026-09-17)

This repo has **no `down` migrations** — migration files are forward-only and are
never edited after being applied. "Reversible" here means: a second migration puts
the database back the way it was, and nothing in the first one is one-way.

```sql
-- Undo migration (write as a NEW file; never edit the applied one).
drop table if exists public.vendor_referrals;
drop table if exists public.affiliates;
```

⚠️ **Simpler since D11 (2026-09-18):** the migration no longer inserts a role, so the
undo is two DROPs and touches no existing table or row. Caveat 2 below is kept for the
record — it described deleting the role row, which no longer happens.

Two things to know before running it:

1. **Dropping the tables destroys the referral data.** The structure comes back;
   the attribution does not. Before any real referrals exist, the undo is clean.
   Afterwards, dump the two tables first.
2. ~~**`delete from roles` cascades.**~~ ✖ **No longer applies (D11, 2026-09-18)** —
   the migration inserts no role, so the undo touches `roles` not at all. Kept for the
   record, because the reasoning still matters if a role is ever added: `user_roles.role_id`
   is `on delete cascade` (`20260504000002_schema.sql:53`), so deleting a role silently
   removes every assignment of it, and `roles.id` is `generated always as identity`, so a
   re-added role gets a different id and environments can diverge. Harmless in this
   codebase — **no app code anywhere resolves a role by id** (verified by grep across
   command, vendor and booker) — but a trap for hand-written SQL.

Nothing else in the migration is one-way: no column is added to an existing table,
no type is changed, no data is rewritten, and no constraint is applied to existing
rows.

#### Impact on existing production vendors: none (asked 2026-09-17)

Real vendors already signed up in production are untouched, by construction:

- **No existing table is altered.** `vendors`, `profiles`, `user_roles` and
  `vendor_members` keep exactly the columns, constraints and rows they have now.
  The migration only **creates** two empty tables and inserts one lookup row.
- **Nothing is backfilled and nothing is validated against existing rows.** The
  new foreign keys live on the new (empty) tables, so Postgres has no existing
  rows to check. Creating them takes a brief lock on `vendors` and `profiles`
  while the tables are created — milliseconds — and no row scan.
- **Existing vendors simply have no `vendor_referrals` row.** The export query
  inner-joins that table, so they never appear in the referral report. That is the
  intended outcome: past signups carry no referral, and only new ones can.
- **Existing signup behaviour is unchanged.** A registration with no `?ref=` takes
  exactly the path it takes today; the only new work is one extra insert, and only
  when a valid code is present.
- **Nothing existing can gain a referral by accident.** Attribution is written in
  one place — the register route, at the moment the vendor row is created — so
  there is no path that could attach a referral to a vendor that already exists.
  Back-dating an old vendor to an affiliate would be a deliberate manual SQL insert.

**S1.4 — Local seed data** ✅ **DONE (2026-09-17)** ⚠️ **G11** *(same stage, separate file)*:
`backbone/supabase/seed.sql` gains one Affiliate profile + `user_roles` row +
`affiliates` row, and one `vendor_referrals` row against an existing seeded vendor,
so a fresh `db reset` can exercise the export SQL and the Command list. Uses the
existing variable style (never literal role ids). `seed.sql` is local-only and never
runs on a hosted project.

**Verify:** ✅ **Dry run passed (2026-09-18)** — the migration was executed against the
local database inside `begin … rollback`, so it ran for real and persisted nothing
(confirmed afterwards: 0 of the 2 tables exist, migration count still 78). Machine-verified
in that run: every statement parses and applies; both tables, RLS, one policy each;
`anon` holds nothing and `authenticated` holds `SELECT` only; a lower-case code and a
3-character code are rejected by the check constraint; a duplicate code is rejected by
the unique index; **deleting an affiliate nulls the referral and keeps `referral_code`**
(the J1/D14 fix, proven rather than assumed); and a booker's JWT sees 0 rows in both
tables. Still to do on a real apply: `set_updated_at` firing on update, and the seed
block (S1.4), which the dry run did not execute.

#### S1.3 verification script — ✅ **all checks passed on local, 2026-09-18**

> Run against the local database after `db reset`. Results: 8/8 structure checks PASS ·
> lower-case, too-short, duplicate and second-code-per-user all rejected · deleting an
> affiliate nulls the referral and keeps `NINA2026` (J1/D14) · `updated_at` bumps on
> update · booker sees 0/0, Command admin sees 2/1, `authenticated` INSERT denied ·
> seed shows nina (0 portals, 1 referral) and liza (1 portal, 0 referrals) · export and
> summary SQL both return the expected rows, including Liza's zero.


Connect: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"`
(port from `backbone/supabase/config.toml` `[db]`).

**1 — Structure: role, tables, policies, grants.** Every row should read `PASS`.

```sql
select 'both tables exist' as check,
       case when (select count(*) from pg_tables
                  where schemaname = 'public'
                    and tablename in ('affiliates','vendor_referrals')) = 2
            then 'PASS' else 'FAIL' end as result
union all
select 'no affiliate role was created (D11)',
       case when not exists (select 1 from public.roles where name = 'affiliate')
            then 'PASS' else 'FAIL' end
union all
select 'RLS enabled on both',
       case when (select count(*) from pg_class c
                  join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public'
                    and c.relname in ('affiliates','vendor_referrals')
                    and c.relrowsecurity) = 2
            then 'PASS' else 'FAIL' end
union all
select 'one SELECT policy each',
       case when (select count(*) from pg_policies
                  where schemaname = 'public'
                    and tablename in ('affiliates','vendor_referrals')) = 2
            then 'PASS' else 'FAIL' end
union all
-- anon must hold nothing; authenticated must hold SELECT only (never INSERT/UPDATE/
-- DELETE/TRUNCATE) — this is the layer beneath RLS, and it is what stops a browser
-- session writing a referral even if a policy were ever added by mistake.
select 'anon has no privileges',
       case when (select count(*) from information_schema.role_table_grants
                  where table_schema = 'public'
                    and table_name in ('affiliates','vendor_referrals')
                    and grantee = 'anon') = 0
            then 'PASS' else 'FAIL' end
union all
select 'authenticated has SELECT only',
       case when (select count(*) from information_schema.role_table_grants
                  where table_schema = 'public'
                    and table_name in ('affiliates','vendor_referrals')
                    and grantee = 'authenticated'
                    and privilege_type <> 'SELECT') = 0
            then 'PASS' else 'FAIL' end;
```

**2 — Constraints: the code format and uniqueness actually bite.** Each block
should raise the error named in its comment; `rollback` leaves no trace.

```sql
begin;
-- expect: new row violates check constraint "affiliates_referral_code_format"
insert into public.affiliates (user_id, referral_code)
values ('00000000-0000-0000-0000-000000000003', 'lower2026');
rollback;

begin;
-- expect: new row violates check constraint "affiliates_referral_code_format"  (too short)
insert into public.affiliates (user_id, referral_code)
values ('00000000-0000-0000-0000-000000000003', 'AB1');
rollback;

begin;
-- expect: duplicate key value violates unique constraint "affiliates_referral_code_key"
insert into public.affiliates (user_id, referral_code)
values ('00000000-0000-0000-0000-000000000003', 'NINA2026');
rollback;

begin;
-- expect: update or delete on table "affiliates" violates foreign key constraint
--         (D6 — an affiliate with referrals cannot be deleted)
delete from public.affiliates where referral_code = 'NINA2026';
rollback;
```

**3 — RLS: who can actually read it.** `request.jwt.claims` is what the helper
functions read through `auth.uid()`.

```sql
-- A booker (liza) — no command portal. Expect 0 and 0.
begin;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003"}';
  set local role authenticated;
  select count(*) as affiliates_visible_to_booker     from public.affiliates;
  select count(*) as referrals_visible_to_booker      from public.vendor_referrals;
rollback;

-- A command admin (jun). Expect 1 and 1 on seeded data.
begin;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004"}';
  set local role authenticated;
  select count(*) as affiliates_visible_to_command    from public.affiliates;
  select count(*) as referrals_visible_to_command     from public.vendor_referrals;
rollback;

-- No authenticated write path at all. Expect: permission denied for table affiliates.
begin;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004"}';
  set local role authenticated;
  insert into public.affiliates (user_id, referral_code)
  values ('00000000-0000-0000-0000-000000000003', 'HACK2026');
rollback;
```

**4 — Seed + the export query end to end.** Expect exactly one row: Nina
Villanueva / NINA2026 / Citywide Sports Center, with Marco as the primary vendor
user (earliest `vendor_members.granted_at`). Run the **Export SQL** from the
section below as-is.

```sql
-- Both affiliate shapes in one row each — the whole D11 story.
select p.full_name, s.name as status, a.referral_code,
       (select count(*) from public.user_portals up where up.user_id = p.id) as portal_count,
       (select count(*) from public.vendor_referrals vr where vr.affiliate_user_id = p.id) as referrals
from   public.affiliates a
join   public.profiles p on p.id = a.user_id
join   public.statuses s on s.id = p.status_id
order  by p.full_name;
-- expect exactly two rows:
--   Liza Cruz       | active | LIZA2026 | 1 | 0   <- also a booker, keeps her portal
--   Nina Villanueva | active | NINA2026 | 0 | 1   <- affiliate only, no portal = no login
-- The Liza row is the case the role-based design could not have represented.
```

---

### S2 — Command: create Affiliates  ⬜ TODO

**B1 — Types and fixtures** (re-specified 2026-09-18 — D11).
- `command/lib/types.ts`: **`UserRole` is NOT touched** — there is no affiliate role.
  `User` adds `referralCode: string | null` (non-null ⇒ this user is an affiliate).
  `UserFormData` (`:138-145`) adds `referralCode: string`, used only by the create
  form. `CreateUserResult` adds `referralCode?: string` / `referralUrl?: string`.
- `ALL_ROLES` and **`ROLE_CFG` are untouched**, so the earlier gap **G1 no longer
  applies** — there is no role map to forget. Superseded, not fixed.
- The list shows affiliate status as its own **chip beside the role badge**, driven
  by `referralCode`, never by the role. A tiny `AffiliateChip` is *not* warranted —
  it is one `<span>` with an existing badge class.
- **Finding 8 is void**: nothing would render an affiliate as "Member", because the
  role genuinely is Member (or whatever else they hold).
- ⚠️ **G3 still applies:** `command/app/ui-gallery/page.tsx:426` `USERS: User[]`
  gains the field, plus two rows worth having — a user who is *only* an affiliate,
  and a booker who is *also* one (the D11 case).
- **Filtering (H3):** `UserToolbar` gains a compact "Affiliates only" toggle rather
  than a fourth dropdown. It needs real plumbing, not a free ride: new state in
  `useUsers.ts` (beside `usrRole`, `:69`), a filter line at `:120`
  (`r.filter(u => u.referralCode)`), the dep added at `:123`, the value returned at
  `:200`, and a prop through `UserToolbar`. Not an entry in the role dropdown, because
  it is not a role.

**B2 — ✖ ABORTED (2026-09-18) — D11 removed the need entirely.**
Both planned guards (`affiliateAccessError`, `affiliateRoleChangeError`) existed only
because affiliate was a role that could collide with portal access. As a capability it
collides with nothing: portals and roles are set exactly as they are for any user, and
being an affiliate neither grants nor withholds access. Gap **G8 is void** for the same
reason. `command/lib/userAccess.ts` is left untouched.
*(Kept, not deleted, per the status model: this is the record of why no guard exists.)*

**B3 — Code rule (shared, pure).** New `command/lib/referralCode.ts`:
`normaliseReferralCode(raw)` (strip non-alphanumerics, upper-case),
`isWellFormedReferralCode(code)` (`^[A-Z0-9]{4,32}$`), and
`REFERRAL_CODE_REQUIRED` / `REFERRAL_CODE_FORMAT` / `REFERRAL_CODE_TAKEN`
messages. No `@/` imports, so `node --test` can load it. Test:
`command/lib/referralCode.test.ts` — normalising, the format bound, and agreement
with the DB check constraint.

**B4 — `POST /api/users`** (`command/app/api/users/route.ts:8-127`), in this order:
- **When a `referralCode` is supplied** (any role, D11): normalise it; reject
  malformed with 400; `select 1 from affiliates where referral_code = …` and reject
  a duplicate with `REFERRAL_CODE_TAKEN` — all **before** `createUser`, so the
  common mistakes create nothing. An empty code simply means "not an affiliate" and
  the branch is skipped entirely.
- After the role insert, insert into `affiliates`
  (`user_id`, `referral_code`, `created_by: caller.user.id`). On failure — including
  a `23505` from a race — **delete the just-created auth user** and return the
  matching message: the operator asked for an affiliate and did not get one, and the
  account has no other data yet, so the rollback is safe and honest. Limited to this
  branch; creating any user without a code is byte-identical to today.
- ⚠️ **H2 — the share link passes a literal `["vendor"]`** to `resolvePortalOrigin`,
  never the user's own portals: the referral URL always points at the vendor app,
  whoever the affiliate is. Verified safe — the helper resolves by priority from the
  list it is given (`portalOrigins.server.ts:101-117`).
- Skip the set-password email **when the new user has no portals** (unchanged logic —
  `resolvePortalOrigin` already reports `not_configured`) and return
  `{ error: null, emailStatus: "not_configured", referralCode, referralUrl }`,
  where `referralUrl` is `resolvePortalOrigin(["vendor"]) + "/?ref=" + code`, or
  omitted when that origin isn't configured. `emailStatus` stays in the response
  so existing callers keep parsing it.
- Who may create: admin **and** root (D5); `affiliate` is not in `PRIVILEGED_ROLES`.

**B5 — `DELETE /api/users`** (`route.ts:168-208`): after the bookings check, count
`vendor_referrals` where `affiliate_user_id = id`. ⚠️ **Changed by D11:** the earlier
version gated this on the target holding the `affiliate` role, which no longer exists,
so the count now runs for every delete — one indexed lookup on a PK-joined column,
negligible, and it is the only way to know. If any exist, 400:
`"This affiliate has N referred vendor(s) and cannot be deleted. Suspend the account instead to preserve referral history."`
Mirrors the bookings message and runs before the FK RESTRICT would fail (D6).

**B6 — Users list and UI.**
- `command/services/users.service.ts:5`: add `affiliates(referral_code)` to `SELECT`;
  lines 57-61 recognise `"affiliate"`; map `referralCode`. ⚠️ **G10:** read the
  embed defensively — `const a = row.affiliates; const code = Array.isArray(a) ? a[0]?.referral_code : a?.referral_code`
  — because a one-to-one embed can arrive as either shape.
- ⚠️ **G2:** `hooks/mutations/users/useCreateUser.ts:6-27` whitelists fields in
  **both** directions: add `referralCode` to the POST body and `referralCode` /
  `referralUrl` to the returned object, or they vanish silently.
- `command/components/users/UsersPage/useUsers.ts:23` `notifyCreated`: when
  `result.referralCode` is set, show
  `"<name> created — referral code <CODE>"` with description
  `"Share <referralUrl>. Affiliates can't sign in yet."` (code only when no URL),
  `duration: 12000`.
- `command/components/users/UserModal/` — form state in `useUserForm.ts`, render
  in `UserModal.tsx`:
  - `useUserForm.ts`: `referralCode` state + setter, cleared by `reset()`,
    populated by `populate()`.
  - Add mode: "Affiliate" in the role select; when chosen, a **required
    "Referral code"** input appears, portal toggles are disabled, and the B2/B3
    messages render in the existing inline `accessError` alert style.
  - ⚠️ **G7:** when the role is Affiliate and the status is not `active`, show an
    inline hint — *"A suspended or pending Affiliate's code won't be attributed to
    new vendor signups."* Same alert style; no new component.
  - View mode: a "Referral code" row when `u.referralCode` is set, plus the share
    link as selectable text.
  - Edit mode for an Affiliate: role, portals and code are read-only (editing a
    code is out of scope). "Affiliate" is not offered for a non-Affiliate, because
    Edit can't create an `affiliates` row.
  - **Component separation:** no new component; all state stays in `useUserForm`,
    `.tsx` stays a render layer, styling reuses `UserModal.module.css`. The UX
    skill is applied when built (label, inline error, disabled affordance, both themes).
- Users page role filter gains "Affiliate" via `ALL_ROLES`.

**B7 — ✖ ABORTED (2026-09-18) — D11.** There is nothing to guard in
`useUpdateUser`: editing a user never touches their affiliate status, which is
managed only through B18/B19's dedicated route and modal. The existing
`commandAccessError` call stays exactly as it is. This also removes the awkward
signature change the earlier draft needed (passing the current role into
`updateUser`).

**B18 — `/api/affiliates` route — the affiliate CRUD** (new
`command/app/api/affiliates/route.ts`) — D9 + D11. `affiliates` has **no
`authenticated` write grant**, so every write needs a service-role route; a separate
route from `/api/users`, which exists to manage the *account* (different table,
different reason to change). All three verbs are `verifyCommandCaller`-gated, admin or
root (D5), and all three normalise + format-check the code:

| Verb | Body | Does |
|---|---|---|
| `POST` | `{ userId, referralCode }` | **Assign** — makes an existing user an affiliate. Refuses if they already have a row (`23505` on the PK → "already an affiliate"), or if the code is taken. Touches nothing else about the user. |
| `PATCH` | `{ userId, referralCode }` | **Change the code.** Uniqueness checked **excluding their own row** (`referral_code = $1 and user_id <> $2`); `23505` → `REFERRAL_CODE_TAKEN`. |
| `GET` | `?userId=` | **Read** (D12a) — returns `{ referralCode, referralUrl, referrals: [{ vendorId, vendorName, signedUpAt }] }`. `referralUrl` is built server-side from `resolvePortalOrigin(["vendor"])`, so `PORTAL_URL_VENDOR` never reaches the browser; when that origin is not configured the field is `null` and the UI shows the code alone rather than a broken link. This one call feeds B20's list, B21's link row and the referral count. |
| `DELETE` | `?userId=` | **Remove** the affiliate capability. Refused while the user has `vendor_referrals` rows — the FK is `RESTRICT`, so the route checks first and returns the same "suspend or keep it" message shape as B5. The user account itself is untouched. |

None of them touch `vendor_referrals`: those rows are historical snapshots, and
rewriting them would falsify what the vendor actually typed.

**B19 — "Affiliate" action modal** (new
`command/components/users/AffiliateModal/`: `.tsx` + `useAffiliateModal.ts` +
`.module.css`) — D9 + D11. One modal covering assign, change and remove, launched
from the user detail modal's footer (`UserModal.tsx:201-203` is the existing precedent,
opened via `UsersPage.tsx:106`). Modelled directly on `UserSetPasswordModal/`, the
established pattern for a single-purpose action on a user.

- Footer button reads **"Make affiliate"** when `user.referralCode` is null, and
  **"Affiliate"** when it is set.
- Not a field inside the edit form, for one concrete reason: the edit form saves the
  profile through `useUpdateUser` (browser + RLS) while this saves through B18's
  service-role route. One Save spanning both could half-succeed; two deliberate
  actions cannot.
- Assign and change share the code input and its validation. Remove is a distinct,
  confirmed action, and is refused with B18's message when referrals exist.
- The change path states plainly, **before** saving, that links already shared under
  the old code will stop attributing and nobody will be told (D2 + D9).
- ⚠️ **H7:** the **remove** path carries the same warning — removing the capability
  retires the link just as surely as changing the code does.
- ⚠️ **H8:** when the target user is not `active`, the modal shows the same inline hint
  as the create form (G7): *"A suspended or pending user's code won't be attributed to
  new vendor signups."* Assigning is still allowed — the code simply starts working when
  they do.
- Mutation hook `hooks/mutations/users/useAffiliate.ts` exposing
  `assignAffiliate` / `changeReferralCode` / `removeAffiliate`, alongside
  `useSetUserPassword`.
- **Component separation:** all state, validation and handlers in
  `useAffiliateModal.ts`; `.tsx` is pure render; styling in the co-located module CSS.

**B21 — Affiliate surface in the user detail view** (H5) — reuses the three structures
`UserModal.tsx:82-110` already has, so it looks native rather than bolted on:
- **Badge row** (`:83-86`, beside `StatusBadge`/`RoleBadge`): an "Affiliate" badge when
  `referralCode` is set.
- **Account Details rows** (`:88-99`, the `[Icon, label, value]` list): add
  `[Link2, "Referral code", "NINA2026"]` and `[Users, "Referred vendors", "3"]`, plus a
  copyable share-link row (shape depends on D12).
- **Portal Access section** (`:100-110`) — **left alone on purpose.** It renders from
  `ALL_PORTALS`, so when the affiliate portal ships, inserting an `affiliate` row in
  `portals` + `ALL_PORTALS` + `PORTAL_CFG` makes an affiliate chip appear here
  automatically, next to vendor/booker/command, with **no rework of this modal**. That
  is the "where the affiliate portal will slot in" answer, and it is why affiliate
  status is *not* faked as a portal chip today: a chip for a portal nobody can enter
  would be a lie, and it would collide with the real row later.

**B22 — Export referrals (CSV)** (D13) — new
`command/services/affiliates.service.ts` + `command/lib/affiliateCsv.ts` +
`command/lib/affiliateCsv.test.ts`, and a button in `UserToolbar`.
- `getAffiliateSummary()` reads `affiliates` with embeds
  `profiles(full_name, email, status_id)` and
  `vendor_referrals(vendor_id, vendors(name, created_at, status_id))`, from the browser
  with the admin's own session. `vendor_referrals.affiliate_user_id` is an FK to
  `affiliates`, so the nested embed resolves; the S1 policies already permit all three
  reads. **No new grant, no RPC, no migration** — which is the whole reason D13 was
  scoped to the summary.
- Counts are derived in JS (`vendors_referred`, `vendors_now_active`, `last_signup`), so
  affiliates with **zero** referrals still produce a row — the same property the summary
  SQL gets from its `left join`, and the most informative line in the file.
- `affiliateCsv.ts` is **pure**: rows in, RFC 4180 string out, with quote-escaping for
  names containing commas or quotes and a UTF-8 BOM so Excel does not mangle `₱` or
  accented names. Unit-tested under `node --test`; this is the piece most likely to be
  silently wrong.
- The hook triggers the download with a `Blob` + object URL + a synthesised anchor click,
  revoking the URL afterwards. Filename `affiliate-referrals-YYYY-MM-DD.csv`.
- Button sits in `UserToolbar` beside "Affiliates only", disabled with a tooltip when no
  affiliates exist. **Component separation:** fetch/loading/error and the download
  handler live in the hook; the toolbar stays a render layer.
- ⚠️ It exports **every** affiliate, not the filtered view — a filtered export that
  silently omits rows is how a partial spreadsheet gets mistaken for the whole picture.
  The button label says "Export all affiliates (CSV)" for that reason.

**B20 — Referred-vendors panel** (new
`command/components/users/AffiliateReferralsPanel/`: `.tsx` + `useAffiliateReferrals.ts`
+ `.module.css`, plus `command/services/affiliates.service.ts`) — D10. Rendered inside
`UserModal` view mode when `user.referralCode` is set. **D12(a), resolved 2026-09-18:** the panel, the link and the
count all come from one `GET /api/affiliates?userId=` call (B18) — a single round trip,
and the vendor origin never leaves the server. The hook owns loading/empty/error state;
no `affiliates.service.ts` is needed, since the read goes through the route rather than
the browser's Supabase client. Shows vendor name + signup date, a count in the heading,
and an explicit empty state ("No vendors have signed up with this code yet"), which is
also what a broken link looks like — so it doubles as the diagnostic D2 otherwise lacks.
Loading and error states handled; the UX skill applies. **Component separation:** own
hook for fetch/loading/error, `.tsx` pure render, styles in module CSS.

**Verify:** `npm --prefix command run test` (userAccess, referralCode) · `tsc` ·
lint *(mine)* · **no Playwright baselines are affected — G4 confirmed no committed
spec renders `UserModal`** · *live:* create an Affiliate as admin; duplicate code
refused with nothing created; portal grant blocked in UI and by the route; edit
refuses a role switch into/out of Affiliate; list shows role + code; delete with a
referral refused *(shared — I test locally, you confirm on staging)*.

---

### S3 — Vendor: capture the referral at signup  ⬜ TODO

**B8 — Code rule (vendor copy).** New `vendor/lib/referralCode.ts` (pure, no `@/`
imports): `normaliseReferralCode`, `isWellFormedReferralCode`. Test:
`vendor/lib/referralCode.test.ts`. *(Deliberately duplicated from Command — the
apps share no code, and the DB check constraint is the single source of truth.)*

**B9 — Server lookup.** New `vendor/lib/referralLookup.ts`, following
`lib/emailAvailability.ts`: `resolveReferralCode(admin, code)` returns
`{ affiliateUserId, referralCode } | null`. It selects `affiliates.user_id` by
`referral_code` and requires the joined profile status to be `active`. A malformed
or empty code returns `null` without querying. A query error returns `null` **and
logs a warning** — under D2 a broken lookup must never block a registration, but
it must be diagnosable.

**B10 — Registration contract.** `vendor/lib/registration.ts`:
`RegistrationFields.referralCode`; `readFields` reads `body.referralCode`;
`validateFields` normalises it and returns `referralCode: string | null`,
treating malformed input as **absent, never an error** (D2). Both routes inherit
this (Finding 11).

**B11 — `prepare` route:** no change beyond the shared contract. It creates
nothing, and under D2 there is nothing to refuse.

**B12 — `register` route** (`vendor/app/api/auth/register/route.ts`):
- Resolve the code next to the division check (`:102-104`), before anything is
  created, so the lookup can't half-finish a signup.
- After the `vendor_members` insert (`:217-218`), and **only if it resolved**,
  insert `vendor_referrals { vendor_id, affiliate_user_id, referral_code }`.
  On error, `rollback()` and 500 — the row is cheap and a silent half-success
  here would be a lie in the report.
- If a `ref` was supplied but did not resolve: `console.warn` naming the code,
  and carry on. No error to the vendor (D2).
- The insert stays **before** the consent insert, which must remain the last
  rollback-able step (`:246-256`). The vendor delete in rollback cascades the
  referral row, so `rollback()` needs no change.

**B13 — Client service.** `vendor/services/kyc.service.ts`: add `referralCode` to
`SubmitKycParams.form` and to the `fields` posted. No new client-side check
endpoint (D2/D4 removed it).

**B14 — Deep link.** New `vendor/lib/referralDeepLink.ts`: a copy of
`divisionDeepLink.ts` for `ref` — module-load capture, one-shot peek/consume,
with comments pointing at the division module for the full reasoning. A second
small module beats generalising the first while only two params use this.

**B15 — Wizard hook.** `vendor/components/auth/LoginPage/useLoginPage.ts`:
- `RegForm.referralCode` + `EMPTY_REG` (never rendered — D4).
- Draft save (`:211-214`) includes it in the **saved object**; restore (`:196-207`)
  reads `draft.referralCode ?? ""`. `vendor/lib/kycDraft.ts` gains the optional
  field; no key-version bump, since an older draft simply has no code.
  ⚠️ **Do not add it to the `hasContent` test on `:212`.** That list decides whether
  a draft is written at all. Including the code would make `/?ref=CODE` write a
  `localStorage` draft for a visitor who typed nothing — a new side effect on a
  path that currently has none. Excluded, the behaviour is: no draft until the
  vendor actually types something, and once they do, the code rides along.
- **New effect declared after the draft-restore effect:** when
  `initialView === "login"` and `peekDeepLinkReferral()` is set, store the code,
  open `register` at step 1, then consume. React runs effects in declaration
  order, so the URL beats the draft deterministically — unlike the division apply,
  which wins only because a network round trip makes it land later. Independent
  of the divisions fetch.
- `handleSubmitKyc` (`:546-557`) passes `referralCode`. **`handleDetailsContinue`
  is unchanged** — no per-step check exists under D2.
- **Component separation:** all state stays in the hook; `LoginPage.tsx` is not
  touched at all.

**B16 — Testability seam** ⚠️ **G6 · D7 resolved 2026-09-17.** Under D4 nothing
about the captured code is observable, so the deep link has no DOM signal to
assert — and `conventions.md:619` records that an effect-ordering regression in
exactly this mechanism survived eleven days behind a green suite. Therefore:
render one hidden input on registration step 1,
`<input type="hidden" data-testid="referral-code" value={regForm.referralCode} />`.
It is invisible to the vendor (D4 holds), changes no layout and therefore no
baseline, and gives both Playwright and a support engineer a handle. One line in
`LoginPage.tsx`; state stays in the hook.

**B17 — Deep-link regression spec** (depends on B16). New
`vendor/visual-tests/referral-deeplink.spec.ts`, modelled on the existing
`division-deeplink.spec.ts` (a DOM test, no screenshots, hermetic — `/api/divisions`
route-mocked, no session, so no seeded DB). Asserts: `/?ref=JUAN2026` opens
registration **and** the hidden input holds `JUAN2026`; the query string has been
rewritten by then (the actual point); `?ref=juan-2026` normalises to the same value;
`?ref=` plus `?division=` both apply; and signing out does not re-open registration
(the one-shot consume).

**Verify:** `npm --prefix vendor run test` (referralCode; ⚠️ **G12** — `vendor/lib`
has no `registration.test.ts` today, so B10 either gets a new one or is honestly
reported as covered only by live testing) · `tsc` · lint · `npm --prefix vendor run
test:visual` for the new spec *(mine)* · *live (local):* the three flows above;
`?ref=` + `?division=` together; a
lower-case/hyphenated code still matches; signing out does not reopen
registration; a suspended affiliate's code produces a vendor with no referral row
and no error; forcing the `vendor_referrals` insert to fail leaves no user or
vendor behind *(shared)*.

---

### S4 — Docs, login-block check, report run  ⬜ TODO

**I1 — Architecture docs** *(mine)*: `schema.md` (Migration History, both tables,
ERD, the primary-vendor-user definition, the export SQL); `auth-and-roles.md`
(the `affiliate` role, "no portals is the gate", the D3 outcome and its accepted
residual risk); `portals.md` (a "Referral deep link" paragraph beside the
division one; Affiliate creation on the Command Users page); ⚠️ **G5**
`conventions.md:586-619` ("The shell owns the query string") — it names each
module-load reader by file, and `lib/referralDeepLink.ts` is now the third.

**I2 — Login-block verification** *(yours — needs staging + a mail-reachable
address)*: for a real Affiliate, Forgot Password on vendor, booker and command →
set a password → sign in → each portal refuses and signs out; the mobile vendor
app refuses too. I record the outcome in the plan.

**I3 — Run the export query** *(shared — I run it locally after S3, you run it on
staging/production once deployed)* and confirm one row per referred vendor with
the right primary user.

---

## "No referral code supplied" — exactly what changes (asked 2026-09-17)

The code is **optional everywhere**: optional in the URL, optional in the wizard
(it has no field at all under D4), and never a required field on the server. A
signup with no code walks today's path. Traced step by step:

| Step | With no code | Change vs today |
|---|---|---|
| Landing on `/` | `peekDeepLinkReferral()` returns `""`, the new effect returns immediately, the login view renders as it does now | none |
| Wizard steps 1–6 | no field exists, no validation runs, no per-step check | none |
| Draft auto-save | `hasContent` is unchanged (B15), so a visitor who types nothing still writes nothing | none |
| Submit → `submitKyc` | sends `referralCode: ""` alongside the existing fields | one extra empty string in the JSON body |
| `prepare` route | reads and normalises the field; never refuses on it | no new query, no new failure mode |
| `register` route | `referralCode` normalises to `null`, the lookup is **skipped entirely** (no query), no `vendor_referrals` insert | one boolean check |
| Required-field validation | the code is **not** in the required list in `validateFields` | none |
| KYC, documents, consent, notifications, rollback | untouched | none |
| The vendor afterwards | identical record, identical portal access, identical KYC surface; simply absent from the referral report | none |

**The booker app is not touched at all**, and the mobile apps have no registration
screen.

The only places where shared, non-referral paths change at all:

1. **Command's Users list query** gains an `affiliates(referral_code)` embed, so
   every row carries an extra `null` for non-Affiliates. This is the one shared
   read path in the change; it is verified locally before merge, and the page
   already renders a load-error state if a query fails.
2. **`UserFormData` gains a `referralCode` field**, empty for every other role, and
   the create route ignores it unless the role is `affiliate`.
3. **`DELETE /api/users`** adds a referral count **only for targets holding the
   `affiliate` role** (B5), so ordinary user deletes issue exactly the queries they
   issue today.

Nothing above can change the outcome of a signup that carries no code.

---

## Affiliate summary SQL — "how many signups came from each affiliate" (H6)

One row per affiliate, **including affiliates who have referred nobody** (that zero is
the most useful number in the table — it is what a broken or never-shared link looks
like).

```sql
select
  p.full_name                                   as affiliate_name,
  p.email                                       as affiliate_email,
  a.referral_code                               as current_code,
  s.name                                        as affiliate_status,
  count(vr.vendor_id)                           as vendors_referred,
  count(vr.vendor_id) filter (
    where v.status_id = (select id from public.statuses where name = 'active')
  )                                             as vendors_now_active,
  to_char(max(v.created_at) at time zone 'Asia/Manila', 'YYYY-MM-DD') as last_signup
from       public.affiliates a
join       public.profiles   p  on p.id = a.user_id
join       public.statuses   s  on s.id = p.status_id
left join  public.vendor_referrals vr on vr.affiliate_user_id = a.user_id
left join  public.vendors    v  on v.id = vr.vendor_id
group by   p.full_name, p.email, a.referral_code, s.name
order by   vendors_referred desc, p.full_name;
```

`left join` is what keeps the zero-referral affiliates in. ⚠️ **It counts only referrals
whose affiliate still exists** — rows whose `affiliate_user_id` was nulled by an account
deletion (D14) belong to nobody and are absent here by design. To see those:

```sql
select referral_code, count(*) as vendors_referred
from   public.vendor_referrals
where  affiliate_user_id is null
group  by referral_code;
```
 `vendors_now_active` is the
subset that survived review and activation, so a gap between the two columns says the
signups arrived but did not convert — a different problem from no signups at all.

**For one affiliate**, add `where a.referral_code = 'NINA2026'` before `group by`.

Three ways to get this out, depending on what you are doing:

| Need | Use |
|---|---|
| A number, right now, for one affiliate | Command → Users → open them → **Referred vendors (N)** in the detail view (B20/B21) |
| Every affiliate ranked, into a spreadsheet | This summary query → Supabase SQL editor → **Download CSV** |
| The per-vendor detail (who, when, which code) | The Export SQL below |

---

## Export SQL (exact — run after S1–S3 ship)

One row per referred vendor. "Vendor user" = the **primary vendor user**, meaning
the earliest-granted `vendor-admin` of that vendor, which is the person who
registered it (Finding 9). Dates shown in Manila time.

```sql
select
  coalesce(ap.full_name, '(closed account)')                       as affiliate_name,
  ap.email                                                         as affiliate_email,
  vr.referral_code                                                 as referral_code,
  v.name                                                           as vendor_name,
  owner.full_name                                                  as vendor_user_name,
  nullif(trim(owner.email), '')                                    as vendor_user_email,
  to_char(v.created_at at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as signed_up_at
from public.vendor_referrals vr
join      public.vendors  v  on v.id  = vr.vendor_id
-- LEFT, not inner (D14): affiliate_user_id is NULL once that account is deleted, and the
-- referral still happened. An inner join would silently drop those rows from the report.
left join public.profiles ap on ap.id = vr.affiliate_user_id
left join lateral (
  select p.full_name, p.email
  from   public.vendor_members vm
  join   public.roles    r on r.id = vm.role_id and r.name = 'vendor-admin'
  join   public.profiles p on p.id = vm.user_id
  where  vm.vendor_id = v.id
  order  by vm.granted_at asc, vm.user_id asc
  limit  1
) owner on true
order by affiliate_name, v.created_at;
```

Notes:
- `left join lateral`: a vendor whose admins were all removed still appears, with
  blank user columns.
- **`(closed account)`** in `affiliate_name` means the affiliate deleted their account
  (D14). The referral is still real and the code still names it; only the person is gone.
- `vr.referral_code` is the code **used**. For each affiliate's *current* code,
  join `public.affiliates a on a.user_id = vr.affiliate_user_id`. The two are the
  same until codes can change.
- Runs as `postgres` (SQL editor or psql), bypassing RLS. A Command admin's JWT
  would also see every row through the S1 policies.
- Export: Supabase SQL editor → run → **Download CSV**, or
  `psql … -c "\copy (<query>) to 'referrals.csv' csv header"`.
- ⚠️ **G9 — closed vendors still appear.** Account closure *scrubs* the vendor row
  and deletes its `vendor_members`; it does not delete the vendor and does not
  scrub `vendors.name` (`command/lib/accountDeletion/execute.server.ts:81-105, 260-321`).
  So a closed vendor stays in the report under its real name, with **blank vendor
  user columns** — the referral genuinely happened, and the blank columns are the
  signal that the account is gone. To exclude them, add
  `and v.status_id <> (select id from public.statuses where name = 'suspended')`,
  but note closure reuses `suspended`, so that also hides ordinarily suspended vendors.

---

## DECISIONS

- **D1 — Code generation → admin types it** (resolved 2026-09-17). Memorable codes;
  the form validates format and uniqueness before anything is created. Auto-generation
  is still possible later without a migration.
- **D2 — Invalid code → silently ignored** (resolved 2026-09-17). The vendor is never
  blocked or shown a referral error; **no `vendor_referrals` row is saved** unless the
  code resolves to an active affiliate. Consequence accepted: a bad link is invisible
  until the report is run; the register route logs a warning for diagnosis.
- **D3 — Login block → no portal access is enough** (resolved 2026-09-17). Nothing on
  the Supabase Auth side; suspend the user when needed. Residual risk accepted
  (Finding 6: a Forgot-Password session can read public catalogue data only).
- **D4 — URL code in the form → hidden** (resolved 2026-09-17). No field on any step,
  no review row; the code rides in wizard state and the draft. Removes the signup-form
  UI work and the visual-baseline regeneration entirely.
- **D5 — Who can create Affiliates → admin and root** (resolved 2026-09-17), same as
  `member`, since it grants no access.
- **D6 — Deleting an Affiliate with referrals → blocked, suspend instead**
  (resolved 2026-09-17). FK RESTRICT plus a friendly route check, following the
  existing "user has bookings" rule.
- **D7 — keeping the hidden code testable (G6) → hidden input on step 1**
  (resolved 2026-09-17). `<input type="hidden" data-testid="referral-code">`
  holding the captured code: invisible to the vendor so D4 holds, no layout change
  and therefore no screenshot baselines, one line of JSX, and it gives B17's
  Playwright spec something to assert and support a value to inspect. The
  alternatives were no DOM at all (the spec could then only prove the form opened,
  leaving silent attribution loss undetectable) and showing it read-only on the
  review step (visible to the vendor, reverses part of D4, changes a baseline).

- **D8 — where affiliate management lives → the Users page** (resolved 2026-09-18).
  Affiliates stay ordinary users with a role; no new page, no new nav. A dedicated
  Affiliates page arrives with the affiliate portal, and is purely additive.
- **D9 — referral code editable after creation → yes** (resolved 2026-09-18), with
  format + uniqueness re-checked. Needed for a typo, a rebrand or a leaked code.
  History is safe because `vendor_referrals.referral_code` is a snapshot. Accepted
  cost: links already shared under the old code stop attributing, silently.
- **D10 — show an affiliate's referred vendors in Command → yes** (resolved
  2026-09-18), as a read-only list (vendor name + signup date) in the detail view.
  Answers the question people actually ask without building analytics. The export
  SQL remains the reporting path.

- **D11 — affiliate is a CAPABILITY, not a role** (resolved 2026-09-18). Membership of
  `affiliates` is the whole definition; roles and portals are untouched by it. Chosen so
  an existing user can be made an affiliate later without surrendering the role their
  portal access depends on. Consequences recorded through the plan: the migration inserts
  **no role**, B2 and B7 are aborted outright, G1 and G8 are void, and S2 gains a real
  assign/change/remove surface (B18/B19) instead of a create-only one. Rejected: keeping
  both a role and the table, which would give two disagreeing answers to "is this user an
  affiliate".

- **D12 — the browser gets the vendor origin from a server route → option (a)**
  (resolved 2026-09-18). `GET /api/affiliates?userId=` returns
  `{ referralCode, referralUrl, referrals[] }` in one call. `PORTAL_URL_VENDOR` stays
  server-only, honouring the documented reason it is not `NEXT_PUBLIC_*`
  (`portalOrigins.server.ts:16-20`: build-time inlining needs a cache-disabled redeploy);
  it is read at request time, so the link is correct per environment with no rebuild and
  no third env var to set. B20's panel and B21's link row are fed by the same round trip.
  Rejected: `NEXT_PUBLIC_VENDOR_URL` (diverges from that decision, three environments to
  configure) and code-only (admins hand-build URLs — the exact way a mistyped link gets
  shared under D2's silence).

- **D13 — Command gets its own "Export referrals (CSV)" button** (resolved 2026-09-18),
  so a referral spreadsheet does not require Supabase dashboard access. **Scoped to the
  per-affiliate summary** (name, email, code, status, vendors referred, vendors now
  active, last signup) — deliberately *not* the per-vendor detail, which needs the
  "primary vendor user" definition and the vendor users' emails. Keeping the button on
  the summary means it reads what a Command admin can already see under RLS: **no RPC,
  no `SECURITY DEFINER` function and no second migration**. The per-vendor CSV stays
  with the Export SQL, which is where that definition already lives, so the two cannot
  drift.

- **D14 — a deleted affiliate's referrals → `ON DELETE SET NULL`** (resolved 2026-09-18,
  from pre-apply finding J1). The referral row survives with its `referral_code`
  snapshot; only the link to the deleted person drops, so account closure completes and
  "this vendor signed up under NINA2026" stays true. Follows the schema's existing
  outlive-the-account pattern (`account_deletion_requests.requested_by`,
  `legal_acceptances.user_id`, `vendor_status_log.changed_by`). Rejected: CASCADE (past
  exports would silently disagree with new ones) and keeping RESTRICT with a new step
  inside account closure (referral logic inside the one sequence that has no undo, and
  it still has to answer this same question). **Consequence:** D6's database backstop is
  now softer — Command's `DELETE /api/users` guard (B5) is what actually stops careless
  admin deletion, and the export/summary SQL must `left join` the affiliate.

## DEFERRED / COSMETIC
- **Affiliate portal, reading own referrals** → later: add an `affiliate` portal row,
  grant it, and add "own rows" SELECT policies on `affiliates` (`user_id = auth.uid()`)
  and `vendor_referrals` (`affiliate_user_id = auth.uid()`). No table changes.
- **Commissions** → a separate table keyed to `vendor_referrals.vendor_id` (or to
  bookings), with a rate on `affiliates` or per referral. `vendor_referrals` is
  already the join point, so nothing gets restructured.
- **Multiple codes or links per affiliate** → move `affiliates.referral_code` into an
  `affiliate_referral_codes` table; `vendor_referrals.referral_code` keeps historic
  rows meaningful.
- **Command-created vendors with a referrer, and editing attribution** → manual SQL
  for now.
- **Report UI in Command** → the per-affiliate list (D10) covers "who did X refer";
  totals, charts, date ranges and commissions stay out, and the export SQL remains
  the reporting path.
- **An Affiliate who is also a vendor** → blocked today by the shared-email check
  (Finding 10). Revisit with the portal.

## Execution order
1. **Decisions D1–D7** — ✅ all resolved 2026-09-17. No open decision blocks execution.
2. **S1 migration file** (mine) → you review and apply. 🔒
3. **S2 Command** (B1, B3→B6, then B18→B22; B2 and B7 aborted) — depends on S1 only.
   No decision blocks any item. Commit in `command/`.
   ⚠️ **S2 grew on 2026-09-18** (D8–D11): B18–B21 added, B2 and B7 dropped. If it runs
   long I will stop after B6 — create-with-code, list and detail all working — and
   report, rather than half-landing the assign/change/remove path.
4. **S3 Vendor** (B8→B17) — depends on S1; live testing wants an Affiliate from S2.
   Commit in `vendor/`.
5. **S4** docs + live checks + report run. Commit in the root repo.
6. Staging/production: **migration first**, then deploy command and vendor.
   ⚠️ **Corrected 2026-09-17 — the earlier wording here was wrong.** It said a vendor
   app deployed before the tables exist "would fail every referred signup". It would
   not: B9 fails soft, so a missing `affiliates` table makes the lookup return
   `null`, and the signup **succeeds with no attribution**. The real risk of the
   wrong order is therefore *silently lost referrals*, not broken registrations —
   quieter, and worse, because nobody notices until the report comes up short.
   Command deployed early is safe in the other direction: creating an Affiliate
   fails outright (no role row, no table), so nothing half-exists.

One stage per turn by default, with a report and the big table after each.

---

## I2 — how to run it (written 2026-09-19)

**What it proves:** that holding a referral code gives nobody a way into any portal —
and, just as important, that it takes nothing away from someone who already had one
(D11). No code changes; this only exercises gates that already existed.

**Locally (recommended first — no email needed).** The seed gives Nina a password
(`nina@bookdeck.com` / `DevSeed@pass16`) and no portals. Liza (`liza@bookdeck.com` /
`DevSeed@pass2`) is a booker who is also an affiliate. Start each app on its own port
(`npm run dev -- -p 3000` command, `-p 3001` vendor, `-p 3002` booker) — bare `next dev`
takes ports in start order.

| # | Surface | Sign in as | Expected |
|---|---|---|---|
| 1 | Vendor web — `localhost:3001` | Nina | Refused: **"Your account has no vendor access. Contact support."** — and you stay on the login screen, not a blank app |
| 2 | Booker web — `localhost:3002` | Nina | Refused: **"You do not have access to RS Booker."** |
| 3 | Command — `localhost:3000` | Nina | Refused: **"You do not have access to the Command portal."** |
| 5 | Booker web — `localhost:3002` | **Liza** | **Gets in normally.** This is the D11 guarantee — a code must not cost anyone their existing access |
| 6 | Any portal, then refresh | Nina | Still refused after a refresh — the session-restore path signs out too, it does not render a blank shell |

A **pass** is 1–3 and 6 refused with those messages, and 5 admitted. Any portal that
*admits* Nina is a real finding: stop and report it.

**On staging (after S4.1/S4.2) — including the mobile app.** ⚠️ The vendor mobile app
is **not** testable locally: its `EXPO_PUBLIC_SUPABASE_URL` points at the **staging**
project (`fbxbwnfeimzhgxpshdpa`), where the seeded Nina does not exist. So:

1. In staging Command, create an affiliate **with no portals**, on an email you control.
2. A Command-created account has **no password**, so use *Forgot Password* on the vendor
   web portal → set one from the email. (This is also the residual-risk path an affiliate
   would actually take.)
3. Sign in on vendor web, booker web and Command → refused, as in the local table.
4. Sign in on the **vendor mobile app** → the **"No vendor access on this account"**
   screen.
5. Optionally give an existing staging **booker** a code and confirm they still sign in
   to booker — the staging version of check 5. ⚠️ Auth email on a hosted project needs that project's SMTP
configured (see `auth-and-roles.md` → Password recovery), and it reaches **real inboxes**
— use an address you control.

**What I2 deliberately does not cover:** the accepted residual risk that such a session's
raw JWT can read public catalogue data through the API. That was decided (D3) and is
documented in `auth-and-roles.md`; I2 checks the portals, not the API.

---

## Big table (all todos, ownership and status)

**Owner:** 🤖 = mine (Claude) · 👤 = yours (Joshua) · 🤝 = shared
**Status:** ⬜ TODO · 🔄 IN PROGRESS / PARTIAL · ✅ DONE · ⏸ PARKED · ✖ ABORTED

| ID | Stage | Item | Owner | Status | Why / note |
|----|-------|------|-------|--------|------------|
| D1–D6 | S0 | First six decisions | 👤 | ✅ DONE 09-17 | Code typed by admin · invalid ignored · no-portal login block · hidden field · admin+root · delete blocked |
| G1–G12 | S0 | Gap review of the draft | 🤖 | ✅ DONE 09-17 | 11 real, 1 false alarm, all traced to `file:line` |
| D7 | S0 | Keeping the hidden code testable | 👤 | ✅ DONE 09-17 | Hidden input with a test id — invisible to vendors, assertable by Playwright |
| — | S0 | Approve the plan for execution | 👤 | ✅ DONE 09-17 | "plan approved. Do S1" |
| D8–D10 | S0 | Affiliate CRUD scope | 👤 | ✅ DONE 09-18 | Users page (no separate section) · code editable · referred-vendors list |
| D11 | S0 | Affiliate = capability, not a role | 👤 | ✅ DONE 09-18 | A role would force an existing booker to surrender `member` — the role their portal access depends on |
| H1–H8 | S0 | Gap review #2, post-model-change | 🤖 | ✅ DONE 09-18 | 6 real, 2 false alarms; H1 became D12 |
| D12 | S0 | Where the browser gets the vendor origin | 👤 | ✅ DONE 09-18 | `GET /api/affiliates` returns the link; `PORTAL_URL_VENDOR` stays server-only |
| D13 | S0 | CSV export in Command | 👤 | ✅ DONE 09-18 | Scoped to the per-affiliate summary, so no RPC and no second migration |
| J1–J7 | S0 | Pre-apply review | 🤖 | ✅ DONE 09-18 | Caught the closure blocker; confirmed staging was exactly one migration behind |
| D14 | S0 | Deleted affiliate → referrals | 👤 | ✅ DONE 09-18 | `SET NULL`: RESTRICT made account closure fail at its last, un-undoable step |
| **S1.1** | S1 | Migration file | 🤖 | ✅ DONE 09-17→18 | Revised twice (D11 dropped the role, D14 loosened the FK) — both **before** it was ever applied |
| S1.2 | S1 | Apply locally | 👤 | ✅ DONE 09-18 | `db reset`; local now at `20260917000001` |
| S1.3 | S1 | Verify in psql | 🤝 | ✅ DONE 09-18 | 8/8 structure · 4 constraint probes · SET NULL · trigger · RLS 0/0 vs 2/1 · both report queries |
| S1.4 | S1 | Local seed data | 🤖 | ✅ DONE 09-18 | nina (0 portals, 1 referral) + liza (booker **and** affiliate — the D11 case) |
| B1 | S2 | Types, affiliate column, filter toggle, fixtures | 🤖 | ✅ DONE 09-18 | No role plumbing at all — D11 removed the need for it |
| **B2** | S2 | ~~Access guards~~ | 🤖 | ✖ **ABORTED** 09-18 | **D11.** `affiliateAccessError` + `affiliateRoleChangeError` only existed because affiliate-as-a-role could collide with portal access. As a capability it collides with nothing, so there is nothing to guard. Gap G8 died with it |
| B3 | S2 | `referralCode.ts` + tests | 🤖 | ✅ DONE 09-18 | 12 tests: normalising, both length bounds, agreement with the DB regex |
| B4 | S2 | `POST /api/users` affiliate branch | 🤖 | ✅ DONE 09-18 | Validates before `createUser`; rolls back the auth user if the affiliate insert fails. **Not exercised live** |
| B5 | S2 | `DELETE /api/users` referral guard | 🤖 | ✅ DONE 09-18 | Now the **only** guard — D14 softened the FK, so removing this loses attributions silently. **Not exercised live** |
| B6 | S2 | List embed, hook passthrough, Add-User field, toast | 🤖 | ✅ DONE 09-18 | ⚠️ **K1** — the planned embed was ambiguous and broke the whole users query; fixed by naming the FK, verified live |
| **B7** | S2 | ~~Edit-mutation guards~~ | 🤖 | ✖ **ABORTED** 09-18 | **D11.** Editing a user never touches affiliate status — that goes through `/api/affiliates` — so there is nothing to guard, and it avoids changing `updateUser`'s signature |
| B18 | S2 | `/api/affiliates` GET · POST · PATCH · DELETE | 🤖 | ✅ DONE 09-18 | All four verbs **verified to 403 an unauthenticated caller** on a live dev server; the refused POST wrote nothing (still 2 affiliates). Authorised paths need a Command session — S2.L |
| B19 | S2 | "Affiliate" modal — assign / change / remove | 🤖 | ✅ DONE 09-18 | Hook owns state and the two-step remove; `.tsx` pure render; own module CSS. Count fetched internally (K3) |
| B20 | S2 | Referred-vendors panel | 🤖 | ✅ DONE 09-18 | Renamed `AffiliatePanel` (K3) — one fetch feeds link, count and list. Empty state carries the diagnostic |
| B21 | S2 | Detail-view badge + code/link/count rows | 🤖 | ✅ DONE 09-18 | Badge needs no fetch (the list carries the code); footer gains "Affiliate" / "Make affiliate" |
| B22 | S2 | Export referrals CSV | 🤖 | ✅ DONE 09-18 | **10 CSV tests pass** (quoting, embedded newline, zero-referral row, BOM). Summary query **verified live under a Command admin's JWT** |
| S2.V | S2 | Tests · tsc · lint · build | 🤖 | ✅ DONE 09-18 | **128 pass / 0 fail** · `tsc --noEmit` clean · build registers `/api/affiliates` · lint unchanged at 25 problems (20 pre-existing `any`) |
| S2.L | S2 | Live Command checks | 👤 | ✅ DONE 09-18 | **User-verified click-through** — reported working. Not observed by me, so the record is his report, not a machine result |
| B8 | S3 | `vendor/lib/referralCode.ts` + tests | 🤖 | ✅ DONE 09-18 | 13 tests, incl. the seeded codes spelled as a URL would carry them. Deliberate duplicate of Command's copy |
| B9 | S3 | `resolveReferralCode` lookup | 🤖 | ✅ DONE 09-18 | **Run against the live DB, 9/9 cases correct**: exact / lower-case / hyphenated all credit NINA2026; unknown, malformed, empty, absent and a **suspended** affiliate all return no attribution. K4 fixed en route |
| B10 | S3 | `registration.ts` contract | 🤖 | ✅ DONE 09-18 | Normalises; a malformed code becomes `null` (absent), never a refusal — the only rule in that function that cannot reject |
| B11 | S3 | `prepare` route | 🤖 | ✅ DONE 09-18 | **No logic, by design** — it creates nothing to attribute, and D2 gives it nothing to refuse. A comment records why, so the next reader doesn't "fix" it |
| B12 | S3 | `register` route attribution | 🤖 | ✅ DONE 09-18 | **Verified end to end against the live stack — 4 real registrations**: `nina-2026` credited Nina; unknown code, no code and a **suspended** affiliate each produced a vendor with no attribution; the unknown code logged its warning. Test data removed |
| B13 | S3 | `kyc.service.ts` passes the code | 🤖 | ✅ DONE 09-18 | One field added to `SubmitKycParams.form` and to the posted body |
| B14 | S3 | `referralDeepLink.ts` | 🤖 | ✅ DONE 09-18 | Module-load capture + one-shot consume, mirroring `divisionDeepLink.ts`. **Browser-verified**: `/?ref=` opens registration and the param is already gone from the URL |
| B15 | S3 | Wizard hook + draft | 🤖 | ✅ DONE 09-18 | ⚠️ Re-done as **lazy initialisers** (K6) instead of an effect: no setState-in-effect, and URL-beats-draft is now explicit (`f.referralCode \|\| draft…`) rather than dependent on effect order. Code excluded from `hasContent` |
| B16 | S3 | Hidden testability input | 🤖 | ✅ DONE 09-18 | Placed at the **registration-view level, not step 1** as planned (K7): a resumed draft can open on a later step, where a step-1 input would not exist |
| B17 | S3 | `referral-deeplink.spec.ts` | 🤖 | ✅ DONE 09-18 | **8 tests, all pass** (plus the 5 division tests, unharmed). **Mutation-tested**: reintroducing the read-too-late bug fails 5 of them; flipping URL-beats-draft fails the 1 test written for it |
| S3.V | S3 | Tests · tsc · lint · new spec | 🤖 | ✅ DONE 09-18 | 471 unit tests pass · `tsc` clean · lint at the 34-problem baseline · **full visual suite 187/187, Playwright exit 0** — the hidden input moved no screenshot baseline, as the plan predicted |
| S3.L | S3 | Live vendor signup through a real link | 🤝 | ✅ DONE 09-19 | **You ran it** — and it is **machine-corroborated**: the export query shows the row it wrote ("Tig" by JanCro, credited to Nina via NINA2026, 2026-09-19 03:23) |
| I1 | S4 | Architecture docs | 🤖 | ✅ DONE 09-19 | `schema.md` · `auth-and-roles.md` · `portals.md` · `conventions.md` · `command/README.md` · **plus** `overview.md` + `portals.md` corrected on the service worker (K15) |
| I2 | S4 | Affiliate login-block check | 👤 | ✅ DONE 09-19 | **Your report:** everything refused / admitted as expected. Recorded as your verification, not observed by me |
| I3 | S4 | Report queries | 🤝 | ✅ DONE 09-19 | Verified on **local** (2 rows, primary user resolved) and **staging** (Dance ↔ TESTREF). Production not reported separately — same migration, same queries |
| S4.1 | S4 | Migrate staging, then production | 👤 | ✅ DONE 09-19 | **Staging verified read-only**: `migration list --linked` shows `20260917000001` applied, nothing unapplied. **Production per your report** — the CLI is linked to staging, so I cannot see it |
| S4.2 | S4 | Production release: vendor + Command | 👤 | ✅ DONE 09-19 | **Probe-verified**: vendor `dpl_8zXk851y…` captures `?ref=` (incl. the WordPress link shape) on the **production** DB; Command runs the fixed SW. Needed a Promote of a *Staged* build (K18) |
| S4.L | S4 | Production signup test | 👤 | ✅ DONE 09-19 | **User ran it in production**: affiliate created, signup through the link, count 0 → 1 on activation. Passed |
| K18 | S4 | Vendor promote came out "Staged" | 👤 | ✅ RESOLVED 09-19 | After a rollback, Redeploy makes staged builds; Promote attaches the domain |
| S4.3 | S4 | Commits in each repo | 👤 | ✅ DONE 09-19 | **Verified read-only.** Root: `wordpress_work` fast-forwarded into `master` at `eaa5e5a`, branch deleted, pushed (`master...origin/master`, nothing ahead); all 7 doc markers present on `master`. backbone `7ff008c`, command `19d4c37`, vendor `b3ac33d` — each clean and pushed on its feature branch. **Those three still need to reach whatever branch deploys** before S4.2 |
| ~~K10~~ | S4 | ~~WordPress plan V5~~ | 👤 | ✖ **OUT OF SCOPE** 09-19 | **Descoped by the user.** Belongs to the WordPress plan. The vendor side it needs is live — the plugin's link shape was probe-verified in production |
| K11 | S4 | Staging vendor served a pre-referral build | 👤 | ✅ RESOLVED 09-19 | Cause (user-observed): **Vercel deployment delay** — deployments took a while to appear and go live. Two earlier theories retracted |
| K12 | S4 | Production vendor was promoted ahead of plan | 👤 | ✅ ROLLED BACK 09-19 | **Verified by probe**: `vendor.ezzy.ph` now serves `dpl_ETomWCbSx…` — no `?ref=` capture, no `referral-code`, **production** DB. Staging unaffected. Next production release must be **Promoted** (auto-assign is off after a rollback) |
| K13 | S4 | Staging end-to-end with a real signup | 👤 | ✅ DONE 09-19 | "Dance" credited `TESTREF` while still `pending_activation` — the live path works on a hosted environment |
| K14 | S4 | Staging Command showed 0 referrals while the row existed | 🤖 | ✅ ROOT-CAUSED 09-19 | Not a feature bug: Command's service worker replayed a cached `/api/affiliates` response. → K15 |
| K15 | S4 | Command SW cached API responses incl. decrypted bank details | 🤖 | ✅ **FIXED IN PRODUCTION** 09-19 | **Verified live**: `command.ezzy.ph/sw.js` = `offline-v2` + `/_next/static/` guard, production DB. ⚠️ K17 |
| K17 | S4 | Production ahead of its branches | 👤 | ✅ DONE 09-19 | **User synced** both `production` branches to what is deployed (user's report; git is theirs) |
| K16 | S4 | My test left local vendor Tig `active` | 👤 | ⏸ PARKED 09-19 | **User's decision: leave it** — local only; cleared by the next `db reset` |
| D15 | S4 | What "Referred vendors" counts | 👤 | ✅ (c) 09-19 | Activated only. **Confirmed on staging**: the count rose as soon as the vendor was activated |

---

## On completion (2026-09-19)

**Shipped — live in production on vendor and Command:**
- Any user can be made an **affiliate** with an admin-chosen referral code — a capability, not a
  role, so nobody's access changes (D11). Created, assigned, changed and removed from Command's
  Users page; the detail view shows the code, a share link, and the activated vendors (D15).
- A vendor signing up through **`?ref=CODE`** is credited to that affiliate — captured at page
  load, carried invisibly through the wizard and the draft, and written in the same request that
  creates the vendor. A bad or missing code never blocks a signup (D2).
- **Reporting:** Command's "Export all affiliates (CSV)", plus the per-vendor export SQL in
  `architecture/schema.md`.
- **A pre-existing security fix (K15):** Command's service worker had been caching every API
  response since 2026-08-18 — including **decrypted bank details**, which also bypassed the
  payout view audit. Found while chasing a stale count; fixed, verified against the old and new
  worker, and live in production.

**Verified by:** unit tests (Command 136, vendor 471 — referral tests included); a mutation-tested
Playwright spec for the deep link; the full visual suite (187/187); psql checks of the migration
(constraints, grants, RLS, `SET NULL`); four scripted end-to-end registrations locally; read-only
probes of every hosted domain (build, capture, database wiring); and the user's own click-throughs
and signups locally, on staging and in production.

**Aborted, and why:** B2 and B7 — access and role-change guards that only existed while affiliate
was a role; D11 removed the collision they guarded.

**Out of scope:** K10 — the WordPress plugin's end-to-end check, descoped by the user; it belongs
to the WordPress plan. Its vendor-side dependency is live and probe-verified.

**Parked:** K16 — local test vendor Tig left `active` by my test harness. The user chose to leave
it: local only, cleared by their next `db reset`.

**Not verified by me:** the production report queries (run on local and staging only); the
production-branch sync (K17, the user's report — git is theirs); the vendor mobile app's refusal
of an affiliate (I2, the user's report).

**Worth carrying forward:**
- **Booker's service worker still has K15's flaw** — latent only, because booker has no GET API
  routes today. The first GET route added to booker will be cached forever unless the worker is
  narrowed to `/_next/static/` first.
- **After a Vercel Instant Rollback, production deploys come out "Staged"** until one is
  *Promoted* (K18). A Redeploy only adds another staged build.
- Any future embed between `profiles` and `affiliates` must name its foreign key — the table has
  two, and a bare embed fails the whole query (K1).

