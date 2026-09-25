# Vendor branches, multi-vendor admins, and self-service "register another vendor" — research

**Date:** 2026-09-11
**App / scope:** `vendor` (primary), `command`, `backbone`, `ezzy-vendor-mobile` — all **read-only** for this document
**Status:** COMPLETE — research only — **not a plan.** No code, schema, config or doc was changed. Written so the
topic can be picked up later without re-deriving it. If it is revisited, turn §9 into a plan via
`.claude/skills/plan-authoring/SKILL.md`.

> **Status legend (for §8 decisions and §9 follow-ups):** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering:** Q# = question asked, D# = open decision, F# = follow-up. Plan-local.

> ⚠️ **Line numbers are a 2026-09-11 snapshot.** Re-verify every `file:line` before acting on it —
> several of these files are edited often.

---

## 1. Summary

1. **There is no branch concept.** Nothing lets a vendor create a branch, and nothing in the schema
   models one. The only "branch" data is a display label and a head-count, neither written by the
   vendor app.
2. **What looks like branches is multi-vendor membership.** The seed account `maria@bookdeck.com`
   is `vendor-admin` of **three separate vendors**, each with its own offerings, schedules, staff,
   wallet, KYC and payout method.
3. **Multi-vendor is representable but unreachable.** The schema allows it and the portals render a
   picker for it, but **only `seed.sql` ever produces it.** No UI or API route adds a user to an
   existing vendor, and registration cannot be reused by an existing account.
4. **No recorded reason for dropping branches.** The only "why" is the word "uneeded" in a
   2026-05-13 commit message from the driving-school ("academy") era.
5. **Allowing a signed-in user to register another vendor is a medium lift, almost entirely in
   `vendor`.** No migration, RLS change, booker, Command or mobile change is *required*. The work
   is in the register route (hardened, assumes a brand-new user) and the signed-in shell (no in-app
   vendor switcher; pending vendors are unreachable when an active one exists).
6. **Compliance:** the feature does not create a new problem and is arguably better than the
   status quo (a second email hides that one person controls both businesses). It does turn
   registration into a self-service access-provisioning path and makes several **pre-existing
   audit-trail gaps** matter more (§7).

---

## 2. Q1 — Can a vendor create a branch? **No.**

### What exists

| Column | Type | Written by | Read by vendor app? |
|---|---|---|---|
| `vendors.branch` | `text`, nullable — a display label, e.g. "Main Branch" | Nothing in `vendor`; not in Command's form | No |
| `vendors.branches` | `smallint not null default 1` — a count | Command's `VendorFormModal` only (`architecture/portals.md:566`) | No — `Vendor.branches` in `vendor/lib/types.ts:396` is unused |

- Added by `backbone/supabase/migrations/20260516000001_vendors_region_branches.sql` (region + count, "for Command portal use").
- `architecture/schema.md:273-280` distinguishes the two columns and states: *if per-branch
  registration (own name, address, schedule) is ever needed, the right model is a dedicated
  `vendor_branches` table — not repurposing either of these columns.*
- `vendor/lib/types.ts:354-359` — commented-out `Branch` interface: `// deferred — no vendor_branches table yet`.
  `VendorProfile.branches: Branch[]` is commented out at `:388`.
- `architecture/overview.md:290` — "no hierarchy, no per-branch sub-grouping".

### What Maria actually has

`backbone/supabase/seed.sql:19, 25-27, 312-315` — three `vendor_members` rows, `vendor-admin` at each of:
Citywide Sports Center, Harbor Sports Complex, Summit Athletics Club. Three independent businesses
sharing one admin — not one business with three locations.

The vendor portal consumes this through `getUserVendors()` (`vendor/services/vendor.service.ts:22`)
and a picker (`architecture/portals.md:335`). Mobile has its own picker (`ezzy-vendor-mobile/src/components/vendor/VendorPicker/`).

---

## 3. Q2 — Is there any way to add a managing user to an existing vendor? **No.**

**Exactly one line of app code inserts into `vendor_members`:** vendor self-registration,
`vendor/app/api/auth/register/route.ts:231`, which creates a brand-new user *and* a brand-new
vendor in the same transaction. Every other reference across command / vendor / booker / mobile
is a read, or a delete during account closure (`command/lib/accountDeletion/execute.server.ts:308`).

| Surface | Can it attach a user to a vendor? |
|---|---|
| Vendor self-registration | Only its own new user to its own new vendor |
| Command "create user" — `command/app/api/users/route.ts:8-127` | No. Writes auth user, profile, `user_portals`, one platform `user_roles` row, sends a set-password link. No vendor. |
| Command `UserModal` | No vendor picker — role + portal toggles only |
| Command `VendorFormModal` | Vendor record fields only |
| Vendor portal | No member/team-management UI at all (also recorded as F9 in `.plans/2026-08-21-vendor-account-deletion.md:172-177`) |

