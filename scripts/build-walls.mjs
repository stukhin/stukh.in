/**
 * Wallpaper import helper.
 *
 *   1. Drop any number of .jpg / .jpeg / .png / .webp files into
 *      public/images/walls/incoming/
 *   2. Run:  node scripts/build-walls.mjs
 *
 * For each file the script:
 *   - centre-crops to 9:16
 *   - writes <id>.webp        (1080×1920, q=88)  ← downloadable full-size
 *   - writes <id>_thumb.webp  (360×640,   q=80)  ← grid preview
 *   - moves the original to incoming/processed/
 *   - appends an entry to src/data/walls.json with default metadata
 *     (title from filename, location/year/story/category placeholder,
 *      downloads = 0). Edit those by hand afterwards.
 *
 * If an id already exists in walls.json the script skips it so you can
 * keep the source images around for re-runs.
 */
import { readdir, mkdir, rename, readFile, writeFile, stat } from "node:fs/promises";
import { join, parse, basename } from "node:path";
import sharp from "sharp";

const INCOMING = "public/images/walls/incoming";
const OUT_DIR = "public/images/walls";
const PROCESSED = join(INCOMING, "processed");
const DATA_FILE = "src/data/walls.json";

const FULL_W = 1080;
const FULL_H = 1920;
const THUMB_W = 360;
const THUMB_H = 640;
const TARGET_RATIO = 9 / 16;

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const titleCase = (s) =>
  s
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function listIncoming() {
  if (!(await pathExists(INCOMING))) return [];
  const all = await readdir(INCOMING, { withFileTypes: true });
  return all
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => /\.(jpe?g|png|webp)$/i.test(n));
}

async function loadData() {
  if (!(await pathExists(DATA_FILE))) return [];
  const raw = await readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

async function saveData(data) {
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
}

async function processOne(filename, walls) {
  const inputPath = join(INCOMING, filename);
  const { name } = parse(filename);
  const id = slugify(name);
  if (!id) {
    console.warn("skip (bad filename):", filename);
    return null;
  }
  const fullOut = join(OUT_DIR, `${id}.webp`);
  const thumbOut = join(OUT_DIR, `${id}_thumb.webp`);
  if (walls.some((w) => w.id === id) && (await pathExists(fullOut))) {
    console.log("skip (already exists):", id);
    return null;
  }

  const meta = await sharp(inputPath).metadata();
  let cropW = meta.width;
  let cropH = meta.height;
  if (cropW / cropH > TARGET_RATIO) cropW = Math.round(cropH * TARGET_RATIO);
  else cropH = Math.round(cropW / TARGET_RATIO);
  const left = Math.round((meta.width - cropW) / 2);
  const top = Math.round((meta.height - cropH) / 2);

  await sharp(inputPath)
    .extract({ left, top, width: cropW, height: cropH })
    .resize({ width: FULL_W, height: FULL_H, fit: "cover" })
    .webp({ quality: 88, effort: 6 })
    .toFile(fullOut);

  await sharp(inputPath)
    .extract({ left, top, width: cropW, height: cropH })
    .resize({ width: THUMB_W, height: THUMB_H, fit: "cover" })
    .webp({ quality: 80, effort: 6 })
    .toFile(thumbOut);

  await mkdir(PROCESSED, { recursive: true });
  await rename(inputPath, join(PROCESSED, basename(filename)));

  return {
    id,
    title: titleCase(name),
    location: "Unknown",
    year: new Date().getFullYear(),
    story: "",
    downloads: 0,
    category: "Uncategorised",
  };
}

(async () => {
  const files = await listIncoming();
  if (!files.length) {
    console.log(`Nothing to do — drop images into ${INCOMING}/ first.`);
    return;
  }
  const walls = await loadData();
  let added = 0;
  for (const f of files) {
    const entry = await processOne(f, walls);
    if (!entry) continue;
    walls.push(entry);
    added++;
    console.log("added:", entry.id);
  }
  if (added) {
    await saveData(walls);
    console.log(`\n${added} wallpaper(s) added to ${DATA_FILE}.`);
    console.log(
      "Open the JSON to fill in real title / location / year / story / category."
    );
  } else {
    console.log("Nothing new added.");
  }
})();
