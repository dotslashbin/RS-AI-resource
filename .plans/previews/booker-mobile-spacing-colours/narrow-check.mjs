/*
 * Narrow-phone and desktop-parity check for this preview (not part of the shared runner,
 * which only knows 390 and 1280). Opens `current` and `proposed` at 320/360/390/641/1280 in
 * both themes and prints one JSON line per cell: document overflow, clipped labels, heading
 * line count, smallest tile box, whether the strip scrolls, the chip staying inside the hero,
 * and the measured hero / division widget / next-shelf offsets.
 *
 *   node .plans/previews/booker-mobile-spacing-colours/narrow-check.mjs
 */
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../booker/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = new URL("./index.html", import.meta.url).href;
const b = await chromium.launch();
const out = [];
for (const w of [320, 360, 390, 641, 1280]) for (const theme of ["light", "dark"]) for (const screen of ["current", "proposed", "chips"]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 } });
  const reqs = []; p.on("request", r => { if (!r.url().startsWith("file:")) reqs.push(r.url()); });
  await p.goto(`${base}?screen=${screen}&theme=${theme}&chrome=off`);
  await p.waitForFunction(() => document.documentElement.dataset.pvReady === "1");
  const r = screen === "chips" ? await p.evaluate(() => ({
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    chips: [...document.querySelectorAll(".hp")].map(hp => {
      const el = hp.querySelector(".chip");
      el.scrollIntoView({ block: "center" }); // hit-testing only sees what is on screen
      const b = el.getBoundingClientRect(), h = hp.querySelector(".hero").getBoundingClientRect();
      const x = b.left + b.width / 2;
      return { v: hp.dataset.variant, box: [Math.round(b.width), Math.round(b.height)], inside: b.right <= h.right - 1,
        hit: [b.top + 2, b.bottom - 2].every(y => el.contains(document.elementFromPoint(x, y))),
        truncated: [...el.querySelectorAll(".place")].some(n => n.scrollWidth > n.clientWidth) };
    }),
  })) : await p.evaluate(() => {
    const hp = document.querySelector(".hp");
    const q = s => hp.querySelector(s).getBoundingClientRect();
    const names = [...hp.querySelectorAll(".tileName")];
    const clipped = names.filter(n => n.scrollWidth > n.clientWidth).map(n => n.textContent);
    const heading = hp.querySelector(".heading"); const lh = parseFloat(getComputedStyle(heading).lineHeight);
    const tiles = [...hp.querySelectorAll(".tile")].map(t => t.getBoundingClientRect());
    const strip = hp.querySelector(".strip");
    const chip = q(".chip"), hero = q(".hero");
    return {
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clipped, headingLines: Math.round(heading.getBoundingClientRect().height / lh),
      minTile: [Math.min(...tiles.map(t => t.width)), Math.min(...tiles.map(t => t.height))].map(Math.round),
      stripScrolls: strip.scrollWidth > strip.clientWidth,
      chipInside: chip.right <= hero.right - 1,
      /* A tap 2px inside the TOP and BOTTOM edge of the 44px box — in the proposal, that is the
         transparent band outside the visible pill — must still land on the chip. */
      chipHit: (() => { const el = hp.querySelector(".chip"), b = el.getBoundingClientRect(), x = b.left + b.width / 2;
        return [b.top + 2, b.bottom - 2].every(y => el.contains(document.elementFromPoint(x, y))); })(),
      chipBox: [Math.round(chip.width), Math.round(chip.height)],
      hero: Math.round(hero.height), div: Math.round(q('[data-tone="divisions"]').height),
      next: Math.round(q(".next").top - hp.getBoundingClientRect().top),
    };
  });
  out.push({ w, theme, screen, reqs: reqs.length, ...r });
  await p.close();
}
await b.close();
for (const o of out) console.log(JSON.stringify(o));
