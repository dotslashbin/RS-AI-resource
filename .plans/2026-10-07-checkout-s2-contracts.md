# Checkout S2 — shared lifecycle contract draft

**Date:** 2026-10-07
**App / scope:** Documentation-only S2 appendix: Vendor kiosk, required Booker payment backend and Backbone. Booker custom UI later; Command/native mobile unchanged.
**Status:** DRAFT

> Subordinate to the [canonical checkout plan](2026-09-29-vendor-kiosk-custom-checkout.md), especially D1–D25. This is proposed contract revision `s2-draft-1`, not code, frozen API, exact executable SQL, migration approval or proof of a working provider integration. Claude's migration baseline correction remains a dependency. [Handoff guide](../CHECKOUT-HANDOFF.md).
>
> Status legend: ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED. C# = contract section, X# = unresolved technical requirement, V# = verification; numbers are appendix-local. Drafted does not mean verified or implemented.

## C1 — Scope and invariants · 🔄 IN PROGRESS (2026-10-07)

Draft grounded in `vendor/app/api/kiosk/booking/route.ts:170`, `booker/app/api/payment/create-session/route.ts:45`, `booker/app/api/payment/webhook/route.ts:63`, `vendor/lib/kioskAuth.ts:47`, `architecture/schema.md` bookings/notifications, and the canonical B3–B7/G1–G8.

- Managed lifecycle starts only at explicit registration of a NEW custom web checkout. Initial enabled surface is `vendor_kiosk`; `booker_web` remains disabled until S5. `booked_via` stays its existing immutable kiosk/booker value, not an enablement marker.
- Existing hosted sessions, native clients, historical bookings, zero-price/paid/confirmed bookings are not adopted into automatic release. Free preparation remains idempotent but never creates a payment intent or zero-value ledger entry.
- One checkout binds at most one booking; a booking has one payment-flow owner. One possibly payable/unknown attempt per checkout. An ended/released checkout never becomes a new charge.
- Prices, vendor, customer, legal-document versions, service-start instant and policy are derived/verified server-side. Store exact integer centavos from the database numeric value, not client arithmetic or an arbitrary float rounding rule.
- Settlement, release and cancellation are transactional DB operations. External provider/Storage/email work never runs inside their row-lock transaction.
- Payment success requires an applied receipt plus persisted booking settlement; booking confirmation/fulfilment is a different state. Query strings, browser assertions, screenshots and provider navigation are not evidence.
- Receipt/event IDs are scoped to the provider account and mode. The deployment must verify the webhook/secret-key account binding; no mixing test/live or environments.
- D23 parks local staff-resolution recording. Durable receipt/exception evidence, email delivery and manual Dashboard procedure remain required. No resolution table/RPC solely for the old sketch; no Command notifications in this release.

## C2 — Record and state contracts · 🔄 IN PROGRESS (2026-10-07)

Names below are proposals replacing, not supplementing, the old kiosk-only sketch. Exact DDL/checks/FKs/indexes/triggers remain X1; don't create these tables from this list.

| Record | Required fields / uniqueness | Mutability |
|---|---|---|
| `payment_checkouts` | UUID request/checkout ID; vendor; initiating actor; surface; policy revision; nullable unique booking ID; request fingerprint; state; version; preparation start/deadline; nullable action activation/payment deadline; interaction generation/ended time; release time/reason | Controlled transitions; no PII/signature/client key duplication |
| `payment_attempts` | UUID; checkout FK; method; exact amount/currency/mode/account identity; provider intent ID; nullable method ID; operation keys/payload fingerprints; state/version; claim token/lease; recovery due time; provider expiry; verified-closure evidence | Controlled transitions; unique intent/account/mode; partial uniqueness for possible-payable/unknown states |
| `payment_flow_claims` | Booking ID unique FK; flow hosted/direct; originating surface; resource request ID; claim state/version/lease; provider session ID if hosted | Coordinates BOTH legacy routes and new managed registration; no historical inventory adoption |
| `payment_events` | Provider account/mode/event ID unique; event type; referenced resource IDs; received time; allowlisted evidence/digest | Append-only signed event evidence; nullable checkout/attempt attribution so unmatched events are representable |
| `payment_event_jobs` | Unique event FK; state queued/claimed/retry/processed/quarantined; token/lease/version; retry count/due time/error code | Mutable processing state separate from immutable evidence |
| `payment_receipts` | Account/mode/payment ID unique; intent/session IDs; verified amount/currency/provider-paid time; observed time; nullable attempt/booking attribution | Append-only financial evidence; no bank details/raw payloads; do not require a known attempt to capture money |
| `payment_receipt_applications` | Receipt FK; attribution/disposition applied/late/mismatch/extra_payment/unmatched; evaluated time; nullable checkout/booking; unique applied receipt per booking | Append-only decisions allow later safe correlation without editing original evidence; contradictory applied outcomes forbidden |
| `payment_delivery_jobs` | Semantic key `(receipt or outage episode, audience, notice type)` unique; trusted recipient locator; state/version/token/lease; attempts/due time; transport reference | Mutable delivery state, not financial truth; operations/vendor/customer separate jobs |
| `payment_worker_health` | Named job key; last completed pass; oldest due unprocessed time; failure code; persisted admission/rollout state | Server-only; starting a job is not a successful heartbeat |