**Consequence:** a user created in Command with the `vendor` portal but no membership is refused at
sign-in with `no_access` (`vendor/services/vendor-access.service.ts:73-74`).

**The database would already allow it** — nothing is missing below the UI:
- Grants: `authenticated` has `select, insert, update, delete` on `vendor_members`
  (`20260620000001_api_role_grants.sql:51`).
- RLS (`20260504000003_rls.sql:205-217`): vendor-admins may manage members of their own vendor;
  Command admin/root may manage all.

⚠️ **That vendor-admin RLS rule is broader than any feature would want.** `with check` only verifies
the *caller* is vendor-admin of the vendor, so an existing vendor-admin can today add any `user_id`
as a co-admin, or remove other admins, by calling the API directly. No UI exposes it, and nothing
logs it (§7). Tighten before anything relies on it.

---

## 4. Q3 — Why weren't branches built? **No recorded reasoning.**

| Date | Where | What happened |
|---|---|---|
| 2026-05-08 | `.plans/2026-05-08-academy-component-breakdown.md:38-40, 79` | The original driving-school mock had **both** ideas: profile with `branches` + `certificates` arrays, and a multi-academy picker (`MOCK_USER_ACADEMIES`, `MULTI_ACADEMY_ENABLED`) |
| 2026-05-13 | vendor repo `29eeadb` (author `thumbtaper`), "CRUD for academy profile" | Body: *"Commented out uneeded feats ( branch and certificates)"*. Origin of the deferral comment. **This is the only "why" anywhere.** |
| 2026-05-16 | backbone `e6fb516`, "Refreshed migrations" | Added `region` and the `branches` count for Command |
| 2026-05-17 | root `99199cd` | The `schema.md` "use a dedicated table if ever needed" note — guidance, not a reason |
| 2026-06-22 / 26 | vendor `74c638b`, root `755f21c` (platform pivot) | Mechanical rename `academy_branches` → `vendor_branches`. Pivot plans (`2026-06-12-platform-pivot-vendor-booker.md`, `2026-06-18-platform-pivot-execution.md`) do not discuss branches |

Later plans touch it only in passing:
- `.plans/2026-07-27-ezzy-vendor-mobile-companion.md:76` — a dashboard sub-label said "All branches" (there are none).
- `.plans/2026-08-07-vendor-signup-production-preparations.md:1662-1666` — no uniqueness on
  `vendors.name` because it *"would wrongly reject legitimate branches"* — which implicitly assumes
  a branch is registered as a **separate vendor**.
- `.plans/2026-08-21-vendor-account-deletion.md:172-177` — F9, no member management.

**Inference (not recorded anywhere):** branches were descoped while the mock was wired to the real
DB; the multi-vendor picker from the same mock roughly covered "one owner, several locations"; by
August, "branch = another vendor with the same admin" had become the working model by default,
never by explicit decision. **If the owner remembers the actual reason, record it here.**

---

## 5. Q4 — Can an existing email register another vendor? **No.**

