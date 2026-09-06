# Booker payment route — authenticate before anything else

**Date:** 2026-09-02
**App / scope:** `booker/app/api/payment/create-session/route.ts` — that one file.
**Cross-app note:** raised from `.plans/2026-08-26-vendor-kiosk-mode-and-offering-attachments.md`
**B20**, which fixed the identical defect in `vendor`. AGENTS.md gates cross-app work;
approval to open this as its own plan was given 2026-09-02.
**Status:** IN PROGRESS — **all four items proven on STAGING (B1, I1, I2 on 2026-09-04;
I3 on 2026-09-05).** Only A2 and A3 remain, both ⏸ pending PayMongo test accounts. No code
work outstanding.
Everything still open here waits on the **same** thing: **PayMongo test accounts**. That
is one regression check (a signed-in booking through to checkout) plus the two parked
webhook follow-ups, A2 and A3. Nothing is blocked on a decision.

> Booker's payment route runs its configuration check *before* it authenticates the
> caller. Put authentication first, and stop the handler crashing on a malformed body
> while we are in the same three lines.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are **plan-local** —
> the kiosk plan has its own B1, I1 and so on. Cross-plan references are qualified
> by app (e.g. "vendor B20").

---

## Scope

**In scope:** the ordering and input-guard defects in
`booker/app/api/payment/create-session/route.ts`, and — **added 2026-09-02 on approval** —
the constant-time signature comparison in `app/api/payment/webhook/route.ts` (I2).

**Explicitly out of scope:** anything about how the PayMongo session itself is built —
the amount derivation, the line items, the `payment_reference` write. Those are correct
and are the half of this route that vendor's kiosk route deliberately forked *unchanged*.
The rest of `app/api/payment/webhook/route.ts` stays out of scope and is recorded below
as A2–A3.

**Not a refactor.** Booker has no `lib/supabase/admin.ts` — the inline
`createClient(URL, SERVICE_ROLE_KEY)` at `:25-28` is this app's actual convention, not
drift. Introducing a helper to match vendor would be a cross-app style change nobody
asked for.

---

## What the investigation established

- **The defect is real and was confirmed live in the sibling app.** Vendor's route
  carried the same ordering, inherited from this one. A live probe there returned
  `500 {"error":"Payment not configured"}` to a completely unauthenticated POST.
- **Blast radius on the client is zero.** The only caller is
  `components/booking/BookingWizard/useBookingWizard.ts:197`. It checks `res.ok`, then
  `checkout_url`, and shows the same generic `"Payment setup failed. Please try again."`
  toast for every failure (`:203-215`). It never reads an error string and never branches
  on a status code. Reordering is invisible to it.
- **One thing vendor did that booker cannot.** Vendor's fix has the caller name the
  `vendorId`, so membership is checked with **no database read** and an unauthorised
  caller learns nothing about whether the booking id exists. Booker's ownership test *is*
  `booking.booker_id === user.id`, which cannot be evaluated without reading the booking.
  The 404/403 distinction therefore survives here — see DEFERRED, where it is argued to
  be acceptable rather than quietly ignored.

---

## BLOCKERS

### B1 — The configuration check runs before authentication  ✅ DONE (2026-09-02)
> **Executed:** the two `secretKey` lines moved below the `user` check. Nothing else
> moved; `secretKey` is not read until the PayMongo call.
>
> **Verified — live, and the first probe was NOT sufficient.** An unauthenticated POST
> returned `401 {"error":"Unauthorized"}` — but `PAYMONGO_SECRET_KEY` **is** set in
> booker's `.env.local`, so the *old* code would have passed its config check and
> returned 401 as well. That probe proved no regression, not the fix.
> The fix was then proven by re-running booker with `PAYMONGO_SECRET_KEY=` blank — the
> only state in which the defect manifests. An empty value is already present in
> `process.env`, so Next does not overwrite it from `.env.local`, and no file was edited.
> Unauthenticated POST in that state returned **`401 {"error":"Unauthorized"}`**, where
> the old ordering returns `500 {"error":"Payment not configured"}`.
>
> **Verified — machine:** `tsc --noEmit` clean, `eslint` clean on the file.
**File:** `booker/app/api/payment/create-session/route.ts:16-22`

