# Payout & completion — deferred follow-ups

**Date:** 2026-08-16
**App / scope:** `ezzy-vendor-mobile`, `backbone/`, `command/`, `vendor/` — one item each
**Status:** DRAFT — nothing started; every item is a deliberate deferral, not a gap

> Everything consciously left out of
> `.plans/2026-08-15-vendor-account-completion-and-payout-details.md`, gathered so the
> decisions survive their context. **Each item names who deferred it and what unblocks
> it.** This is a holding document, not a commitment to build any of it.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** D# = Deferred item; numbers are plan-local — qualify cross-plan
> refs by app (e.g. "payout C2"). Cross-plan references use the source plan's own ids.

---

## Where this came from

The payout plan shipped in two phases: vendors save an encrypted payout destination, and
Command staff read it to make a **manual bank transfer**. It is **complete and on
staging** as of 2026-08-16.

Five items were deferred along the way, from two different sources: **D1–D3 the user
deferred explicitly**, and **D4–D5 I deferred mid-execution as out of scope**. The
distinction matters — the first three are product decisions to revisit when the business
wants them, the last two are engineering debt I chose not to pay at the time.

⚠️ **The load-bearing context, in one paragraph.** There is **no payout rail**. PayMongo
is wired for collection only; `release_booking_payouts()` *records* a disbursement made
somewhere else. Payout destinations are AES-256-GCM ciphertext bound to their vendor row
(AAD), with a key held in **both** `vendor` and `command` and stored in neither database.
Changes are audited in `vendor_payout_method_log`; **reads** are audited in
`vendor_payout_view_log`. Every item below sits on top of that.

---

## DEFERRED ITEMS

### D1 — `ezzy-vendor-mobile` has no account-completion surface ⏸ PARKED
**Deferred by:** the user, 2026-08-16 — *"I will think about mobile later."*
**Unblocks when:** they decide to take it.
**Source:** payout plan C1.

The web vendor portal shows an onboarding modal and a header indicator while an account
is incomplete. `ezzy-vendor-mobile` shows neither, so **a vendor who onboards on mobile
is never prompted** to add an offering or payout details.

**Not a disagreement between the clients — an absence in one.** `architecture/portals.md`
requires the two vendor clients to agree where they overlap; here they do not overlap at
all. That is a smaller problem than drift, and it is why this was safe to park.

**What it would take, and the part that is now easy:** the rule already lives in the
database (`vendor_account_completion`), so mobile does **not** need to reimplement it —
one `select` and it has the same verdict the web app has. That was the expensive half and
it is already paid for. What remains is genuinely mobile work: where the prompt lives in a
tab-based app, and whether payout entry belongs on a phone at all.

⚠️ **Decide payout ENTRY separately from the prompt.** Showing "you still need payout
details" on mobile is cheap and safe. Letting a vendor *enter* them there means a second
client handling bank details, a second place for that form to be wrong, and a store
review that will ask about it. The prompt could reasonably deep-link to the web portal
instead. **Do not treat these as one task.**

**Also read first:** `.claude/skills/mobile-dev/SKILL.md` (store compliance is a build
requirement here), and note `ezzy-vendor-mobile` uses `StyleSheet` + `Name.styles.ts`,
not NativeWind.

---

### D2 — No notification when a payout destination changes ⏸ DEFERRED
**Deferred by:** the user, 2026-08-16 — *"no notifications are needed for now."*
**Unblocks when:** notifications are wanted, or the vendor base grows enough that
unnoticed changes become a real risk.
**Source:** payout plan C3.

A vendor learns their payout destination changed only by looking at Settings. **A changed
payout destination is the highest-value target in the system** — it is the single edit
that redirects real money — and the account-takeover shape is: get a session, change the
destination, wait for the next payout run.

**What stands in its place today, and it is not nothing:**
- `vendor_payout_method_log` records every change (who, when, from → to, masked)
- `vendor_payout_view_log` records every Command decrypt (who, when)
- Changing a destination requires **full re-entry** — saved values are never returned to
  a browser, so a stolen session can overwrite but cannot *read*
- `vendor_payout_methods.updated_at` is surfaced in Command's modal, so staff see a
  destination changed minutes before a payout

Those are all **detective** controls: they make an attack reviewable afterwards. A
notification is the only **preventive** one — it puts the vendor in the loop while it is
still happening. That is the gap, stated plainly.

**What it would take:** seed a `payout_details_changed` notification type and a trigger on
`vendor_payout_methods`, riding the existing pipeline
(`architecture/email-notifications-guide.md`; precedent
`20260808000001_vendor_lifecycle_notification_types.sql`). A backbone change, so a
migration and its own approval.

⚠️ **The notification must carry the MASKED value only** (`display.masked`), never the
account number. An email that quotes a bank account defeats the encryption it sits beside
— and email is the least controlled surface in the system.

---

### D3 — No payout rail ⏸ DEFERRED
**Deferred by:** the user, 2026-08-16. Never in the payout plan's scope.
**Unblocks when:** the business wants automated disbursement rather than manual transfers.

