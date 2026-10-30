---
name: stakeholder-update-deck
description: Build a short, plain-language progress deck for a non-technical audience (stakeholders, management, partners, clients) from what was worked on in this workspace since a given date, published as a Slides artifact that downloads as .pptx and opens in Google Slides. Use whenever the user wants slides, a deck, a presentation or a meeting update about "what we did since <date>", "this week's progress", "report to stakeholders", "update for the meeting", or asks to simplify, shorten, rephrase or remove something in such a deck — even if they don't say "stakeholder" or "slides" outright. Not for technical stage reports, plan status tables (big-table) or commit summaries.
---

# Stakeholder update deck

Turn the work done in this workspace since a given date into a short slide deck that a
non-technical audience can follow in a meeting, and hand the user a link they can download
and open in Google Slides.

The audience is the whole point. Stakeholders care about **what customers can now do, what
is live, whether it was checked, and what happens next**. They do not care how it was built.
Every slide, headline and speaker note is written for someone who has never opened the
codebase and never will.

## Inputs

- **A start date** (required). "Since Saturday, Oct 24", "over the last week", "since the last
  meeting on the 20th". The range runs from that date to today unless the user gives an end.
  Check the weekday yourself (the user may misname it) and use the date in the deck.
- **Extra instructions** (optional): focus on one app, simplify, keep it to N slides, leave
  something out, rephrase a term, change the tone. These override the defaults below.
