# Legal Links & Policy Consent Across the Web Portals

**Date:** 2026-08-19
**App / scope:** `vendor`, `booker`, `command` (web only) + `backbone` (one migration)
**Status:** COMPLETE (2026-08-19) — B1–B7, I1–I4 and I6 shipped. I5 remains open (pre-existing, one-line, awaiting the user's call).

> Every web portal currently ships with **zero** references to Ezzy's legal
> documents, and no signup or KYC flow asks the user to agree to anything. This
> plan puts links to the canonical pages on `ezzy.ph` into the app shell and the
> login screens, and turns "agree to the policies" into an enforced, **recorded**
> gate — client, server, and database — on the two flows that create accounts.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

---

## Investigation findings (verified 2026-08-19)

Grep for `privacy|terms|legal|cookie` across `vendor/`, `booker/`, `command/`
returns only unrelated matches (cookie-auth comments in API routes). Confirmed:

| Finding | Evidence |
|---|---|
| No legal link exists in any app | grep, all three trees |
| No consent checkbox in booker signup | `booker/components/auth/LoginPage/LoginPage.tsx:240-262` |
| No consent in vendor registration / KYC | `vendor/components/auth/LoginPage/LoginPage.tsx:436-470` (step 6 "Review & submit") |
| `command` has **no self-signup** — views are `login`/`forgot`/`sent`/`reset` only | `command/components/auth/LoginPage/LoginPage.tsx:131-218` |
| No consent column anywhere in the schema | grep `consent\|terms_accepted\|agreed` over `backbone/supabase/migrations/` |
| Both signup paths create the auth user **server-side with the service role** | `booker/app/api/register/route.ts:47`, `vendor/app/api/auth/register/route.ts:162` |
| Vendor route already has a `rollback()` helper used at every failure step | `vendor/app/api/auth/register/route.ts:181,195,201,215,219` |
| Booker route rolls back with `auth.admin.deleteUser(uid)` | `booker/app/api/register/route.ts:70,76,84` |
| No analytics/tracking scripts in any app | grep `gtag\|analytics\|posthog\|mixpanel\|hotjar` — clean |
| Sidebar footers already end in a Radix account popover | vendor `Sidebar.tsx:106`, booker `Sidebar.tsx:79`, command `Sidebar.tsx:66` |

### Canonical URLs (HTTP-verified, 2026-08-19)

| Label | URL | Status |
|---|---|---|
| Terms of Use | `https://ezzy.ph/terms-use/` | 200 (note: `/terms-use` **without** the trailing slash 301-redirects; `/terms-of-use/` is a 404) |
| Privacy Policy | `https://ezzy.ph/privacy-policy/` | 200 |
| Cookie Policy | `https://ezzy.ph/cookie-policy/` | 200 |
| Acceptable Use Policy | `https://ezzy.ph/acceptable-use-policy/` | 200 |
| Refund & Cancellation Policy | `https://ezzy.ph/refund-cancellation-policy/` | 200 |
| About Us | `https://ezzy.ph/about/` | 200 |

Linking out to `ezzy.ph` (rather than copying the text into the apps) is the
right call and needs no caveat: one canonical copy, no drift, no re-deploy when
Legal edits a clause. CSP is not a factor — a CSP restricts fetches and frames,
not top-level navigation from an `<a href>`.

---

## BLOCKERS

### B1 — No single source for the legal URLs  ✅ DONE
**Files (new):** `vendor/lib/legal.ts`, `booker/lib/legal.ts`, `command/lib/legal.ts`

Hard-coding six URLs at five call sites per app guarantees drift the first time
Legal renames a page. One typed module per app, **copied not shared** — these are
three independent repos and `booker/lib/constants.ts:12` already documents
"copied, not shared, per the cross-app convention" as the house rule.

```ts
export const LEGAL_VERSION = "2026-08-19"   // bump to force re-consent later

export const LEGAL_LINKS = [
  { key: "terms",      label: "Terms of Use",                 href: "https://ezzy.ph/terms-use/" },
  { key: "privacy",    label: "Privacy Policy",               href: "https://ezzy.ph/privacy-policy/" },
  { key: "acceptable", label: "Acceptable Use Policy",        href: "https://ezzy.ph/acceptable-use-policy/" },
  { key: "cookies",    label: "Cookie Policy",                href: "https://ezzy.ph/cookie-policy/" },
  { key: "refunds",    label: "Refund & Cancellation Policy", href: "https://ezzy.ph/refund-cancellation-policy/" },
  { key: "about",      label: "About Ezzy",                   href: "https://ezzy.ph/about/" },
] as const

// Which documents each flow requires agreement to (B4/B5) — the rest are
// informational. Cookie Policy is disclosed, not "agreed to", and About is not a
// legal document at all.
export const BOOKER_CONSENT_KEYS = ["terms", "privacy", "acceptable"] as const
export const VENDOR_CONSENT_KEYS = ["terms", "privacy", "acceptable", "refunds"] as const
```

Also carries the hand-written row interface for B6 (per `AGENTS.md`, this repo
hand-writes interfaces — no `supabase gen types`). It lives here rather than in a
service because **no app reads the table yet**; it moves into a service the day
`command` grows a reader.

**Fix approach:** add the module to each app; every later item imports from it.
Trailing slashes are deliberate — they avoid a 301 hop on every click.

✅ **DONE (2026-08-19)** — created `booker/lib/legal.ts`, `vendor/lib/legal.ts`,
`command/lib/legal.ts`. Verified: `npx tsc --noEmit` clean in all three apps; all
six URLs re-curled → 200; the `href` set is byte-identical across the three copies
(md5 of the extracted `href:` lines matches).

**Three deviations from the item as written, each deliberate:**

1. **`ABOUT_LINK` is exported separately from `LEGAL_LINKS`**, not as a sixth
   element. About Ezzy is a marketing page, never a consent target, and B3 renders
   it below a divider — so the alternative was every consumer slicing a magic
   index off the end of the array. `ALL_LEGAL_LINKS` is exported for the B2 footer,
   which does want all six in order.
2. **The consent set is named `CONSENT_KEYS` in each app**, not
   `BOOKER_CONSENT_KEYS` / `VENDOR_CONSENT_KEYS` in both. These are separate repos
   with separate copies; an app carrying the *other* app's key set would have been
   dead code, and the app-prefixed name only made sense under the single-array
   framing the plan sketched. Booker's set is `terms, privacy, acceptable`;
   vendor's adds `refunds` (documented in-file: the refund policy binds the vendor
   as the party who honours a cancellation, so the vendor agrees to it while the
   booker is only shown it at checkout — I1).
