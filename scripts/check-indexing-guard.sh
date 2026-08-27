#!/usr/bin/env bash
#
# Assert that a DEPLOYED host actually carries the search-indexing guard.
#
# WHY THIS EXISTS. `ALLOW_INDEXING` being unset in Vercel proves nothing on its own.
# On 2026-08-10 booker.ezzy.ph was serving v0.7.0 while the repo was at v0.15.0: the
# variable was correctly unset and the app was still fully indexable, because the
# running bundle contained no code that read it. The dashboard was not the problem;
# the deployment was. This script asks the running server instead.
#
# It is the deployed half of plan .plans/2026-08-21-web-apps-seo-indexing-audit.md I1.
# The other half is <app>/visual-tests/seo.spec.ts, which makes the same assertions
# against a local build and catches a code regression before it ships. Run this one
# after every portal deploy.
#
#   ./scripts/check-indexing-guard.sh                     # the six known portal hosts
#   ./scripts/check-indexing-guard.sh https://foo.vercel.app   # or any hosts you name
#
# Exits 0 only if every host passes. Any failure exits 1, so it can gate a pipeline.
#
# ⚠️ This checks the NOINDEX (default) posture, because that is the posture every
# environment is supposed to be in — see the plan's D1. If a host is ever deliberately
# switched to ALLOW_INDEXING=1, it must be removed from this list in the same change,
# with a comment saying why; otherwise this script becomes the thing people learn to
# ignore.

set -uo pipefail

DEFAULT_HOSTS=(
  https://command.ezzy.ph
  https://vendor.ezzy.ph
  https://booker.ezzy.ph
  https://staging-command.ezzy.ph
  https://staging-vendor.ezzy.ph
  https://staging-booker.ezzy.ph
)

if [ "$#" -gt 0 ]; then HOSTS=("$@"); else HOSTS=("${DEFAULT_HOSTS[@]}"); fi

EXPECTED_HEADER="noindex, nofollow, noarchive"
failures=0

for host in "${HOSTS[@]}"; do
  problems=()

  # --- robots.txt -----------------------------------------------------------
  # ⚠️ The status code is the load-bearing assertion, not the body. A 404 from
  # /robots.txt IS the signature of "the guard is not in this build". Grepping the
  # body alone would pass against a 404 page, which also lacks the word "Allow".
  robots_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$host/robots.txt" 2>/dev/null)
  robots_body=$(curl -sS --max-time 15 "$host/robots.txt" 2>/dev/null)

  [ "$robots_code" = "200" ] || problems+=("robots.txt HTTP $robots_code (a 404 means the guard is not deployed)")
  printf '%s\n' "$robots_body" | grep -qE '^Disallow: /[[:space:]]*$' \
    || problems+=("robots.txt has no bare 'Disallow: /'")

  # --- X-Robots-Tag ---------------------------------------------------------
  # ⚠️ Checked on '/', never on a path that does not exist: Next adds `noindex` to
  # every 404 automatically, so a missing path reports a pass on an unguarded app.
  root_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$host/" 2>/dev/null)
  header=$(curl -sSI --max-time 15 "$host/" 2>/dev/null \
             | tr -d '\r' | grep -i '^x-robots-tag:' | head -1 | cut -d' ' -f2- )

  [ "$root_code" = "200" ] || problems+=("/ returned HTTP $root_code, so the header check is not meaningful")
  if [ -z "$header" ]; then
    problems+=("no X-Robots-Tag on /")
  elif [ "$header" != "$EXPECTED_HEADER" ]; then
    problems+=("X-Robots-Tag is '$header', expected '$EXPECTED_HEADER'")
  fi

  if [ ${#problems[@]} -eq 0 ]; then
    printf 'OK    %s\n' "$host"
  else
    failures=$((failures + 1))
    printf 'FAIL  %s\n' "$host"
    for p in "${problems[@]}"; do printf '        - %s\n' "$p"; done
  fi
done

echo
if [ "$failures" -eq 0 ]; then
  printf 'All %d host(s) carry the indexing guard.\n' "${#HOSTS[@]}"
  exit 0
fi
printf '%d of %d host(s) FAILED. A failure here is a deployment fault, not a config one:\n' "$failures" "${#HOSTS[@]}"
printf 'redeploy the app with the build cache DISABLED, then re-run.\n'
exit 1
