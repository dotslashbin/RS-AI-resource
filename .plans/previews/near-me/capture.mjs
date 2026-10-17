/*
 * Screenshot the Near me preview: every screen × desktop/phone × light/dark.
 *
 * Run from the booker app, which is where Playwright is installed:
 *   cd booker && node ../.plans/previews/near-me/capture.mjs
 *
 * Loads the preview over file:// — no dev server, no network, no port. The preview's own
 * CSP already forbids remote fetches; `page.route` blocks anything non-file as a second
 * belt, and the run fails if a single request escapes.
 *
 * ⚠️ Playwright is resolved from the CURRENT WORKING DIRECTORY, not from this file.
 * `.plans/` is not an npm package and has no `node_modules`, so a plain
 * `import "@playwright/test"` fails here — ESM resolves from the importing file's folder.
 */
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

/* `require`, not a dynamic `import()`: @playwright/test is CJS, and its named exports are
   not reliably detected through an ESM namespace — `chromium` came back undefined. */
const requireFromCwd = createRequire(join(process.cwd(), "package.json"));
const { chromium } = requireFromCwd("@playwright/test");

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = pathToFileURL(join(HERE, "index.html")).href;

const SCREENS = [
  "home-unset",
  "home-city",
  "home-thin",
  "home-empty",
  "picker",
  "picker-dupe",
  "explore",
  "explore-nosort",
  "explore-empty",
  "map",
  "map-fail",
];

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800, scale: 1 },
  { name: "mobile", width: 390, height: 844, scale: 2 },
];

const THEMES = ["light", "dark"];

const escaped = [];

const browser = await chromium.launch();
let shots = 0;

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.scale,
    reducedMotion: "reduce",
  });

  // Nothing may leave the machine. A preview that silently fetched a font or a tile would
  // not be the thing being reviewed.
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("file://")) return route.continue();
    escaped.push(url);
    return route.abort();
  });

  const page = await context.newPage();

  for (const theme of THEMES) {
    for (const screen of SCREENS) {
      await page.goto(`${INDEX}?screen=${screen}&theme=${theme}&chrome=off`);
      await page.waitForLoadState("domcontentloaded");
      // The controller runs on DOMContentLoaded; wait for it to have lit a screen.
      await page.waitForSelector(".screen.is-on", { state: "attached" });
      const file = join(HERE, `${screen}-${vp.name}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      shots += 1;
    }
  }

  await context.close();
}

await browser.close();

if (escaped.length) {
  console.error(`✖ ${escaped.length} non-file request(s) attempted:`);
  [...new Set(escaped)].forEach((u) => console.error(`   ${u}`));
  process.exit(1);
}

console.log(`✅ ${shots} screenshots written, 0 network requests attempted.`);