3. **`command/lib/legal.ts` is deliberately smaller** — links only, no
   `LEGAL_VERSION`, no `CONSENT_KEYS`, no acceptance row type. Per D-4 command has
   no self-registration, so those exports would have been unreachable code. The
   file says so at the top, so the asymmetry does not read as an omission.

Also added: `legalLink(key)` throws on an unknown key rather than returning
`undefined`. A consent sentence rendering without its link is a legal defect, not a
cosmetic one, and should fail loudly in dev rather than ship silently.

---

### B2 — Login screens carry no legal footer  ✅ DONE
**Files:**
- `vendor/components/auth/LoginPage/LoginPage.tsx:491` (end of `styles.rightInner`)
- `booker/components/auth/LoginPage/LoginPage.tsx:264` (end of `styles.rightInner`)
- `command/components/auth/LoginPage/LoginPage.tsx` (end of `styles.rightInner`)

The login screen is the one page an unauthenticated user always sees, and in all
three apps every view (`login` / `register` / `forgot` / `sent` / `reset`) is
rendered inside a single `rightInner` wrapper. **One** footer placed at the close
of that wrapper therefore covers every view without touching any of them.

**New component (per app):** `components/ui/LegalLinks/LegalLinks.tsx` +
`LegalLinks.module.css` — a wrapped row of `·`-separated small links.

**Component-separation compliance:** pure display — no `useState`, no
`useEffect`, no handlers, no inline `style={{}}`. Per
`.claude/skills/component-separation/SKILL.md` this is the documented exception,
so **no `useLegalLinks.ts` is created**. All styling lives in the co-located
`.module.css`, matching how `LoginPage` in all three apps already styles itself.

**Accessibility / security:** every link gets `target="_blank"` +
`rel="noopener noreferrer"`, and the container is a `<nav aria-label="Legal">`.

✅ **DONE (2026-08-19)** — `components/ui/LegalLinks/{LegalLinks.tsx,LegalLinks.module.css}`
in all three apps, wired at the close of `rightInner` in each `LoginPage.tsx`.
Verified: `tsc --noEmit` + `npm run build` clean ×3; the insert sits **outside**
each app's `mobileView` gate, confirmed by reading the rendered tail, so it shows
on the info pane as well as the form. Still needs a browser check (B2 row below).

**Deviation:** links render `short` labels ("Terms", "Privacy", "Acceptable Use",
"Cookies", "Refunds", "About"), a field added to `LegalLink` in all three copies
of `lib/legal.ts`. The full names overflow the 252px panel to five lines. The
sidebar menu (B3) and consent sentences (B4/B5) keep the full `label`.

**Contrast note:** the footer sits at `rgba(255,255,255,0.72)` (~9.4:1), not the
`0.30–0.35` the neighbouring smallprint uses. That existing smallprint measures
~2.5:1 and fails WCAG AA — it is pre-existing and untouched, recorded as **I5**.

---

### B3 — Signed-in shell has no route to the legal pages  ✅ DONE
**Files:**
- `vendor/components/layout/Sidebar/Sidebar.tsx:105` (the `border-t` footer block)
- `booker/components/layout/Sidebar/Sidebar.tsx:78` (same)
- `command/components/layout/Sidebar/Sidebar.tsx:65` (`styles.footer`)

