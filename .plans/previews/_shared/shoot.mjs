/*
 * The design-preview runner. One entry point for every preview under `.plans/previews/`.
 *
 *   node .plans/previews/_shared/shoot.mjs --new <topic> --app booker|vendor|command|mobile
 *   node .plans/previews/_shared/shoot.mjs <topic>                  # sync + nine checks
 *   node .plans/previews/_shared/shoot.mjs <topic> --shoot          # + contact sheets
 *   node .plans/previews/_shared/shoot.mjs <topic> --full picker,map # + those at full size
 *
 * Checks are the default and screenshots are opt-in, because the review loop is: you open
 * `index.html` yourself. See `.claude/skills/design-preview/SKILL.md` and
 * `.plans/2026-10-18-design-preview-harness.md`.
 *
 * ⚠️ Playwright is resolved from an APP's `node_modules` by path, because `.plans/` is not an
 * npm package and has none of its own. This is the one thing that lets the runner be invoked
 * from anywhere in the repo instead of requiring `cd booker` first.
 *
 * ⚠️ Output is terse ON PURPOSE. One line on success; on failure, only the failures. A chatty
 * runner just moves the cost from writing a preview to reading its output.
 */
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

const SHARED = dirname(fileURLToPath(import.meta.url));
const PREVIEWS = resolve(SHARED, "..");
const ROOT = resolve(SHARED, "../../..");

const VIEWPORTS = {
  desktop: { width: 1280, height: 800, scale: 1 },
  mobile: { width: 390, height: 844, scale: 2 },
};

/* Which shared files each app's previews get, and under what local name. */
const SYNC = {
  booker: { "tokens.css": "booker.css", "chrome.css": "preview-chrome.css", "base.js": "base.js", "chrome.js": "booker.js", "controller.js": "controller.js" },
  vendor: { "tokens.css": "vendor.css", "chrome.css": "preview-chrome.css", "base.js": "base.js", "chrome.js": "vendor.js", "controller.js": "controller.js" },
  // No chrome.js: command has no preview to harvest helpers from yet (plan DEFERRED).
  command: { "tokens.css": "command.css", "chrome.css": "preview-chrome.css", "base.js": "base.js", "controller.js": "controller.js" },
  /* `tokens.css` is resolved from `cfg.palette` below — mobile borrows a web app's palette
     rather than owning one, because `ezzy-vendor-mobile/src/theme/tokens.ts` ports those exact
     values. The entry must exist for the sync loop to see it. */
  mobile: { "tokens.css": "vendor.css", "chrome.css": "preview-chrome.css", "mobile.css": "mobile.css", "base.js": "base.js", "chrome.js": "mobile.js", "controller.js": "controller.js" },
};

const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16);
const read = (p) => fs.readFileSync(p);
const die = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};

/* ── argv ───────────────────────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));

/* ── scaffold ───────────────────────────────────────────────────────────────────────────── */
if (flag("new")) {
  const topic = opt("new");
  const app = opt("app");
  if (!topic || !app) die("usage: --new <topic> --app booker|vendor|command|mobile");
  if (!SYNC[app]) die(`unknown app '${app}' — one of ${Object.keys(SYNC).join(", ")}`);
  scaffold(topic, app);
  process.exit(0);
}

const topic = positional[0];
if (!topic) die("usage: shoot.mjs <topic> [--shoot] [--full a,b]  |  --new <topic> --app <app>");

const dir = join(PREVIEWS, topic);
if (!fs.existsSync(dir)) die(`no preview at ${relative(ROOT, dir)} — scaffold it with --new ${topic} --app <app>`);

const cfgPath = join(dir, "preview.json");
if (!fs.existsSync(cfgPath)) die(`${relative(ROOT, cfgPath)} is missing`);
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
if (!SYNC[cfg.app]) die(`preview.json: unknown app '${cfg.app}'`);

const themes = cfg.themes || ["light", "dark"];
const viewportNames = cfg.viewports || ["desktop", "mobile"];
for (const v of viewportNames) if (!VIEWPORTS[v]) die(`preview.json: unknown viewport '${v}'`);

const wantShots = flag("shoot");
const wantFull = (opt("full") || "").split(",").map((s) => s.trim()).filter(Boolean);
const isMobile = cfg.app === "mobile";

