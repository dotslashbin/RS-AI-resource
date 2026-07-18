# Skill: Component Separation of Concerns

## Rule

A component is split into up to **three co-located layers**, each in its own file:

1. **Render** — `ComponentName.tsx` — a pure render layer: JSX structure only.
2. **Logic** — `useComponentName.ts` — all state, effects, handlers, derived values.
3. **Styling** — `ComponentName.module.css` — non-trivial styling, kept out of the `.tsx`.

The render layer owns *structure*. Logic and styling live outside it. A component
that owns state/effects/handlers **must** have the hook; a component with
non-trivial styling **must** have the stylesheet (or reuse the shared design
tokens/Tailwind utilities — see "Styling layer"). No exceptions to the render
layer staying pure.

---

## Pattern

```
ComponentName/
├── ComponentName.tsx        ← pure render: imports hook + styles, returns JSX only
├── useComponentName.ts      ← all logic: state, effects, handlers, derived values
└── ComponentName.module.css ← styling: layout/geometry/visuals (when non-trivial)
```

All files live in the same directory as the component.

---

## What belongs in the hook (`.ts`)

- `useState` declarations
- `useEffect` calls
- Event handlers (`handleX`, `onX`, `goX`)
- Derived / computed values
- Service calls and async logic
- Local business rules

## What belongs in the styling layer (`.module.css`)

- Layout, spacing, sizing, positioning
- Colours via theme tokens / CSS custom properties (never hardcoded light/dark pairs)
- Geometry that is awkward as utilities or inline objects — overlays, masks,
  clip paths, pseudo-elements, keyframes/animations (this is why the KYC camera
  widget uses `CameraCapture.module.css` / `IdentityStep.module.css`)
- Hover/focus/active and media-query rules

The `.tsx` references classes via `styles.x`; it does **not** hold `style={{}}`
blocks. **Exception:** a genuinely *dynamic* one-off value computed at runtime
(e.g. a width driven by state, a transform from a drag position) may stay inline —
static styling never does.

> Alternative to a CSS Module: Tailwind utility classes + the shared design
> tokens are equally valid for straightforward layout/spacing (that is the default
> across the portals). Reach for a `.module.css` when the styling is non-trivial
> or the geometry doesn't express cleanly as utilities. Either way, the principle
> holds — **styling is not written as inline `style` objects inside the render
> component.** (See `architecture/conventions.md` → Styling Conventions.)

## What belongs in the component (`.tsx`)

- JSX structure and layout
- Import of the hook + styles and destructuring
- Prop drilling to child elements
- Trivial inline ternaries for conditional rendering (incl. picking a class)
- **Nothing else**

---

## When is each file NOT needed?

- **Hook** — only when the component has **zero** state, effects, and handlers
  (a pure display component whose only input is props). Even a single show/hide
  toggle counts as state and warrants a hook.
- **Stylesheet** — only when the component's styling is trivial and fully covered
  by a handful of Tailwind utilities/tokens. Non-trivial or geometric styling goes
  in a co-located `.module.css` rather than inline in the `.tsx`.

A pure, unstyled display component may legitimately have neither — just the `.tsx`.

---

## Naming conventions

| File | Export / usage |
|------|----------------|
| `ComponentName.tsx` | `export function ComponentName(...)` |
| `useComponentName.ts` | `export function useComponentName(...)` |
| `ComponentName.module.css` | imported as `import styles from "./ComponentName.module.css"` |

All live in the same directory as the component.

---

## Minimal example

```ts
// useRegisterField.ts
"use client"
import { useState } from "react"

export function useRegisterField(type: string) {
  const [show, setShow]   = useState(false)
  const inputType         = type === "password" ? (show ? "text" : "password") : type
  const toggleShow        = () => setShow(v => !v)
  return { show, inputType, toggleShow }
}
```

```tsx
// RegisterField.tsx
"use client"
import { useRegisterField } from "./useRegisterField"
import styles from "./RegisterField.module.css"

export function RF({ type = "text", ... }: RFProps) {
  const { inputType, toggleShow } = useRegisterField(type)
  return (
    <div className={styles.field}>
      <input className={styles.input} type={inputType} ... />
      {type === "password" && <button className={styles.toggle} onClick={toggleShow}>...</button>}
    </div>
  )
}
```

---

## Checklist before creating any new component

- [ ] Does this component have state, effects, or handlers? → create `useComponentName.ts`
- [ ] Is the `.tsx` file free of `useState`, `useEffect`, and business logic?
- [ ] Is the `.tsx` file free of static inline `style={{}}` blocks? → move styling to `ComponentName.module.css` (or Tailwind utilities/tokens); only genuinely dynamic one-off values may stay inline
- [ ] Does the hook return only what the component actually uses?
- [ ] Are all files (`.tsx`, `.ts`, `.module.css`) in the same directory?
