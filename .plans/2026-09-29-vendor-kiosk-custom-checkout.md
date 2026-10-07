# Vendor kiosk — recoverable PayMongo checkout with QR Ph and GCash

**Date:** 2026-09-29
**App / scope:** Vendor web kiosk first; proposed implementation also touches booker's shared payment webhook and backbone's booking/payment lifecycle. Native mobile later.
**Status:** IN PROGRESS

> S0 research/design and the user-approved S1 vendor verification correction are complete. No migration, provider configuration, credentials, provider resources or deployed system changed. This is not approval for S2–S4; their remaining contract, schema and rollout gates are listed below.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important, D# = Decision, R# = Research, S# = Stage; numbers are plan-local. Implementation statuses below reflect completed S1 work and the remaining TODOs.

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
| Retry protection | [Idempotent requests](https://docs.paymongo.com/reference/idempotent-requests) documents `Idempotency-Key`, matching payloads, and a 24-hour retention period. Its notes limit support to resource creation; prove support separately for creation, attach and cancellation; do not infer universal coverage. |
| Cancellation | [Cancel a Payment](https://docs.paymongo.com/reference/cancel-a-payment) exposes `POST /v1/payment_intents/{id}/cancel`, but does not establish valid states or guarantees for active QR Ph/GCash. **Endpoint existence is not proof of safe immediate slot release.** |
| Client/server boundary | [Quick start](https://docs.paymongo.com/docs/payment-acceptance-quick-start) and [QR Ph API](https://docs.paymongo.com/docs/payment-acceptance-qr-ph-api) create the intent server-side, then create/attach methods in the browser using the PayMongo public key and the intent `client_key`. [Payment Method API reference](https://docs.paymongo.com/reference/create-a-paymentmethod) explicitly accepts either public or secret keys for method creation; it does not establish that moving attach server-side avoids the `client_key` contract. Public keys/client keys are designed for browser use; the secret key must remain server-only. |
| Merchant account enablement | [Go-live checklist](https://docs.paymongo.com/docs/payment-acceptance-go-live-checklist) requires confirming each method is Active in the merchant dashboard. Docs show QR Ph active by default after activation; GCash account readiness cannot be verified without the user's dashboard or test credentials. |
| Webhook handling | [Developer Tools best practices](https://docs.paymongo.com/docs/developer-tools-best-practices) says acknowledge within 30 seconds, expect up to 12 retries, deduplicate events, and check `livemode`. Therefore queue-first processing is appropriate only if the event is durably stored before responding; otherwise apply the settlement synchronously within the response budget and return a retryable failure when a transient write fails. |
| Financial identity | [Payment Intent resource](https://docs.paymongo.com/reference/the-payment-intent-object) exposes amount, currency, mode and server-readable payments. [Webhook events](https://docs.paymongo.com/docs/developer-tools-webhooks-events) supplies payment IDs and `payment_intent_id`; match stored IDs, not assumed propagation of booking metadata alone. |
| Testing | [Testing](https://docs.paymongo.com/docs/payment-acceptance-testing) provides e-wallet simulation and QR `test_url`. Its QR-specific warning says scanning/paying a test QR can move real money, despite its general test-mode introduction. Use simulation, not real wallet scans, during sandbox tests. |

### R3 — Provider contract checks still required · ⬜ TODO

**Anchors:** `vendor/app/api/kiosk/payment/create-session/route.ts:120`; `booker/app/api/payment/webhook/route.ts:63`; the official references above.

Before executable design approval, document or obtain controlled sandbox evidence for:

- Account access to direct QR Ph and GCash, required billing fields and exact request/response contracts for the D7 browser flow. Dashboard method activation and sandbox capability remain unverified; the public key and CSP changes still require implementation approval.
- Actual QR expiry and GCash Back/abort/cancel behaviour, including whether an existing authorization remains payable after returning. This affects late-payment handling, but under D3 no longer determines the selected five-minute local inventory deadline.
- Cancellation allowed states and race results for both methods. The kiosk should attempt cancellation at the short deadline, but inventory policy does not depend on assuming it succeeds. If unresolved in public docs, controlled sandbox testing or a user-supplied PayMongo answer is needed; do not contact PayMongo on the user's behalf without permission.
- Idempotency of intent creation/attach, timeout after provider acceptance, and retrieval after failed DB persistence. Never create another intent just because the prior HTTP request timed out.
- Actual event payloads and metadata propagation for each method. QR guide names `qrph.expired`, but the inspected consolidated events page did not list that exact string; confirm subscription/payload, not the unrelated Wallet QR `qr.expired` product.
- GCash desktop/tablet browser experience and authentication on the customer's device. No customer wallet credentials should be entered into an Ezzy form. A kiosk page cannot clear a third-party origin's cookies.

**Verification:** docs verify the documented browser flow and API surfaces only. Account method status, GCash cancel races, actual return behaviour, and exact idempotency semantics need controlled sandbox/dashboard checks. Sanitised fixtures and outcomes only; never commit customer data, keys, client keys or payment URLs. Those checks were not run in this research turn.

## BLOCKERS

### B1 — Returning from checkout loses the active booking · ⬜ TODO

**Files:** `vendor/components/kiosk/KioskShell/useKioskShell.ts:77`; `vendor/components/kiosk/KioskBooking/useKioskCheckout.ts:42`; `vendor/components/kiosk/KioskBooking/KioskBooking.tsx:48`.

**Risk:** provider cancel returns to home; browser Back may restore stale React state from cache; retry submits a new booking. This matches the reported reservation becoming an obstacle rather than a resumable purchase.

**Fix:** establish one server-tracked checkout per customer interaction before the booking write. Repeated requests carry its stable request ID. Keep the active locator across same-customer redirects/reloads; resume by an authenticated vendor-scoped read. Resume an existing booking and amount, never repeat customer/signature/booking creation on payment retry. A conflicting request using the same key must fail.

Use the D4-approved non-PII interaction ID in tab-scoped storage; it is a locator, **never authentication**. No customer identity, signature, provider URL or client key in persistent browser storage; the D7 client key may exist transiently in memory only as required for the documented attach call. Authenticate every read/action using existing Supabase vendor-admin checks and bind vendor, checkout and booking. Server-side interaction validity prevents old history from restoring a completed/abandoned customer's receipt to the next user. Handle `pageshow`/back-forward cache and visibility return, not just initial mount.

**Verify:** provider Back, browser Back/Forward, refresh, hard reload and lost create response all find the same booking; two concurrent submissions yield one reservation. Foreign-vendor and invalid/stale interaction IDs reveal no customer details. Coupled to B3 and B4.

### B2 — Confirmation claims payment without verifying it · 🔄 IN PROGRESS

**Files:** `vendor/components/kiosk/KioskBooking/KioskBooking.tsx:48`; `vendor/services/kiosk.service.ts:224`; `vendor/components/kiosk/KioskBooking/StepConfirmation.tsx:45`, `:66`, `:78`; `useKioskReceipt.ts:27`.

**Risk:** the URL alone selects confirmation. Receipt read omits `is_paid`; read failure still says payment went through. A delayed webhook or manually changed URL can therefore show a false success message. This does **not** set `is_paid` in the DB; it is a customer/staff trust problem.

**Fix:** all returns enter a checking state. An authenticated, vendor/interaction-scoped status read supplies persisted settlement, booking status and a minimal receipt. Bounded polling with backoff and a manual recheck handles delayed webhooks; unknown/offline is not failed and must not invite another charge. Use the same verified settlement service for any server-side reconciliation. Distinguish paid/pending vendor approval from confirmed booking. Preserve zero-price handling: “No payment needed”, with no provider call or zero-value ledger row.

**Verify:** forged success URL, unpaid booking, paid event before/after return, network failure and cancelled-but-paid exception; success appears only after persisted evidence. Hook cleanup must discard stale results when checkout ID or customer generation changes. **S1 subset ✅ DONE (2026-09-29):** current vendor-authenticated RLS read selects persisted `is_paid` and status; return UI now distinguishes paid/free/pending/needs-staff and retries pending reads. Pure status tests, vendor typecheck and targeted lint passed. The broader interaction binding, shared provider reconciliation and live webhook/redirect verification remain for S2/S3.

### B3 — Payment attempts can multiply or become untraceable · ⬜ TODO

**Files:** `vendor/app/api/kiosk/payment/create-session/route.ts:57`, `:120`, `:150`; `vendor/components/kiosk/KioskBooking/useKioskCheckout.ts:86`; `booker/app/api/payment/create-session/route.ts:45`.

**Risk:** route does not select/check `is_paid`, booking status or existing payment reference; every request can create another session. Persistence errors are ignored. The hook loses the created booking ID on error/reload, and thrown fetch errors bypass its normal state reset. Ledger deduplication cannot undo a second real charge.

**Fix:** durable checkout and attempts, atomically claimed before provider work; reject paid/terminal/ineligible bookings, derive amount from stored booking, record IDs before exposing a payable action. Only one live attempt per checkout; retries reuse it. Never create a second attempt or switch methods while the earlier provider attempt could still be paid—even if the local five-minute inventory hold has expired. A released checkout is closed to customer payment actions; any later payment is an exception, not permission to open another attempt. Store distinct received payment IDs, including unexpected second/late payments, for reconciliation. Unknown provider result stays recoverable rather than becoming a fresh attempt. Catch transport/parse errors, release UI submitting state, and preserve the interaction ID.

Preserve legacy `create-session` response shape for native mobile; new web endpoints must not silently replace it with QR/intent data. Guard **both** vendor and booker legacy routes against creating a hosted session for a booking already owned by a new checkout. Booker's route checks customer ownership but not booking origin, so a logged-in kiosk customer can otherwise obtain a second payable hosted session for the same booking. Enforce the managed-checkout exclusion under the same atomic claim rules, not a racy read-before-create check. Keep ordinary hosted booker traffic compatible with B5.

**Verify:** double click, concurrent HTTP requests, dropped responses, timeout after provider accepts, DB write failure, repeated method switch, already-paid/cancelled booking, and a logged-in kiosk customer requesting hosted checkout through booker's endpoint. Assert provider resources **and** database rows, not just UI button state. Coupled to B1/B4/B5.

### B4 — Abandoned reservations never expire; cancellation/rebooking needs design · ⬜ TODO

**Files:** `backbone/supabase/migrations/20260828000001_schedule_window_minutes_expand.sql:369`, `:415`; `20260829000004_kiosk_customer_close_out.sql:98`; `20260803000003_booking_units.sql:80`; `vendor/components/kiosk/KioskShell/useKioskShell.ts:199`.

**Risk:** no payment hold expiry lifecycle was found in the migration/route search. Local reset only erases the screen. A service-role expiry worker cannot simply set `status='cancelled'`: current transition rules exclude the system actor from pending→cancelled. Even after cancellation, the unconditional duplicate index blocks the same customer recreating the same slot.

**Fix:** distinguish (1) leaving a UI, (2) provider payment closure, and (3) releasing inventory. Back resumes payment. Explicit “Cancel booking and start over” initiates server-side closure. A server-run expiry/reconciliation process also handles closed tabs and lost devices; do not rely on a browser timer, unload request or `sendBeacon` for correctness. QR's displayed expiry and reservation policy must agree. D3's five-minute deadline starts when the first payment action is made available, is capped by the booked service start, and is measured by server time (the UI timer is advisory); do not offer a new payment method if too little valid time remains.

Under D3, the five-minute deadline is the explicit kiosk inventory policy, not evidence that GCash has become unpayable. At the deadline, mark the customer interaction ended locally, attempt to cancel the Payment Intent, then release the unpaid kiosk reservation under the guarded release RPC even if provider cancellation cannot be confirmed. A subsequent provider payment is a late-payment exception, never a revived booking or ordinary vendor payout; notify staff and direct them to the documented reconciliation/refund process. This deliberately accepts the residual late-charge risk in exchange for quickly freeing capacity. Settlement and expiry lock the same checkout/booking records in a consistent order; a paid outcome arriving before release wins, while one arriving after release follows the exception path. Never hold a database transaction open during a provider HTTP call. Use a claim/call/finalize protocol and verify the claim/version again after the call. New bookings still pass existing schedule-row locking and placement checks.

Constrain automated cancellation to unpaid pending reservations explicitly registered through **new custom checkout in Vendor web kiosk or Booker web** (D11, approved 2026-10-06). Back/reload resumes the same reservation; release follows its approved deadline or explicit cancellation rules. Never automatically sweep historical bookings, existing hosted sessions, native-mobile reservations, paid/free bookings or vendor-confirmed bookings. Keep audit history and original provider references. D5 permits kiosk same-customer rebooking only after verified managed release; its extension to Booker remains D16. Existing stale production bookings require separate read-only inventory and individual reconciliation before any cleanup is proposed. Candidate kiosk-only table/RPC/index definitions below need design refinement for D11 before execution; this scope decision is not schema approval.

**Verify:** last-slot concurrency; payment concurrent with expiry; provider timeout; lost webhook; server worker retry; abandoned browser; same-email same-slot after release; late GCash payment after the slot is sold again; service-start boundary. Coupled to B3/B5 and the approval-gated schema draft.

---

#### Scope question raised 2026-10-04 — answered by D11 on 2026-10-06

The user accepted automatic lifecycle management for new custom Vendor/Booker checkout reservations only, with Back/reload recovery and exclusions for historical/hosted/native-mobile/paid/free/confirmed bookings. Booker timing, late-payment policy and rebooking remain separate decisions below. The original question/evidence follows as historical context; Booker B1 remains PARKED, not implemented or closed by this decision.

Raised from `.plans/2026-10-04-booker-payment-lifecycle.md` (its **B1**), at the user's request. **No
item of this plan is changed by this note** — it asks a question of B4's authors rather than
answering it.

**The situation.** booker has the identical defect: `confirmBooking()` inserts the booking before a
checkout session exists, so capacity is consumed the moment "Pay" is pressed, and an unpaid
`pending` row holds the slot for ever. Nothing expires it. That was dormant between `f331560`
(2026-09-22) and 2026-10-04, because booker's PayMongo call had been deleted and no checkout could
be reached at all; **restoring the call (gaps plan K9) made it live again.**

**Why it lands here.** The booker plan's **D1** was decided as *"wait and reuse"* precisely to avoid
a second expiry mechanism: one definition of "an unpaid reservation has died", one guarded release
RPC, one audit trail. ⚠️ **But the paragraph above excludes `booker/mobile reservations` by name**,
so as written the reuse is a no-op and booker stays unfixed indefinitely.

That exclusion reads as a guard against a *blanket* sweep of historical rows — which is right, and
booker needs the same protection — rather than a decision that booker must never be managed. **If
that reading is correct, the wording wants widening** to something like *"only unpaid pending
bookings explicitly managed by this checkout lifecycle, whichever surface created them"*, keeping
every other exclusion intact.

**What the booker side would bring, if admitted:**
- a hold window of **30 minutes** from session creation, capped by the booked start, server-measured
  (that plan's **D2**) — deliberately **not** the kiosk's five minutes, because a booker at home is
  not a walk-in with a queue behind them. ⚠️ **Two different windows on one release path is a design
  question for B4**, not something the booker plan can settle alone.
- the same two constraints already established here: `pending → cancelled` admits **no system
  actor** in the live trigger, and `bookings_no_duplicate` is unconditional, so a released booking
  still blocks the same customer rebooking the same slot (this plan's **D5**).

**Deciding it needs this plan's authors**, since it changes B4's scope and possibly D3's window.
Until then booker's B1 stays ⏸ PARKED with its unblock condition pointing here.

### B5 — Settlement can lose payments and mishandle late money · ⬜ TODO

**Files:** `booker/app/api/payment/webhook/route.ts:63`, `:100`, `:125`, `:132`; `backbone/supabase/migrations/20260911000001_withholding_tax.sql:164`; `20260801000003_booking_payout_status.sql:25`, `:101`.

**Risks:** signed metadata identifies the booking, but the handler does not compare provider resource ID, expected amount/currency/mode or lifecycle state. A DB error is acknowledged with 200, suppressing provider retry. A cancelled booking can later be marked paid; its newly inserted ledger defaults to held because the cancellation trigger already ran before the ledger existed. A distinct second payment is treated like a harmless replay.

**Fix:** keep one webhook in booker, normalize hosted-session and direct-payment payloads into a settlement service, and bind direct payments through stored intent/payment IDs. Validate amount, currency, mode and booking/attempt identity; signature verification remains mandatory. Metadata is a lookup aid, not the sole financial check. Persist a verified receipt and apply booking settlement atomically. Duplicate delivery of the same payment is a no-op; a different payment for an already settled checkout is an exception requiring reconciliation.

Transient settlement failure must return a retryable response unless already durably queued. Invalid/permanent anomalies require durable exception evidence and an operational alert, without logging whole payloads or credentials. Reconciliation must recover missed callbacks through authenticated provider reads and the same settlement path. Do not implement two different notions of success in webhook and status endpoint.

After capacity was released, record late money as an exception without resurrecting the booking or adding it to ordinary vendor payout. Under D3, notify vendor staff and route them to a documented PayMongo Dashboard refund/reconciliation procedure; the notification and recorded resolution must identify the booking/attempt and provider payment without leaking customer details. A local `refunded` label does not move money. Preserve the established ledger/fee/tax trigger for valid settlements and free-booking behaviour. Keep hosted payload handling for existing booker/mobile sessions; prove that events from one flow cannot accidentally settle another. Use `payment.paid` event-ID deduplication plus provider payment-ID uniqueness, check event `livemode`, and meet the 30-second response window. For transient DB failure, return non-2xx so PayMongo's documented retry policy can work; alternatively, acknowledge only after the event is durably queued. Do not keep the current unconditional-200-on-write-failure behaviour for direct payments.

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

Use existing design tokens, both themes, keyboard/focus handling, 44px targets and non-colour status labels. QR contrast/size must survive both themes. Payment waiting gets its own bounded server deadline; blindly retaining the two-minute idle reset or indefinitely suspending it would both be wrong. Next-customer reset **immediately conceals local customer data**, clears the active locator and cancels stale render updates without waiting for any server response. Invalidate the server interaction independently of financial closure; a still-payable attempt may remain in reconciliation after its customer-facing session ends. If offline, retain only a non-PII invalidation retry marker, refuse to restore the ended interaction, and synchronize invalidation before accepting any stale history return. Never block privacy reset on a provider cancellation call.

**Verify:** every state in UI fixtures, light/dark, keyboard, slow network, QR legibility on target tablets, production-build history navigation and two consecutive customers, including offline next-customer reset followed by Back/reconnect. Depends on B1–B5.

### I2 — Late payments and receipts need an operator resolution path · ⬜ TODO

**File:** `booker/app/api/payment/webhook/route.ts:132`, `:170`, `:206`, `:237`.

**Risk:** already-paid replay returns before notifications; some inserts ignore returned errors. The D3 five-minute release deliberately permits GCash to succeed later, after the slot may have been sold again. That money cannot safely settle the cancelled booking or flow into its normal vendor payout. “Confirmation is on its way” can also overpromise.

**Fix direction:** record each late provider receipt, notify the vendor admins, and ship a documented staff procedure plus an auditable resolution record so staff can reconcile/refund it through PayMongo Dashboard. Do not set booking `is_paid` or create a normal payout ledger row after its slot was released; preserve the provider receipt separately. Automated refund UI may remain parked; staff ownership, alert delivery and recorded resolution may not. Also inspect notification insert errors and use truthful copy; decide whether durable retry is needed. Keep vendor and customer notification toggles independent. Limit this to payment exceptions, not an ecosystem-wide notification rewrite.

**Verify:** simulated late payment after slot resale creates a durable exception and vendor-admin alert, no booking revival or vendor payout, and a recorded refund/reconciliation outcome; duplicate events do not duplicate records/alerts. No follow-up status is closed by this research.

### I3 — Rollout, compatibility and observability · ⬜ TODO

**Files:** `architecture/booking-flow.md:561`, `:580`, `:660`; `architecture/schema.md:754`; `vendor/app/api/kiosk/payment/create-session/route.ts:152`; `vendor/services/kiosk.service.ts:201`.

**Fix:** update architecture for new provider IDs, interaction persistence and state transitions after implementation. Subscribe the existing per-environment webhook to the direct events actually verified in R3, retaining hosted events. API support alone does not prove dashboard registration. Add bounded structured logs/metrics for unresolved attempts, late/duplicate funds and settlement retries using internal IDs only.

Enable custom web checkout through a reversible server-side rollout switch; old requests/sessions must remain recognizable. Rollback stops creation of new direct intents but continues status, settlement and reconciliation for existing ones. Do not redirect an in-flight direct checkout into a new hosted charge. Keep legacy tables/columns readable, maintain the native mobile API contract, and perform cross-app regression tests. No deployment, configuration or webhook subscription change is authorised by this document.

**Verify:** old hosted session after new deployment; mobile contract fixtures; disabled rollout with an in-flight direct payment; test/live separation; DB `is_paid` and correct ledger evidence, not just provider delivery HTTP 200.

## Data design and approval gates

This is an S0 design draft, **not an applied migration and not yet implementation approval**. The candidate DDL, RPC contracts, security model and blast radius below are the design artifact approved for S0. Before S2 schema approval, translate this into ordered migration/RPC files, exact function bodies, tests and a deployment/rollback runbook after checking live table size and deployed Postgres version. No schema file is created by S0.

Proposed minimum durable records (names are proposed, not existing schema):

| Record | Concrete draft fields and constraints | Purpose |
|---|---|---|
| `kiosk_checkouts` | `id uuid` PK/request ID; `vendor_id uuid` FK; `booking_id uuid` nullable unique FK; `created_at timestamptz`; `hold_expires_at timestamptz`; `interaction_ended_at timestamptz` nullable; `state text` constrained to preparing/open/closing/settled/released/needs_review; `version bigint` | Idempotent interaction before booking creation, binding, reservation deadline and invalidation. No customer PII duplicate. |
| `kiosk_payment_attempts` | `id uuid` PK; `checkout_id uuid` FK; `provider_intent_id text` nullable unique; `method text` qrph/gcash; `amount_centavos bigint` positive; `currency text` PHP; `livemode boolean`; `state text` creating/action_required/processing/closing/closed/succeeded/unknown; `provider_method_id text` nullable; `provider_expires_at timestamptz` nullable; creation/update timestamps | Persist intent identity and uncertain outcomes. Partial unique index on checkout for live/uncertain states prevents concurrent payable attempts; closed history remains. Creation idempotency derives from persisted attempt ID. |
| `kiosk_payment_receipts` | `provider_payment_id text` PK; `attempt_id uuid` FK; nullable unique `provider_event_id text`; `amount_centavos bigint`; `currency text`; `livemode boolean`; `paid_at timestamptz`; `received_at timestamptz`; `disposition text` applied/late/mismatch | Immutable identity/evidence for each provider payment; no customer PII, payload, bank details or client keys. Distinct payment IDs remain distinct even if they target the same attempt. |
| `kiosk_payment_resolutions` | `id uuid` PK; `provider_payment_id text` FK; `resolution text` reconciled/refund_requested/refunded/other; `note text`; `actor_id uuid` nullable FK; `created_at timestamptz` | Append-only staff audit of what was done in PayMongo Dashboard. A local status never asserts that PayMongo moved money; actual refund evidence/reference is recorded in the note or a dedicated provider refund ID after contract verification. |

Do not persist a provider client key, redirect URL or QR image by default; retrieve minimal current action information through the server when needed. Receipt resolution is a privileged, auditable operation. Any retention policy must preserve accounting/audit evidence.

**Candidate DDL sketch (for design review only; not executable until named indexes, migration order, SQL tests and rollback are finalised):**

```sql
create table public.kiosk_checkouts (
  id uuid primary key,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  booking_id uuid unique references public.bookings(id) on delete restrict,
  state text not null check (state in ('preparing','open','closing','settled','released','needs_review')),
  created_at timestamptz not null default now(),
  hold_expires_at timestamptz not null,
  interaction_ended_at timestamptz,
  version bigint not null default 1 check (version > 0)
);
create index kiosk_checkouts_vendor_id_idx on public.kiosk_checkouts(vendor_id);
create index kiosk_checkouts_due_idx on public.kiosk_checkouts(hold_expires_at)
  where state in ('open','closing');

create table public.kiosk_payment_attempts (
  id uuid primary key,
  checkout_id uuid not null references public.kiosk_checkouts(id) on delete restrict,
  provider_intent_id text unique,
  provider_method_id text,
  method text not null check (method in ('qrph','gcash')),
  amount_centavos bigint not null check (amount_centavos > 0),
  currency text not null check (currency = 'PHP'),
  livemode boolean not null,
  state text not null check (state in ('creating','action_required','processing','closing','closed','succeeded','unknown')),
  provider_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kiosk_payment_attempts_checkout_id_idx on public.kiosk_payment_attempts(checkout_id);
create unique index kiosk_payment_attempts_one_payable_idx
  on public.kiosk_payment_attempts(checkout_id)
  where state in ('creating','action_required','processing','closing','unknown');

create table public.kiosk_payment_receipts (
  provider_payment_id text primary key,
  provider_event_id text unique,
  attempt_id uuid not null references public.kiosk_payment_attempts(id) on delete restrict,
  amount_centavos bigint not null check (amount_centavos > 0),
  currency text not null,
  livemode boolean not null,
  paid_at timestamptz not null,
  received_at timestamptz not null default now(),
  disposition text not null check (disposition in ('applied','late','mismatch','duplicate_payment'))
);
create index kiosk_payment_receipts_attempt_id_idx on public.kiosk_payment_receipts(attempt_id);

create table public.kiosk_payment_resolutions (
  id uuid primary key default gen_random_uuid(),
  provider_payment_id text not null references public.kiosk_payment_receipts(provider_payment_id) on delete restrict,
  resolution text not null check (resolution in ('reconciled','refund_requested','refunded','other')),
  note text not null check (length(trim(note)) > 0),
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index kiosk_payment_resolutions_payment_id_idx on public.kiosk_payment_resolutions(provider_payment_id);
create index kiosk_payment_resolutions_actor_id_idx on public.kiosk_payment_resolutions(actor_id);

alter table public.kiosk_checkouts enable row level security;
alter table public.kiosk_payment_attempts enable row level security;
alter table public.kiosk_payment_receipts enable row level security;
alter table public.kiosk_payment_resolutions enable row level security;
revoke all on public.kiosk_checkouts, public.kiosk_payment_attempts,
  public.kiosk_payment_receipts, public.kiosk_payment_resolutions
  from public, anon, authenticated;
grant select, insert, update, delete on public.kiosk_checkouts,
  public.kiosk_payment_attempts to service_role;
revoke all on public.kiosk_payment_receipts, public.kiosk_payment_resolutions from service_role;
grant select, insert on public.kiosk_payment_receipts,
  public.kiosk_payment_resolutions to service_role;
```

Add `COMMENT ON TABLE/COLUMN` for each non-obvious field in the migration. No authenticated RLS policies are intentional: all rows are accessed through scoped API routes and trusted service-role operations. Receipt and resolution tables are append-only even to `service_role` (no UPDATE/DELETE/TRUNCATE); a resolution correction is another resolution row. `provider_event_id` nullable uniqueness deduplicates webhook deliveries, while `provider_payment_id` uniqueness distinguishes a second charge from a replay.

The booking create route must reserve/claim a checkout before its write, atomically bind the created booking, and account for signature/acknowledgement persistence before permitting payment. Existing signature-storage compensation is not a database transaction: interrupted preparation needs its own recoverable status. A successful booking insert followed by a dropped response must not produce an unowned permanent reservation.

**RPC/API contracts (implementation not approved here):**

| Operation | Inputs / result | Required atomic effects and authority |
|---|---|---|
| `claim_kiosk_checkout(p_checkout_id uuid, p_vendor_id uuid, p_hold_expires_at timestamptz)` | Returns existing compatible checkout or creates `preparing`; conflicting reuse returns a typed conflict. | API first runs `requireVendorAdmin`; RPC is service-role only. Lock checkout/request ID; retry is idempotent only for same vendor and same interaction. No customer data stored. |
| `bind_kiosk_booking(p_checkout_id uuid, p_booking_id uuid)` | Returns bound checkout version or conflict. | Lock checkout then booking. Verify vendor matches, `booked_via='kiosk'`, status pending, unpaid, and booking not bound elsewhere; update booking_id once. |
| `claim_kiosk_attempt(p_checkout_id uuid, p_attempt_id uuid, p_method text, p_amount_centavos bigint, p_livemode boolean)` | Returns attempt ID + monotonic version/state. | Lock checkout; require open/unexpired checkout and pending unpaid booking; verify amount against stored `price_paid` converted to centavos; method only qrph/gcash; partial unique index blocks second payable/uncertain attempt. No provider HTTP in transaction. |
| `finalize_kiosk_attempt(p_attempt_id uuid, p_expected_version bigint, p_provider_intent_id text, p_provider_method_id text, p_state text, p_provider_expires_at timestamptz)` | Returns current attempt state/version or conflict. | Lock attempt; accept only allowed transitions; provider intent unique; a timeout/uncertain response remains recoverable and cannot free a new attempt. Provider reads happen outside transaction. |
| `apply_paymongo_payment(p_event_id text, p_intent_id text, p_payment_id text, p_amount_centavos bigint, p_currency text, p_livemode boolean, p_paid_at timestamptz)` | Returns applied/duplicate/exception classification. | Booker webhook verifies HMAC and server-retrieves/matches provider identity before calling. Lock checkout then booking then attempt (same order as release); enforce event/payment uniqueness, exact amount/currency/mode/intent and state. For valid unreleased payment, insert receipt, transition attempt and set `bookings.is_paid=true` in one transaction so existing fee/tax ledger trigger participates. For late/mismatch/second distinct payment, insert receipt/exception only—never revive booking or make normal vendor payout. |
| `release_kiosk_checkout(p_checkout_id uuid, p_expected_version bigint, p_now timestamptz)` | Returns released/already-settled/needs-review/conflict. | Worker-only service-role RPC. Lock checkout then booking then attempt; recheck due time and `is_paid=false`; claim cancellation, release capacity and mark protected release flag atomically. Provider cancellation is outside transaction and best-effort; finalise by version. A settlement that wins the lock first prevents release; after release it is late exception. |
| `append_kiosk_payment_resolution(p_payment_id text, p_resolution text, p_note text, p_actor_id uuid)` | Returns resolution row ID. | Authenticated vendor-admin API verifies staff owns the checkout's vendor, then server writes append-only resolution. No browser table access. Only verified user action is recorded; it does not issue a provider refund. |

For every new table: enable RLS; revoke all from `anon` and `authenticated`; grant no table access to either API role; grant service-role full DML only for mutable checkout/attempt rows. For immutable receipts, explicitly `revoke all ... from service_role` then grant only `select, insert` (preserving the repository's append-only invariant). For append-only resolutions, do the same. Policies may grant no authenticated access; service-role worker/API uses server credentials. No broad auth rewrite.

Every `SECURITY DEFINER` RPC must pin `search_path=public`, revoke execute from `PUBLIC`, `anon`, and `authenticated`, then grant execute only to `service_role`; authenticate user-facing calls in `requireVendorAdmin` before privileged API invocation. If vendor scoping is passed into any RPC, derive/verify it against locked rows, never trust it alone. Lock order is always checkout → booking → attempt → receipt/resolution, with all external PayMongo requests outside DB transactions. Keep RLS/grants/security assertions in SQL tests. No raw SQL in app code.

**Narrow transition change proposed:** extend pending→cancelled only for a system actor on an unpaid kiosk booking bound to an eligible managed checkout being finalized as released. Do not simply add `or v_system` to the existing branch. Validate under row locks and preserve existing audit notes and all other transition rules. Final SQL must demonstrate that the release eligibility cannot be forged by a browser role.

The marker is protected by a BEFORE UPDATE trigger: reject any `kiosk_payment_released` change unless the actor is system (`auth.uid() is null`), the row is an unpaid kiosk booking being cancelled, and the bound checkout is in the release-finalization state. Extend the existing status transition trigger only for the same predicate. The release RPC changes checkout state and booking status/marker in one transaction; ordinary vendor-admin update privileges cannot set the marker. All other existing transition branches remain byte-for-byte unchanged in the eventual migration except the narrowly gated pending→cancelled branch.

**D5 candidate index change:** replace the unconditional `bookings_no_duplicate` with the same key and a predicate excluding only unpaid cancelled kiosk bookings explicitly released by this managed lifecycle. Add a protected release marker; set it only in the release RPC after checking the bound checkout and provider evidence. It defaults false on all legacy/mobile/booker records and is not writable through ordinary authenticated booking updates. A trigger must reject unauthorized marker changes; RLS alone is insufficient if an existing booking update policy permits them.

```sql
-- Candidate definition only; not applied. Exact online replacement/rollback still to draft.
alter table public.bookings
  add column kiosk_payment_released boolean not null default false;

create unique index bookings_no_duplicate_candidate
  on public.bookings (booker_id, schedule_id, booked_date,
                      coalesce(start_time, '00:00:00'::time))
  where not (booked_via = 'kiosk' and status = 'cancelled'
             and is_paid = false and kiosk_payment_released = true);
```

This allows the same customer to rebook after a **managed** release; late receipts on those cancelled bookings must stay in the exception records, not flip `is_paid` and re-enter this index. That invariant couples the index change to B5. The marker avoids widening the rule to historical/mobile hosted sessions, whose receipts have no direct `attempt_id`. Do not backfill it, rewrite cancelled historical bookings or reactivate them without placement checks. Existing legacy late-payment reconciliation remains a recorded risk in B5; adopting old sessions requires a separate explicit mapping/exception design before their holds may be released by this worker.

**Blast radius to review before approval:**

- **Data:** new records start only for new web checkouts; no automatic backfill or deletion of historical unpaid bookings. All FKs indexed, `ON DELETE RESTRICT` for financial/checkout history (resolution actor is `SET NULL`). RLS enabled on all new tables; revoke default anon/authenticated privileges; no browser table access, use scoped API responses. Explicit service-role grants; receipts and resolution history are append-only even to service_role, with no UPDATE/DELETE/TRUNCATE.
- **Lock/performance:** ordinary short transaction row locks for checkout/booking; preserve schedule locks for inventory. Adding the release-marker column requires a table lock; determine the deployed PostgreSQL version/table size and use a bounded lock timeout in the exact migration draft. Partial index replacement scans bookings and needs an explicit online build/swap and failure strategy based on actual table size. Use a bounded due-checkout index and batched worker; no unbounded table scans every poll.
- **Downstream:** vendor handwritten service types, booker settlement and legacy create-session guard, backbone migrations/tests; regression against native mobile and hosted booker. The release marker must remain false for legacy/mobile bookings, so their uniqueness behaviour remains unchanged.
- **Reversibility:** turn off new direct checkout creation while keeping reconciliation operational. Additive records remain. Restoring the old unique index may fail after legitimate rebookings exist; rollback cannot promise a destructive data cleanup. Prefer a forward fix and retain the old settlement compatibility path.
- **Explicit gates:** shared schema/RLS/RPC/security changes; cross-app vendor+booker implementation; any deployment/configuration; any new dependency. None approved by the research request.

## Decisions

- **D1 — ✅ DONE (2026-09-29):** user selected **vendor web kiosk first; mobile later**. Shared backend compatibility is still required, not permission to redesign mobile.
- **D2 — ✅ DONE (2026-09-29):** user selected **QR Ph plus a separate GCash redirect option**. QR-only does not satisfy the requested final scope.
- **D3 — ✅ DONE (2026-09-29):** user chose a short local kiosk deadline, then release and staff reconciliation/refund for late payment. Draft policy: five minutes from when the first payment action is made available, bounded by service start; server time is authoritative and the browser countdown is advisory. At deadline, attempt provider cancellation, but release does not depend on cancellation succeeding. This deliberately accepts late-payment risk; no booking revival or ordinary payout after release.
- **D4 — ✅ DONE (2026-09-29):** user chose the recommendation: a non-PII, tab-scoped checkout locator survives same-customer redirect/reload and is cleared on next-customer reset. It is only a locator, never authentication; every request remains vendor-authorized and server-bound to a valid checkout. No PII, signature, provider URL or client key is stored. This amends current persistence guidance at `vendor/services/kiosk.service.ts:201`.
- **D5 — ✅ DONE (2026-09-29):** user chose same-customer rebooking after verified release, using the narrow schema/index change drafted above. This is a design decision, not schema approval; migration, locking, RLS/grants and rollback remain review/approval gates.
- **D6 — ✅ DONE (2026-09-29; target amended 2026-10-06):** user originally chose custom QR Ph plus separate GCash redirect for vendor kiosk, retaining hosted checkout for existing Booker/mobile flows. On 2026-10-06 the user explicitly chose to **adapt custom checkout to Booker as well**, rather than retain hosted checkout as Booker's final target. Verified against the user's explicit answer to “Does Booker keep hosted checkout”. Preserve existing hosted sessions during transition; native mobile adoption remains deferred. Booker UI/method scope, sequencing, managed-reservation eligibility and timing require refinement before execution; no migration, implementation or deployment approval is implied. The shared Booker webhook remains the sole endpoint.
- **D7 — ✅ DONE (2026-09-29):** user chose the recommendation: use PayMongo's documented browser create/attach flow with the public key and intent `client_key`. Keep secret keys server-only; do not persist the `client_key`. Implementation must verify exact API payloads, configure only the required public key and `api.paymongo.com` CSP access in `vendor/next.config.ts:142`, and pass the security/configuration approval gates. This is the documented transport choice, not approval to change configuration or call the live API.

D1–D17 are resolved, including the user's explicit 2026-10-06 acceptance of D12–D17 recommendations. Booker adopts custom checkout (D6), and newly registered custom Vendor/Booker reservations are eligible for the guarded lifecycle (D11). The document's original vendor-only/hosted-Booker target wording and kiosk-only candidate contracts are historical drafts requiring reconciliation before execution. G1–G8 remain outstanding technical design work. Provider account activation, cancellation races, event subscriptions and exact sandbox contracts also remain gates in R3/S4. Decision approval does not authorise S2 schema/RPC/security implementation.

### Booker expansion decisions — 2026-10-06

- **D11 — ✅ DONE (2026-10-06):** user explicitly accepted all four reservation-boundary recommendations: manage reservations created through new custom Vendor kiosk/Booker web checkout; Back/reload resumes the same reservation and approved timeout/explicit cancellation rules govern release; historical bookings, existing hosted sessions and native-mobile reservations are excluded from initial automatic expiry; paid/free and vendor-confirmed bookings never expire through this mechanism. Verified against the user's explicit acceptance. No worker/schema implementation or closure of Booker B1 is implied.
- **D12 — ✅ DONE (2026-10-06):** user accepted QR Ph plus separate GCash redirect for Booker, matching the kiosk; cards and other methods are deferred on the new custom flow. Existing hosted sessions remain supported during transition. Verified against explicit acceptance of the D12 recommendation; no implementation is implied.
- **D13 — ✅ DONE (2026-10-06):** user accepted a 30-minute Booker payment hold from server verification of the first usable payment action, capped by service start; retry/method switching never renews it. This refines the newer Booker plan's provisional session-creation boundary for a direct/custom flow. Keep kiosk five minutes unchanged. Permit a shorter Booker window near start with clear countdown only when at least five minutes remain; otherwise refuse new paid checkout. Verified against explicit acceptance of D13; runtime timing remains unimplemented.
- **D14 — ✅ DONE (2026-10-06):** user accepted two minutes for Booker preparation from the server claiming preparation, separate from payment time; recover the same booking and interrupted document work without blindly inserting another booking. Exact handling of uploads interrupted at the deadline remains G3 design work. Verified against explicit acceptance of D14; no implementation is implied.
- **D15 — ✅ DONE (2026-10-06):** user accepted extending D3/D9 late-payment protection to Booker: durable exception, no booking revival or normal vendor payout, vendor alert and Ezzy operations reconciliation/refund ownership with one-business-day investigation/initiation target. Provider payment closure is not assumed from local expiry. Verified against explicit acceptance of D15; operational access and implementation remain unverified.
- **D16 — ✅ DONE (2026-10-06):** user accepted extending D5's narrow rebooking eligibility to Booker only after verified managed release, checking capacity again. Do not relax uniqueness broadly for historical, ordinary cancelled or refunded bookings. Verified against explicit acceptance of D16; exact index/schema change still requires design and separate approval.
- **D17 — ✅ DONE (2026-10-06):** user accepted delivery order: shared backend first, vendor custom kiosk next, then Booker custom checkout using the proven contracts. Each surface gets separate enablement; native mobile stays deferred. No customer enablement before safe settlement/reconciliation. Verified against explicit acceptance of D17; stage implementation/deployment remain separately gated.

## Implementation-readiness review — 2026-10-02

This section records gaps, not implementation or schema approval. The candidate contracts above remain sketches until these items are resolved. S0's historical DONE records a reviewed design sketch, **not an implementation-ready SQL/deployment package**; the opening completion wording must be read with this qualification. No follow-up issue is closed by this review.

| Item | Status | Missing detail and required closure |
|---|---|---|
| G1 — Honest readiness / exact migration package | ⬜ TODO | Data design and execution order S0/S2: draft exact RPC/trigger bodies, ordered migrations, grants, tests, index replacement strategy, deployment and forward-fix/rollback procedure inline before requesting schema approval. Verify deployed PostgreSQL version/table size through separately authorised read-only checks; do not promise restoration of the old unique index after legitimate rebookings. |
| G2 — Attempt concurrency/version contract | ⬜ TODO | `kiosk_payment_attempts` candidate DDL omits the version returned by claim and required by finalize. Define monotonic version, permitted transitions and claim leases/recovery. Apply the checkout → booking → attempt lock order to **all** state-changing operations, not only settlement/release. Prove stale finalize cannot overwrite settlement/release and that timeouts never permit a second payable attempt. |
| G3 — Atomic preparation and two deadlines | ⬜ TODO | `claim_kiosk_checkout` currently requires a hold expiry before booking/payment action exists; booking creation and binding are separate contracts. `vendor/app/api/kiosk/booking/route.ts:170`, `:235`, `:263` writes booking, signature and acknowledgements separately. Design atomic booking insert/bind with existing placement checks, bounded preparation recovery, and a distinct payment deadline activated once server-verified action is ready. Handle lost responses, storage/ack failure and free bookings. D8 sets timing policy. |
| G4 — Legacy hosted routing and exclusion | ⬜ TODO | `booker/app/api/payment/webhook/route.ts:63` currently routes by metadata; create-session `:45` reads booking and later creates a resource. Define separate hosted/direct identity adapters feeding the same settlement rules, event-to-payment mapping and an atomic managed-checkout exclusion for both legacy creation routes. Preserve predeployment hosted sessions, including missing/overwritten local references; do not silently discard legitimately paid old sessions or adopt old holds into the new expiry worker. Prove with hosted/mobile fixtures. |
| G5 — Durable webhook/anomaly evidence | ⬜ TODO | B5/I2 and receipt DDL: mandatory attempt FK cannot represent an unmatched paid event. Draft minimal durable event inbox/exception storage, event-versus-payment deduplication, retry states, unknown-identity quarantine and later correlation/resolution. Do not store arbitrary raw payloads or payment URLs. Acknowledge only after durable acceptance/settlement; failed persistence must remain retryable. Verify unmatched, duplicate, multi-event/same-payment and wrong-mode fixtures. |
| G6 — Provider recovery and trusted action activation | ⬜ TODO | R3/B3/D7: specify browser/server endpoint payloads, recovery after create/attach succeeds but response or persistence fails, stable idempotency payloads, and behaviour after provider idempotency retention expires. The server must verify provider action/state before opening the payment deadline; browser assertions are not financial evidence. QR expiry must not outlive the promised local hold due to delayed action persistence. Unknown outcomes stay blocked for reconciliation, not blind recreation. |
| G7 — Worker and operational resolution | ⬜ TODO | B4/I2: select concrete worker host/schedule, bounded batches, claim leases, retries, outage catch-up, alert thresholds and reconciliation lifetime. Keep expiry independent of provider network hangs and use server-owned time. Define how staff find exceptions and append resolutions, verify actual Dashboard refund authority/capability, and make alerts retryable independently of settlement. D9 sets ownership; do not add a Command implementation silently. |
| G8 — Interaction exit and rollout acceptance | ⬜ TODO | B1/I1/I3: document distinct Back/resume, next-customer/privacy reset and explicit cancel transitions (D10), offline invalidation and stale-history rejection. Specify rollout switch, deployment order and in-flight rollback behaviour. Test last-slot payment/expiry races, lost webhook recovery, preparation failure, late funds after resale, two-customer privacy, and existing hosted/mobile compatibility. R3 dashboard/device/sandbox evidence remains unperformed. |

### Additional decisions — resolved 2026-10-02

- **D8 — ✅ DONE (2026-10-02):** user accepted the recommended timing and near-start policy: a **two-minute maximum preparation window**, then **five minutes to pay** beginning when the server verifies the first usable payment action; neither retry nor method switching extends either deadline. Refuse a new paid checkout when the full five-minute payment window cannot fit before service start. D3's short-hold/late-refund choice stays unchanged. Final design must explain delayed browser delivery and QR expiry alignment. Verified against the user's explicit acceptance; no runtime timing implementation is implied.
- **D9 — ✅ DONE (2026-10-02):** user accepted the recommended ownership and response target: vendor admins receive an alert, but **Ezzy operations staff with verified PayMongo Dashboard access own reconciliation/refund**, with a target of **one business day to investigate/initiate resolution** (not a promise of completed provider refund). Actual staffing/access and a privileged, auditable recording surface still require confirmation in G7. A Command UI would be a separately approved scope expansion. Verified against the user's explicit acceptance; operational capability is not yet verified.
- **D10 — ✅ DONE (2026-10-02):** user accepted the recommended exit policy: Back resumes; **Next customer conceals data and ends the interaction immediately but retains the reservation until its original deadline**; a separate explicit **Cancel booking and start over** action requests early managed release. Neither action proves the provider payment closed. Late funds still follow D3. Verified against the user's explicit acceptance; implementation remains G8/B1/I1 work.

### Required closure order

1. D8–D10 resolved and recorded on 2026-10-02 from the user's explicit acceptance of the recommendations.
2. Complete G1–G7's exact design/contracts and G8's state/acceptance specification; retain existing B/I items and cross-reference rather than replacing them.
3. Obtain authorised provider/account and deployment facts necessary for executable design; distinguish preimplementation blockers from S4 runtime release gates. Verify method amount limits and kiosk GCash device behaviour, not just API availability.
4. Present the exact schema/security/cross-app batch and blast radius for S2 approval. Implementation defaults to one stage at a time, regardless of whether Codex or Claude owns it.
5. Implement behind a disabled rollout switch; prove S2 before S3, then complete S4 before enabling customer traffic. Rollback must keep existing direct payments reconcilable.

**Review verification (2026-10-02):** re-read the plan candidate DDL/RPC contracts, actual Booker webhook/create-session routes, vendor booking write sequence and architecture booking/schema/auth conventions. Reopened official PayMongo [e-wallet](https://docs.paymongo.com/docs/payment-acceptance-e-wallets) and [webhook best-practice](https://docs.paymongo.com/docs/developer-tools-best-practices) documentation. No application edits, migration, credential access, provider resource creation, deployment or runtime/payment checks. This is a documentation review, not completion of G1–G8.

## Deferred / additional notes

- **I4 — ⏸ PARKED (2026-09-29): native mobile UI adoption.** User selected web first. Unblock with a separate mobile plan after the web payment contract is proven. Existing mobile backend behaviour remains regression scope, not deferred.
- **I5 — ⏸ PARKED (2026-09-29): additional direct payment methods/cards and automated refund UI.** Outside requested QR Ph/GCash scope; unblock by explicit product request. This parks only the automation/UI: staff procedure, alerting, audit record and timely reconciliation/refund of late receipts are required in B5/I2 before release.
- **I6 — ⬜ TODO (2026-09-29): baseline test failure noted, not fixed.** `vendor/lib/dashboardRange.test.ts:1` exits 1 under the existing test command and isolated TAP rerun. Runner reports `ERR_TEST_FAILURE` without an assertion detail; cause not diagnosed. Payment work must not silently fix unrelated dashboard code or count this suite green.

## Execution order — S0 and S1 approved by user (2026-09-29); later stages remain unapproved

1. **S0 · ✅ DONE (2026-09-29) — Design package drafted and reviewed:** D4/D7 are incorporated; candidate table/index DDL, RPC/security contracts and data/lock/downstream/reversibility notes are inline above. Cross-checked against architecture schema/auth docs and actual booking/grant/transition migrations. This is not an applied migration or S2 approval; exact SQL bodies, live-table lock strategy, migration tests and deployment/rollback runbook remain S2 approval inputs. R3 account/sandbox checks remain S4 release gates.
2. **S1 · ✅ DONE (2026-09-29) — Independent verified-status correction:** B2 vendor-only subset plus focused regression coverage, retaining hosted checkout. Status comes from the RLS-scoped persisted row; no schema/shared webhook change. Typecheck and targeted tests/lint passed; full suite retains the known unrelated dashboard-range failure. Browser/device/webhook timing remains unverified.
3. **S2 · ⬜ TODO — Coupled lifecycle backend:** B3/B4/B5, including schema, booking idempotency, provider adapter, status/reconciliation and worker. Deploy additive data structures, then compatible shared settlement, then vendor endpoints; keep new checkout creation disabled. No direct payment goes live before its settlement path.
4. **S3 · ⬜ TODO — Recoverable custom web UI:** B1/I1 on the proven backend, plus I2's agreed receipt handling. Validate history/cache/reset behaviour on a production build, not just development.
5. **S4 · ⬜ TODO — Controlled verification and rollout:** I3; test sandbox scenarios and existing hosted/mobile contracts, then separately authorised controlled live checks on actual kiosk hardware. Enable gradually; observe DB settlement, ledger and exceptions. Keep reconciliation available during rollback.

S0 and S1 were explicitly approved together; S2–S4 remain separate approval stages. Coupled backend changes must remain disabled until the whole batch is ready. No task/issue surfaced here is being closed for the user.

## Verification and limits

**Research baseline (2026-09-29):**

- Vendor `./node_modules/.bin/tsc --noEmit --incremental false`: **passed after S1**.
- Vendor `npm test`: **36 test files passed, 1 failed** (`dashboardRange.test.ts`). The new payment-status unit test passed; the existing dashboard-range runner still exits without a detailed assertion. Kiosk logic tests do not establish a working payment round trip.
- Targeted ESLint on changed kiosk components/service/helper/test: **passed**. Linting the touched UI-gallery file also reports its pre-existing `react-hooks/static-components` error at `app/ui-gallery/page.tsx:1200`; the `Body` component was already declared inside render and was not refactored by this task.
- S0 candidate DDL/contracts were reviewed against `architecture/schema.md`, `architecture/auth-and-roles.md`, current bookings/index/status-transition migrations and table grants; this is static design verification only, not SQL execution or live RLS proof.
- Current code, migration definitions and public official PayMongo docs were inspected. This is static evidence, not proof of the deployed branch or database.
- No build/dev server, browser session, live DB queries, authenticated PayMongo calls, real charges, webhook registration or service restart. Thus no exact production reproduction, account capability verification, cancellation guarantee or physical kiosk test was performed.
- S1 changed the vendor kiosk service/components/helper/test, UI-gallery fixture and the corresponding `architecture/booking-flow.md` rule; S0 changed this plan. `.plans/INDEX.md` is regenerated for the overall status change. Existing unrelated root/mobile changes are preserved. Plan-authoring, Supabase, UX-state and component-separation requirements were applied.

**Required acceptance matrix before rollout:**

| Scenario | Required result | Evidence |
|---|---|---|
| Hosted/provider Back; GCash abort; browser Back/Forward; refresh | Same checkout/booking restored; no premature success or second charge | Production-build browser + sandbox/device |
| QR paid normally; GCash paid normally | One verified receipt, one settlement and correct fee/tax ledger | Fixtures/DB integration + sandbox, controlled live |
| Webhook delayed, lost, duplicated or reordered | Truthful checking state; reconciliation recovers; no duplicate ledger | Fault-injection/integration |
| Create/attach accepted but response lost; DB persistence fails | Same resource recovered; no blind new intent | Provider mocks + sandbox idempotency |
| Method switch while previous method is still payable | No second attempt for the checkout; after release, any late success becomes an exception, never a revived booking | Concurrency tests + sandbox |
| Abandon QR; GCash still authorizing; payment races expiry | Chosen D3 policy enforced, inventory/payment never silently disagree | DB concurrency + provider/device |
| Last slot released then bought by another customer, followed by old payment | New booking protected; old funds recorded for resolution, no fulfilment/payout | DB integration |
| Next customer, stale URL, back-forward cache, late async response | Previous interaction never restored or disclosed | Production-build browser, two customers |
| Same customer rebooks a managed released slot | Allowed only after verified release; capacity is checked again and old late payment stays exceptional | SQL integration |
| Forged success URL, foreign vendor ID, mismatched amount/mode/payment | No receipt/settlement disclosure or paid transition | Route + signed fixture tests |
| Free booking; existing booker/mobile hosted session; rollback | Existing contract and settlement preserved; in-flight direct payments still resolve | Regression fixtures + staging |
| QR test mode | Simulation through test URL; no real-wallet scanning | Sandbox procedure review |

Before reporting implementation complete: vendor/booker type checks and required lint/unit tests, SQL tests for grants/transition/locking/ledger, scoped production-build browser tests and explicitly recorded live checks. No “DONE” status based on expected behaviour.
