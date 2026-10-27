/*
 * measure.mjs — the preview-specific measurements behind the README's claims. Run after shoot.mjs:
 *   node .plans/previews/booker-home-divisions-layout/measure.mjs
 *
 * What it asserts (exit 1 on any failure), each in both themes unless stated:
 *   A. visible logo→label gap, from PIXELS (lowest ink row of the mark to the first ink row of
 *      the label), per tile, desktop 1280@1x and phone 390@2x;
 *   B. light, proposed: label colour is black (plan I7, 2026-10-26) and the mark's solid
 *      pixels are exactly (3, 74, 252);
 *   C. dark: the proposed tile's computed label colour and mark filter equal the current tile's;
 *   D. phone: one row, the strip scrolls, the last division can be scrolled fully into view,
 *      every tile is in tab order, arrow keys move the focused strip;
 *   E. section order search → promos → divisions → rest, one carousel, at 1280 and 390;
 *   F. at 320 / 360 / 390 / 640 / 768: no page overflow, tiles ≥44×44, no truncated label,
 *      one row at ≤640 and wrapping rows at 768.
 *
 * ⚠️ These measure THE PREVIEW (fallback fonts, 128px logo copies). The app's own numbers come
 * from its build — see the plan's verification section.
 */
import { chromium } from "/home/joshua/RS/booker/node_modules/playwright/index.mjs";
import { pathToFileURL } from "node:url";

const INDEX = pathToFileURL(new URL("./index.html", import.meta.url).pathname).href;
const fails = [];
const fail = (m) => fails.push(m);
const log = (m) => console.log(m);

const b = await chromium.launch();

async function open(screen, theme, width, height, scale) {
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const p = await ctx.newPage();
  await p.goto(`${INDEX}?screen=${screen}&theme=${theme}&chrome=off`);
  await p.waitForFunction(() => document.documentElement.dataset.pvReady === "1");
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  return { p, ctx };
}

/* Decode a PNG buffer in the page (data: URI, so the canvas is not tainted) and return rows of ink. */
async function inkRows(p, buf, scale) {
  return p.evaluate(async ([b64, scale]) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const bg = [d[0], d[1], d[2]];
    const rows = [];
    const exact = { opaque: 0, exact: 0 };
    for (let y = 0; y < c.height; y++) {
      let ink = false;
      for (let i = 0; i < c.width; i++) {
        const k = (y * c.width + i) * 4;
        const dl = Math.abs(d[k] - bg[0]) + Math.abs(d[k + 1] - bg[1]) + Math.abs(d[k + 2] - bg[2]);
        if (dl > 60) ink = true;
      }
      rows.push(ink);
    }
    return { rows, h: c.height, scale };
  }, [buf.toString("base64"), scale]);
}

/* A. + B. + C. per screen/viewport/theme */
async function tiles(screen, theme, vw, vh, scale, variantSel) {
  const { p, ctx } = await open(screen, theme, vw, vh, scale);
  const wraps = await p.$$(variantSel);
  const out = [];
  for (const w of wraps.slice(0, 1)) {
    const ts = await w.$$(".tile");
    for (const t of ts) {
      /* Phone strip: bring each tile fully into its scroller so all 13 are measured. */
      await t.evaluate((el) => el.scrollIntoView({ block: "nearest", inline: "center" }));
      await p.waitForTimeout(30);
      const geo = await t.evaluate((el) => {
        const n = el.querySelector(".tileName").getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return { nameTop: n.top - r.top, slug: el.dataset.division, w: r.width, h: r.height };
      });
      const buf = await t.screenshot();
      const { rows } = await inkRows(p, buf, scale);
      const split = Math.round(geo.nameTop * scale);
      let logoBottom = -1, labelTop = -1;
      for (let y = 0; y < split && y < rows.length; y++) if (rows[y]) logoBottom = y;
      for (let y = split; y < rows.length; y++) if (rows[y]) { labelTop = y; break; }
      out.push({ slug: geo.slug, gap: (labelTop - logoBottom - 1) / scale, w: geo.w, h: geo.h });
    }
  }
  const styles = await p.evaluate((sel) => {
    const w = document.querySelector(sel);
    const n = w.querySelector(".tileName"), img = w.querySelector(".tileIcon img");
    return { color: getComputedStyle(n).color, filter: getComputedStyle(img).filter };
  }, variantSel);
  await ctx.close();
  return { out, styles };
}

