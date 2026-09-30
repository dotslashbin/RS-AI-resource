# Ezzy Booker — live verification: local acceptance, then staging, then production

**Date:** 2026-09-29
**App / scope:** `booker/` **as deployed** — the checks that cannot be run from a terminal. No code changes belong to this plan; a failure here opens an item on the plan that owns the code.
**Status:** DRAFT — ready to run. **No decision is open.** Gated on L0, which is yours.

> Split out of `.plans/2026-09-18-booker-home-search-redesign.md` on 2026-09-29 on the user's
> instruction: *"All the stages that involve live testing (staging or prod), put them in a
> separate plan for later. I will need to run tests on the booker locally before I move to push
> it to staging."* That sequence is the plan — **L0 local, then L1–L2 staging, then L3 production.**

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** L# = a live-verification stage. Numbers are plan-local. Items keep their
> original redesign-plan IDs in brackets so existing references still resolve.

---

## Why this plan exists separately

Every item here shares one property: **a machine in this repo cannot settle it.** They need a
real browser, a second real account, PayMongo's test mode, or a hosted database. Mixing them into
the build plan made that plan look incomplete when it was in fact finished and waiting on a
person.

⚠️ **The whole set is gated on L0.** Pushing to staging before the local pass means debugging two
environments at once.

---

## Environment facts (verified, carry these into every stage)

| Fact | Detail |
|---|---|
| Staging project | `fbxbwnfeimzhgxpshdpa` |
| `backbone/` CLI link | **Staging, not production.** No `supabase` command run from this repo reports on prod |
| Migrations applied | `20260922000001_slot_occupancy_rpc.sql` and `20260927000001_popular_offerings_rpc.sql` are on **local, staging and production** (2026-09-27) |
| EXECUTE grants | Verified by the user on **both** hosted environments 2026-09-28 — `anon` has none on either function |
| Booker production | **Not serving users** (confirmed 2026-09-28). Nothing here is customer-facing yet, which is why L3 is posture rather than urgency |
| Local dev | `localhost`, not `127.0.0.1` (WSL2). Playwright wants :3200 and cannot start while a dev server holds it |

---

## L0 — Local acceptance gate  ⬜ TODO — **yours, and it blocks L1–L3**

What you asked for: run booker locally and satisfy yourself before staging. Nothing below leaves
your machine.

**Machine checks already green as of 2026-09-29** (mine, re-run any time):
`npx tsc --noEmit` clean · `npm test` **154/154** · `npm run lint` **18 problems, all pre-existing**
· `npx playwright test visual-tests/pilot.spec.ts` **73/73**, twice consecutively · `csp.spec.ts`
+ `seo.spec.ts` **4/4**.

**What only you can judge:**

- ⚠️ **AMENDED 2026-09-29 — L0-a now covers a second change, and its scope grew from 19 baselines
  to 69.** `.plans/2026-09-29-booker-poppins-base-font.md` made **Poppins** booker's single type
  family (body *and* headings; Bricolage Grotesque removed), which re-recorded **69 of the 71**
  baselines — every pane with text. The two untouched are `infotip-light`/`dark`, which contain no
  text. So this pass is now judging **the redesign palette and the new typeface together**, which is
  deliberate: the alternative was passing L0-a on the old font and then repeating the whole pass.
  Machine checks that are already done and are *not* what L0-a is for: 154/154 tests, `tsc`, `build`,
  visual **77 passed twice at exit 0**, touch targets and focus counts unchanged, tile labels
  unclipped at 360/390/1280. What still needs **your eye**: whether Poppins reads well at the 10–11px
  label tier, the badge pills, and the amount columns on Payments (`tabular-nums` is a no-op under
  Poppins — the column still aligns, measured at a 0.00px decimal spread, but you should confirm it
  looks right). ⚠️ The vendor **taglines** are the one thing no baseline covers at all, on either
  client — the gallery never renders them; their italic was verified by measurement only.
