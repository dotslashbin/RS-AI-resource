/* Writes booker/components/home/DivisionStrip/DivisionIcon3d.tsx from this preview's 3D icons
   (plan 2026-10-25-booker-home-divisions-layout I11, D21-B), and prints the `--db-ic3d-*` token
   block that goes into booker/app/globals.css (`:root` and `.dark`).
   ⚠️ The preview is the source of truth. Re-run this after changing icons3d.js or the tone rules in
   preview.css; never hand-edit the generated file.
   - Only the 13 slugs in booker/lib/divisions.ts. ICONS3D.SLUGS also holds the rejected Court
     variants, and `ezzy-court` already draws the chosen paddle.
   - Colour by tone class → `var(--db-ic3d-<tone>)`. Every other presentation property (stroke
     width, caps, joins, vector-effect) is read with getComputedStyle, so the sharpening survives.
   - `fit()` needs getBBox, hence a browser.
   Run: node .plans/previews/booker-home-divisions-layout/export-icons3d.mjs */
import { chromium } from "/home/joshua/RS/booker/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const BOOKER = "/home/joshua/RS/booker";
const OUT = `${BOOKER}/components/home/DivisionStrip/DivisionIcon3d.tsx`;
const PAGE = new URL("./index.html?screen=icons3d&theme=light&chrome=off", import.meta.url).href;

const divisions = readFileSync(`${BOOKER}/lib/divisions.ts`, "utf8");
const slugBlock = divisions.match(/DIVISION_SLUGS = \[([\s\S]*?)\] as const/);
if (!slugBlock) throw new Error("DIVISION_SLUGS not found in lib/divisions.ts");
const SLUGS = [...slugBlock[1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
if (SLUGS.length !== 13) throw new Error(`expected 13 division slugs, found ${SLUGS.length}`);

/* Tone classes that carry colour, and the CSS property each one's colour lives on. */
const FACE = ["t", "l", "r", "d", "w", "x", "p", "pr"];
const STROKE_ONLY = { xs: "r", ln: "r", xd: "xd", xw: "x", xl: "x" };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(PAGE);
await page.waitForFunction(() => document.documentElement.dataset.pvReady === "1");

/* Draw each icon in a fresh mono <svg>, fit it, and serialise its elements. */
const icons = await page.evaluate(({ slugs, face, strokeOnly }) => {
  const host = document.createElement("div");
  host.className = "wrap";
  document.body.appendChild(host);
  const out = {};
  for (const slug of slugs) {
    host.innerHTML = window.ICONS3D.svg(slug, "mono");
    window.ICONS3D.fit(host);
    const g = host.querySelector("g.i3g");
    const els = [...g.children].map((el) => {
      const cls = el.getAttribute("class");
      const cs = getComputedStyle(el);
      const attrs = {};
      for (const a of el.attributes) if (a.name !== "class") attrs[a.name] = a.value;
      let tone, fillNone = false, strokeNone = false;
      if (face.includes(cls)) tone = cls;
      else if (cls === "sh") { tone = "sh"; strokeNone = true; }
      else if (cls in strokeOnly) { tone = strokeOnly[cls]; fillNone = true; }
      else throw new Error(`${slug}: unknown tone class "${cls}"`);
      return {
        tag: el.tagName, attrs, tone, fillNone, strokeNone,
        strokeWidth: cs.strokeWidth, linecap: cs.strokeLinecap, linejoin: cs.strokeLinejoin,
        vectorEffect: cs.vectorEffect,
      };
    });
    out[slug] = { transform: g.getAttribute("transform"), els };
  }
  host.remove();
  return out;
}, { slugs: SLUGS, face: FACE, strokeOnly: STROKE_ONLY });

/* Each tone's resolved colour, in light and in dark, read off a probe element. */
async function tones(theme) {
  return page.evaluate(({ theme, face }) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    const host = document.createElement("div");
    host.innerHTML = `<svg class="i3" data-icset="mono" viewBox="0 0 10 10">${
      [...face, "sh", "xd"].map((c) => `<path class="${c}" d="M0 0"/>`).join("")}</svg>`;
    document.body.appendChild(host);
    const res = {};
    for (const el of host.querySelectorAll("path")) {
      const c = el.getAttribute("class");
      const cs = getComputedStyle(el);
      res[c] = c === "xd" ? cs.stroke : cs.fill;
    }
    host.remove();
    return res;
  }, { theme, face: FACE });
}
const light = await tones("light");
const dark = await tones("dark");
await browser.close();

/* Computed colours come back as rgb(), rgba() or color(srgb …). Normalise to #rrggbb[aa]. */
function hex(value) {
  let m = value.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
  let rgba;
  if (m) rgba = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  else if ((m = value.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/)))
    rgba = [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : +m[4]];
  else throw new Error(`unparsed colour: ${value}`);
  const h = (n) => Math.round(n).toString(16).padStart(2, "0");
  return `#${h(rgba[0])}${h(rgba[1])}${h(rgba[2])}${rgba[3] < 1 ? h(rgba[3] * 255) : ""}`;
}

