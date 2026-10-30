# Plain language for stakeholder decks

The audience runs or funds the business. They are smart, busy and not technical. They want to
know: what can customers do now, is it working, is anything at risk, what's next.

## Tone

- Short, confident, concrete. Say what changed for a person ("customers can reset their own
  password"), not what changed in the system.
- Active voice, "we" for the team. Canadian English spelling.
- Dates as "Thu, Oct 29" or "October 29" — never ISO dates.
- No version numbers, ticket or plan IDs (F12, B1-d, P4), file names, commit hashes,
  percentages of test suites, or tool names.
- No drama and no hedging. "Ezzy Booker is live" — not "we're thrilled to announce", not
  "should now be mostly working".

## Translations used in this workspace

| Technical | Say instead |
|---|---|
| production / prod / deployed / promoted | live, the live site, went live |
| staging | a practice copy of the site |
| release, merge, version 0.30.2 | (leave out, or "the update") |
| migration, schema, RLS, grants, env vars, secrets | (leave out entirely) |
| Supabase Auth settings, password policy | stronger password rules |
| leaked-password protection | common, easy-to-guess passwords are refused |
| web-app manifest / PWA | can be saved to a phone's home screen like an app |
| carousel / promo slides | rotating promotional banners |
| division / division icons | service categories / category icons |
| notification email, welcome email, `booker_welcome` | email notifications (the user's chosen wording: use it even when only one kind of email shipped, unless they say otherwise) |
| webhook, `is_paid`, PayMongo test mode | a test payment went through |
| vendor | the business (or "partner businesses" for a group) |
| vendor notified (`new_booking`) | the business was told about the booking |
| abandoned-checkout cleanup routine | a daily check that frees up time slots held by unpaid bookings |
| P4 / one real paid booking on prod | one real paid booking on the live site to confirm payments end to end |
| timezone bug (sessions bookable after they ended) | making sure past sessions can't be booked from a device set to another time zone |
| visual regression tests, lint, type-check | (leave out — say "tested" if anything) |
| branding cleanup, RS → Ezzy | old names removed; the Ezzy name and colours used throughout |
| hotfix / patch | small fix |

When something new comes up that isn't here, describe what a customer or business owner
would notice. If they would notice nothing, it probably doesn't belong on a slide.

## Framing what's still open

- Group it under "next few days" and say plainly whether it is a new feature or not.
- One line on the effect, one on what you're doing about it.
- Something already checked with a good result can say so ("First check: nothing to
  release") — it's reassuring and true.