- **L0-a — re-review the re-recorded baselines** (19 named below from the redesign; **69 in total**
  after the Poppins change — see the amendment above).** ⚠️ **This is not a repeat of a check you
  already passed.** Your earlier acceptance ("the baselines are all good") happened while the
  suite was still colour-blind — `threshold` defaulted to 0.2, so the palette you were shown was
  not necessarily the one on disk (redesign plan F64/F66). The 19 in question: `home`,
  `divisions`, `popular`, `opentoday`, `bookagain`, `bookingconfirm`, `step4`, `steppay`,
  `notfound`, `error` (light + dark, minus `divisions-light`). In
  `booker/visual-tests/pilot.spec.ts-snapshots/` — **booker-relative**, not workspace-root.
  ⚠️ Five of those — `bookingconfirm`, `step4`, `steppay`, `notfound`, `error` — I never edited.
  I verified their drift is text anti-aliasing only (every delta ≤24/255, narrow text bands, top
  colours identical) but **nobody has looked at them since 2026-08-31**.
- **L0-b — the storefront Home against seeded data.** `backbone/supabase/demo/booker-demo-seed.sql`
  is applied locally. All five shelves must render: Popular, Available today, Book again, Vendors
  in your city, and the in-progress strip. ⚠️ **Every shelf hides itself when empty**, which is
  exactly how three of them stayed dead for two stages without anything failing (F58). An absent
  shelf is not proof of a bug, and not proof of health either — check each deliberately.
- **L0-c — both themes at 360, 390 and 1280.** Default theme is **dark** (`defaultTheme="dark"`),
  so dark is the first impression, not the variant.
- **L0-d — the wizard end to end on local**, as far as the payment step. The payment itself is L2.

**Exit condition:** you say local is good. Then L1.

---

## L1 — [S3b-5] Staging: a second booker's booking lowers "N left"  ⬜ TODO — yours

**What:** with two real booker accounts on staging, book a slot as A and confirm the remaining
count drops for B.

⚠️ **Why "the number looks sensible" is not the test.** `get_slot_occupancy` is `SECURITY DEFINER`
because RLS hides other bookers' rows; a booker computing counts client-side sees only their own
bookings and so sees full capacity. **A correct count and a dead RPC used to look identical** —
that was F61, and the wizard rendered a confident "20 left" either way.

✅ **I49 (2026-09-28) changed the failure mode, which makes this easier to judge:** Step 3 now
tracks `occupancyKnown` and renders **no badge at all** when the lookup fails, never `0` (which
would mean Full). So on staging:

| What you see | What it means |
|---|---|
| A number that **drops** after A books | ✅ The function works and RLS is being bypassed correctly |
| A number that **does not drop** | ❌ The count is wrong — reopen against `services/schedules.service.ts` |
| **No badge** | ❌ The RPC is failing or ungranted on staging — not a UI bug |

**Verification type:** needs a live environment; two accounts are the irreducible requirement.
**Related:** the same check covers the redesign plan's `I14` live row.

---

## L2 — [S6-b] Staging: Explore → Offering → Schedule → Pay  ⬜ TODO — yours

**What:** one full booking against PayMongo **test mode** on staging.

Covers the redesign plan's live rows for **I15** (the wizard now starts at Schedule from the
offering page; Steps 1–2 and the map are gone) and the money path.

**Watch for:**
- The return URL resolving. `lib/siteUrl.ts` throws on a Vercel build with no usable site URL —
  see the comment in `app/api/payment/create-session/route.ts`.
- `is_paid` flipping on the booking after the webhook, **without a reload** (realtime, trap (i)).
- ⚠️ **Do not retry a failed payment.** Retry is parked as **P2** precisely because
  `create-session` could charge twice today (F3). One attempt per booking.

**Verification type:** needs staging keys and a browser. Not simulable here.

---

## L3 — Production posture  ⬜ TODO — yours

Booker production is **not serving users**, so this is a pre-launch checklist, not an incident
queue.

- **L3-a — re-run L1's occupancy check on production.** ⚠️ Both RPCs reached production on
  2026-09-27 **before** L1 confirmed the numbers were right on staging. If the counts are wrong,
  production is where it shows, and no command in this repo reports on prod (the CLI is linked to
  staging).
- **L3-b — `architecture/production-env-checklist.md`**: per-variable Vercel requirements and the
  post-deploy probes. Not re-verified since this redesign landed.