Checkout states: `preparing → ready → awaiting_payment → settled`; preparing/ready/awaiting may become `released`; zero-price preparation becomes `free_complete`. Interaction visibility is orthogonal: Next customer does not change money state. Operational review is an exception classification, not an unbounded inventory-holding checkout state.

Attempt states: `creating → awaiting_method → action_required/processing → succeeded` or verified `closed`; any external uncertainty becomes `unknown`. Unknown stays possibly payable even after lease expiry or inventory release. A late succeeded attempt does not imply settled checkout. An already settled/released checkout cannot be revived by a stale finalize.

Versions increase on every state/claim mutation. Every external call gets a persisted operation identity and leased claim token. Finalize verifies both token and expected version; a stale result may append provider evidence and enqueue reconciliation but cannot overwrite newer state. Lease expiry permits a recovery READ/replay of a proven-idempotent operation, never blind resource creation.

## C3 — Booking/preparation and deadlines · 🔄 IN PROGRESS (2026-10-07)

Replace separate insertion/binding (`vendor/app/api/kiosk/booking/route.ts:170`) with one proposed `prepare_checkout_booking` RPC. Input: request UUID, authenticated server-derived actor/vendor/customer, validated booking selection, surface and fingerprint. RPC chooses policy/time, reserves checkout, inserts booking using existing consistency/placement triggers, and binds it in one transaction. On replay, compare actor/vendor/fingerprint; return same IDs; differing request returns conflict. Resolve the customer through existing Supabase Auth path before RPC, without creating custom auth or storing identity in browser persistence.

Preparation begins when the RPC claims it; deadline is DB time + 120 seconds. Payment deadline is NULL until verified action activation. Expose neither QR/redirect action nor client key before booking binding and necessary consent/document persistence are complete. Provider creation may start only after readiness and admission checks.

Signature/required file storage cannot share the DB transaction. Use deterministic server-owned object IDs/paths tied to the request, upload first, then a `complete_checkout_preparation` RPC validates required document IDs/versions/ownership and inserts complete append-only acknowledgement rows plus readiness atomically. Retry checks existing evidence rather than upserting/changing consent. Lost upload/write response recovers the same object/booking; conflicting evidence requires review, not overwrite. No deletion of a booking as generic compensation once managed/payment evidence exists. Failed preparation expires through guarded release; storage orphan cleanup is separately scoped and never deletes legal evidence blindly. Exact signature/path mapping is X1/X3, not a new bucket/permission grant.

Free path: price derived as zero on insert; preserve established no-provider/no-UPDATE-to-zero-ledger semantics. Only complete after required agreements/uploads; no automatic worker release once free_complete. Exact atomic free-price snapshot (including concurrent offering edits) remains X3.

`activate_checkout_action`: server retrieves the persisted intent, checks account/mode/amount/method/provider action and readiness, then locks checkout/booking/attempt and commits activation once. Kiosk deadline = activation + 300 seconds and full window must fit before service start; Booker later = min(activation + 1800 seconds, start) with at least 300 seconds. Retries never restart either deadline. Use DB clock; compute start from stored booked_date/start_time at Asia/Manila, including date-based Booker start at midnight and overnight slots.

If readiness verification reaches/overruns preparation deadline, do not activate or expose an action: release if eligible, retain intent identity and reconcile any possible late funds. Browser cannot activate based on its own timestamp. Already returned in-memory client keys remain provider capabilities, not revocable application auth; delayed attach still requires reconciliation after release.

