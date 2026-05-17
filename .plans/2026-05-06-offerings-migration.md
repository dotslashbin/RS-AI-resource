# Offerings Migration Plan

**Date:** 2026-05-06
**Target:** `./api/supabase/`
**Status:** Planning

---

## Context

Existing migrations (20260504*) already define:
- `academies` table — no changes needed
- `set_updated_at()` trigger function — reused here
- RLS helpers: `is_active()`, `is_portal_member()`, `has_role()`, `is_academy_member()`, `has_academy_role()`
- Seed: 3 academies (Alpha Laguna `a_alpha`, TL Mabuhay `a_mabuhay`, Right Driving School `a_right`) with known UUIDs

These new migrations extend the schema without touching any existing file.

---

## What Gets Created

### `offering_categories` — lookup table (shared across all academies)

| Column | Type | Notes |
|---|---|---|
| `id` | `smallint` PK generated always as identity | |
| `name` | `text` NOT NULL UNIQUE | machine name: `exam`, `lesson`, `other` |
| `label` | `text` NOT NULL | display label: `Exam`, `Lesson`, `Other` |

Seed rows inserted in the migration itself (not seed.sql — these are schema constants):

| id | name | label |
|---|---|---|
| 1 | exam | Exam |
| 2 | lesson | Lesson |
| 3 | other | Other |

---

### `offerings` — one academy can have many

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `academy_id` | `uuid` NOT NULL FK → `academies(id)` ON DELETE CASCADE | |
| `name` | `text` NOT NULL | full name, e.g. "Theoretical Driving Certificate" |
| `code` | `text` NOT NULL | short label, e.g. "TDC" — max 6 chars enforced by CHECK |
| `category_id` | `smallint` NOT NULL FK → `offering_categories(id)` | |
| `description` | `text` NOT NULL DEFAULT `''` | |
| `price` | `numeric(10,2)` NOT NULL DEFAULT `0` CHECK `price >= 0` | in PHP |
| `duration` | `text` NOT NULL DEFAULT `''` | free text, e.g. "2 hours" |
| `requirements` | `text[]` NOT NULL DEFAULT `'{}'` | array of requirement strings |
| `is_active` | `boolean` NOT NULL DEFAULT `true` | false = hidden from learner booking |
| `created_by` | `uuid` nullable FK → `profiles(id)` ON DELETE SET NULL | audit trail; nullable so user deletion doesn't cascade to offerings |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

**Constraints:**
- `UNIQUE (academy_id, code)` — a school can't have two offerings with the same code
- `CHECK (char_length(code) <= 6)` — keep codes concise
- `CHECK (price >= 0)` — no negative prices

**Indexes:**
- `offerings(academy_id)` — most common filter (all queries scope to an academy)
- `offerings(category_id)` — category filter in UI
- `offerings(created_by)` — audit queries

**Trigger:** `set_updated_at()` attached (reuses existing function from migration 002)

---

## RLS

### `offering_categories`
| Operation | Who |
|---|---|
| SELECT | Any authenticated user (learner needs to display category labels) |
| INSERT / UPDATE / DELETE | Blocked for all — managed only via migrations |

### `offerings`
| Operation | Who |
|---|---|
| SELECT (active only) | Any authenticated active user — learners browsing school offerings |
| SELECT (all, incl. inactive) | Active academy-admin of that academy; command admins |
| INSERT | Active academy-admin of that academy |
| UPDATE | Active academy-admin of that academy; command admins |
| DELETE | Active academy-admin of that academy; command root |

The two SELECT policies work together via OR — Postgres evaluates both and returns rows that match either.

---

## Migration Files

| File | Purpose |
|---|---|
| `20260506000001_offering_categories.sql` | `offering_categories` table + seed rows + RLS |
| `20260506000002_offerings.sql` | `offerings` table + constraint + indexes + trigger + RLS |

---

## Seed Additions (appended to `seed.sql`)

**Block 4 — Offerings**

Uses the academy UUIDs already in seed.sql (`a_alpha`, `a_mabuhay`, `a_right`) and user UUIDs for `created_by` (marco = `...0002`, dante = `...0008`).

| Academy | Code | Category | Price |
|---|---|---|---|
| Alpha Laguna | TDC | exam | ₱850 |
| Alpha Laguna | PDC | exam | ₱1,200 |
| Alpha Laguna | MDC | exam | ₱650 |
| Alpha Laguna | BDL | lesson | ₱500 |
| TL Mabuhay | TDC | exam | ₱850 |
| TL Mabuhay | PDC | exam | ₱1,200 |
| TL Mabuhay | MDC | exam | ₱650 |
| Right Driving | TDC | exam | ₱850 |
| Right Driving | PDC | exam | ₱1,200 |

`created_by`: marco for Alpha Laguna + TL Mabuhay, dante for Right Driving School.

---

## Execution Checklist

- [ ] Write `20260506000001_offering_categories.sql`
- [ ] Write `20260506000002_offerings.sql`
- [ ] Append Block 4 to `seed.sql`
- [ ] Verify: no references to unresolved tables (all deps are in 20260504* migrations)
- [ ] Verify: `supabase db reset` would run all 5 migrations then seed cleanly
