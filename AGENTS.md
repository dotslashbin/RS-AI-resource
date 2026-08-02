# AGENTS.md

## Workspace

```
workspace/
├── command/               # RS Command — internal ops portal; manages users, vendors, roles, and portal access across all three apps
├── booker/                # Bookdeck Booker — customer-facing booking portal; booking wizard, wallet, schedule, document upload
├── vendor/                # Bookdeck Vendor — vendor admin dashboard; bookings, staff, schedules, wallet, offerings, vendor profile
├── backbone/              # shared Supabase project — migrations, types, seed data
├── ezzy-booker-mobile/    # Expo/React Native counterpart to booker — scaffold only, see .plans/2026-07-21-ezzy-booker-mobile-buildout.md
├── ezzy-vendor-mobile/    # Expo/React Native counterpart to vendor — scaffold only, no app code yet
├── architecture/          # ecosystem documentation (schema, portals, auth, conventions) — the shared source of truth
└── .plans/                # dated plan documents for multi-phase work
```

These are independent apps sharing one Supabase project. They are not a monorepo — no shared dependencies or build tooling. Each app folder is its own git repository; this root repo tracks only `architecture/`, `.plans/`, `.claude/`, and the top-level Markdown.

**Working from this root is the intended default**, including for the mobile apps — it keeps `architecture/`, `.plans/`, and the shared skills in context. Consequences to respect:

- Nested `AGENTS.md` files layer on top of this one (see AGENTS.md Use). The mobile apps carry React Native overrides to the web-oriented rules below.
- Package and toolchain commands are **not** root-relative. Run them against the target app, e.g. `npm --prefix ezzy-vendor-mobile run start`, or from inside the app folder. `tsconfig.json`, `node_modules/`, and `@/*` path aliases are all app-local.
- Git commits for an app must be made inside that app's folder — this root repo does not contain their history.

---

## Shared Tech Stack

### Frontend (`command`, `booker`, `vendor`)

Next.js App Router + TypeScript + Tailwind/shadcn. Read each app's `package.json`
for the actual dependency set — it is authoritative and this file is not. Only
the non-obvious parts are recorded here:

- **Maps are booker-only.** `vendor` and `command` have no maps at all.

### Mobile (the Expo apps in "ezzy-booker-mobile" and "ezzy-vendor-mobile" folders)

- **Framework**: Expo SDK 57 + React Native, `expo-router` (file-based routing under `src/app/`)
- **Language**: TypeScript (strict), `@/*` aliased to that app's `./src/*`
- **Expo has changed** — read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing code; do not rely on pre-SDK-57 memory
- **Installing packages**: Expo-adjacent packages go through `npx expo install` (resolves the SDK-57-compatible version); plain npm packages via `npm install`. Either way, installing a dependency is an approval gate
- **Backend**: same shared Supabase project, same RLS boundaries — the mobile apps are new *clients*, not a new backend. `@supabase/ssr` does not apply; RN needs its own session-persistence adapter
- **Public env vars** use the `EXPO_PUBLIC_` prefix, not `NEXT_PUBLIC_`. `SUPABASE_SERVICE_ROLE_KEY` must never reach a mobile client under any prefix — service-role work stays behind the web apps' API routes
- **Store compliance**: read and apply `.claude/skills/mobile-dev/SKILL.md` before implementing or reviewing any mobile feature

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

1. Non-Negotiable Rules
2. AGENTS.md Use
3. Default Working Style

If two instructions conflict, follow the higher-priority instruction. If uncertain, stop and ask.

---

## Non-negotiable Rules

### Always

