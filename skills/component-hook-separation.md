# Skill: Hook-Component Separation

## Rule

Every component that owns state, effects, or handlers must have a companion hook file. No exceptions.

The `.tsx` file is a **pure render layer**. The `.ts` hook file owns everything else.

---

## Pattern

```
ComponentName/
├── ComponentName.tsx       ← pure render: imports hook, returns JSX only
└── useComponentName.ts     ← all logic: state, effects, handlers, derived values
```

---

## What belongs in the hook (`.ts`)

- `useState` declarations
- `useEffect` calls
- Event handlers (`handleX`, `onX`, `goX`)
- Derived / computed values
- Service calls and async logic
- Local business rules

## What belongs in the component (`.tsx`)

- JSX structure and layout
- Import of the hook and destructuring
- Prop drilling to child elements
- Trivial inline ternaries for conditional rendering
- **Nothing else**

---

## When is a hook NOT needed?

Only when the component has **zero** state, effects, and handlers — i.e. a pure display component whose only input is props. Even a single-field show/hide toggle counts as state and warrants a hook.

---

## Naming conventions

| File | Export |
|------|--------|
| `useComponentName.ts` | `export function useComponentName(...)` |
| `ComponentName.tsx` | `export function ComponentName(...)` |

Both live in the same directory as the component.

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

export function RF({ type = "text", ... }: RFProps) {
  const { show, inputType, toggleShow } = useRegisterField(type)
  return (
    <div>
      <input type={inputType} ... />
      {type === "password" && <button onClick={toggleShow}>...</button>}
    </div>
  )
}
```

---

## Checklist before creating any new component

- [ ] Does this component have state, effects, or handlers? → create `useComponentName.ts`
- [ ] Is the `.tsx` file free of `useState`, `useEffect`, and business logic?
- [ ] Does the hook return only what the component actually uses?
- [ ] Are both files in the same directory?