**Resolved D-3 (2026-08-19): the popover.** Six links laid flat would not fit a
224px (`w-56`) rail. A single **"About & Legal"** trigger sits at the bottom of
the sidebar, directly *above* the existing account block, opening a Radix
`Popover` (`side="top"`) listing the six links, with About Ezzy separated by a
divider. All three sidebars already import Radix Popover/DropdownMenu for the
account menu, so this introduces no new dependency and no approval gate.

```
┌──────────────────────────┐        on click, opens upward:
│  Vendor Menu             │        ┌────────────────────────┐
│   Overview …             │        │ Terms of Use         ↗ │
├──────────────────────────┤        │ Privacy Policy       ↗ │
│  ⓘ  About & Legal     ▲  │ ← new  │ Acceptable Use       ↗ │
├──────────────────────────┤        │ Cookie Policy        ↗ │
│  (A) Admin Account       │        │ Refund & Cancel.     ↗ │
│      you@example.com  ▲  │        ├────────────────────────┤
└──────────────────────────┘        │ About Ezzy           ↗ │
                                    └────────────────────────┘
```

Because the sidebar is the mobile drawer as well as the desktop rail, this one
placement covers both breakpoints — the `TabBar` (max 5 tabs, and vendor's
`TabBar.tsx:11-14` explicitly documents that a sixth overflows a 390px viewport)
is deliberately left alone.

**New component (per app):** `components/layout/LegalMenu/LegalMenu.tsx` +
`LegalMenu.module.css`.

**Component-separation compliance:** open/closed state is owned by Radix's
uncontrolled `Popover.Root`, not by our code — so the file has no `useState`,
no `useEffect` and no handlers, and again qualifies as a pure display component
with **no companion hook**. Styling is entirely in the co-located `.module.css`.

**Note on `command`:** the sidebar there is CSS-module-styled already, so this
matches; `vendor`/`booker` sidebars are Tailwind-inline, but a self-contained
`LegalMenu.module.css` keeps the new component consistent across all three
rather than forking its styling three ways.

✅ **DONE (2026-08-19)** — `components/layout/LegalMenu/{LegalMenu.tsx,LegalMenu.module.css}`
in all three apps, inserted as its own `border-t` row above the account block in
each `Sidebar.tsx`; `command` also gained a `.legalRow` class in
`Sidebar.module.css`. Verified: `tsc --noEmit` + `npm run build` clean ×3.
Popover placement, upward opening and both themes still need a browser.

---

### B4 — Booker signup creates an account with no agreement  ✅ DONE
**Files:**
- `booker/components/auth/LoginPage/LoginPage.tsx:254` (Create Account button)
- `booker/components/auth/LoginPage/useLoginPage.ts:114-137` (`handleRegister`)
- `booker/app/api/register/route.ts:16-25,47` (validation → `createUser`)

A checkbox that only disables a button is decoration — anyone can POST straight
to `/api/register`. The gate has to exist on **both** sides.

**Fix approach:**
1. **New component** `booker/components/ui/LegalConsent/LegalConsent.tsx` +
   `.module.css` — a real `<input type="checkbox">` with the agreement sentence
   and inline links to Terms of Use / Privacy Policy / Acceptable Use
   (`BOOKER_CONSENT_KEYS`).
   *Component-separation:* fully controlled (`checked` + `onChange` props), state
   lives in `useLoginPage`, so the `.tsx` holds no state/effects → pure display,
   **no hook file**. The links sit **outside** the `<label>` element and are tied
   to the checkbox via `aria-describedby`, so clicking a link opens it instead of
   silently toggling the box.
2. `useLoginPage.ts` — add `acceptedLegal` state; `handleRegister` refuses with
   "Please accept the Terms of Use and Privacy Policy to continue." and sends
   `acceptedLegal: true, legalVersion: LEGAL_VERSION` in the POST body.
3. `route.ts` — validate `acceptedLegal === true` and that `legalVersion` is a
   non-empty string, alongside the existing field checks at `:16-25`, and 400
   without them. **No user is created** if either is missing.

**Coupling:** the persistence half is **B6** — the gate is live now and the record
follows once the migration is applied.

✅ **GATE DONE (2026-08-19)** — `LegalConsent` component; `useLoginPage.ts`
`acceptedLegal` state + guard; `services/auth.service.ts` payload widened;
`app/api/register/route.ts` rejects a missing/false flag or blank version before
`createUser`. Verified: `tsc --noEmit` + `npm run build` clean; the route's
rejection ordering read back in the diff (gate precedes every write).
⬜ **RECORD PENDING** — the `legal_acceptances` insert is deferred to B6's writers.

---

### B5 — Vendor registration/KYC submits with no agreement  ✅ DONE
**Files:**
- `vendor/components/auth/LoginPage/LoginPage.tsx:458-469` (step 6 "Review & submit")
- `vendor/components/auth/LoginPage/useLoginPage.ts:466-517` (`handleSubmitKyc`)
- `vendor/app/api/auth/register/route.ts:62-71,162` (body parse → `createUser`)

Vendor registration is a 6-step flow (`LoginPage.tsx:16-23`) in which the account
is created **only at step 6**, atomically with the vendor row and KYC documents.
Step 6 is therefore the correct and only place for the agreement — it is the
"final submission" the request names, and it is where the merchant relationship
is actually formed.

