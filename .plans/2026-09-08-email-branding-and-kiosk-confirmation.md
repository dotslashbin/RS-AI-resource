# Email branding + kiosk booking confirmation email

**Date:** 2026-09-08
**App / scope:** `backbone/` (Edge Function + one migration), `booker/` (the payment webhook), `vendor/` (one asset + one copy check)
**Status:** ✅ **COMPLETE** — both objectives delivered and verified in a deployed
environment (2026-09-08).

**Proof:** a real kiosk payment on **staging** produced a correctly branded confirmation email
to the customer, carrying booking reference, service, date and price paid. That is the
end-to-end evidence this plan set out to require — not a unit test, not a hand-inserted row.

**Deployment state (verified 2026-09-08):**

| | local | staging | production |
|---|---|---|---|
| Migration `20260908000001` | ✅ | ✅ | ✅ |
| Edge Function (branding + template) | ✅ | ✅ v16 | ✅ v9 — same bundle `d24d26e6…` |
| `booker` (the writer) | ✅ | ✅ | ✅ |
| `command` (I8 copy) | ✅ | ✅ | ✅ |

All three apps promoted to production 2026-09-08 (confirmed by the user). Corroborated:
`POST https://booker.ezzy.ph/api/payment/webhook` returns 400 on an unsigned body — the route
is live and rejecting correctly.

⚠️ **One honest gap in that corroboration.** A 400 proves the route exists and verifies
signatures; it CANNOT distinguish the new code from the old, because the kiosk branch only
runs after a valid signature AND a real `is_paid` false→true transition. **The definitive
proof is one real kiosk payment in production** — the same evidence that closed staging.
Until that happens, "deployed" is attested rather than observed.

**All 26 items are resolved: 25 ✅ DONE, 1 ✖ ABORTED (I6, declined 2026-09-09), 1 ✖
SUPERSEDED (I14).** Follow-ups discovered along the way were either fixed in place (I1's
delivery-health panel, I16's config.toml declaration) or recorded with their diagnosis where
no fix was warranted (I17, I19).

**Two things remain outside this plan, neither blocking:**
1. **One real kiosk payment in production** — the only evidence that closes the deploy loop.
   Until then production is attested, not observed.
2. **Push is unfinished** — I16 fixed the config landmine, not the feature. Enabling it needs
   FCM/APNs credentials and deserves its own plan.

D1–D4 resolved 2026-09-08.
**Amended:** 2026-09-08 — **D1 reversed to a CID inline attachment** after execution surfaced that local sends go through real Resend; see DECISIONS.
**Reviewed:** 2026-09-08 (gap pass) — added **B7** and **I7–I11**, and **corrected one
overstated claim** in Scope. B7 is the significant one: the plan as first written could have
been implemented faithfully and still silently defeat D4.
**Gate history:** B4's migration was approved 2026-09-08 and has since been applied to all
three environments.

> Two objectives in one plan because they share a chokepoint: **every** notification email
> renders through `lib/templates/base.ts → layout()`, so branding lands once and the new
> kiosk email inherits it for free. Optimise for **not inventing a second email path** —
> the kiosk email must ride the existing `notifications` → trigger → Edge Function chain,
> not a new send call in a route.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "backbone I1").

---

## Scope

**In scope**
- `backbone/supabase/functions/send-notification-email/lib/templates/base.ts` — add the logo to the shared chrome.
- A new bespoke template + registry entry for the kiosk confirmation.
- One migration seeding a new `notification_type_settings` row.
- `booker/app/api/payment/webhook/route.ts` — write a customer-facing notification for kiosk bookings.
- One new pure, unit-tested builder in `booker/lib/`.
- One PNG brand asset generated from the vector already checked in.

**Out of scope, deliberately**
- **Booker-originated bookings do not gain a payment email.** It is one `if` away
  (see I6) but it is a different audience with different copy and its own decision.
- Retinting or redesigning the email layout. A logo is not a licence to restyle.
- The rate-limit work in `.plans/2026-08-12-notification-email-rate-limit.md`.
  ⚠️ **Corrected on review — the first draft said "unrelated, and stays unrelated". That was
  wrong.** The webhook already inserts `members.map(...)` — one statement, **N rows for N
  vendor-admins**, and the dispatch trigger is per-row, so a single kiosk payment already
  fans out to N near-simultaneous sends. This plan makes it **N+1**. Resend's cap is 10/sec,
  so the burst only breaks at **≥10 vendor-admins on one vendor**, which is far less likely
  than the command-admin case that plan measured. It is adjacent and bounded, not unrelated.
  ⚠️ And per that plan's **F6**, *which* message gets dropped is arbitrary — so at that
  threshold the casualty could be the customer's receipt rather than an admin's copy.
  Not fixed here; the threshold is recorded so the interaction is known, not rediscovered.
- Auth/password-recovery emails (Supabase GoTrue templates, not this function).
- `command` and the two mobile apps.

**Cross-cutting:** touches three app folders. Per AGENTS.md that is an approval gate on its
own, separate from the migration gate in B4.

---

## What the investigation established

Verified by reading the code, not assumed. These are the facts the plan rests on.

| # | Fact | Evidence |
|---|------|----------|
| F1 | **All email chrome is already shared.** `renderGeneric` wraps every body in `layout()`, and the registry has zero overrides — so all 14 notification types render through one function today. Branding added to `layout()` is branding added everywhere, with no per-template duplication. | `lib/templates/base.ts:21-41`, `generic.ts:12`, `registry.ts:10` |
| F2 | **There is already a brand constant, and it is already the single source.** `const BRAND = "Ezzy"` at `base.ts:8`, used in the header cell (`:28`) and the footer (`:34`). `architecture/email-sending-domain.md` §4 documents this file as the one place in-body brand text lives. | `base.ts:8,28,34` |
| F3 | **The header is a dark bar (`#111827`) with white 18px text** — no image, no logo. That is the entire current branding. | `base.ts:28` |
| F4 | **The vector logo exists in-repo, but not in a format email can render.** `vendor/brand/ezzy-mark.svg` and `vendor/brand/ezzy-lockup.svg`. Gmail, Outlook desktop and most clients **strip `<img src="*.svg">` and `data:` URIs**. An email logo must be a PNG at an absolute `https://` URL. → D1. | `vendor/brand/`, `BrandLogo.tsx:1-60` |
| F5 | **A generator for rasterising that vector already exists** and uses Playwright, an already-declared devDependency — no new dependency is needed to produce a PNG. | `vendor/scripts/generate-brand-assets.mjs:29-60` |
| F6 | **Kiosk customers always have a real profile with an email.** `resolveOrCreateCustomer` provisions a complete booker account (profile + `booker` portal + `member` role + active status) before the booking row is written, and `bookings.booker_id` is NOT NULL. So `SupabaseRecipientResolver` will always resolve — no new recipient plumbing. | `vendor/lib/kioskCustomer.ts:52-131`, `vendor/app/api/kiosk/booking/route.ts:133-157` |
| F7 | **The kiosk customer currently receives NOTHING.** The webhook's only notification fan-out is to vendor-admins, type `payment_confirmed`, portal `vendor`. Nothing addresses the booker. | `booker/app/api/payment/webhook/route.ts:151-187` |
| F8 | ⚠️ **And the kiosk screen already promises otherwise.** `StepConfirmation` renders *"A confirmation is on its way to {email}."* to a customer who is standing there. **That sentence is false today.** This is not a nice-to-have — it closes a live copy defect. | `vendor/components/kiosk/KioskBooking/StepConfirmation.tsx:45-47` |
| F9 | **Kiosk bookings stay `pending` after payment.** Nothing flips status on `is_paid`, so the existing `booking_confirmed` trigger does **not** fire for them. There is no email to collide with — this adds a first email, not a second. | `20260801000007_fulfilment_notifications.sql:83-91`; no `is_paid` status trigger exists |
| F10 | **Duplicate prevention is already built, at two independent layers.** (a) The webhook updates `.eq("is_paid", false)` and returns early on zero rows — a PayMongo replay never reaches the notification block. (b) The Edge Function claims `notification_emails` on `unique(notification_id)` *before* sending. **No new idempotency mechanism is required.** → see B5. | `route.ts:99-149`; `lib/deliveryLog.ts:20-31`; `20260624000002:26-34` |
| F11 | **A new notification type needs a migration, and only a migration.** `notifications.type` is FK'd to `notification_type_settings(type)`, so the row must exist first. `20260808000001` is the exact precedent to copy — a bare `insert … on conflict do nothing`, no columns, no policies. | `20260525000002_notifications.sql:25`; `20260808000001` |
| F12 | **The dispatch trigger has no type filter** — it fires on every `notifications` insert. A new type reaches email with no trigger change. | `20260624000003:75-78` |
| F13 | **There is no "order id" column.** `bookings` has a UUID `id` and `payment_reference` (the PayMongo `cs_…` session id). The kiosk screen shows the raw booking UUID, labelled **"Booking reference"**. → D2. | `20260507000004_bookings.sql:20-35`, `20260518000001`, `StepConfirmation.tsx:51-52` |
| F14 | **Test convention: `lib/` only.** Both apps run `node --test --experimental-strip-types "lib/**/*.test.ts"`. No route handler in either app has a test. The established response is to extract the logic into a tested pure function in `lib/` — exactly what `kioskAcknowledgements.ts` did after B31. The Edge Function has its own `deno test` suite with injected fakes. | `booker/package.json:10`, `vendor/package.json:10`, `kiosk/booking/route.ts:198-206`, `handler.test.ts` |
| F15 | ⚠️ **Correction to an obvious-looking approach:** sending the email from the webhook route with the Resend SDK would be wrong. `architecture/email-notifications-guide.md` §1 states the design rule outright — *"No Resend code lives in the three apps."* The route inserts a notification; the chain does the rest. | `architecture/email-notifications-guide.md` §1 |

