# Vendor sign-up — production preparations

**Date:** 2026-08-07
**App / scope:** `vendor/` (registration + KYC), `command/` (approval queue),
`backbone/` (notification types, hosted auth + email config)
**Status:** 🔄 **IN PROGRESS — executed 2026-08-08.** 18 of 22 items ✅ DONE,
**1 shipped with a regression (A-B7)**, 3 ⏸ PARKED (A-B3 by user decision; A-B4 and
A-B5 are hosted-dashboard only, with no code to write).

> ✅ **A-B7's CSP regression is fixed** (2026-08-08) — see
> `.plans/2026-08-08-csp-blocks-supabase-connections.md`. Both portals sign in
> again, verified in a browser. **A-B1 has now also been proven end to end against
> the live stack** (F3 below).
>
> 🔎 **Live testing on 2026-08-09 raised three items — see "Findings from the
> user's live testing" below.** Two are environment, not code: the Edge Function's
> `.env` is missing (so *no* notification email is delivered) and migration
> `20260808000001` is unapplied (so no vendor-facing notification row is written).
> The third — "the new user is active" — is the design working correctly; changing
> it would break the pending-vendor experience.

**A-B1 — the launch blocker — is now done**: registration is a three-hop flow with
signed upload URLs, so the packet no longer passes through a Route Handler body.
It still wants confirming on a deployed preview, since the 4.5 MB limit cannot be
reproduced locally.

> **Verification actually run (2026-08-08):** `tsc --noEmit` 0 in `vendor` and
> `command`; `npm test` 39/39 in `vendor`; `npm run build` succeeds in both.
> **Playwright: 27 passed / 34 failed — every failure is a snapshot comparison and
> the drift is PRE-EXISTING, not caused by this work.** Proven by stashing every
> change in `vendor` and re-running: `grid-light` still failed on a pristine tree.
> The cause is Next's dev-overlay "1 Issue" badge appearing in the bottom-left of
> full-page captures; the mask in `pilot.spec.ts:15` covers only the bottom-*right*
> version badge. All interaction tests pass. Baselines were deliberately **not**
> regenerated — doing so would bake in both the pre-existing drift and this work's
> intended changes in one indistinguishable commit. See "Follow-ups" at the end.
>
> **One regression was introduced and fixed during execution:** the first CSP
> omitted `'unsafe-eval'`, which Next's dev server needs for HMR. React never
> hydrated, and ~15 interaction tests failed with "element not found" — no mention
> of CSP anywhere. Now dev-only via `NODE_ENV`, with the reasoning recorded inline
> in both configs.

<details><summary>Prior status</summary>

**DRAFT** — investigation complete, **all 9 decisions closed**, and
**self-contained as of 2026-08-08**: the eleven relevant items were migrated out
of `.plans/2026-08-02-web-apps-production-launch-readiness.md` (`LR`), which stays
📌 **pinned and untouched**. Nothing here depends on unpinning it.

**Not yet approved for execution.** One precondition remains: **the baseline has
not been re-established** — `npx tsc --noEmit` in `vendor` and `command`, plus
`npm test` and `npx playwright test` in `vendor`. Nothing in this investigation
changed code, so it is presumed intact but unverified. Run it before Stage A.

The user has said they may still add to this plan.

</details>

## Findings from the user's live test (2026-08-09)

### F1 — No email reaches Mailpit: TWO independent causes, neither in app code  ⬜ TODO · **👤 both are yours**

Diagnosed against the running local stack. `notifications` rows **are** being
written — 10 command-addressed rows from the test registration — so the app side
works. The failure is downstream, twice over:

1. **`backbone/supabase/functions/.env` does not exist.** The Edge Function reads
   `NOTIFICATION_EMAIL_SECRET` (`send-notification-email/index.ts:23`) and returns
   **401** when it is undefined (`:25`). Confirmed directly: every row in
   `net._http_response` is `401 {"error":"unauthorized"}`, and Mailpit reports
   `{"total":0}`. The vault secrets **are** set and the function **is** served
   (endpoint answers 405 to GET) — the only missing piece is the function's own env
   file, which is gitignored and so does not survive a clean checkout.
   **This blocks every notification email, not just registration** — which matches
   "I used to get these before".
2. **Migration `20260808000001` is not applied.** Last applied is `20260807000001`
   (`supabase_migrations.schema_migrations`), so `vendor_registration_received`
   does not exist, `maybeSingle()` returns null, and **no vendor-addressed row is
   written at all.** Even with (1) fixed, the vendor acknowledgement cannot fire.
   `20260807000002_prevent_last_root_removal.sql` is also unapplied.

**Fix:** restore `supabase/functions/.env` with `NOTIFICATION_EMAIL_SECRET` matching
the `notification_email_secret` vault entry, then
`npx supabase migration up --local`. Both are environment, not code — recorded here
so the cause is not rediscovered.

### F2 — "New user is active" is correct behaviour, not a bug  ✖ NO CHANGE NEEDED (2026-08-09)

Verified with a **controlled end-to-end registration** through the current code
(which also exercised A-B1 for the first time — `prepare` → direct upload 200 →
`register` created the vendor, and the document landed at `{vendorId}/…`):

| | Result | Correct? |
|---|---|---|
| `profiles.status_id` | **active** | ✅ by design |
| `vendors.status_id` | **pending_activation** | ✅ this is the gate |
| `vendor_kyc.status` | submitted | ✅ |

**Two different statuses answer two different questions.** `profiles.status_id` is
"may this *person* use the platform at all"; `vendors.status_id` is "is this
*business* approved to trade". The approval gate the user is asking for is the
second one, and it is working — the vendor is `pending_activation` and invisible to
bookers until Command activates it.

⚠️ **Setting the profile to `pending_activation` would break the vendor, not gate
them.** `is_active()` backs **42 RLS policies** (counted in `pg_policies`). A vendor
whose profile is not active cannot read their own vendor row, their own KYC header
or their own documents — so the pending-status screen and the whole
revise-and-resubmit flow stop working. This is the property D1/D9 depend on and
`auth-and-roles.md` documents at step 2.

**The anomaly is the other way round.** `kora@gmail.com` currently has
`profiles.status_id = pending_activation`, fails `is_active()`, and therefore cannot
see anything — almost certainly because it was changed in Command after the "active"
observation. A fresh registration does not reproduce it.
*(Note: that row was briefly set to `active` during diagnosis and then **restored to
`pending_activation`**, the state it was found in. Say the word and I will set it to
`active` so the account works.)*

---

## Findings from the user's live testing (2026-08-09)

Three reports, investigated against the running local stack. **None is a code
defect in this plan's work** — one is a missing local env file, one is an unapplied
migration, and one is the design working as documented.

### F1 — No emails in Mailpit: TWO independent causes, both environment  ⬜ TODO · 👤 user-owned

**Cause A — the Edge Function rejects every dispatch with 401.**
`backbone/supabase/functions/.env` **does not exist**, so `NOTIFICATION_EMAIL_SECRET`
is undefined inside the served function and it returns `401 unauthorized` at
`send-notification-email/index.ts:23-25`. Confirmed directly:

```
select status_code, error_msg from net._http_response order by created desc limit 4;
→ 401 {"error":"unauthorized"}   ×4
mailpit /api/v1/messages → {"total":0}
```

The vault secrets themselves are fine (`edge_function_base_url`,
`notification_email_secret` both set) and the function *is* being served (the
endpoint answers 405 to a GET). The mismatch is only that the function has no
secret to compare against. **This breaks every notification email, not just
registration** — which matches "I used to get these before": the file is gitignored,
so it does not survive a clean checkout.
**Fix:** recreate `backbone/supabase/functions/.env` with
`NOTIFICATION_EMAIL_SECRET` matching the `notification_email_secret` vault value.
See `architecture/email-secrets-setup.md`.

**Cause B — migration `20260808000001` is not applied.**
Last applied is `20260807000001`; both `20260807000002_prevent_last_root_removal`
and `20260808000001_vendor_lifecycle_notification_types` are pending. So
`vendor_registration_received` does not exist, `typeAck` is null, and **no
vendor-addressed row is written at all** — confirmed: the only rows from the test
registration are `new_user_registration` and `vendor_pending_approval`, both
`portal = command`.
**Fix:** `cd backbone && npx supabase migration up --local` (keeps existing data).

⚠️ **Both must be fixed.** Cause B alone means no vendor row exists to email; cause
A alone means the row exists and the email is still never delivered.

### F2 — "The new user's status is active" — this is correct, and is load-bearing  ✅ NO CHANGE NEEDED (2026-08-09)

Verified with a controlled end-to-end registration against the running stack:

| | |
|---|---|
| `profiles.status_id` | **active** |
| `vendors.status_id` | **pending_activation** |
| `vendor_kyc.status` | **submitted** |

That is exactly what `architecture/auth-and-roles.md` specifies, and the two are
different things:

- **`profiles.status_id` = can this PERSON use the platform** → active, so they can
  log in and see their own KYC status and resubmit after a rejection.
- **`vendors.status_id` = is this BUSINESS approved to trade** → pending_activation.
  **This is the gate**, and it is working: the vendor is invisible to bookers and
  lands on the KYC status surface, not the app.

⚠️ **Setting the profile to `pending_activation` would break the pending-vendor
experience entirely.** `is_active()` is referenced by **42 RLS policies** (counted
in `pg_policies`). A profile that fails it cannot read its own vendor row, its own
KYC header, or its own documents — so the "under review" screen and the whole
revise-and-resubmit flow become unreachable. D1/D9 depend on the account staying
usable for exactly this reason.

**On the specific account:** `kora@gmail.com` currently has
`profiles.status_id = pending_activation`, so it fails `is_active()` and is
effectively locked out. A fresh registration through the current code produces
`active`, so this is not what the route does — most likely it was changed in
Command after "active" looked wrong. **Setting it back to `active` will repair that
account**; left as the user's call rather than changed unilaterally.

### F3 — A-B1 verified end to end for the first time  ✅ DONE (2026-08-09)

The three-hop flow was exercised against the live stack, which had never been
possible before (the CSP bug blocked it, and before that it did not exist):

```
1. prepare  → 1 signed upload URL                      OK
2. direct upload to Storage with the token             HTTP 200
3. register → {"vendorId":"93d88dba-…"}                OK
   document landed at {vendorId}/…-id.pdf              (moved out of pending/)
```

Test data was removed afterwards (vendor row, auth user, storage object) —
verified zero rows remain.

---

## Follow-ups discovered during execution (2026-08-08)

- ~~**The vendor visual baselines are all stale.**~~ ✅ **RESOLVED (2026-08-08).**
  Root cause was Next's **dev indicator**, which renders into the bottom-left of
  every fullPage capture and appears/disappears with compile state. **Masking was
  the wrong fix** — it lives in a shadow root with no stable light-DOM selector
  (verified: `elementFromPoint` at the badge position returns a plain `div`, and
  `document.body.children` contains no `nextjs-portal`). Instead the indicator is
  **switched off for test runs only**: `playwright.config.ts` starts the server
  with `PW_TEST=1`, and `next.config.ts` maps that to `devIndicators: false`. A
  normal `npm run dev` is unaffected. Baselines regenerated on that basis.
  **Result: 34 failures → 3.** ⚠️ Note in the config: a dev server you already had
  open will be *reused* and will still show the indicator — stop it first.
- ~~**Rotating snapshot failures on every full run.**~~ ✅ **RESOLVED (2026-08-08)** —
  **61/61 green on two consecutive full runs.** Root cause was Next's dev overlay
  the whole time, in `<nextjs-portal>`.

  > **Two wrong diagnoses on the way, recorded so they are not repeated.**
  > 1. **"Mask it from the test file."** Cannot work — `nextjs-portal` is a custom
  >    element with a **shadow root**, and Playwright's `mask` needs a locator.
  > 2. **"It's text antialiasing; make rasterisation deterministic."** Wrong. The
  >    Chromium font flags were added and the failure count went *up* (3 → 4). I had
  >    over-read a faint diff as glyph noise; every diff was the bottom-left badge.
  >    A third theory — a webfont-loading race — was also ruled out: `globals.css:181`
  >    asks for `'Inter'` but nothing loads it (no `next/font`, no `@font-face`, no
  >    link), so it falls back to `system-ui`. Nothing to load, nothing to race.
  >
  > **What actually works:** `expect.toHaveScreenshot.stylePath` →
  > `vendor/playwright-screenshot.css`, which sets `nextjs-portal { display: none }`.
  > Hiding the host kills the subtree whatever the overlay decides to render.
  > ⚠️ `devIndicators: false` alone is **not** sufficient — the element is still
  > present and still paints. Both are kept: the config reduces when it appears, the
  > stylesheet guarantees it never lands in a capture.

  **`maxDiffPixels: 500` was considered and rejected.** It would have hidden the same
  noise, but 500 px is roughly a 22×22 block — enough to mask a badge changing
  colour, a dropped icon, a 2–3 character label change or a missing 1px card border,
  on *every* test forever. Those are exactly what this suite exists to catch, and
  several are the shape of Stage B's own changes. The zero-pixel threshold is a
  deliberate project choice and stays intact.

  The Chromium font flags are **kept** — they did not fix this, but deterministic
  rasterisation is right for a pixel-exact suite and removing them would cost a
  fourth baseline regeneration for no gain. The comment beside them says as much.
