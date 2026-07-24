---
name: mobile-dev
description: >
  Mobile application engineering workflow for this project. Use for tasks
  involving mobile UI, navigation, application lifecycle, device APIs,
  permissions, deep links, offline behavior, platform-specific code,
  mobile builds, emulators, simulators, or mobile release configuration.
---

# Mobile development

Before editing:

1. Read the nearest AGENTS.md.
2. Identify the mobile framework and supported platforms.
3. Inspect existing project patterns before introducing new architecture.

When implementing:

- Keep business logic platform-independent where practical.
- Account for application lifecycle transitions.
- Handle permissions through the project's established abstraction.
- Do not assume identical behavior across supported platforms.
- Preserve accessibility labels and dynamic text behavior.
- Avoid blocking the UI thread.

Before finishing:

- Run the application's formatter and static checks.
- Run relevant unit and integration tests.
- Build each affected platform when practical.
- State which platform-specific validations were not performed.