- **L3-c — decide whether the demo seed should ever run on a hosted environment.**
  `booker-demo-seed.sql` is additive and tagged `de400000-`, with a teardown beside it. It was
  written so the new widgets could be *seen* on staging. ⚠️ It has only ever been run on **local**.
  Running it on production would put fabricated bookings in a real database — my recommendation is
  **staging only, never production**, but it is your call and it is not currently written down
  anywhere as a rule.

---

## Not in scope

- **Any code change.** A failure here opens an item on the plan owning that code, usually
  `.plans/2026-09-18-booker-home-search-redesign.md`.
- **React Native.** `.plans/2026-09-29-booker-mobile-parity-groundwork.md`.
- **Applying migrations.** The user applies all migrations; none is outstanding for booker.

---

## Big table

| Done | ID | What | Who | Status | Why / reason |
|:-:|---|---|---|---|---|
| [ ] | L0-a | Re-review the re-recorded visual baselines — **69**, not 19 (amended 2026-09-29) | You | ⬜ TODO — **blocks L1–L3** | ⚠️ Not a repeat: your earlier pass was shown a palette the suite could not verify (F64/F66). 5 of the original 19 are panes nobody has looked at since 2026-08-31. ⚠️ **Now also covers Poppins as the base font** (`2026-09-29-booker-poppins-base-font.md`), which re-recorded 69 of 71 baselines — judge palette **and** typeface in one pass |
| [ ] | L0-b | Storefront Home against the local demo seed — all five shelves | You | ⬜ TODO | Empty shelves hide themselves; that is how three stayed dead for two stages (F58) |
| [ ] | L0-c | Both themes at 360 / 390 / 1280 | You | ⬜ TODO | `defaultTheme="dark"` — dark is the default, not the variant |
| [ ] | L0-d | Wizard end to end locally, up to the payment step | You | ⬜ TODO | The payment itself is L2 |
| [ ] | L1 | [S3b-5] Staging: a second booker's booking lowers "N left" | You | ⬜ TODO | Two real accounts required. I49 means a dead RPC now shows **no badge** rather than a wrong number |
| [ ] | L2 | [S6-b] Staging: Explore → Offering → Schedule → Pay, PayMongo test mode | You | ⬜ TODO | ⚠️ One attempt per booking — retry could double-charge (F3, parked P2) |
| [ ] | L3-a | Re-run the occupancy check on **production** | You | ⬜ TODO | Both RPCs reached prod *before* the numbers were confirmed anywhere |
| [ ] | L3-b | Walk `production-env-checklist.md` | You | ⬜ TODO | Not re-verified since the redesign landed |
| [ ] | L3-c | Decide: may the demo seed ever run on a hosted environment? | You | ⬜ TODO | My recommendation: **staging only, never production**. Not written down as a rule anywhere today |
| [x] | Grants | EXECUTE-grant query on staging **and** production | You | ✅ DONE 2026-09-28 | Both hosted environments match local; no `anon` on either function |
| [x] | Apply | `20260922000001` + `20260927000001` on local, staging, production | You | ✅ DONE 2026-09-27 | All three environments level |
| [x] | Machine | `tsc`, tests, lint, visual suite — local | Me | ✅ DONE 2026-09-29 | 154/154 · 73/73 twice · 4/4 · lint 18 pre-existing. ⚠️ Proves stability, not that it looks right |

---

## Verification — and its limits

| Stage | Machine-verifiable | Needs a live environment or a person |
|---|---|---|
| L0 | `tsc`, `npm test`, lint, the Playwright suite — all green | **Everything that matters here:** whether it looks right, and whether all five shelves appear |
| L1 | Nothing. The RPC's existence and grants are already proven | Two real booker accounts on staging |
| L2 | Nothing | Staging keys, PayMongo test mode, a browser |
| L3 | Nothing from this repo — the CLI is linked to staging | A production session |

⚠️ **The honest limit:** the visual suite became load-bearing for colour only on 2026-09-29. Every
"visual NN/NN" dated earlier in the redesign plan proved the baselines were *stable*, never that
they matched the code. L0-a is the first check that can catch a wrong palette.