**Fix approach:**
1. Reuse the same `LegalConsent` component shape as B4 (its own copy under
   `vendor/components/ui/LegalConsent/`), rendered between the review summary
   (`LoginPage.tsx:458` `reviewNote`) and the button row at `:462`. Vendor copy
   additionally names the **Refund & Cancellation Policy** (`VENDOR_CONSENT_KEYS`),
   since vendors are the party those refund obligations bind.
2. `useLoginPage.ts` — `acceptedLegal` state, checked in `handleSubmitKyc`
   alongside the existing document/photo guards at `:467-474`.
   **Deliberately not written to the KYC localStorage draft** — it is re-affirmed
   each session, exactly as `useLoginPage.ts:141-143` already does for the
   password. A stale checkbox restored from a month-old draft is not consent.
3. `route.ts` — validate `acceptedLegal === true` + `legalVersion` in the
   body-validation block at `:62-71`, before `createUser` at `:162`.

**Coupling:** persistence half is **B6**.

✅ **GATE DONE (2026-08-19)** — `LegalConsent` at step 6 between the review note
and the button row; `useLoginPage.ts` `acceptedLegal` state (not persisted to the
KYC draft, and cleared on both discard and successful submit); `SubmitKycParams`
widened and the flags added to the `fields` payload; `app/api/auth/register/route.ts`
rejects before `createUser`. Verified: `tsc --noEmit` + `npm run build` clean.
⬜ **RECORD PENDING** — deferred to B6's writers.

**Note:** the gate is enforced at `/api/auth/register` (the account-creating hop),
not at `/api/auth/register/prepare`. A scripted caller can therefore still stage
file uploads before being refused — those are swept server-side and no account,
vendor or KYC row is created. Called out so the choice is visible rather than
assumed.

---

### B6 — Acceptance leaves no retrievable proof  ✅ DONE
**Files:** new `backbone/supabase/migrations/20260819000001_legal_acceptances.sql`;
writers at `booker/app/api/register/route.ts` and `vendor/app/api/auth/register/route.ts`

**Resolved D-1 (2026-08-19): dedicated table.** A gate that leaves no record
cannot be evidenced later. `auth.users.app_metadata` was considered and rejected:
it is a single mutable blob (no history), unreachable from `supabase.from()`
because the `auth` schema is not exposed to PostgREST, it rides in every JWT, and
it is destroyed with the account — which is exactly the case where the evidence
matters most.

#### Exact migration (to be written **only** after approval; the user applies it)

```sql
-- ── Legal acceptances — append-only consent record ───────────────────────────
create table public.legal_acceptances (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users (id) on delete set null,
  email        text        not null,          -- snapshot: survives account deletion
  source       text        not null,
  document_key text        not null,          -- terms | privacy | acceptable | refunds
  document_ver text        not null,          -- LEGAL_VERSION at time of acceptance
  document_url text        not null,          -- exact URL shown to the user
  accepted_at  timestamptz not null default now(),
  ip_address   inet,
  user_agent   text,
  constraint legal_acceptances_source_check
    check (source in ('booker_signup', 'vendor_registration')),
  constraint legal_acceptances_document_key_check
    check (document_key in ('terms', 'privacy', 'acceptable', 'refunds', 'cookies'))
);

create index legal_acceptances_user_id_idx on public.legal_acceptances (user_id);
create index legal_acceptances_email_idx   on public.legal_acceptances (email);

alter table public.legal_acceptances enable row level security;

-- Read own rows. `(select auth.uid())` — initplan form, evaluated once per query
-- rather than once per row.
create policy "own acceptances readable"
  on public.legal_acceptances for select to authenticated
  using (user_id = (select auth.uid()));

-- Command admin/root may read every row (for the future proof-lookup screen).
create policy "privileged users read all acceptances"
  on public.legal_acceptances for select to authenticated
  using (public.is_privileged_user((select auth.uid())));

-- No INSERT/UPDATE/DELETE policy for `authenticated` at all: the record is
-- append-only and written exclusively by the service-role register routes.
-- service_role bypasses RLS.

-- Table grants — RLS alone is not enough; PostgREST checks privileges first.
-- Mirrors the append-only precedent set by `vendor_status_log`
-- (20260620000001_api_role_grants.sql).
grant select on public.legal_acceptances to authenticated;
-- anon: nothing (no policy references anon).
-- service_role already holds full DML from the blanket grant in 20260620000001.

comment on table public.legal_acceptances is
  'Append-only proof of policy acceptance. One row per document agreed to. Written only by the service-role registration routes; never updated or deleted.';
```

#### Blast radius

- **Data** — new empty table. Validates and rewrites nothing; no existing row is
  touched, so nothing can fail on apply.
- **Lock / performance** — `create table` on a new relation takes only its own
  `ACCESS EXCLUSIVE` lock; nothing else references it. Sub-millisecond, no
  blocking of live traffic. The two indexes build on an empty table.
