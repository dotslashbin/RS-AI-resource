/*
 * Contrast measurements for `.plans/previews/dark-lift-*` (the dark-mode lift proposal).
 *
 *   node .plans/scripts/dark-lift-contrast.mjs
 *
 * The four dark palettes below are the SAME values the three previews' `preview.css` use.
 * Translucent surfaces are composited over the LIGHTEST page stop, which is the worst case
 * for light text. Booker's derived tile labels are checked against the page only, because
 * that is where they render and what `booker/lib/palette.test.ts` checks them against.
 */
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const white = (a, base) => base.map((b) => Math.round(255 * a + b * (1 - a)));
const surface = (v, base) => (typeof v === "string" ? hex(v) : white(v, base));

const PALETTES = {
  current: { page: ["#04060e", "#070b17", "#05080f"], sidebar: "#05080f", card: 0.028, sub: 0.04, panel: "#0c1220" },
  A:       { page: ["#0a0e1b", "#0d1323", "#0b101d"], sidebar: "#0b101d", card: 0.035, sub: 0.05, panel: "#141b2d" },
  B:       { page: ["#04060e", "#070b17", "#05080f"], sidebar: "#0b101e", card: "#121a2b", sub: 0.05, panel: "#1a2337" },
  /* C as chosen 2026-10-21: see-through cards (plan B1). `C-solid` is the rejected first draft. */
  C:       { page: ["#080c18", "#0b1020", "#090e1a"], sidebar: "#0f1526", card: 0.055, sub: 0.05, panel: "#1e283d" },
  "C-solid": { page: ["#080c18", "#0b1020", "#090e1a"], sidebar: "#0f1526", card: "#161e31", sub: 0.05, panel: "#1e283d" },
};

const TEXT = { text: "#94a3b8", strong: "#f1f5f9", primary: "#60a5fa", "badge pending": "#f59e0b", "badge confirmed": "#10b981", "badge cancelled": "#f87171" };
const LABELS = { court: "#2571fc", care: "#6379b1", well: "#75918b", drive: "#0c77ec", pets: "#f47356", work: "#fd7802", park: "#ed3b0c", learn: "#478579", law: "#c69d73", home: "#747a80" };

/* Option C's retuned values (plan I3, I7). Applied to C and C-solid so the count below reports
   what would actually ship, not the values being replaced. */
const RETUNED = { court: "#2c75fc", care: "#667cb3", drive: "#137bed", learn: "#4b877c", home: "#787e84", "badge cancelled": "#f87474" };
const pick = (name, k, f) => (name.startsWith("C") && RETUNED[k]) || f;

let fails = 0;
for (const [name, p] of Object.entries(PALETTES)) {
  const pages = p.page.map(hex);
  const page = pages.reduce((a, b) => (lum(a) > lum(b) ? a : b));
  const card = surface(p.card, page);
  const sub = white(p.sub, card);
  const panel = hex(p.panel);
  /* Plan B1: a card inside a card's recessed well (booker HomeSection → PopularCardRow). An
     opaque card token repeats the outer colour; a translucent one stacks lighter. */
  const inner = surface(p.card, sub);
  console.log(`\n${name}: page(worst) ${toHex(page)} · card ${toHex(card)} · sub ${toHex(sub)}`);
  const nest = (lum(inner) >= lum(sub) ? "+" : "−") + ratio(inner, sub).toFixed(2);
  console.log(`  nesting     inner card vs its well ${nest}${lum(inner) < lum(sub) ? " ✗ inverted" : ""}`);
  console.log(`  separation  card/page ${ratio(card, page).toFixed(2)} · sidebar/page ${ratio(hex(p.sidebar), page).toFixed(2)} · sub/card ${ratio(sub, card).toFixed(2)} · panel/page ${ratio(panel, page).toFixed(2)}`);
  const row = (k, f, bases) => {
    const r = Math.min(...bases.map((b) => ratio(hex(f), b)));
    if (r < 4.5) fails++;
    return `${k} ${r.toFixed(2)}${r < 4.5 ? "✗" : ""}`;
  };
  console.log("  text (min of page/card/sub/inner): " + Object.entries(TEXT).map(([k, f]) => row(k, pick(name, k, f), [page, card, sub, inner])).join(" · "));
  console.log("  booker tile labels (page):   " + Object.entries(LABELS).map(([k, f]) => row(k, pick(name, k, f), pages)).join(" · "));
}
console.log(`\n${fails} pairs under 4.5:1`);

/* Option C only: the smallest lift toward white that brings each failing label back to 4.5:1
   on C's page. These are the values `dark-lift-booker/preview.css` uses under `.opt-c`. */
const cPages = PALETTES.C.page.map(hex);
const retuned = Object.entries(LABELS).flatMap(([k, f]) => {
  if (Math.min(...cPages.map((b) => ratio(hex(f), b))) >= 4.5) return [];
  for (let t = 0.01; t < 1; t += 0.01) {
    const c = hex(f).map((v) => Math.round(v + (255 - v) * t));
    const r = Math.min(...cPages.map((b) => ratio(c, b)));
    if (r >= 4.55) return [`${k} ${f} → ${toHex(c)} (${r.toFixed(2)})`];
  }
  return [];
});
console.log(`\nC needs ${retuned.length} retuned tile labels:\n  ` + retuned.join("\n  "));