```ts
const secretKey = process.env.PAYMONGO_SECRET_KEY
if (!secretKey) return NextResponse.json({ error: "Payment not configured" }, { status: 500 })

// 1. Authenticate the caller (cookie-aware, RLS-bound client)
const ssr = await createServerClient()
const { data: { user } } = await ssr.auth.getUser()
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
```

An anonymous POST reaches the environment check first. Where `PAYMONGO_SECRET_KEY` is
absent or empty, the response tells an unauthenticated caller a fact about the server's
configuration — that payments are not set up — before establishing they are entitled to
any answer at all.

> **Honest severity.** This grants **no privilege and no data**; it is information
> disclosure, and only in an environment that is misconfigured. It is filed as a blocker
> because it is a security *ordering* defect on a payment path, the fix is three lines,
> and the same defect was already accepted as a blocker in vendor (**vendor B20**) — not
> because an attacker can do anything with it today. Overstating it would be worse than
> leaving it.

**Fix approach:** move the two `secretKey` lines to *after* the `user` check. Nothing
else in the handler moves; `secretKey` is not read until `:48`.

**Component separation:** not applicable — route handler, no component.

**Verification:**
- *machine* — `tsc --noEmit`; `npm run lint` on the file.
- *needs-live* — POST to `/api/payment/create-session` **unauthenticated** and confirm
  `401 {"error":"Unauthorized"}` rather than a 500 about configuration. ⚠️ Send the body
  with `--data @file`, not an inline single-quoted string: in the vendor probe, shell
  quoting mangled the JSON and the resulting parse failure produced misleading statuses.
- *needs-live* — sign in and complete one booking to checkout, confirming the happy path
  is untouched.

---

## IMPORTANT

### I1 — `await req.json()` is unguarded, so a malformed body throws  ✅ DONE (2026-09-02)
> **Executed:** `.catch(() => ({}))`, matching vendor's fork. Shipped with B1 as planned.
> **Verified — live:** POST with the body `not json` now returns
> `400 {"error":"Missing bookingId"}` instead of a thrown 500. An empty `{}` body still
> returns the same 400, confirming the existing path is unchanged.
**File:** `booker/app/api/payment/create-session/route.ts:13`

```ts
const { bookingId } = (await req.json()) as { bookingId?: string }
```

A POST whose body is not valid JSON rejects inside the handler and becomes a 500 instead
of the `400 {"error":"Missing bookingId"}` the very next line is written to produce. It is
reachable without authentication, both before and after B1.

Vendor's forked route already guards this: `(await req.json().catch(() => ({})))`.

**Ships with B1** — same statement region, same file, one review. Splitting them would
mean touching these six lines twice.

**Fix approach:** `.catch(() => ({}))`, matching vendor.

**Verification:** *needs-live* — POST with the body `not json` and confirm a 400, not a
500. *machine* — `tsc --noEmit`.

### I2 — Webhook compares the HMAC with `===`, not in constant time  ✅ DONE (2026-09-02)
**File:** `booker/app/api/payment/webhook/route.ts:13` — was `return expected === envelope`.

A JS string comparison short-circuits at the first differing character, so how long it
takes depends on how much of the signature the caller guessed correctly.

> **Not oversold.** A remote timing attack on an HMAC over HTTP is not practical — network
> jitter is orders of magnitude larger than the signal. This is defence-in-depth and
> convention. It was done because it costs one line, not because anyone was getting in.

> **Executed:** `timingSafeEqual` on two `utf8` buffers with an explicit length guard.
> Two decisions inside that are easy to get wrong and are commented in the file:
> - **The hex STRINGS are compared, not their decoded bytes.** `Buffer.from(x, "hex")`
>   truncates silently at the first non-hex character rather than throwing, which would
>   quietly shorten a malformed envelope and change what is being compared.
> - **The length check is mandatory, not defensive noise** — `timingSafeEqual` *throws* on
>   unequal lengths, so without it a truncated signature becomes a 500. It leaks nothing:
>   a SHA-256 hex digest is always 64 characters.

