# offering-share — Booker's shared-offering page

Design preview for `.plans/2026-11-19-offering-share-links.md` (B2, B3, I1, I2; decisions D3, D7, D9).
Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
`shoot.mjs` run asserts zero non-`file://` requests and fails if one is attempted.

> ⚠️ **Read this first: the photo is a stand-in.** The blue-green block is a CSS gradient
> marked "Photo (stand-in)", not a design for photos. The real page shows the vendor's own
> photo, using the existing 21:9 banner on web and a square on phones.

## What it shows

| Screen | Look at |
|---|---|
| `public` | What a signed-out person sees from a shared link: only the D3 fields, price, "Sign up to book" first, "Log in" second, and a city-only "Where". No slots, address, hours, staff, requirements or agreements. |
| `public-nophoto` | The same page for an offering with no photos: the division placeholder used today. |
| `unavailable` | D7: one neutral message for every unavailable case (removed, inactive, unknown id). It never says which. |
| `signedin-share` | B3: the existing signed-in offering page with only a **Share** button added beside "Back to results", and the desktop "Link copied" toast. On phones the system share sheet opens instead, which an HTML mock cannot draw. |

## Design fit

- Layout, chip, title, price and button values are copied from
  `booker/components/explore/OfferingPage/OfferingPage.module.css`, so the public view reads as
  the same page with the booking parts removed.
- "Sign up to book" uses the same tokens as today's **Book** button (`--db-menu-btn-*`).
- The signed-in chrome (top bar, tabs) comes from the shared booker preview helpers. The signed-out bar
  (brand + "Log in") is new: there is no session to own search, tabs or an account menu.
- Division colour goes through `data-division` and the `--div-ezzy-court-*` tokens, booker's
  existing convention.
- **No new dependency implied.** Share uses the browser's `navigator.share` and
  `navigator.clipboard`, and the toast uses `sonner`, which booker already has.

## Limits

- The desktop price rail is `position: sticky` in the real page and static here.
- Fonts are the preview's fallback stack, not self-hosted Poppins.
- Focus order, screen-reader announcements for the toast, and the native share sheet need a real build.
- The Vendor offering card's Share button (B4) is not shown; it is one more button in the card's
  existing action row.

## Findings

- **F1 — On phones, the sign-up button must come right after the title (real build must do this).**
  The real page stacks content then rail, which on a phone put "Sign up to book" below the
  "Where" card. The preview orders it head → price and sign-up → Where with grid areas. B2's
  component must do the same.
- **F2 — The primary action is low-emphasis (decision for review).** Reusing the Book button's
  tinted style keeps the page consistent, but in dark the "Sign up" and "Log in" buttons are
  close in weight. Options: keep it consistent with Book (recommended), or give the public
  view a filled primary button.
- **F3 — The "exact address shows once you're signed in" line is a design choice, not a D3
  field.** It explains why the address is missing. Drop it if you'd rather say nothing.
- **F4 — The no-photo tile stays light in dark mode.** This is booker's documented behaviour
  (the division tile is `:root` only), not a preview bug.

## Regenerating

```bash
node .plans/previews/_shared/shoot.mjs offering-share           # nine checks
node .plans/previews/_shared/shoot.mjs offering-share --shoot   # + contact sheets
```

Last run, 2026-11-19: 4 screens × 2 viewports × 2 themes = 16 cells, all nine checks passing,
4 contact sheets. The first run failed check 6 on the sticky rail, which led to F1.
