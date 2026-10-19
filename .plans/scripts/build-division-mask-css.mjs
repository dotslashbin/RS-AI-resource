/* Generate `masks.css`: each division mark as a downscaled data: URI for `mask-image`.
   Chromium treats a file:// image as cross-origin for a CSS mask (but not for <img>), so a
   mask in a file:// preview MUST be a data: URI. 96px is ample for a 72px box at 2x. */
import { chromium } from "/home/joshua/RS/booker/node_modules/playwright/index.mjs";
import { writeFileSync, readdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
const DIR = "/home/joshua/RS/.plans/previews/booker-ui/logos";
const OUT = "/home/joshua/RS/.plans/previews/booker-ui/masks.css";
const SIZE = 96;
const files = readdirSync(DIR).filter(f => f.endsWith(".png")).sort();
const b = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const p = await b.newPage();
writeFileSync(`${DIR}/_gen.html`, "<!doctype html><meta charset=utf-8><body></body>");
await p.goto(pathToFileURL(`${DIR}/_gen.html`).href);
const out = [];
for (const f of files) {
  const slug = f.replace(".png", "");
  const uri = await p.evaluate(async ([src, size]) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement("canvas"); c.width = size; c.height = size;
    const x = c.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(img, 0, 0, size, size);
    return c.toDataURL("image/png");
  }, [pathToFileURL(`${DIR}/${f}`).href, SIZE]);
  out.push({ slug, uri });
}
await b.close();
rmSync(`${DIR}/_gen.html`, { force: true });
const head = `/*
 * GENERATED — do not hand-edit. Rebuild with the snippet in README.md → Regenerating.
 *
 * ⚠️ WHY THESE ARE data: URIs AND NOT \`url(./logos/x.png)\`. Chromium treats one file:// URL
 * as cross-origin to another, and a CSS \`mask-image\` is a CORS-checked fetch — so a mask
 * pointed at a sibling PNG fails with "blocked by CORS policy" and the element renders as a
 * flat coloured box. A plain <img> of the SAME file is fine, which is why only the masks are
 * inlined here. Downscaled to ${SIZE}px: a mask only needs an alpha channel.
 */
`;
writeFileSync(OUT, head + out.map(o => `[data-slug="${o.slug}"] { --mark: url(${o.uri}); }`).join("\n") + "\n");
console.log(`wrote masks.css — ${out.length} marks`);