const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

/* ── check 8 — synced files have not drifted ────────────────────────────────────────────── */
syncSharedFiles();

/* ── check 7 — the preview's own JS parses ──────────────────────────────────────────────── */
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  try {
    execFileSync(process.execPath, ["--check", join(dir, f)], { stdio: "pipe" });
  } catch (e) {
    fail(f, `node --check failed\n${String(e.stderr || e).trim()}`);
  }
}
if (failures.length) report();

/* ── Playwright, from an app's node_modules ─────────────────────────────────────────────── */
const hosts = [cfg.app, "vendor", "booker", "command"].filter((a) => a !== "mobile");
let chromium;
for (const host of hosts) {
  const pkg = join(ROOT, host, "node_modules", "@playwright", "test", "package.json");
  if (!fs.existsSync(pkg)) continue;
  /* `require`, not a dynamic import: @playwright/test is CJS and its named exports are not
     reliably detected through an ESM namespace — `chromium` comes back undefined. */
  chromium = createRequire(join(ROOT, host, "package.json"))("@playwright/test").chromium;
  break;
}
if (!chromium) die(`@playwright/test not found in ${hosts.join("/")} node_modules — run npm install in one of them`);

const INDEX = pathToFileURL(join(dir, "index.html")).href;
const shots = [];
let cells = 0;

const browser = await chromium.launch();

/* Read the screen list off the page itself, so `screens.js` is the single source of truth and
   `preview.json` never restates it. */
const probe = await browser.newPage();
await probe.goto(`${INDEX}?chrome=off`);
await probe.waitForFunction(() => document.documentElement.dataset.pvReady === "1", { timeout: 10_000 })
  .catch(() => die("the controller never signalled ready — does screens.js set window.PREVIEW_SCREENS?"));
const screens = await probe.evaluate(() =>
  (window.PREVIEW_SCREENS || []).map((s) => ({ id: s.id, label: s.label })),
);
await probe.close();
if (!screens.length) die("window.PREVIEW_SCREENS is empty");

for (const vpName of viewportNames) {
  const vp = VIEWPORTS[vpName];
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.scale,
    reducedMotion: "reduce",
  });

  /* Check 3 — nothing may leave the machine. A preview that silently fetched a font or a tile
     would not be the thing being reviewed. */
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("file://")) return route.continue();
    fail(`${vpName}`, `non-file:// request attempted: ${url}`);
    return route.abort();
  });

  const page = await context.newPage();
  page.on("pageerror", (e) => fail(`${vpName}`, `page error: ${e.message}`)); // check 1
  page.on("console", (m) => {
    if (m.type() === "error") fail(`${vpName}`, `console error: ${m.text()}`); // check 2
  });

  for (const theme of themes) {
    for (const screen of screens) {
      const where = `${screen.id}/${vpName}/${theme}`;
      await page.goto(`${INDEX}?screen=${screen.id}&theme=${theme}&chrome=off`);
      await page.waitForFunction(() => document.documentElement.dataset.pvReady === "1", { timeout: 10_000 });
      cells += 1;

      const found = await page.evaluate(audit, { isMobile });
      if (found.tokenUnresolved) fail(where, `check 9: --pv-strong did not resolve — is tokens.css loading? (a CSP-blocked stylesheet fails SILENTLY)`);
      if (found.overflow) fail(where, `check 4: horizontal overflow (scrollWidth ${found.scrollWidth} > ${found.innerWidth})`);
      found.small.forEach((s) => fail(where, `check 5: control under 44x44 — ${s}`));
      found.cropped.forEach((s) => fail(where, `check 6: fixed chrome cropped out of viewport — ${s}`));
      found.rn.forEach((s) => fail(where, `mobile: ${s}`));

      const flagged = failures.some((f) => f.startsWith(`${where}:`));
      if (flagged || wantFull.includes(screen.id)) {
        /* B3 — a failing screen always leaves full-resolution evidence, whether or not
           screenshots were asked for. A 1/4-scale contact sheet hides exactly the defects
           these checks are for (near-me's F1 was an invisible control in dark mode). */
        const out = join(dir, "flagged");
        fs.mkdirSync(out, { recursive: true });
        await page.screenshot({ path: join(out, `${screen.id}-${vpName}-${theme}.png`), fullPage: true });
      }
      if (wantShots) {
        /* Viewport-sized, not fullPage: uniform cells make a legible grid. The flagged shots
           above are the fullPage ones. */
        shots.push({
          screen: screen.id, label: screen.label, viewport: vpName, theme,
          png: (await page.screenshot()).toString("base64"),
        });
      }
    }
  }
  await context.close();
}