- **Downstream** — no type regen (this repo hand-writes interfaces); the row
  interface goes in `lib/legal.ts` per B1. `service_role`'s blanket grant from
  `20260620000001` covers writes, so only the `authenticated` `select` grant is
  new. Nothing reads the table yet, so no app breaks if it were absent.
- **Reversibility** — `drop table public.legal_acceptances;` (policies, indexes,
  and grants drop with it). Losing the accumulated rows is the only cost.
- **Retention note** — `on delete set null` is deliberate: deleting a user
  preserves the acceptance record via the `email` snapshot. That is a retained
  personal-data record and should be justified under the PH Data Privacy Act as
  necessary for establishing/defending a legal claim. Flagging so it is a
  decision made on purpose, not by accident.

#### Writer changes

Rows are written **per document** — 3 for a booker signup, 4 for a vendor
registration — capturing `document_url` and `document_ver` as actually shown, plus
the request's `x-forwarded-for` IP and `user-agent`.

- **booker** `route.ts` — insert after `user_portals`/`user_roles` succeed
  (`:78-82`), before the notification block. On failure use the existing
  `deleteUser(uid)` rollback so no half-registered account survives.
- **vendor** `route.ts` — insert immediately after the `vendor_kyc` header at
  `:220`, using the existing `await rollback(); return err(...)` pattern that
  every other step already follows.
- **Both rollbacks** additionally `delete from legal_acceptances where user_id = …`
  before removing the auth user — otherwise `on delete set null` would leave
  orphaned rows behind every *failed* registration, polluting the evidence set
  with people who never actually got an account.

#### Later proof, one query

```sql
select email, document_key, document_ver, accepted_at, ip_address
  from public.legal_acceptances
 where user_id = $1
 order by accepted_at;
```

✅ **DONE (2026-08-19)** — migration written to
`backbone/supabase/migrations/20260819000001_legal_acceptances.sql`, matching the
SQL above. **Not applied** — the user applies migrations, always.
✅ **Writers done (2026-08-19)** — new `lib/legalAcceptance.ts` in booker and vendor
(`buildAcceptanceRows`, IP parsed with `node:net`'s `isIP` so a malformed
`x-forwarded-for` cannot fail a registration), called from both register routes.

**Deviation from the plan's placement, deliberate:** the plan put vendor's insert
"immediately after the `vendor_kyc` header at `:220`". That is wrong — the storage
move and `vendor_kyc_documents` insert come *after* it and can still `rollback()`,
and since `user_id` is `on delete set null` the consent row would have survived as
a null-user row claiming a vendor consented when no vendor was ever created. Both
routes now insert **last**, after every step that can roll back and before the
best-effort notification block. This also removed the planned delete-on-rollback
cleanup entirely — nothing can strand a row — which is why B7's grant is
SELECT + INSERT with no DELETE.

---

### B7 — `service_role` cannot INSERT into `legal_acceptances`  ✅ DONE
**File (new):** `backbone/supabase/migrations/20260819000002_legal_acceptances_service_role_grant.sql`

**Discovered during execution, 2026-08-19 — B6's own blast-radius note was wrong.**
It claimed "service_role already holds full DML from the blanket grant in
20260620000001". That grant is `grant … ON ALL TABLES …`, which binds only tables
existing when it ran; new tables inherit nothing, and `20260620000001` sets no
`alter default privileges … grant … to service_role`. Confirmed against the local
database after the user applied `20260819000001`:

```
grantee       | privileges
--------------+-----------------------------
authenticated | SELECT
service_role  | REFERENCES,TRIGGER,TRUNCATE   ← no INSERT
```

**This was avoidable, and the rule was already written down.** `AGENTS.md`
(Invariants) says: *"Every new table must include explicit table-level `GRANT`s for
the API roles in its migration … `service_role` full DML."* B6 asserted the blanket
grant covered it instead of following that invariant — the plan's own blast-radius
section was where the error entered, and it survived plan review. `20260816000002`
is the same omission on `vendor_account_completion`, so this is the second
occurrence; `20260815000001_vendor_payout_methods` is the pattern that gets it right.

**Proven live, not theorised.** Against the local DB with only `…0001` applied, a
valid booker signup returned `HTTP 500 "Could not record your agreement to the
policies."` and wrote zero rows. The rollback path behaved correctly — `0` auth
users and `0` profiles left behind — so the failure is safe, but every signup and
every vendor registration fails until the grant lands.

**Fix approach:** apply `20260819000002` (SELECT + INSERT only — no UPDATE/DELETE,
so append-only stays structural).

✅ **DONE (2026-08-19)** — applied by the user; ledger shows `20260819000002` and the
grants now read `service_role: INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE` /
`authenticated: SELECT` / `anon: none`. The signup that failed 500 before the grant
now returns 200 and writes its rows.

<!-- on completion: ✅ DONE (YYYY-MM-DD) -->

---

## IMPORTANT

### I1 — Booking checkout never references the refund policy  ✅ DONE
**File:** `booker/components/booking/steps/Step6Confirm/Step6Confirm.tsx:44` (below the Total row)

