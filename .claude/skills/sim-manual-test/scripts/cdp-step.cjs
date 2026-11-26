// Attach to the visible Chromium, run ONE step module, screenshot, and detach.
//
// Usage:
//   node cdp-step.cjs <step.cjs> <shot-name> [--app <app-dir>] [--url-prefix <prefix>] [--port 9222]
//
// <step.cjs> exports `async (page, ctx) => {}`; ctx = { shot(name), shotsDir }. A step may
// take its own intermediate screenshots with ctx.shot("l2_3a-min-saved").
// Playwright is resolved from the target app's node_modules (--app, or SIM_APP_DIR), so
// nothing is installed for this skill. The browser is NOT closed: browser.close() on a CDP
// connection only detaches, and the user's window stays open and signed in.
// Exit code 1 when the step threw, so a failure is never reported as a pass.
const path = require("path")
const fs = require("fs")

const args = process.argv.slice(2)
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt }
const [stepFile, shotName] = args
if (!stepFile || !shotName) {
  console.error("usage: node cdp-step.cjs <step.cjs> <shot-name> [--app <dir>] [--url-prefix <p>] [--port 9222]")
  process.exit(2)
}
const appDir = opt("--app", process.env.SIM_APP_DIR)
if (!appDir) { console.error("pass --app <app-dir> (or SIM_APP_DIR) so Playwright resolves from that app"); process.exit(2) }
const port = opt("--port", "9222")
const prefix = opt("--url-prefix", "http://localhost:")
const shotsDir = process.env.SIM_SHOTS || path.join(process.env.SIM_SCRATCH || "/tmp/sim-manual-test", "shots")
fs.mkdirSync(shotsDir, { recursive: true })

const { chromium } = require(require.resolve("playwright", { paths: [path.resolve(appDir)] }))

;(async () => {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
  const ctx = browser.contexts()[0]
  const page = ctx.pages().find(p => p.url().startsWith(prefix)) || ctx.pages()[0]
  await page.bringToFront()
  const helpers = { shotsDir, shot: name => page.screenshot({ path: path.join(shotsDir, `${name}.png`) }) }
  let failed = false
  try {
    await require(path.resolve(stepFile))(page, helpers)
  } catch (e) {
    failed = true
    console.log("STEP ERROR:", String(e.message).split("\n")[0])
  }
  const shot = path.join(shotsDir, `${shotName}.png`)
  await page.screenshot({ path: shot })
  console.log("URL:", page.url())
  console.log("SHOT:", shot)
  await browser.close() // detaches only
  process.exit(failed ? 1 : 0)
})().catch(e => { console.error("CDP ERROR:", e.message); process.exit(1) })
