#!/usr/bin/env bash
# Open a VISIBLE Chromium on the WSLg desktop that an agent can drive over CDP.
#
# Usage: launch-browser.sh [--check] <start-url> [profile-dir] [port]
#   --check      report what would run (display, binary, port) and exit; launches nothing
#   start-url    e.g. http://localhost:3000   (localhost, never 127.0.0.1 — Next HMR misbehaves)
#   profile-dir  a throwaway --user-data-dir (default: $SIM_SCRATCH/chromium-profile)
#   port         remote-debugging port (default 9222)
#
# Prints the browser PID and the CDP URL. The window stays open until stopped with
# stop-port.sh <port>. The user signs in inside this window themselves.
set -euo pipefail

check=0
if [[ "${1:-}" == "--check" ]]; then check=1; shift; fi
url="${1:?start URL required, e.g. http://localhost:3000}"
scratch="${SIM_SCRATCH:-${TMPDIR:-/tmp}/sim-manual-test}"
profile="${2:-$scratch/chromium-profile}"
port="${3:-9222}"

if [[ "$url" == *"127.0.0.1"* ]]; then
  echo "Use localhost, not 127.0.0.1 (Next dev HMR and recovery links misbehave on 127.0.0.1)." >&2
  exit 2
fi

if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  echo "No DISPLAY / WAYLAND_DISPLAY: WSLg is not available, so a visible window cannot open." >&2
  echo "Fall back to headless Playwright screenshots (see references/web.md)." >&2
  exit 3
fi

bin="$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | sort -V | tail -1 || true)"
if [[ -z "$bin" || ! -x "$bin" ]]; then
  echo "No Playwright Chromium under ~/.cache/ms-playwright. Installing one is an approval gate — ask the user." >&2
  exit 4
fi

if ss -ltn 2>/dev/null | grep -q "127.0.0.1:$port\b"; then
  echo "Port $port is already in use — a browser may already be running. Reuse it or pick another port." >&2
  exit 5
fi

echo "display: DISPLAY=${DISPLAY:-} WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-}"
echo "binary:  $bin"
echo "profile: $profile"
echo "cdp:     http://127.0.0.1:$port"
if [[ $check -eq 1 ]]; then echo "check only — nothing launched"; exit 0; fi

mkdir -p "$profile" "$scratch"
nohup "$bin" --remote-debugging-port="$port" --remote-debugging-address=127.0.0.1 \
  --user-data-dir="$profile" --no-first-run --no-default-browser-check \
  --window-size=1300,950 "$url" > "$scratch/chromium.log" 2>&1 &

for _ in $(seq 1 30); do
  if curl -s "http://127.0.0.1:$port/json/version" >/dev/null; then
    pid="$(ss -ltnp 2>/dev/null | grep "127.0.0.1:$port\b" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"
    echo "ready:   pid=$pid"
    exit 0
  fi
  sleep 1
done
echo "Chromium did not open its debugging port within 30s. See $scratch/chromium.log" >&2
exit 6
