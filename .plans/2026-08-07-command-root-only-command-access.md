# Command — restrict granting/revoking Command access to `root` only

**Date:** 2026-08-07
**App / scope:** `./command` (UI + `/api/users` route) and, for the enforced option, `./backbone` (one RLS migration).
**Status:** ✅ **COMPLETE (2026-08-07)** — all five stages executed and verified locally. Option B delivered: granting or revoking Command access is root-only, enforced in the database and in the service-role routes, mirrored in the UI, and documented. B6 (last-root guard) was implemented, proven unreachable, and ✖ removed as dead code.

> **Two things remain outside this plan, both the user's to run:**
> 1. **`supabase db push`** — the migration is applied to the **local** DB only. No hosted environment has been touched.
> 2. **The commit** — nothing has been committed; `command/` and `backbone/` are separate repos.

**Verification totals (all local):** 19/19 RLS escalation checks · 7/7 route checks · 5/5 error-message checks · 9/9 UI-gating checks · C7 read-regression clean · `tsc --noEmit` clean across every stage.

> **Goal being explored:** only the `root` user may add or remove a user account's access to the Command portal. Everyone else (ordinary `admin`s) must not see or be able to perform that operation. Two candidate shapes are compared: **frontend-only** vs **backbone-enforced**.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** F# = Frontend-only option item, B# = Backbone option item, D# = Decision, E# = escalation vector, N# = Note for the upcoming seeder/production session. Numbers are plan-local — qualify cross-plan refs by app.

> **Related plan:** `.plans/2026-07-18-command-user-admin-privilege-tiering.md` (PINNED). That plan covers the same enforcement surface from the "admins shouldn't manage admins" angle. **This ask is a strict subset of it** — see §2 Option B, which reuses that plan's B1/B2 verbatim. Do not execute both independently.

---

## 1. Findings (verified 2026-08-07 by reading the code)

### C1 — "Command access" is **two** rows, not one. Gating the portal toggle alone accomplishes nothing.

`verifyCommandAccess` (`command/services/command.service.ts:13-20`) requires **all three** of:
active status **AND** a `user_portals` row for `command` **AND** a `user_roles` row of `admin` or `root`.

Every Command-scoped RLS policy in backbone repeats that same pair — 40+ occurrences, e.g.
`backbone/supabase/migrations/20260504000003_rls.sql:52-55`, `20260507000002_schedules.sql:135-138`, `20260706000002_vendor_kyc_storage.sql:60-63`:

```sql
using (
  public.is_portal_member('command')
  and (public.has_role('admin') or public.has_role('root'))
)
```

Consequences that change the shape of this task:

- Granting a `member` the `command` portal row gives them **zero** access — they still fail the role half and get bounced by `useAppShell` (`command/components/layout/AppShell/useAppShell.ts:45-46`).
- Withholding the portal row from someone you then make `admin` also gives them nothing.
- **The operation you actually want to restrict is the pair "portal `command` + role `admin`/`root`".** Restricting only the portal checkbox in `UserModal` (`UserModal.tsx:120-135`) while leaving the Role `<select>` (`UserModal.tsx:106-109`, fed by `ALL_ROLES = ["root","admin","member"]`, `lib/constants.ts:35`) offering `admin` and `root` to everyone is not a restriction — it is a relabelling.

### C2 — Any `admin` can promote themselves to `root` today, in one click.

RLS `command admins can manage user_roles` (`20260504000003_rls.sql:118-128`) is `for all` to any command `admin` **or** `root`, with no check on the *target* or on the *role being inserted*. The Role `<select>` already offers `root`. So an `admin` can set their own role to `root`.

This means a root-only gate on `user_portals` **alone** is bypassable in one step: admin → self-promote to `root` → grant whatever they like. **The portal gate and the role-tier gate are a single boundary, not two independent features.** Any option that claims enforcement has to close both, which is exactly `2026-07-18` B1+B2.

### C3 — A frontend-only gate here is **not a weak control, it is no control**, because the write path has no server in it.

`useUpdateUser` (`command/hooks/mutations/users/useUpdateUser.ts:14-35`) writes `profiles`, `user_portals` and `user_roles` **directly from the browser** with the anon key and the caller's own JWT. There is no Route Handler in the path. Hiding the toggle changes what the UI submits; the identical session can `POST /rest/v1/user_portals` from devtools or curl and RLS will allow it.

This differs from hiding a field behind a server route (where the server still validates). Here, the *only* enforcement layer is RLS, and RLS currently says yes.