**Resolved D-2 (2026-08-19): notice line, no checkbox.** The booker agrees to the
Terms at signup, but the moment money is committed is the moment the Refund &
Cancellation Policy becomes material, and standard practice for a paid checkout is
to surface it at the point of payment. A one-line notice under the Total —
"By confirming, you agree to the Refund & Cancellation Policy." with an inline
link. A second checkbox would add friction without adding legal weight.

*Component-separation:* `Step6Confirm.tsx` is already a props-only display
component (51 lines, no state) — this adds one styled line and keeps it that way.

<!-- on completion: ✅ DONE (YYYY-MM-DD) -->

---

### I2 — KYC resubmit path needs no second consent  ✅ DONE
**File:** `vendor/components/kyc/KycStatusPage/KycStatusPage.tsx:124-135` (`handleResubmit`)

A rejected vendor resubmitting documents already has an account, and therefore
already accepted at B5 with a row in `legal_acceptances`. **No new gate here** —
this item exists so the decision is recorded rather than silently overlooked. The
only change is that the sidebar legal menu (B3) is reachable from this screen like
anywhere else in the shell.

<!-- on completion: ✅ DONE (YYYY-MM-DD) — verify no consent prompt was added -->

---

### I3 — Documentation is silent on any of this  ✅ DONE
**Files:** `architecture/portals.md` (`#### Navigation` at :49, vendor `#### Layout`
at :315, command `#### Branding, PWA and navigation` at :413);
`architecture/schema.md` (new `legal_acceptances` table);
`architecture/vendor-kyc.md` (the step-6 consent gate)

Add a short "Legal & policy links" note per portal recording the placement and the
fact that content is hosted on `ezzy.ph`, not in-repo, plus the new table in the
schema doc. Per `AGENTS.md` the architecture docs are the shared source of truth
and must not lag the code.

<!-- on completion: ✅ DONE (YYYY-MM-DD) -->

---

### I4 — New components are absent from the UI gallery  ✅ DONE
**Files:** `vendor/app/ui-gallery/page.tsx`, `booker/app/ui-gallery/page.tsx`, `command/app/ui-gallery/page.tsx`

The `/ui-gallery` fixture backs the Playwright visual baselines
(`vendor/visual-tests/`, `booker/visual-tests/`). Adding `LegalLinks`,
`LegalMenu` and `LegalConsent` entries keeps the new surface under the same
light/dark visual check as everything else. Baselines need regenerating for the
login and sidebar shots, which now carry an extra row.

<!-- on completion: ✅ DONE (YYYY-MM-DD) -->

---

### I5 — Pre-existing: booker's account dropdown has no background  ⬜ TODO
**File:** `booker/components/layout/Sidebar/Sidebar.tsx:89`

Found while building B3, **not caused by it**. The account popover is styled
`bg-[var(--db-card)]`, but `booker/app/globals.css` defines `--db-card-bg` — there
is no `--db-card`. The variable resolves to nothing, so that dropdown renders with
a transparent background over whatever is behind it, in both themes.

Left unfixed on purpose: `AGENTS.md` says to surface unrelated problems rather than
fix them silently, and this is a one-word change in a line the current task has no
reason to touch. The new `LegalMenu` popover next to it uses the correct
`--db-card-bg`, so after B3 the two adjacent popovers will look different until
this is fixed.

**Fix approach:** `bg-[var(--db-card)]` → `bg-[var(--db-card-bg)]`. Say the word
and it goes in with the next stage.

---

### I6 — Pre-existing: login smallprint fails WCAG AA contrast  ✅ DONE
**Files:** `booker/…/LoginPage.module.css:92,109`, `vendor/…/LoginPage.module.css:191` and siblings

Also found during B2. The "New to Ezzy? / Already have an account?" smallprint sits
at `rgba(255,255,255,0.30–0.35)` on the dark panel — roughly **2.5:1**, against a
4.5:1 requirement. The new legal footer deliberately does **not** copy it (it uses
0.72, ~9.4:1), which is why the two now look different.

Originally deferred as a visual decision rather than a bug fix. **User asked for it
on 2026-08-19; fixed.**

**The logged severity was understated.** "Two lines" was wrong — measuring properly
found **63** failing `color:` declarations across the three stylesheets, plus the
error text.

**Ground correction:** the earlier 2.5:1 figure was computed against the middle
gradient stop. The honest worst case is the *lightest* stop (`#0d1b4b` + the shell's
0.025 white overlay), which is reachable behind the panel on a narrow viewport. On
that ground the minimum alpha for 4.5:1 is **0.473**, and the dimmest text in use was
0.30 → **2.63:1**.

**Fix:** the existing 0.30–0.70 alpha band remapped monotonically onto 0.52–0.82, so
relative hierarchy and spacing survive and every tier clears 4.5:1 with headroom:

| was | now | contrast |
|---|---|---|
| 0.30 | 0.52 | 5.2:1 |
| 0.35 | 0.54 | 5.5:1 |
| 0.38 | 0.57 | 5.9:1 |
| 0.40 | 0.58 | 6.1:1 |
| 0.45 | 0.62 | 6.7:1 |
| 0.50 | 0.66 | 7.3:1 |
| 0.60 | 0.74 | 8.9:1 |
| 0.65 | 0.78 | 9.9:1 |
| 0.70 | 0.82 | 10.7:1 |

