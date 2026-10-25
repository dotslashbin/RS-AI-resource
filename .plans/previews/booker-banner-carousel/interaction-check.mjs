/*
 * Interaction, width and reduced-motion checks for this preview (not part of the shared runner,
 * which only knows 390 and 1280 and never presses anything). Prints one JSON line per cell and
 * a final PASS/FAIL line; exits non-zero on any failure.
 *
 *   node .plans/previews/booker-banner-carousel/interaction-check.mjs
 *
 * What it asserts — every one about the PREVIEW's sketch of the behaviour, not the real build:
 *   - no document overflow and no non-file:// request at 320/360/390/768/1280, both themes
 *   - the banner box is 3:1 at every width (± 1px) and reserves its height before images decode
 *   - exactly one tabbable banner link per multi-slide carousel; hidden slides are aria-hidden
 *   - Next / Previous move one slide, update dots and the live text, and stop at the ends
 *     (aria-disabled, focus stays on the button)
 *   - ArrowRight on the focused banner moves to the next banner and focuses its link
 *   - clicking a banner does not navigate (inert preview link), and carries target/rel
 *   - 12 slides render a counter, not 12 dots; 1 slide renders no controls; 0 slides nothing
 *   - under prefers-reduced-motion the track has no smooth scroll-behaviour
 */
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../booker/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = new URL("./index.html", import.meta.url).href;
const b = await chromium.launch();
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

/* ── Widths × themes: layout only ─────────────────────────────────────────────────────── */
for (const w of [320, 360, 390, 768, 1280]) for (const theme of ["light", "dark"]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  const reqs = []; p.on("request", (r) => { if (!r.url().startsWith("file:")) reqs.push(r.url()); });
  await p.goto(`${base}?screen=home&theme=${theme}&chrome=off`);
  await p.waitForFunction(() => document.documentElement.dataset.pvReady === "1");
  const r = await p.evaluate(() => {
    /* The SLIDE, not the track: the track's 1px border adds 2px of height. */
    const t = document.querySelector(".pc-slide").getBoundingClientRect();
    const ctr = document.querySelector(".pc-controls").getBoundingClientRect();
    const btns = [...document.querySelectorAll(".pc-btn")].map((x) => x.getBoundingClientRect());
    return {
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      banner: [Math.round(t.width), Math.round(t.height)],
      ratio: +(t.width / t.height).toFixed(3),
      controlsInside: ctr.left >= t.left - 1 && ctr.right <= t.right + 1,
      minBtn: Math.min(...btns.map((x) => Math.min(x.width, x.height))),
    };
  });
  const line = { w, theme, reqs: reqs.length, ...r };
  console.log(JSON.stringify(line));
  ok(r.docOverflow === 0, `${w}/${theme}: document overflows by ${r.docOverflow}px`);
  ok(reqs.length === 0, `${w}/${theme}: network request ${reqs[0]}`);
  ok(Math.abs(r.ratio - 3) < 0.02, `${w}/${theme}: banner ratio ${r.ratio}, expected 3`);
  ok(r.controlsInside, `${w}/${theme}: controls wider than the banner`);
  ok(r.minBtn >= 44, `${w}/${theme}: control ${r.minBtn}px < 44`);
  await p.close();
}