⚠️ **Recorded mainly so nobody reads "payouts" in this codebase as "money moves."**
`release_booking_payouts()` marks a transaction `released` — it **records a transfer made
somewhere else**. Command's payout modal exists so a human can copy details into a banking
app. Nothing in the system moves money, and there is no refund mechanism either
(PayMongo's refund API is never called).

**If a rail is ever adopted, the data model is ready and the plan says how:**
`vendor_payout_methods.schema_version` exists exactly for this. A provider demanding
beneficiary first/last name, an institution code or KYC fields lands as `version: 2` of a
method type — **not** as new columns, and not as a rewrite of existing rows.

⚠️ **Do not design the rail from the consumer transfer interface.** The payout plan's own
investigation makes the point: the fields collected today are what a *human* needs for an
InstaPay/PESONet transfer. A provider API may want more, less, or differently-shaped data,
and it may offer **beneficiary tokenisation** — in which case storing the provider's
recipient reference is better than continuing to hold raw account numbers at all. Check
what the provider actually requires before extending anything.

**Unresolved and inherited:** `architecture/portals.md` records that money from a
paid-then-cancelled booking currently belongs to neither party. A rail has to resolve
that, not step around it.

---

### D4 — Command's Playwright harness is unusable ⬜ TODO
**Deferred by:** me, 2026-08-16 — out of scope mid-execution.
**Unblocks when:** anyone wants automated coverage of Command's UI.
**Files:** `command/playwright.config.ts`

`conventions.md` already records this and it bit during Phase 2: Command's config uses
**port 3100, colliding with `vendor`**, and still points at **`127.0.0.1`** rather than
`localhost`. The second is the dangerous one — Next refuses its own dev resources
cross-origin over `127.0.0.1`, so **the page renders, React never hydrates, and no
`onClick` fires anywhere**. Every interaction test fails while the screenshot looks
correct, which sends you hunting in the tests instead of the config.

Consequence today: **Command has no `visual-tests/` at all.** The payout modal and card
badges were verified by a throwaway Playwright script on port 3300, which proved the
behaviour but left nothing committed.

**What it would take:** change the port (3400 is free — booker holds 3200), switch to
`localhost`, then port the throwaway script into a real `visual-tests/pilot.spec.ts`.
⚠️ **Any interactive baseline recorded before the `127.0.0.1` fix is worthless** — do not
trust existing ones if any appear.

---

### D5 — Vendor's completion matrix no longer fails fast ⬜ TODO
**Deferred by:** me, 2026-08-16 — an accepted cost of moving the rule into the database.
**Unblocks when:** the slower feedback actually bites.

Moving completion into `vendor_account_completion` retired `deriveCompletion()` and its
**12 unit assertions**. The matrix is still covered — by a rolled-back SQL probe and a
13-assertion browser run — but both need a **database**, so `npm test` no longer says
anything about the completion rule.

**Deliberate, and the trade was the right way round:** the tests now exercise the actual
authority rather than a TypeScript copy of it. But the honest cost is that a broken
completion rule is no longer caught in seconds by `npm test`; it is caught minutes later,
by something that needs Supabase running.

**If it becomes annoying:** a `node --test` suite that runs the view's own SQL against a
local database would restore fast feedback without reintroducing a second copy of the
rule. That is a test-infrastructure change, not a code one.

---

## DECISIONS

<!-- Nothing here may execute while an OPEN: line remains. There are none — every item
     is deferred by an explicit decision, recorded with its owner. -->

- **D1 mobile** → ⏸ parked by the user (2026-08-16). The completion *rule* is already
  shared via the database, so only mobile-specific work remains.
- **D2 notifications** → ⏸ deferred by the user (2026-08-16); detective controls
  (change log, view log, forced re-entry) stand in for the preventive one.
- **D3 payout rail** → ⏸ deferred by the user (2026-08-16); never in scope.
- **D4 command Playwright** / **D5 fast completion tests** → ⬜ mine, deferred as
  out-of-scope during execution. Neither blocks anything shipped.

---

## Execution order

No stages, deliberately — these are independent and none is scheduled.

If they are ever picked up, the **only** ordering constraint worth honouring:

1. **D4 before any further Command UI work.** Without a working harness, Command UI
   changes are verified by throwaway scripts that leave nothing behind — which is what
   happened in Phase 2 and is exactly the state D4 exists to end.

D1, D2, D3 and D5 are independent of each other and of D4.

**Cheapest first, if that matters:** D4 (a config change plus porting an existing script)
→ D5 (test infrastructure) → D2 (one migration, existing pipeline) → D1 (a mobile feature)
→ D3 (a payments integration).

---

## Verification

Nothing to verify — nothing is built. Recorded here so each item arrives with its check
already chosen:

| Item | How it would be verified | Kind |
|---|---|---|
| D1 | The prompt appears on a real device for an incomplete vendor and not for a complete one; the verdict matches the web portal for the same vendor | needs a device |
| D2 | Changing a destination delivers a notification carrying **only** the masked value — assert the account number is absent from the payload | needs live environment |
| D3 | Whatever the provider's sandbox offers; plus that `schema_version` bumped rather than columns being added | needs live environment |
| D4 | `npx playwright test` passes from `command/` with a real interaction (a click that changes the DOM), proving hydration — the thing `127.0.0.1` silently breaks | machine-verifiable |
| D5 | `npm test` in `vendor` fails when the view's rule is deliberately broken | machine-verifiable |

---

## Related

- `.plans/2026-08-15-vendor-account-completion-and-payout-details.md` — the completed plan these came from (C1, C3, and the in-flight notes)
- `.plans/2026-08-15-vendor-form-modals-to-radix-dialog.md` — **I6 turned out to be already done** (marker corrected 2026-08-16; verified 7/7 vendor dialogs emit zero Radix accessible-name warnings). Its **I2** (native date/time pickers vs. the outside-click guard) and **I3** (`window.confirm` from inside an open dialog) remain ⬜ — the nearest open work to this plan, though unrelated to payouts
- `architecture/portals.md` — the "no payout rail" and paid-then-cancelled gaps
- `architecture/schema.md` — `vendor_payout_methods`, the two log tables, and the completion view