**Also fixed — not in the original finding:** `.error` was `#ef4444` at **4.10:1**.
Error copy is the last text that should be hard to read. Now `#f87171` (red-400),
**5.58:1**, still unmistakably an error colour.

**Scope discipline:** only `color:` declarations were touched. Backgrounds, borders
and shadows are decorative and carry no 4.5:1 duty — proved mechanically by
extracting every `background`/`border`/`box-shadow`/`outline` declaration before and
after and asserting the sets are identical (105 / 76 / 59 declarations checked).

**Follow-on:** the contrast comments in the new `LegalLinks`/`LegalConsent`
stylesheets quoted figures computed against the middle stop (9.4:1, ~10:1). Corrected
to the worst-case ground (8.6:1, 9.9:1) so the numbers in the code are the honest
ones, and `LegalLinks`' aria-hidden separator went 0.45 → 0.55.

✅ **DONE (2026-08-19)** — verified: a contrast pass over all six stylesheets reports
**zero** text colours below 4.5:1; decorative-declaration sets provably unchanged;
`npm run build` clean ×3. **Not verified:** how the lifted smallprint actually looks
— this is a deliberate visual change to all three login screens and wants an eye.

---

## DECISIONS
<!-- No item in this plan may execute while any OPEN: line below remains. None remain. -->

- **D-1 — How is acceptance recorded?** → **Dedicated `public.legal_acceptances`
  table** (resolved 2026-08-19) — `app_metadata` would have avoided a migration
  but cannot serve as retrievable proof: no history, not queryable via PostgREST,
  bloats every JWT, and dies with the account. Detailed in **B6**.
- **D-2 — Refund policy at booking checkout?** → **Notice line, no checkbox**
  (resolved 2026-08-19) — consent already taken at signup; a second gate adds
  friction, not legal weight. Detailed in **I1**.
- **D-3 — Sidebar presentation?** → **"About & Legal" popover above the account
  block** (resolved 2026-08-19) — fits the 224px rail and reuses the Radix pattern
  already present in all three sidebars. Detailed in **B3**.
- **D-4 — `command` gets links only, no consent gate** → **Resolved by
  investigation, not a user choice** — `command` has no self-registration
  (`LoginPage.tsx:131-218`); its users are provisioned by admins, so a consent
  checkbox has no flow to attach to. Recorded so it is not mistaken for an omission.

---

## DEFERRED / COSMETIC

- **No cookie-consent banner.** Verified there is no analytics, tag manager, or
  advertising script in any of the three apps — the only cookies set are
  Supabase's strictly-necessary auth cookies. Linking the Cookie Policy is
  sufficient; a banner would be theatre. Revisit the day any tracker is added.
- **No consent-lookup screen in `command`.** The table is written now and
  queryable by admin/root through RLS, but no UI reads it. Build it when someone
  actually needs to run the lookup; the data will be there waiting.
- **Mobile apps (`ezzy-booker-mobile`, `ezzy-vendor-mobile`) are out of scope**
  — the request named the web apps. Flagging it anyway because it is not
  cosmetic: **both App Store and Google Play require a reachable privacy-policy
  link inside the app**, and `.claude/skills/mobile-dev/SKILL.md` governs that
  work. `ezzy-vendor-mobile` is already running on Android, so this should be its
  own plan before the next store submission.
- **Nothing enforces the explicit-grant invariant.** `AGENTS.md` requires every new
  table's migration to grant the API roles explicitly, and this plan broke that rule
  anyway (B7) — as `20260816000001` did before it. A written rule that has now failed
  twice wants a mechanical check (a migration-lint, or a test asserting every table in
  `public` grants `service_role`), not a third reminder. Out of scope here; worth its
  own small plan.
- **Re-consent on version bump.** `LEGAL_VERSION` (B1) and `document_ver` (B6)
  exist so a future policy change *can* force re-acceptance, but no re-prompt flow
  is built now — nothing compares a stored version against the current one yet.
- **Footer on in-app content pages.** Legal links live in the shell chrome and on
  login only; no per-page footer is added.

---

## Execution order

1. ✅ **B1** — the legal module in all three apps. Independent, zero risk, unblocks
   everything below. *(done 2026-08-19)*
2. ✅ **B2 + B3** — presentation only: login footer and sidebar popover across the
   three apps. *(done 2026-08-19)*
3. ✅ **B6 migration applied by the user** *(2026-08-19)* — table verified present
   locally with correct columns, constraints, FK, RLS and indexes.
4. ✅ **B4 + B5 gates + B6 writers** *(done 2026-08-19)*.
5. ✅ **B7 — corrective grant migration applied by the user** *(2026-08-19)*.
6. ✅ **I1–I4** *(done 2026-08-19)*.
5. **I1** — booking-checkout notice.
6. **I2** — confirm no consent prompt was added to the resubmit path.
7. **I3 + I4** — documentation and UI-gallery/baseline upkeep, last, once the
   surface has stopped moving.