*(The create and delete paths do go through a server route — `command/app/api/users/route.ts` — but that route's `verifyCaller()` at `:9-28` also checks only `admin OR root`, so it has the same hole.)*

### C4 — ⚠️ A naive RLS gate on `user_portals` **breaks routine admin edits**, and the mutation must be fixed first.

`useUpdateUser.ts:21-28` does a **wipe-and-reinsert**: `delete().eq("user_id", id)` on all of the target's `user_portals`, then re-inserts the full set from the form. Under a policy where a non-root admin cannot touch `command` rows:

1. The `DELETE` **silently skips** the `command` row — RLS filters rows on DELETE, it does not raise. No error surfaces.
2. The following `INSERT` of the `command` portal row then fails **twice over**: the policy's `with check` rejects it, and even without RLS it collides with `primary key (user_id, portal_id)` (`20260504000002_schema.sql:40-45`).
3. `useUsers.saveUser` maps any error to the generic toast `"Failed to update user. Please try again."` (`useUsers.ts:60-64`).

**Net effect: a non-root admin editing *anything* — just the notes field — on a user who has Command access gets a hard failure.** `toggleStatus` (`useUsers.ts:81-92`) re-sends the whole payload through the same function, so suspend/activate on any Command user breaks too.

→ **`useUpdateUser` must be converted to a diff-based write (compute added/removed portals and roles, write only the delta) in the same batch as, or before, any RLS change.** This is the single biggest hidden cost in the backbone option and it is invisible from the plan title.

### C5 — Do not key on the *name* "root". Key on the existing `root` **role**.

The premise "the first user with the name `root`" is not needed and is actively worse than what already exists:

- `roles` already ships a `root` row (id 1) with a `has_role('root')` `SECURITY DEFINER` helper used throughout RLS; `profiles` DELETE is *already* root-only (`20260504000003_rls.sql:76-82`).
- `profiles.full_name` is **editable by the user themself** — policy `users can update own profile` (`:58-62`) permits it, and only `status_id` is trigger-protected. A name-based check is therefore spoofable by any user and breakable by a rename.
- The seed's root is `full_name = 'Root Admin'`, not `'root'` (`backbone/supabase/seed.sql:73`), so a literal name match would not even match today's root.
- Role-keying leaves the door open to a second break-glass root later without touching any policy.

**Recommendation: "root" means `has_role('root')`. Drop the name/first-user heuristic entirely.** If the intent is also "there must only ever be one root", that is a separate, enforceable constraint — see D4.

### C7 — ⚠️ CORRECTION to `2026-07-18` B1: narrowing a `FOR ALL` policy also breaks **reads**. The Users page would lose data.

*Found 2026-08-07 while answering "can non-root admins still log in to Command?" — this is a defect in the pinned plan's drafted SQL, not just in this one.*

Both `command admins can manage user_portals` (`20260504000003_rls.sql:98-108`) and `command admins can manage user_roles` (`:118-128`) are declared **`for all`**. In Postgres, a `FOR ALL` policy's `using` clause governs `SELECT`, `UPDATE` and `DELETE` — not just writes. These two policies are the *only* reason a command admin can read **other** users' portal and role rows; the own-row policies at `:93-96` and `:113-116` are scoped to `auth.uid() = user_id`.

`getUsers` (`command/services/users.service.ts:6-9`) depends on exactly that:

```ts
.select("id, full_name, email, notes, statuses(name), user_portals(portals(name)), user_roles(roles(name))")
```

So if B1 narrows the `using` clause of those `FOR ALL` policies as drafted, a non-root admin's Users page silently degrades:

- the `command` portal chip disappears from every row (`UserTableRow.tsx:33`);
- root's and other admins' portal chips disappear entirely;
- `user_roles` returns nothing for privileged targets, and `getUsers` falls back to `role: "member"` (`users.service.ts:22`) — **so root and every admin would be displayed to an admin as "Member"**. That is worse than a missing chip: it is a *wrong* value rendered with full confidence in `RoleBadge`, and it also corrupts the role filter and `UserStatsBar` counts.

**Required fix — split each policy by command, do not narrow the `FOR ALL`:**

- one **`FOR SELECT`** policy keeping today's broad `admin OR root` read (unchanged behaviour — admins keep seeing everything);
- separate **`FOR INSERT` / `FOR UPDATE` / `FOR DELETE`** policies carrying the restrictive `using` / `with check`.

This costs nothing extra at runtime and is the standard way to express "read all, write some". `profiles` is already structured this way (its SELECT and UPDATE policies are separate), which is why only the two `FOR ALL` tables are affected.

**Consequence for the plan:** B1's item count goes from 3 policies to ~7, still one migration, still metadata-only. No change to the effort estimate. `2026-07-18` B1 must be amended before it is executed — flagged there as well.

### C6 — Honest framing of what this buys

An active command `admin` already reads every profile, vendor, booking and KYC document platform-wide. The marginal risk this closes is **privilege propagation and accountability** — an admin quietly minting another admin, or granting an outside account they control — not data exposure. That is a legitimate thing to close, especially before production. It is not urgent in the "we are leaking data" sense, and it should not be sold internally as such.

---

## 2. The two options, sized

### Option A — Frontend-only  ⬜ TODO

**What it is:** compute the caller's role, hide the Command portal toggle (and, to be coherent per C1, the `admin`/`root` role options) from non-root callers.

| # | File | Change | ~Lines |
|---|------|--------|--------|
| F1 | `command/services/command.service.ts:4-21` | `verifyCommandAccess` returns `{ allowed, isRoot }` (the role names are already fetched at `:10`, just discarded) | ~4 |
| F2 | `command/components/layout/AppShell/useAppShell.ts:41-50` | hold `isRoot` in state; also set it on the login path | ~5 |
| F3 | `command/components/auth/LoginPage/useLoginPage.ts:37` | destructuring update (call site returns a wider object) | ~1 |
| F4 | `command/components/layout/AppShell/AppShell.tsx:83` | pass `isRoot` into `<UsersPage />` | ~1 |
| F5 | `command/components/users/UsersPage/UsersPage.tsx` | accept the prop, thread to `UserModal` | ~3 |
| F6 | `command/components/users/UserModal/UserModal.tsx:106-109,120-135` | filter `ALL_ROLES`; render the `command` portal button as read-only/absent when `!isRoot` | ~10 |
| F7 | `command/components/users/UserModal/useUserForm.ts` | on `populate`, preserve the target's existing `command` membership even when the control is hidden, so a non-root save does not silently strip it | ~5 |

**Size: ~7 files, ~30 lines of real change, half a day including manual checking.** No migration, no approval gate beyond normal review.

**Component-separation compliance:** F6 is render-only (`UserModal.tsx` stays a pure render layer, receiving a boolean prop — no new state, effects or inline static styles). F7 is logic and belongs in the existing companion hook `useUserForm.ts`. F1/F2 are service/hook layers. No new component is introduced, so no new `.module.css` is needed. This satisfies `.claude/skills/component-separation/SKILL.md` as written.

**F0 — What Option A does *not* do:** it does not restrict anything (C3). It is a UX affordance. Deploying it and describing it as "only root can grant Command access" would be inaccurate in any security review, audit questionnaire, or customer conversation.

**When Option A is the right answer:** if the threat model is *"stop a trusted colleague from mis-clicking the Command toggle"*, this is a perfectly sensible, cheap answer. Every command admin is already fully trusted with all platform data (C6). Say it out loud as "guard rail", not "restriction", and it is defensible.

---

### Option B — Backbone-enforced  ⬜ TODO

**What it is:** the boundary lives in the database and the service-role routes; the UI mirrors it.

| # | Layer | Change |
|---|-------|--------|
| B1 | `backbone/supabase/migrations/<new>.sql` | `is_privileged_user(uuid)` helper + replace the three `admin OR root` policies on `profiles` UPDATE, `user_portals` ALL, `user_roles` ALL with target-aware and insert-aware versions. **SQL and blast radius are drafted in `2026-07-18` B1 — reuse, but apply correction C7 below first.** For this ask the `user_portals` policy also gates on `portal_id = command`, not on the whole row, so admins keep managing vendor/booker portals (D3). |
| B2 | `command/app/api/users/route.ts:30-42, 72-97` | POST and DELETE use the **service-role client, which bypasses every policy in B1** — they must self-enforce. `verifyCaller()` (`:9-28`) must return the caller's tier, POST must 403 on `role ∈ {admin, root}` or `portals` containing `command` from a non-root caller, DELETE must look up the target's role and 403. Same as `2026-07-18` B2. |
| B3 | `command/hooks/mutations/users/useUpdateUser.ts` | ✅ **DONE (2026-08-07)** — converted wipe-and-reinsert to a diff-based write. See §6 stage 1 for what was executed and how it was verified. |
| B4 | `useUsers.ts:60-64` | surface the real error instead of the generic toast, so a blocked write reads as "Only root can change Command access" rather than "Failed to update user" |
| B5 | all of Option A (F1–F7) | the UI mirror, so admins never hit a 403 they cannot explain |
| B6 | ~~`command/app/api/users/route.ts` DELETE~~ | ✖ **ABORTED (2026-08-07)** — implemented, then removed as dead code at the user's instruction. Proven unreachable during stage 2 verification; the root account is already protected by three other guards. See §3.4. |

**Size: 1 migration + ~4 app files + all of Option A. Realistically 1–2 days including live-DB verification against a seeded local database.** Approval gates hit: RLS/schema change, security change, and (via B5) a change spanning the UI — all three require an explicit go-ahead per `AGENTS.md`.

**Blast radius (summary; full version in `2026-07-18` B1):** metadata-only policy swap, no rows rewritten, sub-second, reversible by a follow-up migration restoring the original policies. The real risk is **behavioural** (C4/B3), not data.

---

---

### 2.1 — B1: the exact migration  🔒 APPROVAL GATE — drafted 2026-08-07, **not written to disk**

Per `AGENTS.md` this is both a schema/RLS change and a security change. The file below is the complete proposed content of `backbone/supabase/migrations/20260807000001_command_access_root_only.sql`. Nothing is created until explicit go-ahead.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Restrict granting/revoking Command access to root.
--
-- A non-root command admin may write a user_portals / user_roles row only when
-- ALL of the following hold:
--   • the target is not already an admin or root   (is_privileged_user)
--   • the row is not the command portal            (D6)
--   • the role being written is not admin or root  (D2)
-- root is exempt from all three.
--
-- Reads are deliberately left wide open — see the FOR SELECT policies below and
-- .plans/2026-08-07-command-root-only-command-access.md §C7.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── helper ───────────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the user_roles policies below can read user_roles without
-- recursing through their own RLS — same reason as has_role() in
-- 20260504000002_schema.sql.
create or replace function public.is_privileged_user(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from   public.user_roles ur
    join   public.roles      r on r.id = ur.role_id
    where  ur.user_id = p_user_id
      and  r.name in ('admin', 'root')
  )
$$;

comment on function public.is_privileged_user(uuid) is
  'True if the given user holds a platform-wide admin or root role. Used by RLS to gate writes on the TARGET user''s privilege, not just the caller''s.';


-- ── profiles: admins may no longer edit or suspend an admin/root ─────────────
-- The separate "users can update own profile" policy is untouched, so self-edit
-- still works (permissive policies OR together).
drop policy "command admins can update any profile" on public.profiles;

create policy "command admins can update non-privileged profiles"
  on public.profiles for update
  to authenticated
  using (
    public.is_portal_member('command')
    and (
      public.has_role('root')
      or (public.has_role('admin') and not public.is_privileged_user(id))
    )
  )
  with check (
    public.is_portal_member('command')
    and (
      public.has_role('root')
      or (public.has_role('admin') and not public.is_privileged_user(id))
    )
  );


-- ── user_portals: split FOR ALL into read-all + restricted writes ────────────
drop policy "command admins can manage user_portals" on public.user_portals;

create policy "command admins can read all user_portals"
  on public.user_portals for select
  to authenticated
  using (
    public.is_portal_member('command')
    and (public.has_role('admin') or public.has_role('root'))
  );

create policy "command admins can insert user_portals"
  on public.user_portals for insert
  to authenticated
  with check (
    public.is_portal_member('command')
    and (
      public.has_role('root')
      or (
        public.has_role('admin')
        and not public.is_privileged_user(user_id)
        and portal_id <> (select id from public.portals where name = 'command')
      )
    )
  );

create policy "command admins can update user_portals"
  on public.user_portals for update
  to authenticated
  using (
    public.is_portal_member('command')
    and (
      public.has_role('root')
      or (
        public.has_role('admin')
        and not public.is_privileged_user(user_id)
        and portal_id <> (select id from public.portals where name = 'command')
      )
    )
  )
  with check (
    public.is_portal_member('command')
    and (
      public.has_role('root')
      or (
        public.has_role('admin')
        and not public.is_privileged_user(user_id)
        and portal_id <> (select id from public.portals where name = 'command')
      )
    )
  );

create policy "command admins can delete user_portals"
  on public.user_portals for delete
  to authenticated
  using (
    public.is_portal_member('command')
    and (
      public.has_role('root')
      or (
        public.has_role('admin')
        and not public.is_privileged_user(user_id)
        and portal_id <> (select id from public.portals where name = 'command')
      )
    )
  );


-- ── user_roles: split FOR ALL into read-all + restricted writes ──────────────
drop policy "command admins can manage user_roles" on public.user_roles;

create policy "command admins can read all user_roles"
  on public.user_roles for select
  to authenticated
  using (
    public.is_portal_member('command')
    and (public.has_role('admin') or public.has_role('root'))
  );

create policy "command admins can insert user_roles"
  on public.user_roles for insert
  to authenticated
  with check (
    public.is_portal_member('command')
    and (
      public.has_role('root')
      or (
        public.has_role('admin')
        and not public.is_privileged_user(user_id)
        and role_id not in (select id from public.roles where name in ('admin', 'root'))
      )
    )
  );

create policy "command admins can update user_roles"
  on public.user_roles for update
  to authenticated
  using (
    public.is_portal_member('command')
    and (
      public.has_role('root')
      or (public.has_role('admin') and not public.is_privileged_user(user_id))
    )
  )
  with check (
    public.is_portal_member('command')
    and (
      public.has_role('root')
      or (
        public.has_role('admin')
        and not public.is_privileged_user(user_id)
        and role_id not in (select id from public.roles where name in ('admin', 'root'))
      )
    )
  );

create policy "command admins can delete user_roles"
  on public.user_roles for delete
  to authenticated
  using (
    public.is_portal_member('command')
    and (
      public.has_role('root')
      or (public.has_role('admin') and not public.is_privileged_user(user_id))
    )
  );
```

**Design notes (read before approving):**

- **`FOR SELECT` policies preserve today's read behaviour exactly** — this is C7's fix. Admins keep seeing every user's real role and portals.
- **`UPDATE` policies are included even though no app code updates these tables** (`useUpdateUser.ts:21-35` deletes and re-inserts). Dropping a `FOR ALL` and replacing it with only SELECT/INSERT/DELETE would silently *remove* an UPDATE capability that exists today — scope creep in the removing direction. They are kept for parity.
- **The escalation guard does not depend on statement-visibility semantics.** `is_privileged_user(user_id)` inside an INSERT `with check` may or may not see the row being inserted, depending on snapshot timing. That ambiguity is harmless because the *independent* `role_id not in (admin, root)` clause is what actually blocks escalation, and it is evaluated on the literal row. Do not remove that clause on the grounds that `is_privileged_user` "already covers it" — it does not.
- **No grant changes needed.** `20260620000001_api_role_grants.sql:45-47` already grants `authenticated` select/insert/update/delete on all three tables; RLS narrows from there.
- **Naming** follows the existing `"command admins can …"` convention in `20260504000003_rls.sql`.

**Blast radius:**

| | Assessment |
|---|---|
| **Data** | None. No table, column, constraint or index is touched; **zero rows are read, rewritten or validated.** Policy and function DDL only. |
| **Lock / performance** | `create or replace function` plus 3 `drop policy` + 8 `create policy` — all catalogue-only, each taking a brief `ACCESS EXCLUSIVE` on its table. Sub-second on any table size. Runtime cost is one extra indexed 1-row lookup (`is_privileged_user`) per policy evaluation, on a low-volume admin surface; `stable` lets the planner cache it within a statement. |
| **Downstream** | No type regeneration (this repo hand-writes interfaces, and no schema shape changed). `command` app: coupled to B2/B3/B6 — see §6. `booker`, `vendor`, both mobile apps: **no impact**, verified in §3.3. |
| **Reversibility** | Full. A follow-up migration dropping the 8 new policies, recreating the two original `FOR ALL` policies and the original `profiles` UPDATE policy verbatim from `20260504000003_rls.sql:64-74,98-108,118-128`, then `drop function public.is_privileged_user(uuid)`, restores the prior state exactly. Worth writing that rollback file at the same time. |

---

### The comparison, stated plainly

| | Option A | Option B |
|---|---|---|
| Effort | ~½ day | ~1–2 days |
| Actually prevents a determined admin | **No** (C3) | Yes |
| Prevents self-promotion to root | No (C2) | Yes, via the `user_roles` `with check` |
| Risk of breaking existing admin workflows | ~none | Real — mitigated only by B3 (C4) |
| Migration / approval gates | none | RLS + security + multi-surface |
| Honest label | "guard rail" | "access control" |

**My recommendation:** Option A on its own is not worth shipping *as a security measure*, and shipping it as one is the actual risk in this ask — it creates a belief the boundary exists. Either:

- **accept it as a labelled guard rail** (cheap, honest, fine for a small trusted admin team pre-launch), or
- **unpin `2026-07-18` and do Option B once**, since that plan already contains B1/B2 fully drafted and this ask is a subset of it. Doing this narrow version separately means writing a second migration over the same three policies weeks apart.

I would not build a third, intermediate thing.

---

## 3. What actually changes under Option B  *(added 2026-08-07)*

The user accepted C1–C6 on 2026-08-07 and asked three questions before committing to Option B. Answers below, each grounded in verified code.

### 3.1 — Day-to-day behaviour change, by actor

**For a non-root `admin` in Command — what becomes impossible:**

| Operation | Today | Under Option B | Enforced by |
|---|---|---|---|
| Grant a user the `command` portal | allowed | **blocked** | B1 (`user_portals`) |
| Revoke a user's `command` portal | allowed | **blocked** | B1 |
| Set any user's role to `admin` or `root` | allowed | **blocked** | B1 (`user_roles` `with check`) |
| Promote **themselves** to `root` | allowed | **blocked** | B1 |
| Edit an existing admin's or root's name / notes / status | allowed | **blocked** | B1 (`profiles`) |
| Suspend an admin or root | allowed | **blocked** | B1 |
| Delete an admin or root | allowed | **blocked** | B2 (route — RLS is bypassed here) |
| Create a new user with role `admin`/`root` or the `command` portal | allowed | **blocked** | B2 (route) |

**What a non-root `admin` keeps — deliberately unchanged:**

- Sees every user in the list, including root (the `profiles` SELECT policy at `20260504000003_rls.sql:49-55` is **not** touched).
- Full CRUD over `member`-level users: create, edit, suspend, activate, delete.
- Full management of any user's `vendor` and `booker` portal rows (this is why D3 matters — the B1 policy must gate on `portal_id = command`, not on the whole `user_portals` row).
- Edits their **own** name and notes — a *separate* permissive policy, `users can update own profile` (`:58-62`), still allows it. Postgres ORs permissive policies together, so tightening the command-admin policy cannot remove this.
- Every other Command surface — vendors, bookings, KYC, disputes, payouts, notifications, platform fee — is completely untouched. No policy outside the three named in B1 changes.

**Login is completely unaffected — for everyone.** The gate is `verifyCommandAccess` (`command/services/command.service.ts:4-21`), three **own-row** reads governed by `users can read own profile` (`:44-47`), `users can read own portals` (`:93-96`) and `users can read own roles` (`:113-116`). B1 touches **none** of those three policies. Nor does any part of Option B delete or modify a single existing row — B1 is a metadata-only policy swap, so no admin loses the `user_portals`/`user_roles` rows they already hold. **Every existing non-root admin keeps logging in to Command exactly as today.** The change governs *who may grant or revoke* access, never who currently has it. (This holds only because of C7 — narrowing the `FOR ALL` policies as originally drafted would not have blocked login, but would have corrupted the Users page.)

**For `root`:** nothing changes. Root remains unrestricted everywhere.

**Two visible behaviour changes that are *not* about permissions:**

- **B3** makes user edits diff-based, so a save now writes only what changed instead of wiping and rebuilding all portal/role rows. Invisible when it works; it is the reason edits keep working at all (C4).
- **B4** replaces the blanket `"Failed to update user. Please try again."` (`useUsers.ts:60-64`) with the real reason, so a blocked admin reads *"Only root can change Command access"* rather than a mystery failure.

### 3.2 — Does this stop self-promotion to root? Yes — but only because B2 ships with B1

I enumerated every path from `admin` to `root` I could find in the code. **Verified 2026-08-07:** `user_roles` and `user_portals` each carry exactly **two** policies (`20260504000003_rls.sql:93,98,113,118`) and no others anywhere in `backbone/supabase/migrations/`, including no drift in `20260716161916_remote_schema.sql`. So there is no third permissive policy quietly ORing a write path open.

| # | Escalation vector | Closed by | Notes |
|---|---|---|---|
| E1 | Insert `user_roles(self, root)` directly | B1 `with check` | The `with check` rejects any insert of an `admin`/`root` `role_id` unless the caller is root |
| E2 | Delete own `member` role, then insert `root` | B1 | The delete is *also* blocked (self is privileged → `using` fails), and the insert independently fails E1's check |
| E3 | `UPDATE` an existing `user_roles` row's `role_id` to root | B1 | `for all` applies `with check` to UPDATE as well as INSERT. The app never does this, but the policy covers it |
| E4 | **Create a brand-new `root` account via `POST /api/users` with an email they control, then use password-reset to log into it** | **B2 only** | ⚠️ This route uses the **service-role client, which bypasses every policy in B1**. Without B2 the entire boundary is worth nothing. This is the single most important item in the plan |
| E5 | Escalate through `vendor_members` | already closed | `check (role_id in (3, 4))` at `20260504000002_schema.sql:98` — platform roles cannot be written there |
| E6 | Self-register a privileged account via booker `/api/register` or vendor `/api/auth/register` | already closed | Both hardcode their role: booker inserts `member` (`booker/app/api/register/route.ts:76-77`), vendor inserts `vendor-admin` into `vendor_members`. Neither accepts a role from the request body |
| E7 | Sign up directly through Supabase Auth | already closed | `handle_new_user` creates the profile at `pending_activation` with no portal and no role |
| E8 | Service-role key or Supabase dashboard access | **not closed, by nature** | Anyone holding `SUPABASE_SERVICE_ROLE_KEY` or dashboard access sits above this boundary permanently. This is the break-glass path (N2) and cannot be RLS-enforced |

**Answer: yes — with B1 and B2 shipped together, no `admin` can promote themselves or anyone else to `root` or `admin`.** With B1 alone, E4 leaves it wide open. This is why the two are one atomic batch and must never land separately.

### 3.3 — Effect on booker, vendor, and the two mobile apps: **none**

Verified by grep across all five apps on 2026-08-07:

| App | Touches `profiles` / `user_portals` / `user_roles`? | Impact |
|---|---|---|
| `booker` | `app/api/register/route.ts:67,76-77,93` (writes) and `services/booker.service.ts:10-12`, `components/settings/SettingsPage/useSettingsPage.ts:24` (reads) | **None.** The register route uses the **service-role** client, which bypasses RLS entirely. The two reads are own-row reads covered by `users can read own profile/portals/roles` — policies B1 does not touch |
| `vendor` | `app/api/auth/register/route.ts:114,117,167` | **None.** All service-role. `:167` reads `user_roles` only to find command admins for a notification |
| `ezzy-booker-mobile` | **zero references** | None |
| `ezzy-vendor-mobile` | **zero references** | None. It reads `vendor_members` (`src/services/vendor.service.ts:25`) and gets booker contacts through an RPC — neither is in B1's scope |

The reason the blast radius is this small: **B1 only rewrites the three policies whose `using` clause is "caller is a command admin"**. Every other app authenticates through own-row policies (`auth.uid() = id`) or vendor-scoped policies (`has_vendor_role`), and every cross-app registration path runs as `service_role`. Nothing in booker, vendor, or either mobile app depends on a command admin's write privileges.

**One caveat to hold onto:** this is true *of the code as it stands today*. If the mobile apps later add a profile-editing screen, it will go through `users can update own profile` — still untouched by B1 — so the conclusion should hold, but re-check at that time rather than assuming.

### 3.4 — Protecting the root account (B6)

You said you do not want the root account taken out. Worth knowing: **today, an ordinary admin can destroy it in three different ways**, and Option B closes all three:

1. **Delete it.** `DELETE /api/users` (`route.ts:72-97`) uses the service-role client, so the root-only policy `command root can delete profiles` (`:76-82`) is **dead code on the app's actual path**. Any admin can delete root right now. → closed by B2.
2. **Suspend it.** The status toggle routes through `updateUser` → `profiles` UPDATE, which any admin may do. A suspended root fails `is_active()` and is locked out of every portal — functionally the same as deleting it. → closed by B1.
3. **Strip it.** Deleting root's `user_roles` row or its `command` `user_portals` row leaves the account alive but powerless. → closed by B1.

**B6 was to add a last-root guard on top of these. ✖ ABORTED (2026-08-07).** It was implemented, then removed as dead code at the user's instruction, after stage 2 verification proved it unreachable: firing it needs a root caller deleting a *different* user who is the only root — impossible, because a root caller is themselves a root, making the count ≥ 2. My original reasoning ("it becomes reachable the moment a second root exists") was wrong: with two roots, deleting one leaves one, so the count check never trips.

**⚠️ Follow-up found 2026-08-07 — the app is not the only path.** A **root session over the REST API** can `DELETE` from `profiles` directly, including its own row: the pre-existing policy `command root can delete profiles` (`20260504000003_rls.sql:76-82`) has no self-exclusion, and `20260807000001` did not touch it. Verified empirically — a root deleted another root's profile row over PostgREST, and the `auth.users` row **survived** (the cascade runs auth→profiles, not the reverse), leaving an orphaned account that can still authenticate but fails `is_active()` everywhere. This is pre-existing behaviour, not introduced here, and it is reachable from a browser console with a root JWT — no database access required. If "never zero roots" is wanted as a real invariant, the fix is a `BEFORE DELETE` trigger on `profiles` refusing to remove the last root, which also covers the service-role path a route check cannot see. ⬜ TODO — not scoped in this plan.

**The invariant still holds for the app's own paths.** "Zero roots" is unreachable through Command's UI because the three guards above are: self-delete is rejected, non-root callers cannot delete a root, and root cannot be suspended or de-roled by an admin. The residual risk is that a *future* change relaxing one of those guards would remove the last line of defence silently — accepted deliberately, in preference to carrying provably dead code. If "exactly one root" or "never zero roots" is ever wanted as a hard invariant, the right place is a DB trigger or partial index on `user_roles` (the D4 mechanism), not a route check — that would also cover the service-role and dashboard paths a route check can never see.

---

## 4. DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

**All decisions resolved 2026-08-07. §4 no longer gates execution.**

- **D1 — which option?** → **Option B, enforced.** (resolved 2026-08-07) — a real boundary is wanted before production. `2026-07-18` is unpinned and folded in; see §8 for which document is authoritative.
- **D2 — what is "Command access"?** → **The portal + role pair.** (resolved 2026-08-07) — the portal row alone is inert (C1), so both halves are gated.
- **D3 — may an admin still manage `vendor`/`booker` portals?** → **Yes.** (resolved 2026-08-07) — keeps day-to-day admin work intact; the `user_portals` write policies gate on `portal_id = command`, not the whole row.
- **D4 — enforce "exactly one root"?** → **No.** (resolved 2026-08-07) — a single irreplaceable root is an availability risk. Protection comes from root-only writes + B6's last-root guard + the documented break-glass (N2), not from a uniqueness constraint.
- **D5 — may `root` manage another `root`?** → **Yes, root is unrestricted** (resolved 2026-08-07) — the sole exception is B6's last-root guard, which applies to everyone including root.
- **D6 — may a non-root admin grant the `command` portal to a `member`?** → **No, blocked outright.** (resolved 2026-08-07) — avoids confusing half-provisioned users and gives "who can put someone into Command" exactly one answer.

**Combined write rule these six produce** (implemented in §2.1): a non-root command `admin` may write a `user_portals` or `user_roles` row **only if** the target is not privileged **and** the row is not a `command` portal (D6) **and** the role being written is not `admin`/`root` (D2). `root` is exempt from all three.
- **Resolved 2026-08-07 — "first user named root":** ✖ rejected as the mechanism. Use the existing `root` role and `has_role('root')`. Rationale in C5: `profiles.full_name` is self-editable and the seeded root is named `'Root Admin'`, so a name match is both spoofable and currently wrong.
- **Resolved 2026-08-07 — findings C1–C6 accepted by the user.** Frontend-only is understood to be a guard rail, not a control; the portal+role pair is the real unit of Command access.

---

## 5. Notes for the upcoming seeder / production-setup session  (N#)

You said the seeder work is a separate session. These are the couplings that session will hit — **N1 and N2 are the ones that will bite.**

- **N1 — ✅ RESOLVED (2026-08-07): `backbone/supabase/bootstrap/production-root.sql` now exists.** Two steps: create the auth user in the Dashboard with your chosen email/password (so no credential ever enters the repo), then run the file with `v_email` set — it sets the profile active and grants the `command` portal + `root` role. Idempotent; raises an exception if the email is not found; grants **command only**, unlike the dev seed. Verified end-to-end against the local DB: placeholder email aborts correctly, a real run yields `active / root / command`, a re-run creates no duplicates, and the resulting account logs in with `verifyCommandAccess → { allowed: true, isRoot: true }` and can perform a root-only grant. Referenced from `architecture/auth-and-roles.md` and `architecture/database-reset-and-deploy.md`. Original note retained below for context.
- **N1 (original) — There was no production bootstrap path.** `backbone/supabase/seed.sql:1-4` is explicitly `"THIS FILE MUST NEVER RUN IN PRODUCTION"` and it creates 16 users with hardcoded known passwords. Production needs its own minimal bootstrap that creates exactly one `root` and nothing else. **Do not adapt the dev seed by deletion** — write a separate file; the dev seed's fixed UUIDs and `extensions.crypt('Bookdeck@root1', …)` passwords must not survive into it. The prod root should be created without a known password (invite / password-reset flow), consistent with the "Supabase Auth only" rule.
- **N2 — Root-only gating creates a lockout class of failure.** Once only `root` can mint `admin`s, losing the single root account means nobody can create privileged users through the app ever again. Before Option B ships, decide and **write down** the break-glass: service-role SQL from the Supabase dashboard, or a second standby root. This is the strongest practical argument against D4's "exactly one root".
- **N3 — Seeders are unaffected by B1's RLS.** Seed/bootstrap SQL runs as the DB owner or `service_role`, which bypasses RLS. So the prod bootstrap can insert the root's `user_portals` + `user_roles` rows regardless of the new policies. Nothing to change there — just don't assume the app can do the same afterwards.
- **N4 — Order matters.** Land the tiering **before or with** the prod bootstrap, not after. If admins are created through the app pre-tiering, you can end up in production with several accounts that were minted under the old rules and no record of who granted them.
- **N5 — The prod bootstrap should not grant root the `vendor` and `booker` portals** the way the dev seed does (`seed.sql:78-82`). Give production root the `command` portal only; cross-portal membership on the platform superuser is unnecessary surface.
- **N7 — Incident response changes: only root can contain a compromised admin.** *(added 2026-08-07)* Because the restriction is symmetric — a non-root admin can neither grant nor revoke Command access — an admin can no longer suspend, de-role or delete another admin whose account is compromised. Today that containment takes seconds and any admin can do it; afterwards it requires root. This is the correct tradeoff (it is the same property that stops an attacker holding one admin account from locking out everyone else), but it is a genuine change to response posture. Combined with N2, it is the strongest argument for provisioning a **reachable standby root** in production rather than relying on the service-role key as the only escape hatch. Decide this in the seeder session; it does not block execution.
- **N6 — `architecture/auth-and-roles.md` will need updating** in whichever session lands the change: the Roles table (`:177-186`) and the "Command admin pattern" (`:283-289`) both describe `admin` and `root` as interchangeable for user management, which will no longer be true under Option B.

---

## 6. Execution order  — Option B (D1, 2026-08-07)

Decisions are closed; §4 no longer gates. Cadence is **one stage at a time** per `AGENTS.md` unless a wider range is requested.

| Stage | Contents | Gate |
|---|---|---|
| **1** | ✅ **DONE (2026-08-07)** — **B3**, diff-based write in `useUpdateUser.ts`. Details below. | complete |
| **2** | ✅ **DONE (2026-08-07)** — **B1 + B2** landed together, plus B3b (see below). B6 was implemented then ✖ removed as dead code. Details in the stage 2 record. | approved + complete |
| **3** | ✅ **DONE (2026-08-07)** — **B4**, real error messages instead of the generic toast. Details below. | complete |
| **4** | ✅ **DONE (2026-08-07)** — **B5 (F1–F8)**, the UI mirror. Details below. | complete |
| **5** | ✅ **DONE (2026-08-07)** — `architecture/auth-and-roles.md` updated per N6. Details below. | complete |

**Hard ordering constraints:** never land B1 without B2 in the same change; never land either before B3. Stage 1 is complete; **stage 2 needs the go-ahead.**

### Stage 1 — completion record  ✅ DONE (2026-08-07)

**Executed:** rewrote `command/hooks/mutations/users/useUpdateUser.ts`. It now reads the target's current `user_portals` / `user_roles` in the same `Promise.all` as the existing lookups, computes added/removed sets, and issues **only** the deltas — a scoped `.delete().in("portal_id", …)` for removals and an insert for additions, each skipped entirely when its set is empty. Added a guard that bails if the current-state reads error, so a failed lookup can no longer strip a user's portals or role. Callers are unchanged (`saveUser` and `toggleStatus` in `useUsers.ts`); the signature and `{ error }` contract are identical.

**Verified — machine:**
- `npx tsc --noEmit` in `./command` → clean.
- `npx eslint` on the file → 1 error, down from 3, all of the pre-existing `no-explicit-any` class that is endemic to this area (`app/api/users/route.ts` has 6, `services/users.service.ts` has 4). The one remaining is the `(statusRow as any)?.id` line carried over verbatim.

**Verified — live (local Supabase + real browser, logged in as `marco@bookdeck.com`, an `admin`):** drove the actual Users page with Playwright and recorded every REST write. Results:

| Scenario | Observed writes | Expected |
|---|---|---|
| Edit **notes only** on liza | `PATCH profiles` — **and nothing else** | previously 4 writes (2 deletes + 2 inserts) |
| **Add** vendor portal | `PATCH profiles`, `POST user_portals` ×1 | exactly one insert, no delete |
| **Remove** vendor portal | `PATCH profiles`, `DELETE user_portals?…&portal_id=in.(1)` | one delete **scoped to the removed id** |

The scoped `portal_id=in.(1)` on the delete is the specific property C4 needs: the statement can no longer touch a `command` row the caller is not allowed to remove, so it cannot silently no-op and then collide with the primary key on re-insert. Test residue (liza's notes, the temporarily added vendor portal) was reverted; her row is back to `booker` / `member` / empty notes. The verification script lives in the session scratchpad and was deliberately **not** added to the repo — the existing `playwright.config.ts` is a visual-regression harness pointed at `/ui-gallery`, and its `testDir` (`./visual-tests`) does not currently exist, so there is no functional e2e suite to extend.

**Not verified:** behaviour under the B1 policies, which do not exist yet. That is stage 2's verification (§7).

### Stage 2 — completion record  ✅ DONE (2026-08-07)

**Executed:**

- **B1** — `backbone/supabase/migrations/20260807000001_command_access_root_only.sql` created exactly as drafted in §2.1 and applied locally with `npx supabase migration up --local`. 1 helper + 3 policies dropped + 8 created.
- **B2** — `command/app/api/users/route.ts`: `verifyCaller()` now returns `{ user, isRoot }`; POST rejects `role ∈ {admin, root}` and any `portals` containing `command` from a non-root caller (403); DELETE looks up the target's roles and rejects deleting an admin/root from a non-root caller (403).
- **B6** — last-root guard in DELETE. **See correction 2 below** — it is currently unreachable and is documented in the code as a backstop, not a live control.
- **B3b (newly discovered, not in the original plan)** — see correction 1.

**Correction 1 — a silent-success class that stage 2 itself created.** ⚠️ *Discovered during execution.* RLS **filters** `UPDATE` and `DELETE` rather than raising: a blocked write affects zero rows and returns **no error**. Only `INSERT` raises (`with check` violation). So after B1, three operations would have reported success while doing nothing:

- an admin editing/suspending an admin or root (`profiles` UPDATE → 0 rows),
- an admin revoking a member's `command` portal (e.g. rico, who is `member` + `command`) — the delete is filtered, so the row survives,
- an admin changing a privileged user's role.

`useUpdateUser` now asks each write to return its affected rows (`.select()`) and treats a short count as a permission error. This was **not** in the plan and is required for the boundary to behave honestly; the same defect would have shipped had stage 2 been executed as written. Verified in the matrix below — every filtered case reports `0 rows affected (RLS filtered)`, which the hook now converts into a real error.

**Correction 2 — B6 was unreachable, and has been removed.** ✖ **ABORTED (2026-08-07).** The route test returned the expected 400 but for the *wrong reason*: root deleting the only root is caught earlier by the pre-existing self-delete guard (`"You cannot delete your own account."`). Reaching the last-root check requires a root caller deleting a *different* user who is the only root — impossible, because a root caller is themselves a root, making the count ≥ 2. Flagged to the user as dead code; **removed at their instruction.** The DELETE handler keeps its `targetRoleNames` lookup, which the privileged-target check (B2) still needs. Rationale and the residual risk are in §3.4; re-verified after removal — 7/7 route checks still pass and lint dropped 8 → 7.

**Verified — machine:** `npx tsc --noEmit` clean. ESLint: `route.ts` 6 → 8 errors, all the endemic pre-existing `no-explicit-any` class; no new error categories.

**Verified — live DB, RLS escalation matrix (19/19 passed).** Real user sessions over PostgREST (anon key + user JWT), the same path the browser client uses:

| As `admin` (marco) — all must be denied | Result |
|---|---|
| E1 grant self the `root` role | denied — `new row violates row-level security policy` |
| E1b grant another user `admin` | denied — RLS violation |
| E2 delete own role row | denied — 0 rows (filtered) |
| E3 update a member's role row to `root` | denied — RLS violation |
| grant `command` portal to a member | denied — RLS violation |
| revoke a member's `command` portal (rico) | denied — 0 rows (filtered) |
| edit another admin's profile (jun) | denied — 0 rows |
| suspend root | denied — 0 rows |
| strip root's `command` portal | denied — 0 rows |
| delete root's role row | denied — 0 rows |

| As `admin` — normal work must still work | Result |
|---|---|
| edit a member's notes, grant/revoke a member's `vendor` portal, edit own profile | all allowed, 1 row each |

| As `root` — the same privileged ops | Result |
|---|---|
| grant/remove `admin` role on liza, grant/revoke her `command` portal, edit another admin's profile | all allowed |

**Verified — C7 (the read regression this plan exists to avoid).** As an `admin`, `profiles` joined to `user_portals`/`user_roles` still returns: root → `role=root`, `portals=booker,command,vendor`; jun → `role=admin`; rico → `portals=command,vendor`. **No degradation** — the `FOR SELECT` split works.

**Verified — routes, through a real browser session (7/7 passed).** Cookie-bound calls to `/api/users`:

| Call | Expected | Got |
|---|---|---|
| admin: POST `role: "admin"` | 403 | 403 *"Only root can assign the admin or root role."* |
| admin: POST `portals: ["command"]` | 403 | 403 *"Only root can grant Command portal access."* |
| admin: DELETE another admin (jun) | 403 | 403 |
| admin: DELETE root | 403 | 403 |
| admin: POST an ordinary member | 200 | 200 — unchanged |
| root: DELETE the only root | 400 | 400 — **but via the self-delete guard, see correction 2** |
| root: POST an admin with `command` | 200 | 200 |

**Cleanup:** the two accounts the route test created were deleted; local seed state re-verified intact (jun/liza/marco/rico/root all back to their seeded roles and portals). Both verification scripts stayed in the session scratchpad, not the repo.

**Not verified:** hosted/staging behaviour — the migration has only been applied locally, never pushed. Per `architecture/database-reset-and-deploy.md`, remote application is `supabase db push` and is the user's call.

**Migration renamed (2026-08-07):** `20260807000001_command_access_root_only.sql` → **`20260807000001_command_access_grant_root_only.sql`**. The original name read as though only root may *have* Command access; it means granting/revoking is root-only. Version unchanged, so the local history still treats it as applied — only the recorded label is stale, which any later `db reset` clears. Safe to do because it has never been pushed.

### Stage 3 — completion record  ✅ DONE (2026-08-07)

**Executed (B4):**
- `command/hooks/mutations/users/useUpdateUser.ts` — added `denialMessage()`, which converts SQLSTATE **42501** (RLS `with check` violation, raw text `new row violates row-level security policy for table …`) into an operator-readable reason on the two insert paths. Any other failure keeps its original message, so a network or constraint error is never mislabelled as a permission problem.
- `command/components/users/UsersPage/useUsers.ts` — `saveUser` and `toggleStatus` now surface the returned message, keeping the old generic strings only as a fallback when there is none. `deleteUser` already did this, so the three paths are now consistent.

Nothing else was needed: the routes (`/api/users`) and `useCreateUser`/`useDeleteUser` already propagate real messages, and stage 2's correction 1 supplied the wording for the filtered-write cases.

**Verified — machine:** `npx tsc --noEmit` clean; ESLint unchanged at 1 pre-existing error in the touched hook.

**Verified — live UI (5/5), as a non-root `admin`, reading the actual toast text:**

| Action | Toast shown |
|---|---|
| Grant `command` portal to a member | *"You do not have permission to grant one or more of these portals."* |
| Edit another admin's notes (jun) | *"You do not have permission to edit this user."* |
| Revoke a member's `command` portal (rico) | *"You do not have permission to remove one or more of this user's portals."* |
| Suspend root via the row toggle | *"You do not have permission to edit this user."* |
| **Control:** legitimate member edit | succeeds, **no toast** |

None of the five matched the old generic `"Failed to update user…"` wording, which is what the assertion checked for.

**Harness note (a false alarm worth recording):** the first run reported "no toast" for the admin-editing-admin case. Investigation showed the write *was* correctly blocked (`PATCH profiles → 200 []`, i.e. RLS filtered to zero rows, and jun's notes stayed empty) — the fault was in the verification script: it removed sonner's React-managed DOM nodes between assertions, which corrupted the toaster so later toasts never rendered, and it also slept past sonner's ~4s auto-dismiss. Fixed by waiting for natural dismissal. **No product defect** — recorded because "the test said no toast" is exactly the kind of result that gets mistaken for a real bug.

**State check:** jun / liza / rico / root all re-verified against `seed.sql` afterwards — statuses, roles, portals and notes all match (rico is *seeded* suspended, not test residue).

### Stage 4 — completion record  ✅ DONE (2026-08-07)

**Executed (B5):** `isRoot` is computed once in `verifyCommandAccess` and threaded to the Users surface.

- **F1** `services/command.service.ts` — returns `{ allowed, isRoot }`.
- **F2** `useAppShell.ts` — holds `isRoot`; set on session restore and on login, cleared on logout.
- **F3** `useLoginPage.ts` + `LoginPage.tsx` — `onLogin(user, isRoot)`. The login path already called `verifyCommandAccess`, so `isRoot` is passed through rather than re-queried.
- **F4/F5** `AppShell.tsx` → `UsersPage` → `UserTable` / `UserModal`.
- **F6** `UserModal.tsx` — non-root sees only `member` in the role select and no `command` portal toggle. **Refinement:** the target's *current* role is always kept in the option list, so the select can never display a role other than the truth.
- **F7** — **no code needed.** `useUserForm.populate` already copies the target's portals into form state, and hiding a toggle cannot clear it, so the diff (B3) sees no change and writes nothing. Verified empirically rather than assumed: an admin saved rico (a `member` who holds `command`) with the toggle hidden, and rico still holds `command,vendor`.
- **F8 (added, not in the original F-list)** `UserTable.tsx` / `UserTableRow.tsx` / `.module.css` — edit, suspend and delete are disabled on `admin`/`root` rows for a non-root caller, with a `title` explaining why; View stays enabled. Added because §3.1 blocks those operations, and B5's stated purpose is that admins never hit a refusal they cannot explain. Without it, F6's role select would also render misleading state on a privileged target.

**Component separation:** `UserModal.tsx`, `UserTable.tsx` and `UserTableRow.tsx` remain pure render layers — they take a boolean prop and branch on it; no state, effects or handlers were added. The disabled styling is a static class (`.actionDisabled`) in the co-located `UserTableRow.module.css`, not an inline style. No new component was created. Satisfies `.claude/skills/component-separation/SKILL.md`.

**Verified — machine:** `npx tsc --noEmit` clean. The type-checker caught the `/ui-gallery` fixture as a consumer of the changed props; it was updated with `isRoot` (root = every control enabled = today's rendering), so the **visual-regression baselines stay pixel-identical and need no regeneration**.

**Verified — live UI (9/9), both roles:**

| Check | As `admin` | As `root` |
|---|---|---|
| Role options in the edit modal | `["member"]` | `["root","admin","member"]` |
| Portal toggles | `["booker","vendor"]` | `["booker","command","vendor"]` |
| Portal toggles on a member who *has* command (rico) | `["booker","vendor"]` — and saving preserved his access | — |
| Row actions on root | view only | all enabled |
| Row actions on another admin (jun) | view only | all enabled |
| Row actions on a member (liza) | all enabled | — |

**Harness note (second false alarm):** two checks initially failed because the test read the **toolbar's role filter** instead of the modal's select. The toolbar legitimately lists every role — filtering is not granting — so this was a selector bug, not a leak. Scoping the locator to the modal card fixed it. Recorded because "admin can see 'root' in a dropdown" reads like a finding and was not one.

### Stage 5 — completion record  ✅ DONE (2026-08-07)

`architecture/auth-and-roles.md` updated:

- **Roles** — `admin` and `root` are no longer described as interchangeable; the three things a non-root admin cannot do are listed, along with what they keep, plus the two consequences (N7 incident response, and multi-root being supported and recommended).
- **RLS Helper Functions** — added `is_privileged_user(uuid)` with its definition and why `SECURITY DEFINER` is load-bearing (recursion).
- **RLS Policy Patterns** — new "privilege-tiered write pattern" section, the C7 read/write-split warning, and a "where RLS is not enough" subsection on the service-role routes.
- **Manual path diagram** — shows the command portal and privileged roles as root-only.
- **App-level access verification** — documents `isRoot` as UI gating only, explicitly not a boundary.
- **Future Considerations** — records the production-bootstrap and break-glass constraints (N1/N2).

## 7. Verification

- **C4 regression (needs live DB + browser, highest priority in Option B):** as a non-root `admin`, edit only the *notes* of a user who holds Command access, and separately suspend/reactivate them. Both must succeed. This is the check that catches the wipe-and-reinsert failure.
- **RLS (needs live DB, machine-checkable via SQL against a seeded local database):** as `admin` — adding the `command` portal to a user, removing it, and inserting an `admin`/`root` role row must all fail; the same operations as `root` must succeed; full CRUD on a `member`'s `vendor`/`booker` portals as `admin` must still succeed (D3).
- **Route (needs live env):** `POST /api/users` with `portals: ["command"]` or `role: "admin"` as an admin caller → 403; as root → 200. `DELETE` of an admin as an admin caller → 403.
- **UI (needs browser):** non-root sees no `command` toggle and no `admin`/`root` role option; saving an unrelated field does not strip the target's existing Command access (F7).
- **Machine-verifiable:** `npx tsc --noEmit` and `npm run lint` in `./command` after F1–F7 (the `verifyCommandAccess` signature change has two call sites and will fail the build if either is missed).
- **Self-edit regression:** an admin editing their own name/notes must still work (`users can update own profile`, `20260504000003_rls.sql:58-62`).
- **C7 read regression (needs live DB + browser) — run before anything else after B1.** As a non-root `admin`, open the Users page and confirm: root still displays as **Root** (not "Member"), other admins display as **Admin**, and the `command` portal chip still renders on every user who has it. Cross-check the role filter and `UserStatsBar` counts. This is the check that catches C7 if the policy split is done wrong.
- **Login non-regression (needs browser):** an existing non-root `admin` must still log in to Command normally after B1.
- **Escalation matrix (needs live DB) — run every row of §3.2 as an `admin` session.** E1–E3 must fail at the DB; E4 must return 403 from the route. Then repeat all four as `root` and confirm they succeed. This is the check that proves the goal, not the individual policy tests.
- **Root protection (needs live env) — B6:** as an `admin`, attempt to delete, suspend, and de-role the root account; all three must fail. As `root`, attempt to delete the only root; must fail with the last-root message.
- **Cross-app non-regression (needs live env), per §3.3:** register a new booker through `booker`'s form and a new vendor through `vendor`'s KYC flow — both run as service role and must be unaffected. Log into `ezzy-vendor-mobile` and load bookings. These are expected to be no-ops; run them anyway, because a mistake in B1 that accidentally hit an own-row policy would show up here and nowhere else.

## 8. Notes

- Commits are the user's to make; the agent does not commit.
- **Migrations are the user's to run** (stated 2026-08-07), local *and* hosted. `20260807000001` was applied to the local DB during stage 2 verification before this was established; **no hosted environment has been touched.** From here the agent writes migration files and stops. Hosted application is `supabase db push` per `architecture/database-reset-and-deploy.md`, and is best sequenced **after stage 4**, so admins do not hit 403s the UI does not yet explain.
- **Naming note:** `20260807000001_command_access_root_only.sql` reads as though only root may *have* Command access. It means granting/revoking is root-only; existing non-root admins keep full access (verified — the stage 2 route test logged in as a non-root `admin` after the migration was applied). A rename to `..._command_access_grant_root_only.sql` was offered 2026-08-07.
- **This plan is the execution document** (decided 2026-08-07). The earlier intent was to hand execution back to `2026-07-18`, but that is now the worse option: this file carries the corrected SQL (C7), the escalation matrix (§3.2), the cross-app clearance (§3.3), B6, and D1–D6. Splitting execution across two documents would leave the superseded draft as a trap. `2026-07-18` is **unpinned and superseded** — it stays as the record of where the tiering idea originated, and carries an amendment banner pointing at §C7.
- **Discovered during stage 1, not fixed (pre-existing, out of scope):** users can legitimately hold **zero** `user_roles` rows — vendor operators get `vendor_members` instead, so the live DB has such a row today (`sdf@oeur.com`: `vendor` portal, no platform role). `getUsers` (`command/services/users.service.ts:22`) falls back to `role: "member"` for them, so Command *displays* them as Member, and saving that user materialises a real `member` role row that did not exist before. Behaviour is identical before and after B3, so this is not a regression — but it means the Users page shows a role some users do not actually have. Worth a decision later: display "—" for role-less users, or accept the fallback. Flagging rather than fixing per the surgical-changes rule.
- Root-cause worth remembering for later work: **`FOR ALL` policies conflate read and write.** Any future attempt to restrict writes on a table whose policy is `FOR ALL` must split the policy first, or it silently breaks reads (C7).