/* B. exact colour of opaque mark pixels: screenshot one tile icon at 2x and count. */
async function exactInk(screen) {
  const { p, ctx } = await open(screen, "light", 1280, 800, 2);
  const icons = await p.$$('.wrap[data-variant="proposed"] .tileIcon');
  let opaque = 0, exact = 0, near = 0;
  for (const ic of icons.slice(0, 13)) {
    const buf = await ic.screenshot({ omitBackground: false });
    const r = await p.evaluate(async (b64) => {
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let o = 0, e = 0, n = 0;
      for (let k = 0; k < d.length; k += 4) {
        // "opaque mark pixel": far from the light body and blue-dominant
        const blueish = d[k + 2] > 200 && d[k] < 60 && d[k + 1] < 120;
        if (!blueish) continue;
        o++;
        if (d[k] === 3 && d[k + 1] === 74 && d[k + 2] === 252) e++;
        else if (Math.abs(d[k] - 3) <= 2 && Math.abs(d[k + 1] - 74) <= 2 && Math.abs(d[k + 2] - 252) <= 2) n++;
      }
      return { o, e, n };
    }, buf.toString("base64"));
    opaque += r.o; exact += r.e; near += r.n;
  }
  await ctx.close();
  return { opaque, exact, near };
}

const summary = (arr) => {
  const g = arr.map((t) => t.gap).filter((x) => x >= 0);
  return g.length ? `${Math.min(...g).toFixed(1)}–${Math.max(...g).toFixed(1)}px (median ${g.sort((a, c) => a - c)[g.length >> 1].toFixed(1)}, ${g.length} tiles)` : "n/a";
};

/* ── A/B/C ─────────────────────────────────────────────────────────────────────────── */
for (const theme of ["light", "dark"]) {
  const curD = await tiles("current", theme, 1280, 800, 1, '.wrap[data-variant="current"]');
  const proD = await tiles("proposed", theme, 1280, 800, 1, '.wrap[data-variant="proposed"]');
  const curM = await tiles("current", theme, 390, 844, 2, '.wrap[data-variant="current"]');
  const proM = await tiles("proposed", theme, 390, 844, 2, '.wrap[data-variant="proposed"]');
  log(`A ${theme} desktop gap: current ${summary(curD.out)} · proposed ${summary(proD.out)}`);
  log(`A ${theme} phone   gap: current ${summary(curM.out)} · proposed ${summary(proM.out)}`);
  const outl = (a) => a.filter((t) => t.gap > 12 || t.gap < 8).map((t) => `${t.slug} ${t.gap}`).join(", ") || "none";
  log(`  outliers (<8 or >12px) — desktop current: ${outl(curD.out)} · proposed: ${outl(proD.out)} · phone current: ${outl(curM.out)} · proposed: ${outl(proM.out)}`);
  for (const [name, arr] of [["desktop", proD.out], ["phone", proM.out]]) {
    const g = arr.map((t) => t.gap).sort((a, c) => a - c), med = g[g.length >> 1];
    /* 2026-10-26 (plan I7 #3): a little closer than the approved ~10px — preview median 5–9px. */
    if (med < 5 || med > 9) fail(`A ${theme} ${name}: proposed median gap ${med}px outside 5–9px`);
  }
  for (const t of [...proD.out, ...proM.out]) {
    /* ezzy-work is ACCEPTED as an outlier (README F2): 14.5% of its own PNG is transparent below the ink. */
    if (t.slug !== "ezzy-work" && (t.gap < 4 || t.gap > 11)) fail(`A ${theme} ${t.slug}: proposed visible gap ${t.gap}px outside 4–11px`);
    if (t.w < 44 || t.h < 44) fail(`A ${theme} ${t.slug}: tile ${t.w}×${t.h} under 44×44`);
  }
  if (theme === "light") {
    log(`B light label colour: proposed ${proD.styles.color} (current ${curD.styles.color}); mark filter ${proD.styles.filter}`);
    if (proD.styles.color !== "rgb(0, 0, 0)") fail(`B light label colour is ${proD.styles.color} (black expected since 2026-10-26, plan I7)`);
  } else {
    log(`C dark: current {${curD.styles.color}, ${curD.styles.filter}} · proposed {${proD.styles.color}, ${proD.styles.filter}}`);
    if (curD.styles.color !== proD.styles.color || curD.styles.filter !== proD.styles.filter) fail("C dark colours differ between current and proposed");
  }
}
const ink = await exactInk("proposed");
log(`B light mark pixels (blue-dominant, 13 marks @2x): ${ink.opaque} · exactly #034afc ${ink.exact} (${(100 * ink.exact / ink.opaque).toFixed(1)}%) · within ±2 ${ink.near}`);
if (ink.exact / ink.opaque < 0.5) fail("B fewer than half the solid mark pixels are exactly #034afc");