---

## BLOCKERS

### B1 — Notification emails carry no logo, only a text wordmark  ✅ DONE (2026-09-08)
<!-- ✅ AMENDED after the D1 reversal. layout() renders <img src="cid:ezzy-logo"> in the
     existing dark header cell and RETURNS its attachments alongside the html, so the markup
     that introduces a cid also supplies what it points at — a dangling cid and an orphan
     attachment are both bugs, and this makes either unrepresentable. New module
     lib/templates/logoAsset.ts holds the base64 + LOGO_CONTENT_ID; types.ts gains
     EmailAttachment; emailSender.ts forwards attachments to Resend.
     ⚠️ The earlier `logoUrl` threading through HandlerDeps was REMOVED, not kept — with no
     URL there is no config to inject and no unconfigured state, so the renderer signature is
     back to (record, recipient). Net result is less code than the hosted version.
     Verified (re-run after the reversal AND the inlineContentId fix): 6 groups against the
     REAL modules under Node, plus a handler-level check and a wire-level probe through the
     real resend@4.8.0 SDK — cid src + width/height/alt; attachment present with
     `inlineContentId` and NOT `contentId`/`content_id`; the embedded base64 decodes BYTE-IDENTICAL to the PNG on
     disk (catches the constant drifting from the asset); charset before <body>; body escaping
     (#3) intact; ₱ round-trips; and the attachment survives orchestration to reach the sender.
     ⚠️ Visual confirmation is no longer reproducible locally: a browser cannot resolve a
     `cid:` reference, so the header only renders in a real mail client. The screenshots taken
     against the hosted version confirmed the layout, ink and peso sign; the cid resolution
     itself is confirmed only by a live send.
     ⚠️ NOT verified here: `deno test` and `deno check` — Deno is not installed in this
     environment. See the Verification section. -->
**File:** `backbone/supabase/functions/send-notification-email/lib/templates/base.ts:28`

The header cell renders `${BRAND}` as plain text. Every email the platform sends —
14 notification types, all through this one function (F1) — is unbranded beyond a word.

**Fix approach:** replace the header cell's text node with a bordered `<img>` of the Ezzy
lockup, keeping the dark `#111827` bar. Because `layout()` is the sole chrome (F1), this is
the *only* place branding is added — reusability is structural, not a convention anyone has
to remember. Requirements, all of which are email-client constraints rather than preferences:

- **PNG at an absolute `https://` URL.** No SVG, no `data:` URI (F4).
- **Explicit `width`/`height` attributes** plus `style="display:block;border:0;"` — Outlook
  ignores CSS-only sizing and adds a border to linked images.
- **`alt="Ezzy"`** — roughly 40% of recipients see images blocked by default; the alt text
  must degrade to the wordmark that is there today, styled white so it stays legible on the
  dark bar.
- **2× the display size**, downscaled by the width attribute, for retina.
- Ink must be **white/knockout**, because it sits on `#111827`. → D3.
- `BRAND` (F2) stays and stays used — the footer at `:34` and the `alt` both read from it,
  so a rename is still one edit.

**Depends on:** B2 (the asset), D1 (where it is served from).

### B2 — No email-compatible logo asset exists  ✅ DONE (2026-09-08)
<!-- ✅ vendor/scripts/generate-brand-assets.mjs extended with one output:
     brand/ezzy-lockup-email.png, 320×130, transparent, white knockout.
     ⚠️ Output moved from public/ to brand/ after the D1 reversal — it is NOT served over
     HTTP any more, and leaving it in public/ would have implied a hosting contract that no
     longer exists.
     Height DERIVED from the vector's viewBox (not typed in), per that file's own rule.
     ⚠️ FINDING, not anticipated by the plan: the lockup has TWO fills — `#034bfc` AND
     `currentColor` (how BrandLogo.tsx lets a caller set ink via text colour). A rasteriser
     has no cascade, so replacing only the blue would have rendered the "e" and "y" BLACK —
     half the wordmark invisible on the #111827 bar. Both are now replaced. Recorded as I12.
     Verified by measurement: 320×130, 4 channels with alpha; of 17,329 opaque pixels,
     17,329 are white and 0 are non-white — i.e. the whitening is provably complete, not
     eyeballed. Also confirmed `git status` shows the four pre-existing icon outputs and
     favicon.ico UNCHANGED, so extending the script did not perturb what it already produced. -->
**File:** new — `vendor/brand/` (source) → a hosted PNG (location per D1)

F4: only SVG vectors and square app-icon PNGs are checked in. The square mark alone is a
weaker header treatment than the lockup, and no lockup PNG exists.

**Fix approach:** generate `ezzy-lockup-email.png` from the checked-in
`vendor/brand/ezzy-lockup.svg`, following `vendor/scripts/generate-brand-assets.mjs`
(F5) — Playwright rasterisation from the vector, no resample-of-a-resample, no new
dependency, and repeatable rather than an ad-hoc command. That script's own header explains
why this rule exists: *"Six PNGs produced by unrepeatable ad-hoc commands rot immediately."*

Extend the existing script with one more output rather than writing a second script.
Target ≈ 320×130 px (2× a 160px display width), knocked out to white, transparent
background so it sits on the dark bar cleanly.

**Nothing is needed from you here** unless D1 goes a direction that requires a differently
cropped mark — the vector in the repo is sufficient.

### B3 — The kiosk confirmation email does not exist  ✅ DONE (2026-09-08)
<!-- ✅ lib/templates/kioskBookingConfirmed.ts written and registered as the FIRST entry in
     registry.ts's overrides map (which was built for exactly this). Renders the four fields
     as a label/value table inside layout(), so it inherits the shared branding and charset
     with no duplication.
     I9's three traps are each implemented AND regression-tested:
       1. NO `Date` anywhere — the date is formatted from the string's own parts via a month
          table, so a UTC runtime cannot shift 2026-09-10 to the 9th.
       2. `??` not `||` — a genuine 0 renders "0.00"; an ABSENT price renders an em dash.
          Both directions asserted, since either alone passes with the wrong operator.
       3. numeric-as-string coerced with Number() AFTER the absent-check.
     Peso emitted as &#8369; in HTML and a literal in text (I7's second half).
     Verified: 10 assertion groups against the real modules — registry routing (kiosk →
     bespoke, others still → generic), all four fields in BOTH html and text, the three I9
     traps, empty-data producing no "undefined"/"NaN", offering_name HTML-injection blocked,
     branding+charset inherited, and thousands grouping at 1,234,567.50.
     Rendered preview confirmed visually.
     ⚠️ NOT verified: `deno test`/`deno check` (Deno unavailable here) and a live send —
     impossible until B5 writes the type. -->
**Files:** new — `.../lib/templates/kioskBookingConfirmed.ts`; modified — `registry.ts:10`, `types.ts:6-33`

F7/F8: the customer is told an email is coming and none is sent.

**Fix approach:** the first bespoke template in the registry — `registry.ts:6-9` was written
for exactly this case (*"register a per-type override here when a type earns bespoke
copy/CTA"*). The generic renderer prints only `title` + `body` as one paragraph, which
cannot render the four-field receipt this email needs.

The template reads structured values from `record.data` (already `jsonb`, already how
`booking_id`/`offering_name`/`booked_date` are carried by the existing triggers) and renders
a label/value table inside `layout()` — so it inherits B1's branding with no duplication:

| Row | Source | Notes |
|-----|--------|-------|
| Booking reference | `data.booking_id` | → D2 |
| Service | `data.offering_name` | offering *name*, not `code` — the customer-facing string, matching `StepConfirmation.tsx:56` |
| When | `data.booked_date` + `data.start_time` | formatted in the template |
| Paid | `data.price_paid` | formatted `₱#,###.00` in the template |

**Formatting lives in the template, not in the webhook.** `data` carries raw values; one
place owns presentation, and the plain-text alternative is built from the same values.

⚠️ **`escapeHtml()` on every interpolated value without exception** — `offering_name` is
vendor-authored free text and reaches this email unmediated. `base.ts:1-4` states this rule;
`handler.test.ts:100-108` is the test that enforces it.

⚠️ **Redeploy is not optional.** Per `20260808000001`'s own warning, adding the type to the
`NotificationType` union without redeploying the function means mail still sends — through
the *generic* template. That failure mode is wrong copy, not no delivery, so it will not
announce itself.

### B4 — The new notification type has no row, so no notification can be inserted  ✅ DONE (2026-09-08)
<!-- 🔄 Approved by the user 2026-09-08. Migration WRITTEN, not applied:
     backbone/supabase/migrations/20260908000001_kiosk_booking_notification_type.sql
     Body is exactly the statement approved below — one insert, on conflict do nothing.
     ✅ Applied by the user on LOCAL, STAGING and PRODUCTION. Verified on both hosted
     projects via `supabase migration list`: 20260908000001 shows a populated `remote`
     column on fbxbwnfeimzhgxpshdpa and pdkejyjidrfxksaczvfy. -->
**File:** new — `backbone/supabase/migrations/20260908000001_kiosk_booking_notification_type.sql`

F11: `notifications.type` is FK-constrained. Without this row the insert in B5 raises and
the customer silently gets nothing.

**Exact change, inline for approval — this is the entire migration body:**

```sql
insert into public.notification_type_settings (type, label, description) values
  ('kiosk_booking_confirmed', 'Kiosk Booking Confirmed',
   'Sent to the customer when payment for their kiosk booking is confirmed.')
on conflict (type) do nothing;
```

Column order and the omission of `is_enabled` follow `20260808000001:23-27` — `label` is
`text not null` with no default, and `is_enabled` defaults to true.

**Blast radius:**
- **Data** — one reference row inserted. Rewrites nothing, validates nothing, backfills nothing.
- **Lock / performance** — a single-row insert into a table with 14 rows. Negligible.
- **Downstream** — the `NotificationType` union in `types.ts` (B3) and a function redeploy.
  Command's Notification Settings page picks the row up automatically (it lists the table),
  giving admins a per-type kill switch for free.
- **Reversibility** — `delete from public.notification_type_settings where type = 'kiosk_booking_confirmed'`,
  safe **only** while no `notifications` row references it (FK). After go-live, set
  `is_enabled = false` instead. Same caveat `20260808000001:41-44` records.

I will not write this file until you approve.

### B5 — Nothing writes the notification when a kiosk payment settles  ✅ DONE (2026-09-08)
<!-- ✅ New pure builder booker/lib/kioskBookingNotification.ts returns the notification row
     or null; the webhook calls it inside the existing try, after the confirmed is_paid
     false→true transition. No Resend code entered booker (grep-verified) — the route writes
     a row and the existing trigger chain does the rest.
     The booked_via gate lives IN THE BUILDER, not at the call site, so it is unit-tested.
     Verified: 16 new node:test cases, all passing (36 total in booker, 0 fail);
     npx tsc --noEmit clean; lint clean for both touched files (the repo's 23 pre-existing
     lint problems were confirmed identical at HEAD via a stash, so none are attributable
     to this change). -->
**File:** `booker/app/api/payment/webhook/route.ts:151-187`, plus new `booker/lib/kioskBookingNotification.ts`

**Fix approach:** inside the existing `try` block that already fans out to vendor-admins —
**after** the `is_paid` false→true update has been confirmed (`route.ts:99-149`) — add a
second, independent insert addressed to `booking.booker_id`, portal `booker`, gated on
`booking.booked_via === 'kiosk'` and on its type being enabled.

Three things this deliberately does **not** do:

1. **It does not send an email.** It inserts a `notifications` row. The dispatch trigger and
   the Edge Function do the rest (F12, F15). No Resend code enters `booker/`.
2. **It does not extend the existing vendor-admin insert.** Different audience, different
   portal, different copy, independently toggleable. One array of rows for two audiences
   would couple them.
3. **It does not re-read the booking.** `route.ts:155` already selects the row; it needs
   three more columns — `booked_via`, `start_time`, `price_paid` — on the query that is
   already there, plus `offerings(name)` and the booker's email is not needed at all (the
   Edge Function resolves the recipient from `user_id`).

**The row-building is extracted to `booker/lib/kioskBookingNotification.ts` as a pure
function** — F14. Routes are untestable under this repo's `node --test` setup; the
established response is to move the logic to `lib/` and test it there, exactly as
`kioskAcknowledgements.ts` did after B31 (`kiosk/booking/route.ts:198-206` records why).
The function takes the booking row + offering name and returns the notification row or
`null` when `booked_via !== 'kiosk'`.

⚠️ **Failure isolation must be preserved.** The block is wrapped in `try/catch` that logs
and swallows, because *"failure must never affect the webhook response"* (`route.ts:151`).
The new insert must sit inside that same guarantee, and the two audiences must not share a
failure — if the vendor insert throws, the customer must still get theirs. That means two
statements in sequence, each individually guarded, not one `Promise.all` whose rejection
takes both down.

### B6 — Duplicate emails: confirm the existing guards cover this, add nothing  ✅ DONE (2026-09-08)
<!-- ✅ Confirmed by BEHAVIOUR, not by reading the code — which is what this item demanded.
     No new mechanism was built; both existing layers were proven:
     LAYER 1 (the real guard, webhook): the IDENTICAL signed PayMongo event was re-fired at
     the running route. It answered 200 and changed NOTHING — kiosk notifications stayed at
     1, vendor at 3, delivery rows at 1. `.eq("is_paid", false)` absorbed the replay before
     any second notification could exist.
     LAYER 2 (Edge Function): re-invoking the same notification_id returned "idempotent"
     with still exactly 1 notification_emails row — no second send.
     Verified locally on 2026-09-08 against booking 6418731f. -->
**Files:** `booker/app/api/payment/webhook/route.ts:99-149`; `.../lib/deliveryLog.ts:20-31`

Listed as a blocker because it is an explicit requirement, and the honest answer is that
**the mechanism already exists and no new one should be built** (F10). Building a third
would be the over-engineering this plan should avoid. Two independent layers:

| Layer | Guard | What it stops |
|-------|-------|---------------|
| 1 — the webhook | `.update({is_paid:true}).eq("id", …).eq("is_paid", false)` returns zero rows on a replay, and the route returns early at `:131-149` | A repeated PayMongo delivery never reaches the notification insert. **This is the real guard** — it stops the duplicate at the source, before a second notification row can exist. |
| 2 — the Edge Function | `notification_emails.claim()` inserts under `unique(notification_id)`; a lost race returns `"idempotent"` and does not send | A repeated *dispatch* of one notification. Belt to layer 1's braces. |

Layer 1 is a conditional UPDATE — atomic in Postgres — so two simultaneous deliveries cannot
both see `is_paid = false`. Exactly one wins.

⚠️ **The honest limitation, stated rather than buried:** the guards are ordered
*update-then-notify*. If the update succeeds and the notification insert then fails, a
PayMongo retry finds `is_paid` already true and returns early — **the customer's email is
lost with no retry**. This is not new; it is the existing behaviour of the vendor-admin
notification on the same lines, and it is the same class of silent loss recorded as **F7 in
`.plans/2026-08-12-notification-email-rate-limit.md`**. This plan does **not** fix it —
inverting the order or adding an outbox is a larger change than either objective justifies,
and would be a different plan. **I1** records it so it is not rediscovered as a surprise.

**Verification is behavioural, not structural:** replay the same webhook payload twice and
assert exactly one `notifications` row and one `notification_emails` row. Reading the code
and agreeing it looks right is not verification of an idempotency claim.

### B7 — ⚠️ The customer insert must not sit inside the `payment_confirmed` enabled check  ✅ DONE (2026-09-08, behaviourally proven)
<!-- ✅ Implemented as designed: both type rows are read up front with maybeSingle(), and the
     two audiences sit in SIBLING `if` blocks, each individually try/guarded so one failing
     cannot take the other down.
     Verified STRUCTURALLY, not by eye: both gates measured at indentation depth 9 — equal
     siblings inside `if (booking)` at depth 7. Had the kiosk branch been nested inside the
     payment_confirmed gate it would sit deeper, which is the defect this item exists to
     prevent.
     ✅ BEHAVIOURAL PROOF COMPLETED 2026-09-08, both directions, against the live route:
       - `kiosk_booking_confirmed` OFF → kiosk notifications 0, vendor notifications 3
         (the vendor audience UNAFFECTED);
       - `payment_confirmed` OFF      → kiosk notifications 1, vendor notifications 0
         (the customer audience UNAFFECTED).
     Direction 2 is the one that matters: had the kiosk branch been nested inside the
     payment_confirmed gate, it would have read 0 and the D4 decision would have been
     silently undone. Both settings restored to true afterwards (verified). -->
**File:** `booker/app/api/payment/webhook/route.ts:157`

**This is a review finding, and it is the reason this pass was worth running.** B5 as first
written said "add a second, independent insert inside the existing `try` block". A faithful
implementation of that sentence would put it inside the existing guard:

```ts
if (typeRow?.is_enabled && booking) {        // typeRow is payment_confirmed
  …vendor-admin fan-out…
  // ← the obvious place to add it, and it is wrong
}
```

That nesting makes an admin who disables the **vendor** `payment_confirmed` notification
silently stop **customer receipts** — the exact coupling D4 was chosen to avoid, reintroduced
by code structure after being correctly decided at the design level. Nothing would fail, no
test would go red, and the symptom would appear as "customers stopped getting emails" with no
connection to the toggle someone flipped weeks earlier.

**Fix approach — the shape is load-bearing, not stylistic:**
- Read **both** type rows up front (`payment_confirmed` and `kiosk_booking_confirmed`),
  each with `.maybeSingle()` — matching `command/services/kyc-admin.service.ts:128`, which
  already prefers it over `.single()` for exactly this "row may not exist" case.
- **Two sibling `if` blocks**, each gated on its own type row, neither nested in the other.
- The shared reads (`booking`, `offering`) stay shared — they are not the coupling.
- Each insert individually guarded so one throwing cannot take the other down (B5).

**Verification is behavioural:** set `kiosk_booking_confirmed.is_enabled = false`, pay, and
assert the **vendor** notification still lands. Then invert it. Both directions must pass —
testing one direction cannot detect the nesting.


---

## IMPORTANT

### I1 — Notification failures are silent and unmonitored  ✅ DONE (2026-09-09)
**Files:** new — `command/app/api/notification-health/route.ts`,
`command/components/settings/NotificationDeliveryHealth/*`; modified —
`command/services/notifications-admin.service.ts`, `NotificationSettingsPage.tsx`

Scope was widened on the user's decision (2026-09-09) to cover **both** halves of the gap,
which this item and the rate-limit plan's I1 had been describing from opposite ends:

| | Failure | Visible in `notification_emails`? |
|---|---|---|
| **(a)** | The webhook's insert was swallowed by its own catch — no notification row written | ❌ **no row exists at all** |
| **(b)** | Row written, the send failed at the provider (bad key, 429, bad address) | ✅ `status = 'failed'` |

A panel built only on `notification_emails` sees **(b)** and is structurally blind to
**(a)** — worth stating, because it would be easy to build one and believe I1 was closed.

**What was built.** A Command "Delivery health" panel under Notification Settings, showing
failed sends grouped by error, **and** a reconciliation of paid kiosk bookings against the
confirmations that should exist. The second is the only way to see (a).

**Why an API route and not an RLS policy.** `notification_emails` is service-role-only by
deliberate design (20260624000002:20-21). Widening it meant a new SELECT policy plus a GRANT
to `authenticated` — a migration, an approval gate, and permanent client exposure of an
operational table carrying recipient addresses. Reading it behind `verifyCommandCaller()`
keeps the table closed and puts authorisation somewhere explicit, following
`app/api/users/route.ts`. **No schema change, no approval gate.**

**Three correctness details that are easy to get wrong:**
1. ⚠️ **`RECONCILE_FLOOR = 2026-09-08`.** `kiosk_booking_confirmed` did not exist before
   then, so every kiosk booking paid earlier legitimately has no confirmation. Without the
   floor the panel opens on a wall of false positives and gets ignored — the exact fate it
   exists to avoid.
2. ⚠️ **A disabled type is not a fault.** Found by testing against real local data: the
   booking paid during B7's toggle test showed as "unnotified" because the type was
   deliberately off. The route now reads `is_enabled` and the panel reports that state as
   expected rather than as an incident. A health panel that cries wolf is not read.
3. ⚠️ **Reconciliation is two reads plus a JS difference, not a `NOT EXISTS`** — AGENTS.md:60
   forbids raw SQL from app code and PostgREST cannot express an anti-join. Both reads are
   capped at 1000 and the response carries `truncated`, because a truncated read makes the
   difference untrustworthy in the direction that INVENTS problems (a notification beyond
   the cap makes a booking look unnotified). Reported rather than hidden — the class of bug
   `pagedFetch.ts` was written against.

Also: the hook exposes `failed` separately from "loaded with nothing in it", so a panel that
could not read says so instead of rendering a green "all clear" it never verified.

**Verified:** reconciliation logic checked against real local data — correctly identified
the one genuinely unnotified booking out of three paid kiosk bookings since the floor;
`npx tsc --noEmit` clean; lint clean for the new files; full `npm run build` passes with
`/api/notification-health` registered.
**⚠️ NOT verified:** the rendered panel in a browser, and the route's authorisation path —
command has no test script (see `command/lib/pagedFetch.ts`'s header) and both need a
running app with a signed-in Command admin.

**Does NOT close:** the underlying recoverability gap. A swallowed insert is now *visible*,
not *retryable*. Making it recoverable means notify-then-mark-paid or an outbox, which
changes the payment path — deliberately left alone; see the rate-limit plan.

### I2 — `StepConfirmation`'s promise becomes true; confirm the copy still fits  ✅ DONE (2026-09-08) — no change required
<!-- ✅ Verified by reading both sides. StepConfirmation.tsx:51 labels the value "Booking
     reference" and renders `params.get("booking_id")`; the email template labels the same
     value "Booking reference" and renders `data.booking_id`. They agree in BOTH label and
     value, so a customer holding the email and looking at the screen sees one identifier
     named one way. That is D2 paying off — no code change needed.
     The screen's promise "A confirmation is on its way to {email}" is now TRUE for kiosk
     bookings, which was the point. Component-separation: nothing edited, so nothing to
     assess. -->
**File:** `vendor/components/kiosk/KioskBooking/StepConfirmation.tsx:45-47`

F8. No code change is expected — the sentence becomes accurate rather than aspirational.
Listed so it is consciously re-read once rather than assumed. If D2 changes what the email
calls the identifier, the screen's *"Booking reference"* label at `:51` must match it: a
customer holding an email that says "Order ID" and a screen that says "Booking reference"
for the same UUID will ask staff which one is right.

**No component work.** `StepConfirmation` is a pure display component with no state, effects
or handlers, and `.claude/skills/component-separation/SKILL.md` exempts exactly that shape
from the companion-hook rule. It already has a co-located `KioskBooking.module.css`. If this
item turns out to need a real change, that assessment must be redone before editing.

### I3 — `architecture/email-sending-domain.md` §4 will be stale  ✅ DONE (2026-09-08)
<!-- ✅ §4 gains an "In-body logo" bullet and the checklist table a matching row; both state
     that the logo is CONFIG (the secret), that it is served from vendor.ezzy.ph rather than
     the sending domain — so a domain change needs nothing here — and that unset fails soft.
     Also updated architecture/email-secrets-setup.md: secrets table row, the
     `supabase secrets set` example, and a go-live checklist item warning that the variable
     is needed in BOTH places and that a miss is silent.
     Verified: docs only, read back after editing. No runtime behaviour. -->
**File:** `architecture/email-sending-domain.md` §4 + the checklist table

It currently tells a future reader that in-body brand is *text* in `base.ts`, needing a code
edit only on a name change. After B1 there is also a **logo URL**, which under D1(a) is
config. Add the row so the domain-change runbook stays complete. `email-notifications-guide.md`
§1's "no Resend code in the apps" rule is unaffected and stays true.

### I4 — `types.ts` union must gain the new type, and the function must be redeployed  ✅ DONE (2026-09-08)
<!-- 🔄 Union updated. ⚠️ CORRECTED 2026-09-08 after the user asked what I4 actually is:
     `NotificationType` is declared and referenced NOWHERE (verified by grep — the only hit
     is its own declaration). Records carry `type: string` and dispatch is a runtime lookup,
     `overrides[type] ?? renderGeneric`. So the union has ZERO runtime effect: it is
     documentation.
     What the redeploy really carries is registry.ts (routing) + kioskBookingConfirmed.ts.
     This plan, and my migration header, both inherited the "update the union and redeploy"
     framing from 20260808000001 — which is operationally right (redeploy IS required) but
     misattributes the mechanism. types.ts now says so in a comment.
     ⚠️ NOTE: 20260808000001's own header carries the same imprecision. NOT corrected —
     it is an applied migration and AGENTS.md forbids editing those. Flagged only.
     Consequence for testing: LOCAL testing needs no deploy at all, since `functions serve`
     reads local files.
     ✅ Both hosted projects now carry the bespoke template — verified by bundle hash rather
     than by version number: staging v16 and production v9 both report
     ezbr_sha256 d24d26e6…, i.e. the SAME bundle. Production's lower version number is not a
     lag; its deploy reported "No change found" precisely because the bundle already
     matched. -->
**File:** `.../send-notification-email/types.ts:6-33`

Mechanical, but it is the step `20260808000001:35-39` singles out as *"downstream, not
optional"* — and the failure is quiet (wrong template, not no mail). Follow the comment
convention already in that file for the two prior additions.

### I5 — Local verification needs Vault secrets that `db reset` wipes  ✅ DONE (2026-09-08)
<!-- ✅ The trap was hit for real during Stage 2 testing, exactly as predicted: local Vault
     was empty, the trigger read NULL and returned early SILENTLY, and it looked identical
     to a broken template. Closed by creating `backbone/supabase/_local-vault.sql` (a
     re-runnable, idempotent re-seed) and adding a `.gitignore` entry for it — verified with
     `git check-ignore`. Re-run it after every `db reset`. -->

Not a defect — a known trap that will otherwise cost an hour. `edge_function_base_url` and
`notification_email_secret` are wiped by `supabase db reset`, and without them the dispatch
trigger no-ops **silently** (`20260624000003:57-60`), which looks identical to a broken
feature. Re-run `backbone/supabase/_local-vault.sql` after any reset.
Ref: `architecture/email-notifications-guide.md` §3.

### I6 — Booker-originated payments send no receipt at payment time  ✖ ABORTED (2026-09-09)

**Declined by the user on 2026-09-09**, to be revisited as part of dedicated booker work
rather than bolted onto a kiosk plan.

**⚠️ Scope of what is actually missing — narrower than the original title suggested.**
Booker-originated customers are NOT without email. They already receive the full booking
lifecycle, all of it branded by Stage 1:

| type | when |
|---|---|
| `booking_confirmed` | the vendor approves their booking |
| `booking_rejected` | the vendor rejects it |
| `booking_cancelled` | a confirmed booking is cancelled |
| `booking_fulfilled` | the vendor marks the session complete |

What they do not get is a **receipt at the moment payment settles** — the thing kiosk
customers now receive. The original heading ("send the customer nothing") overstated it and
is corrected here, because that phrasing would push a future reader toward treating this as
a hole rather than an asymmetry.

**Why declining is reasonable rather than an oversight:** `booking_confirmed` already lands
shortly after payment in the normal flow, so a payment receipt risks reading as a duplicate.
The kiosk case is genuinely different — a walk-in has no account they use, no booking list to
open, and is standing at a desk being told a confirmation is coming.

**It stays one `if` away.** `buildKioskBookingNotification` returns `null` for
`booked_via: 'booker'` by design and is unit-tested for it, so enabling this later means a
second builder or relaxing that gate — not restructuring the webhook.

**Revisit when:** booker portal work is picked up.

### I7 — `layout()` emits no `<head>` and no charset, and the new email is the first with `₱`  ✅ DONE (2026-09-08)
<!-- ✅ layout() now emits a <head> with <meta charset="utf-8"> and a viewport meta.
     Verified: asserted present AND positioned before <body> (a charset after content is
     ignored); a body containing "Paid ₱2,500.00" round-trips through the rendered document
     with the peso sign intact, and renders correctly in the screenshot.
     The numeric-entity half of the fix belongs to the kiosk template and lands in stage 2. -->
**File:** `.../lib/templates/base.ts:22-24`

Verified on review: the document goes straight from `<!doctype html><html lang="en">` to
`<body>`. There is **no `<head>` and no `<meta charset>`** at all. This has never mattered
because every existing email is ASCII — the kiosk receipt is the first to carry `₱` (and
`—`, if the unknown-value dash is used). Resend sends UTF-8, but a client that falls back to
a default encoding renders `â‚±` on the one line stating how much money was taken.

**Fix approach:** add a minimal `<head>` with `<meta charset="utf-8">` to `layout()` — it
benefits every template, which is the right place for it. Belt and braces: write the peso
sign as the HTML entity `&#8369;` in the HTML branch, and a literal `₱` in the `text`
branch. Cheap, and removes the question rather than testing for it across clients.

### I8 — ⚠️ The booker email kill-switch now gates customer receipts, and its label says otherwise  ✅ DONE (2026-09-08)
<!-- ✅ PORTAL_META.booker's description now names kiosk receipts explicitly, with a comment
     recording WHY: booker is "deployed, not launched" (overview.md:104), so an admin has a
     plausible reason to switch it off — which would silently stop receipts for live kiosk
     customers.
     Component-separation ASSESSED, not assumed: the change is a one-line edit to a
     module-scope display-metadata constant. No state, effects, handlers or inline styles
     were added, and the component already has its companion useNotificationSettingsPage.ts
     and NotificationSettingsPage.module.css. The convention is satisfied without
     restructuring.
     Verified: npx tsc --noEmit clean in command; lint reports nothing for this file. -->
**File:** `command/components/settings/NotificationSettingsPage/NotificationSettingsPage.tsx:32`

The customer notification is portal `booker` (correct — it is their account's portal), so it
is gated by `notification_email_settings.booker`. That switch is presented to Command admins
as:

> **Booker** — "Booking updates emailed to bookers (confirmed, rejected, cancelled)."

After this change that sentence is **incomplete in a way that matters**: the same switch also
controls kiosk payment receipts. And the risk is concrete rather than theoretical —
`architecture/overview.md:104` records booker as **"deployed, not launched"**, so an admin
has a plausible reason to reason *"no customers are on booker yet, turn its email off"* and
thereby silently stop receipts for kiosk customers who are very much live.

**Fix approach:** extend the description to name kiosk receipts explicitly. This is a
one-line edit to a module-scope display-metadata constant in a component that already has its
companion `useNotificationSettingsPage.ts` and `.module.css` — no state, no effects, no
inline styles added, so `.claude/skills/component-separation/SKILL.md` is satisfied without
restructuring. **Assessed, not assumed:** if this item grows past the constant, redo that
check before editing.

### I9 — Formatting rules are under-specified in three ways that each produce a wrong receipt  ✅ DONE (2026-09-08)
<!-- ✅ All three rules implemented AND regression-tested in BOTH places that format these
     values — the Edge Function template (Stage 2) and the booker builder (Stage 3), which
     are separate apps with no shared package, so the logic is necessarily duplicated:
       1. No `Date` anywhere; the date is built from the string's own parts, so neither a
          UTC Edge runtime nor a UTC Vercel runtime can shift it a day.
       2. `??` not `||` — both directions asserted, because a real 0 and an absent value
          each pass individually with the wrong operator.
       3. numeric-as-string coerced with Number() AFTER the absent-check.
     4 explicit I9 assertions in each of the two test files.
     Confirmed in production-shaped data: the real webhook-created notification rendered
     "7 September 2026 at 09:00 … ₱850.00" from booked_date 2026-09-07 and numeric 850.00. -->
**File:** the new template (B3)

B3 said "formatted in the template" and left three traps open. Each would satisfy the plan as
written while printing something false to a paying customer.

1. **Date must not go through `Date` arithmetic.** `booked_date` is a plain `YYYY-MM-DD`
   calendar date with no timezone meaning. The Edge Function runs in **UTC**, not Manila —
   unlike `StepConfirmation.tsx:32`, which does the same job in the customer's browser and
   can safely use the ambient zone. Copying that line into the function is the obvious move
   and can shift the date by a day. **Rule: format the string's parts directly, or pin
   `timeZone: "Asia/Manila"` explicitly. Never re-parse and re-render in ambient time.**
2. **A real `₱0` is not an unknown price.** The em-dash rule from B3 must trigger on
   *absent*, never on *zero* — `data.price_paid ?? UNKNOWN`, not `data.price_paid || UNKNOWN`.
   This is `StepConfirmation.tsx:14-28`'s rule verbatim (*"a `0` appears only when the read
   actually returned 0"*); the `||` form is the bug it was written against.
3. **`price_paid` is `numeric(10,2)` and may arrive as a string.** Every existing consumer
   coerces — `create-session/route.ts:55` and `kiosk.service.ts:235` both wrap it in
   `Number(...)`. The builder must too, or `toLocaleString` on a string silently yields
   something wrong. ⚠️ But coerce with `Number(x)` **only after** the absent-check in (2) —
   `Number(...) || 0`, the form `kiosk.service.ts:235` uses, would turn an unknown into a
   confident `₱0`.

### I10 — `title` and `body` must stand alone, because the fallback renders only those  ✅ DONE (2026-09-08)
<!-- ✅ The builder composes `body` as prose carrying EVERY fact — service, date, time,
     amount and the booking reference — so the generic renderer (title + body, nothing from
     `data`) still produces a usable receipt during the window between applying the migration
     and redeploying the function.
     Verified: a test asserts all five appear in `body`, plus degradation cases — an absent
     price omits the clause rather than printing ₱0.00, a date-based offering omits the time
     without emitting "at null", a malformed date is dropped rather than echoed, and no
     combination of missing inputs yields "undefined"/"NaN"/"null" anywhere in the body. -->
**File:** the new template (B3) + the notification row built in B5

I4 notes that a missed redeploy silently downgrades this type to the **generic** renderer.
The consequence was not stated: `renderGeneric` prints `title` + `body` and **nothing from
`data`** — so all four required fields would vanish, and the customer would get a branded
email that omits the reference, service, date and price.

**Fix approach:** compose `body` as a complete sentence carrying the reference, service,
date and amount — the way the existing triggers already do
(`20260801000007:87-89`), rather than a stub like "Your payment was received" that only
reads correctly alongside the bespoke table. Then the generic fallback degrades to *plainer*,
not *wrong*. It also makes the in-app notification self-sufficient, which matters because
the customer may never open the booker portal to see it in context.

### I11 — The webhook's existing booking read is missing three columns and the offering name  ✅ DONE (2026-09-08)
<!-- ✅ The bookings select gained booked_via, start_time and price_paid; the offerings select
     gained `name` alongside the `code` the vendor copy still needs. No extra round trip —
     both existing queries were widened.
     ⚠️ CORRECTION to this item as written: it required the PostgREST embed normalisation
     (`Array.isArray(raw) ? raw[0] : raw`) used at create-session/route.ts:83 and
     kiosk.service.ts:227-230. That does NOT apply here — those sites use an EMBEDDED select
     (`bookings.select("offerings(name)")`), whereas this route queries the offerings table
     separately by id, which returns a plain object. Adding the guard would have been
     cargo-culted noise. Verified by reading the actual query shape, not by pattern-matching.
     Also switched `.single()` to `.maybeSingle()` on these reads: `single()` errors when a
     row is absent, and on an environment without 20260908000001 applied the
     kiosk_booking_confirmed settings row legitimately does not exist. -->
**File:** `booker/app/api/payment/webhook/route.ts:155,160`

Concretely, today it reads `select("vendor_id, offering_id, booker_id, booked_date")` and
separately `offerings.select("code")`. The kiosk email needs **`booked_via`** (to gate at
all), **`start_time`** and **`price_paid`**, plus the offering **`name`** — `code` is the
internal short form; `name` is what the kiosk shows the customer at
`StepConfirmation.tsx:56`, and the two must agree.

**Fix approach:** widen the two existing selects rather than adding a third round trip —
`code` is still needed by the vendor copy, so fetch `code, name` together.
⚠️ **Normalise the embed.** PostgREST returns an embedded row as an object *or* a
one-element array depending on the relationship it infers; both
`vendor/app/api/kiosk/payment/create-session/route.ts:83` and `kiosk.service.ts:227-230`
already carry the same `Array.isArray(...) ? raw[0] : raw` guard and say why. Follow it —
this is the third site, not a new problem.

### I12 — The lockup is TWO-TONE; only `currentColor` may be substituted  ✅ DONE (2026-09-08, corrected)
**File:** `vendor/brand/ezzy-lockup.svg`, consumed by `vendor/scripts/generate-brand-assets.mjs`

`ezzy-lockup.svg` carries two paths: the zz+smile at `#034bfc`, and the **"e" and "y" at
`fill="currentColor"`** — the mechanism `BrandLogo.tsx:56` uses to let a web caller set the
ink with an ordinary text colour. A rasteriser has no caller and no cascade, so
`currentColor` resolves to **black** and half the wordmark vanishes into the dark header.

⚠️ **First attempt over-corrected and was wrong in a way that looked fine.** It replaced
*both* fills, producing an all-white wordmark — perfectly legible, and not the brand mark.
The approved dark-background lockup **keeps its blue zz**; only the "e" and "y" go white.
Caught by the user against the reference asset, not by any check here, because "legible
white text in the right shape" passes every automated assertion I had.

**Correct rule, now encoded in the generator with a comment saying why:** substitute
`currentColor` → white and **leave `#034bfc` alone**. This mirrors `BrandLogo.tsx`'s own note
that the mark is deliberately NOT `currentColor`.

**Verified by pixel census** (an eyeball would not have distinguished the two attempts at
thumbnail size): 9,540 blue + 8,350 white opaque pixels, **0 other opaque** — so both inks
are present and no path rendered black. Rendered preview matches the supplied reference.

**Note for whoever picks the header colour:** brand blue on `#111827` measures ≈2.9:1
contrast. The blue is a large graphic element rather than text and reads clearly at this
size, and the supplied asset is explicitly the dark-background variant — recorded as a fact,
not a defect.

### I13 — Resend attachment field names are a documentation trap  ✅ DONE (2026-09-08)
**File:** `.../types.ts` (EmailAttachment), `.../lib/templates/logoAsset.ts`

Found by a **live send**, not by any local check — which is the point worth recording.
`resend@4.8.0` accepts `inlineContentId`; Resend's REST reference documents `content_id`
and its own Node example on the attachments page shows `contentId`. Only the first works.
Unknown properties are dropped when the request body is built, so all three "succeed":
HTTP 200, `notification_emails.status = 'sent'`, and a broken image in the inbox.

**Why no local test caught it:** every assertion was about *our* object's shape, which was
internally consistent and wrong. The gap was between our object and the SDK's contract.

**Closed by:** asserting the **wire payload** instead — a probe runs the real attachment
through the real installed SDK with `fetch` stubbed and checks the captured body carries
`inline_content_id`. That test would have failed on the original code.

**Generalises:** any future Resend field (tags, headers, replyTo) is worth checking against
`node_modules/resend/dist/index.js` rather than the docs site.

### I14 — Stage 2 is inert by construction; do not read "deployed" as "working"  ✖ SUPERSEDED (2026-09-08)
<!-- ✖ No longer applies. Stage 3 landed the writer, so the type is no longer inert — a
     settled kiosk payment now produces the notification. The deploy-order concern this item
     raised is now carried by I18, which states the required order and names the dangerous
     permutation. Kept for the record rather than deleted. -->
**Files:** the migration, `types.ts`, the new template

Recorded so the state is not misread at a later session. After the migration is applied and
the function redeployed, **the kiosk email still cannot send**: no code writes
`kiosk_booking_confirmed`. That is deliberate sequencing (B4's header says so), not an
incomplete deploy.

**The first observable behaviour arrives in Stage 3**, when the webhook writes the row.
Until then the only way to exercise the template is to insert a notification of that type by
hand — which is a reasonable smoke test and is written up under Verification.

### I15 — Staging's `RESEND_API_KEY` is invalid; staging cannot deliver notification email  ✅ DONE (2026-09-08)
<!-- 🔄 A NEW staging-scoped key was created and set (2026-09-08), following the guide's
     "separate Resend keys per environment" rule (email-notifications-guide.md:174) rather
     than copying production's — so revoking one can never take the other down.
     Validated BEFORE being set, via a read-only GET https://api.resend.com/domains: HTTP 200
     and `ezzy.ph | verified`. That check covers BOTH failure modes in the guide's
     troubleshooting table (:157) — an invalid key, and a valid key belonging to a different
     Resend account than the one where the sending domain is verified. No email sent.
     Set + redeployed on fbxbwnfeimzhgxpshdpa; all 12 staging secrets confirmed intact
     afterwards (`secrets set` merges, it does not replace).
     ✅ CLOSED: staging delivery confirmed twice — first a test notification showing
     notification_emails.status = 'sent', then a real kiosk payment whose customer receipt
     arrived correctly branded. A valid key was never the bar; delivery was. -->
**Environment:** staging `fbxbwnfeimzhgxpshdpa` — **out of scope for this plan, blocks its verification**

Found 2026-09-08 while verifying the secret rotation. A staging notification reached the
function (pg_net 200, recipient resolved, claim written) and then failed at the provider:
`notification_emails.status = 'failed'`, `error = 'API key is invalid'`.

**Not caused by the rotation** — `supabase secrets set` merges rather than replaces
(verified: all 12 staging secrets intact afterwards, `RESEND_API_KEY` among them). The key
itself is bad.

⚠️ **Precedent, so treat this as drift rather than a surprise:**
`.plans/2026-08-12-notification-email-rate-limit.md` F7 records ten `failed` rows from an
invalid API key sitting unnoticed for three days, and `architecture/overview.md:165` records
staging being found without Auth SMTP on 2026-08-18. Staging's email config has drifted
twice before, and nothing watches it — which is that plan's I1.

**Consequence for this plan:** Stage 3's kiosk email **cannot be verified on staging** until
this is fixed. A paid kiosk booking there would write the notification, return 200, and still
lose the mail. Local is unaffected (valid key). **Fix:** `supabase secrets set RESEND_API_KEY=…
--project-ref fbxbwnfeimzhgxpshdpa` then redeploy.

### I16 — Push dispatch: config.toml never declared the function  ✅ DONE (2026-09-09, partial by decision)
**File:** `backbone/supabase/config.toml` (fixed) · `send-push-notification` (not enabled — see below)

⚠️ **THIS ITEM WAS MIS-DIAGNOSED WHEN FIRST WRITTEN.** It said "push is 401ing on staging
(`notification_push_secret` mismatch)", which implied a regression in a working feature.
Investigation on 2026-09-09 showed otherwise, and the correction matters more than the fix.

**What is actually true.** `architecture/overview.md:289` already records it: mobile push is
*"infrastructure-complete but unproven — no FCM/APNs credentials are configured and no push
has been delivered end to end."* `supabase-production-setup.md:439` lists deploying this
function as pending *"when push is ready"*. **The 401s are an unfinished feature emitting
noise, not something that broke.**

**Three independent gaps, not one:**

| | staging | production |
|---|---|---|
| `verify_jwt` | `false` (set by hand in the dashboard) | **`true`** — rejects every dispatch before the function runs |
| `NOTIFICATION_PUSH_SECRET` | set, mismatched against Vault | **absent** |
| `EXPO_ACCESS_TOKEN` | set | **absent** |

Production push has never worked and could not have.

**The root cause, and the only part fixed:** `config.toml` declared **only**
`[functions.send-notification-email]`. `send-push-notification` was declared nowhere, so
every `functions deploy` applied Supabase's default `verify_jwt = true`. That is precisely
how production acquired it. Staging escaped only because someone toggled it by hand — and
**a dashboard toggle does not survive the next deploy.**

⚠️ **The landmine this disarms:** before this change, deploying the push function to staging
would have silently broken staging exactly as production is broken, with no error and no
signal. That is why the fix was worth doing even though push is not in use.

**Fixed:** `[functions.send-push-notification]` added with `verify_jwt = false`, mirroring
the email function, with a comment recording why it must not be removed as redundant.

**Deliberately NOT done** (user decision, 2026-09-09): aligning staging's push secret, and
configuring production's push secret / Expo token. Aligning the secret would only move the
silent failure one step later (to Expo delivery), and enabling push properly needs FCM/APNs
credentials — that is turning a feature on, and deserves its own plan rather than being
bolted onto this one.

**⚠️ Takes effect only on the next deploy of that function.** Nothing changes until then, and
no deploy is proposed here: on staging it would be behaviourally a no-op (it already has
verify_jwt=false), and on production it would swap a JWT 401 for a missing-secret 401 — no
gain either way. The value is that the next deploy, whenever it comes, will be correct.

### I17 — Auth SMTP mail is NOT evidence of notification-email health  ✅ DONE (2026-09-08) — recorded, no action
<!-- ✅ The deliverable for this item IS the record: there is nothing to fix, only something
     to know. It cost a real misread during testing (a vendor signup's password email was
     taken as proof the notification path worked, while notification email was fully broken
     by I15). Kept so the same inference is not made again. -->
Recorded because it caused a misread during testing. A vendor signup produces BOTH a
password-set email (Supabase Auth → SMTP) and notification rows (trigger → pg_net → Edge
Function → Resend). **They are entirely separate paths with separate configuration.**
Receiving the password email while notification email is fully broken is the expected
appearance of I15, not a contradiction. When verifying this feature, only
`notification_emails` and `net._http_response` count as evidence.

### I18 — Deploy order for Stage 3 is now load-bearing  ✅ DONE (2026-09-08, staging)
<!-- ✅ Followed on staging in the stated order — migration, Edge Function, then booker — and
     the race was avoided by applying the migration EXPLICITLY via `db push` before pushing
     code, rather than letting one merge trigger Supabase and Vercel concurrently.
     Confirmed by a real kiosk payment on staging producing a correctly branded receipt.
     ⚠️ The same order still applies to production, and to any future environment. -->
**Environments:** staging, production

Through Stage 2 the ordering did not matter, because nothing wrote the type. **That is no
longer true.** `booker` now inserts `kiosk_booking_confirmed` on every settled kiosk payment,
and `notifications.type` is FK-constrained to `notification_type_settings`.

**Required order per environment, without exception:**
1. Apply `20260908000001_kiosk_booking_notification_type.sql`
2. Deploy the Edge Function (so the bespoke template exists — already deployed, but re-check)
3. Deploy `booker` (the writer)

⚠️ **Deploying booker first is the dangerous permutation.** The insert raises an FK violation,
the route's `try/catch` swallows it, the webhook still answers 200, and the customer silently
receives nothing — while the vendor-admin notification beside it succeeds, so the failure
looks like "only kiosk emails are broken" rather than "a migration is missing".

Note `maybeSingle()` softens but does not remove this: with the settings row absent,
`kioskType` is null and the branch is skipped, so no FK violation occurs and nothing is
written. The customer still gets nothing — it just fails quietly rather than loudly.

### I19 — Local `functions serve` is single-worker and falls over on a fan-out  ✅ DONE (2026-09-08) — recorded, no fix warranted
<!-- ✅ Local-only, and a code fix would be wrong: hosted runs many workers and handled the
     identical 4-way fan-out on staging the same day. The deliverable is the recovery
     procedure — restart `functions serve`, then re-invoke the function directly with the
     notification id rather than re-firing the webhook (a replay cannot re-create the
     notifications, because is_paid is already true by then). -->
**Environment:** local only — not a defect in this feature

Found 2026-09-08 during the first end-to-end local webhook test. One settled kiosk payment
writes **4** notifications at once (3 vendor-admins + 1 customer), so the dispatch trigger
fires 4 concurrent `net.http_post` calls. The local Edge runtime returned **503** and pg_net
recorded `Timeout of 5000 ms reached` on three of the four. `functions serve` then stayed
503 until restarted.

**Nothing was wrong with the code.** The notifications were written correctly; only local
delivery failed. Hosted runs many workers and is unaffected — staging handled the same shape
earlier in the day.

⚠️ **Why this matters beyond the annoyance:** it looks exactly like a broken template or a
broken trigger, and it will recur every time someone tests a kiosk payment locally. Restart
`functions serve` and re-invoke the function directly with the notification id, rather than
re-firing the webhook — a replay cannot re-create the notifications, because `is_paid` is
already true by then.

**Related, not the same:** `.plans/2026-08-12-notification-email-rate-limit.md` concerns
Resend's 10/sec cap in production. This is a local-runtime concurrency limit hit at 4. Same
family — a fan-out meeting a limit nobody declared — different limit.

---

## DECISIONS

<!-- HARD GATE: no item may execute while an OPEN: line remains. All resolved 2026-09-08. -->

- **D1 — how does the logo reach the email?** → ✖ **Hosted URL REVERSED 2026-09-08.**
  → **CID inline attachment** (resolved 2026-09-08, superseding the same-day hosted-URL
  decision). The logo's bytes ship inside the message; there is no URL, no
  `NOTIFICATION_EMAIL_LOGO_URL`, and nothing to configure per environment.
  - **Why it was reversed.** The hosted decision was sound on its own terms but was made
    before one fact surfaced: **local notification emails go through real Resend to a real
    inbox** (`NOTIFICATION_EMAIL_OVERRIDE_TO`), not Mailpit — Mailpit only receives auth
    mail. A remote image is fetched by the recipient's client (Gmail via Google's proxy),
    which cannot reach a developer's machine, so `http://localhost:3000/...` can never work.
    Testing locally would therefore have required deploying to staging **first**, inverting
    the intended order. Verified against `architecture/email-notifications-guide.md` §1/§5.
  - **What it also removed:** the two-place secret, the ⚠️ set-but-404 window that would
    have put a broken image in every email, a permanent dependency on `vendor.ezzy.ph`, and
    the deploy-order note this plan previously had to carry.
  - **Bonus:** an inline attachment is part of the message, so the logo renders even where
    a client blocks EXTERNAL images — strictly better than the hosted version.
  - **Costs, stated plainly:** ~10KB base64 per email (7,890-byte PNG; Resend's cap is
    40MB); `EmailContent` gains an optional `attachments`; `emailSender.ts` forwards it.
  - ⚠️ **CORRECTED 2026-09-08 after a failed live send — the field is `inlineContentId`.**
    This is worth reading before touching any Resend attachment again. THREE spellings
    are plausible and two fail **silently**:
      - `content_id` — Resend's REST reference;
      - `contentId` — Resend's own Node example on the attachments docs page. **This is
        what I originally shipped, on the strength of that page. It is wrong for v4.**
      - `inlineContentId` — what `resend@4.8.0`'s `Attachment` interface actually
        declares, and the only spelling its `parseAttachments()` maps to the wire field
        `inline_content_id`.
    An unknown property is dropped before the request is built, so the send returns
    success, `notification_emails` records `sent`, and the mail arrives with a broken
    image. **Nothing anywhere reports it** — the first live send was the only thing that
    could have caught this, and it did.
    **Root cause of the miss:** the documentation was trusted over the package. The fix
    was found by reading `node_modules/resend/dist/index.js` directly.
    **Now regression-tested at the wire:** a probe feeds the real attachment through the
    real installed SDK with `fetch` stubbed and asserts the captured body carries
    `inline_content_id`. Asserting our own object's shape would NOT have caught the
    original bug; asserting the wire does.
    `contentType` stays omitted — Resend derives it from the `.png` filename.
  - ⚠️ **Open, low risk:** whether `resend.batch.send` (floated as a future direction in
    the rate-limit plan) supports attachments is unverified. Not a blocker today.

- **D2 — what is the "Order ID"?** → **`bookings.id`, labelled "Booking reference"**
  (resolved 2026-09-08) — the email and `StepConfirmation.tsx:51-52` then show the same
  value under the same label, which is what staff look up at the desk. The requirement's
  "Order ID" field is satisfied by this value under the matching label. **I2 therefore needs
  no copy change** — the screen is already correct.

- **D3 — header treatment?** → **Keep the dark `#111827` bar, white knockout lockup**
  (resolved 2026-09-08) — smallest change, one asset, strong contrast, and the bar exists
  at `base.ts:28` already. Confirms B2's white-knockout target.

- **D4 — new type or reuse `payment_confirmed`?** → **New type `kiosk_booking_confirmed`**
  (resolved 2026-09-08) — keeps the two audiences on independent Command toggles, so
  silencing vendor payment noise cannot silently stop customer receipts. **B4's approval
  gate is now the only thing standing between this plan and execution.**

## Execution order

Ordered by dependency and risk. **Stage 1 is safe to start now** — D1–D4 are
resolved and it hits no approval gate; nothing in it can send a wrong email, because the
new type does not exist yet.

1. **Branding, self-contained** — B2 (extend `generate-brand-assets.mjs`, output to
   `vendor/public/`) → set `NOTIFICATION_EMAIL_LOGO_URL` in both places → B1 (`layout()`,
   with the unset-variable fallback) → **I7** (`<head>` + charset — same file, same edit
   session, and it must land before any `₱` ships) → I3 (doc). Verifiable on its own against
   the existing 14 types, with no new email in play. If this is all you want for now, it
   stops cleanly here.

   ⚠️ The deploy-order warning this step used to carry is **gone with the D1 reversal** —
   there is no asset to deploy and no secret to set, so the ordering hazard it described
   cannot occur. Stage 1 now needs only a function redeploy.

2. **Type + template, no sender yet** — B4 (migration, after approval) → I4 (union) → B3
   (template + registry), observing **I9**'s three formatting rules → redeploy. Still sends
   nothing: no code inserts the type.
3. **Wire the trigger point** — **I11** (widen the two selects) → B5 (the pure builder, its
   tests, then the webhook edit) → **B7** (sibling `if`s, not nested) → **I10** (self-
   sufficient `title`/`body`). This is the step that first sends real mail; it goes last on
   purpose. **B7 is part of this step, not a follow-up** — retrofitting the un-nesting later
   means shipping the coupling D4 exists to prevent.
4. **Confirm, do not assume** — B6's replay test, B7's two-direction toggle test, then I2's
   copy read and **I8**'s switch-description edit.

**Coupled, must ship together:** stages 2 and 3. A deployed migration with no writer is
inert and harmless; a writer with no migration raises an FK violation inside the webhook's
`try` and the customer silently gets nothing (B4). If they must split, **the migration ships
first**, never second.

---

## Verification

Marked by kind, per §11 — what a machine can prove versus what needs a live environment.

**Stage 1 — what was actually run (2026-09-08)**
- ✅ 6 assertion groups against the real template modules under Node — logo branch, fallback
  branch, attribute-injection, charset presence and position, pre-existing body escaping, and
  a `₱` round trip.
- ✅ Asset measured: 320×130, RGBA, 17,329/17,329 opaque pixels white.
- ✅ Pre-existing icon outputs byte-unchanged (`git status`).
- ✅ Both header states rendered and visually confirmed.
- ⚠️ **NOT run: `deno test` and `deno check`.** Deno is not installed in this environment.
  The Deno suite was updated in the same shape as the Node checks and the modules it imports
  were executed directly, so the logic is verified — but **the Deno type-check and the
  handler/index wiring are unverified** and must be run before deploy. This is the one
  outstanding gap in stage 1.
- ⚠️ Not run: real-client rendering (Gmail/Outlook/Apple Mail). Needs a live send — see below.

**Stage 3 — what was actually run (2026-09-08)**
- ✅ 16 new `node:test` cases for the builder; full booker suite 36 pass / 0 fail.
- ✅ `npx tsc --noEmit` clean. Lint clean for both touched files — the repo's 23 pre-existing
  problems were confirmed byte-identical at HEAD via a stash, so none are attributable here.
- ✅ **B7 verified structurally**: both `is_enabled` gates measured at indentation depth 9,
  siblings inside `if (booking)` at depth 7. A nested kiosk branch would sit deeper.
- ✅ **END-TO-END through the REAL route**, via a signed PayMongo `checkout_session.payment.paid`
  event fired at a local booker dev server (PayMongo cannot reach localhost, so the harness
  HMAC-signs a genuine-shaped envelope — this exercises signature verification, the is_paid
  transition and both inserts, not a mock):
    - `is_paid` false → true;
    - exactly **1** `kiosk_booking_confirmed` on the **booker** portal addressed to the
      customer, and **3** unchanged `payment_confirmed` on the **vendor** portal — i.e. both
      audiences fired independently, B7 working in practice rather than only in shape;
    - the real body read: *"Your Court Rental on 7 September 2026 at 09:00 is confirmed.
      Paid ₱850.00. Booking reference: 6418731f-…"* — correct date with NO timezone drift
      (I9.1), price formatted from a `numeric` (I9.3), self-sufficient (I10);
    - `data` carried all five keys for the template.
- ⚠️ **Email delivery for that run did NOT complete locally** — see I19 (local single-worker
  Edge runtime returned 503 under the 4-way fan-out). The notification rows are correct;
  only local dispatch failed. Rendering the real receipt is pending a `functions serve`
  restart + a direct re-invocation.
- ⚠️ NOT done: B6's replay proof and B7's toggle proof — both Stage 4.

**Stage 2 — what was actually run (2026-09-08)**
- ✅ 10 assertion groups against the real template + registry modules (see B3).
- ✅ Stage 1 re-verified for regression after the registry gained an entry: template, handler
  and wire-payload probes all still pass.
- ⚠️ NOT run: `deno test` / `deno check` — Deno unavailable in this environment.
- ✅ **LIVE LOCAL SEND CONFIRMED (2026-09-08)** via a hand-inserted notification:
  `net._http_response` 200, `notification_emails` = `liza@bookdeck.com` / `sent`, receipt
  delivered. This exercised the FULL chain — trigger → pg_net → function → Resend — which
  no earlier test in this plan had done: every prior local check used `curl` straight at the
  function, bypassing the trigger entirely.
  ⚠️ Two prerequisites were missing and cost a debugging cycle, both worth knowing:
    1. **Local Vault was empty.** The dispatch trigger reads NULL and returns early —
       SILENTLY. No error, no `net._http_response` row, no email; indistinguishable from a
       broken template. `supabase/_local-vault.sql` now exists (gitignored, entry added to
       `.gitignore`) to re-seed after every `db reset`.
    2. ⚠️ **A self-inflicted trap in that file, worth not repeating:** the placeholder token
       appeared TWICE — as the value and inside the guard's comparison — so the documented
       find-and-replace rewrote both, making the guard `if v_secret = '<the real secret>'`,
       i.e. always true. The file was unrunnable no matter what was pasted. The sentinel is
       now written as a CONCATENATION so a substitution over the value cannot touch the
       comparison. **General lesson: a placeholder that also appears in its own validation
       is self-defeating.**
- ⚠️ Still NOT possible: an END-TO-END kiosk send (pay at the kiosk → email). Nothing writes
  the type from application code until Stage 3; the above proves the template and chain, not
  the trigger point. To smoke-test the
  template before then, insert a row by hand on a non-production DB:
  ```sql
  insert into public.notifications (user_id, portal, type, title, body, data)
  values ('<a real profile id>', 'booker', 'kiosk_booking_confirmed', 'Booking Confirmed',
          'Thanks — your payment went through. Here are your booking details.',
          '{"booking_id":"<uuid>","offering_name":"Court Rental",
            "booked_date":"2026-09-10","start_time":"14:00:00","price_paid":2500}'::jsonb);
  ```
  ⚠️ Requires the migration applied first, or the FK on `notifications.type` rejects it.

**Machine-verifiable**
- `cd booker && npm test` — new `lib/kioskBookingNotification.test.ts`: returns `null` for
  `booked_via: 'booker'`; builds the row for `'kiosk'`; carries all four values into `data`;
  targets `booker_id` and portal `booker`.
- `cd backbone/supabase/functions/send-notification-email && deno test` — new cases:
  the kiosk template renders all four fields; `escapeHtml` neutralises a `<script>` in
  `offering_name` (mirroring `handler.test.ts:100-108`); a missing `data` field degrades to
  an em dash rather than `undefined` or `0` — the no-fabricated-data rule
  `StepConfirmation.tsx:14-28` already sets for this same receipt, applied to the email.
- `npx tsc --noEmit` in `booker`; `deno check` on the function.
- **Grep gate:** no `resend` import anywhere under `booker/` (F15).

**Needs a live environment**
- **Branding across clients.** Send one of each existing type to a real inbox and confirm the
  logo renders in **Gmail web, Gmail iOS/Android, Outlook desktop and Apple Mail**, and that
  **images-off** falls back to legible white alt text. Outlook desktop is the one that
  actually breaks; the others rarely disagree. A screenshot in Gmail alone is not evidence.
- **End-to-end kiosk run** on local with the function served and Vault secrets present (I5):
  book through the kiosk → pay in PayMongo test mode → confirm **one** email arrives with
  correct reference, service, date and price, and that `price_paid` matches the row rather
  than anything the client sent.
- **Duplicate proof (B6).** Re-POST the identical signed webhook payload and assert
  `select count(*) from notifications where data->>'booking_id' = '<id>' and type = 'kiosk_booking_confirmed'`
  is exactly 1, and the matching `notification_emails` row count is 1 with status `sent`.
  Then re-invoke the Edge Function directly with the same `notification_id` and assert
  outcome `"idempotent"` and no second delivery.
- **Vendor mail is unchanged** — the existing `payment_confirmed` email to vendor-admins must
  still arrive, and must now be branded. A regression here would be invisible from the
  customer side.

**Added by the review pass**
- **B7, both directions.** Toggle `kiosk_booking_confirmed` off → vendor mail still lands.
  Toggle `payment_confirmed` off → customer receipt still lands. One direction proves nothing.
- **I7:** send the kiosk email to Outlook desktop and confirm `₱` renders as a peso sign.
- **I9:** a booking with `price_paid = 0` must print `₱0`, and a `data` payload with the key
  removed must print an em dash. Both are `deno test` cases, not live checks.
- **I10:** render the kiosk notification through `renderGeneric` in a test and assert the
  reference, service, date and amount all still appear. That is the missed-redeploy state,
  and it should be asserted rather than hoped for.

**One more check D1 introduced:** unset `NOTIFICATION_EMAIL_LOGO_URL` and confirm the email
still renders with the text wordmark — the fallback path must be exercised, not assumed. It
is the state every environment is in until the secret is set in both places.