Four layers refuse a taken email, all with the same message
(`EMAIL_UNAVAILABLE_MESSAGE`, `vendor/lib/emailAvailability.ts:45-46`: *"This email can't be used for a
new application. Sign in or reset your password instead."* — "sign in instead" is a dead end here):

1. Wizard step 2 → `vendor/app/api/auth/check-email`
2. `vendor/app/api/auth/register/prepare/route.ts:66` — before KYC uploads start
3. `vendor/app/api/auth/register/route.ts:126-127` — final submit
4. `admin.auth.admin.createUser` (`route.ts:177-187`) — GoTrue itself enforces unique email

- `isEmailAvailable()` (`emailAvailability.ts:22-34`) checks **`profiles`, which covers every portal** —
  an email already used for a booker or Command account is refused too.
- The only workaround is a different address (incl. plus-addressing), which produces a **second,
  separate login**, not one login over two vendors.

**Unrelated defect found, not fixed:** `emailAvailability.ts:29` uses `.ilike("email", email)`. In a
LIKE pattern `_` matches any single character, so `a_b@x.com` is reported taken if `aXb@x.com`
exists. Rare, cheap to fix (exact match on a lower-cased value).

---

## 6. Q5 — Blast radius of "a signed-in user can register another vendor"

**Size: medium. One plan, roughly four stages. Almost entirely `vendor`.**

| Area | Change needed? | Detail |
|---|---|---|
| Schema / RLS | **None required** | Multi-membership is already representable; creation runs service-role server-side, same as registration. (§7 recommends schema changes for audit, separately.) |
| Register API — `vendor/app/api/auth/register/*` | **Yes — riskiest** | See §6.1 |
| Register wizard UI — `LoginPage.tsx` (508 lines) + `useLoginPage.ts` (603) | **Yes** | The wizard lives inside the login page. Step 2 is the account step (contact name, email, password — `useLoginPage.ts:236`). A signed-in variant must skip it: either add a mode to a hardened login component, or extract the wizard into its own component (component-separation rules apply) |
| Entry point | **Yes — new UI** | **The web portal has no in-app vendor switcher.** The picker renders only at sign-in (`AppShell.tsx:172`, `initialVendors={pendingVendors}`); no switch control exists in the sidebar or settings. Mobile has one (`useSettingsList.ts:80`, `canSwitchVendor`) |
| Pending-vendor visibility | **Yes — a real gap** | The gate and pickers list **active vendors only** (`useAppShell.ts:254-255`, `useLoginPage.ts:258-260`, mobile `useVendorGate.ts`). `KycStatusPage` renders only when the user has **no** active vendor (`AppShell.tsx:149-152`; `useLoginPage.ts:265` picks `all[0]`). So an admin with an active vendor who registers a second one **cannot see its review status or resubmit rejected KYC** until it is approved. Fixing this touches `verifyVendorAccess`, which is on every vendor's sign-in path |
| Notifications | Optional | Feed is filtered by user + portal only (`vendor/services/notifications.service.ts:15-17`), not vendor — a multi-vendor admin sees all businesses mixed. Items have no click-through (read / archive / delete only), so there is no wrong-vendor navigation. A vendor-name label would suffice |
| Account deletion | None | Already multi-vendor aware: closing one vendor keeps the `vendor` portal grant if the user still administers another (`command/lib/accountDeletion/execute.server.ts` `revokeMemberships`, ~`:295-325`); eligibility counts other vendors (`vendor/lib/accountDeletion/eligibility.server.ts:86-120`) |
| Command | None | KYC review/approval is per vendor; approval notices fan out to every vendor-admin (`command/services/kyc-admin.service.ts:124-135`) |
| Mobile | None required | Sign-in only; picker exists. Also hides pending vendors — can be addressed later |
| Booker | None | |
| Docs | Yes | `architecture/portals.md:335` says admins "can switch between them" — on web that only happens at sign-in. Correct it either way |

### 6.1 The register route

`register/route.ts` is one atomic create: **new auth user** → lookups → profile activation → `vendor`
portal grant → vendor (pending) → `vendor_members` → `vendor_kyc` → move staged files → document
rows → `legal_acceptances` → notifications. Its rollback **deletes the user** (`:160-169`, `:167`).
An existing-user variant must:

- derive the user from the session (never the body) and require active profile + `vendor` portal;
- skip the email check, `createUser`, profile activation and portal grant;
- have a rollback that **never** touches the user;
- skip the Command **"New User Sign-Up"** notice (`:337-344`) while keeping "vendor pending
  approval" and the applicant acknowledgement;
- still write a consent row for the new application.

The safe shape is to extract the vendor-creation half into a shared server module with two thin
routes. Duplicating the route would drift — the codebase already avoided that for the email check
(`emailAvailability.ts:6-9`, "ONE implementation, two callers"). That extraction trips the
**large-rewrite** and **security-related change** approval gates.

The `prepare` route mints Storage upload tokens (`prepare/route.ts:27-28` notes it must share
`/api/auth/register`'s rate-limit rule, plan A-B2). A signed-in variant needs the same coverage.
**Where that rule lives was not located** — it is not in `vendor/proxy.ts`.

---

## 7. Q6 — Compliance impact

Not legal or audit advice. SOC 2 scope is set with an auditor; RA 10173 questions go to counsel.

### Which frameworks apply

| Framework | Status here | Effect of this feature |
|---|---|---|
| **PH Data Privacy Act (RA 10173)** | **Binding now.** KYC ID + selfie is sensitive personal information (`.plans/2026-08-02-web-apps-production-launch-readiness.md:696`) | See below |
| **SOC 2** (Security criteria first; ISO 27001 the alternative) | Voluntary; typically asked for by enterprise customers/partners. A Type II samples evidence over months, so gaps closed early are cheaper | See below |
| **PCI DSS** | Hosted checkout keeps the platform at SAQ-A (`.plans/2026-09-07-paymongo-to-maya-migration-research.md:837`) | **None** — no card data involved |
| **AMLA** | Ezzy is not a covered person (`.plans/2026-08-21-vendor-account-deletion.md:1648`) | None directly. A payment partner may still want to know when one person controls several payees — linking under one login makes that **visible**, where today's second-email workaround hides it |

### SOC 2 — what is already sound

Self-created vendors are inert until Command approves them:
- vendors start `pending_activation`; only Command admin/root may change `status_id`
  (`prevent_vendor_status_self_update()` + `validate_vendor_status_transition()`, `architecture/schema.md:340`);
- every status change is logged with the actor (`vendor_status_log.changed_by`, trigger-only writes, `schema.md:327-345`);
- KYC review records reviewer and time (`vendor_kyc.reviewed_by` / `reviewed_at`, `schema.md:1056-1057`).

That is solid evidence that access provisioning requires authorization.

### SOC 2 — gaps (all pre-existing; the feature raises their weight)

| Gap | Why an auditor cares | Fix direction |
|---|---|---|
| `vendor_members` has only `granted_at` (`20260504000002_schema.sql:85-91`) — no `granted_by`, no history; a deleted row leaves no trace | "Who gave this person access to this vendor, and when was it removed?" is unanswerable | Trigger-written, append-only membership log mirroring `vendor_status_log` — **schema change** |
| `vendors` has no `created_by` | Creator is only inferable from other rows while they survive | Add `created_by`, or rely on the membership log |
| `legal_acceptances` has no vendor reference (`20260819000001_legal_acceptances.sql:26-50`; `source` is only `booker_signup` / `vendor_registration`) | With several applications per user, consent cannot be tied to a specific business | Add a vendor reference — **schema change** |
| Over-broad vendor-admin RLS on `vendor_members` (§3) | Unreviewed, unlogged access grants — a least-privilege finding | Tighten the policy — **security change** |
| No Command view to list / revoke memberships | Periodic access reviews need evidence; today that means raw SQL | Command view of who administers which vendor |

### RA 10173 considerations

- **KYC documents per vendor:** have the applicant re-upload, or **copy** into the new vendor's
  folder. **Never share by reference** — account closure purges `vendor-kyc/{vendor_id}/` per vendor
  (`.plans/2026-08-21-vendor-account-deletion.md:1644-1649`, D5), so shared objects would either
  outlive a deletion or vanish from the other vendor.
- **Notice and consent at the point of collection:** the signed-in flow still needs the
  policy-acceptance step and a consent row per application.
- **Account-takeover impact grows:** one stolen login controls several businesses' payout
  destinations and their bookers' contact data. Strongest argument for **MFA for vendor-admins**
  (Supabase Auth supports it; SOC 2 auditors generally expect it for privileged access).
- **Data-subject rights:** already handled per vendor without locking the user out of their others.

---

## 8. Open decisions (only if this is revisited)

- ⬜ **D1 — Model.** Real branches (new `vendor_branches` table; schedules and bookings scoped to a
  branch under one vendor / one KYC / one payout; schema + RLS + booker) **vs.** keep
  "branch = another vendor sharing an admin" and add self-service registration for signed-in users.
- ⬜ **D2 — Who may register another vendor.** Existing vendor-admins only, or any signed-in user?
  The latter also lets a booker become a vendor with the same email, which registration refuses today.
- ⬜ **D3 — KYC for the additional vendor.** Re-upload (recommended — consistent with KYC being
  per-vendor) vs. copy identity documents (less friction, more sensitive-PI exposure).
- ⬜ **D4 — Abuse limits.** Cap on concurrent pending applications per user; rate-limit coverage for
  the signed-in routes.
- ⬜ **D5 — Audit-trail work (§7).** Build it with the feature, before it, or accept the gap for now.
- ⬜ **D6 — MFA for vendor-admins.** Separate decision, made more relevant by multi-vendor.
- ⬜ **D7 — Record the original reason** branches were dropped, if anyone remembers it (§4).

## 9. Follow-ups independent of the feature

- ⬜ **F1** — Correct `architecture/portals.md:335` ("can switch between them" — web only at sign-in).
- ⬜ **F2** — Fix the `ilike` wildcard in `vendor/lib/emailAvailability.ts:29`.
- ⬜ **F3** — Tighten the vendor-admin RLS policy on `vendor_members` (`20260504000003_rls.sql:205-209`). Security change → approval gate.
- ⬜ **F4** — Membership audit log (§7). Schema change → approval gate.
- ⬜ **F5** — Locate where the A-B2 rate-limit rule for `/api/auth/register` actually lives, and document it.

---

## 10. Verification

- **Performed:** read-only inspection of `architecture/`, `.plans/`, `vendor`, `command`,
  `backbone/supabase/{migrations,seed.sql}` and `ezzy-vendor-mobile/src`; `grep` across all app code
  for every `vendor_members` reference; `git log -S` / `git show` across the root, vendor and
  backbone repos for the branch history.
- **Not performed:** nothing was run against a database, a browser or a device. Behavioural claims
  (e.g. a pending second vendor being unreachable) are derived from code, not observed.
