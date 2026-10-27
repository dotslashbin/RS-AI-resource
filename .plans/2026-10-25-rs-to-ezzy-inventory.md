# RS naming audit — location inventory

**Date:** 2026-10-25
**Purpose:** Evidence appendix for `2026-10-25-rs-to-ezzy-cleanup.md`; this is a search inventory, not a replacement list. Counts are matched lines, not individual occurrences.

## Coverage and reproducibility

Searched hidden and ignored first-party text across the whole workspace, including all five apps, backbone, website, prototypes, architecture, plans, previews, scripts, skills, design reviews and other root folders. Pattern: case-insensitive `\brs\b|\brs[_-]`. The underscore branch catches `rs_selected_vendor`. Filename review additionally found `.idea/RS.iml` and `website/rs-logo.jpeg`.

Excluded credential/env files, `.aws`, local agent settings, Git internals/history, dependencies, lockfiles, generated build/cache/native dependency directories, logs, test reports, source maps, SVG payloads and third-party `.agents` skills/plugin caches. Binary art was not OCR-audited. IDE metadata is listed separately below. No external user configuration or hosted systems inspected. No zero-hit claim extends to those exclusions.

Correction to the initial broad search: `architecture/schema.md:54` and backend index names such as `vendor_members_vendor_id_idx` were suffix matches on `members_`, not RS naming. The final word-boundary scan excludes them; preserve them. All locations below require classification before editing. Historical fixtures, paths and evidence often must remain unchanged. This appendix and its parent plan were created after the scan and are intentionally outside their own baseline.

## Baseline counts

| Area | Files | Matched lines |
|---|---:|---:|
| `.claude` | 1 | 1 |
| `.plans` | 66 | 344 |
| `Root documents` | 3 | 9 |
| `architecture` | 3 | 6 |
| `booker` | 3 | 4 |
| `command` | 129 | 703 |
| `ezzy-vendor-mobile` | 1 | 2 |
| `prototypes` | 6 | 6 |
| `vendor` | 4 | 5 |
| `website` | 1 | 17 |
| **Total** | **217** | **1097** |

Zero matching first-party text files under the stated exclusions: `ezzy-booker-mobile`, backend SQL/seed/functions, `scripts`, `supabase`, `test-db`, `design-reviews`, `division_logos`, `partner_routing`. Backbone has no matching first-party source; initial suffix false positives were discarded. Mobile vendor hits are instruction paths only.

## Locations