**X3 / QR timing remains open:** PayMongo QR expiry is configured on method creation, whereas the promised local hold begins at later server verification. A literal 300-second QR can expire before a full 300-second displayed hold finishes; a longer QR can remain payable after local release. Verify provider expiry timestamp semantics and draft an approved alignment solution before claiming D8/G6 satisfied. Do not silently shorten the approved hold or promise cancellation. GCash's longer provider window remains the accepted D3 risk.

## C4 — App API and authorization · 🔄 IN PROGRESS (2026-10-07)

Proposed Vendor prefix `/api/kiosk/checkout`; Booker counterparts only when S5 is approved. Every operation authenticates using Supabase and verifies active account/vendor state/current vendor-admin membership plus locked row scope. A locator is not auth. Existing `requireVendorAdmin` currently checks role membership but must be cross-checked against active-status conventions before reuse. No browser service-role access.

| Endpoint (proposed) | Input | Result / side effects |
|---|---|---|
| `POST /prepare` | requestId + booking/customer/consent data, no price/deadlines/provider URLs | Atomically same checkout/booking on replay; 409 conflicting request/capacity, 503 admission paused |
| `POST /{id}/preparation/complete` | deterministic validated upload/consent evidence | Ready or same ready result; expired never restarts preparation |
| `POST /{id}/attempt` | requestId + qrph/gcash | Persist and claim intent creation; same attempt for same request; 409 other possibly-payable attempt |
| `POST /{id}/action/verify` | expected attempt ID, optional method-ID lookup hint | Provider verification then one activation; browser hint alone never trusted |
| `GET /{id}` | locator and current interaction context | Minimal authoritative snapshot, no action secrets; bounded reconciliation enqueue, not payment mutation based on URL |
| `POST /{id}/action` | attempt ID / current interaction | Ephemeral client key or verified current action only when eligible; never after ended/released/expired |
| `POST /{id}/interaction/end` | request UUID + generation | Idempotent visibility invalidation only; preserves original inventory deadline |
| `POST /{id}/cancel` | request UUID | Guarded release or settled/non-cancellable response; provider cancellation queued, never a release prerequisite |

Financial/status/action responses: `Cache-Control: private, no-store`, no Service Worker caching, no static generation. Mutating cookie-auth routes need verified origin/CSRF protection; verify bearer behaviour separately. Bounded body size, UUID/method validation, rate limits and scoped errors; do not accept external return URL from client. Return origin comes from trusted app configuration. Provider URLs validated to the provider's confirmed HTTPS host allowlist (no arbitrary fetch/redirect URL).

Snapshot discriminated states: preparing, ready, awaiting_payment, processing, settled, free_complete, released, needs_review. Include version/serverNow, deadlines, amount/currency and permitted actions; unknown/network failure never means unpaid/no charge. No customer PII, provider capability or financial state returned for ended kiosk interaction. App UI shows only fixture-reviewed views with render/hook/CSS separation (canonical I1); this appendix introduces no UI implementation.

Kiosk persistence is tab-scoped locator/generation only. Clear before next customer; reject stale responses and BFCache/restored state. Offline invalidation marker blocks restoring the ended interaction and retries server invalidation on reconnect before accepting old URLs. Possessing an old UUID cannot bypass invalidation. How the server binds the active kiosk interaction across tab/reload/redirect without introducing a bearer capability is still X4; UI must not be declared stable until that contract is reviewed.

## C5 — Provider adapter and attempt operations · 🔄 IN PROGRESS (2026-10-07)

One intent creation operation per durable attempt. Secret-key server creates with exact amount, PHP, one allowed chosen method, sanitized description and internal correlation IDs. Persist intent ID before releasing client_key; failed persistence queues/replays the SAME creation operation within verified idempotency retention. Retention expiry with unknown outcome blocks replay/new creation and alerts operations.

Browser public-key create-method/attach remains D7. Client keys/action URLs/QR bytes are memory-only and no-store; no logs, sessionStorage, analytics or committed fixtures. Persist method ID/hints only after server verification. Stable payload/key for supported creation requests; attach/cancel idempotency is NOT assumed. After timeout, retrieve the known intent before retrying attach; only retry when provider state and tested semantics establish safety. A failed/awaiting_method response alone does not prove a previous authorization can no longer pay.

