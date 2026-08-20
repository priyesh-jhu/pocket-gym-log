import { readdir, stat, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const DIR = resolve(import.meta.dirname, "../public/exercise-images");

async function main() {
  const entries = await readdir(DIR, { withFileTypes: true });
  let before = 0, after = 0, count = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    for (const name of ["0.jpg", "1.jpg"]) {
      const path = resolve(DIR, entry.name, name);
      let sizeBefore;
      try { sizeBefore = (await stat(path)).size; } catch { continue; }

      const buffer = await sharp(path).jpeg({ quality: 68, mozjpeg: true }).toBuffer();
      await writeFile(path + ".tmp", buffer);
      await rename(path + ".tmp", path);

      before += sizeBefore;
      after += buffer.length;
      count++;
    }
  }

  console.log(`Recompressed ${count} images: ${(before / 1e6).toFixed(1)}MB -> ${(after / 1e6).toFixed(1)}MB (${(100 - (after / before) * 100).toFixed(0)}% smaller)`);
}

main().catch(err => { console.error(err); process.exit(1); });
