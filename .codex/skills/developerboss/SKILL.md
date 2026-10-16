---
name: developerboss
description: Use before any coding task, however small — the coding pre-flight checklist (locate existing patterns before building, data-layer implications, risk surface, SOLID adherence, render/style separation) plus the coding working style (simplicity first, surgical changes, test-backed execution). The general pre-flight, execution cadence and stage reporting live in AGENTS.md → Working Flow.
---

# Engineering Start

Before writing code, work through the following, after the general pre-flight in `AGENTS.md` → "Working Flow". Do not skip steps even for tasks that seem small.

## 1. Locate before building
- Is there existing code that already does this or something close?
- Is there an existing pattern (hook, service function, component) to follow?
- Which files will need to change? Name them before writing a line.

## 2. Check the data layer
- Does this require a schema change? If yes, stop and get approval before proceeding.
- Which tables are involved? What are the RLS implications?
- Is there a trigger, constraint, or cascade that could be affected?

## 3. Identify the risk surface
- What is the worst thing that could go wrong?
- Are there error paths (not just the happy path)?
- Does this expose any data to a user who should not see it?
- Is any secret or credential involved?

## 4. Apply SOLID principles
- Single Responsibility — does this component/function/module do one thing, for one reason to change?
- Open/Closed — can this be extended without modifying existing, working code?
- Liskov Substitution — if this extends or implements something else, can it be swapped in without breaking callers' expectations?
- Interface Segregation — are consumers forced to depend on props/methods they don't actually use?
- Dependency Inversion — does this depend on abstractions (hooks, service functions, interfaces) rather than concrete implementations where it matters?

## 5. Separate styles from the rendering component
- Is the render layer (`.tsx`) free of `style={{}}` blocks, aside from genuinely dynamic one-off values?
- Does non-trivial styling live in a co-located `.module.css` or shared Tailwind tokens/utilities, not hardcoded inline?
- See `.claude/skills/component-separation/SKILL.md` for the full render/hook/style separation convention.

Only after completing the above: write code.

---

# Default Working Style — coding

### Simplicity First

Prefer the smallest correct solution.

- Do not add features that were not requested.
- Do not add abstractions for single-use code.
- Do not add flexibility, configurability, or generality unless needed now.
- Avoid speculative error handling for impossible or irrelevant scenarios.
- If a solution becomes much larger than expected, reconsider and simplify.

### Surgical Changes

Change only what is needed for the task.

- Do not refactor unrelated code.
- Do not "clean up" adjacent code unless it is directly required.
- Match existing project style, even if another style would be preferable.
- If unrelated dead code or problems are discovered, mention them instead of fixing them silently.
- Remove only the unused imports, variables, functions, or files made obsolete by the current change.
- Make focused changes only in files required by the request.

Every changed line should be explainable by the user request.

### Goal-Driven Execution — coding

- For bugs, prefer writing or identifying a failing reproduction before fixing.
- For behavior changes, add or update tests when practical.
- For refactors, verify behavior before and after when possible.
