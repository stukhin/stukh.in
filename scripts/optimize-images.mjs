/**
 * Convert .jpg / .jpeg / .png to WebP for folders where it actually
 * pays off and where source paths are NOT generated dynamically in
 * code (so we can safely rename references one file at a time).
 *
 * Skipped on purpose:
 *   public/images/gallery/{nature,city}/*  — files are referenced as
 *   `${i}.jpg` in GallerySlider / GalleryModal, and a per-file
 *   conversion would create a mixed-extension folder. These photos
 *   are also already pretty well compressed, so the WebP gain is
 *   small or negative.
 *
 * Behaviour:
 *   - JPEGs: WebP quality 85, effort 6.
 *   - PNGs:  WebP lossless (preserves alpha for parallax layers).
 *   - If WebP comes out larger than the original, drop it and keep
 *     the original.
 *   - Pass --delete to remove originals once a smaller WebP exists.
 */
import { readdir, stat, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import sharp from "sharp";

const TARGETS = [
  "public/images/gallery/main",
  "public/images/parallax",
  "public/images/misc",
];
const DELETE_ORIGINALS = process.argv.includes("--delete");

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const fmt = (n) => (n / 1024).toFixed(0).padStart(5) + " KB";

let origTotal = 0;
let finalTotal = 0;
let convertedCount = 0;
let skippedCount = 0;

for (const root of TARGETS) {
  for await (const file of walk(root)) {
    const ext = extname(file).toLowerCase();
    if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") continue;

    const out = file.replace(/\.(jpg|jpeg|png)$/i, ".webp");
    const origSize = (await stat(file)).size;
    origTotal += origSize;

    const opts =
      ext === ".png"
        ? { lossless: true, effort: 6 }
        : { quality: 85, effort: 6 };
    await sharp(file).webp(opts).toFile(out);

    const webpSize = (await stat(out)).size;
    if (webpSize >= origSize) {
      await unlink(out);
      finalTotal += origSize;
      skippedCount++;
      console.log(
        `${fmt(origSize)} → ${fmt(webpSize)} (skip, kept ${ext})  ${file}`
      );
    } else {
      finalTotal += webpSize;
      convertedCount++;
      const pct = ((webpSize * 100) / origSize).toFixed(0).padStart(3);
      console.log(`${fmt(origSize)} → ${fmt(webpSize)} (${pct}%)  ${file}`);
      if (DELETE_ORIGINALS) await unlink(file);
    }
  }
}

console.log("\n— Summary —");
console.log(`Converted: ${convertedCount}`);
console.log(`Skipped:   ${skippedCount} (WebP was larger than original)`);
console.log(`Originals: ${(origTotal / 1024 / 1024).toFixed(2)} MB`);
console.log(`After:     ${(finalTotal / 1024 / 1024).toFixed(2)} MB`);
console.log(
  `Saved:     ${((origTotal - finalTotal) / 1024 / 1024).toFixed(2)} MB (${(
    100 - (finalTotal * 100) / origTotal
  ).toFixed(0)}%)`
);
if (!DELETE_ORIGINALS)
  console.log("\nRun again with --delete to remove converted originals.");
