# UX Design

Before making any visual or interaction change, work through the following.
These questions should shape decisions — not validate them after the fact.

## 1. Define the user's job
- What is the user trying to accomplish here? State it as a job, not a feature.
- What is their emotional state when they land on this screen?
  (Stressed? Browsing? Recovering from an error? In a flow?)
- What is the single most important action? Everything else is secondary.

## 2. Establish hierarchy
- What should the eye go to first? Second?
- Is visual weight proportional to importance?
- Is there one clear primary action? Are secondary actions visually subordinate?
- Squint test: blur your vision — can you still identify the most important element?

## 3. Check for consistency
- Does this match existing patterns in the app (spacing, radii, colour tokens,
  component variants)?
- If deviating from an existing pattern, is there a deliberate reason?
- Same type scale, same icon library, same button styles?

## 4. Handle all states
Every interactive or data-driven surface must handle all four:
- Loading   — spinner, skeleton, or placeholder. Never a blank void.
- Empty     — useful message + CTA where appropriate.
- Error     — what failed and what the user can do next.
- Populated — the happy path.

## 5. Verify accessibility
- Body text contrast ≥ 4.5:1 against its background; large text ≥ 3:1.
- Touch targets minimum 44×44px for anything tappable.
- Don't use colour alone to convey meaning — pair with an icon or label.
- Interactive elements are keyboard-reachable.

## 6. Test both themes
- Does this work in light AND dark mode?
- Use CSS variable tokens — never hardcode colours.
- Check shadows, borders, and overlays are visible in both.

## 7. Simplicity audit
- Remove any decoration that doesn't help the user accomplish their job.
- Can any label be shorter? Can any step be removed?
- Every element on screen should earn its place.
- When in doubt about adding something — don't.