Method change: no parallel QR/GCash attempts. Permit another attempt only when previous provider closure is VERIFIED, booking still eligible and original deadlines not renewed. If closure cannot be verified, keep existing attempt/recover or explicit cancellation; local release never grants another attempt on that checkout. Same-slot rebooking after managed release creates a different booking; old payment remains exceptional.

G6 fixtures must show create acceptance + lost response, attach acceptance + lost response, DB finalize failure, browser disappear before method-ID write, webhook preceding activation, method failure and expired idempotency key. Exact request attributes/action expiry/retrieve mapping, merchant method enablement, actual kiosk GCash device flow remain X3/R3. No account/provider operations authorised here.

## C6 — Settlement, hosted compatibility and release · 🔄 IN PROGRESS (2026-10-07)

Booker remains the ONE per-environment webhook. Raw bytes → signature/mode verification → bounded parse/allowlisted event projection → durable event insert + processing job. 2xx only after durable acceptance or known accepted duplicate; transient DB failure is retryable non-2xx. Unexpected non-payment types can be acknowledged/ignored without provider processing. Invalid signature never creates trusted financial evidence. Malformed expected paid event must not disappear into an unconditional success log. No secrets/raw payloads or unbounded logs.

Direct adapter uses persisted account/mode/intent/payment identity. Hosted adapter server-retrieves session/payments and matches existing session claims/references. For old overwritten/missing references, signed metadata is a lookup hint only; verify provider resource, account, amount, currency and booking before binding or settling. Ambiguous identity retains receipt/evidence and alerts operations, not arbitrary attribution or new inventory adoption. Distinct events about the same payment deduplicate by payment ID for settlement, not only event ID; all payments in a hosted event must be enumerated, not just first.

`apply_verified_payment` accepts normalized server evidence and optional expected version, not a browser paid flag. Under shared lock order recheck binding, price/mode, readiness and booking status. Atomically insert financial evidence/application, set is_paid/payment reference for valid payment, and participate in existing ledger/fee/tax triggers; enqueue semantic notification jobs in the SAME commit. Replay does not duplicate ledger or audience jobs. A distinct second charge is extra_payment, not a harmless replay. Mismatch/unmatched money stays outside ordinary payout and cannot manufacture a successful booking.

**Race boundary retained from D3/B4:** while a valid reservation is still eligible and unreleased, settlement that wins the shared lock before guarded release wins. After committed release/cancellation, ALL later settlement follows the exception path, even if provider paid_at predates release or the slot later becomes free. A browser/deadline timestamp never proves provider closure. After deadline, app never issues a new action/attempt; do not silently change D3 into provider-paid_at-based revival. Cleanup lag is observable and admission fails closed when unhealthy; X2 must prove the exact predicates for due-but-not-yet-released rows.

Release RPC uses DB clock sampled AFTER acquiring locks (not supplied p_now or a stale transaction-start timestamp): only registered, unpaid pending reservation, expired preparation/payment deadline or explicit authorised cancellation, never confirmed/free/settled. One transaction records release time/reason/marker, cancels booking, updates checkout and enqueues best-effort cancellation/recovery. No blocking provider call before inventory release. Attempts may remain unknown/payable; receipts remain attributable. Rebooking marker protects only verified managed release; no broad historical cancelled/refunded exception.

**Critical lock-order constraint (X2/B6):** desired global order is checkout → booking → attempt → evidence/jobs; existing booking updates/triggers take booking locks first, and customer cancellation explicitly does so. Adding a trigger that then locks checkout creates the reverse order and can deadlock. Inventory all writers (including Vendor direct updates, Command RPCs and native clients). Preserve existing authorised actions without requiring Command/native code changes: exact DB compatibility guard/serialization design must be proved against those callers before freeze. Do not claim a comment saying "same lock order" solves this. Placement schedule-row locks also need concurrency tests; bounded due batch selects candidate IDs, then locks one checkout chain at a time rather than holding a batch of booking locks first.

Confirmation writer coverage is mandatory too: prevent an unpaid managed preparing/paying reservation from becoming vendor-confirmed and thereby bypassing the expiry predicate. Propose a narrow DB guard with a readable existing-client error, not a changed legacy/free confirmation rule; test all actual confirmation RPC/direct callers and settlement-vs-confirmation races. Paid settlement remains distinct from vendor confirmation. Exact guard and whether any existing caller needs changes are X2 approval inputs, not a claim that Command/native clients are already compatible.