if (wantShots) await writeContactSheets(browser);
await browser.close();
report();

/* ── the in-page audit: checks 4, 5, 6, 9 and the mobile set ────────────────────────────── */
function audit({ isMobile }) {
  const out = {
    overflow: false, scrollWidth: 0, innerWidth: 0,
    small: [], cropped: [], rn: [], tokenUnresolved: false,
  };

  /* Check 9 — a known token must RESOLVE. A stylesheet blocked by CSP fails silently, so a
     successful request proves nothing; only a computed value does. */
  const probe = getComputedStyle(document.documentElement).getPropertyValue("--pv-strong").trim();
  out.tokenUnresolved = probe === "";

  out.scrollWidth = document.documentElement.scrollWidth;
  out.innerWidth = window.innerWidth;
  out.overflow = out.scrollWidth > out.innerWidth;

  const name = (el) => {
    const t = (el.textContent || "").trim().slice(0, 28);
    return `<${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(/\s+/)[0]}` : ""}>${t ? ` "${t}"` : ""}`;
  };

  /* Check 5 — interactive controls ≥44×44 (ux-design §5). Hidden controls are exempt: a
     zero-box element is not something a finger can miss. */
  document.querySelectorAll("button, select, a[href], input, [role=tab], [role=button]").forEach((el) => {
    if (el.closest(".pv-bar")) return; // the runner's own chrome, not the design
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (getComputedStyle(el).display === "none") return;
    if (r.width < 44 || r.height < 44) out.small.push(`${name(el)} is ${Math.round(r.width)}x${Math.round(r.height)}`);
  });

  /* Check 6 — fixed/sticky chrome must stay inside the viewport. */
  document.querySelectorAll("*").forEach((el) => {
    const pos = getComputedStyle(el).position;
    if (pos !== "fixed" && pos !== "sticky") return;
    const r = el.getBoundingClientRect();
    if (r.height === 0) return;
    if (r.top < -1 || r.bottom > window.innerHeight + 1) out.cropped.push(name(el));
  });

  if (!isMobile) return out;

  /*
   * The three effects React Native cannot render without an extra package
   * (`ezzy-vendor-mobile/src/theme/tokens.ts:7–11`). An HTML mock gets all three for free,
   * which is how a design wins approval for something the app cannot build.
   */
  const layers = (shadow) => {
    let depth = 0, n = 1;
    for (const ch of shadow) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) n++;
    }
    return n;
  };

  document.querySelectorAll("*").forEach((el) => {
    /* The preview bar is not part of the design, and `getComputedStyle` still resolves
       `box-shadow` on a `display: none` element — so without both guards every mobile preview
       fails on the runner's own chrome. `getClientRects()` is the test for "actually rendered". */
    if (el.closest(".pv-bar") || !el.getClientRects().length) return;
    const s = getComputedStyle(el);
    if (s.filter && s.filter !== "none" && s.filter.includes("blur")) out.rn.push(`filter: blur on ${name(el)} — RN needs expo-blur`);
    if (s.backdropFilter && s.backdropFilter !== "none") out.rn.push(`backdrop-filter on ${name(el)} — RN has no equivalent`);
    if (s.boxShadow && s.boxShadow !== "none" && layers(s.boxShadow) > 1)
      out.rn.push(`${layers(s.boxShadow)}-layer box-shadow on ${name(el)} — RN shadow() takes one`);
    const bg = `${s.backgroundImage} ${s.background}`;
    if (bg.includes("gradient") && !el.closest('[data-rn="linear-gradient"]'))
      out.rn.push(`gradient on ${name(el)} without data-rn="linear-gradient" — RN needs expo-linear-gradient`);
  });
  return out;
}

/* ── contact sheets ─────────────────────────────────────────────────────────────────────── */
async function writeContactSheets(browser) {
  const groups = new Map();
  for (const s of shots) {
    const key = `${s.viewport}-${s.theme}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const written = [];
  for (const [key, group] of groups) {
    const cols = Math.min(4, group.length);
    /* Bigger cells when there are few screens. A contact sheet that is too small to read is
       the failure mode B3 warns about — near-me's F1 was a dark-mode contrast defect that a
       thumbnail would not have shown. */
    const cellW = group.length <= 2 ? 460 : group.length <= 6 ? 360 : 300;
    /* Composed in the browser rather than with an image library, so the runner stays
       dependency-free — `.plans/` has no node_modules of its own. */
    const html = `<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; background: #0f172a; color: #e2e8f0;
             font: 12px/1.4 system-ui, sans-serif; }
      #sheet { display: inline-block; padding: 16px; }
      h1 { font-size: 14px; margin: 0 0 12px; }
      .g { display: grid; grid-template-columns: repeat(${cols}, ${cellW}px); gap: 14px; }
      figure { margin: 0; }
      img { width: ${cellW}px; display: block; border: 1px solid #334155; border-radius: 6px; }
      figcaption { margin-top: 5px; color: #94a3b8; }
      </style><div id="sheet"><h1>${topic} · ${key}</h1><div class="g">${group
        .map((s) => `<figure><img src="data:image/png;base64,${s.png}"><figcaption>${s.screen}</figcaption></figure>`)
        .join("")}</div></div>`;
    await page.setContent(html);
    await page.waitForLoadState("load");
    const file = `contact-${key}.png`;
    /* The #sheet wrapper is `width: max-content`, so this crops to the grid instead of
       padding the sheet out to the viewport. */
    await page.locator("#sheet").screenshot({ path: join(dir, file) });
    written.push({ file, key, group });
  }
  await page.close();

  /* A paste-ready README block, so nobody hand-types a screenshot table again. */
  const md = [
    `<!-- generated by shoot.mjs — ${new Date().toISOString().slice(0, 10)} -->`,
    "",
    "## Screenshots",
    "",
    `Contact sheets — one per viewport × theme. Full-resolution images are not committed; regenerate with \`node .plans/previews/_shared/shoot.mjs ${topic} --shoot\`, or \`--full <screen>\` for one at full size.`,
    "",
    ...written.map((w) => `- [${w.key}](${w.file}) — ${w.group.length} screens`),
    "",
    "| Screen | What to look at |",
    "|---|---|",
    ...screens.map((s) => `| ${s.label} | |`),
  ].join("\n");
  fs.writeFileSync(join(dir, "screenshots.md"), `${md}\n`);

  fs.writeFileSync(
    join(dir, "report.json"),
    `${JSON.stringify({ topic, app: cfg.app, date: new Date().toISOString(), cells, screens, sheets: written.map((w) => w.file), failures }, null, 2)}\n`,
  );
}