- **`command` has no `visual-tests/` at all**, so none of Stage B's UI changes have
  snapshot cover. Its Playwright config also still points at `127.0.0.1`.
- **`price label follows the duration unit`** failed once in a full parallel run
  and passes in isolation — a flake, not a regression. Worth a look if it recurs.
- **`A-I1`'s `profiles.email` lookup** is now live and unindexed, as accepted under
  Deferred. It is called on a debounce from a public endpoint, so it is the first
  thing to revisit if that table grows.

**Revised 2026-08-08 (sixth pass)** — added **A-B7** (no security headers),
migrated from LR-B7 at the user's direction and narrowed to `vendor` + `command`;
booker's Leaflet and PayMongo CSP directives dropped, and LR's copy annotated to
record that they are still owed if booker ever launches. Stage A is now 7
blockers (one parked).

**Revised 2026-08-08 (fifth pass)** — **migrated 11 items out of `LR` so this plan
is self-contained and `LR` can stay pinned.** A-B1, A-B2, A-B3, A-B4, A-B5, A-I8,
B-B4, B-I1, B-I2 now carry their full analysis inline; A-B5 merges LR-I4 + LR-I5
and is escalated to a blocker; LR-I12 stays reframed under D6. Each migrated item
is annotated `🔀 MOVED` in `LR` so it cannot be executed twice. **`LR-B7` (no
security headers) was deliberately *not* migrated** — flagged in the migration
table as worth reconsidering before a public launch.

**Revised 2026-08-08 (fourth pass)** — **D5 and D8 both closed on Option B.** No
decision now blocks execution. A-I1 gains hard implementation constraints for the
new enumeration endpoint (POST-only, WAF-covered, bare boolean, neutral copy,
debounced) and a **coupling to A-B2 — it must not ship unthrottled**. B-B2 gains
the confirmation dialog, following the existing thin-wrapper pattern; noted that
`DeleteConfirmModal` is delete-specific and needs generalising first.

**Revised 2026-08-08 (third pass)** — **A-B3 (privacy notice + consent) ⏸ PARKED**
at the user's direction; Stage A's gate drops from 6 blockers to 5. The park is
recorded with its reasoning at the item, since it defers a disclosure obligation
rather than code.

**Revised 2026-08-08 (second pass)** — added **B-B5** (status changes silently
revert vendor-edited fields; escalated from a sub-bullet of B-B2 to a coupled
blocker after confirming the vendor portal writes four of the same columns).
**Confirmed first-hand that a registering vendor receives no email at all**, at
four independent points — see A-B6. **D9 supersedes D1**: the sign-up email
becomes a plain acknowledgement with nothing to click. **Corrected Appendix A's
draft migration**, which omitted the `not null` `label` column and would have
failed.

**Revised 2026-08-08** — user corrected the Stage B model. KYC review and vendor
activation **stay independent and both stay manual** (**D6**); `reviewKyc` is
correct as-is and is no longer treated as a defect. Stage B rewritten around three
UI facts instead: `pending_activation` is the correct first state, "Reinstate" is
for suspended vendors only, and the admin needs a KYC-completion indicator to
decide from. Added **B-B3** (KYC indicator, new), reframed **B-B2**, renumbered
LR-B12 to **B-B4**, reframed `LR-I12` from a gate to a visibility requirement, and
took `NOTIFICATION_EMAIL_OVERRIDE_TO` out of scope as user-owned (**D7**).

> **Goal.** Put `vendor` into production for one job only: **a real vendor can
> complete sign-up and KYC, and what they submit is safe, reachable and reviewable
> later.** Features come afterwards. Approval through `command` happens later, but
> "later" must still be *possible* — Stage B exists because today it is not.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, N# = new finding from this
> audit, D# = Decision. Numbers are plan-local. **Items prefixed `LR-` belong to
> `.plans/2026-08-02-web-apps-production-launch-readiness.md`** and are referenced,
> not restated — go there for the full analysis and fix approach.

---

## 0. Scope

**In scope:** everything between "a vendor opens the vendor portal" and "a Command
admin can act on their application" — the registration form, the atomic submit
route, KYC capture and storage, the pending/rejected surfaces, and the Command
queue that makes collected sign-ups actionable.

**Out of scope, deliberately:** offerings, schedules, bookings, payments, payouts,
fulfilment, `booker` (not deployed — see D4), and the mobile apps. Those are the
"features later" the user named, and none of them is on the sign-up path.

**This plan does not duplicate `LR`.** That plan
(`.plans/2026-08-02-web-apps-production-launch-readiness.md`, **📌 PINNED**) is the
authoritative production audit and already carries nine blockers with full fix
approaches. This plan does three things `LR` does not:

1. **Narrows its gate** to sign-up, and says which `LR` blockers fall out of scope
   once the goal is "collect applications", not "operate the platform".
2. **Re-verifies `LR`'s citations** against today's code — `LR`'s own unpin
   checklist item 1 requires this, and the offering/schedule refactor landed in
   `vendor` on 2026-08-05/06/07 since `LR` was written. Results in §1.
3. **Adds 12 findings `LR` does not have** (N1–N12), from a fresh audit of the
   sign-up and KYC path on 2026-08-07.