Both legacy session routes acquire a booking flow claim atomically before provider work; direct-managed ownership returns conflict while retaining legacy success response fields for ordinary traffic. No predeployment hosted session is swept; newly claiming hosted ownership for duplicate-charge safety does not register it for expiry.

## C7 — Worker, admission health and operational email · 🔄 IN PROGRESS (2026-10-07)

Cron runs DB release independently of provider processing and schedules one Edge worker for provider recovery/events/delivery dispatch. Provider work uses official Supabase client RPCs, no SQL from app code. HTTP invocations require server-owned authentication, not a public/publishable key as authority; use established Vault/Edge-secret pattern with least privileged scope, pending exact security approval. Job runtime/timeouts/concurrency/batch counts must be bounded.

Proposed initial values, NOT deployed/frozen: expiry tick every 30 seconds, maximum 50 candidate chains/pass; Edge processing every minute, batch 25 with concurrency 4 and provider call timeout 10 seconds; leased work 90 seconds. Partial failures retry individually with bounded exponential backoff/jitter; no overlapping run can finalize another's claim. Confirm supported scheduling versions/runtime and load via X5 before approval.

D24 admission: DB transaction checks surface enablement + completed expiry/reconciliation passes within proposed 180 seconds + no persistently overdue critical backlog beyond that threshold. Missing health/config fails closed. Starting a run or HTTP 200 is not a pass. Re-enable only after two completed passes and backlog catch-up, retaining manual kill switch. Existing payment webhook/recovery remains active. Tests use injected clock; prevent check-then-create race by checking health at the atomic claim/attempt boundary. No automatic hosted fallback.

Never stop recovering financial uncertainty just because the local hold or a four-hour wallet window passed. Bound hot polling, then move unresolved attempts to low-frequency durable recovery/operations attention; no age-based deletion or automatic assumed closure. Exact long-tail schedule/retention and outage alert threshold are X5. Age alone is not a refund or provider finality signal.

**Email transport gap (canonical I10):** `send-notification-email/handler.ts:48` claims once; `lib/deliveryLog.ts:26` treats duplicate notification ID as already claimed even after failure. Existing trigger is fire-and-forget; neither proves retry delivery. Reuse existing sender/templates/non-prod override, but draft a narrowly scoped payment-delivery lease/retry integration with stable transport idempotency; don't create repeated notification rows to bypass unique claims or rewrite all notifications. Unknown send acceptance must recover safely; exactly-once email is not assumed. Existing audience settings are independent; do not silently bypass them or route ops email through portal=command rows, which would create deferred Command notifications. X5 must reconcile mandatory ops email with actual settings/recipient path before implementation.

Ops email goes only to user-configured monitored operations destination; vendor alerts only scoped active vendor admins for safely matched exceptions. D25 customer email only for verified, reliably matched late money, no booking/refund confirmation. Dedupe by payment/audience/type across webhook/reconciliation; financial commit cannot fail because delivery failed. Minimal reference/amount/investigation notice, no PII/raw provider details in ops payload/logs. No automatic recurring "unresolved" reminders based on local state until Dashboard resolution evidence can be learned; D23 manual handling does not update the app. Delivery failure/backlog is separate from case resolution. Exact inbox/refund Dashboard access/manual checklist are pre-rollout user inputs; no credentials collected.

## C8 — Security, migration and release package · ⬜ TODO

No executable migration written. X1 must supply exact ordered DDL, full replacement function bodies preserving Claude's verified baseline, grants, protected release predicates, index build/swap, deployment/forward-fix runbook and SQL test results before schema/security approval. New tables use RLS and explicit API grants/revocations; immutable evidence explicitly revokes service-role UPDATE/DELETE/TRUNCATE before SELECT/INSERT. Mutable queue/state privileges are separate. SECURITY DEFINER pins search_path and restricts EXECUTE; no client role can choose release time/actor/amount.

**Architecture conflict to resolve in X1:** `architecture/conventions.md:765` requires a policy on every new table, while the old checkout sketch intentionally grants no browser access and defines no policies. Do not silently disregard it. Proposed resolution for review: explicit deny policies for browser roles alongside revoked table privileges, with trusted service-role-only writes; verify test expectations and obtain security approval before migration. This is a draft option, not an approved convention change.

