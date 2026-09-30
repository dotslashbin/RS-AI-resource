# Vendor kiosk — recoverable PayMongo checkout with QR Ph and GCash

**Date:** 2026-09-29
**App / scope:** Vendor web kiosk first; proposed implementation also touches booker's shared payment webhook and backbone's booking/payment lifecycle. Native mobile later.
**Status:** DRAFT

> Research and design for review only. No application code, migrations, configuration, credentials, provider resources, or deployed systems changed. This is not an execution approval request: the OPEN decisions and provider contract checks below must be resolved first.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision, R# = Research, S# = Stage; numbers are plan-local. Every implementation item below was identified 2026-09-29 and remains TODO.

**Related plans:** `.plans/2026-09-07-paymongo-to-maya-migration-research.md` (especially I10); `.plans/2026-09-14-vendor-kiosk-next-customer-reset.md`; `.plans/2026-09-12-vendor-kiosk-hardening.md`; `.plans/2026-09-15-vendor-delete-error-placement-and-kiosk-payment-methods.md`; `.plans/2026-09-03-vendor-mobile-kiosk-mode.md`. Their statuses are unchanged. This proposal retains PayMongo; it does not approve or close the Maya migration research.

## Recommendation

Build an Ezzy checkout inside `/kiosk` using PayMongo Payment Intents, with **dynamic QR Ph as the first choice** and a **separate GCash redirect option**. Establish a durable, recoverable booking/payment lifecycle before introducing the custom screen. QR Ph keeps the kiosk on Ezzy while the customer pays on their own phone. GCash leaves the page, so returning must restore the same checkout and verify its state.

The reported symptom has a concrete code-supported explanation: creating a booking reserves capacity; leaving hosted checkout does not undo that reservation; the cancel return does not restore payment. This is not yet a browser reproduction of the user's exact Back action. The provider's Back button, browser history Back, and a browser's back/forward cache must be tested separately.

**Success means:** Back/refresh resumes the original booking without another booking or charge; only verified settlement shows payment success; an abandoned checkout has a bounded, explicitly defined resolution; next customer cannot see or revive the preceding customer's session; capacity is never silently sold twice.

| Approach | Assessment |
|---|---|
| Repair lifecycle, retain hosted checkout | Lowest UI scope; can fix recovery, but retains provider navigation and limited presentation. Valid interim/fallback choice. |
| Repair lifecycle + custom QR Ph + GCash | **Recommended.** Meets requested control and methods; requires provider API, settlement and reservation work, not just new pages. |
| Replace hosted page without lifecycle work | Leaves orphan reservations, unsafe retries and incorrect success claims intact. |
| Put hosted checkout in an iframe or suppress browser Back | Does not establish payment truth or release capacity; external navigation cannot reliably be controlled by the app. Not recommended. |

The customer-facing feature is vendor-only, but a correct payment implementation is **not vendor-code-only**: `architecture/booking-flow.md:561` and `:643` place the sole PayMongo webhook in booker. Preserve that ownership. Existing hosted booker/mobile traffic must keep working throughout deployment.

## Research and evidence

### R1 — Local flow and predecessors reviewed · ✅ DONE

2026-09-29 — read current vendor checkout, receipt, shell, booking/payment routes, shared webhook, current placement/transition/ledger migrations and relevant architecture. Re-opened the cited backend findings from a read-only research agent before recording them. No runtime/provider account claims are implied.

Current path:

1. `vendor/components/kiosk/KioskBooking/useKioskCheckout.ts:42` creates the booking, then `:86` creates a hosted Checkout Session and `:120` navigates away.
2. `vendor/app/api/kiosk/payment/create-session/route.ts:130` sets success and cancel URLs with `booking_id`.
3. `vendor/components/kiosk/KioskShell/useKioskShell.ts:77` restores booking view **only** for success; cancel defaults to home.
4. `vendor/components/kiosk/KioskBooking/KioskBooking.tsx:48` also only interprets success. The ordinary booking state initializes empty at `useKioskBooking.ts:160`–169.
5. `backbone/supabase/migrations/20260828000001_schedule_window_minutes_expand.sql:362` and `:407` count pending bookings toward capacity, whether paid or unpaid.

**Corrections to avoid repeating earlier assumptions:**

