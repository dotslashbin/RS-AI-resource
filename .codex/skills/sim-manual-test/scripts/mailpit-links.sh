#!/usr/bin/env bash
# Show the newest local mail-catcher message for an address, with link targets but
# auth tokens hidden. Evidence for "the email went where it should".
#
# Usage: mailpit-links.sh <to-address> [mailpit-base]
set -euo pipefail
to="${1:?recipient address required}"
base="${2:-http://127.0.0.1:54324}"
if ! [[ "$base" =~ ^http://(127\.0\.0\.1|localhost):[0-9]+$ ]]; then echo "local mail catcher only" >&2; exit 2; fi
id="$(curl -s "$base/api/v1/search?query=to:$to" | python3 -c 'import json,sys; m=json.load(sys.stdin).get("messages",[]); print(m[0]["ID"] if m else "")')"
[[ -n "$id" ]] || { echo "no message for $to"; exit 1; }
curl -s "$base/api/v1/message/$id" | python3 -c '
import json,sys,re,html
d=json.load(sys.stdin)
print("subject:", d.get("Subject"), "| date:", d.get("Date"))
body=d.get("HTML") or d.get("Text") or ""
for u in dict.fromkeys(re.findall(r"href=\"([^\"]+)\"", body)):
    u=html.unescape(u)
    print("link:", re.sub(r"(token(_hash)?=)[^&]+", r"\1<hidden>", u))
'
