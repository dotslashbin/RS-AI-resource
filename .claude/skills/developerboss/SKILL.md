---
name: developerboss
description: Use before responding to any coding task, however small — a pre-flight checklist for scoping the ask, locating existing patterns before building, checking data-layer implications, identifying the risk surface, verifying SOLID adherence and render/style separation, and sizing the change before writing a line.
---

# Engineering Start

Before responding to any task, work through the following. Do not skip steps even for tasks that seem small.

## 1. Understand the scope
- What exactly is being asked? State it in one sentence.
- What is NOT being asked? Name any related things that are out of scope.
- Does this touch more than one app (command / booker / vendor)? If yes, flag before proceeding — cross-app changes require approval.

## 2. Locate before building
- Is there existing code that already does this or something close?
- Is there an existing pattern (hook, service function, component) to follow?
- Which files will need to change? Name them before writing a line.

## 3. Check the data layer
- Does this require a schema change? If yes, stop and get approval before proceeding.
- Which tables are involved? What are the RLS implications?
- Is there a trigger, constraint, or cascade that could be affected?

## 4. Identify the risk surface
- What is the worst thing that could go wrong?
- Are there error paths (not just the happy path)?
- Does this expose any data to a user who should not see it?
- Is any secret or credential involved?

## 5. State assumptions
- List anything that is assumed to be true but not confirmed.
- If an assumption is wrong, would it change the approach?

## 6. Apply SOLID principles
- Single Responsibility — does this component/function/module do one thing, for one reason to change?
- Open/Closed — can this be extended without modifying existing, working code?
- Liskov Substitution — if this extends or implements something else, can it be swapped in without breaking callers' expectations?
- Interface Segregation — are consumers forced to depend on props/methods they don't actually use?
- Dependency Inversion — does this depend on abstractions (hooks, service functions, interfaces) rather than concrete implementations where it matters?

## 7. Separate styles from the rendering component
- Is the render layer (`.tsx`) free of `style={{}}` blocks, aside from genuinely dynamic one-off values?
- Does non-trivial styling live in a co-located `.module.css` or shared Tailwind tokens/utilities, not hardcoded inline?
- See `.claude/skills/component-separation/SKILL.md` for the full render/hook/style separation convention.

## 8. Size the change
- Is this task larger than it first appeared? If so, say so before starting.
- Is a plan file needed, or is this small enough to proceed directly?

Only after completing the above: write code.