| File | Matching line numbers |
|---|---|
| `.claude/skills/core-rules/SKILL.md` | 12 |
| `.plans/2026-05-16-paymongo-integration.md` | 1, 169 |
| `.plans/2026-05-18-learner-login-mobile.md` | 66 |
| `.plans/2026-05-25-notifications.md` | 9 |
| `.plans/2026-06-09-prod-readiness-academy.md` | 27 |
| `.plans/2026-06-09-prod-readiness-command.md` | 46, 76 |
| `.plans/2026-06-12-platform-pivot-vendor-booker.md` | 81 |
| `.plans/2026-06-18-platform-pivot-execution.md` | 105, 113, 139, 149 |
| `.plans/2026-07-14-app-name-env-var.md` | 59, 107, 121 |
| `.plans/2026-07-24-vendor-divisions.md` | 240 |
| `.plans/2026-07-25-vendor-transactions-platform-fee.md` | 597 |
| `.plans/2026-07-27-ezzy-vendor-mobile-companion.md` | 984 |
| `.plans/2026-07-29-vendor-mobile-styling-branding.md` | 185 |
| `.plans/2026-07-31-booking-fulfilment-dual-acknowledgement.md` | 1940 |
| `.plans/2026-08-02-web-apps-search-engine-exposure.md` | 33 |
| `.plans/2026-08-04-vendor-stale-service-worker-cache.md` | 30, 172 |
| `.plans/2026-08-10-recovery-gate-escape-and-settings-password.md` | 98, 321 |
| `.plans/2026-08-17-command-new-user-password-onboarding.md` | 1050, 1144 |
| `.plans/2026-08-18-command-vendor-nav-branding-responsive.md` | 72, 89, 473, 505, 506, 507, 535, 829, 1021, 1201 |
| `.plans/2026-08-21-web-apps-seo-indexing-audit.md` | 238, 680, 723 |
| `.plans/2026-08-26-vendor-kiosk-mode-and-offering-attachments.md` | 4925, 4936 |
| `.plans/2026-09-03-vendor-mobile-kiosk-mode.md` | 146, 147, 150, 157 |
| `.plans/2026-09-11-command-payout-details-withholding-ezzy-fee.md` | 1008 |
| `.plans/2026-09-13-command-mark-paid-invoice-and-pesonet-template-REVISIT.md` | 632 |
| `.plans/2026-09-17-affiliate-referral-codes-interim.md` | 2108 |
| `.plans/2026-09-18-booker-home-search-redesign.md` | 2319 |
| `.plans/2026-09-24-local-docs-search-rag.md` | 4, 5, 109, 110, 112, 120, 121, 132, 137, 138, 140, 162, 199, 200, 209, 211, 248, 285, 289, 299, 304 |
| `.plans/2026-09-25-vendor-password-recovery-cross-browser-fix.md` | 91, 98, 312 |
| `.plans/2026-09-28-vendor-kiosk-unavailable-in-production.md` | 104, 228 |
| `.plans/2026-09-29-booker-poppins-base-font.md` | 241 |
| `.plans/2026-10-11-checkout-provider-verification.md` | 41, 53, 89, 122, 123, 137, 139 |
| `.plans/2026-10-14-booker-near-me-discovery.md` | 1944, 2798 |
| `.plans/2026-10-15-checkout-s2-candidate-review.md` | 18, 6243, 6585, 6636, 6644, 6847, 6853, 6955 |
| `.plans/2026-10-15-split-agents-md-into-skills.md` | 53, 163 |
| `.plans/2026-10-18-design-preview-harness.md` | 97, 260 |
| `.plans/2026-10-20-checkout-s2-health-candidate.md` | 273 |
| `.plans/2026-10-20-dark-mode-lift.md` | 27, 130, 151, 386, 466, 470, 472 |
| `.plans/2026-10-21-checkout-s2-recovery-candidate.md` | 22 |
| `.plans/INDEX.md` | 14, 15, 186 |
| `.plans/previews/_shared/command.css` | 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 76, 81, 82, 83, 84, 85, 86, 87, 90, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105 |
| `.plans/previews/_shared/preview-chrome.css` | 8 |
| `.plans/previews/_shared/shoot.mjs` | 438 |
| `.plans/previews/booker-banner-carousel/chrome.css` | 8 |
| `.plans/previews/booker-home-divisions-layout/build-logos.mjs` | 6, 8 |
| `.plans/previews/booker-home-divisions-layout/chrome.css` | 8 |
| `.plans/previews/booker-home-divisions-layout/measure.mjs` | 20 |
| `.plans/previews/booker-home-duo/chrome.css` | 8 |
| `.plans/previews/booker-mobile-spacing-colours/chrome.css` | 8 |
| `.plans/previews/booker-ui/chrome.css` | 8 |
| `.plans/previews/booker-web-division-spacing/chrome.css` | 8 |
| `.plans/previews/dark-lift-booker/chrome.css` | 8 |
| `.plans/previews/dark-lift-booker/preview.css` | 15 |
| `.plans/previews/dark-lift-command/README.md` | 17, 28, 31, 52 |
| `.plans/previews/dark-lift-command/chrome.css` | 8 |
| `.plans/previews/dark-lift-command/preview.css` | 20, 21, 22, 23, 24, 25, 26, 27, 28, 34, 35, 36, 37, 38, 39, 40, 43, 44, 45, 46, 47, 50, 51, 52, 53, 56, 57, 65, 66, 71, 75, 80, 81, 87, 88, 89, 98, 105, 107, 108, 113, 114, 116, 126, 127, 129, 131, 134, 135 |
| `.plans/previews/dark-lift-command/screens.js` | 5, 56, 57, 58, 62, 64, 75, 80, 85, 88, 91, 96, 101, 104 |
| `.plans/previews/dark-lift-command/tokens.css` | 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 74, 79, 80, 81, 82, 83, 84, 85, 88, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103 |
| `.plans/previews/dark-lift-vendor/chrome.css` | 8 |
| `.plans/previews/dark-lift-vendor/preview.css` | 15 |
| `.plans/previews/kiosk-binding/README.md` | 5 |
| `.plans/scripts/README.md` | 87, 153, 215 |
| `.plans/scripts/build-division-mask-css.mjs` | 4, 7, 8 |
| `.plans/scripts/check-checkout-candidate-syntax.py` | 18 |
| `.plans/scripts/checkout-provider-runner.mjs` | 9, 10, 11, 14, 109, 130, 179 |
| `.plans/scripts/checkout-provider-runner.test.mjs` | 13, 22, 68, 223, 224 |
| `.plans/scripts/run-checkout-provider-tests.bash` | 29 |
| `.plans/scripts/s1-tier-ladder-differential.ts` | 29, 30 |
| `AGENTS.md.backup` | 7 |
| `CHECKOUT-HANDOFF.md` | 165, 307, 461, 471, 636, 651, 782 |
| `architecture/auth-and-roles.md` | 135 |
| `architecture/staging-readonly-role.md` | 47, 58, 113, 117 |
| `architecture/supabase-production-setup.md` | 53 |
| `booker/components/auth/LoginPage/useLoginPage.ts` | 19 |
| `booker/components/layout/Sidebar/Sidebar.tsx` | 58, 59 |
| `booker/lib/supabase/client.ts` | 43 |
| `command/README.md` | 1 |
| `command/app/error.tsx` | 16, 17, 18, 19 |
| `command/app/globals.css` | 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156 |
| `command/app/not-found.tsx` | 5, 6, 7, 8 |
| `command/app/ui-gallery/page.tsx` | 178, 213, 217, 459, 491, 492, 688, 731 |
| `command/components/closures/ClosureQueue/ClosureQueue.module.css` | 8, 17, 37, 44, 78, 79, 85, 98, 109, 128, 138, 143, 153, 154, 156, 175, 177, 197 |
| `command/components/closures/ClosureQueue/ClosureQueue.tsx` | 60, 63, 67, 78 |
| `command/components/dev/DevVersionBadge.tsx` | 6, 8 |
| `command/components/flags/FlagQueueView/FlagQueueView.module.css` | 8, 17, 37, 44, 86, 87, 90, 108, 110, 132, 136, 152, 164, 171, 183, 184, 185 |
| `command/components/flags/FlagQueueView/FlagQueueView.tsx` | 71, 74, 78, 85 |
| `command/components/layout/AppHeader/AppHeader.module.css` | 20, 27, 33, 65, 90 |
| `command/components/layout/AppHeader/AppHeader.tsx` | 39, 61, 79, 88 |
| `command/components/layout/AppShell/AppShell.tsx` | 61, 62 |
| `command/components/layout/InstallPrompt/InstallPrompt.module.css` | 5, 57, 64, 99 |
| `command/components/layout/InstallPrompt/InstallPrompt.tsx` | 14, 15, 26, 60 |
| `command/components/layout/LegalMenu/LegalMenu.module.css` | 15, 22, 53, 60, 61, 86 |
| `command/components/layout/LegalMenu/LegalMenu.tsx` | 38 |
| `command/components/layout/NotificationPanel/NotificationItem.module.css` | 3, 26, 33, 40, 71, 72, 73, 81, 82, 83 |
| `command/components/layout/NotificationPanel/NotificationPanel.module.css` | 15, 52, 58, 65, 74, 75, 76, 98, 107 |
| `command/components/layout/NotificationPanel/NotificationPanel.tsx` | 27 |
| `command/components/layout/Sidebar/Sidebar.module.css` | 21, 44, 51, 58, 69, 78, 110, 154, 163, 171, 183, 188 |
| `command/components/layout/Sidebar/Sidebar.tsx` | 23, 26, 65, 70, 83 |
| `command/components/layout/TabBar/TabBar.module.css` | 23, 30, 39 |
| `command/components/layout/TabBar/TabBar.tsx` | 12 |
| `command/components/overview/BookingTrendsCard/BookingTrendsCard.module.css` | 6, 13, 37 |
| `command/components/overview/BookingTrendsCard/BookingTrendsCard.tsx` | 9 |
| `command/components/overview/ClosureRequestsCard/ClosureRequestsCard.module.css` | 15, 29, 37, 42, 56, 58 |
| `command/components/overview/ClosureRequestsCard/ClosureRequestsCard.tsx` | 27 |
| `command/components/overview/FulfilmentOversightCard/FulfilmentOversightCard.module.css` | 4, 12, 13, 18, 26, 32, 44, 45, 49, 50, 58, 60, 74, 77, 86, 92, 93, 101, 102, 103 |
| `command/components/overview/FulfilmentOversightCard/FulfilmentOversightCard.tsx` | 16 |
| `command/components/overview/KpiCard/KpiCard.module.css` | 13, 28 |
| `command/components/overview/KpiCard/KpiCard.tsx` | 20 |
| `command/components/overview/PaymentMethodsCard/PaymentMethodsCard.module.css` | 12, 18, 57, 62, 70 |
| `command/components/overview/PaymentMethodsCard/PaymentMethodsCard.tsx` | 14 |
| `command/components/overview/VendorTrendsCard/VendorTrendsCard.module.css` | 6, 13, 50, 59, 69 |
| `command/components/overview/VendorTrendsCard/VendorTrendsCard.tsx` | 13, 19 |
| `command/components/overview/WalletBalancesCard/WalletBalancesCard.module.css` | 12, 18, 24, 40, 46, 54 |
| `command/components/overview/WalletBalancesCard/WalletBalancesCard.tsx` | 16 |
| `command/components/payouts/MarkPaidModal/MarkPaidModal.module.css` | 37, 42, 43, 52, 69, 72, 84, 101, 105, 107, 111, 124, 129, 132, 143, 146, 147, 160, 174, 226 |
| `command/components/payouts/MarkPaidModal/MarkPaidModal.tsx` | 54, 61 |
| `command/components/payouts/PayoutBucketCards/PayoutBucketCards.module.css` | 16, 17, 18, 41, 77, 86, 93, 108 |
| `command/components/payouts/PayoutCorrectionForm/PayoutCorrectionForm.module.css` | 3, 9, 15, 26, 36, 41, 42, 46, 88, 89, 95 |
| `command/components/payouts/PayoutCorrectionForm/PayoutCorrectionForm.tsx` | 52, 64, 76, 92 |
| `command/components/payouts/PayoutDetailModal/PayoutDetailModal.module.css` | 37, 45, 50, 61, 76, 85, 89, 94, 100, 111, 118, 126, 133, 136, 140, 172, 177, 210, 211, 214, 220, 225, 230, 231, 232 |
| `command/components/payouts/PayoutDetailModal/PayoutDetailModal.tsx` | 72, 89 |
| `command/components/payouts/PayoutFilterChips/PayoutFilterChips.module.css` | 40, 45 |
| `command/components/payouts/PayoutFilterPanel/PayoutFilterPanel.module.css` | 33 |
| `command/components/payouts/PayoutFilterPanel/PayoutFilterPanel.tsx` | 33, 40, 54, 60 |
| `command/components/payouts/PayoutGroupColumns/PayoutGroupColumns.module.css` | 9, 28, 38 |
| `command/components/payouts/PayoutRow/PayoutRow.module.css` | 10, 12, 16, 39, 42, 44 |
| `command/components/payouts/PayoutSelectionBar/PayoutSelectionBar.module.css` | 11, 24, 25, 26 |
| `command/components/payouts/PayoutStatementTable/PayoutStatementTable.module.css` | 5, 26, 27, 33, 41, 47, 54, 55, 68 |
| `command/components/payouts/PayoutTable/PayoutTable.module.css` | 11, 12, 17, 18, 23, 44, 48 |
| `command/components/payouts/PayoutToolbar/PayoutToolbar.module.css` | 31, 32, 33, 66, 67, 68 |
| `command/components/payouts/PayoutToolbar/PayoutToolbar.tsx` | 57 |
| `command/components/payouts/PayoutVendorGroup/PayoutVendorGroup.module.css` | 1, 10, 17, 43, 49, 54, 59, 70, 71, 75 |
| `command/components/payouts/PayoutsPage/PayoutsPage.module.css` | 26, 41, 54, 60, 76, 79, 80, 88, 105, 106 |
| `command/components/payouts/PayoutsPage/PayoutsPage.tsx` | 151 |
| `command/components/settings/DivisionsSettingsPage/DivisionsSettingsPage.module.css` | 10, 17, 30, 51, 55, 63, 79, 88, 93, 105, 117, 126, 128, 132 |
| `command/components/settings/DivisionsSettingsPage/DivisionsSettingsPage.tsx` | 22, 25, 57, 83 |
| `command/components/settings/NotificationSettingsPage/NotificationSettingsPage.module.css` | 14, 21, 33, 40, 44, 52, 75, 89, 94, 113, 120, 132 |
| `command/components/settings/NotificationSettingsPage/NotificationSettingsPage.tsx` | 55, 80, 100, 119, 143, 159 |
| `command/components/settings/PlatformFeeSettingsPage/PlatformFeeSettingsPage.module.css` | 10, 17, 32, 56, 62, 98, 101, 108, 114, 133, 139, 151 |
| `command/components/settings/PlatformFeeSettingsPage/PlatformFeeSettingsPage.tsx` | 44, 59, 100 |
| `command/components/settings/SecuritySettingsPage/SecuritySettingsPage.module.css` | 2, 14, 21, 36, 64, 65, 72, 126, 132 |
| `command/components/settings/SecuritySettingsPage/SecuritySettingsPage.tsx` | 27, 40, 68, 86 |
| `command/components/settings/SettingsPage/SettingsPage.module.css` | 5, 16, 22 |
| `command/components/settings/WithholdingTaxSettings/WithholdingTaxSettings.module.css` | 12, 19, 37, 61, 68, 106, 109 |
| `command/components/settings/WithholdingTaxSettings/WithholdingTaxSettings.tsx` | 37, 61, 81 |
| `command/components/transactions/TransactionFilterPanel/TransactionFilterPanel.module.css` | 37 |
| `command/components/transactions/TransactionFilterPanel/TransactionFilterPanel.tsx` | 38, 43, 51, 56 |
| `command/components/transactions/TransactionPagination/TransactionPagination.module.css` | 11, 26, 45, 46, 47 |
| `command/components/transactions/TransactionPagination/TransactionPagination.tsx` | 17, 20, 28 |
| `command/components/transactions/TransactionSummaryCards/TransactionSummaryCards.module.css` | 12 |
| `command/components/transactions/TransactionSummaryCards/TransactionSummaryCards.tsx` | 21 |
| `command/components/transactions/TransactionTable/TransactionTable.tsx` | 31 |
| `command/components/transactions/TransactionTableRow/TransactionTableRow.module.css` | 18, 23, 29, 52 |
| `command/components/transactions/TransactionTableRow/TransactionTableRow.tsx` | 20 |
| `command/components/transactions/TransactionToolbar/TransactionToolbar.module.css` | 27, 28, 29 |
| `command/components/transactions/TransactionsPage/TransactionsPage.tsx` | 58 |
| `command/components/ui/BarChart/BarChart.module.css` | 34 |
| `command/components/ui/DeleteConfirmModal/DeleteConfirmModal.module.css` | 25, 32, 45 |
| `command/components/ui/DeleteConfirmModal/DeleteConfirmModal.tsx` | 40, 47 |
| `command/components/ui/FormLabel/FormLabel.module.css` | 2 |
| `command/components/ui/SearchInput/SearchInput.module.css` | 8, 17, 25 |
| `command/components/ui/SearchInput/SearchInput.tsx` | 13 |
| `command/components/ui/SortableColumnHeader/SortableColumnHeader.module.css` | 16, 28, 52 |
| `command/components/ui/StatusFilterTabs/StatusFilterTabs.module.css` | 6, 26 |
| `command/components/users/AffiliateModal/AffiliateModal.module.css` | 3, 41, 47, 61, 73, 90, 105, 117, 123, 145, 151, 193 |
| `command/components/users/AffiliateModal/AffiliateModal.tsx` | 33, 34, 59, 94, 110 |
| `command/components/users/AffiliatePanel/AffiliatePanel.module.css` | 2, 17, 50, 57, 66, 74, 82, 96, 98, 113, 124, 132, 140, 153, 154 |
| `command/components/users/AffiliatePanel/AffiliatePanel.tsx` | 27 |
| `command/components/users/UserModal/UserModal.module.css` | 41, 47, 58, 81, 90, 120, 125, 157, 231, 258, 270, 276, 304 |
| `command/components/users/UserModal/UserModal.tsx` | 62, 64, 76, 92, 106, 113, 114, 115, 127, 148, 154, 160, 174, 175, 176, 203, 221, 228, 231, 239, 245, 250, 258 |
| `command/components/users/UserSetPasswordModal/UserSetPasswordModal.module.css` | 3, 40, 46, 64, 76, 82, 93, 124, 132, 157 |
| `command/components/users/UserSetPasswordModal/UserSetPasswordModal.tsx` | 31, 32, 63, 90, 100, 101 |
| `command/components/users/UserStatsBar/UserStatsBar.module.css` | 27 |
| `command/components/users/UserStatsBar/UserStatsBar.tsx` | 15 |
| `command/components/users/UserTable/UserTable.module.css` | 22, 32, 41 |
| `command/components/users/UserTable/UserTable.tsx` | 25, 29, 56 |
| `command/components/users/UserTableRow/UserTableRow.module.css` | 26, 33, 54, 106 |
| `command/components/users/UserTableRow/UserTableRow.tsx` | 25, 52, 53 |
| `command/components/users/UserToolbar/UserToolbar.module.css` | 20, 62 |
| `command/components/users/UserToolbar/UserToolbar.tsx` | 40, 44, 55, 67, 76 |
| `command/components/users/UsersPage/UsersPage.module.css` | 14, 21 |
| `command/components/users/UsersPage/UsersPage.tsx` | 73 |
| `command/components/vendors/VendorCard/VendorCard.module.css` | 32, 53, 57, 80, 115, 132, 137, 198 |
| `command/components/vendors/VendorCard/VendorCard.tsx` | 28, 70, 71, 79 |
| `command/components/vendors/VendorFormModal/VendorFormModal.module.css` | 21, 32, 75 |
| `command/components/vendors/VendorFormModal/VendorFormModal.tsx` | 29, 30, 32, 40, 46, 57, 68, 76, 77 |
| `command/components/vendors/VendorPayoutBadges/VendorPayoutBadges.module.css` | 44, 46, 69, 71 |
| `command/components/vendors/VendorPayoutDetails/VendorPayoutDetails.module.css` | 23, 36, 38, 48, 58, 59, 67, 85, 87, 101, 110, 114, 121 |
| `command/components/vendors/VendorPayoutModal/VendorPayoutModal.module.css` | 35, 43, 48, 59 |
| `command/components/vendors/VendorPayoutModal/VendorPayoutModal.tsx` | 40, 49 |
| `command/components/vendors/VendorStatsBar/VendorStatsBar.module.css` | 27 |
| `command/components/vendors/VendorStatsBar/VendorStatsBar.tsx` | 15 |
| `command/components/vendors/VendorToolbar/VendorToolbar.module.css` | 14 |
| `command/components/vendors/VendorToolbar/VendorToolbar.tsx` | 34 |
| `command/components/vendors/VendorViewModal/KycPanel.module.css` | 24, 43, 47, 59, 63, 69, 97, 106, 118, 126, 135, 137 |
| `command/components/vendors/VendorViewModal/KycPanel.tsx` | 28, 67 |
| `command/components/vendors/VendorViewModal/VendorViewModal.module.css` | 41, 61, 96, 101, 114 |
| `command/components/vendors/VendorViewModal/VendorViewModal.tsx` | 30, 31, 44, 50, 65 |
| `command/components/vendors/VendorsPage/VendorsPage.module.css` | 20, 27 |
| `command/components/vendors/VendorsPage/VendorsPage.tsx` | 68 |
| `command/lib/supabase/client.ts` | 43 |
| `command/services/kyc-admin.service.ts` | 1 |
| `command/tailwind.config.ts` | 14, 15, 16, 17 |
| `command/visual-tests/closures.spec.ts` | 31, 53, 69 |
| `command/visual-tests/payouts.spec.ts` | 48, 277, 306, 339, 361, 378, 418, 435 |
| `ezzy-vendor-mobile/AGENTS.md` | 7, 15 |
| `production-costs.md` | 1 |
| `prototypes/prompts/2026-10-18-booker-ui-preview.md` | 7 |
| `prototypes/prompts/2026-10-23-booker-mobile-spacing-colours.md` | 7 |
| `prototypes/prompts/2026-10-24-booker-banner-carousel.md` | 7 |
| `prototypes/prompts/2026-10-25-affiliate-dashboard-discovery.md` | 3 |
| `prototypes/prompts/2026-10-25-booker-home-divisions-layout.md` | 7 |
| `prototypes/school-client/app/page.tsx` | 260 |
| `vendor/lib/constants.ts` | 1 |
| `vendor/lib/supabase/client.ts` | 44 |
| `vendor/lib/supabase/recoveryRequestClient.ts` | 29 |
| `vendor/services/kyc.service.ts` | 1, 2 |
| `website/index.html` | 6, 24, 25, 26, 233, 234, 235, 245, 279, 408, 471, 473, 490, 519, 548, 566, 579 |