Note: steps 2 and 4 each touch all three apps, and step 3 is a schema change —
both are approval gates under `AGENTS.md` ("any change that touches more than one
app in the same task"; "any schema change"). Approving this plan covers them; the
cadence stays **one stage at a time** unless a wider run is requested.

---

## Verification

| Item | Check | Kind |
|---|---|---|
| B1 | ✅ 2026-08-19 — `npx tsc --noEmit` clean ×3; six URLs re-curled → 200; href sets identical across the three copies | machine-verified |
| B2 | ✅ 2026-08-19 build + placement-outside-`mobileView` read back — **machine-verified**. Desktop/mobile rendering across all five views — **still needs a browser** |
| B3 | ✅ 2026-08-19 build clean — **machine-verified**. Upward popover placement, drawer behaviour, light/dark — **still needs a browser** |
| B4 | ✅ 2026-08-19 **live-verified** against local Supabase: three bypass POSTs (field absent / `false` / `"yes"` + blank version) each returned 400 and `select count(*) from auth.users` stayed at **0**. Browser checkbox behaviour still unexercised |
| B5 | ✅ 2026-08-19 gate compiles and precedes `createUser` — **machine-verified**. Step-6 block + direct POST → 400 with no vendor row — **still needs a live environment** |
| B7 | ✅ 2026-08-19 **live-verified** — applied; grants re-read from `information_schema`; the previously-500 signup now returns 200 | machine-verified |
| B6 | ✅ 2026-08-19 **fully live-verified**, see the detail block below | `select` the table as an ordinary booker (own rows only), as an admin (all rows), as `anon` (permission denied). Register one booker + one vendor and confirm 3 and 4 rows respectively with correct `document_ver`/`document_url`. Force a mid-route failure and confirm **no** orphan rows survive the rollback | needs a live environment |
| I1 | ✅ 2026-08-19 build clean — **machine-verified**. Rendering in the wizard — **needs a browser** |
| I2 | ✅ 2026-08-19 — grep over `vendor/components/kyc/` finds no `LegalConsent`/`acceptedLegal`; `resubmitKyc(vendorId, newDocuments, removedDocs)` takes no consent params — **machine-verified** |
| I3 | ✅ 2026-08-19 — `portals.md` (all three portals), `schema.md` (table section + 2 migration-history rows), `vendor-kyc.md` (step-6 consent section) — **machine-verified** |
| I4 | ✅ 2026-08-19 — `?mode=legal` added to all three galleries; booker's rendered **HTTP 200** with all six ezzy.ph URLs and **9/9** anchors carrying `target="_blank"` + `rel="noopener noreferrer"` — **live-verified**. Playwright baselines **not regenerated** (gitignored, produce no tracked change) |

### B6 — what was actually exercised (2026-08-19, local Supabase)

| Check | Result |
|---|---|
| Table shape | `\d` confirms columns, both CHECKs, FK `on delete set null`, 2 indexes, RLS on |
| Valid booker signup | `HTTP 200`, **3 rows** — `terms` / `privacy` / `acceptable` |
| `document_url` | resolved server-side, e.g. `https://ezzy.ph/terms-use/` — correct trailing slash |
| `document_ver` | `2026-08-19` as reported by the client |
| IP extraction | `X-Forwarded-For: 203.0.113.42, 70.41.3.18` → stored `203.0.113.42` (client, not proxy) |
| `user_agent` | `ClaudeVerify/1.0` |
| RLS — owner | sees **3** |
| RLS — a different authenticated user | sees **0** |
| RLS — `anon` SELECT | `permission denied for table legal_acceptances` |
| Append-only — `authenticated` INSERT | `permission denied` (no policy **and** no privilege) |
| **Retention** — delete the auth user | profile cascades away; **3 consent rows survive** with `user_id` nulled and the email snapshot intact |
| Error path (pre-B7, genuine failure) | 500 → rollback left **0** auth users and **0** profiles |

All test data removed afterwards: `0` rows and `0` test users remain.

### B5 — vendor gate (2026-08-19, local Supabase)

Three bypass POSTs to `/api/auth/register` (flag absent / `false` / `true` with a
blank version) each returned **400** with the consent message. **Positive control:**
the same body *with* valid consent got **past** the gate and failed at the next real
check ("Some documents did not finish uploading"), which is what proves the gate is
discriminating rather than always-rejecting. `users=0 vendors=0 consent=0` throughout.

⚠️ **Not exercised:** vendor's happy-path consent INSERT. Reaching it requires real
staged Storage uploads with valid signed-URL tokens. It uses the same
`buildAcceptanceRows` helper and the same insert shape as booker's, which *is* fully
live-verified — but that is code symmetry, not a live test of the vendor path.

---

Accessibility pass for every new component (per `.claude/skills/ux-design/SKILL.md`):
keyboard-reachable links and checkbox, visible focus ring, ≥4.5:1 contrast on the
small link text in **both** themes — the most likely defect, since footer legal
links are habitually rendered at low contrast.
