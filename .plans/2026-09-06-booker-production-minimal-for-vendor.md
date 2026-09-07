# Booker in production — the minimum vendor needs

**Date:** 2026-09-06
**App / scope:** `booker` (deployment + configuration only), one ordered variable change in
production `command`.
**Status:** IN PROGRESS — configuration COMPLETE and measured on the deployed hosts
(2026-09-07). Only two things remain: **I1** (production has data to serve) and the live
payment that closes kiosk **B34**.

> Put `booker` in production **without launching it**, so vendor's kiosk can settle payments
> and kiosk customers can claim their accounts. Nothing more.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are **plan-local** — the kiosk
> plan has its own B1, and cross-plan refs are qualified (e.g. "kiosk B34").

---

## Scope

**Deploy is not launch.** These are different things and only the first is in scope:

| | |
|---|---|
| **In scope** | A booker deployment connected to the **production** Supabase project, reachable at a stable HTTPS origin, able to (1) receive PayMongo's live webhook and settle `is_paid`, and (2) let a kiosk-created customer sign in and view their booking |
| **Out of scope** | Promoting booker to customers, search indexing, marketing, and every functional gap listed under "Why this is not a launch" |

**Launch order this plan sits inside (recorded 2026-09-06):** **`vendor` and `command`
launch first; `booker` does not.** Command ships with known issues **as an accepted risk** —
it is a back-office tool operated by the user alone, not a customer surface, and patches
will follow in a timely manner. Booker is deployed here **only** to serve vendor. Its own
launch, and the six functional gaps below, are revisited later under their own plan.

**Why vendor needs it at all** — `is_paid` is written **only** by
`booker/app/api/payment/webhook`. There is deliberately no vendor webhook (kiosk plan F4,
D4, B22). A production webhook must therefore reach a booker wired to the production
database. This is **kiosk B34**, and it is the last thing between the kiosk and production.

---

## Why this is NOT a launch — verified 2026-09-06

`architecture/booking-flow.md` → "Known Gaps and Future Work" lists six open areas. Two are
disqualifying for a public booking portal:

- **Booking document uploads are in-memory only** — no Storage write, no
  `booking_documents` row. A customer satisfying an offering's requirements uploads a file
  that goes nowhere, silently.
- **Cancellation / reschedule does not exist.**
  `components/dashboard/BookingDetailModal/BookingDetailModal.tsx:123` renders a prominent
  blue **"Reschedule"** button with **no `onClick` handler at all**. It is shown whenever a
  booking is not awaiting the booker.

Also open: capacity display, vendor map markers, wallet, contact info on confirmation.

⚠️ **The dead Reschedule button is reachable by the very users this plan enables.** A kiosk
customer claiming their account to view a confirmed booking lands in exactly that modal.
See **I3** — accepted for now, not fixed here.

---

## BLOCKERS

### B1 — A booker deployment on the production Supabase project  ✅ DONE (2026-09-07)
**Files:** none — Vercel project + domain configuration.

Today **nothing** runs booker against production. Verified 2026-09-05 by reading each
deployed host's CSP `connect-src`:

| Host | Supabase project |
|---|---|
| `staging-booker.ezzy.ph` | staging `fbxbwnfeimzhgxpshdpa` |
| `booker.ezzy.ph` | **staging** — and it serves no CSP header at all, so it is a stale build |
| `vendor.ezzy.ph` | production `pdkejyjidrfxksaczvfy` |

**Fix approach:** a Vercel deployment of `booker` with production-scoped variables (**B2**),
on the origin chosen in **D1**. Deploy from the same release commit vendor will ship from,
so the payment routes match.

**Verification:** *needs-live* —
`curl -sI https://<booker-prod>/ | grep -io "connect-src[^;]*"` names
**`pdkejyjidrfxksaczvfy`**, not the staging ref.

---

### B2 — Production environment variables on booker  ✅ DONE (2026-09-07)
**File:** Vercel → booker project → Settings → Environment Variables (**Production** scope).

Booker reads exactly these. **It does NOT read `PAYOUT_ENCRYPTION_KEY`** — that is vendor
and command only, confirmed from source.