- Make minimal changes — only what the task requires, nothing more
- Make a plan before making changes unless the task is trivial or read-only
- Match existing code style and conventions in the file being edited
- Run type checks after changes where applicable
- Prefer server components over client components in Next.js unless interactivity explicitly requires a client component
- Update `AGENTS.md` only when an improvement is genuinely useful and accurate

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
- Every new table must include explicit table-level `GRANT`s for the API roles in its migration (RLS alone is not enough — PostgREST checks table privileges first). Follow `20260620000001_api_role_grants.sql`: `anon` none; `authenticated` only the operations its RLS policies permit (never `TRUNCATE`); `service_role` full DML. The `public` default privileges grant no DML, so a table without grants returns `permission denied` for logged-in users
- No app writes raw SQL outside of migration files in `backbone/supabase/migrations/`
- `SUPABASE_SERVICE_ROLE_KEY` never appears in client-side code or any `NEXT_PUBLIC_` variable
- Migration files are never edited after being applied — create a new migration instead
- Types are hand-written interfaces (no `supabase gen types` in this repo) — update the relevant service's interface after every schema change

### Preferences

- `trash` over `rm` — recoverable beats permanent
- Canadian English spelling
- Update `AGENTS.md` (root or nested), the relevant `architecture/` document, and/or `README.md` when they can be meaningfully improved, with only genuinely useful changes

---

## AGENTS.md Use

- Read and apply all discovered instruction files together.
- Precedence is: global instructions, then project-root-to-current-directory `AGENTS.md` / `AGENTS.override.md`.
- More local files override broader guidance when they conflict.
- In the same directory, `AGENTS.override.md` takes precedence over `AGENTS.md`.
- Edit the global instruction file for cross-project defaults.
- Edit the project `AGENTS.md` for repo-specific rules.
- Edit a nested `AGENTS.override.md` or `AGENTS.md` when the rule is specific to a subdirectory or subsystem.
- Keep this preamble identical in every `AGENTS.md` so AI agents can interpret layering consistently.

---

## Default Working Style

### Session Start

- Make sure the context includes this `AGENTS.md`, plus the nested `AGENTS.md` of any app being worked on
- Do not reread startup again unless asked or some context is missing

### Think Before Coding

Do not assume the task is fully understood.

- State important assumptions before implementation.
- If there are multiple reasonable interpretations, mention them.
- If the request is unclear in a way that affects implementation, ask before changing code.
- Surface tradeoffs instead of hiding uncertainty.
- Push back when a simpler or safer approach is available.
- Before responding to any task, read and apply `.claude/skills/developerboss/SKILL.md` — pre-flight checklist for scope, locating existing patterns, data-layer implications, and risk surface.

### Simplicity First

Prefer the smallest correct solution.

- Do not add features that were not requested.
- Do not add abstractions for single-use code.
- Do not add flexibility, configurability, or generality unless needed now.
- Avoid speculative error handling for impossible or irrelevant scenarios.
- If a solution becomes much larger than expected, reconsider and simplify.

### Surgical Changes

Change only what is needed for the task.

- Do not refactor unrelated code.
- Do not "clean up" adjacent code unless it is directly required.
- Match existing project style, even if another style would be preferable.
- If unrelated dead code or problems are discovered, mention them instead of fixing them silently.
- Remove only the unused imports, variables, functions, or files made obsolete by the current change.
- Make focused changes only in files required by the request.

Every changed line should be explainable by the user request.

### Component Conventions

Before creating any new component, read and apply `.claude/skills/component-separation/SKILL.md`.

Before making any visual or interaction change, read and apply `.claude/skills/ux-design/SKILL.md`.

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
- **Execution cadence is one stage at a time by default.** Running a stage range,
  or the full scope in one pass, happens when you ask for it.

### Goal-Driven Execution

Convert the task into verifiable outcomes.

- Define what success means before making broad changes.
- For bugs, prefer writing or identifying a failing reproduction before fixing.
- For behavior changes, add or update tests when practical.
- For refactors, verify behavior before and after when possible.
- For multi-step work, use a short plan where each step has a verification check.
- Continue until the work is verified or clearly explain what blocked verification.

### Completion Standard

Before saying work is complete:

- Summarize what changed.
- List the verification performed.
- List any verification that could not be run.
- Mention risks, assumptions, or follow-up work if relevant.

---

## Prompt Writing

When writing a prompt for an LLM, read and apply
`.claude/skills/prompt-writing/SKILL.md`.

...