> **Verified — live, in both directions.** Booker was run with a known
> `PAYMONGO_WEBHOOK_SECRET` injected via the environment (no file edited, no real secret
> read), and a non-paid event type was used so a passing signature short-circuits before
> any database access. **Seven cases, all correct:**
>
> | Case | Result |
> |---|---|
> | valid signature (`te` slot) | **200 `{"received":true}`** |
> | valid signature (`li` live slot) | **200 `{"received":true}`** |
> | wrong signature, correct length | 400 Invalid signature |
> | truncated signature (length gap) | 400 — **not a 500** |
> | overlong signature (length gap) | 400 — **not a 500** |
> | non-hex garbage | 400 — **not a 500** |
> | no signature header at all | 400 Invalid signature |
>
> The two acceptance rows are the ones that matter: a signature change that only ever
> rejects is a silent outage, not a fix. The three length-gap rows prove the guard.
>
> **Verified — machine:** `tsc --noEmit` clean, `eslint` clean.

---

### I3 — The return URL was read raw, so a missing var redirects to localhost  ✅ DONE (2026-09-04)
**File:** `booker/app/api/payment/create-session/route.ts`
🔗 **Cross-app; the kiosk plan's B33 is the other half** — the identical line existed in
`vendor`'s kiosk route and both were changed together, on the user's approval.

`const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"` fell back
silently. On a hosted deploy with the variable unset the **build still succeeded**, because
`resolveSiteUrl()` protects Open Graph metadata via `VERCEL_PROJECT_PRODUCTION_URL` — while
this line sent PayMongo a `success_url` on localhost. A customer pays and never comes back:
booking charged, page dead, nothing reporting a fault.

**Executed:** `resolveSiteUrl().origin`, wrapped so a failure returns a clean 500 with the
cause logged rather than throwing at a customer. `.origin` and not the URL object —
`String(new URL("https://x"))` is `"https://x/"`, which would yield `//`.

**Verified — machine:** `tsc` clean, `eslint` clean.
✅ **Verified live on STAGING 2026-09-05.** A customer booked through the **booker portal**
(not the kiosk — a separate route and a separate code path), paid, and **`is_paid` toggled
to true**. That exercises this item's `resolveSiteUrl()` derivation, and with it **B1**'s
auth ordering and **I1**'s body guard on the same route, none of which had ever been run by
a real booker payment.

**This also closes the plan's last outstanding regression check.** Both payment origins —
kiosk (`vendor`) and online (`booker`) — are now proven end to end against one shared
webhook, which is the design F4 asserted and nothing had ever measured.

---

## Staging verification — 2026-09-04

Booker deployed to `staging-booker.ezzy.ph` (staging Supabase `fbxbwnfeimzhgxpshdpa`), and
the PayMongo **test-mode** webhook registered against
`https://staging-booker.ezzy.ph/api/payment/webhook` with `checkout_session.payment.paid`.

**Three of this plan's four items are now verified on a HOSTED environment, not just local:**

| Item | Probe | Result |
|---|---|---|
| **B1** | unauthenticated POST to `create-session` | `401 {"error":"Unauthorized"}` — auth precedes the config check |
| **I1** | body `not json` | `400 {"error":"Missing bookingId"}` — old code returned 500 here, so this doubles as proof the new build is deployed |
| **I2** | 7 signature shapes: correct-length, truncated, overlong, non-hex, live (`li=`) slot, malformed header, empty | **all `400`, never `500`** — the truncated and overlong cases are the ones `timingSafeEqual` throws on without the length guard |

⚠️ **I3 is still NOT verified live.** `resolveSiteUrl()` demonstrably resolves correctly in
this deployment — the served HTML self-references `https://staging-booker.ezzy.ph` via
`metadataBase` — but the `create-session` code path that uses it sits behind auth, and the
401 probe never reaches it. It needs one signed-in booking taken through to checkout.

⚠️ **Getting the secret live took three attempts**, and the failure mode is worth recording:
`!secret` is true for an **empty string** as well as undefined, so a blank value, a
mis-scoped Vercel environment (Production vs Preview), or a redeploy that reused a cached
build all present identically as `500 {"error":"Webhook not configured"}`. The diagnostic
that isolated it: another variable (`NEXT_PUBLIC_APP_URL`) was demonstrably reaching the
same deployment, which ruled out "env does not flow here" and pointed at this one variable's
scope.

---

## Webhook follow-ups — ⏸ PARKED (2026-09-02)

