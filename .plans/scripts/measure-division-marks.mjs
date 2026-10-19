/*
 * Measure each division mark's OPAQUE extent, and print the `--division-art` factors.
 *
 *   node .plans/scripts/measure-division-marks.mjs
 *
 * WHY THIS EXISTS. `booker/app/globals.css` carries two hand-written numbers
 * (`--division-art` for `ezzy-drive` and `ezzy-learn`). They are measurements, not taste, and
 * a measurement nobody can re-derive becomes a magic number the first time a logo is replaced.
 * Run this after changing any file in `booker/public/division-icons/` and update the map if a
 * factor moves past the 6% threshold.
 *
 * WHAT IT MEASURES. Not the canvas — the opaque bounding box. The thirteen PNGs carry
 * different transparent margins, so equal `width`/`height` renders visibly unequal marks. The
 * factor is `median_fill / own_fill`, which makes a corrected mark's ink match the median
 * mark's ink in whatever box it is given.
 *
 * ⚠️ Chromium taints a canvas drawn from a `file://` image unless it is allowed to read local
 * files, and it treats one `file://` URL as cross-origin to another — hence both the launch
 * flag and the throwaway page written into the image directory.
 *
 * Playwright is resolved from `booker/node_modules`; this script is not an npm package and
 * installs nothing.
 */
import { chromium } from "../../booker/node_modules/playwright/index.mjs";
import { readdirSync, writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../../booker/public/division-icons");
/** Only correct a mark that is off by at least this much; see the note in globals.css. */
const THRESHOLD = 0.06;

const files = readdirSync(DIR).filter((f) => f.endsWith(".png")).sort();
if (files.length === 0) throw new Error(`no PNGs in ${DIR}`);

const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const page = await browser.newPage();
const scratch = join(DIR, "_measure.html");
writeFileSync(scratch, "<!doctype html><meta charset=utf-8><body></body>");

try {
  await page.goto(pathToFileURL(scratch).href);

  const rows = [];
  for (const f of files) {
    const r = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const { naturalWidth: w, naturalHeight: h } = img;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, w, h).data;

      let minX = w, minY = h, maxX = -1, maxY = -1, opaque = 0, lum = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (d[i + 3] <= 10) continue;
          opaque++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        }
      }
      if (maxX < 0) return { w, h, bw: 0, bh: 0, meanLum: 0 };
      return { w, h, bw: maxX - minX + 1, bh: maxY - minY + 1, meanLum: lum / opaque };
    }, `./${f}`);
    rows.push({ slug: f.replace(".png", ""), ...r, fill: Math.max(r.bw, r.bh) / Math.max(r.w, r.h) });
  }

  const sorted = [...rows].map((r) => r.fill).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad("slug", 14) + pad("canvas", 11) + pad("opaque box", 13) + pad("fill", 8) + pad("factor", 9) + "meanLum");
  for (const r of rows) {
    const factor = median / r.fill;
    const flag = Math.abs(factor - 1) >= THRESHOLD ? "  <-- needs --division-art" : "";
    console.log(
      pad(r.slug, 14) + pad(`${r.w}x${r.h}`, 11) + pad(`${r.bw}x${r.bh}`, 13) +
      pad(r.fill.toFixed(3), 8) + pad(factor.toFixed(3), 9) + r.meanLum.toFixed(0) + flag,
    );
  }
  console.log(`\nmedian fill = ${median.toFixed(3)} · threshold = ${(THRESHOLD * 100).toFixed(0)}%`);
  console.log("\nPaste into booker/app/globals.css, replacing the --division-art overrides:");
  for (const r of rows) {
    const factor = median / r.fill;
    if (Math.abs(factor - 1) >= THRESHOLD) {
      console.log(`  [data-division="${r.slug}"]${" ".repeat(Math.max(0, 21 - r.slug.length))}{ --division-art: ${factor.toFixed(2)}; }`);
    }
  }
  /* meanLum is printed because a mark under ~70 is near-black line art and depends on its
     light tint to stay visible — the reason `--division-tile` does not flip in dark mode. */
} finally {
  rmSync(scratch, { force: true });
  await browser.close();
}