Blast radius: additive evidence/state, new protected booking marker and narrow index replacement; no historical backfill/deletion. Shared triggers/RPCs affect Booker/Vendor/Command/native callers even with no client edits. FK/index/trigger alphabetical-order and schedule-lock checks are required. Applied migration files never rewritten by Codex. Large-table online index strategy depends on measured size/Postgres version and CLI transaction support; restoring unconditional index after permitted rebookings is not a promised rollback.

Rollout order: baseline approved → disabled additive schema → compatible sole webhook/legacy guards → worker + measured health + delivery → disabled Vendor endpoints → S3/S4 acceptance → separate Vendor enablement. Booker S5 later, independent enablement. Rollback disables new direct admission only; retain identity/evidence, existing reads/settlement/recovery and compatible schema. No destructive rollback or old webhook deployment that cannot process in-flight direct payments.

## Unresolved technical requirements — not hidden implementation decisions

| Item | Status | Closure evidence |
|---|---|---|
| X1 / canonical G1/B7 | ⬜ TODO | Claude baseline fixed and verified; exact ordered SQL/ACL/index package and environment history/size/version; review/approval |
| X2 / G2/G4/B6 | ⬜ TODO | All writer lock graph and due-row settlement predicate; two-connection race/deadlock tests; compatible cancellation/confirmation guards |
| X3 / G3/G6/R3 | ⬜ TODO | Atomic free/prep/upload evidence; real QR expiry alignment; endpoint payload/idempotency/recovery fixtures and device/account proof |
| X4 / G8/auth | ⬜ TODO | Active account/vendor checks, CSRF/rate limits, non-capability kiosk interaction binding/invalidation design and two-customer tests |
| X5 / G5/G7/D22–D25 | ⬜ TODO | Worker/auth/load, queue retention, payment-email retries/settings/ops-only recipients and manual Dashboard verification |

## Verification and independent prefix

- **V1 · ✅ DONE (2026-10-07): static contract research.** Re-read booking/create-session/webhook/auth and email sender/log paths, architecture sections, canonical decisions and handoff. Public provider/Supabase sources below reopened; no account/provider/DB execution. This verifies evidence anchors, not contracts at runtime.
- **V2 · ⬜ TODO: contract fixtures/property tests.** Pure status/deadline/version/normalization/privacy tests may be drafted after X2/X3/X4 boundaries are reviewed; a pure test passing doesn't establish SQL atomicity/provider behaviour. No production UI or migration implementation in this appendix.
- **V3 · ⬜ TODO: coupled acceptance.** Concurrent claims; webhook before activation; release/settle/cancel/confirm races; stale lease finalization; last-slot resale; extra/unmatched money; failed durable event insert; hosted overwritten refs/mobile; free price edits/signature interruption; QR alignment; privacy reset/offline/BFCache; failed/unknown email; unhealthy admission/rollback. SQL/RLS, route/unit, sandbox, production-build/device and user-authorised live evidence recorded separately.

Safe next work while Claude baseline is pending: finish technical review of X2–X5, draft sanitized fake fixtures and exact SQL IN documentation only. No dependent migrations, live provider calls, shared security changes, credential/configuration edits or runtime enablement. Draft contract review does not approve S2 implementation. Exact SQL remains required; this appendix is progress, not "no gaps" certification.

## Primary references checked 2026-10-07

- [PayMongo idempotency](https://docs.paymongo.com/reference/idempotent-requests): notes limit support to creation and retention to 24 hours; attach/cancel behaviour must be proved separately.
- [PayMongo QR Ph API](https://docs.paymongo.com/docs/payment-acceptance-qr-ph-api): public-key browser method/attach; configurable method expiry; no assumed local/provider-clock alignment.
- [PayMongo e-wallets](https://docs.paymongo.com/docs/payment-acceptance-e-wallets): GCash redirect and four-hour window; amount/device constraints still need account/kiosk verification.
- [PayMongo webhook practices](https://docs.paymongo.com/docs/developer-tools-best-practices): signature/mode verification, 30-second acknowledgement and duplicate/retry handling; our durable-before-ACK rule avoids losing accepted money.
- [Supabase Cron](https://supabase.com/docs/guides/cron), [scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions): existing infrastructure direction; invocation example alone is not privileged endpoint authorization.
