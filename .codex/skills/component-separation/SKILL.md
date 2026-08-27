---
name: component-separation
description: Use before creating or modifying any component in command/booker/vendor or the Expo mobile apps — the mandatory render/hook/style separation convention, including the React Native variant where CSS modules do not exist.
---

# Component separation

Every component is split into three concerns: **what it renders**, **what it
knows**, and **what it looks like**. Violating this is not a style preference in
this repo — it is a convention plans must explicitly satisfy per component.

## The rule

| Concern | Lives in | Web (Next.js) | Mobile (Expo / RN) |
|---|---|---|---|
| Render | `ComponentName.tsx` | ✅ same | ✅ same |
| State & behaviour | `useComponentName.ts` | ✅ same | ✅ same |
| Styling | co-located style file | `ComponentName.module.css` | `ComponentName.styles.ts` |

All three live in the same directory as the component.

## 1. The render layer (`.tsx`)

The `.tsx` is a pure render layer. It must not contain:

- `useState`, `useEffect`, `useMemo`, `useCallback`, or any other stateful hook
- business logic, data fetching, or Supabase calls
- event handler *bodies* — it wires handlers the hook returns, it does not define them
- static inline `style={{}}` objects

It may contain: JSX, props destructuring, conditional rendering, `.map()` over
data the hook provided, and genuinely dynamic one-off style values (a width
computed from state, a transform driven by a gesture).

## 2. The hook (`useComponentName.ts`)

Every component with state, effects, or handlers gets one, in the same directory.
The hook owns state, effects, derived values, and handler functions, and returns
exactly what the render layer needs — nothing more.

This is the Dependency Inversion seam: the render layer depends on the hook's
returned shape, not on Supabase, the router, or a service module directly.

## 3. Styling

**Web:** non-trivial styling goes in Tailwind utilities/design tokens or a
co-located `ComponentName.module.css`. Static inline `style` objects are not
acceptable.

**React Native:** there are no CSS modules and no cascade. The equivalent is a
co-located `ComponentName.styles.ts` exporting a `StyleSheet.create({...})`
object, or NativeWind utility classes if that app has adopted them. The rule that
survives translation is the one that matters: **static styling does not live
inline in the render layer.** Passing `styles.card` is correct; writing
`style={{ padding: 16, borderRadius: 8 }}` in the JSX is not.

Do not mix the two approaches within a single mobile app — check what the app
already uses before adding styles.

## 4. The only exception

A **pure display component** — no state, no effects, no handlers, and no
non-trivial styling — may ship as just the `.tsx`. If it later gains any of
those, it gains the companion files at the same time.

## 5. Before finishing

- Does each component do one thing, for one reason to change?
- Are consumers forced to accept props they do not use? (Interface Segregation)
- Can the component be extended without editing its working internals?
- If this component was introduced or modified by a plan, does the plan state
  per component how this separation is satisfied — not leave it implicit?