/* ── sync, with a drift check that cannot be fooled by an mtime ─────────────────────────── */
function syncSharedFiles() {
  const manifestPath = join(dir, ".synced.json");
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
  const next = {};
  let synced = 0;

  for (const [local, source] of Object.entries(SYNC[cfg.app])) {
    const src = cfg.app === "mobile" && local === "tokens.css" ? `${cfg.palette || "vendor"}.css` : source;
    const srcPath = join(SHARED, src);
    if (!fs.existsSync(srcPath)) die(`shared source missing: ${relative(ROOT, srcPath)}`);
    const srcHash = sha(read(srcPath));
    const dstPath = join(dir, local);

    if (fs.existsSync(dstPath)) {
      const dstHash = sha(read(dstPath));
      /* The copy differs from what we last wrote → someone edited the GENERATED file. Fail
         rather than overwrite: silently discarding an edit is worse than stopping. */
      if (manifest[local] && dstHash !== manifest[local] && dstHash !== srcHash) {
        fail(local, `generated file was hand-edited — change _shared/${src} instead, then re-run (or delete ${local} to take the shared version)`);
        next[local] = manifest[local];
        continue;
      }
      if (dstHash === srcHash) {
        next[local] = srcHash;
        continue;
      }
    }
    fs.copyFileSync(srcPath, dstPath);
    next[local] = srcHash;
    synced += 1;
  }

  /* Mobile borrows a web palette, so record which one — a silent swap would change every colour. */
  if (cfg.app === "mobile") next["//palette"] = cfg.palette || "vendor";
  fs.writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
  if (synced) console.log(`  synced ${synced} shared file(s) from _shared/`);
}

