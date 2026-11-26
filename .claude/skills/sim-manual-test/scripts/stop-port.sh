#!/usr/bin/env bash
# Stop whatever is LISTENING on a port — the dev server or browser this run started.
#
# Usage: stop-port.sh <port> [expected-pid]
#
# Kills by the listening PID, never `pkill -f` (a pattern can match the agent's own
# shell) and never `$!` (npm's launcher, leaving `next dev` orphaned on the port).
# Pass the PID recorded at start: if the listener is a different process, this refuses,
# because stopping a server the run did not start needs the user's say.
set -euo pipefail
port="${1:?port required}"
expected="${2:-}"

pid="$(ss -ltnp 2>/dev/null | grep -E "[:.]$port\b" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)"
if [[ -z "$pid" ]]; then echo "port $port: nothing listening"; exit 0; fi
if [[ -n "$expected" && "$pid" != "$expected" ]]; then
  echo "port $port is held by pid $pid, not the recorded $expected — not stopping it. Ask the user." >&2
  exit 1
fi
kill "$pid"
for _ in $(seq 1 10); do
  ss -ltn 2>/dev/null | grep -qE "[:.]$port\b" || { echo "port $port: stopped pid $pid, now free"; exit 0; }
  sleep 1
done
echo "port $port still in use after stopping pid $pid — check for a child process." >&2
exit 1
