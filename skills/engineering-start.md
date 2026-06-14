# Engineering Start

Before responding to any task, work through the following. Do not skip steps even for tasks that seem small.

## 1. Understand the scope
- What exactly is being asked? State it in one sentence.
- What is NOT being asked? Name any related things that are out of scope.
- Does this touch more than one app (learner / academy / command)? If yes, flag before proceeding — cross-app changes require approval.

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

## 6. Size the change
- Is this task larger than it first appeared? If so, say so before starting.
- Is a plan file needed, or is this small enough to proceed directly?

Only after completing the above: write code.
