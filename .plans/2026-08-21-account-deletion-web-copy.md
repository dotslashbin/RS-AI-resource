# `ezzy.ph/account-data-deletion/` — section-by-section edits

**Date:** 2026-08-23 (supersedes the earlier draft of replacement copy)
**Page:** `https://ezzy.ph/account-data-deletion/` — 20 numbered sections
**Companion to:** `.plans/2026-08-21-vendor-account-deletion.md` (B7 / B8 / I14)

> **Rule for this document:** where published text and code disagree, **the website changes,
> not the code** (decided 2026-08-23). Nothing here asks for a code change.

> **W5 needs no edit.** It was the missing start-date disclosure, and it was resolved the
> other way — the promise was removed from the acknowledgement email (plan I16), so the
> page's silence is now correct rather than merely harmless. It is listed at the bottom for
> completeness only.

---

## FINAL — the copy to write

Every replacement below was re-checked against the code on 2026-08-23. **Two of my own
earlier suggestions did not survive that check and were corrected — see the notes under
W1 and W4b.**

| # | Section | Suggested replacement copy |
|---|---|---|
| **W1** | **§15** *If Your Closure Is Blocked* — replace the bullet list | Your closure will not go ahead while any of these are still open:<br>• **Bookings, reservations or orders that have not reached a final state** — anything not yet completed, cancelled or refunded<br>• **Payouts we have not released yet** — these clear on the next payout run<br>• **An open dispute involving your business** — we will resolve it with you first<br><br>We will tell you which of these applies, and what clears it. Once they are settled the closure goes ahead on its own — you do not need to ask again.<br><br>*(Keep the two explanatory sentences that already follow. Both are accurate.)* |
| **W2a** | **§1** *Account Closure Options* — add a third H5, **"My Login Only"** | Your personal sign-in is deleted and the business stays open, run by its other administrators. Its bookings, payouts and records are unaffected.<br><br>This option appears only when your business has another administrator who can continue managing it. If you are the only administrator, closing your login means closing the business too. |
| **W2b** | **§16** *After Business Closure* — add a third H5, **"My Login Only"** | The business continues trading as normal. You can no longer sign in, and you are removed from its list of administrators. The other administrators keep full access. |
| **W3** | **§2** *Information That May Be Retained* — add three bullets | • **A record that verification was completed**, including its outcome and dates. The documents themselves are deleted.<br>• **A record that this closure was requested and completed**, including the name and email address of the person who requested it.<br>• **A record that our policies were accepted** — which documents, which version, when, and the email address, IP address and device information captured at the time. |
| **W4a** | **§9** *Verification Documents* — replace the paragraph | When a business closure is completed, we delete the verification documents submitted during registration — the files themselves, not just our record of them. We keep only the record that verification took place and its outcome. |
| **W4b** | **§2** heading *"Information That May Be Deleted"* | **Leave it as it is.** See the correction note below — "may" is doing real work here. |
| **W5** | — | **No edit.** Resolved by removing the start-date promise from the email (plan I16); the page's silence is now correct. |
| *opt.* | §3 · §4 · §5 · §6 | Fold into §15 and renumber. §6 duplicates §3, and all four restate what §15 already covers. **Do last** — it renumbers everything above. |

### ⚠️ Correction 1 — W1's first bullet

Two earlier drafts of this line were both wrong, in different ways:

- *"…that are not yet completed or cancelled"* — **incomplete.** `refunded` is a **third**
  terminal state, and a refunded booking does **not** block a closure. That wording would
  have told a vendor a refunded booking was holding them up.
- *"…that are not finished"* — vague; a vendor could reasonably wonder whether a cancelled
  booking counts.

The final wording names all three terminal states, which is what
`BLOCKING_BOOKING_STATUSES` actually implies: the six states that block are everything
*except* `completed`, `cancelled` and `refunded`.

It also **drops the "complete or cancel them first" instruction** deliberately. A vendor
cannot always do either: once a booking is `fulfilled`, `in_progress` or `returned`,
cancellation is closed to them and the route is a dispute. The following sentence — *"We
will tell you which of these applies, and what clears it"* — carries the action honestly,
because the app really does say which.

### ⚠️ Correction 2 — W4b was wrong and is withdrawn

An earlier version of this table recommended renaming §2's *"Information That May Be
Deleted"* to *"Information We Delete"*, on the grounds that "may" understates.

**That was wrong.** What is deleted genuinely varies by which option the vendor picks:
`deletesUser` is false for **"the business only"**, so the login and password are **not**
deleted in that case — while the KYC documents always are. An absolute heading would
overstate for that scope.

"May" is doing real work on that heading. **W4a still stands** — the *verification
documents* line is unconditional whenever a business closes, and that one should be
definite.

---

## W1 — §15 *If Your Closure Is Blocked*

**Currently lists**, verbatim: `"Open bookings," "Upcoming reservations," "Pending orders,"
"Active service requests," "Pending or unreleased payouts," "Open disputes," "Outstanding
refunds," "Pending cancellations," "Chargebacks,"` and `"Other financial or contractual
obligations"`.

**What the code actually checks** — three counts, in
`vendor/lib/accountDeletion/eligibility.ts`, re-checked in both routes:

| Site term | Enforced? |
|---|---|
| Open bookings / Upcoming reservations / Pending orders / Active service requests | ✅ one check — a booking in `pending`, `confirmed`, `fulfilled`, `in_progress`, `returned` or `disputed` |
| Pending or unreleased payouts | ✅ `payout_status` in `held` or `releasable` |
| Open disputes | ✅ an `open` row in `booking_disputes` |
| **Outstanding refunds** | ❌ `refunded` is **terminal** and deliberately does **not** block |
| **Pending cancellations** | ❌ `cancelled` is likewise terminal and does **not** block |
| **Chargebacks** | ❌ **no chargeback concept exists anywhere in the schema** |
| **Other financial or contractual obligations** | ❌ nothing evaluates this |

Refunds and cancellations are the sharper problem: those states exist and are explicitly
treated as *not* blocking, so the page implies a hold that will never happen.

### Suggested replacement for the list

> Your closure will not go ahead while any of these are still open:
>
> - **Bookings, reservations or orders that are not finished** — complete or cancel them first
> - **Payouts we have not released yet** — these clear on the next payout run
> - **An open dispute involving your business** — we will resolve it with you first
>
> We will tell you which of these applies, and what clears it. Once they are settled, the
> closure goes ahead on its own — you do not need to ask again.

Keep the two explanatory sentences that already follow (the upcoming-booking one and the
dispute one). Both are accurate.

---

## W2 — §1 *Account Closure Options* and §16 *After Business Closure*

Both sections describe **two** options. The product offers **three**: `user_only` — *"My
login only"* — shown when the business has another active administrator, enforced
server-side by `checkScope()`, not merely hidden in the UI.

A vendor who is offered that choice currently finds no policy describing it.

### Add to §1, as a third option (H5: **"My Login Only"**)

> Your personal sign-in is deleted and the business stays open, run by its other
> administrators. Your bookings, payouts and records are unaffected.
>
> This option appears only when your business has another administrator who can continue
> managing it. If you are the only administrator, closing your login means closing the
> business too.

### Add to §16, as a third outcome (H5: **"My Login Only"**)

> The business continues trading as normal. You can no longer sign in, and you are removed
> from its list of administrators. The other administrators keep full access.

---

## W3 — §2 *Information That May Be Retained*

The list is otherwise accurate. Three retained categories are missing, all of them things a
person would be surprised to learn still exist:

> - **A record that verification was completed**, including its outcome and dates. The
>   documents themselves are deleted.
> - **A record that this closure was requested and completed**, including the name and email
>   address of the person who requested it.
> - **A record that our policies were accepted** — which documents, which version, when, and
>   the email address, IP address and device information captured at the time.

**The third is the one to get right.** `legal_acceptances` retains **IP address and
user-agent**, and nothing in the current list implies either. They are personal data
surviving a deletion.

---

## W4 — §9 *Verification Documents*

**Currently:** *"Verification documents submitted during vendor or Partner registration may
be removed when the applicable account or business closure is completed, where they are no
longer required."*

**What actually happens:** every file under the vendor's folder in the private `vendor-kyc`
bucket is deleted, along with every document record, using a paginated sweep that also
catches anything a partial run left behind. There is **no path** where a closure completes
and the documents survive.

### Suggested replacement

> When a business closure is completed, we delete the verification documents submitted
> during registration — the files themselves, not just our record of them. We keep only the
> record that verification took place and its outcome.

Keeping "may" is legally safe, but it invites the weakest reading of the strongest thing you
actually do. The same applies to §2's *"Information That May Be Deleted"* heading — consider
*"Information We Delete"*.

---

## W5 — no edit required

The page says nothing about a waiting period before Ezzy begins. That is now **correct**.

`scheduled_for` is advisory — Command executes manually and nothing refuses an early
execution — so the acknowledgement email used to promise a start date the system did not
enforce. Plan **I16** removed that promise from the email and from the Settings card rather
than publishing it. There is nothing to add here.

---

## Optional — structural tidy (not a correctness issue)

Four separate numbered sections cover what §15 already summarises, and two of them cover the
same thing:

| Section | Overlap |
|---|---|
| §3 Outstanding Bookings, Orders, and Services | the booking blocker |
| §6 Upcoming Bookings and Reservations | **the same blocker again** |
| §4 Pending Payouts | the payout blocker |
| §5 Open Disputes | the dispute blocker |

A reader meets the same three rules four times before reaching §15, which lists them once
more. **Nothing here is wrong** — this is purely about length, and W1's rewrite of §15
already makes the rules unambiguous. If you want the page shorter, folding §3–§6 into §15
and renumbering is the change. Do it last, after W1–W4, since it moves the section numbers
everything else refers to.

---

## Suggested order

1. **W3** — under-disclosure carries the legal weight
2. **W1** — describes a protection that does not exist
3. **W2** — a vendor can be offered an option no policy covers
4. **W4** — precision
5. *(optional)* the structural tidy, last, because it renumbers

None of this blocks the Play submission — the page already satisfies the Data safety
requirement, and `/account-data-deletion/` is the URL to give it.
