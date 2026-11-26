# Web route — the Next apps (command, booker, vendor, affiliate)

## Which browser, in order

1. **Claude in Chrome, if this session actually has it.** Check with ToolSearch for
   `mcp__claude-in-chrome` tools; don't assume from the user saying "Chrome is connected" — on
   2026-11-25 `/chrome` was run and no tools appeared. If present, read the
   `anthropic-skills:chrome-browser` skill first and use the user's real Chrome in a new tab.
2. **A visible Chromium on WSLg, driven over CDP** — what the 2026-11-25 run used. The user sees
   every click on their desktop and signs in themselves.
3. **Headless Playwright with screenshots** — only if there is no display (`DISPLAY` and
   `WAYLAND_DISPLAY` both empty). Sign-in then needs the user's help some other way; never type
   or store their password.

## Ports and URLs (local)

| App | Dev port | Notes |
|---|---|---|
| command | 3000 | `npm --prefix command run dev -- --port 3000` |
| vendor | 3001 | |
| booker | 3002 | 3002 is also the affiliate app's local stand-in (plan 2 D11): stop one to run the other |
| affiliate | per plan 3 | its README says 3000, which collides with command |
| Playwright suites | 3300 / 3100 / 3200 | command / vendor / booker — not for manual runs |

- **`http://localhost:<port>`, never `127.0.0.1`.** Next's dev HMR / resource origin check
  misbehaves on 127.0.0.1: pages render but client effects silently don't apply, and recovery
  links can show a black page.
- Local Supabase: API 54321, DB 54322, mail catcher (Mailpit) 54324 (`/api/v1/...`).
- Only 3000–3002 are in the local Auth redirect allowlist (`backbone/supabase/config.toml`).
- Ports are start-order dependent; start dev servers with an explicit `--port`.

## Starting a dev server (only with permission)

```bash
cd /home/joshua/RS/<app> && source ~/.nvm/nvm.sh >/dev/null && nvm use v22.17.0 >/dev/null
npm run dev -- --port 3000 > "$SIM_SCRATCH/<app>-dev.log" 2>&1     # run_in_background
```

Wait for `Ready` in the log and a 200 from `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/`,
then record the **listening** PID (`ss -ltnp | grep ':3000\b'`) — not `$!`, which is npm's
launcher. If `next dev` says "Another next dev server is already running", the user's server is
up for that folder: use theirs (ask), don't start another on a different port, don't stop theirs.

## Visible browser over CDP

```bash
S=<scratchpad>; export SIM_SCRATCH=$S SIM_SHOTS=$S/shots
.claude/skills/sim-manual-test/scripts/launch-browser.sh --check http://localhost:3000   # what would run
.claude/skills/sim-manual-test/scripts/launch-browser.sh http://localhost:3000           # opens the window
```

Ask the user to sign in **in that window** (it does not share their Windows Chrome session), then
take a first screenshot to confirm the signed-in state and which account it is.

Each check is a small step module, run with Playwright resolved from the app's own
`node_modules` (nothing is installed):

```js
// $S/steps/l2_3.cjs
module.exports = async (page, ctx) => {
  await page.locator("#affiliate-min").fill("5")
  await page.getByRole("button", { name: "Save changes" }).nth(2).dispatchEvent("click")
  await page.getByText("Affiliate commission settings updated.").waitFor({ timeout: 10000 })
  await ctx.shot("l2_3a-min-saved")          // intermediate shot while the toast is up
}
```

```bash
node .claude/skills/sim-manual-test/scripts/cdp-step.cjs $S/steps/l2_3.cjs l2_3 --app /home/joshua/RS/command
```

Then Read the printed `SHOT:` path to show the user. Steps can call the read-only query script
through `child_process.execFileSync` when a check needs the database state mid-step.

## Lessons from the first run (2026-11-25)

- **No fixed viewport over CDP.** `connectOverCDP` gives `viewportSize() === null`, so
  Playwright's actionability checks misjudge visibility: `.click()` timed out and
  `{force: true}` failed with "Element is outside of the viewport". For React buttons,
  `locator.dispatchEvent("click")` works reliably. Use real `.click()` only where a native
  behaviour (file picker, link navigation) needs it.
- **Navigation may be in-app state, not the URL.** Command switches pages with `useState`
  (`useAppShell.ts`); the URL stays `/`. Navigate by clicking the visible tab
  (`getByRole("button", { name: "Users", exact: true }).filter({ visible: true })`), and scroll to
  the top first if a long page has pushed the tab bar or sidebar out of reach.
- **Wait for the result, not the frame.** A wait on intro text matched before data loaded and
  produced a "Loading…" screenshot. Wait on the outcome text ("No closure requests" or the error).
- **Scope `getByRole("alert")`.** Next adds an empty `#__next-route-announcer__` with
  `role="alert"`; filter by text.
- **Toasts are transient.** Screenshot inside the step right after waiting for the toast text.
- **Hydration warnings with `bis_skin_checked` or `caret-color` attributes** come from browser
  extensions or Playwright's injection, not the app. Report app 5xx and real errors only.
- **Disabled-state checks:** read `isDisabled()` and the `title` attribute (tooltips on disabled
  buttons do not show on hover in screenshots).
- **Prove "nothing was created"** with SQL on both `auth.users` and `profiles`, not only the UI list.
- **Machine load stalls Playwright** (seen at load average 4+): check `uptime` before blaming the app.

## Stopping

```bash
.claude/skills/sim-manual-test/scripts/stop-port.sh 3000 <recorded-dev-pid>
.claude/skills/sim-manual-test/scripts/stop-port.sh 9222 <recorded-browser-pid>
```

A background-task "exit 143" notification afterwards is your own SIGTERM, not a failure.
