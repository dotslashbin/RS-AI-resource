# Mobile route — the Expo apps (ezzy-booker-mobile, ezzy-vendor-mobile)

Read `.claude/rules/mobile-stack.md` first (Expo SDK 57, expo-router, `EXPO_PUBLIC_` env vars,
no service-role key on a client). The apps talk to the same local Supabase as the web apps.

## Route A — the Windows Android emulator (preferred for real-device behaviour)

Set-up facts (from the expo-emulator-from-wsl memory, checked against the script):

- The AVD runs on **Windows** (`Basic_Android_Phone`; SDK under
  `/mnt/c/Users/<user>/AppData/Local/Android/Sdk`). The user starts it in Android Studio and
  accepts the USB-debugging prompt — the agent does not launch Windows apps.
- WSL's `adb` is the Windows `adb.exe` (a symlink); WSL uses `networkingMode=mirrored`.
- Each app ships `scripts/start-windows-android-emulator.sh [--go|--dev-client]`. It finds the
  Windows SDK, bridges `adb` for Expo, checks an authorized device exists, runs
  `adb reverse tcp:8081 tcp:8081`, then `npx expo start <mode> --localhost --android`.
- **Plain `npx expo start --android` fails**: Expo Go is handed `exp://<LAN IP>:8081`, which the
  emulator cannot reach. `adb reverse` + `--localhost` (→ `exp://127.0.0.1:8081`) works.
- **A stale app on screen means the connection failed** — Expo Go reopens the last cached project
  (e.g. vendor-mobile's kiosk while testing booker). Diagnose with
  `adb logcat -d | grep -E "exp://|dev.expo.updates"`.

Running (with permission to start Metro):

```bash
cd /home/joshua/RS/ezzy-vendor-mobile && ./scripts/start-windows-android-emulator.sh   # run_in_background
adb devices -l                                   # confirm one authorized emulator
```

Driving and evidence:

```bash
adb exec-out screencap -p > "$SIM_SHOTS/m2_3.png"   # screenshot; then Read it to show the user
adb shell input tap <x> <y>                         # coordinates in device pixels (from the screenshot)
adb shell input text 'l2-test-1@example.com'        # spaces as %s
adb shell input keyevent KEYCODE_BACK               # BACK, ENTER (66), etc.
adb shell uiautomator dump /sdcard/ui.xml && adb exec-out cat /sdcard/ui.xml   # find elements and their bounds
```

Prefer `uiautomator dump` bounds over guessed coordinates; take a screenshot before every tap so
the coordinates match what is on screen. The user signs in on the emulator themselves.

Metro on WSL can miss newly created folders (HTTP 500 "Unable to resolve …" while `tsc` passes):
restart Metro with `--clear`, stopping it by its listening PID on 8081.

## Route B — Expo web (fallback, layout and flows without native modules)

`npx expo start --web` serves the app on :8081. Drive it like a web app (see web.md — a visible
Chromium over CDP works the same way), at a phone viewport (390×844 @2x) in headless runs. Lessons
from the expo-web-preview-screenshots memory:

- Headless Linux has no SF/Roboto: inject the Roboto stylesheet (`addInitScript`) or text widths
  are ~20% off and buttons wrap. Screenshots only; not an app bug.
- RN-web lists scroll inside the app, not the document: use
  `el.evaluate(e => e.scrollIntoView({ block: "start" }))`.
- Resolve Playwright from a web app that has it (`--app /home/joshua/RS/booker`); the Expo apps
  don't install it.

Expo web cannot show native-only behaviour (camera, push, secure storage, store-specific UI).
Mark such checks ⏸ "needs the emulator or a device".

## Limits

- Real-device checks (a tablet, an installed PWA, LAN access) belong on hosted staging, not local:
  local Supabase is `127.0.0.1:54321`, which is the device itself on a phone, and WSL does not
  expose ports to the LAN without Windows port-forwarding.
- Installing an APK, a development build, or a package is an approval gate.

## Stopping

Stop Metro by its listening PID (`scripts/stop-port.sh 8081 <pid>`). Leave the emulator running —
the user started it. `adb reverse --remove tcp:8081` if you added the reverse yourself and the
user wants it gone.