**Parked, not dropped.** Both are webhook-behaviour changes, and neither can be
*exercised* without being able to drive a real PayMongo event end to end.

> **Unblock condition: PayMongo test accounts / credentials.** Until then any fix here
> could only be reasoned about, not proven — and the one webhook change already made (I2)
> was worth doing precisely because it *could* be proven, by injecting a known secret and
> computing the HMAC locally. A2 and A3 do not have that property: A2's behaviour depends
> on how a real unsigned caller is treated in a deployed environment, and A3 needs a
> genuine signed event to replay. Shipping either on reasoning alone would be the
> "verified by should-work" failure this plan's own status model exists to prevent.

(A1 was in this list until 2026-09-02, when it was approved, executed and proven live; it
is now **I2** above.)

### A2 — Webhook discloses configuration state  ⏸ PARKED (2026-09-02)
`webhook/route.ts:21` returns `500 {"error":"Webhook not configured"}` to any unsigned
POST when `PAYMONGO_WEBHOOK_SECRET` is missing. Same family as B1, but **the ordering
cannot be swapped** — a signature cannot be verified without the secret. The only
available fix is a less descriptive response. It manifests solely in an environment where
the secret is unset, and the caller is a machine, not a user.

### A3 — No replay window on the webhook  ⏸ PARKED (2026-09-02)
`webhook/route.ts:10` parses `timestamp` out of the signature header and never compares it
to the present. A captured, validly-signed webhook stays replayable indefinitely. The
handler's effect is to mark a booking paid, so a replay re-asserts a state that is already
true — the practical impact is close to nil.

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. -->
- **D1 — Does this plan cover `create-session` only?** → **Originally yes; widened to
  include the webhook's signature comparison (I2) on 2026-09-02** at the user's request.
  A2 and A3 were then **parked rather than declined** (2026-09-02) — they are wanted, they
  just cannot be verified until PayMongo test accounts exist. The request was specifically vendor B20's twin, which lives entirely in
  `create-session`. The webhook findings above are recorded as A1–A3 so they are not lost,
  and are deliberately left unplanned rather than folded in — a payment webhook is a
  different risk surface with a different caller, and bundling it would turn a three-line
  ordering fix into a security review of the whole payment path.

---

## DEFERRED / COSMETIC

- **The 404/403 booking-existence oracle** (`:37-38`). An authenticated caller gets `404`
  for a booking that does not exist and `403` for one belonging to someone else, which
  distinguishes the two. **Accepted:** booking ids are UUIDs, so enumeration is
  infeasible, and collapsing the responses would need booker's ownership check to stop
  reading the row — which it cannot, because ownership *is* a column on that row. This is
  the one part of vendor's fix that does not transfer, and it is recorded here so that
  asymmetry is deliberate rather than forgotten.

---

## Execution order

1. ~~**B1 + I1 together**~~ ✅ **executed 2026-09-02** — one edit, six lines.
2. ~~**I2**~~ ✅ **executed 2026-09-02**, approved after the fact as a one-line addition.
   Independent of B1/I1 — a different file, a different caller (PayMongo, not a browser).
3. **A2 + A3 together, once PayMongo test accounts exist** ⏸ — one webhook, one review.
   Not a decision any more; a waiting-on.

**Coupling:** none. This plan does not touch `vendor`, `command`, `backbone`, or the
shared schema, and nothing in the kiosk plan depends on it.

---

## Verification

| Check | Kind |
|---|---|
| `tsc --noEmit` clean | machine |
| `npm run lint` clean on the changed file | machine |
| Unauthenticated POST → `401`, not a 500 about configuration | **needs-live** |
| POST with a malformed body → `400`, not a 500 | **needs-live** |
| A signed-in booking still reaches PayMongo checkout | **needs-live — ⏸ waiting on PayMongo test accounts** |

**Run 2026-09-02:** booker started on :3200, four probes. `tsc` and `eslint` clean;
unauthenticated POST → 401 (and → 401 again with the key blanked, which is the actual
proof); malformed body → 400; empty body → 400 unchanged. The dev server was stopped
afterwards and port 3200 confirmed clear.

⚠️ **The happy path is the one thing still unchecked** — it needs a signed-in booker
account, which this session does not have. The risk is low (two lines moved, nothing
between them reads `secretKey`) but low is not verified, so it stays ⬜.