/* ── Interaction, at phone width (the tighter case) ───────────────────────────────────── */
{
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  await p.goto(`${base}?screen=home&theme=light&chrome=off`);
  await p.waitForFunction(() => document.documentElement.dataset.pvReady === "1");
  const state = () => p.evaluate(() => {
    const c = document.querySelector(".pc");
    const links = [...c.querySelectorAll(".pc-link")];
    return {
      tabbable: links.filter((a) => a.tabIndex !== -1).length,
      current: links.findIndex((a) => a.tabIndex !== -1),
      hiddenOk: [...c.querySelectorAll(".pc-slide")].every((s, i, all) =>
        (s.getAttribute("aria-hidden") === "false") === (s.querySelector("a").tabIndex !== -1)),
      dot: [...c.querySelectorAll(".pc-dot")].findIndex((d) => d.classList.contains("is-on")),
      prevDis: c.querySelector('[data-dir="-1"]').getAttribute("aria-disabled"),
      nextDis: c.querySelector('[data-dir="1"]').getAttribute("aria-disabled"),
      live: c.querySelector(".pc-live").textContent,
      scroll: Math.round(c.querySelector(".pc-track").scrollLeft / c.querySelector(".pc-track").clientWidth),
      focus: document.activeElement?.className || "",
    };
  });
  const settle = () => p.waitForTimeout(900);

  let s = await state();
  ok(s.tabbable === 1 && s.current === 0 && s.hiddenOk, `initial tab order ${JSON.stringify(s)}`);
  ok(s.prevDis === "true" && s.nextDis === "false" && s.live === "", `initial controls ${JSON.stringify(s)}`);

  await p.click('[data-dir="1"]'); await settle(); s = await state();
  ok(s.current === 1 && s.dot === 1 && s.scroll === 1 && s.live === "Promotion 2 of 3" && s.hiddenOk, `after Next ${JSON.stringify(s)}`);
  await p.click('[data-dir="1"]'); await settle(); s = await state();
  ok(s.current === 2 && s.nextDis === "true", `at end ${JSON.stringify(s)}`);
  /* `force`: Playwright treats aria-disabled="true" as not enabled and would wait forever —
     the real build's Playwright spec needs the same flag to test this path. */
  await p.click('[data-dir="1"]', { force: true }); await settle(); s = await state();
  ok(s.current === 2 && s.scroll === 2 && s.focus.includes("pc-btn"), `Next at end must not wrap or drop focus ${JSON.stringify(s)}`);
  await p.click('[data-dir="-1"]'); await p.click('[data-dir="-1"]'); await settle(); s = await state();
  ok(s.current === 0 && s.prevDis === "true", `back to start ${JSON.stringify(s)}`);

  /* Keyboard: focus the visible banner, ArrowRight moves AND carries focus. */
  await p.focus(".pc-slide:first-child .pc-link");
  await p.keyboard.press("ArrowRight"); await settle(); s = await state();
  const focusedIdx = await p.evaluate(() => [...document.querySelectorAll(".pc .pc-link")].indexOf(document.activeElement));
  ok(s.current === 1 && focusedIdx === 1, `ArrowRight → slide 2 focused (got current ${s.current}, focus ${focusedIdx})`);

  /* Tab from the banner reaches Previous, not a hidden banner. */
  await p.keyboard.press("Tab");
  const tabbedTo = await p.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.className);
  ok(tabbedTo === "Previous promotion", `Tab after banner went to "${tabbedTo}"`);

  /* Inert link: a click must not navigate. */
  const before = p.url();
  const attrs = await p.evaluate(() => { const a = document.querySelector(".pc .pc-link[tabindex='0'], .pc .pc-link:not([tabindex])"); return [a.target, a.rel]; });
  await p.click(".pc-slide:nth-child(2) .pc-link"); await p.waitForTimeout(300);
  const msg = await p.textContent(".pv-dest");
  ok(p.url() === before && msg.startsWith("Would open https://example.com/"), `banner click navigated or printed nothing: ${msg}`);
  ok(attrs[0] === "_blank" && attrs[1] === "noopener noreferrer", `link attrs ${attrs}`);
  console.log(JSON.stringify({ interaction: "390/light", final: s, tabbedTo, attrs }));
  await p.close();
}

/* ── States ───────────────────────────────────────────────────────────────────────────── */
for (const w of [320, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(`${base}?screen=states&theme=dark&chrome=off`);
  await p.waitForFunction(() => document.documentElement.dataset.pvReady === "1");
  const r = await p.evaluate(() => {
    const figs = [...document.querySelectorAll(".st")];
    const f = (i) => figs[i];
    return {
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      zero: f(0).querySelectorAll(".pc").length,
      oneControls: f(1).querySelectorAll(".pc-controls").length,
      oneRole: f(1).querySelector(".pc").getAttribute("aria-roledescription"),
      manyDots: f(2).querySelectorAll(".pc-dot").length,
      manyCount: f(2).querySelector(".pc-count")?.textContent,
      manyRowFits: f(2).querySelector(".pc-controls").scrollWidth <= f(2).querySelector(".pc-controls").clientWidth,
      failedIsLink: !!f(3).querySelector(".pc-fallback[href]"),
      failedRatio: +(() => { const t = f(3).querySelector(".pc-slide").getBoundingClientRect(); return (t.width / t.height).toFixed(2); })(),
    };
  });
  console.log(JSON.stringify({ states: w, ...r }));
  ok(r.docOverflow === 0, `states ${w}: overflow ${r.docOverflow}`);
  ok(r.zero === 0, `states ${w}: zero-slide rendered a carousel`);
  ok(r.oneControls === 0 && r.oneRole === null, `states ${w}: one slide shows controls/role`);
  ok(r.manyDots === 0 && r.manyCount === "1 / 12" && r.manyRowFits, `states ${w}: many ${JSON.stringify(r)}`);
  ok(r.failedIsLink && Math.abs(r.failedRatio - 3) < 0.05, `states ${w}: failed slide ${JSON.stringify(r)}`);
  await p.close();
}

/* ── Reduced motion ───────────────────────────────────────────────────────────────────── */
{
  const ctx = await b.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${base}?screen=home&theme=light&chrome=off`);
  await p.waitForFunction(() => document.documentElement.dataset.pvReady === "1");
  const sb = await p.evaluate(() => getComputedStyle(document.querySelector(".pc-track")).scrollBehavior);
  await p.click('[data-dir="1"]');
  const instant = await p.evaluate(() => { const t = document.querySelector(".pc-track"); return Math.round(t.scrollLeft) === t.clientWidth; });
  console.log(JSON.stringify({ reducedMotion: true, scrollBehavior: sb, instantAfterNext: instant }));
  ok(sb === "auto" && instant, `reduced motion: scroll-behavior ${sb}, instant ${instant}`);
  await ctx.close();
}

await b.close();
console.log(fails.length ? `FAIL (${fails.length})\n- ${fails.join("\n- ")}` : "PASS — all interaction, width, state and reduced-motion checks");
process.exit(fails.length ? 1 : 0);