- **The headline message**, if the user gives one ("we built Booker and it's now live; the
  remaining patches are small and invisible"). That message is the spine of the deck — build
  everything around it rather than around the raw list of work.

If the date is missing, ask for it. Everything else has a sensible default; don't ask.

## Step 1 — Gather what happened (read only)

This is a workspace of independent repos, so one `git log` is not enough. Collect from:

1. `.plans/INDEX.md` — rows dated in the range, and the status line of any plan that
   shipped or closed in it.
2. `git log --since=<date> --format='%ad %s' --date=short` in the root **and** in each app
   folder (`booker`, `vendor`, `command`, `backbone`, `ezzy-booker-mobile`,
   `ezzy-vendor-mobile`). Version tags and "release" merges tell you what reached users.
3. For each plan that matters, read its top: title, `**Status:**` line and any
   "RESUME HERE" block. That block usually names what is live and what is still open.
   Older feature plans often still say "production ⏸" after their work went live inside a
   later release. When a launch or release plan names the version now live, trust that over
   the older plans' lines, and confirm with `git log` in the app that the feature's commits
   are on the branch that version was cut from.
4. The app's nested `AGENTS.md` when you need to understand what a feature does for a user.

Then sort what you found into four piles:

| Pile | Goes in the deck? |
|---|---|
| Customer-visible features and changes | Yes, as the main content |
| Launch / go-live / release milestones | Yes, usually as the headline |
| Checks done before release (testing on staging, devices, payments) | Yes, one reassurance slide |
| Still open: patches, parked checks, known gaps | Yes, as "next few days" |
| Internal tooling, skills, plans, docs, refactors, lint, CI | **No.** Nobody in the room benefits |

Never invent a number, date, quote or customer count. If a slide wants a figure you don't
have, leave it out rather than estimate.

## Step 2 — Translate into plain language

Read `references/plain-language.md` before writing a word of slide text. It has the
term-by-term translations used in this workspace (staging → "a practice copy", production →
"the live site", migration → leave out, and so on) and the tone rules.

The test for every line: **could a shop owner who has never seen the app understand it, and
does it tell them something they care about?** If not, rewrite it or cut it.

Handling open items honestly matters more than making the deck look clean:

- Describe them by their effect on people ("making sure past sessions can't be booked from a
  device set to another time zone"), not by their cause.
- If the user said the remaining work is "small" or "not visible", frame it that way — but
  don't hide a real known problem. If an open item could worry stakeholders (a bug, a
  payment path not yet proven live), keep it in and **tell the user in your reply** that the
  slide mentions it, so they can choose to soften or drop it. That choice is theirs.

## Step 3 — Build the deck

Default structure (8 slides; fewer if the user asks to simplify, never padded to reach 8):

1. **Cover** — the headline as a title ("Ezzy Booker is live"), date range as an eyebrow.
2. **The headline** — one statement on the accent background ("Live for customers since
   October 29") and one sentence of what customers can now do.
3. **What we finished** — up to four cards, each a title and one sentence.
4. **A second group of improvements**, only if there are genuinely more worth naming
   (e.g. account safety). Otherwise drop it.
5. **How we checked it** — a short checklist of what was tested before going live.
6. **The week at a glance** — a 3–5 point timeline by date.
7. **Next few days** — up to three open items, framed as above.
8. **In short** — three-line recap and "Questions?".

One idea per slide; a statement beats a bullet list. Speaker notes on every slide, in the
same plain language, written as what the user would say out loud (1–3 sentences).

**Branding — minimal.** Use only what the app already ships:

- Logo: the app's `public/icons/icon-512.png`. Copy it into the deck's own folder and upload
  that copy as an asset, so the deck folder holds everything the deck uses. Use it on the
  cover and the last slide only.
- Brand colour: `theme_color` in the app's `app/manifest.ts` (Ezzy blue `#034bfc`), with
  `background_color` (`#0b1020`) as the dark tone and a near-white (`#f6f8fc`) as the light.
- Typeface: the app's own font from its `AGENTS.md` (Poppins for booker), one family.

No division icons, banner artwork or screenshots unless the user asks — they add noise and
can look wrong in the Google Slides import.

**Publishing.** Use the Artifact tool's Slides type: `action: "quickstart"` with
`intent: "slides"` and `design_systems: false`, because the app's own branding above
replaces any design system. Create the deck from the returned `type_url`, then follow the
type's own instructions: the index file first with the full slide order, then the cover,
then the rest a few files per publish. Skip the type's step that lists design systems.

Give every deck **its own new folder** in the scratchpad, named for that deck:
`<scratchpad>/stakeholder-deck-<today>-<short-topic>/` (e.g.
`stakeholder-deck-2026-10-30-booker-launch/`), and check it does not already exist before
writing — add `-2`, `-3` if it does. Never write into a folder another deck was built in, even
a generic-looking one like `deck/`: those files are the local source of a different
published deck, and overwriting them means the next revision of that deck republishes the
wrong text. When revising, work in the folder this deck was built in; if that's unknown (a
new session), `read` the deck's files from its artifact URL into a fresh folder first.

`references/slide-patterns.md` holds the slide markup that worked for each slide kind
above. Start from it rather than designing from scratch. Copy its layout only: its words
describe one specific week, so every claim on your slides comes from what you gathered in
Step 1, even when the date range matches.

Don't render, screenshot or re-read the deck to check it unless the user asks.

## Step 4 — Hand it over

Reply with:

- The artifact link.
- **How to get it into Google Slides**: download as PowerPoint (.pptx) from the page, then in
  Google Drive, *New → File upload*, open it and choose *Open with Google Slides*. If the page
  shows a "Send to Google Drive" option, that skips the upload.
- One line per slide on what it says, so the user can approve without opening it.
- Caveats, briefly: it was not visually checked; Google Slides may substitute the font if it
  isn't available there; the link is private until shared; and any slide that mentions a
  sensitive open item (Step 2).

## Revising

Users will come back with "remove X", "call it Y instead", "make it simpler", "drop the
timeline". When they do:

- **Change it everywhere it appears** — slide text, the timeline, the recap slide **and the
  speaker notes**. A renamed feature that survives in one note or the recap is the most
  common miss. `grep -n` the slide files for the old wording before you publish.
- Change only what was asked; keep everything else exactly as it was.
- Publish only the changed files to the same artifact URL (adding or removing a slide also
  means updating the index's `order`).
- Remind the user to download again if they already had the .pptx.
- "Simplify" means fewer slides and fewer words per slide — merge or drop, don't shrink the
  font.