## Local IDE metadata (supplemental; excluded from counts)

- `.idea/RS.iml` and `.idea/modules.xml:5` — stale project/module filename and paired module reference; rename together or allow IDE recreation.
- `command/.idea/workspace.xml:111`, `booker/.idea/workspace.xml:109`, `vendor/.idea/workspace.xml:115`, `backbone/.idea/workspace.xml:117` — WSL last-opened paths; reopen projects after move. Root `.idea` must be reviewed by filename/reference only before regeneration.

## Search command

```sh
'rg' '--json' '--hidden' '--no-ignore' '-i' '\brs\b|\brs[_-]' '-g' '!**/.git/**' '-g' '!**/node_modules/**' '-g' '!**/.next/**' '-g' '!**/.expo/**' '-g' '!**/dist/**' '-g' '!**/build/**' '-g' '!**/.aws/**' '-g' '!**/.idea/**' '-g' '!**/test-results/**' '-g' '!**/.agents/**' '-g' '!**/.cache/**' '-g' '!**/Pods/**' '-g' '!**/.gradle/**' '-g' '!**/.env*' '-g' '!**/*lock*' '-g' '!**/*.svg' '-g' '!**/*.map' '-g' '!**/*.log' '-g' '!**/*.tsbuildinfo' '-g' '!**/settings*.json' '-g' '!**/.codex/plugins/**' '.'
```

Read-only per-area reviews opened the actual app source and the cited backend/mobile identity configuration. No builds, tests, provider harnesses, DB queries, deployments, service restarts or folder moves were run.

Line-location verification: refreshed against current file contents after index regeneration. Concurrently edited checkout documents can shift line numbers; use the quoted identifier and file when resuming. Baseline file set is unchanged.

## Local retirement update — 2026-10-26

User approved deletion after inspecting both legacy surfaces. `website/` and `prototypes/school-client/` were removed from the workspace; their rows above are historical inventory, not current paths to open. Recoverable copies (including independent Git history) are under `/tmp/ezzy-retired-legacy-2026-10-26-eejkvllz/`; temporary, not durable backup. Obsolete root website ignore entry removed. No active app references found under the scan exclusions. Historical plan/audit references intentionally retained; hosted copies remain unverified.
