/**
 * One-shot helper: ensure every full-size wallpaper in
 * public/images/walls/ has a .jpg sibling next to its .webp. JPG is
 * what people actually want when downloading wallpapers — most phones
 * (especially iOS) don't accept .webp as a wallpaper file.
 *
 * Idempotent: skips files that already have a .jpg.
 *
 *   node scripts/walls-jpg-from-webp.mjs
 */
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const DIR = "public/images/walls";
const QUALITY = 92;

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

const all = await readdir(DIR);
const fulls = all.filter(
  (n) => n.endsWith(".webp") && !n.endsWith("_thumb.webp")
);

let made = 0;
for (const name of fulls) {
  const webp = join(DIR, name);
  const jpg = join(DIR, name.replace(/\.webp$/, ".jpg"));
  if (await exists(jpg)) continue;
  await sharp(webp).jpeg({ quality: QUALITY, mozjpeg: true }).toFile(jpg);
  made++;
  console.log("jpg ←", name);
}
console.log(`\nDone. ${made} new file(s).`);
