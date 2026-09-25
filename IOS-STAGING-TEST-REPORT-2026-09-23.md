# Ezzy Vendor Mobile — iOS Staging Test Report

**Test date:** 2026-09-23  
**Build:** TestFlight `0.12.0 (2)`  
**Device:** iPhone 12 Pro Max, iOS 26.6.2  
**Environment:** Staging — confirmed by the `staging-vendor.ezzy.ph` portal link and successful staging-account sign-in.

> **Status legend:** ✅ PASS · ⚠️ PARTIAL / follow-up required · ⬜ NOT TESTED.
>
> All results below are user-operated tests on the physical iPhone. No credentials, customer data, payment details, or payment references are recorded in this report.

## Core vendor app

- ✅ **Launch and stability** — The TestFlight build launched without an error or crash.
- ✅ **Staging environment** — The portal link opened `staging-vendor.ezzy.ph`; a staging account signed in successfully and loaded expected staging vendor data.
- ✅ **Dashboard** — Loaded correctly.
- ✅ **Booking workflow** — A test booking action completed successfully.
- ✅ **Transactions** — Transactions loaded successfully.
- ✅ **Session** — Sign-out and subsequent sign-in both succeeded.
- ⚠️ **Offline behaviour** — In Airplane Mode, pull-to-refresh showed no visible change or error; closing and reopening the app did not crash. After connectivity returned, the app functioned normally. This proves stability/recovery, but not a visible failed-request error/retry state.
- ✅ **Legal links** — Privacy Policy opened `https://ezzy.ph/privacy-policy/`; Account & Data Deletion opened `https://ezzy.ph/account-data-deletion/` in the browser.

## Accessibility and appearance

- ✅ **Dark mode** — Dashboard, booking, and Transactions remained readable and usable.
- ✅ **Maximum iOS accessibility text size** — Dashboard, booking details/actions, Transactions, and Settings remained functional; larger text did not block use.
- ✅ **VoiceOver** — Navigation and controls in the app menu, Dashboard, booking/action, Transactions, and Settings were understandable and usable.

## Kiosk mode

- ✅ **Containment** — While kiosk was active, staff tabs, Settings, and staff booking surfaces were inaccessible. Background/return and app relaunch restored kiosk without exposing staff UI.
- ✅ **Staff exit** — The staff-password exit returned to the staff dashboard; reopening afterward remained outside kiosk mode.
- ✅ **Customer journey** — Offering, date/time, quantity, fictional customer details, agreements/signature where applicable, and review all worked. Back/Continue and review details were correct.
- ✅ **Successful staging/sandbox payment** — Payment handoff/return completed and the app showed the expected confirmed receipt.
- ✅ **Cancelled payment safety** — A cancelled checkout was not shown as paid. The pending state could be exited safely; refresh/wait did not change it to paid.
- ✅ **Duplicate/stale-state prevention** — A fresh kiosk flow did not show a duplicate booking or prior customer data after cancellation.
- ✅ **Customer-data reset** — Fictional customer details, agreements, and test signature cleared when returning to kiosk start and after staff exit/re-entry.
- ✅ **Kiosk accessibility** — Kiosk remained readable and usable in Dark mode, at maximum accessibility text size, and with VoiceOver.

## Findings and remaining follow-up

- ⚠️ **Staging display name** — The iPhone Home Screen and in-app sign-in screen display `Ezzy Vendor`, not the expected `Ezzy Vendor Staging`. The build is confirmed to use staging services; this is a display-name packaging/configuration defect to correct in a future staging build.
- ⬜ **Explicit staging test-email evidence** — A test email was not separately recorded in this report.
- ⬜ **Notification permission and remote push delivery** — Not part of this test pass. Remote push requires separately approved shared-backend and provider-credential work.
- ⬜ **Android parity** — Android testing has not yet begun.
- ⬜ **Google Play pre-launch report** — Still to be checked in Play Console.

## Conclusion

The iOS TestFlight staging build passed the exercised core vendor, accessibility, kiosk containment, kiosk checkout, payment-safety, and customer-data-reset scenarios on a physical iPhone. It is not a public-store approval or production-release sign-off. The remaining items above must be addressed or explicitly accepted before production submission.