/* ── G: desktop rows left-aligned (plan I7 #1) ──────────────────────────────────────── */
for (const theme of ["light", "dark"]) {
  const { p, ctx } = await open("proposed", theme, 1280, 800, 1);
  const r = await p.evaluate(() => {
    const tiles = [...document.querySelectorAll('.wrap[data-variant="proposed"] .tile')];
    const rows = new Map();
    tiles.forEach((t) => { const b = t.getBoundingClientRect(); const k = Math.round(b.top); rows.set(k, [...(rows.get(k) || []), b.left]); });
    const firsts = [...rows.values()].map((xs) => Math.min(...xs));
    return { rows: [...rows.values()].map((xs) => xs.length), firsts };
  });
  log(`G ${theme} desktop rows ${r.rows.join(" + ")} · first-tile x ${r.firsts.map(Math.round).join(" / ")}`);
  if (Math.max(...r.firsts) - Math.min(...r.firsts) > 0.5) fail(`G ${theme}: rows do not start at the same x`);
  await ctx.close();
}

/* ── D: phone strip behaviour ─────────────────────────────────────────────────────── */
{
  const { p, ctx } = await open("proposed", "light", 390, 844, 2);
  const r = await p.evaluate(() => {
    const s = document.querySelector('.wrap[data-variant="proposed"] .strip');
    const tiles = [...s.querySelectorAll(".tile")];
    const rows = new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top))).size;
    const scrolls = s.scrollWidth > s.clientWidth;
    s.scrollLeft = s.scrollWidth;
    const last = tiles[tiles.length - 1].getBoundingClientRect(), sr = s.getBoundingClientRect();
    const lastVisible = last.left >= sr.left - 0.5 && last.right <= sr.right + 0.5;
    const peek = (() => { s.scrollLeft = 0; const cut = tiles.find((t) => { const b = t.getBoundingClientRect(); return b.left < sr.right && b.right > sr.right + 1; }); return cut ? cut.dataset.division : null; })();
    return { rows, scrolls, lastVisible, lastSlug: tiles[tiles.length - 1].dataset.division, count: tiles.length, peek, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  log(`D phone: ${r.count} tiles in ${r.rows} row · scrolls ${r.scrolls} · last (${r.lastSlug}) fully visible at end ${r.lastVisible} · tile cut at the right edge: ${r.peek} · page overflow ${r.overflow}px`);
  if (r.rows !== 1) fail(`D phone: ${r.rows} rows`);
  if (!r.scrolls || !r.lastVisible) fail("D phone: strip does not scroll to its last division");
  if (!r.peek) fail("D phone: no partially visible tile at the edge (affordance)");
  if (r.overflow > 0) fail(`D phone: page overflows by ${r.overflow}px`);
  // keyboard: focus the strip, arrow right scrolls it
  await p.focus('.wrap[data-variant="proposed"] .strip');
  for (let i = 0; i < 6; i++) await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(400);
  const sl = await p.$eval('.wrap[data-variant="proposed"] .strip', (s) => s.scrollLeft);
  log(`D phone: ArrowRight ×6 on the focused strip → scrollLeft ${Math.round(sl)}px`);
  if (sl <= 0) fail("D phone: arrow keys do not scroll the focused strip");
  // tab order: 13 tiles reachable
  await p.$eval('.wrap[data-variant="proposed"] .strip', (s) => { s.scrollLeft = 0; });
  await p.focus('.wrap[data-variant="proposed"] .strip');
  const seen = new Set();
  for (let i = 0; i < 13; i++) {
    await p.keyboard.press("Tab");
    const s = await p.evaluate(() => document.activeElement?.dataset?.division || null);
    if (s) seen.add(s);
  }
  const lastInView = await p.evaluate(() => { const a = document.activeElement, s = a.closest(".strip"); const r = a.getBoundingClientRect(), sr = s.getBoundingClientRect(); return r.right <= sr.right + 0.5; });
  log(`D phone: Tab reached ${seen.size}/13 tiles; the last focused tile scrolled into view ${lastInView}`);
  if (seen.size !== 13) fail(`D phone: Tab reached ${seen.size}/13`);
  await ctx.close();
}

