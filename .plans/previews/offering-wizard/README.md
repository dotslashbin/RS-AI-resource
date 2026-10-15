# Offering creation wizard — visual previews

**Date:** 2026-10-12 · **Plan:** [`2026-10-12-vendor-offering-creation-wizard.md`](../../2026-10-12-vendor-offering-creation-wizard.md) · **Status:** for review before plan approval — not an implementation.

Open [index.html](index.html) directly in a browser (no server). The **PREVIEW** bar (bottom right) picks a screen and theme; the wizard's own Next / Back / Cancel / Close buttons also walk through the screens. Query parameters select a state, e.g. `index.html?screen=review&theme=dark`. Narrow the window below 640px to see the phone layout.

## What it shows

The flow as resolved by D1–D6: five steps, the review **before** the one irreversible button ("Save offering", D1), no Back on step 5, the existing `SchedulePromptModal` after Finish (D4), a full-screen sheet below 640px and today's centred card above (D5), photos optional (D6).

## Design fit

- Colours are the vendor `:root` / `.dark` tokens copied from `vendor/app/globals.css`; fields copy the Tailwind classes in `OfferingFormModal.tsx`; the attachments step copies `OfferingAttachmentsEditor` (badges, counter, 120×90 add tile, copy). Nothing new is introduced visually except the step header (step text + segmented progress, the KYC wizard's pattern), the review cards and the discard confirm.
- The phone sheet uses `--sp-modal-bg` (opaque `#0a0f1a` in dark) — this resolves the token question in plan I3. The desktop card is today's 520px frame.
- Every tappable control in the footer is ≥ 44px tall.
- **Additional packages required: none.** Icons are inline copies of `lucide-react` glyphs the app already uses.

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network (verified). Field values are fixed per screen. Screen-reader structure (dialog labelling, `aria-current="step"`, `role="switch"`, `aria-invalid`) is sketched in the markup but focus movement and live announcements are **not** simulated — those are plan I4 and get checked in the real build. Input text stays 13px as in the app; iOS zoom-on-focus is deferred as plan F2.

Two small copy additions appear here that the current form does not have: "Up to 6 letters or numbers." under Short code (the field already truncates to 6) and "Fill in this requirement or remove it." under a blank requirement. Neither is a new rule.

## Screenshots

Desktop 1280×800; phone 390×844 at 2× (initial viewport — steps that scroll show their top).

| Screen | Desktop | Phone |
|---|---|---|
| 1 · The basics — empty, Next disabled with the reason | [light](basics-empty-desktop-light.png) · [dark](basics-empty-desktop-dark.png) | [light](basics-empty-mobile-light.png) · [dark](basics-empty-mobile-dark.png) |
| 1 · The basics — filled | [light](basics-desktop-light.png) · [dark](basics-desktop-dark.png) | [light](basics-mobile-light.png) · [dark](basics-mobile-dark.png) |
| 1 · Short code already used — error under the field | [light](basics-dupe-desktop-light.png) · [dark](basics-dupe-desktop-dark.png) | [light](basics-dupe-mobile-light.png) · [dark](basics-dupe-mobile-dark.png) |
| 2 · Price and length | [light](price-desktop-light.png) · [dark](price-desktop-dark.png) | [light](price-mobile-light.png) · [dark](price-mobile-dark.png) |
| 3 · How it works | [light](how-desktop-light.png) · [dark](how-desktop-dark.png) | [light](how-mobile-light.png) · [dark](how-mobile-dark.png) |
| 3 · Blank requirement — Next disabled with the reason | [light](how-blank-desktop-light.png) · [dark](how-blank-desktop-dark.png) | [light](how-blank-mobile-light.png) · [dark](how-blank-mobile-dark.png) |
| 4 · Check and save | [light](review-desktop-light.png) · [dark](review-desktop-dark.png) | [light](review-mobile-light.png) · [dark](review-mobile-dark.png) |
| 4 · Price left blank shows as Free (₱0) | [light](review-free-desktop-light.png) · [dark](review-free-desktop-dark.png) | [light](review-free-mobile-light.png) · [dark](review-free-mobile-dark.png) |
| 4 · Save failed — values kept, retry in place | [light](review-error-desktop-light.png) · [dark](review-error-desktop-dark.png) | [light](review-error-mobile-light.png) · [dark](review-error-mobile-dark.png) |
| 5 · Photos and documents — saved, no Back, Finish | [light](photos-desktop-light.png) · [dark](photos-desktop-dark.png) | [light](photos-mobile-light.png) · [dark](photos-mobile-dark.png) |
| Cancel before saving — in-dialog discard confirm | [light](discard-desktop-light.png) · [dark](discard-desktop-dark.png) | [light](discard-mobile-light.png) · [dark](discard-mobile-dark.png) |
| After Finish — the existing schedule prompt, unchanged | [light](prompt-desktop-light.png) · [dark](prompt-desktop-dark.png) | [light](prompt-mobile-light.png) · [dark](prompt-mobile-dark.png) |

## Verification (2026-10-12)

`node --check preview.js` passed. Playwright (vendor's installed Chromium) rendered 12 screens × 2 viewports × 2 themes = 48 PNGs: no page errors, no console errors, no non-`file:` requests, no horizontal overflow. Sample images inspected by eye: basics-empty desktop/light, basics-dupe desktop/dark, review mobile/dark, photos mobile/light, discard mobile/light.
