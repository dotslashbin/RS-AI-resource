---
paths:
  - "ezzy-booker-mobile/**"
  - "ezzy-vendor-mobile/**"
---

### Mobile (the Expo apps in "ezzy-booker-mobile" and "ezzy-vendor-mobile" folders)

- **Framework**: Expo SDK 57 + React Native, `expo-router` (file-based routing under `src/app/`)
- **Language**: TypeScript (strict), `@/*` aliased to that app's `./src/*`
- **Expo has changed** — read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing code; do not rely on pre-SDK-57 memory
- **Installing packages**: Expo-adjacent packages go through `npx expo install` (resolves the SDK-57-compatible version); plain npm packages via `npm install`. Either way, installing a dependency is an approval gate
- **Backend**: same shared Supabase project, same RLS boundaries — the mobile apps are new *clients*, not a new backend. `@supabase/ssr` does not apply; RN needs its own session-persistence adapter
- **Public env vars** use the `EXPO_PUBLIC_` prefix, not `NEXT_PUBLIC_`. `SUPABASE_SERVICE_ROLE_KEY` must never reach a mobile client under any prefix — service-role work stays behind the web apps' API routes
- **Store compliance**: read and apply `.claude/skills/mobile-dev/SKILL.md` before implementing or reviewing any mobile feature