> ### 📦 Migration from `LR` — this plan is now self-contained (2026-08-08)
>
> **`LR` stays 📌 PINNED and is not unpinned by this plan.** Rather than depend on
> it, the eleven sign-up- and approval-relevant items have been **copied here in
> full**, with their citations re-verified against today's code. Nothing in this
> plan now requires `LR` to be opened or executed.
>
> | Now in this plan | Was | Scope change on migration |
> |---|---|---|
> | **A-B1** | LR-B2 | none |
> | **A-B2** | LR-B6 | narrowed to `vendor` — `booker`'s route is out of scope (D4). Two anchors corrected |
> | **A-B3** ⏸ | LR-B11 | narrowed to `vendor` |
> | **A-B4** | LR-B1 | narrowed to `vendor` + `command` (D4) |
> | **A-B5** | LR-I4 **+** LR-I5 | merged; **escalated** to blocker |
> | **A-I8** | LR-I10 | none |
> | **B-B4** | LR-B12 | none |
> | **B-I1** | LR-B5 | merged with this plan's N2 |
> | **B-I2** | LR-B4 | none |
| **A-B7** | LR-B7 | narrowed to `vendor` + `command`; booker's Leaflet/PayMongo directives dropped. Both anchors corrected |
> | *(reframed, not copied)* | LR-I12 | became a visibility requirement — see D6 and the row below |
>
> **Deliberately left in `LR`, not migrated:** B3 (Command's fabricated figures),
> B8, B9, B10 (booker unreachable — moot under D4), I1, I2, I3, I6, I7, I8, I9,
> **I11 (vendor deletion orphans ID photos — coupled to A-B3, pull it in when that
> unparks)**, I13.
>
> **Bookkeeping done in `LR`:** each migrated item now carries a
> `🔀 MOVED (2026-08-08)` banner pointing here, so a future session cannot execute
> it twice. That is an annotation only — **no code was written from `LR`, and its
> pin is intact.**

---

## 1. Re-verification of `LR`'s citations (done 2026-08-07)

Required by `LR`'s unpin checklist. Every sign-up-relevant anchor was re-opened.

| `LR` item | Citation status | Note |
|---|---|---|
| LR-B2 (413 on Vercel) | ✅ **still accurate** | `register/route.ts:13` (`MAX_FILE_BYTES`), `:71-77` (per-file validation), `:146-154` (upload loop) all unmoved. `useLoginPage.ts:292` (`addKycDoc` size check) unmoved |
| LR-B6 (unauth / unthrottled / weak password) | ⚠️ **two anchors moved** | `route.ts:20-190`, `:30`, `:99` and `config.toml:179` still accurate. But the client 8-char checks cited as `useLoginPage.ts:132, :195` are now at **`:130` (`computeResumeStep`), `:193` (`handleResetPassword`) and `:247` (`handleAccountContinue`)** — three sites, not two |
| LR-B11 (no privacy notice / consent) | ✅ **still accurate, and confirmed by grep** | `grep -rni "privacy\|terms\|consent\|agree"` across `vendor/components/auth`, `vendor/components/kyc`, `vendor/lib`, `vendor/app` returns **zero** matches outside unrelated code comments. There is no consent surface of any kind |
| LR-B1 (recovery redirect allow-list) | ✅ still accurate | `useLoginPage.ts:181` passes `window.location.origin` as `redirectTo`; hosted allow-list is not in source control |
| LR-B12 (no first Command user) | ✅ still accurate | In the gate now that `command` is deployed (D4) |
| LR-I10 (wrong email unrecoverable) | ✅ still accurate | Superseded in part by D1 — see N2 |
| LR-I12 (activation ignores KYC state) | ⚠️ **reframed, not escalated — see D6** | `LR` framed this as a defect: "Command *can* activate a vendor whose KYC was rejected". Under **D6** that independence is **intended** — activation is a human decision and KYC is advisory to it (`20260706000001_vendor_kyc.sql:66` says so). So this is not a gate to build. It becomes a **visibility** requirement instead, met by **B-B3**: the admin may activate a rejected-KYC vendor, but must never do so *without seeing* that it was rejected. **D8** adds a confirmation dialog on top of the badge for `rejected` and `null` |

**False alarms found and dropped** (recorded so they are not rediscovered):

- **"Lookup rows will be missing on a fresh production project."** Not a risk.
  `statuses`, `roles`, `portals` are seeded by `20260504000001_lookup_tables.sql`,
  `divisions` by `20260724000004_divisions.sql:29-41`, notification types by
  `20260525000001_notification_type_settings.sql`. The register route's
  "Server configuration error" branch (`route.ts:111`) is unreachable on a
  correctly migrated project.
- **"Command's KYC file viewing is broken against a private bucket."** It is
  correct. `command/services/kyc-admin.service.ts:97-101` uses `createSignedUrl`
  (60s), and `20260706000002_vendor_kyc_storage.sql:56-64` grants command
  admins `select` on those objects. `getPublicUrl` appears nowhere in the repo.
  *(One cosmetic leftover: `useKycPanel.ts:43-51` still carries a "Mock phase:
  no real file exists until the storage backend lands" comment and toast. Dead
  copy, not a defect — listed under Deferred.)*
- **"Resubmit-after-rejection is not implemented."** It is, fully and
  RLS-backed: `vendor/services/kyc.service.ts:146-192` (selective edit, header
  flipped last) against the `status = 'rejected'` policies in
  `20260706000001_vendor_kyc.sql:78-81,122-134`. `architecture/vendor-kyc.md`'s
  claim is accurate. **No work needed.**

---

## STAGE A — a vendor can complete sign-up, safely

### A-BLOCKERS

#### A-B1 — Registration will 413 on Vercel: the whole packet posts through one Route Handler  ✅ DONE (2026-08-08)
<!-- ✅ Built as specified: POST /api/auth/register/prepare mints signed upload URLs
     under pending/{submissionId}/, the browser uploads direct to Storage, and
     POST /api/auth/register (now JSON) creates everything then storage.move()s the
     objects to {vendorId}/. Shared validation extracted to lib/registration.ts so
     the two routes cannot drift; register re-validates in full. Rollback sweeps the
     staging prefix; the success path clears unclaimed files. maxDuration set on
     both (30s / 60s). Caps enforced server-side AND client-side.
     ⚠️ Deviation worth knowing: the per-submission TOTAL is re-derived in register
     from the real Storage listing, not from the manifest prepare was given — the
     browser uploads with a signed token, so declared sizes are unverified claims,
     and the bucket caps per-file but has no notion of a submission total.
     Verified: tsc 0, build 0, 39/39 unit, 61/61 Playwright.
     NOT verified: the 4.5 MB behaviour itself, which needs a deployed preview. -->
<!-- ⏸ superseded prior status: PARKED (2026-08-08) — partially done -->
<!-- Also updated: architecture/auth-and-roles.md and architecture/vendor-kyc.md,
     which both still described the single multipart route. -->

> **⚠️ Still needs a deployed preview to close out.** Everything above is
> machine-verified locally, but the failure this item exists to fix — Vercel
> rejecting a >4.5 MB body — cannot be reproduced on localhost. Confirm on a
> preview deployment with a genuinely large packet before treating it as proven.
*(Migrated from LR-B2, 2026-08-08. Citations re-verified against today's code.)*
**Files:** `vendor/app/api/auth/register/route.ts:13,71-77,146-154`;
`vendor/components/auth/LoginPage/useLoginPage.ts:292`

**The single hard blocker: without this, a real vendor cannot sign up at all.**

The registration submit sends *every* KYC file as one multipart POST to the Route
Handler. Per-file the cap is 10 MB, client- and server-side. There is **no cap on
the number of files** (`form.getAll("files")` at `:71`, loop at `:146`) and **no
cap on total payload**.

Vercel Serverless Functions cap the request body at **4.5 MB**. A realistic packet
— a scanned business permit PDF plus DTI registration plus the two camera captures
— passes both existing checks and is rejected by the platform before the handler
ever runs. The client shows a generic failure, and because the flow is
atomic-by-design, the vendor cannot get past registration.

Two aggravating facts:
- The camera captures are *not* the problem — `vendor/lib/captureImage.ts:4-8`
  emits 1280px JPEG at q0.9, ≈200–400 KB each. The uploaded documents are.
- The **resubmit** path does not have this problem: `resubmitKyc`
  (`vendor/services/kyc.service.ts:146-192`) uploads straight to Storage with the
  vendor's own session, subject only to the bucket's 10 MB limit. Registration and
  resubmit already behave differently for the same file — which is why the fix
  moves registration *toward* resubmit, not the other way.
- No `export const maxDuration` on the route. Several MB plus N sequential Storage
  uploads can exceed the default function timeout independently of size.

**Fix approach — signed upload URLs, in the order the steps must happen:**

⚠️ **The obvious implementation is wrong and would pass a casual review.** The
bucket's `storage.objects` policies key on
`(storage.foldername(name))[1]::uuid = vendor id` (`20260706000002`). At
registration time **the vendor row does not exist**, so there is no valid final
path to sign. Uploading to `{anything}/…` yields documents that neither the vendor
(resubmit view) nor Command (review panel) can ever read — and the failure
surfaces days later at review, not at upload.

1. **`POST /api/auth/register/prepare`** — validates *every* field exactly as the
   current route does (before creating anything, as today), then mints one
   `createSignedUploadUrl` per file under a **staging prefix**
   `pending/{submissionId}/{uuid}-{safeName}`, where `submissionId` is a
   server-generated UUID. Returns the URLs + `submissionId`. Creates nothing.
2. **Browser uploads directly to Storage** with those tokens. Signed upload tokens
   bypass RLS by design, so the staging prefix needs no policy.
3. **`POST /api/auth/register`** — receives `{ submissionId, labels, fields }`
   (JSON, kilobytes, no body-limit exposure). Performs the existing atomic create,
   and once `vendorId` exists, **`storage.move()`s each object** from
   `pending/{submissionId}/…` to `{vendorId}/…` under service role before
   inserting the `vendor_kyc_documents` rows with the final paths.
4. **Rollback extends to the staging objects.** The existing `rollback()`
   (`route.ts:89-95`) already removes uploaded paths; it must now also clear the
   staging prefix, including paths that failed to move. An abandoned prepare
   leaves only staging objects — sweep `pending/` older than 24h with a small
   script or cron. Note it; do not gold-plate it.

**Required alongside — the signed-URL route removes the *body* limit, not the
abuse surface:**
- Document-count cap and total-bytes cap, enforced in `prepare` **and**
  client-side.
- `export const maxDuration` on both routes.
- **`prepare` is a public unauthenticated endpoint that mints Storage write
  tokens, so it inherits A-B2's rate limiting. ⚠️ Coupling, not a nice-to-have.**

**Two riders this plan adds:** A-I5's `docLabels` validation and A-I1's
duplicate-email check both belong in `prepare`, which already validates
everything before creating anything. Adding them elsewhere means a second
validation site that will drift.

**Atomicity is preserved in the sense that matters:** no auth user, vendor,
`vendor_kyc` header or document row exists until step 3 succeeds. What can exist
on failure is orphaned bytes under `pending/`, which is why step 4 exists.
`architecture/auth-and-roles.md:52-56` (D-7 = D) should be amended to say exactly
this, rather than left implying files and rows land together.

#### A-B2 — The public registration route is unauthenticated, unthrottled, and never verifies the email  ✅ DONE (2026-08-08)
<!-- ✅ code portion only — server-side 8-char floor, file-count/total-byte caps. WAF rules + hosted password settings are 👤 user/infra -->
*(Migrated from LR-B6, 2026-08-08, narrowed to `vendor` — `booker`'s register
route is out of scope per D4. **Two of LR's anchors had moved**; corrected below.)*
**Files:** `vendor/app/api/auth/register/route.ts:20-190,30,99`;
`vendor/app/api/divisions/route.ts:10`; `backbone/supabase/config.toml:179`

Three problems on one surface:

1. **No rate limiting or bot control anywhere.** Confirmed absent this session:
   **no `vendor/middleware.ts`, no rate-limit code, no captcha** — `grep` for
   `rateLimit|429|Retry-After|captcha|turnstile|hcaptcha` across `vendor/` returns
   nothing, and `[auth.captcha]` (`config.toml:211-214`) is commented out. The
   route runs the service-role client on unauthenticated input and writes N files
   of up to 10 MB each into the private bucket (`:146-154`) before anything else
   validates. A script can mint auth users and fill Storage. `/api/divisions` is
   also public service-role with no caching.
2. **`email_confirm: true`** (`:99`) — nobody proves they own the address. A typo
   produces a permanently inaccessible account, an orphan `vendors` row in
   `pending_activation`, and KYC documents sitting in Storage. Command cannot
   repair it: editing `profiles.email` does not touch `auth.users.email`, because
   the sync trigger runs auth → profiles only. **See A-I9**, and note **D9's
   acknowledgement email does not solve this** — it has nothing to click.
3. **Server-side password strength is weaker than the UI implies.** The client
   requires 8 characters; the route forwards whatever it is given (`:30`) and
   GoTrue's floor is `minimum_password_length = 6` (`config.toml:179`). A direct
   POST sets a 6-character password on a vendor account that will hold payout
   figures.

> ⚠️ **Anchor correction from LR.** LR cited the client's 8-character checks as
> `useLoginPage.ts:132, :195`. They are now at **`:130`** (`computeResumeStep`),
> **`:193`** (`handleResetPassword`) and **`:247`** (`handleAccountContinue`) —
> three sites, not two. All three must agree with the server.

**Fix approach.** Rate-limit keyed on IP + email. ⚠️ **In-memory will not work** —
serverless instances are per-request and share nothing, so a module-level `Map`
gives the appearance of a limiter and none of the behaviour.

**Resolved by D3: Vercel WAF rate-limit rules** — no code, no migration, no schema
gate. **First step is confirming WAF rate limiting is available on the account's
Vercel plan.** If it is not, the fallback is a `rate_limit_hits` table
(`key text, window_start timestamptz, count int`) written by the route under
service role — which **is a schema approval gate** and must be drafted with its
blast radius here before anything is written.

Alongside it:
- Enforce **8 characters server-side**, matching the three client sites above.
- Raise hosted `minimum_password_length` to 8 and enable leaked-password
  protection — **hosted dashboard, not `config.toml`**; see A-B5.
- **⚠️ Coupling: A-B1's `prepare` route and A-I1's step-2 check are both public
  endpoints introduced by this plan. Neither may ship before this item.**

#### A-B3 — Government IDs are collected with no privacy notice and no consent anywhere  ⏸ PARKED (2026-08-08)
*(Migrated from LR-B11, 2026-08-08, narrowed to `vendor`. Full content ported so
this plan is self-contained when it unparks.)*
**Files:** `vendor/components/auth/LoginPage/LoginPage.tsx` (the 6-step
registration); `vendor/components/kyc/IdentityStep/`; `vendor/app/` (no `privacy`
route)

**⏸ PARKED (2026-08-08) — user's decision: deferred to a later stage.**
**Unblock condition:** the user schedules it, or the first real applicant is about
to submit — whichever comes first.

> **Why this park is different from the others, recorded once and not repeated.**
> Every other parked item in this plan defers *code*. This one defers a
> **disclosure obligation that attaches the moment a real person uploads a real
> government ID**, and the park does not pause the collection — Stage A ships the
> thing that collects. Sensitive personal information in the Philippines is
> governed by the Data Privacy Act of 2012 (RA 10173); whether this flow satisfies
> it is a question for someone qualified to answer, not for this plan. Flagging so
> the deferral is a decision on record rather than an oversight. **It is your
> call, it is recorded, and the plan proceeds.**
>
> One practical consequence worth knowing: applications collected before the
> notice exists were gathered without one, and adding the notice later does not
> retroactively cover them. If that matters, the cheap mitigation is to keep Stage
> A's applicant volume small until this lands.

The flow captures a government ID photo **and a selfie holding it** — the most
sensitive category of personal data — with no consent checkbox, no privacy policy
link, no statement of what is collected, why, who sees it, or how long it is kept.
Re-confirmed by grep this session (§1).

There is no `/privacy` route in the app. Under the Philippine Data Privacy Act
2012 an ID image plus a selfie is sensitive personal information, and notice and
consent are required **at the point of collection** — though whether this
specific flow satisfies it is a question for someone qualified, not for this plan.

**Fix approach when unparked — three parts:**
1. A **`/privacy` route** in `vendor` (static page, no auth). Same content the
   mobile store listing will need (`portals.md` → Ezzy Vendor Mobile → Known
   Gaps), so writing it once unblocks both.
2. A **consent checkbox** on the KYC applicant-type step, gating Continue, naming
   what is collected, why, who reviews it, and the retention period.
   **Record the consent with the submission** — a checkbox that leaves no trace
   proves nothing. *(Recording it is a new column or table, i.e. a schema approval
   gate. Draft it at unpark time.)*
3. An **account-deletion request route**, which also closes the mobile app's
   equivalent blocker and is a Google Play requirement.

⚠️ **The long pole is copy, not engineering.** The retention period and the
deletion process are business and legal choices this plan cannot make, and may
need external review. Raise them early when unparking.

**Two couplings to honour when it unparks:**
- **A-I4** — the `localStorage` draft retains applicant PII indefinitely. A notice
  that omits local draft storage would be incomplete. Do them together.
- **`LR-I11`** (left in `LR`, deliberately not migrated) — deleting a vendor
  orphans their ID photos in Storage permanently. **The retention period stated in
  the notice must match what actually happens to the files**, or the notice
  describes a deletion that never occurs. Pull `LR-I11` in at that point.

**Component separation** (for whenever it lands): the consent checkbox's state and
its gating of "Continue" live in `useLoginPage.ts` alongside the other step gates
(`handleIdentityContinue`, `:328-335`); `LoginPage.tsx` renders only. Styling goes
in `LoginPage.module.css`. No new component is required — but if the notice grows
past a sentence and a link, it becomes `ConsentNotice/` with
`ConsentNotice.module.css` and no hook (pure display).

#### A-B4 — Password recovery is unreachable in production until the hosted redirect allow-list is set  ◐ PARTLY RESOLVED (2026-08-10)

> **`command` is proven.** Site URL is `https://command.ezzy.ph` on production
> `pdkejyjidrfxksaczvfy`, custom SMTP (Resend) is configured, and a **real recovery email
> was received and completed end to end** — user-confirmed 2026-08-10. Command's
> bootstrap dependency named below is therefore satisfied; the first root account exists
> and has a password.
>
> **`vendor` recovery has not been tested.** This item's own wording requires "a real
> recovery on each portal", so it stays open on that arm.
>
> ⚠️ **Do NOT do the `config.toml` half of the fix below.** That instruction is wrong:
> `config.toml` configures the **local** stack, where `localhost` is correct. Mirroring
> production URLs into it would break local dev and make an accidental
> `supabase config push` — which would overwrite production's auth URLs with development
> values — far less obviously wrong. See `architecture/overview.md` → "The CLI link is a
> loaded gun".
*(Migrated from LR-B1, 2026-08-08, narrowed to `vendor` + `command` per D4.)*
**Files:** `backbone/supabase/config.toml:154,160`;
`vendor/components/auth/LoginPage/useLoginPage.ts:181`;
`command/services/auth.service.ts:16`

Both portals request recovery with `redirectTo = window.location.origin`. GoTrue
validates that value against `SITE_URL` + `URI_ALLOW_LIST` and **silently falls
back to `site_url`** when it does not match. The repo's config still declares only
localhost:

```toml
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000", "http://localhost:3001",
                            "http://localhost:3002", "http://127.0.0.1:3000"]
```

**Why this is a blocker twice over:**
- **For sign-up:** a vendor registers, waits days or weeks for approval, and
  forgets their password. Recovery is the *only* way back in — D9's
  acknowledgement email has nothing to click, and there is no other channel.
  Without it, a vendor is permanently locked out of an account they successfully
  created, and Command has no repair path (A-I9).
- **For Command:** Command creates users with `auth.admin.createUser` and **no
  password** (`command/app/api/users/route.ts:37-41`). "Forgot Password" is the
  *only* way a Command-created user ever logs in for the first time. **B-B4's
  bootstrap script depends on this working** — see the hard dependency there.

**Fix approach:** on the production project set `site_url` to the vendor origin
and add both portal origins to the redirect allow-list; mirror it in
`config.toml` so the repo stops describing localhost as the truth. Verify with a
real recovery on each portal. Deep-link URLs for `ezzy-vendor-mobile` are a
**separate, later** entry — noted so this is not "fixed" twice.

<!-- verification: needs a live environment — a real recovery email per portal, end to end -->

#### A-B5 — Hosted auth settings are unverified, and `config.toml` is not them  ⏸ PARKED (2026-08-08)
*(Migrated from LR-I4 and LR-I5, 2026-08-08, and **escalated** from LR's
IMPORTANT tier — sign-up is the only thing launching, so if hosted auth is
misconfigured, the one feature going live is the one that breaks.)*
**File:** `backbone/supabase/config.toml:173,179,182,196,218`

`config.toml` is the **local stack's** config. It has no bearing on the hosted
project, whose auth settings live in the dashboard and are not in source control.
Everything this plan assumes about password length, signup policy, SMTP and
redirect URLs is therefore **unverified in production**.

Five values to confirm and correct on the **hosted** project:

| Setting | In repo | Risk | Target |
|---|---|---|---|
| `minimum_password_length` | `6` (`:179`) | weaker than the UI's 8 (A-B2) | **8** |
| leaked-password protection | not set | none | **on** (HIBP, dashboard only) |
| `enable_signup` | `true` (`:173`, `:218`) | anyone with the public anon key can call `auth.signUp()` and create `auth.users` + `profiles` rows outside the registration route | **false** — see below |
| `[auth.rate_limit] email_sent` | `2`/hour (`:196`) | if mirrored on hosted, **two** auth emails per hour project-wide. Password resets throttled to uselessness on day one, and D9's acknowledgement emails would compete with them | raise, with custom SMTP configured |
| redirect allow-list | localhost only | A-B4 | production origins |

**`enable_signup = false` is safe and worth doing** (was LR-I5): the registration
route uses `auth.admin.createUser`, which is **unaffected** by the flag, and
nothing in any app calls `auth.signUp()` (verified by grep). Turning it off closes
a public write path into `auth.users` at zero cost to the product. Verify the
registration route and Command's create-user route still work afterwards.

**Deliverable:** a short written record of the confirmed hosted values. Produce it
**first** — A-B2, A-B4 and A-B6 are all planned against assumptions until it
exists.

**Measured on production `pdkejyjidrfxksaczvfy`, 2026-08-10** (public
`/auth/v1/settings`, read-only):

| Setting | Measured | Target | State |
|---|---|---|---|
| `disable_signup` | `false` → **signup is ENABLED** | `enable_signup = false` | ❌ **still open** |
| `mailer_autoconfirm` | `false` | — | fine |
| `external.email` | `true` | — | expected |
| custom SMTP | configured (Resend, `no-reply@ezzy.ph`) | configured | ✅ done 2026-08-10 |
| redirect allow-list | Command origin proven working by a real recovery | production origins | ◐ Command ✅; **vendor untested** |

`minimum_password_length` and leaked-password protection are **not exposed** by that
endpoint — they still need a dashboard read.

⚠️ **`enable_signup` is the live one that matters.** With it `true`, anyone holding the
public anon key (it ships in every client bundle) can call `auth.signUp()` and create
`auth.users` + `profiles` rows outside the registration route entirely. Turning it off
costs nothing: the registration route uses `auth.admin.createUser`, which the flag does
not affect, and no app calls `auth.signUp()`.

<!-- verification: needs live environment; the deliverable is the written record -->

#### A-B6 — A registering vendor receives no email, ever  🔄 REGRESSED (2026-08-10) · **schema approval gate** · **N2**

> 🔴 **This was marked ✅ on 2026-08-08 and that is no longer true.** The user
> reported on 2026-08-10 that admins receive sign-up mail in Resend and the
> applicant receives none — the original symptom, back.
>
> **The app code survived; the `backbone/` half did not.**
> `vendor/app/api/auth/register/route.ts:265-272` still writes the vendor-addressed
> row, but the migration creating `vendor_registration_received` was **never
> applied and has since been deleted from the working tree** (last applied is
> `20260807000001`; the type is absent from the live DB, confirmed by query). The
> guard at `:256` therefore skips the insert, silently and by design.
>
> **Fix now lives in
> `.plans/2026-08-10-vendor-division-url-param.md` → B3**, with the migration
> re-drafted in that plan's Appendix A. Not duplicated here.
>
> ⚠️ Marking this ✅ while the migration was unapplied was the mistake — "code
> written" was recorded as "feature working". The item stays 🔄 until an
> acknowledgement email is observed in an inbox.
<!-- ✅ route writes a vendor-addressed `vendor_registration_received` row; migration file written (NOT applied); Edge Function union extended -->
**Files:** `vendor/app/api/auth/register/route.ts:99` (`email_confirm: true`),
`:158-187` (notifications written to **command admins only**)

> **Confirmed 2026-08-08, first-hand, at four independent points.** A vendor who
> signs up today receives **no email of any kind.** Not "probably not" — verified:
>
> 1. The register route contains exactly **one** `notifications` insert
>    (`route.ts:182`), and both row shapes it builds are `portal: "command"`
>    (`:171`, `:177`), addressed to command admins' `user_id`. **No row is ever
>    addressed to the registering vendor.**
> 2. The seeded notification types are exactly seven
>    (`20260525000001_notification_type_settings.sql:57-64`), and the two
>    registration ones describe themselves as *"Sent to Command"*. There is no
>    vendor-facing registration type to insert even if someone wanted to.
> 3. **No app sends email directly** — `grep -rn "resend|Resend|sendEmail"` across
>    `vendor/` and `command/` returns nothing. The only path is the
>    `send-notification-email` Edge Function, which is driven purely by inserts
>    into `notifications`. No vendor-addressed insert ⇒ no email.
> 4. `email_confirm: true` (`route.ts:99`) means GoTrue sends no confirmation
>    email either.
>
> So the applicant submits a government ID and a selfie, sees a screen promising
> contact within 1–2 business days (**A-I3**), and hears nothing — with no record
> in their inbox that they applied at all.

**Resolved by D9 (2026-08-08, supersedes D1): send a plain acknowledgement email —
no link, no click, nothing to confirm.** One message: *we received your
application, it is under manual review, we will email you when there is a
decision.*

**What this deliberately gives up, stated plainly.** D1 originally bought
typo-detection: a click-through proves the address reaches the applicant. A
no-click email does not prove that, so a mistyped-but-valid address still fails
silently, and the account remains unreachable exactly as `LR-I10` describes.
What it *does* give you is a delivery signal at the provider — a hard bounce from
Resend means the address is wrong. Watching bounces is out of scope here; it is
the cheap follow-up if unreachable applicants become a real problem.
**A-I1's duplicate-email check and A-I2's contact-person field remain the primary
defences against a bad address, and both stay in Stage A.**

**Two hard dependencies, both outside the code:**

1. ⚠️ **`NOTIFICATION_EMAIL_OVERRIDE_TO` is documented as still ON** —
   **👤 owned by the user, handled outside this plan (2026-08-08).**
   `.plans/2026-06-26-email-hosted-cutover.md:41` records it set to a test inbox;
   line 53 ("flip off the override so real recipients get mail") is **unchecked**.
   While it is set, *every* notification email is redirected regardless of
   recipient (`architecture/email-notifications-guide.md:129-132`), so any email
   this item adds would land in a test inbox.
   **This plan does not touch the secret.** It only depends on it: A-B6 cannot be
   *verified* until the user confirms the override is off in production. Treat that
   confirmation as a precondition of A-B6's verification step, not of its code.
2. **The notification type must exist before any row can be inserted.**
   `notifications.type` has an FK to `notification_type_settings`
   (`20260525000002_notifications.sql:23`), so a new type is a **migration**, and
   therefore a **schema approval gate**. Exact DDL and blast radius are drafted in
   **Appendix A** below. Do not write the migration until approved.

**Fix approach — small, because the pipe already exists.** After the migration
lands, add one more row to the `rows` array already being built at
`route.ts:169-181`, addressed to the **new vendor's own `userId`** with
`portal: "vendor"` and type `vendor_registration_received`. That is the whole
change on the app side: the dispatch trigger
(`20260624000003_notification_email_dispatch.sql:40-78`) fires on **every**
`notifications` insert with no type filter and falls back to a generic template,
so a new type flows through to email automatically.

Two things to respect in that same block:
- It is wrapped in `try/catch` and documented as **best-effort — it must never
  roll back a successful submission** (`route.ts:158`). Keep that. A failed
  acknowledgement email is not a reason to discard a completed application.
- It gates on `notification_type_settings.is_enabled` before inserting; follow the
  existing pattern rather than inserting unconditionally.

A bespoke template is **not** required for launch — the generic template renders
title and body. Register one in
`send-notification-email/lib/templates/registry.ts:10` only if the generic wording
reads badly, which is a judgement call to make once you see the rendered mail.

### A-IMPORTANT

#### A-B7 — No security headers on either app  🔄 IN PROGRESS (2026-08-08) — **shipped with a regression**
> 🐛 **`connect-src` excludes the configured Supabase origin**, so both portals are
> completely unusable against a local Supabase — no sign-in, no queries, no
> Realtime, and A-B1's direct-to-Storage upload is blocked too. Reported by the user
> on 2026-08-08 as `TypeError: Failed to fetch` from `signInWithPassword`.
> Diagnosed and planned in
> **`.plans/2026-08-08-csp-blocks-supabase-connections.md`** — fix is to derive the
> origin from `NEXT_PUBLIC_SUPABASE_URL` instead of hardcoding the `supabase.co`
> wildcard. This item is not ✅ until that lands and is verified in a browser.
<!-- ✅ security headers + per-app CSP in both next.config.ts; Report-Only via CSP_REPORT_ONLY=1 -->
*(Migrated from LR-B7, 2026-08-08, at the user's direction, **narrowed to
`vendor` + `command`** — `booker` is not deploying (D4), so its Leaflet and
PayMongo directives are dropped. **Both of LR's anchors were off by one**;
corrected below.)*
**Files:** `vendor/next.config.ts:15-23`; `command/next.config.ts:10-18`

Each app's `headers()` emits **exactly one header** — `X-Robots-Tag`, and only
when `ALLOW_INDEXING !== "1"`. Verified this session by reading both files in
full. There is no `Content-Security-Policy`, `Strict-Transport-Security`,
`X-Frame-Options` / `frame-ancestors`, `X-Content-Type-Options`,
`Referrer-Policy` or `Permissions-Policy`, and **no `middleware.ts` in either app**
to add them.

Why it belongs in this launch specifically:
- **`command` is framable by any origin.** It is the portal that activates
  vendors and releases payouts, and it is about to go on a public URL (D4). A
  clickjacking frame over the Activate control is exactly the shape of B-B2's
  one-click action.
- **`vendor` serves government ID images** through signed URLs and runs
  `getUserMedia` for the KYC capture.

The cost is a few lines per app.

**Fix approach.** Extend each `headers()` with `Strict-Transport-Security`,
`X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, a minimal
`Permissions-Policy`, and a CSP carrying `frame-ancestors 'none'`.

⚠️ **The CSP is not identical across the two apps — this is the part a
copy-paste implementation gets wrong.** Per-app directives, each verified against
the code this session:

| Directive | `vendor` | `command` |
|---|---|---|
| `connect-src` | Supabase HTTPS **+ WSS** — Realtime is used in `components/layout/AppShell/useAppShell.ts` | Supabase HTTPS **+ WSS** — same, `components/layout/AppShell/useAppShell.ts` |
| `img-src` | `'self' data: blob:` — camera captures + signed URLs | `'self' data: blob:` — signed KYC URLs in the review panel |
| `media-src` | **`blob:` required** — `getUserMedia` preview in `components/kyc/CameraCapture/useCamera.ts` | not needed |
| `frame-src` | none | none |
| `frame-ancestors` | `'none'` | `'none'` |
| `form-action` | `'self'` | `'self'` |

**`script-src` needs `'unsafe-inline'`.** Next injects inline bootstrap scripts,
and `next-themes` (`^0.4.4`, confirmed in both `package.json` files) injects an
inline no-flash script into `<head>`. Nonces are the correct answer and are
**explicitly out of scope here** — say so in a comment above the CSP rather than
leaving a future reader to assume it is stricter than it is.

**Ship `Content-Security-Policy-Report-Only` first** in both apps, exercise every
flow — KYC camera capture, Realtime notifications, the Transactions print/PDF
path, Command's signed-URL document viewer — confirm zero violations, then switch
to enforcing. Going straight to enforcement risks breaking the KYC capture, which
is the one flow this whole launch exists for.

Everything except the CSP **is** byte-identical between the two apps and is
duplicated deliberately, per `conventions.md:42` — the same convention the robots
work already follows. Do not extract it into a shared module.

*Note: `vendor/next.config.ts:14`'s `allowedDevOrigins` (ngrok wildcards) is a dev
server concern only and has no bearing on these headers.*

<!-- verification: headers are curl-checkable on a deployed preview; CSP correctness needs every flow exercised in Report-Only first -->

#### A-I1 — "Already registered" surfaces only after the entire KYC capture  ✅ DONE (2026-08-08) · **N1**
<!-- ✅ check-email route + debounced step-2 check + neutral copy; raw GoTrue message removed -->
**Files:** `route.ts:98-101`; `useLoginPage.ts:378-380`

A vendor completes six steps — business details, credentials, applicant type,
document uploads, **and a live ID photo plus a selfie holding it** — clicks
Submit, and only then learns the email is taken. Worse, `route.ts:101` returns
`createUserError.message` **verbatim**, so GoTrue's internal wording is rendered
straight into the form by `useLoginPage.ts:379`.

Two defects in one: the vendor's time is wasted at the worst possible moment, and
the raw message is an account-enumeration oracle the app does not otherwise have
(Supabase's sign-in and password-reset responses are both deliberately uniform).

**Fix approach — two checks, per D5 (Option B, resolved 2026-08-08):**

**1. In `prepare`** (the route A-B1 introduces — it already validates everything
before creating anything). Also **replace the raw GoTrue message** at
`route.ts:101` with fixed copy; never return `createUserError.message` to a
client.

**2. A debounced check at step 2.** This adds a public enumeration endpoint, so
the following are requirements, not suggestions — a version missing any of them
satisfies the wording of this item and defeats its purpose:

- **`POST`, not `GET`.** A `GET /api/auth/check-email?email=…` puts addresses in
  server logs, browser history and any proxy in between.
- **Covered by A-B2's WAF rule.** ⚠️ **Coupling: this endpoint must not ship
  before A-B2.** An unthrottled enumeration endpoint is strictly worse than the
  current situation, which has none.
- **Returns a bare `{ available: boolean }`** — no user data, no reason codes, no
  distinction between "taken" and "invalid".
- **The client renders fixed, neutral copy:** *"This email can't be used for a new
  application — sign in or reset your password instead."* Not "already
  registered", which confirms the account to anyone probing.
- **Debounce on the client** (≈500 ms after typing stops), and only once the value
  is a syntactically valid address — do not fire per keystroke.

**Data source:** query `profiles` by email under service role. `profiles.email` is
kept in sync from `auth.users` by `handle_user_email_update`
(`20260504000002_schema.sql:136`), so it is authoritative, and it avoids
`auth.admin.listUsers()`, which is paginated and unsuited to a lookup.
**Note there is no index on `profiles.email`** — a sequential scan, which is
irrelevant at this table's size and is recorded under Deferred rather than
pre-optimised.

**Component separation:** the debounce, the in-flight state and the resulting
error live in `useLoginPage.ts` beside `handleAccountContinue` (`:242-257`);
`LoginPage.tsx` renders the message only. No new component.

#### A-I2 — No contact person is ever collected; Command sees blank names  ✅ DONE (2026-08-08) · **N9**
<!-- ✅ contactName collected at step 2, passed via user_metadata; full_name: email workaround removed -->
**Files:** `route.ts:98-100` (no `user_metadata`), `:180`;
`command/components/users/UserTableRow/UserTableRow.tsx:29,31`

The registration form collects a **business** name and nothing else — `RegForm`
(`useLoginPage.ts:20-38`) has no field for the person applying. `createUser` is
called with no `user_metadata`, so `handle_new_user`
(`20260504000002_schema.sql:118-123`) writes `full_name = ''` for **every**
self-registered vendor admin.

Consequences, both verified:
- Command's user list renders an empty name and an empty avatar —
  `UserTableRow.tsx:29` computes initials from `u.name.split(" ")`, which yields
  nothing for `""`.
- The register route already papers over this: `route.ts:180` sets
  `full_name: email` in the "New User Sign-Up" notification payload, i.e. it puts
  the email address in the name slot because no name exists.

This matters directly to the deferred-approval plan: the reviewer opens a packet
containing a government ID with a person's name on it, next to a platform record
with no name at all.

**Fix approach — minimal, no schema change.** Add a "Contact person" field to
step 2, pass it as `user_metadata.full_name` on `createUser`; the existing trigger
already reads `raw_user_meta_data ->> 'full_name'` and will populate `profiles`
with no further work. Then drop the `full_name: email` workaround at `:180`.

**Component separation:** a new field in the existing step — state in
`useLoginPage.ts` (`RegForm` + `handleAccountContinue`'s validation), rendered
through the existing `RegisterField` component (`RegisterField.tsx` +
`useRegisterField.ts`), which is exactly what it is for. No new component.

#### A-I3 — Post-submit copy promises contact that nothing delivers  ✅ DONE (2026-08-08) · **N5**
<!-- ✅ reg-sent and KYC-status copy rewritten to what is actually true -->
**File:** `vendor/components/auth/LoginPage/LoginPage.tsx:475`

> "We'll verify your business details and documents, and **reach out within 1–2
> business days** to activate it."

Three things make this false at launch: approval is deliberately deferred
("sometime later"), no email is sent on approval or rejection (A-B6), and the
vendor only discovers the outcome by choosing to log in again
(`architecture/vendor-kyc.md:251-255` documents this as a known gap).

A promise the product cannot keep is worse than no promise, and this is the last
thing every applicant reads. **Fix approach:** rewrite to state what is actually
true — the application is received, review is manual, and they will be told by
email once A-B6 lands. Pure copy change; revisit once Stage B ships.

#### A-I4 — KYC draft PII persists in `localStorage` indefinitely  ✅ DONE (2026-08-08) · **N4**
<!-- ✅ savedAt stamp + 7-day TTL, key bumped to -v4, explicit Discard control -->
**Files:** `vendor/lib/kycDraft.ts:27,39-45`; `useLoginPage.ts:119-124,382`

The draft holds business name, full structured address, phone and **email** under
`vendor-onboarding-draft-v3`, written on every keystroke and cleared **only on
successful submit** (`useLoginPage.ts:382`). An abandoned application leaves that
data on the device forever — no expiry, no clear-on-exit — including on a shared
or public machine.

Files and password are correctly excluded, and that design is sound. The gap is
retention. It also interacts with A-B3: a privacy notice that does not mention
local draft storage would be incomplete.

**Fix approach:** stamp the draft with `savedAt` and drop it on load past a TTL
(7 days is a reasonable default); offer an explicit "discard my application"
control on the register screen. Bump the key to `-v4` so old drafts without the
stamp are dropped rather than migrated — the same rationale already recorded in
that file's `v2`/`v3` comments.

#### A-I5 — `docLabels` is parsed but never validated as a string array  ✅ DONE (2026-08-08) · **N6**
<!-- ✅ Array.isArray + element-type + length assertions in the register route -->
**File:** `route.ts:65-70`, consumed at `:153`

`JSON.parse` is wrapped in try/catch, so malformed JSON is handled — but a
well-formed non-string payload is not. `[{"a":1}]` passes the length check at
`:73` and reaches `labels[i] || f.name` at `:153`, writing `"[object Object]"`
into `vendor_kyc_documents.label`, which is what the Command reviewer reads.

Low exploitability (it damages only the attacker's own packet) but it is three
lines to close and it rides A-B1's `prepare` validation for free.
**Fix approach:** assert `Array.isArray(labels) && labels.every(l => typeof l === "string")`, and cap label length.

#### A-I6 — `/api/divisions` converts any failure into an empty list  ✅ DONE (2026-08-08) · **N7**
<!-- ✅ route returns 500 on failure; service returns a discriminated result; error surfaced at step 1 -->
**File:** `vendor/app/api/divisions/route.ts:17`

On any error the route returns `{ divisions: [] }` with a 200. The client
(`useLoginPage.ts:75`) has no error branch, so the division combobox is simply
empty and step 1 cannot be passed — the vendor sees "Please select a division"
(`:225`) against a list with nothing in it. Unexplainable dead end at the very
first step.

**Downgraded from the blocker I first suspected:** divisions are seeded by
`20260724000004_divisions.sql:29-41`, a migration, so a correctly migrated
production project *will* have them. This is a transient-failure and
misdiagnosis concern, not a guaranteed break.

**Fix approach:** return a non-200 on error and surface a distinct message
("Couldn't load business categories — please refresh").

#### A-I7 — Profile activation is not asserted to have matched a row  ✅ DONE (2026-08-08) · **N8**
<!-- ✅ .select().single() on the profile activation, rolls back on zero rows -->
**File:** `route.ts:114`

`admin.from("profiles").update({ status_id: active }).eq("id", userId)` sets
`profileError` only on a *query* error. A zero-row match is not an error, so if
the profile did not exist the route reports success while leaving
`profiles.status_id = 3` — and `is_active()` would then reject that user forever,
including after Command approves them.

**Honestly assessed: not currently reachable.** `handle_new_user` is
`security definer` and runs in the same transaction as the `auth.users` insert, so
a failure there fails `createUser` itself. This is defence in depth on the one
step whose silent failure is unrecoverable and invisible.
**Fix approach:** `.select("id").single()` on the update and roll back if it
returns nothing.

#### A-I8 — A wrong email at registration is unrecoverable by anyone  ✅ DONE (2026-08-08)
<!-- ✅ PATCH /api/users writes auth.users via updateUserById, behind verifyCaller + root check -->
*(Migrated from LR-I10, 2026-08-08.)*
**Files:** `vendor/app/api/auth/register/route.ts:98-101`;
`command/components/users/UserModal/`; `architecture/auth-and-roles.md:30`

`handle_user_email_update` syncs `auth.users` → `profiles`. **There is no reverse
path**, and Command's user editor writes `profiles`. So a mistyped registration
email cannot be corrected by anyone through any UI, and recovery mail goes to an
address the vendor does not own.

**This is the item D9 deliberately did not solve.** The acknowledgement email has
nothing to click, so a mistyped-but-valid address still fails silently. Combined
with A-B4, this is how an account becomes permanently dead: wrong address, no
recovery, no admin repair.

**Fix approach:** add an admin action to `POST /api/users` (or a sibling route)
calling `auth.admin.updateUserById({ email })` behind the existing `verifyCaller`
gate. Small, and it turns a dead account into a two-minute support fix.

**Why not just enable email confirmations:** it would prevent the class entirely
but changes the "account is live immediately" property that the pending-status
screen and the resubmit-after-rejection flow both depend on — the reasoning
recorded under D1/D9. Deliberately left as a follow-on.

---

## STAGE B — the collected sign-ups can actually be approved

Per **D2**. Stage B need not ship with Stage A, but nothing collected in Stage A
is actionable until it does. **Do not let Stage A run for long without Stage B** —
every day it does, applications accumulate that no one can process.

> ### The model Stage B builds to (D6, resolved 2026-08-08)
>
> **A root/admin manually reviews the KYC packet and, separately, manually
> activates the vendor. These are two independent decisions and they stay that
> way.** KYC review is *advisory* to activation — the schema already says so in
> its own words (`20260706000001_vendor_kyc.sql:66`: *"Advisory to activation
> (D-3)"*), and the earlier framing of this as a defect was wrong.
>
> So Stage B is **not** about wiring KYC approval to activation. It is about three
> things the UI gets wrong today:
>
> 1. **`pending_activation` is the correct first state** for every registrant
>    (`vendors.status_id` defaults to 3, `20260504000002_schema.sql:70`) — the
>    Command UI must recognise it as a first-class state, not an impossible one.
> 2. **"Reinstate" means bringing back a *suspended* vendor.** It must never be
>    the label on a brand-new applicant who has never been active.
> 3. **The admin must be able to see, at a glance, whether the vendor finished
>    KYC** — because activation is their judgement call, and they cannot make it
>    from a list that does not show them the packet's state.

#### B-B1 — Command has no pending queue; new vendors look suspended  ✅ DONE (2026-08-08) · **N10**
<!-- ✅ pending_activation added to VendorStatus, `as any` cast replaced with a narrowing fn, StatusBadge reused, Pending tab + count, newest-first order -->
**Files:** `command/lib/types.ts:4`;
`command/components/vendors/VendorToolbar/VendorToolbar.tsx:7-11`;
`command/components/vendors/VendorStatsBar/useVendorStatsBar.ts`;
`command/components/vendors/VendorCard/VendorCard.tsx:16,66-68`

`export type VendorStatus = "active" | "suspended"` — `pending_activation` is not
in the type at all.

**The type is not merely incomplete; it is actively lied to.**
`command/services/vendors.service.ts:20` reads the real status and casts it:

```ts
status: ((row.statuses as any)?.name ?? "pending_activation") as Vendor["status"],
```

The fallback is *literally* `"pending_activation"`, cast through `as` into a union
that excludes it. So the runtime value flows through the whole UI while the
compiler has been told it cannot exist — which is precisely why nothing downstream
handles it and no check ever failed. Everything treats "not active" as
"suspended":

- `STATUS_TABS` offers **All / Active / Suspended** — no Pending tab.
- The stats bar counts Total / Active / Suspended — no pending count.
- `VendorCard:16` paints a **red top border**, `:32-34` renders a **red chip**,
  and `:66-68` offers **"Reinstate"** — the full suspended treatment.
- The `vendor_pending_approval` notification that *does* fire has **no
  click-through** to the vendor record.

So the only way to find a new application is to scan the "All" tab, which is
sorted oldest-first (`vendors.service.ts:9`).

> **Correction to this plan's first draft (2026-08-08).** It said a pending vendor
> was "visually identical to a vendor suspended for cause". Not quite:
> `VendorCard:32-34` renders `{s.status}` raw, so the chip does read
> `pending_activation` — as an unformatted snake_case string, in red, next to a
> red border and a "Reinstate" button. The label is not missing; it is raw and
> colour-coded as a problem. That is arguably worse than missing, because it looks
> deliberate.

**Fix approach — most of this already exists; use it rather than build it.**

1. Add `pending_activation` to `VendorStatus` (`lib/types.ts:4`) and **remove the
   `as any` cast** at `vendors.service.ts:20` so the compiler starts telling the
   truth. Do this **first** — `tsc` then points at every site that does not handle
   the third state, which is how the rest of this item scopes itself.
2. **Replace `VendorCard`'s hand-rolled chip (`:29-34`) with the existing
   `StatusBadge` component.** `STATUS_CFG` (`lib/constants.ts:70-74`) **already
   carries** `pending_activation: { amber, label: "Pending Activation" }` — it is
   what the *users* page already renders. The correct label and colour exist and
   are simply not being used here. This also removes a static inline `style={{}}`
   block from a `.tsx`, which the component-separation convention prohibits.
   `StatusBadge` has a safe fallback for unknown statuses
   (`StatusBadge.tsx:9`), so it degrades rather than breaks.
3. Repaint the card's top border (`:16`) from the binary
   `active ? blue : red` to a three-way that uses the same amber token.
4. Add a **Pending** tab to `STATUS_TABS` and a pending count to
   `useVendorStatsBar.ts:6-11`.
5. Consider sorting pending vendors **newest-first**; the current oldest-first
   order (`vendors.service.ts:9`) is wrong for a work queue.

Note the runtime-fallback lesson already recorded for the mobile app
(`ezzy-vendor-mobile/AGENTS.md` → Traps: an exhaustive `Record<Union, …>` is a
compile-time guard only) — `STATUS_CFG` is exactly that shape and already has the
fallback, so follow that precedent for any new lookup.

**Component separation:** `STATUS_TABS` is a module constant in a render file
(fine). The pending **count** goes in the existing `useVendorStatsBar.ts`.
`VendorCard` has no companion hook; step 2 above *reduces* the logic in its
`.tsx` rather than adding to it. If step 3's three-way border plus the action
logic in **B-B2** push real branching into the render layer, the card gains
`useVendorCard.ts` at that point — decide when B-B2 is built, not before.

#### B-B2 — "Reinstate" is offered to vendors who have never been active  ✅ DONE (2026-08-08) · **N11**
<!-- ✅ per-status action lookup (Activate/Suspend/Reinstate), Edit Profile select shows pending disabled, D8 confirm modal -->
**Files:** `command/components/vendors/VendorCard/VendorCard.tsx:66-68`;
`command/components/vendors/VendorsPage/useVendors.ts:74-93`;
`command/components/vendors/VendorFormModal/VendorFormModal.tsx:49-52`

The status action is a **two-state toggle** on a **three-state** entity:

```tsx
{s.status === "active" ? "Suspend" : "Reinstate"}          // VendorCard.tsx:67
const newStatus = vendor.status === "active" ? "suspended" : "active"  // useVendors.ts:77
```

"Reinstate" means *restore something that was taken away*. A vendor who registered
this morning has never been active and has had nothing taken away — offering to
"reinstate" them is simply the wrong word for the most consequential action in the
funnel, and it reads as though the platform has already judged them.

The Edit Profile route is no better: its status `<select>`
(`VendorFormModal.tsx:49-52`) offers only Active and Suspended, so a pending
vendor's current value **matches no option** in the dropdown that is supposed to
show it.

**This is not about KYC.** Per **D6**, activation stays a separate manual decision
and `reviewKyc` is correct to touch only `vendor_kyc` — that behaviour is
deliberately left alone.

**Fix approach:**
1. Make the action label depend on the state it is acting *from*, not on a
   boolean: `active → "Suspend"`, `suspended → "Reinstate"`,
   `pending_activation → "Activate"`. Give the pending case affirmative styling
   (the amber/green treatment), not the red "this was suspended" treatment.
2. Add `pending_activation` to the Edit Profile `<select>` so the form can
   represent the state it is editing — **as a read-only current value, not a
   target.** Nothing should be able to move a vendor *back* to pending; the DB
   transition validator (`20260511000001_vendor_approval.sql:31-58`) is the
   backstop, but the UI should not offer it in the first place.
3. **The underlying write must be fixed at the same time — see B-B5.**
   ⚠️ **Coupling:** B-B2 changes *which* status the button targets; B-B5 changes
   *how* the write happens. Shipping B-B2 alone would add an `Activate` button on
   top of a call that silently reverts fields. **They ship together.**
4. **Confirmation dialog on Activate, for `rejected` and `null` KYC only**
   (D8, Option B). Never for `approved`. The dialog **names the KYC state** and
   lets the admin proceed — it informs, it does not block (D6).

   **Follow the existing wrapper pattern, do not invent one.** `components/ui/`
   holds a generic base modal, and each domain wraps it thinly with its own
   title and message — `UserDeleteConfirmModal.tsx` and
   `VendorDeleteConfirmModal.tsx` are both ~12 lines doing exactly that. So:
   add a `VendorActivateConfirmModal` wrapper in the same shape.

   ⚠️ **The base is currently `DeleteConfirmModal`, and it is delete-specific** —
   a hardcoded `Trash2` icon and a "Yes, Remove" confirm label
   (`DeleteConfirmModal.tsx:18,27`). It is not reusable as-is.
   **Recommended:** rename it to `ConfirmModal` and add `icon` and `confirmLabel`
   props defaulting to today's values, so the two existing wrappers and the
   ui-gallery entry (`app/ui-gallery/page.tsx:97`) keep working untouched. Four
   call sites; a small, contained rename. Leaving a component named
   `DeleteConfirmModal` powering an "Activate vendor" dialog is the kind of thing
   that misleads the next reader. If you would rather not rename a shared
   component, the fallback is a sibling `ConfirmModal` and leaving the delete one
   alone — say so at execution time.

   **Visual baselines:** a pure rename changes no rendering, so existing snapshots
   are safe. Adding the new variant **to** the gallery creates a new snapshot to
   generate — expected, not a regression (`conventions.md` → visual regression
   testing, `maxDiffPixels: 0`).

   **Component separation:** the wrapper is pure display with no state — no
   companion hook, matching the two existing wrappers. The open/close state and
   the decision of *whether* to prompt live in the caller's hook
   (`useVendors.ts`), alongside the existing `deleteConf` state at `:71`.

**Component separation:** the label/colour/action mapping is per-status logic. If
it stays a small lookup it can live as a module constant beside `VendorCard`; the
moment it needs the vendor's KYC state as well (**B-B3**) it becomes real
branching and moves to `useVendorCard.ts`. Prefer the lookup-with-fallback shape
`STATUS_CFG` already uses over a `switch`.

#### B-B3 — Nothing shows whether the vendor actually completed KYC  ✅ DONE (2026-08-08) · **NEW (2026-08-08)**
<!-- ✅ vendor_kyc(status) embedded 1:1, kycStatus on Vendor, KycBadge with four states -->
**Files:** `command/services/vendors.service.ts:8,20`; `command/lib/types.ts:29-46`;
`command/components/vendors/VendorCard/VendorCard.tsx`

Activation is the admin's judgement call (**D6**), and today they must make it
from a list that says nothing about the packet. `Vendor` (`lib/types.ts:29-46`)
has no KYC field, and the list query (`vendors.service.ts:8`) does not join
`vendor_kyc` at all. The only way to see whether a vendor even *submitted*
documents — let alone whether they were reviewed — is to open the vendor, then
open the KYC panel, one vendor at a time.

So the queue cannot be triaged. An admin cannot tell "12 pending, 9 with packets
ready to review" from "12 pending, 3 of which never finished uploading".

**Fix approach — a single embedded join, no N+1.**
`vendor_kyc.vendor_id` is the table's **primary key**
(`20260706000001_vendor_kyc.sql:57`), so the relationship is strictly 1:1 and
PostgREST returns an **object, not an array** for the embed — worth stating
because assuming an array here is the easy mistake:

```ts
.select("…, statuses(name), vendor_kyc(status), …")   // vendors.service.ts:8
```

Then map to a new `kycStatus: "submitted" | "approved" | "rejected" | null` on
`Vendor`, where **`null` means no packet exists** — a real and distinct state, not
an error. Render it with the existing `StatusBadge` by adding three entries to
`STATUS_CFG` (`lib/constants.ts:70-74`); its unknown-status fallback covers
anything unmapped.

Four states the admin needs to distinguish at a glance:

| `kycStatus` | Meaning | Reasonable treatment |
|---|---|---|
| `null` | No packet — registration never completed, or a vendor created directly in Command | neutral / grey, "No KYC" |
| `submitted` | Packet uploaded, **nobody has reviewed it** | amber, "KYC: Awaiting review" |
| `approved` | Reviewed and accepted | green, "KYC: Approved" |
| `rejected` | Reviewed and refused; vendor may be revising | red, "KYC: Rejected" |

⚠️ **Do not let this badge read as the vendor's account status.** Two independent
badges now sit on one card — account state (`pending_activation` / `active` /
`suspended`) and packet state. They must be visually distinguishable and the KYC
one should be prefixed ("KYC: …"), or an admin will read "Approved" and think the
vendor is live.

**RLS:** no new work — command admins already hold `select` on `vendor_kyc`
(`20260706000001_vendor_kyc.sql:84-97`), which is what the existing per-vendor
panel uses.

**Component separation:** the query and mapping change is service-layer only.
The badge is the existing pure-display `StatusBadge`. Only the card's layout
changes; combined with **B-B2**'s per-status action mapping, this is the point at
which `useVendorCard.ts` is likely warranted.

#### B-B5 — Changing a vendor's status silently reverts fields the vendor edited  ✅ DONE (2026-08-08) · **NEW (2026-08-08)**
<!-- ✅ useSetVendorStatus writes status_id only; toggleStatus no longer round-trips the whole record -->
<!-- Placed out of numeric order deliberately: B-B5 is coupled to B-B2 and belongs
     beside it. Numbers are stable identifiers, not sequence — see Execution order. -->
**Files:** `command/components/vendors/VendorsPage/useVendors.ts:74-93`;
`command/hooks/mutations/vendors/useUpdateVendor.ts:5-19`

To change **one column**, `toggleStatus` sends a full `VendorFormData` through
`updateVendor`, which issues a blind `UPDATE` of **eight columns**
(`useUpdateVendor.ts:8-17`):

```
name · accreditation_no · region · branches · phone · email · status_id · division_id
```

Every value except `status_id` comes from whatever the **client's list state**
was holding when the page loaded. This is a last-write-wins overwrite with no
concurrency control, no `updated_at` check, and no awareness that it is writing
seven columns it was never asked to change.

**This is reachable by one admin acting alone — no second user required.** The
vendor portal lets a vendor edit their own profile
(`vendor/services/profile.service.ts:60-85`), and **four of those fields overlap
exactly** with what `updateVendor` blindly writes: `name`, `phone`, `email`,
`accreditation_no`. So:

1. Admin opens Command's vendor list. The list is now a snapshot.
2. The vendor updates their phone number in the vendor portal.
3. Admin clicks **Suspend** (or **Reinstate**, or the new **Activate**).
4. The vendor's new phone number is **silently overwritten with the stale one.**

No error, no warning, nothing in the UI to suggest anything but a status changed.
For `accreditation_no` on a KYC-reviewed vendor this is worse than cosmetic — it
can revert a corrected licence number that the packet was re-reviewed against.

> **Severity: blocker, and escalated from how this plan first recorded it.** It
> was a sub-bullet of B-B2 described as clobbering "concurrent edits", which
> undersold it — I had not yet confirmed the vendor portal writes the same
> columns. Silent data loss on the action Stage B is built around is not an
> IMPORTANT.

**Fix approach — a targeted status write, not a narrower form write.** Add a
dedicated mutation that updates **only** `status_id`:

```ts
// hooks/mutations/vendors/useSetVendorStatus.ts
await supabase.from("vendors").update({ status_id }).eq("id", id)
```

Then point `toggleStatus` at it and delete the `VendorFormData` round-trip.
Deliberately **not** doing two tempting alternatives:
- *"Re-fetch the vendor first, then write all eight columns."* Narrows the race,
  does not close it, and still writes columns nobody asked to change.
- *"Add optimistic-concurrency checks to `updateVendor`."* Real, but a bigger job
  aimed at the Edit Profile form, which is a separate concern. **Recorded under
  Deferred** rather than smuggled in here.

`updateVendor` keeps its current shape and stays the Edit Profile path, where
writing the whole form **is** the intent.

**Blast radius:** no schema change. The DB already validates the transition
(`20260511000001_vendor_approval.sql:31-58`) and audits every change to
`vendor_status_log` (`:61-71`), so a status-only write loses no auditability.
`prevent_vendor_status_self_update` (`:11-28`) still restricts who may do it.

**Component separation:** a new hook under `hooks/mutations/vendors/`, matching
the existing `useUpdateVendor.ts` / `useCreateVendor.ts` convention exactly. No
component changes beyond `useVendors.ts` calling the new mutation.

⚠️ **Coupling: ships with B-B2** — see that item's step 3.

#### B-B4 — There is no way to create the first Command user on a production project  ✅ DONE (2026-08-08)
<!-- ✅ backbone/scripts/bootstrap-root.mjs + README; refuses if a root exists, --dry-run, rollback -->
*(Migrated from LR-B12, 2026-08-08. In this plan's gate because `command` is
deployed — D4.)*
**Files:** `command/app/api/users/route.ts:9-32`; `backbone/supabase/seed.sql:53-75`;
`backbone/scripts/`

`POST /api/users` is the only user-creation path, and `verifyCaller()` requires the
caller to **already be an active command admin/root** (`:14-27`). On a fresh
production project nobody satisfies that, so no Command user can ever be created
through the product. The only existing root is `root@bookdeck.com` with a
hardcoded password (`seed.sql:53-67`) — a **local-only** fixture that must never
reach production, and which `db push` correctly does not carry.

**Result: a production `db push` yields a complete, correct schema that nobody can
log into.** Nothing in Stage B is executable by any human until this is solved.

**Fix approach — a script, not a seed file.** This distinction is the whole point:
`[db.seed]` runs on `db reset`, which is local-only and forbidden in production
(`architecture/database-reset-and-deploy.md:19`). A "production seeder" placed in
`seed.sql` would **never execute in production** — it would look done and do
nothing.

New `backbone/scripts/bootstrap-root.mjs`, beside the existing
`wipe-kyc-storage.mjs`, using the service-role key from the environment:

1. **Refuse to run if any `root` already exists** — this mints a platform
   superuser and must never be a routine command.
2. `auth.admin.createUser({ email, email_confirm: true })` with **no password**,
   exactly as `command/app/api/users/route.ts:37-41` already does. No secret is
   read, written or logged anywhere — satisfying AGENTS.md's red line directly
   rather than by convention.
3. Promote the trigger-created profile to `active`; insert `user_portals(command)`
   and `user_roles(root)`.
4. Print what it did and stop.

The operator then sets their own password via **Forgot Password** — the same flow
every Command-created user already uses.

⚠️ **Hard dependency on A-B4.** With no password set, recovery is the *only* way
in. If the redirect allow-list is wrong, this script produces an account nobody can
access and there is no second path. **A-B4 must be verified working before this
runs** — not merely scheduled ahead of it.

**Why not SQL:** hand-writing `auth.users` needs a bcrypt hash, i.e. a password in
a file. `seed.sql` was already bitten on hosted by exactly this — `gen_salt`/`crypt`
resolve differently there, needing all call sites schema-qualified
(`architecture/database-reset-and-deploy.md:265-280`). Re-deriving that for one
production row, to gain nothing, is the wrong trade.

**Keep it re-runnable**, not one-shot: if the last root's roles are ever stripped,
this script is the only recovery.

#### B-I1 — Approving or rejecting KYC notifies the vendor of nothing  ✅ DONE (2026-08-08)
<!-- ✅ reviewKyc notifies every vendor-admin, best-effort, after the update; never touches vendors.status_id -->
*(Migrated from LR-B5, 2026-08-08, and merged with this plan's N2.)*
**Files:** `command/services/kyc-admin.service.ts:77-94`;
`backbone/supabase/migrations/20260525000001_notification_type_settings.sql`

Verified by enumerating every seeded notification type. **None fires on a KYC
review or a vendor activation.** The vendor submits a packet, Command reviews it
and activates them, and the vendor learns this only by logging in again on a
hunch. On rejection they are never told to revise — even though the
revise-and-resubmit flow is **fully built and waiting**
(`vendor/services/kyc.service.ts:146-192`).

`architecture/vendor-kyc.md:251-255` records this as a known deferred gap. For a
funnel that is register → wait → get activated, it is the step where vendors are
lost, and every lost vendor becomes a support ticket.

**Fix approach:** write `notifications` rows addressed to the vendor from
Command's KYC review path and from the activation path (B-B2). Both channels
(in-app + email) then come free — the existing `notifications_dispatch_email`
trigger fires on any insert.

**No second schema gate:** Appendix A deliberately adds `kyc_approved` and
`kyc_rejected` alongside the registration type, so the rows this needs already
exist once A-B6 has shipped. **Coupling: depends on A-B6's migration, and on
email actually being deliverable in production (D7).**

#### B-I2 — The vendor portal has no access verification: a suspended user is shown "awaiting activation"  ✅ DONE (2026-08-08)
<!-- ✅ vendor-access.service.ts checks all three layers; suspended vendors get their own copy -->
*(Migrated from LR-B4, 2026-08-08.)*
**Files:** `vendor/components/layout/AppShell/useAppShell.ts:130-174`;
`vendor/services/vendor.service.ts:22-44`;
`vendor/components/auth/LoginPage/useLoginPage.ts:143-174`;
`vendor/components/kyc/KycStatusPage/useKycStatusPage.ts:35-41`

`architecture/auth-and-roles.md:5-11` documents three independent access layers:
**active status**, **portal membership**, **role**. `command` implements all three
(`command/app/api/users/route.ts:14-27`). **`vendor` implements one** — vendor
membership — and has no `verifyVendorAccess()` at all. `user_portals` is never
read anywhere in the vendor app (grep: zero hits).

Two consequences:

1. **Revoking the `vendor` portal row does nothing.** Command's only working lever
   is suspending the profile, and that works *by accident*: the `vendors` SELECT
   policy carries `is_active()` (`20260504000003_rls.sql:132-138`), so the
   embedded vendor row comes back null and the user falls through to `signOut()`.
   Correct outcome, wrong reason — it breaks the moment that policy changes.
2. **A suspended vendor is routed to the KYC status surface.** `useAppShell.ts`
   sends any non-active vendor to `KycStatusPage`, which keys purely on
   `vendor_kyc.status`. A vendor suspended by Command with an approved packet is
   told **"approved — awaiting activation"** — suspension is indistinguishable
   from pending activation, in the exact place a vendor looks for an explanation.
   `all[0]` also picks an arbitrary vendor for a multi-vendor user.

**Why it belongs in this plan:** this is the screen *every* post-sign-up vendor
lands on, and B-B1 is about to make `pending_activation` a first-class state on
the Command side. The two views of the same state should agree.

**Fix approach:** add `vendor/services/vendor-access.service.ts` mirroring
`booker/services/booker.service.ts:9-22` — check `profiles.status`,
`user_portals('vendor')` and the `vendor_members` role, returning a discriminated
reason (`no_access | suspended | pending_kyc | vendor_suspended`). Route each
reason to its own copy, as the mobile app's `blocked` screen already does. Blocked
states need real copy and a way forward.

**Component separation:** new service file plus a branch in the existing
`useAppShell` hook; `KycStatusPage.tsx` gains a `vendor_suspended` branch fed by
its hook. No new component, no logic in a `.tsx`.

---

## DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

- ~~**D1 — Email verification at sign-up** → Send a verification email, keep the
  account usable~~ (resolved 2026-08-07) — **superseded by D9 on 2026-08-08.**
  Kept for the record: its reasoning that the account must stay usable, because
  the pending-status screen and the resubmit-after-rejection flow both require
  login, still holds and carries into D9.
- **D9 — What the sign-up email actually is** → **A plain acknowledgement, no
  link and nothing to click** (resolved 2026-08-08) — "we received your
  application, it is under manual review, we will email you when there is a
  decision." Simpler than D1: no token, no callback route, no verification state
  to model. **Cost, accepted knowingly:** it no longer proves the address reaches
  the applicant, so `LR-I10` (a wrong email is unrecoverable) stays open and is
  not mitigated by this item. Drives **A-B6**.
- **D2 — Where the Command approval gaps belong** → **In this plan, as Stage B**
  (resolved 2026-08-07) — keeps the funnel in one document; Stage B can ship after
  Stage A without re-investigation.
- **D3 — Rate-limit store** → **Vercel WAF rules** (resolved 2026-08-07) — no
  code, no migration, no schema gate. **Conditional:** if WAF rate limiting is not
  on the account's plan, fall back to `LR-B6`'s `rate_limit_hits` table, which
  reopens a schema approval gate. Confirm availability as the first act of A-B2.
- **D4 — Apps going to production** → **`vendor` + `command`** (resolved
  2026-08-07) — `booker` is not deployed, so **`LR-B10` (booker must be genuinely
  unreachable) is out of this gate**; it returns when booker launches. `LR-B12`
  enters the gate because `command` is deployed.
- **D6 — Relationship between KYC review and vendor activation** → **They stay
  independent; a root/admin does both manually** (resolved 2026-08-08) — KYC
  review is advisory to activation, which is what the schema already documents
  (`20260706000001_vendor_kyc.sql:66`). `reviewKyc`'s current behaviour is
  **correct and is not to be changed.** Stage B therefore fixes the *UI* around
  the manual decision — the pending state (**B-B1**), the action wording
  (**B-B2**), and packet visibility (**B-B3**) — and does **not** wire approval to
  activation. Supersedes this plan's first-draft framing of B-B2 and reframes
  `LR-I12`.
- **D7 — `NOTIFICATION_EMAIL_OVERRIDE_TO`** → **👤 user-owned, out of plan scope**
  (2026-08-08) — the user will unset it in production themselves. A-B6's
  verification depends on it; nothing in this plan changes it.
- **D5 — Should the duplicate-email check also run at step 2?** → **Option B:
  `prepare` **and** a debounced check at step 2** (resolved 2026-08-08) — the
  applicant learns in seconds rather than after five steps and a selfie.
  **Knowingly accepted cost:** this adds an account-enumeration oracle the app
  does not currently have, since Supabase's sign-in and password-reset responses
  are both deliberately uniform. Judged low-value against a portal with no public
  directory, and throttled by A-B2's WAF rule. Implementation constraints are
  **not optional** — see A-I1.
- **D8 — Should activating a vendor whose KYC is `rejected` or missing require a
  confirmation?** → **Option B: badge plus a confirmation dialog, for `rejected`
  and `null` only** (resolved 2026-08-08) — activating is the one action that lets
  a business onto the platform, it is one click from a list, and there is no undo
  beyond suspending afterwards. **Never prompt for `approved`** — that is the
  happy path and friction there is pure cost. Under **D6** the admin may still
  proceed; the dialog informs, it does not block. Implementation in B-B2.

---

## Appendix A — schema approval gate: vendor-facing notification types

**Required by A-B6 and reused by B-I1.** `notifications.type` is FK-constrained to
`notification_type_settings` (`20260525000002_notifications.sql:23`), so no
vendor-facing notification can be inserted until these rows exist.

**Draft migration — not to be written until approved:**

> ⚠️ **This draft was wrong in its first version and is corrected here
> (2026-08-08).** It omitted `label`, which is `text not null` with **no default**
> (`20260525000001_notification_type_settings.sql:22`) — the insert would have
> failed outright. The real column order is `(type, label, description, is_enabled)`,
> confirmed against both the table definition and the existing seed at `:57-64`.
> Exactly the reason §8 requires the SQL to be drafted and checked, not described.

```sql
-- backbone/supabase/migrations/<timestamp>_vendor_lifecycle_notification_types.sql
insert into public.notification_type_settings (type, label, description) values
  ('vendor_registration_received', 'Registration Received',
   'Sent to the applying vendor when their registration and KYC packet is received.'),
  ('kyc_approved',                 'KYC Approved',
   'Sent to the vendor when Command approves their KYC packet.'),
  ('kyc_rejected',                 'KYC Rejected',
   'Sent to the vendor when Command rejects their KYC packet, with the review notes.')
on conflict (type) do nothing;
```

`is_enabled` is omitted deliberately — it defaults to `true`
(`20260525000001:24`), matching the "all types enabled by default" contract in
that table's own comment. Set it explicitly to `false` instead if you want the
rows to exist while emails stay off.

**Blast radius:**

| Dimension | Assessment |
|---|---|
| **Data** | Three inserts into a small lookup table. Rewrites nothing, validates nothing existing. `on conflict do nothing` makes it re-runnable |
| **Lock / performance** | Row-level insert on a table with 7 rows. Negligible; no scan, no rewrite |
| **Downstream** | The `NotificationType` union in `backbone/supabase/functions/send-notification-email/types.ts:6-13` must gain all three, and the function must be **redeployed** — the dispatch trigger fires on every insert, so a type the function does not know falls to the generic template rather than failing, but the copy would be wrong. Command's notification panel filters may also need the new types |
| **Reversibility** | `delete from public.notification_type_settings where type in (…)` — safe **only** while no `notifications` row references them, because of the FK. After go-live, disable via `is_enabled = false` instead of deleting |

**Confirm before approving:** whether these should default to `is_enabled = true`
(vendors are emailed from day one) or `false` (rows exist, emails start when you
say so). `false` is the safer default while `NOTIFICATION_EMAIL_OVERRIDE_TO` is
still set — see A-B6 dependency 1.

---

## DEFERRED / COSMETIC

- **`updateVendor` has no optimistic-concurrency control** — the Edit Profile
  form's own last-write-wins race, distinct from **B-B5**. Two admins editing one
  vendor, or an admin editing while the vendor edits their own profile, still
  loses the earlier write silently. Acceptable for now: there is one small admin
  team, and B-B5 removes the *frequent* path (a status click) from this exposure,
  leaving only deliberate simultaneous form edits. Revisit with an `updated_at`
  precondition if it bites.
- **No index on `profiles.email`** — A-I1's step-2 check does a sequential scan.
  Irrelevant at this table's size and deliberately not pre-optimised; adding one
  would be a schema change and an approval gate for no present benefit. Revisit if
  `profiles` grows past a few thousand rows or the check becomes visibly slow.
- **No bounce handling on the acknowledgement email (A-B6/D9)** — a mistyped but
  syntactically valid address fails silently. Acceptable at launch; the cheap
  follow-up is watching Resend hard bounces. Related: `LR-I10`.
- **No uniqueness constraint on `vendors.name` or `accreditation_no`** — the same
  business can register twice under two emails. Acceptable for now: `auth.users`
  enforces email uniqueness, duplicates are visible at review, and a hard
  constraint would wrongly reject legitimate branches. Revisit if duplicates
  become common.
- **`accreditation_no` is written as `""` for individuals** (`route.ts:124`)
  though the column is nullable and documented as "NULL means none"
  (`20260504000002_schema.sql:77`). Harmless inconsistency; fix opportunistically.
- **Stale "Mock phase" comment and toast** in
  `command/components/vendors/VendorViewModal/useKycPanel.ts:43-51` — the storage
  backend landed 2026-07-06. Dead copy on a fallback branch, not a defect.
- **No side-by-side ID/selfie comparison** in the KYC panel — both appear as rows
  in a flat document list, opened one at a time. Reviewable as-is; a comparison
  view is a Stage B+ quality improvement, not a gap.
- **`LR-B3`** (Command's fabricated Overview/Transactions figures) — real, and
  `command` is being deployed, but it is not on the sign-up or approval path.
  Stays in `LR`. ⚠️ Do not let an admin read those numbers as fact in the
  meantime.

---

## Execution order

**All decisions are closed.** The one precondition is re-establishing the baseline
(see Status). **No `LR` dependency remains** — every item below lives in this plan.

**Stage A — order is by dependency, not numbering:**

1. **A-B5** (record hosted auth settings, incl. `enable_signup = false`) and
   **D3's WAF availability check** — both are findings-gathering, block later
   items, and change nothing. Do these first so A-B2, A-B4 and A-B6 are not
   planned against assumptions.
2. **A-B2** (rate limiting + server-side password floor) — depends on step 1's WAF
   answer. **Moved ahead of A-B1 deliberately:** A-B1 introduces `prepare`, a
   public endpoint that mints Storage write tokens, and A-I1 introduces a public
   enumeration endpoint. Neither may ship unthrottled, so the limiter lands first.
3. **A-B1** (the 413 fix) — the one blocker that makes sign-up impossible. Carries
   **A-I1** and **A-I5** as riders in the new `prepare` route, plus the
   document-count and total-bytes caps.
4. ~~**A-B3** (privacy notice + consent)~~ — **⏸ PARKED 2026-08-08**, deferred by
   the user. Not in the Stage A gate. Pairs with **A-I4** when unparked.
5. **Appendix A migration** → approval gate → **A-B6** (acknowledgement email).
   Its *verification* depends on the user's D7 override confirmation; its code
   does not.
6. **A-B4** (redirect allow-list) — needs the deployed production URL, so it lands
   with the first deploy. ⚠️ **B-B4 depends on this being *verified*, not merely
   done.**
7. **A-B7** (security headers) — independent of every other item and safe to do
   any time, but **start the `Content-Security-Policy-Report-Only` phase early**:
   it needs every flow exercised before enforcement, and the KYC camera capture is
   the flow most likely to trip it. Flip to enforcing before the public URL is
   handed out.
8. **A-I2, A-I3, A-I4, A-I6, A-I7, A-I8** — independent, safe in any order.
   **A-I3's copy must not be finalised before A-B6 lands**, or it will promise the
   wrong thing again.

**Stage B — after Stage A is live:**

9. **B-B4** (first Command user) — nothing else in Stage B is executable by anyone
   without it. **Hard dependency: A-B4 must be confirmed working first**, because
   the bootstrapped account has no password and recovery is its only way in.
10. **B-B1** (pending state recognised) — do the type change and the `as any`
    removal *first*; `tsc` then scopes the next two steps for you.
11. **B-B3** (KYC indicator) before **B-B2** — deliberately reversing the
    numbering. B-B2's Activate button and D8's confirmation guard both need the
    KYC state on the card already; building the button first means touching it
    twice.
12. **B-B5 + B-B2 together, in that internal order** — the targeted status write
    first, then repoint the button at it. **Coupled: neither ships alone.** B-B2
    without B-B5 puts a new Activate button on a call that silently reverts vendor
    edits; B-B5 without B-B2 fixes a write nobody can reach correctly yet.
13. **B-I1** (approve/reject notifications) — reuses Appendix A's types, no second
    schema gate. **B-I2** (vendor access verification) any time, though it pairs
    naturally with B-B1 since both concern how `pending_activation` is presented.

---

## Verification

| Item | How | Kind |
|---|---|---|
| A-B1 | Caps and validation by unit/route test; **the 4.5 MB behaviour only on a deployed preview** with a >4.5 MB packet | mixed — needs deploy |
| A-B2 | WAF: fire N+1 requests against the deployed endpoint, expect throttling. Password floor: direct POST with a 7-char password, expect rejection | needs live environment |
| ~~A-B3~~ | ⏸ **PARKED 2026-08-08** — no verification owed while parked. When unparked: consent gate is machine-checkable; adequacy of the notice is **not** — it needs a human read, and ideally a qualified one | — |
| A-B4 | Request a reset on production, open the link, land on the reset view | needs live environment |
| A-B5 | The written record itself is the deliverable | needs live environment |
| A-B6 | Assert a `notifications` row is written with `portal: "vendor"` and the new vendor's `user_id` (machine). Then register with a real address and confirm the mail arrives **at that address, not the override inbox** — requires the user's D7 confirmation first. Also assert a forced failure in the notification block does **not** roll back the registration | mixed — needs live environment |
| A-B7 | `curl -I` the deployed origin of each app; assert every header is present and that `frame-ancestors 'none'` is in the CSP. **The real check is the Report-Only phase:** exercise KYC camera capture, Realtime notifications, Command's signed-URL viewer and the Transactions print path, and assert **zero** violations before enforcing | needs live environment |
| A-I1 | **Submit path:** submit with an existing email; assert the failure occurs before any upload and the message is the fixed copy, never GoTrue's. **Step-2 path:** type an existing address, assert the neutral message appears without advancing, that the request is a `POST`, that the body is `{ available: false }` with no other fields, and that it fires once after the debounce — not per keystroke. **Assert the endpoint is throttled** (A-B2 coupling) — an unthrottled version is worse than not shipping it | machine-verifiable, except throttling which needs the deployed WAF |
| A-I2 | Register, then assert `profiles.full_name` is non-empty and the name renders in Command's user list | machine-verifiable (DB + browser) |
| A-I3 | Human read against what the product actually does | not machine-verifiable |
| A-I4 | Abandon a draft, advance the clock past the TTL, reload, assert it is gone | machine-verifiable |
| A-I5 | POST `docLabels: '[{"a":1}]'`, expect a 400 | machine-verifiable |
| A-I6 | Force the divisions query to fail, assert a non-200 and a distinct message | machine-verifiable |
| A-I7 | Delete the profile row mid-flight (or stub the update to match zero rows), assert rollback | machine-verifiable |
| B-B1 | Register a vendor; assert it appears under a **Pending** tab, in the pending count, with an amber "Pending Activation" `StatusBadge` and a non-red border. Also assert `tsc --noEmit` is clean **after** the `as any` removal — that is the real check that every site was found | machine-verifiable (browser + tsc) |
| B-B2 | Assert the action button reads **Activate** for pending, **Suspend** for active, **Reinstate** for suspended — and that no pending vendor is ever offered "Reinstate". **D8:** assert the confirmation appears for `rejected` and `null` KYC, names the KYC state, allows proceeding, and does **not** appear for `approved`. If the base modal was renamed, assert the two existing delete flows still render unchanged | machine-verifiable (browser) |
| B-B5 | **The regression test this item exists for:** load Command's vendor list, change the vendor's phone from the vendor portal, then click Suspend in Command. Assert the new phone **survives**. Repeat for `name`, `email`, `accreditation_no` — the four overlapping columns. Also assert the issued statement updates **only** `status_id` | machine-verifiable (browser + DB / network panel) |
| B-B3 | Four vendors, one per KYC state (`null` / `submitted` / `approved` / `rejected`); assert each badge is correct and distinguishable from the account-status badge. Assert the list issues **one** query — no per-vendor KYC fetch | machine-verifiable (browser + network panel) |
| B-B4 | Create the first Command user on a project with none, sign in | needs live environment |
| B-I1 | Approve and reject; assert the vendor receives both a notification row and an email | needs live environment |

Items migrated from `LR` on 2026-08-08 also need verifying here, not there:

| Item | How | Kind |
|---|---|---|
| A-B4 | A real recovery email on each deployed portal, end to end. **Must pass before B-B4 runs** | needs live environment |
| A-B5 | The written record of confirmed hosted values is the deliverable. Then assert registration and Command's create-user route still work with `enable_signup = false` | needs live environment |
| A-I8 | Change a user's email via the new admin action; assert `auth.users.email` changed and `profiles.email` followed via the sync trigger | machine-verifiable (DB) |
| B-B4 | On a project with no root: run the script, assert it creates exactly one, assert a **second run refuses**, then set a password via Forgot Password and sign in | needs live environment |
| B-I1 | Approve and reject; assert the vendor gets both a notification row and an email | needs live environment |
| B-I2 | Suspend a vendor with an **approved** packet; assert they are told they are suspended, **not** "approved — awaiting activation". Revoke the `vendor` portal row and assert access is refused for that reason | machine-verifiable (browser + DB) |

**Baseline to re-establish before Stage A starts:** `npx tsc --noEmit` clean in
`vendor` and `command`; `npm test` and `npx playwright test` green in `vendor`.
Not run as part of this investigation — this plan changed no code.
