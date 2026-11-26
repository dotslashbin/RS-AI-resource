#!/usr/bin/env bash
# Read-only SQL against the LOCAL Supabase database, for evidence during a manual test.
#
# Usage: q-readonly.sh "<sql>"
#
# Every statement runs with default_transaction_read_only=on, so an INSERT/UPDATE/DELETE
# fails instead of writing. Only the local stack is accepted: SIM_DB_URL may override the
# default but must still point at 127.0.0.1/localhost:54322. Staging and production are
# never queried from this skill.
set -euo pipefail
sql="${1:?SQL required}"
url="${SIM_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if ! [[ "$url" =~ ^postgres(ql)?://[^@]+@(127\.0\.0\.1|localhost):54322/ ]]; then
  echo "Refusing: q-readonly.sh only queries the local database (127.0.0.1:54322)." >&2
  exit 2
fi

PGOPTIONS='-c default_transaction_read_only=on' \
  psql "$url" -X -A -F ' | ' -v ON_ERROR_STOP=1 -c "$sql"
