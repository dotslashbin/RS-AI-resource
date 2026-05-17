# AGENTS.md

## Workspace

```
workspace/
├── command/    # RS Command — internal ops portal; manages users, academies, roles, and portal access across all three apps
├── learner/    # DriveBook — student-facing exam booking portal; TDC/PDC/MDC booking wizard, wallet, schedule, document upload
├── academy/    # School Portal — driving school admin dashboard; bookings, instructors, schedules, wallet, packages, school profile
└── api/        # shared Supabase project — migrations, types, seed data
```

These are independent apps sharing one Supabase project. They are not a monorepo — no shared dependencies or build tooling.

---

## Shared Tech Stack

### Frontend (all three Next.js apps that are in "command", "learner", and "academy" folders)

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui (base-nova style, neutral palette)
- **Theming**: next-themes (light/dark via `class` strategy)
- **Maps**: Leaflet + react-leaflet (client-side only via `dynamic` import) — learner only. academy and command have no maps.
- **Icons**: lucide-react
- **Notifications**: sonner

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
- Type generation: run `supabase gen types typescript` after any schema change

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
- No app writes raw SQL outside of migration files in `api/supabase/migrations/`
- `SUPABASE_SERVICE_ROLE_KEY` never appears in client-side code or any `NEXT_PUBLIC_` variable
- Migration files are never edited after being applied — create a new migration instead
- Types must be regenerated (`supabase gen types typescript`) after every schema change

### Preferences

- `trash` over `rm` — recoverable beats permanent
- Canadian English spelling
- Update `AGENTS.md`, `SOUL.md`, `USER.md`, and/or `README.md` when they can be meaningfully improved, with only genuinely useful changes

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

- Make sure the context includes: AGENTS.md, SOUL.md, and USER.md
- Do not reread startup again unless asked or some context is missing

### Think Before Coding

Do not assume the task is fully understood.

- State important assumptions before implementation.
- If there are multiple reasonable interpretations, mention them.
- If the request is unclear in a way that affects implementation, ask before changing code.
- Surface tradeoffs instead of hiding uncertainty.
- Push back when a simpler or safer approach is available.

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

### Plan

When asked for a plan to be made, write it as a Markdown file under `.plans/`.

- Plan filenames must start with the date, e.g. `2026-04-23-<short-topic>.md`.
- For large multi-phase requests or list-based changes, keep the plan doc up to date with accurate completion checklists.
- Unless explicitly told otherwise, plan-driven work should follow this flow:
  1. Create a plan.
  2. Review the plan and carry out any investigations or auditing. Identify gaps and fill in if obvious or trivial, otherwise ask. If there are decisions to make, ask.
  3. Review the plan for under-specified areas where a poor solution could still satisfy the written plan.
  4. Check all planned changes against best practices for the relevant layer — schema design, RLS, TypeScript, React, SQL, security. Flag any violations or concerns before execution. Do not proceed if a critical issue is found.
  5. Resolve questions/problems.
  6. Refine the plan into an explicit execution order referencing detailed sections instead of duplicating detail inline.
  7. Execute.
  8. Review results and add newly discovered follow-up work to the plan before continuing.
- Plans should keep the non-obvious context needed for later phases if execution may span enough work to risk losing context.
- Plan review must explicitly check for places where the current wording could permit a weak or incorrect implementation.
- Resolve or document ambiguities before execution starts.
- During execution of a large approved plan, do not stop until the full approved scope is complete unless a truly blocking issue is discovered.
- After each major step or phase, review the work done and update the plan with completion state, important findings, and any newly discovered required work.

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

When this project builds prompts for an LLM, write them as reusable, structured inputs. Keep stable content first and variable content last.

1. Role and purpose — define what the AI is supposed to do, including persona, domain, tone, and audience.
2. Stable context — background that usually does not change between calls: product context, policy, schema notes, documentation summaries.
3. Task instructions — state the desired outcome, not every internal step. Include constraints, acceptance criteria, and failure conditions.
4. Output requirements — specify the exact format: JSON, Markdown, XML, bullets, table, code block. Ask for confidence, assumptions, and concise justification when useful.
5. Examples — include when the output shape or judgment criteria are not obvious. Keep them short and representative.
6. Critical reminders — repeat only the most important rules that are easy to violate.
7. Variable input data — put changing data last. Label inputs clearly using Markdown headings, XML-style tags, or JSON fields.

---

## Test Taxonomy

...