/* ── report ─────────────────────────────────────────────────────────────────────────────── */
function report() {
  if (failures.length) {
    console.error(`✖ ${topic}: ${failures.length} failure(s)`);
    [...new Set(failures)].slice(0, 40).forEach((f) => console.error(`   ${f}`));
    if (new Set(failures).size > 40) console.error(`   … ${new Set(failures).size - 40} more`);
    if (fs.existsSync(join(dir, "flagged"))) console.error(`   full-size evidence: ${relative(ROOT, join(dir, "flagged"))}/`);
    process.exit(1);
  }
  const shotNote = wantShots ? `, ${new Set(shots.map((s) => `${s.viewport}-${s.theme}`)).size} contact sheets` : "";
  console.log(`✅ ${topic}: ${screens.length} screens × ${viewportNames.length} × ${themes.length} = ${cells} cells, 9 checks, 0 failures${shotNote}`);
  if (!wantShots) console.log(`   no screenshots written (--shoot to record) · open ${relative(ROOT, join(dir, "index.html"))}`);
  process.exit(0);
}

/* ── scaffold ───────────────────────────────────────────────────────────────────────────── */
function scaffold(topic, app) {
  const dir = join(PREVIEWS, topic);
  if (fs.existsSync(dir)) die(`${relative(ROOT, dir)} already exists`);
  fs.mkdirSync(dir, { recursive: true });

  const mobile = app === "mobile";
  const palette = mobile ? "vendor" : app;
  const sheets = ["tokens.css", "chrome.css", mobile && "mobile.css", "preview.css"].filter(Boolean);
  const scripts = ["base.js", SYNC[app]["chrome.js"] && "chrome.js", "screens.js", "controller.js"].filter(Boolean);

  fs.writeFileSync(join(dir, "preview.json"),
    `${JSON.stringify({ app, ...(mobile ? { palette } : {}), viewports: ["desktop", "mobile"], themes: ["light", "dark"] }, null, 2)}\n`);

  fs.writeFileSync(join(dir, "index.html"), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'">
  <title>${topic} — preview</title>
${sheets.map((s) => `  <link rel="stylesheet" href="./${s}">`).join("\n")}
${scripts.map((s) => `  <script src="./${s}" defer></script>`).join("\n")}
</head>
<body>
  <div id="root"></div>

  <!-- Preview-only controls. Not part of the design; hidden by ?chrome=off. -->
  <div class="pv-bar">
    <span class="pv-label">PREVIEW</span>
    <label>Screen <select id="pv-screen"></select></label>
    <label>Theme <select id="pv-theme"><option value="light">Light</option><option value="dark">Dark</option></select></label>
  </div>
</body>
</html>
`);

  const demo = mobile
    ? `PVA.device(
      PVA.navHeader("${topic}", {}) +
      PVA.screenBody(\`<div class="mcard"><p>Replace this with the screen.</p></div>\`) +
      PVA.tabBar([{ id: "home", label: "Home", icon: "home" }], "home")
    )`
    : app === "command"
      ? `\`<div class="rs-page"><div class="rs-card pvc">Replace this with the screen.</div></div>\``
      : app === "booker"
        ? `PVA.topbar() + PVA.tabs("home") + PVA.shelf("Section", "Subtitle",
      PVA.offeringCard({ title: "Court B — Hourly", vendor: "Sample Studio", code: "COURTB", price: "₱850 / hour", city: "Makati City" }))`
        : `PVA.shell(PV.card(PV.header("${topic}", "Replace this with the screen.") + PV.footer("A note.", PV.button("Next", { primary: true }))), { active: "Offerings" })`;

  fs.writeFileSync(join(dir, "screens.js"), `/*
 * ${topic} — the screens. THIS FILE IS THE WORK; everything else is scaffolding.
 *
 * One entry per screen: \`id\` goes in the URL, \`label\` shows in the picker and the README,
 * \`render()\` returns an HTML string. Build it from \`PV\` (generic helpers, base.js)${SYNC[app]["chrome.js"] ? ` and
 * \`PVA\` (${app} chrome, chrome.js)` : ""}.
 *
 * Fixtures are INVENTED — never real vendor or customer rows. Keep them internally
 * consistent: two halves of one fixture disagreeing reads as a design error, not a preview bug.
 */
"use strict";

window.PREVIEW_SCREENS = [
  {
    id: "default",
    label: "Replace me · the first state to review",
    render: () => ${demo},
  },
];
`);

  fs.writeFileSync(join(dir, "preview.css"), `/*
 * ${topic} — SCREEN-SPECIFIC rules only.
 *
 * Tokens are in \`tokens.css\` and shared chrome in \`chrome.css\`${mobile ? " / `mobile.css`" : ""} — both generated
 * from \`_shared/\`, so do not restate a token or a chrome class here. If a rule would be
 * useful to the next preview, it belongs in \`_shared/${palette}.css\` instead.
 *
 * ⚠️ No inline \`style=""\` in screens.js — AT ALL. \`style-src 'self'\` blocks a style
 * attribute and reports it as a console error, which is check 2. A dynamic value becomes a
 * \`data-\` attribute with its mapping here.
 */
`);

  fs.writeFileSync(join(dir, "README.md"), `# ${topic} — visual preview

**Date:** ${new Date().toISOString().slice(0, 10)} · **Plan:** [\`<plan file>\`](../../<plan file>) · **Status:** for review before execution approval — **not an implementation.**

Open [index.html](index.html) directly in a browser (no server). The **PREVIEW** bar picks a
screen and a theme; query parameters select a state, e.g. \`index.html?screen=default&theme=dark\`.
${mobile ? "The frame is 390×844 with real safe-area insets." : "Narrow the window below 640px for the phone layout."}

## What it shows

| Screen | What to look at |
|---|---|
| Replace me | |

## Design fit

- Tokens are ${palette}'s own, copied from \`${palette === "booker" ? "booker" : palette === "command" ? "command" : "vendor"}/app/globals.css\` via \`_shared/${palette}.css\`.
- Every tappable control is ≥44px (ux-design §5), asserted by the runner.
- Both themes render from the same markup.
- **Additional packages required: none.** ${mobile ? "⚠️ Say so explicitly if a screen needs `expo-linear-gradient`, `expo-blur` or a platform shadow — see Limits." : ""}

## Limits

Static fixtures only: nothing is saved, no Supabase, no app imports, no network. The
\`shoot.mjs\` run asserts zero non-\`file://\` requests and fails if one is attempted.

- Fonts are a fallback — the real app self-hosts its family through \`next/font\`, a build
  artefact that cannot load offline. Letter shapes and spacing differ slightly.
- Screen-reader structure is sketched in the markup, but focus movement and live announcements
  are **not** simulated — those get checked in the real build.
- Fixture values are invented and internally consistent. They are not seeded data.
${mobile ? `- ⚠️ **This is an HTML mock of a native screen.** Gradients, blur and multi-layer shadows have
  no React Native equivalent (\`ezzy-vendor-mobile/src/theme/tokens.ts:7–11\`); the runner fails
  the preview if one appears, so what you see here is what RN can actually render without an
  extra package. Safe-area insets are hard-coded iPhone-class numbers, not the device's own.
` : ""}
## Findings

<!-- What building this preview revealed. Mark each as preview-only or something the real build
     must resolve. This section is why near-me's dark-mode contrast defect (F1) was caught at
     all — do not delete it as empty boilerplate; write "None" if there were none. -->

## Regenerating

\`\`\`bash
node .plans/previews/_shared/shoot.mjs ${topic}          # nine checks, no screenshots
node .plans/previews/_shared/shoot.mjs ${topic} --shoot  # + contact sheets
\`\`\`
`);

  console.log(`✅ scaffolded ${relative(ROOT, dir)} (app: ${app})
   next: write the screens in ${relative(ROOT, join(dir, "screens.js"))}
   then: node .plans/previews/_shared/shoot.mjs ${topic}`);
}
