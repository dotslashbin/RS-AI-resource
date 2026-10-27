/* Writes ./logos/<slug>.png: each booker division mark downscaled to 128px for this preview.
   READS booker/public/division-icons/ and never writes there — the originals are not touched.
   Rendered as plain <img> (no mask, no canvas read in the page), so ./ files are fine under
   file:// — the data: URI rule in the design-preview skill applies only to masks/canvas reads.
   Run: node .plans/previews/booker-home-divisions-layout/build-logos.mjs */
import { chromium } from "/home/joshua/RS/booker/node_modules/playwright/index.mjs";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const SRC = "/home/joshua/RS/booker/public/division-icons";
const OUT = new URL("./logos/", import.meta.url).pathname;
const SIZE = 128;
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent("<body></body>");
const files = readdirSync(SRC).filter((f) => f.endsWith(".png")).sort();
for (const f of files) {
  const uri = "data:image/png;base64," + readFileSync(`${SRC}/${f}`).toString("base64");
  const png = await p.evaluate(async ([src, size]) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement("canvas"); c.width = size; c.height = size;
    const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
    x.drawImage(img, 0, 0, size, size);
    return c.toDataURL("image/png").split(",")[1];
  }, [uri, SIZE]);
  writeFileSync(OUT + f, Buffer.from(png, "base64"));
}
await b.close();
console.log(`wrote ${files.length} logos at ${SIZE}px to logos/`);