const used = new Set();
const round = (s) => s.replace(/-?\d+\.\d+/g, (n) => String(Math.round(+n * 10) / 10));
const JSX_NAME = { "fill-rule": "fillRule" };

function element(e) {
  used.add(e.tone);
  const colour = `var(--db-ic3d-${e.tone})`;
  const a = [];
  for (const [k, v] of Object.entries(e.attrs)) a.push(`${JSX_NAME[k] || k}="${round(v)}"`);
  a.push(`fill="${e.fillNone ? "none" : colour}"`);
  if (e.strokeNone) a.push(`stroke="none"`);
  else {
    a.push(`stroke="${colour}"`, `strokeWidth="${parseFloat(e.strokeWidth)}"`);
    if (e.linecap !== "butt") a.push(`strokeLinecap="${e.linecap}"`);
    if (e.linejoin !== "miter") a.push(`strokeLinejoin="${e.linejoin}"`);
    if (e.vectorEffect === "non-scaling-stroke") a.push(`vectorEffect="non-scaling-stroke"`);
  }
  return `<${e.tag} ${a.join(" ")} />`;
}

const body = SLUGS.map((slug) => {
  const { transform, els } = icons[slug];
  if (!els.length) throw new Error(`${slug}: empty drawing`);
  return `  "${slug}": (\n    <g transform="${transform}">\n${els.map((e) => `      ${element(e)}`).join("\n")}\n    </g>\n  ),`;
}).join("\n");

const tsx = `/*
 * GENERATED by .plans/previews/booker-home-divisions-layout/export-icons3d.mjs — do not hand-edit.
 * Change the drawing in that preview's icons3d.js (or a tone in its preview.css) and re-run the script.
 *
 * The 3D division icons in "Browse by division" (plan .plans/2026-10-25-booker-home-divisions-layout.md,
 * I11, D21-B). Inline SVG, like \`BrandLogo\`, so the theme switches at paint: every colour is a
 * \`--db-ic3d-*\` token defined in \`app/globals.css\` for \`:root\` and \`.dark\`. No hex here.
 *
 * ⚠️ \`Record<DivisionSlug, …>\`: a division added to \`lib/divisions.ts\` without a drawing fails
 * \`tsc\`. Draw it in the preview and re-run the script.
 * ⚠️ \`vectorEffect="non-scaling-stroke"\` keeps the edge strokes at a fixed screen width whatever
 * the icon's size; it is what keeps them crisp at 42px.
 */
import type { ReactElement } from "react"
import type { DivisionSlug } from "@/lib/divisions"

const ICONS: Record<DivisionSlug, ReactElement> = {
${body}
}

/** One division's 3D icon, filling its box. Decorative: the tile's visible label names it. */
export function DivisionIcon3d({ slug }: { slug: DivisionSlug }) {
  return (
    <svg viewBox="0 0 100 100" overflow="visible" shapeRendering="geometricPrecision" aria-hidden focusable="false">
      {ICONS[slug]}
    </svg>
  )
}
`;

/* Refuse to write anything that breaks the module's contract (plan V2). */
const problems = [];
if (/#[0-9a-fA-F]{3,8}\b/.test(tsx.replace(/^\s*\*.*$/gm, ""))) problems.push("hex colour");
for (const bad of ["style=", "<style", "<script", "href"]) if (tsx.includes(bad)) problems.push(bad);
if ((tsx.match(/^ {2}"ezzy-[a-z]+": \(/gm) || []).length !== 13) problems.push("not 13 entries");
if (problems.length) throw new Error(`refusing to write: ${problems.join(", ")}`);
writeFileSync(OUT, tsx);

const block = (t) => [...used].sort().map((k) => `    --db-ic3d-${k}: ${hex(t[k])};`).join("\n");
console.log(`wrote ${OUT} (${tsx.length} bytes, ${SLUGS.length} icons, tones: ${[...used].sort().join(" ")})`);
console.log(`\n/* :root */\n${block(light)}\n\n/* .dark */\n${block(dark)}`);