- The previous next-customer fix is present: `useKioskShell.ts:195` synchronously strips the query with `history.replaceState`, and `:199` remounts customer state. Do not replace it with the earlier production-broken router-only reset or claim that old fix is missing.
- The Maya research I10 correctly identified missing cancel UI, but its proposed “no charge was made” wording is not safe merely because a customer returned/cancelled. Use “Checking payment” until the server knows.
- The webhook already recognises `payment.paid` at `booker/app/api/payment/webhook/route.ts:76`. Adding the event name alone is not sufficient: resource correlation, subscription, failure/expiry handling and settlement validation need work.
- Existing HMAC verification (`webhook/route.ts:6`), false→true settlement guard (`:104`), ledger uniqueness and schedule locking (`20260828000001...sql:276`) are useful protections. Preserve them. They prevent duplicate local writes/overbooking at insert, not multiple provider charges.
- `architecture/booking-flow.md:660` intentionally puts method selection on hosted checkout. Custom checkout changes that documented decision and needs an explicit decision plus a documentation update.

### R2 — PayMongo feasibility established from public documentation · ✅ DONE

2026-09-29 — opened official PayMongo sources below. No API calls using account credentials were made. API capability is established; this merchant account's enablement and actual device behaviour remain unverified.

| Capability | Evidence and implication |
|---|---|
| Custom checkout | [Payment Acceptance introduction](https://docs.paymongo.com/docs/payment-acceptance-introduction) explicitly supports a merchant-built UI through Payment Intents. |
| Dynamic QR Ph | [QR Ph API](https://docs.paymongo.com/docs/payment-acceptance-qr-ph-api): create intent, create `qrph` method, attach, render `next_action.code.image_url`. Exact amount, single-use QR; default 30 minutes; `expiry_seconds` accepts 60–9000 seconds. Proposed five-minute QR is within that range. |
| GCash through QR Ph | [QR Ph overview](https://docs.paymongo.com/docs/payment-acceptance-qr-ph) lists GCash among supported issuers. This is useful kiosk UX, but the user also explicitly wants a separate GCash choice. |
| Separate GCash | [E-wallets](https://docs.paymongo.com/docs/payment-acceptance-e-wallets): attach `gcash`, follow `next_action.redirect.url`, return to the supplied `return_url`, confirm by webhook. GCash's documented authorization window is four hours and not configurable. |
| Status | [Key concepts](https://docs.paymongo.com/docs/payment-acceptance-key-concepts): distinguish awaiting method/action, processing and succeeded. Failed attempts can return the intent to awaiting method; a redirect or navigation event is not settlement. |
| Retry protection | [Idempotent requests](https://docs.paymongo.com/reference/idempotent-requests) documents `Idempotency-Key`, matching payloads, and a 24-hour retention period. Its opening mentions updates, but its notes limit support to creation: prove support separately for creation, attach and cancellation; do not infer universal coverage. |
| Cancellation | [Cancel a Payment](https://docs.paymongo.com/reference/cancel-a-payment) exposes `POST /v1/payment_intents/{id}/cancel`, but does not establish valid states or guarantees for active QR Ph/GCash. **Endpoint existence is not proof of safe immediate slot release.** |
| Financial identity | [Payment Intent resource](https://docs.paymongo.com/reference/the-payment-intent-object) exposes amount, currency, mode and server-readable payments. [Webhook events](https://docs.paymongo.com/docs/developer-tools-webhooks-events) supplies payment IDs and `payment_intent_id`; match stored IDs, not assumed propagation of booking metadata alone. |
| Testing | [Testing](https://docs.paymongo.com/docs/payment-acceptance-testing) provides e-wallet simulation and QR `test_url`. Its QR-specific warning says scanning/paying a test QR can move real money, despite its general test-mode introduction. Use simulation, not real wallet scans, during sandbox tests. |

### R3 — Provider contract checks still required · ⬜ TODO

**Anchors:** `vendor/app/api/kiosk/payment/create-session/route.ts:120`; `booker/app/api/payment/webhook/route.ts:63`; the official references above.

Before executable design approval, document or obtain controlled sandbox evidence for:

- Account access to direct QR Ph and GCash; required billing fields and server-side method/attach permissions. Prefer existing server-only PayMongo credentials and same-origin vendor routes; do not add a browser key/CSP exception by assumption.
- Actual QR expiry and GCash Back/abort/cancel behaviour, including whether an existing authorization remains payable after returning.
- Cancellation allowed states and race results for both methods. If unresolved in public docs, user-authorised sandbox testing or a user-supplied PayMongo answer is needed; do not contact PayMongo on the user's behalf without permission.
- Idempotency of intent creation and attach; a timeout after provider acceptance; retrieval after failed DB persistence. Never create another intent just because the prior HTTP request timed out.
- Actual event payloads and metadata propagation for each method. QR guide names `qrph.expired`, but the inspected consolidated events page did not list that exact string; confirm subscription/payload, not the unrelated Wallet QR `qr.expired` product.
- GCash desktop/tablet browser experience and authentication on the customer's device. No customer wallet credentials should be entered into an Ezzy form. A kiosk page cannot clear a third-party origin's cookies.

**Verification:** sanitised fixtures plus recorded sandbox outcomes, with no customer data, keys, client keys or payment URLs committed. These checks were not run in this research turn.

## BLOCKERS

### B1 — Returning from checkout loses the active booking · ⬜ TODO

**Files:** `vendor/components/kiosk/KioskShell/useKioskShell.ts:77`; `vendor/components/kiosk/KioskBooking/useKioskCheckout.ts:42`; `vendor/components/kiosk/KioskBooking/KioskBooking.tsx:48`.

**Risk:** provider cancel returns to home; browser Back may restore stale React state from cache; retry submits a new booking. This matches the reported reservation becoming an obstacle rather than a resumable purchase.

**Fix:** establish one server-tracked checkout per customer interaction before the booking write. Repeated requests carry its stable request ID. Keep the active locator across same-customer redirects/reloads; resume by an authenticated vendor-scoped read. Resume an existing booking and amount, never repeat customer/signature/booking creation on payment retry. A conflicting request using the same key must fail.

Use a non-PII interaction ID in tab-scoped storage/URL only if D4 is approved; it is a locator, **never authentication**. No customer identity, signature, provider URL or client key in browser storage. Authenticate every read/action using existing Supabase vendor-admin checks and bind vendor, checkout and booking. Server-side interaction validity prevents old history from restoring a completed/abandoned customer's receipt to the next user. Handle `pageshow`/back-forward cache and visibility return, not just initial mount.

**Verify:** provider Back, browser Back/Forward, refresh, hard reload and lost create response all find the same booking; two concurrent submissions yield one reservation. Foreign-vendor and invalid/stale interaction IDs reveal no customer details. Coupled to B3 and B4.

### B2 — Confirmation claims payment without verifying it · ⬜ TODO

**Files:** `vendor/components/kiosk/KioskBooking/KioskBooking.tsx:48`; `vendor/services/kiosk.service.ts:224`; `vendor/components/kiosk/KioskBooking/StepConfirmation.tsx:45`, `:66`, `:78`; `useKioskReceipt.ts:27`.

**Risk:** the URL alone selects confirmation. Receipt read omits `is_paid`; read failure still says payment went through. A delayed webhook or manually changed URL can therefore show a false success message. This does **not** set `is_paid` in the DB; it is a customer/staff trust problem.

**Fix:** all returns enter a checking state. An authenticated, vendor/interaction-scoped status read supplies persisted settlement, booking status and a minimal receipt. Bounded polling with backoff and a manual recheck handles delayed webhooks; unknown/offline is not failed and must not invite another charge. Use the same verified settlement service for any server-side reconciliation. Distinguish paid/pending vendor approval from confirmed booking. Preserve zero-price handling: “No payment needed”, with no provider call or zero-value ledger row.

**Verify:** forged success URL, unpaid booking, paid event before/after return, network failure and cancelled-but-paid exception; success appears only after persisted evidence. Hook cleanup must discard stale results when checkout ID or customer generation changes. Can be an independent early code patch after decisions/approval, before custom payment UI.

### B3 — Payment attempts can multiply or become untraceable · ⬜ TODO

**Files:** `vendor/app/api/kiosk/payment/create-session/route.ts:57`, `:120`, `:150`; `vendor/components/kiosk/KioskBooking/useKioskCheckout.ts:86`.

**Risk:** route does not select/check `is_paid`, booking status or existing payment reference; every request can create another session. Persistence errors are ignored. The hook loses the created booking ID on error/reload, and thrown fetch errors bypass its normal state reset. Ledger deduplication cannot undo a second real charge.

**Fix:** durable checkout and attempts, atomically claimed before provider work; reject paid/terminal/ineligible bookings, derive amount from stored booking, record IDs before exposing a payable action. Only one live attempt per checkout; retries reuse it. Method switching waits for verified closure of the previous method; it cannot create two payable options. Store distinct received payment IDs, including unexpected second/late payments, for reconciliation. Unknown provider result stays recoverable rather than becoming a fresh attempt. Catch transport/parse errors, release UI submitting state, and preserve the interaction ID.

Preserve legacy `create-session` response shape for native mobile; new web endpoints must not silently replace it with QR/intent data. Guard the legacy route against creating a hosted session for a booking already owned by a new checkout. Keep booker's hosted traffic compatible with B5.

**Verify:** double click, concurrent HTTP requests, dropped responses, timeout after provider accepts, DB write failure, repeated method switch, already-paid/cancelled booking. Assert provider resources **and** database rows, not just UI button state. Coupled to B1/B4/B5.

### B4 — Abandoned reservations never expire; cancellation/rebooking needs design · ⬜ TODO

**Files:** `backbone/supabase/migrations/20260828000001_schedule_window_minutes_expand.sql:369`, `:415`; `20260829000004_kiosk_customer_close_out.sql:98`; `20260803000003_booking_units.sql:80`; `vendor/components/kiosk/KioskShell/useKioskShell.ts:199`.

**Risk:** no payment hold expiry lifecycle was found in the migration/route search. Local reset only erases the screen. A service-role expiry worker cannot simply set `status='cancelled'`: current transition rules exclude the system actor from pending→cancelled. Even after cancellation, the unconditional duplicate index blocks the same customer recreating the same slot.

**Fix:** distinguish (1) leaving a UI, (2) provider payment closure, and (3) releasing inventory. Back resumes payment. Explicit “Cancel booking and start over” initiates server-side closure. A server-run expiry/reconciliation process also handles closed tabs and lost devices; do not rely on a browser timer, unload request or `sendBeacon` for correctness. QR's displayed expiry and reservation policy must agree. Proposed QR target: five minutes, capped by the booked service start; do not offer a new payment method if too little valid time remains.

Release only after verified non-payability under the selected D3 policy. Unknown/processing outcomes stay pending reconciliation. Settlement and expiry lock the same checkout/booking records in a consistent order; a valid paid outcome wins over an unpaid release. Never hold a database transaction open during a provider HTTP call. Use a claim/call/finalize protocol and verify the claim/version again after the call. New bookings still pass existing schedule-row locking and placement checks.

Constrain automated cancellation to unpaid pending kiosk bookings explicitly managed by this new checkout lifecycle; never blanket-cancel old pending rows, paid/free bookings, confirmed bookings or booker/mobile reservations. Keep audit history and original provider references. Decide same-customer rebooking semantics with D5. Existing stale production bookings require separate read-only inventory and individual reconciliation before any cleanup is proposed.

**Verify:** last-slot concurrency; payment concurrent with expiry; provider timeout; lost webhook; server worker retry; abandoned browser; same-email same-slot after true cancellation; service-start boundary. Coupled to B3/B5 and the approval-gated schema draft.

### B5 — Settlement can lose payments and mishandle late money · ⬜ TODO

**Files:** `booker/app/api/payment/webhook/route.ts:63`, `:100`, `:125`, `:132`; `backbone/supabase/migrations/20260911000001_withholding_tax.sql:164`; `20260801000003_booking_payout_status.sql:25`, `:101`.

**Risks:** signed metadata identifies the booking, but the handler does not compare provider resource ID, expected amount/currency/mode or lifecycle state. A DB error is acknowledged with 200, suppressing provider retry. A cancelled booking can later be marked paid; its newly inserted ledger defaults to held because the cancellation trigger already ran before the ledger existed. A distinct second payment is treated like a harmless replay.

**Fix:** keep one webhook in booker, normalize hosted-session and direct-payment payloads into a settlement service, and bind direct payments through stored intent/payment IDs. Validate amount, currency, mode and booking/attempt identity; signature verification remains mandatory. Metadata is a lookup aid, not the sole financial check. Persist a verified receipt and apply booking settlement atomically. Duplicate delivery of the same payment is a no-op; a different payment for an already settled checkout is an exception requiring reconciliation.

Transient settlement failure must return a retryable response unless already durably queued. Invalid/permanent anomalies require durable exception evidence and an operational alert, without logging whole payloads or credentials. Reconciliation must recover missed callbacks through authenticated provider reads and the same settlement path. Do not implement two different notions of success in webhook and status endpoint.

After capacity was released, record late money as an exception without resurrecting the booking or adding it to ordinary vendor payout. Define an accountable refund/reconciliation process (D3); a local `refunded` label does not move money. Preserve the established ledger/fee/tax trigger for valid settlements and free-booking behaviour. Keep hosted payload handling for existing booker/mobile sessions; prove that events from one flow cannot accidentally settle another.

**Verify:** HMAC failure; wrong mode/amount/currency/ID; direct QR/GCash and hosted fixtures; duplicate/out-of-order events; DB failure and redelivery; settlement after cancellation; two distinct payments; ledger rollback; no erroneous vendor payout. B3/B4/B5 must ship as a coupled backend batch before enabling custom checkout.

## IMPORTANT

### I1 — Custom checkout UX and component boundaries · ⬜ TODO

**Files:** `vendor/components/kiosk/KioskBooking/StepPayment.tsx:1`; `KioskBooking.tsx:42`; `StepConfirmation.tsx:39`; `vendor/components/kiosk/KioskShell/useKioskShell.ts:203`.

**Fix:** method selection, server-derived amount and reservation time; QR scan instructions; GCash redirect notice; checking, waiting, processing, paid, cancelled, expired, offline/unknown and staff-help states. One primary action per state. No paid claim from query params, screenshot or client countdown. Poll authenticated app status with bounded backoff; additional Realtime infrastructure is unnecessary.

**Component separation, explicitly:**

- `KioskBooking.tsx` becomes a render-only coordinator. Move its existing search-param/effect logic and derived payment state into a co-located `useKioskPayment.ts` (or the existing checkout hook where cohesive); move its static inline spacing into `KioskBooking.module.css` as part of touching this surface.
- `StepPayment.tsx` renders the review/method selector; handlers and method state come from `useKioskCheckout.ts`; styles remain in `KioskBooking.module.css`.
- Proposed `KioskPaymentStatus.tsx` and `KioskQrPayment.tsx` are display components receiving controller data/handlers. Any added component-local effects require matching co-located hooks. Use co-located CSS modules for non-trivial new styles; provider QR image is displayed directly, so no QR generation dependency is presumed.
- `StepConfirmation.tsx` renders only verified receipt/status props. Receipt fetching remains in the service/hook layer; date/amount presentation data can be prepared there.
- `KioskShell.tsx` keeps rendering only; idle/return/interaction invalidation stays in `useKioskShell.ts` with narrowly scoped service calls.

Use existing design tokens, both themes, keyboard/focus handling, 44px targets and non-colour status labels. QR contrast/size must survive both themes. Payment waiting gets its own bounded server deadline; blindly retaining the two-minute idle reset or indefinitely suspending it would both be wrong. Next-customer reset invalidates the interaction and cancels stale requests before removing screen data.

**Verify:** every state in UI fixtures, light/dark, keyboard, slow network, QR legibility on target tablets, production-build history navigation and two consecutive customers. Depends on B1–B5.

### I2 — Receipts can be lost after successful settlement · ⬜ TODO

**File:** `booker/app/api/payment/webhook/route.ts:132`, `:170`, `:206`, `:237`.

**Risk:** already-paid replay returns before notifications; some inserts ignore returned errors. “Confirmation is on its way” can overpromise.

**Fix direction:** inspect insert results and use truthful receipt copy; decide whether a narrowly scoped durable notification retry is necessary. Keep vendor and customer notification toggles independent. Do not add an ecosystem-wide notification rewrite to this task. Record this as an open payment-related follow-up even if its fuller retry implementation is deferred.

**Verify:** settlement succeeds despite notification failure; failure is visible to operators; retries do not duplicate receipts. No follow-up status is closed by this research.

### I3 — Rollout, compatibility and observability · ⬜ TODO

**Files:** `architecture/booking-flow.md:561`, `:580`, `:660`; `architecture/schema.md:749`; `vendor/app/api/kiosk/payment/create-session/route.ts:152`; `vendor/services/kiosk.service.ts:201`.

**Fix:** update architecture for new provider IDs, interaction persistence and state transitions after implementation. Subscribe the existing per-environment webhook to the direct events actually verified in R3, retaining hosted events. API support alone does not prove dashboard registration. Add bounded structured logs/metrics for unresolved attempts, late/duplicate funds and settlement retries using internal IDs only.

Enable custom web checkout through a reversible server-side rollout switch; old requests/sessions must remain recognizable. Rollback stops creation of new direct intents but continues status, settlement and reconciliation for existing ones. Do not redirect an in-flight direct checkout into a new hosted charge. Keep legacy tables/columns readable, maintain the native mobile API contract, and perform cross-app regression tests. No deployment, configuration or webhook subscription change is authorised by this document.

**Verify:** old hosted session after new deployment; mobile contract fixtures; disabled rollout with an in-flight direct payment; test/live separation; DB `is_paid` and correct ledger evidence, not just provider delivery HTTP 200.

## Data design and approval gates

This is a design draft, **not migration-ready SQL**. Exact migration/RPC bodies, grants and rollback scripts must be added here after D3–D5/R3 settle and before requesting implementation approval. Writing those files now would prematurely choose unsettled cancellation/security semantics.

Proposed minimum durable records (names are proposed, not existing schema):

| Record | Concrete draft fields and constraints | Purpose |
|---|---|---|
| `kiosk_checkouts` | `id uuid` PK/request ID; `vendor_id uuid` FK; `booking_id uuid` nullable unique FK; `created_at timestamptz`; `hold_expires_at timestamptz`; `interaction_ended_at timestamptz` nullable; `state text` constrained to preparing/open/closing/settled/released/needs_review; `version bigint` | Idempotent interaction before booking creation, binding, reservation deadline and invalidation. No customer PII duplicate. |
| `kiosk_payment_attempts` | `id uuid` PK; `checkout_id uuid` FK; `provider_intent_id text` nullable unique; `method text` qrph/gcash; `amount_centavos bigint` positive; `currency text` PHP; `livemode boolean`; `state text` creating/action_required/processing/closing/closed/succeeded/unknown; `provider_method_id text` nullable; `provider_expires_at timestamptz` nullable; creation/update timestamps | Persist intent identity and uncertain outcomes. Partial unique index on checkout for live/uncertain states prevents concurrent payable attempts; closed history remains. Creation idempotency derives from persisted attempt ID. |
| `kiosk_payment_receipts` | `provider_payment_id text` PK; `attempt_id uuid` FK; `amount_centavos bigint`; `currency text`; `livemode boolean`; `paid_at timestamptz`; `received_at timestamptz`; `disposition text` applied/late/duplicate/mismatch; `resolution_note text` nullable; `resolved_at timestamptz` nullable | Record each distinct receipt, even when it cannot safely fulfil a booking. No full provider payload, bank details or client keys. |

Do not persist a provider client key, redirect URL or QR image by default; retrieve minimal current action information through the server when needed. Receipt resolution is a privileged, auditable operation. Any retention policy must preserve accounting/audit evidence.

The booking create route must reserve/claim a checkout before its write, atomically bind the created booking, and account for signature/acknowledgement persistence before permitting payment. Existing signature-storage compensation is not a database transaction: interrupted preparation needs its own recoverable status. A successful booking insert followed by a dropped response must not produce an unowned permanent reservation.

**RPC contracts to fully draft:** claim/create checkout; bind prepared booking; claim attempt; finalize provider result with version check; apply verified receipt and ledger transition; claim/finalize unpaid release. All database work uses the Supabase client/RPC pattern; no raw SQL from app code. Authenticated vendor routes continue to use `requireVendorAdmin` before privileged operations. Server/worker-only RPC execution must be explicit, with pinned search paths and revoked default PUBLIC execution. No broad auth rewrite.

**Narrow transition change proposed:** extend pending→cancelled only for a system actor on an unpaid kiosk booking bound to an eligible managed checkout being finalized as released. Do not simply add `or v_system` to the existing branch. Validate under row locks and preserve existing audit notes and all other transition rules. Final SQL must demonstrate that the release eligibility cannot be forged by a browser role.

**D5 candidate index change:** replace the unconditional `bookings_no_duplicate` with the same key and a predicate excluding only unpaid cancelled kiosk bookings:

```sql
-- Candidate definition only; not applied. Exact online replacement/rollback still to draft.
create unique index bookings_no_duplicate_candidate
  on public.bookings (booker_id, schedule_id, booked_date,
                      coalesce(start_time, '00:00:00'::time))
  where not (booked_via = 'kiosk' and status = 'cancelled' and is_paid = false);
```

This allows the same customer to rebook after release; late receipts on those cancelled bookings must stay in the exception records, not flip `is_paid` and re-enter this index. That invariant couples the index change to B5. Do not rewrite cancelled historical bookings or reactivate them without placement checks.

**Blast radius to review before approval:**

- **Data:** new records start only for new web checkouts; no automatic backfill or deletion of historical unpaid bookings. All FKs indexed, `ON DELETE RESTRICT` for financial/checkout history. RLS enabled on all new tables; revoke default anon/authenticated privileges; no browser table access, use scoped API responses. Explicit service-role DML grants; immutable receipt financial identity needs enforced update restrictions while allowing audited resolution.
- **Lock/performance:** ordinary short transaction row locks for checkout/booking; preserve schedule locks for inventory. Partial index replacement scans bookings and needs an explicit online build/swap and failure strategy based on actual table size. Use a bounded due-checkout index and batched worker; no unbounded table scans every poll.
- **Downstream:** vendor handwritten service types, booker settlement code, backbone migrations/tests; regression against native mobile and hosted booker. The proposed partial index affects cancelled unpaid kiosk bookings created by mobile too; this must be acknowledged in D5.
- **Reversibility:** turn off new direct checkout creation while keeping reconciliation operational. Additive records remain. Restoring the old unique index may fail after legitimate rebookings exist; rollback cannot promise a destructive data cleanup. Prefer a forward fix and retain the old settlement compatibility path.
- **Explicit gates:** shared schema/RLS/RPC/security changes; cross-app vendor+booker implementation; any deployment/configuration; any new dependency. None approved by the research request.

## Decisions

- **D1 — ✅ DONE (2026-09-29):** user selected **vendor web kiosk first; mobile later**. Shared backend compatibility is still required, not permission to redesign mobile.
- **D2 — ✅ DONE (2026-09-29):** user selected **QR Ph plus a separate GCash redirect option**. QR-only does not satisfy the requested final scope.
- **D3 — ⬜ TODO — OPEN:** reservation/late-payment policy. Recommend five-minute QR and immediate release only after proven provider closure. For GCash, first establish early-cancel capability. If unavailable, choose between retaining the slot until definitive expiry (potentially four hours) and a short business deadline with recorded late-payment exceptions/refunds. The latter improves kiosk availability but needs an agreed operator, reconciliation procedure and customer wording. A local timer alone cannot make GCash unpayable. No implementation approval until this is explicit.
- **D4 — ⬜ TODO — OPEN:** allow a non-PII, tab-scoped checkout locator to survive a same-customer redirect/reload, invalidated on next-customer reset? **Recommend yes**, with vendor authentication, server-side interaction binding/expiry and no PII/client keys stored. Alternative: server-associated device interaction, requiring a larger device/session design. This amends the current persistence guidance at `vendor/services/kiosk.service.ts:201`.
- **D5 — ⬜ TODO — OPEN:** same-customer booking after cancellation. **Recommend the narrowly scoped index predicate above**, subject to shared-schema review and late-payment invariants. Alternative: retain the existing rule and require staff intervention for same-slot rebooking; that leaves a known usability limitation. Do not silently revive cancelled bookings.
- **D6 — ⬜ TODO — OPEN:** adopt custom checkout + shared lifecycle work, or first deliver hosted-checkout recovery? **Recommend the custom checkout plan with the independent verified-status correction first**, retaining hosted compatibility. Approval must acknowledge booker/backbone changes and the documented move of method selection into Ezzy. No separate vendor webhook.

All OPEN decisions block execution, per plan-authoring. They do not prevent continued read-only research/design. This review document intentionally leaves them visible rather than treating recommendations as user decisions.

## Deferred / additional notes

- **I4 — ⏸ PARKED (2026-09-29): native mobile UI adoption.** User selected web first. Unblock with a separate mobile plan after the web payment contract is proven. Existing mobile backend behaviour remains regression scope, not deferred.
- **I5 — ⏸ PARKED (2026-09-29): additional direct payment methods/cards and automated refund UI.** Outside requested QR Ph/GCash scope. Unblock by explicit product request or if D3 makes automated refunds a release requirement. An operational late-payment resolution process cannot be deferred with the UI.
- **I6 — ⬜ TODO (2026-09-29): baseline test failure noted, not fixed.** `vendor/lib/dashboardRange.test.ts:1` exits 1 under the existing test command and isolated TAP rerun. Runner reports `ERR_TEST_FAILURE` without an assertion detail; cause not diagnosed. Payment work must not silently fix unrelated dashboard code or count this suite green.

## Execution order — proposal, no stage approved

1. **S0 · ⬜ TODO — Finish review/design:** resolve D3–D6, R3 provider evidence and complete exact migration/RPC/security drafts with blast radius. Sandbox calls/account access need a separately authorised safe path. Review plan for ambiguous success/release/retry semantics, then request approval for the concrete implementation. Read-only design is the only safe prefix currently authorised.
2. **S1 · ⬜ TODO — Independent verified-status correction:** B2 and focused regression coverage, retaining hosted checkout. This improves truthful confirmation without pretending it fixes abandoned holds. After approval, this is the independent code prefix.
3. **S2 · ⬜ TODO — Coupled lifecycle backend:** B3/B4/B5, including schema, booking idempotency, provider adapter, status/reconciliation and worker. Deploy additive data structures, then compatible shared settlement, then vendor endpoints; keep new checkout creation disabled. No direct payment goes live before its settlement path.
4. **S3 · ⬜ TODO — Recoverable custom web UI:** B1/I1 on the proven backend, plus I2's agreed receipt handling. Validate history/cache/reset behaviour on a production build, not just development.
5. **S4 · ⬜ TODO — Controlled verification and rollout:** I3; test sandbox scenarios and existing hosted/mobile contracts, then separately authorised controlled live checks on actual kiosk hardware. Enable gradually; observe DB settlement, ledger and exceptions. Keep reconciliation available during rollback.

Default execution is one stage at a time after approval. Coupled backend changes must remain disabled until the whole batch is ready. No task/issue surfaced here is being closed for the user.

## Verification and limits

**Research baseline (2026-09-29):**

- Vendor `./node_modules/.bin/tsc --noEmit --incremental false`: **passed**.
- Vendor `npm test`: **35 test files passed, 1 failed** (`dashboardRange.test.ts`). Isolated TAP rerun also failed without a detailed assertion. Kiosk logic test files passed; they do not establish a working payment round trip.
- Current code, migration definitions and public official PayMongo docs were inspected. This is static evidence, not proof of the deployed branch or database.
- No build/dev server, browser session, live DB queries, authenticated PayMongo calls, real charges, webhook registration or service restart. Thus no exact production reproduction, account capability verification, cancellation guarantee or physical kiosk test was performed.
- Only this plan and the generated `.plans/INDEX.md` are changed by this research. Existing unrelated root/mobile changes are preserved. Plan-authoring status rules, Supabase lifecycle review, UX state coverage and explicit component separation shaped this draft.

**Required acceptance matrix before rollout:**

| Scenario | Required result | Evidence |
|---|---|---|
| Hosted/provider Back; GCash abort; browser Back/Forward; refresh | Same checkout/booking restored; no premature success or second charge | Production-build browser + sandbox/device |
| QR paid normally; GCash paid normally | One verified receipt, one settlement and correct fee/tax ledger | Fixtures/DB integration + sandbox, controlled live |
| Webhook delayed, lost, duplicated or reordered | Truthful checking state; reconciliation recovers; no duplicate ledger | Fault-injection/integration |
| Create/attach accepted but response lost; DB persistence fails | Same resource recovered; no blind new intent | Provider mocks + sandbox idempotency |
| Method switch while previous method is still payable | Wait/close/verify; never two independent live payment options | Concurrency tests + sandbox |
| Abandon QR; GCash still authorizing; payment races expiry | Chosen D3 policy enforced, inventory/payment never silently disagree | DB concurrency + provider/device |
| Last slot released then bought by another customer, followed by old payment | New booking protected; old funds recorded for resolution, no fulfilment/payout | DB integration |
| Next customer, stale URL, back-forward cache, late async response | Previous interaction never restored or disclosed | Production-build browser, two customers |
| Same email rebooks cancelled slot | D5 policy behaves explicitly; capacity checked again | SQL integration |
| Forged success URL, foreign vendor ID, mismatched amount/mode/payment | No receipt/settlement disclosure or paid transition | Route + signed fixture tests |
| Free booking; existing booker/mobile hosted session; rollback | Existing contract and settlement preserved; in-flight direct payments still resolve | Regression fixtures + staging |
| QR test mode | Simulation through test URL; no real-wallet scanning | Sandbox procedure review |

Before reporting implementation complete: vendor/booker type checks and required lint/unit tests, SQL tests for grants/transition/locking/ledger, scoped production-build browser tests and explicitly recorded live checks. No “DONE” status based on expected behaviour.