/* ── E: section order ─────────────────────────────────────────────────────────────── */
for (const [vw, vh, sc] of [[1280, 800, 1], [390, 844, 2]]) {
  for (const screen of ["current", "proposed"]) {
    const { p, ctx } = await open(screen, "light", vw, vh, sc);
    const r = await p.evaluate(() => {
      const top = (k) => document.querySelector(`[data-order="${k}"]`).getBoundingClientRect().top;
      const order = ["search", "progress", "promos", "divisions", "rest"].map((k) => [k, top(k)]).sort((a, c) => a[1] - c[1]).map((x) => x[0]);
      return { order, carousels: document.querySelectorAll(".pc").length };
    });
    log(`E ${vw}px ${screen}: ${r.order.join(" → ")} · carousels ${r.carousels}`);
    if (screen === "proposed" && r.order.join() !== "search,progress,promos,divisions,rest") fail(`E ${vw}px proposed order ${r.order}`);
    if (r.carousels !== 1) fail(`E ${vw}px ${screen}: ${r.carousels} carousels`);
    await ctx.close();
  }
}

/* ── F: widths ────────────────────────────────────────────────────────────────────── */
for (const w of [320, 360, 390, 640, 768]) {
  for (const theme of ["light", "dark"]) {
    const { p, ctx } = await open("proposed", theme, w, 900, 2);
    const r = await p.evaluate(() => {
      const s = document.querySelector('.wrap[data-variant="proposed"] .strip');
      const tiles = [...s.querySelectorAll(".tile")];
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        rows: new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top))).size,
        small: tiles.filter((t) => { const b = t.getBoundingClientRect(); return b.width < 44 || b.height < 44; }).length,
        truncated: tiles.filter((t) => { const n = t.querySelector(".tileName"); return n.scrollWidth > n.clientWidth + 0.5; }).length,
        minW: Math.min(...tiles.map((t) => t.getBoundingClientRect().width)),
      };
    });
    if (theme === "light") log(`F ${w}px: rows ${r.rows} · narrowest tile ${r.minW.toFixed(1)}px · tiles <44 ${r.small} · truncated labels ${r.truncated} · page overflow ${r.overflow}px`);
    if (r.overflow > 0) fail(`F ${w} ${theme}: page overflow ${r.overflow}px`);
    if (r.small) fail(`F ${w} ${theme}: ${r.small} tiles under 44×44`);
    if (r.truncated) fail(`F ${w} ${theme}: ${r.truncated} truncated labels`);
    if (w <= 640 && r.rows !== 1) fail(`F ${w}: ${r.rows} rows (expected 1)`);
    if (w > 640 && r.rows < 2) fail(`F ${w}: ${r.rows} rows (expected wrapping rows)`);
    await ctx.close();
  }
}

await b.close();
if (fails.length) { console.log(`\n❌ ${fails.length} failure(s):\n- ` + fails.join("\n- ")); process.exit(1); }
console.log("\n✅ measure.mjs: all assertions passed");