| Variable | Type | Where the value comes from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | config | Supabase → **production** project → Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | config | same page → **Publishable** (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔒 secret | same page → **Secret / service_role** key (behind *Reveal*) |
| `NEXT_PUBLIC_APP_URL` | config | booker's production origin, e.g. `https://booker.ezzy.ph` |
| `NEXT_PUBLIC_APP_NAME` | config | product name, matching vendor's convention |
| `NEXT_PUBLIC_APP_DOMAIN` | config | the bare host, e.g. `booker.ezzy.ph` |
| `PAYMONGO_SECRET_KEY` | 🔒 secret | PayMongo → **live mode** → Developers → API keys → **secret key** |
| `PAYMONGO_WEBHOOK_SECRET` | 🔒 secret | **B3** — shown once when the live webhook is created |
| `ALLOW_INDEXING` | — | **leave UNSET.** Setting it to `"1"` is what would make this a launch |

⚠️ **Five traps, each of which cost real time during the staging rollout. Every one is a
"looks fine, behaves wrong" failure:**

1. **`SUPABASE_SERVICE_ROLE_KEY` is not the publishable key.** Both sit under "API keys".
   The publishable one is RLS-bound; using it makes the webhook's write fail with
   `42501 permission denied for table bookings` **while the route still answers 200** —
   a paid booking, silently unpaid. A service-role JWT decodes with `"role":"service_role"`.
2. **`PAYMONGO_SECRET_KEY` must be the SAME PayMongo account as vendor's.** PayMongo scopes
   webhooks to the account, so a session created with vendor's key emits on vendor's
   account. Different accounts = the webhook listens where nothing fires: no delivery, no
   log, no retry, payment still taken. **Compare the values, not just the `sk_live_`
   prefix** — a same-mode different-account split looks identical to a correct setup.
3. **`!secret` is true for an empty string.** A blank value, a variable scoped to the wrong
   Vercel environment, and a redeploy that reused a cached build all present identically as
   `500 {"error":"Webhook not configured"}`. Verify by probe (**I2**), never by looking at
   the dashboard.
4. **`NEXT_PUBLIC_APP_URL` needs the scheme and no trailing slash.** A bare host makes
   `new URL()` throw. It is **Config, not Secret** — a `NEXT_PUBLIC_` value is inlined into
   the browser bundle whatever Vercel labels it, so "Secret" promises what it cannot give.
5. **Next reads env at build.** Every variable change needs a **redeploy**, and a redeploy
   that reuses the build cache may carry the old snapshot.

**Verification:** *needs-live* — **I2**'s probes.

---

### B3 — Register the LIVE webhook, and delete the stale one  ✅ DONE (2026-09-07)
**File:** PayMongo dashboard → Developers → Webhooks.

> ✅ Registered by the user 2026-09-07. ⚠️ **Not externally verifiable** — nothing outside
> the PayMongo dashboard can confirm an endpoint is registered and live-mode-scoped. The
> probe above proves only that booker *answers* correctly if called. The proof that it *is*
> called is a live payment (kiosk B34).

**Order matters: deploy first, register second.** PayMongo validates the endpoint on
creation, and an endpoint answering `500` (because its secret is not yet set) may be
refused. If it is, set a throwaway value, deploy, register, then replace it with the real
secret and redeploy.

1. Confirm booker production answers: an unsigned POST to `/api/payment/webhook` returns
   **400** `{"error":"Invalid signature"}` — that is the endpoint working.
2. In **live mode**, on the **same account as production's `PAYMONGO_SECRET_KEY`**, create a
   webhook at `https://booker.ezzy.ph/api/payment/webhook`, event
   **`checkout_session.payment.paid`**
   only. *(The handler also accepts `payment.paid`; subscribing to it adds warning noise
   with no benefit, because the booking id travels on the session, not the payment.)*
3. **Copy the signing secret immediately — it is shown once.** Set as
   `PAYMONGO_WEBHOOK_SECRET`, then **redeploy**.

⚠️ **Delete the stale live-mode webhook** created on 2026-09-05 before the mode was
corrected — the one still aimed at **staging-booker**. Per D1 the live webhook belongs on
`booker.ezzy.ph` and the test one on `staging-booker.ezzy.ph`; a live webhook pointing at the
staging host is the dangerous combination. It never fires for test payments, but the day live keys are set it becomes an
active endpoint pointing at **staging-booker**, which is wired to the staging database. A
real customer's payment would try to settle a booking that does not exist there — kiosk
**B34**'s failure arriving through a leftover registration rather than a deploy.

⚠️ **Registered in the wrong mode is invisible.** A live-mode webhook with test payments —
and the reverse — produces no delivery, no log, and a successful payment. That cost a full
diagnostic cycle on staging.

**Verification:** *needs-live* — a production kiosk booking paid with a real card produces a
**delivery entry** in PayMongo and `is_paid = true`.

---

### B4 — Set `PORTAL_URL_BOOKER` in production Command, in this order  ✅ DONE (2026-09-07)
**File:** Vercel → command project → Production env.

> ✅ Set by the user 2026-09-07, in the required order — booker was already serving the
> production project (B1, measured) before the variable was set, so no set-password link
> was ever minted against a staging booker. Not externally verifiable: a server-only env
> var leaves no trace in a response.

Production Command leaves `PORTAL_URL_BOOKER` **deliberately blank** today, because a
production-minted recovery token cannot validate against a staging booker
(`architecture/overview.md:89`).

⚠️ **Repoint booker first, confirm it serves production, THEN set the variable.** The
reverse order mints set-password links pointing at a booker that is still on staging, and
those tokens fail — for the users least able to diagnose it. Command creates every account
**without a password** and starts recovery itself on creation
(`auth-and-roles.md` → "How a Command-created user gets a password"), so this is the path
every new booker-only user actually walks.

**Value:** booker's production origin, matching `NEXT_PUBLIC_APP_URL`.

**Verification:** *needs-live* — create a booker-only user in production Command and confirm
the set-password email link lands on production booker and sets a password.

---

## IMPORTANT

### I1 — Confirm production has data booker can serve  ⬜ TODO
Not checkable from the repo. Before declaring success, confirm the production project has at
least one vendor with an active, kiosk-eligible offering and a schedule — otherwise a
"working" deployment shows an empty portal and the failure looks like a bug.

⚠️ Kiosk eligibility also needs the vendor's account **complete** (`hasOffering &&
hasPayoutDetails`), or the kiosk launcher correctly refuses to open (kiosk D25a). Local and
staging both hit this; production will too if payout details are unset.

---

### I2 — Post-deploy verification probes  ✅ DONE (2026-09-07)
Configuration is only real once measured **on the deployed host**. Run all of these:

```bash
H=https://<booker-prod>

curl -sI $H/ | grep -io "connect-src[^;]*"          # must name pdkejyjidrfxksaczvfy
curl -s  $H/ | grep -c "localhost:3000"             # must be 0
curl -s -X POST $H/api/payment/webhook              # {"error":"Invalid signature"} — 400, not 500
curl -s -o /dev/null -w '%{http_code}\n' \
     -X POST $H/api/payment/create-session          # 401 — auth precedes the config check
curl -s $H/robots.txt                               # must NOT allow indexing
```

**Then the only test that counts:** a production kiosk booking, paid, and `is_paid = true`.
Reaching PayMongo's checkout page and being *marked paid* are different milestones — that
distinction hid a broken webhook for months (kiosk B38).

> **Measured on the deployed hosts 2026-09-07** (re-run rather than recalled, so this line
> is evidence and not memory):
>
> | Probe | `booker.ezzy.ph` | `staging-booker.ezzy.ph` |
> |---|---|---|
> | CSP `connect-src` | `pdkejyjidrfxksaczvfy` ✅ **production** | `fbxbwnfeimzhgxpshdpa` ✅ staging |
> | `localhost:3000` in HTML | 0 ✅ | 0 ✅ |
> | unsigned webhook POST | `400 {"error":"Invalid signature"}` ✅ | `400` ✅ |
> | bare create-session POST | `400` (see correction below) | `400` |
> | `robots.txt` | `Disallow: /` ✅ | `Disallow: /` ✅ |
>
> **Staging is intact** — repointing production did not disturb it, which was the specific
> risk of editing env vars on a shared Vercel project.
>
> ⚠️ **Correction to this item's own text:** it predicted `401 — auth precedes the config
> check` for a bare create-session POST. That is wrong, and the probe above proves it — the
> route checks `bookingId` *before* auth, so an empty body returns **400**. A `401` would
> require a well-formed body. Left corrected rather than silently re-interpreted, because
> the wrong expectation would make a future run read a healthy host as broken.

> ⏳ **Still unmeasured:** the live payment itself. Every probe above tests *configuration*;
> none of them proves PayMongo will call the endpoint. That is kiosk **B34**.

---

### I3 — The dead "Reschedule" button is reachable by kiosk customers  ⏸ PARKED
**File:** `booker/components/dashboard/BookingDetailModal/BookingDetailModal.tsx:123`

A kiosk customer claiming their account to view a confirmed booking sees a prominent blue
**Reschedule** button with no handler. It does nothing.

**Parked, not ignored** — it is booker product work and this plan is deliberately the
minimum vendor needs. **Unblocks when** booker's own build-out starts.
⚠️ Worth a decision before the kiosk takes real customers: a dead primary button on a
customer's own booking is a support call. Hiding it is a one-line change if that trade is
not acceptable.

---

## DECISIONS
<!-- No item may execute while an OPEN line remains. -->

- **D1 — Which origin serves production booker?** → **(a) repoint `booker.ezzy.ph` at
  production, with ONE WEBHOOK PER ENVIRONMENT** (resolved 2026-09-06).

  | PayMongo mode | Webhook endpoint | Serves |
  |---|---|---|
  | **test** | `https://staging-booker.ezzy.ph/api/payment/webhook` | staging (`sk_test_`) |
  | **live** | `https://booker.ezzy.ph/api/payment/webhook` | production (`sk_live_`) |

  ✅ **This is supported and is the right shape.** The two never collide: a test-mode webhook
  receives events only from `sk_test_` payments and a live-mode one only from `sk_live_`, so
  each environment's traffic reaches exactly one endpoint. It is **not** the
  "two endpoints racing one transition" case that D4/B22 rejected — that was two webhooks in
  the *same* mode on the *same* account.

  ⚠️ **Both must be on the same PayMongo account as the corresponding
  `PAYMONGO_SECRET_KEY`** — per mode. Getting this wrong is invisible: no delivery, no log,
  payment still taken.

  - ~~**(a) original wording** — repoint `booker.ezzy.ph` at production.~~ It is the documented
    intent (`overview.md:89`: *"repoint at production when it is [launched]"*), it keeps one
    obvious name for the webhook URL, and staging keeps `staging-booker.ezzy.ph`, so nothing
    is lost. Note the host currently serves a **stale build** — repointing replaces it.
  - **(b) A separate production host,** leaving `booker.ezzy.ph` on staging. Avoids touching
    a working host, but leaves a production-named domain serving staging indefinitely — the
    exact ambiguity that already caused a live-mode webhook to be aimed at a staging
    database. Rejected unless there is a reason (a).

---

### Carried forward from the closed hardening plan — ⏸ PARKED
`.plans/2026-09-02-booker-payment-route-hardening.md` closed ✅ on 2026-09-06 with two
webhook items parked. They are recorded here so a closed plan does not bury them:

- **A2 — the webhook discloses configuration state.** An unsigned POST returns
  `500 {"error":"Webhook not configured"}` when the secret is unset, on a public
  unauthenticated endpoint. Only manifests in a misconfigured environment; the ordering
  cannot be swapped, since a signature cannot be verified without the secret.
- **A3 — no replay window.** The signature timestamp is parsed and never compared to now, so
  a captured valid webhook stays replayable. The handler is idempotent, so a replay re-asserts
  a state that is already true.

**Unblocks when** PayMongo test accounts exist — both need *verifying*, not just fixing.
⚠️ **A2 becomes more relevant once `booker.ezzy.ph` is production**, because the endpoint is
then public on a production domain rather than a staging one.

## Execution order

1. **D1** — resolve the origin. Nothing below can start without it.
2. **B2** — set production variables (all but `PAYMONGO_WEBHOOK_SECRET`, which does not
   exist yet).
3. **B1** — deploy booker to production; confirm `connect-src` names the production project.
4. **B3** — register the live webhook → copy the secret → set it → **redeploy**. Delete the
   stale live-mode webhook.
5. **B4** — set `PORTAL_URL_BOOKER` in production Command. **Only after step 3 confirms
   booker serves production.**
6. **I1 + I2** — data check and probes.
7. **Then, and only then:** the vendor kiosk build reaches production (kiosk **B23**/**B34**).

⚠️ **There is no feature flag on the kiosk.** It goes live the moment the vendor build
lands, so step 7 is the launch and its ordering is the only control over timing.

---

## Verification

| Check | Kind |
|---|---|
| booker production `connect-src` names `pdkejyjidrfxksaczvfy` | needs-live |
| no `localhost:3000` in served HTML | needs-live |
| unsigned webhook POST → 400, not 500 | needs-live |
| unauthenticated `create-session` → 401 | needs-live |
| `robots.txt` does not allow indexing | needs-live |
| set-password link from production Command lands on production booker | needs-live |
| **production kiosk booking paid → `is_paid = true`** | needs-live |

Nothing here is machine-verifiable from the repo. Every row needs the deployed environment.
