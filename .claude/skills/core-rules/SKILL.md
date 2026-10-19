---
name: core-rules
description: Always-on project rules for this workspace — workspace layout, shared tech stack and Supabase invariants, instruction priority, non-negotiable rules, red lines, approval gates, preferences, component conventions, and when to read the plan-authoring and prompt-writing skills. Loaded every session via CLAUDE.md; invoke it to re-read the rules mid-session.
---

# Core rules

## Workspace

```
workspace/
├── command/               # RS Command — internal ops portal; manages users, vendors, roles, and portal access across all three apps
├── booker/                # Bookdeck Booker — customer-facing booking portal; booking wizard, wallet, schedule, document upload
├── vendor/                # Bookdeck Vendor — vendor admin dashboard; bookings, staff, schedules, wallet, offerings, vendor profile
├── backbone/              # shared Supabase project — migrations, types, seed data
├── ezzy-booker-mobile/    # Expo/React Native counterpart to booker — mock-data build in progress, see .plans/2026-09-21-booker-mobile-app.md
├── ezzy-vendor-mobile/    # Expo/React Native counterpart to vendor — built out, running on Android
├── architecture/          # ecosystem documentation (schema, portals, auth, conventions) — the shared source of truth
└── .plans/                # dated plan documents for multi-phase work
```

These are independent apps sharing one Supabase project. They are not a monorepo — no shared dependencies or build tooling. Each app folder is its own git repository; this root repo tracks only `architecture/`, `.plans/`, `.claude/`, and the top-level Markdown.

**Working from this root is the intended default**, including for the mobile apps — it keeps `architecture/`, `.plans/`, and the shared skills in context. Consequences to respect:

- Nested `AGENTS.md` files layer on top of this one (see the AGENTS.md Use section in `AGENTS.md`). The mobile apps carry React Native overrides to the web-oriented rules below.
- Package and toolchain commands are **not** root-relative. Run them against the target app, e.g. `npm --prefix ezzy-vendor-mobile run start`, or from inside the app folder. `tsconfig.json`, `node_modules/`, and `@/*` path aliases are all app-local.
- Git commits for an app must be made inside that app's folder — this root repo does not contain their history.
- ⚠️ **Nobody commits in this workspace except the user.** Before writing any commit summary,
  read and apply `.claude/skills/commit-drafting/SKILL.md`: no git write commands, one draft
  per repository, and a copy-paste scoped `git add` with the excluded paths named. A bare
  `git add .` here commits someone else's work in progress.

### Where to look

`.plans/INDEX.md` lists every plan with its scope and status — check it for predecessor or overlapping plans before reading plan bodies. `architecture/` answers:

| Doc | Answers |
|-----|---------|
| `overview.md` | What the platform is, the portals and mobile clients, which app talks to which database, scope limits |
| `portals.md` | Per-app feature inventory, gaps and roadmap (all five apps), cross-portal parity |
| `schema.md` | Tables, columns, relationships, storage buckets, delete behaviour, migration history |
| `auth-and-roles.md` | Portals, roles, affiliates, RLS helpers and policy patterns, table grants, what each portal can see |
| `conventions.md` | Service layer, hook-as-controller, Supabase client use, env vars, TypeScript/component/styling rules, migration and Expo conventions |
| `booking-flow.md` | The 6-step booking wizard, payment provider surface, kiosk-origin bookings |
| `vendor-kyc.md` | Vendor verification: onboarding, command review, data model |
| `database-reset-and-deploy.md` | Which migration/seed command is safe in which environment, drift checks, rollback |
| `staging-readonly-role.md` | The temporary read-only Postgres login on staging: what it can see, how to park it between rounds, how to tear it down |
| `supabase-production-setup.md` | Runbook for standing up a new Supabase project (production done 2026-08-10) |
| `production-env-checklist.md` | Per-variable Vercel env requirements and post-deploy probes |
| `email-notifications-guide.md` | Master reference for the notification-email system, local and hosted |
| `email-local-run-quickstart.md` · `email-setup-local-and-remote.md` · `email-secrets-setup.md` · `email-sending-domain.md` | Email: run locally, set up per environment, secret inventory, changing the From domain |

---

## Shared Tech Stack

### Frontend (`command`, `booker`, `vendor`)

Next.js App Router + TypeScript + Tailwind/shadcn. Read each app's `package.json`
for the actual dependency set — it is authoritative and this file is not. Only
the non-obvious parts are recorded here:

- **Maps are booker-only.** `vendor` and `command` have no maps at all.

**Mobile** (`ezzy-booker-mobile`, `ezzy-vendor-mobile`): see `.claude/rules/mobile-stack.md`.

### Backend / Database

- **Platform**: Supabase (shared project across all apps)
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth (do not implement custom auth)
- **Storage**: Supabase Storage for file uploads
- **Realtime**: Supabase Realtime (use only where explicitly needed)
- **Client**: `@supabase/supabase-js` with server-side client via `@supabase/ssr` in Next.js apps
- **RLS**: Row Level Security must be enabled on every table — no table ships without RLS policies

### Shared Invariants (cross-app)

- All apps share one Supabase project — no app has its own DB
- Apps communicate with Supabase only via the official client — no raw SQL from app code outside of migrations
- Environment variables follow the pattern: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for public, `SUPABASE_SERVICE_ROLE_KEY` for server-only
- Schema changes require a new migration file — never mutate the DB directly without a migration
- Types: this repo **hand-writes** TypeScript interfaces (it does **not** use `supabase gen types`) — add or update the interface in the relevant service after any schema change

---

## Instruction Priority

Follow instructions in this order:

1. Non-Negotiable Rules (this file)
2. AGENTS.md Use (`AGENTS.md`)
3. Default Working Style (this file, `AGENTS.md` → Working Flow, and `.claude/skills/developerboss/SKILL.md`)

If two instructions conflict, follow the higher-priority instruction. If uncertain, stop and ask.

---

## Non-negotiable Rules

### Always

- Make minimal changes — only what the task requires, nothing more
- Make a plan before making changes unless the task is trivial or read-only
- Match existing code style and conventions in the file being edited
- Run type checks after changes where applicable
- Prefer server components over client components in Next.js unless interactivity explicitly requires a client component
- Update `AGENTS.md` or this core-rules file only when an improvement is genuinely useful and accurate

### Never / Red Lines

- Never do anything that would cause harm: physical, informational, financial, reputational, or operational
- Never access, share, store, or handle credentials, passwords, tokens, or secrets unless explicit approved instructions exist and a safe handling path is available
- Never put secrets in workspace files
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code or public environment variables
- Never contact anyone unless explicitly authorized and only through approved channels
- Never share personal identifying information with anyone except the user, through authorized channels only
- Never edit, modify, delete, or write to files outside the workspace unless explicitly authorized for that specific action
- Never restart, shutdown, or reload any service unless explicitly authorized for that specific action
- Never run destructive commands without asking first
- Never implement custom authentication — Supabase Auth is the only auth mechanism
- Never close, resolve, or mark done a follow-up item or issue surfaced during work (e.g. entries in a follow-ups plan) — report it and leave its status for the user to close

### Ask Before / Approval Gates

- Installing new dependencies in any app
- Any schema change: new table, column, index, constraint, or RLS policy
- Destructive SQL: `DROP`, `DELETE` without `WHERE`, `TRUNCATE`
- Destructive shell commands: `rm -rf` or equivalent
- Large rewrites or structural refactoring
- Any security-related change: auth flow, RLS policies, environment variable handling
- Any change that touches more than one app in the same task

### Invariants

- All Supabase tables must have RLS enabled — no exceptions
- Every new table must include explicit table-level `GRANT`s for the API roles in its migration (RLS alone is not enough — PostgREST checks table privileges first). Follow `20260620000001_api_role_grants.sql`: `anon` none; `authenticated` only the operations its RLS policies permit (never `TRUNCATE`); `service_role` full DML. The `public` default privileges grant no DML **to `anon`/`authenticated`** (those defaults were revoked), so a table without grants returns `permission denied` for logged-in users
- ⚠️ **A `GRANT` only adds; it never restricts.** `service_role` keeps the schema's default privileges — **every** privilege, `TRUNCATE` and `UPDATE` included — on each new table, so granting it `select, insert` removes nothing. An append-only table needs an explicit `revoke all … from service_role` **before** its grant, or it is append-only in name only. Four audit logs were wrong this way until `20260911000003` (see `architecture/schema.md`)
- No app writes raw SQL outside of migration files in `backbone/supabase/migrations/`
- `SUPABASE_SERVICE_ROLE_KEY` never appears in client-side code or any `NEXT_PUBLIC_` variable
- Migration files are never edited after being applied — create a new migration instead
- Types are hand-written interfaces (no `supabase gen types` in this repo) — update the relevant service's interface after every schema change

### Preferences

- `trash` over `rm` — recoverable beats permanent
- Canadian English spelling
- Update `AGENTS.md` (root or nested), the core-rules file, the relevant `architecture/` document, and/or `README.md` when they can be meaningfully improved, with only genuinely useful changes

---

## Default Working Style

### Component Conventions

Before creating any new component, read and apply `.claude/skills/component-separation/SKILL.md`.

Before making any visual or interaction change, read and apply `.claude/skills/ux-design/SKILL.md`.

Before building a static preview of a screen that does not exist yet — for design review ahead
of implementation — read and apply `.claude/skills/design-preview/SKILL.md`. Scaffold it with
`node .plans/previews/_shared/shoot.mjs --new <topic> --app <app>`; never hand-write the
boilerplate.

- Every component with state, effects, or handlers must have a companion `useComponentName.ts` hook in the same directory
- The `.tsx` file is a pure render layer — no `useState`, `useEffect`, business logic, or static inline `style={{}}` blocks
- Non-trivial styling goes in a co-located `ComponentName.module.css` (or shared Tailwind tokens/utilities), not inline in the `.tsx`; only genuinely dynamic one-off values may stay inline
- Pure display components (no state, no effects, no handlers, no non-trivial styling) are the only exception
- Plans (see Plan section below) that introduce or modify components must call this out per component, not leave it implicit

The `.module.css` rule above is web-specific. React Native has no CSS modules — the Expo apps override that one bullet in their own `AGENTS.md` while keeping the render/hook split and the no-inline-styles rule intact.

### Plan

When asked for a plan to be made, read and apply `.claude/skills/plan-authoring/SKILL.md`, and write it as a Markdown file under `.plans/`. Every plan must carry the status model defined there (overall status + per-item ⬜ TODO / 🔄 IN PROGRESS / ✅ DONE / ⏸ PARKED / ✖ ABORTED, with reasons on parked/aborted and verification notes on done).

- Plan filenames must start with the date, e.g. `2026-04-23-<short-topic>.md`.
- The nine-step flow (create → investigate → review → check → resolve → order →
  **approve** → execute → review), and the cadence and upkeep rules that go with
  it, live in that skill under "The project flow, end to end".

---

## Prompt Writing

When writing a prompt for an LLM, read and apply
`.claude/skills/prompt-writing/SKILL.md`.
