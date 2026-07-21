# Command — restrict admin/root user management (privilege tiering)

**Date:** 2026-07-18
**App / scope:** `./command` + `./backbone` (RLS migration). Cross-cutting approval gate: schema/RLS change **and** a security change — both require explicit go-ahead per AGENTS.md.
**Status:** DRAFT — investigation complete; **PINNED / not scheduled**. No code to be written until the user unpins and approves.

> **Goal:** today any active command `admin` can fully CRUD *any* user, including other admins and `root`. Restrict it so that **only `root` may create, update, or delete users who are (or would become) `admin`/`root`.** Ordinary `admin`s keep full CRUD over `member`-level users only.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker (must-fix for the goal to hold), I# = Important, D# = Decision. Numbers are plan-local.

---

## Current state (verified 2026-07-18)

Every user-management gate keys on the **caller's** role being `admin` OR `root` — never on the **target's** role. Evidence:

| Op | Enforcement point | Current rule | File |
|----|-------------------|--------------|------|
| Create | `verifyCaller()` then service-role `createUser` | `admin` or `root` | `command/app/api/users/route.ts:9-28,30-42` |
| Read | RLS `command admins can read all profiles` | `admin` or `root` | `backbone/.../20260504000003_rls.sql:49-55` |
| Update (name/notes/status/portals/**role**) | client `useUpdateUser` → RLS `for all` | `admin` or `root` | `command/hooks/mutations/users/useUpdateUser.ts`; RLS `:64-74` (profiles), `:98-108` (user_portals), `:118-128` (user_roles) |
| Delete | `verifyCaller()` then service-role `deleteUser` | `admin` or `root` (blocks self-delete only) | `command/app/api/users/route.ts:72-85` |

**Consequences of "actor-only" gating:**
- An `admin` can edit another admin's role, demote/delete a `root`, or mint a brand-new `root`. The modal's role `<select>` offers all of `ALL_ROLES` unconditionally (`command/components/users/UserModal/UserModal.tsx:107-109`).

**Delete inconsistency (must account for):** RLS `command root can delete profiles` (`:76-82`) restricts *direct* profile deletes to `root`, but the actual `DELETE /api/users` uses the **service-role admin client, which bypasses RLS** (`command/lib/supabase/admin.ts`). So that policy is dead code for the app's own path — **delete must be enforced in the route, not (only) RLS.**

**Bootstrap fact:** seed ships exactly one `root` (`root@bookdeck.com`, `backbone/supabase/seed.sql:54-73`). If only root can mint admins/roots, that account must never be lost or the platform can't create new privileged users.

---

## DECISIONS (settle before any code)

- **D1 — Does "CRUD admins" include suspend/activate?** The status toggle reuses the full `updateUser` (which rewrites `profiles` **and** deletes+reinserts `user_roles`), so under the new RLS an `admin` could not toggle another admin's status either. → **Recommend: yes, treat status changes on an admin/root as a privileged op (root-only).** Consistent and simpler; matches "only root touches admins". *(open)*
- **D2 — Can `root` manage other `root`s?** → **Recommend: yes — `root` is unrestricted; the tiering only constrains `admin`.** *(open)*
- **D3 — Self-service edits.** An `admin` (who is themselves privileged) editing their **own** name/notes stays allowed via the separate `users can update own profile` policy (`:58-62`); `status_id` self-change is already trigger-blocked. Confirm we keep own-profile edits working (the new target-role gate must not clobber the self-edit policy). → **Recommend: keep self-edit as-is.** *(open)*
- **D4 — Scope of "privileged".** Define target as privileged iff it holds `admin` OR `root` in `user_roles`. A plain `member` (or role-less) target is manageable by any admin. *(confirm)*

---

## BLOCKERS (must all ship together — a gap in any layer defeats the goal)

### B1 — RLS: gate writes on the *target's* privilege, not just the actor's  ⬜ TODO
**Files:** new migration in `backbone/supabase/migrations/` (e.g. `20260718000001_user_admin_tiering.sql`).

Add a `SECURITY DEFINER` helper (mirrors existing helpers in `20260504000002_schema.sql`, `SECURITY DEFINER` to avoid RLS recursion when reading `user_roles` from inside a `user_roles` policy):

```sql
create or replace function public.is_privileged_user(p_user_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and r.name in ('admin','root')
  )
$$;
```

Then **replace** these three policies (drop + recreate — never edit an applied migration; this is a *new* migration that alters them):

1. `profiles` UPDATE (`command admins can update any profile`, `:64-74`) →
   `using` / `with check`: `is_portal_member('command') AND ( has_role('root') OR ( has_role('admin') AND NOT public.is_privileged_user(id) ) )`
2. `user_portals` ALL (`command admins can manage user_portals`, `:98-108`) → same shape, gating on `is_privileged_user(user_id)`.
3. `user_roles` ALL (`command admins can manage user_roles`, `:118-128`) → **two-sided check** (this is the escalation-critical one):
   - `using`: `is_portal_member('command') AND ( has_role('root') OR ( has_role('admin') AND NOT public.is_privileged_user(user_id) ) )` — an admin may only delete role rows of non-privileged targets.
   - `with check`: additionally require the **row being inserted** is not an admin/root role unless caller is root:
     `... AND ( has_role('root') OR role_id NOT IN (select id from public.roles where name in ('admin','root')) )` — blocks an admin from inserting an admin/root role (privilege escalation), and from converting a member into an admin.

**Blast radius:**
- *Data:* no column/table change, no row rewrite — policy swap only. Existing rows untouched.
- *Lock/perf:* `create or replace function` + `drop/create policy` are metadata-only, sub-second. `is_privileged_user` runs a 1-row indexed lookup per policy check (acceptable — user management is low-volume).
- *Downstream:* the client `useUpdateUser` will now get RLS errors when an admin targets a privileged user — surfaces as the existing "Failed to update user" toast. UX gate (I1) prevents hitting it. No type changes (no new columns).
- *Reversibility:* a follow-up migration restoring the original `admin OR root` policies + dropping the helper fully reverts it.
- *Recursion check:* `user_roles` policy calls `is_privileged_user` which reads `user_roles` — safe only because the helper is `SECURITY DEFINER` (bypasses RLS inside the function), exactly like `has_role`.

### B2 — Route: enforce tiering where RLS is bypassed (create + delete)  ⬜ TODO
**File:** `command/app/api/users/route.ts`.
The POST/DELETE routes use the **service-role** client (bypasses all RLS from B1), so they must self-enforce:

- **POST** (`:30-42`): after `verifyCaller()`, if the requested `role` ∈ {`admin`,`root`} **and** the caller is not `root` → `403`. Requires `verifyCaller` to return the caller's role (today it returns just the `User`); extend it to also report `isRoot`.
- **DELETE** (`:72-85`): after `verifyCaller()`, **look up the target's role** (service-role select on `user_roles`); if target is `admin`/`root` and caller is not `root` → `403`. This is the layer that actually enforces delete-of-admins (RLS delete is bypassed).

**Blast radius:** app-only, ~15–20 lines; no schema. Reversible by revert.

---

## IMPORTANT

### I1 — UI gating (UX only, not security)  ⬜ TODO
**Files:** `command/services/command.service.ts` (`verifyCommandAccess` currently computes `hasRole` but returns only `{ allowed }` — extend to also return the caller's role, e.g. `isRoot`), the app shell state that holds it, and `command/components/users/*` (UserModal role `<select>`, edit/delete buttons on `UserTableRow`).
For a non-`root` caller: hide `admin`/`root` from the role `<select>`, and disable edit/delete on rows whose user is `admin`/`root`. Prevents users hitting B1/B2 errors. **Not a security boundary** — B1+B2 are. Ship after B1/B2 so the UI reflects real capability.

---

## Coupling & execution order
- **B1 + B2 are one atomic security batch** — shipping B1 without B2 leaves delete/create wide open (service-role bypass); shipping B2 without B1 leaves the client update path open. Do **not** land one without the other.
- I1 depends on B1/B2 (mirrors their rules in the UI) — land last.
- Order: settle D1–D4 → write migration (B1) → route changes (B2) → verify enforcement → UI (I1).

## Verification
- **RLS (needs live DB):** as an `admin` session, attempt to (a) update another admin's profile, (b) delete an admin, (c) insert an admin/root role row, (d) create a user with role admin — all must fail; the same as `root` must succeed. As `admin`, full CRUD on a `member` must still succeed. Machine-checkable via SQL/`supabase` against a seeded local DB.
- **Route (needs live env):** `curl` POST with `role: "admin"` as an admin caller → 403; DELETE an admin as an admin caller → 403; both as root → 200.
- **UI (needs browser):** non-root caller sees no admin/root option and disabled controls on privileged rows.
- **Regression:** existing admin management of members unchanged; self-profile edit still works (D3).

## Notes
- Not committed by the agent — user handles commits.
- Pinned for now per user (2026-07-18). Unpin + resolve D1–D4 before execution.
