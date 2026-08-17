import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { mapMuscles } from "../src/data/muscleMap.js";

const SOURCE_JSON = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const OUT_JSON = resolve(import.meta.dirname, "../src/data/exerciseLibrary.json");
const OUT_IMAGES_DIR = resolve(import.meta.dirname, "../public/exercise-images");

async function main() {
  const response = await fetch(SOURCE_JSON);
  if (!response.ok) throw new Error(`Failed to fetch exercise data: ${response.status}`);
  const upstream = await response.json();

  const kept = [];
  let droppedNoPrimary = 0;

  for (const entry of upstream) {
    const primaryMuscles = mapMuscles(entry.primaryMuscles);
    if (!primaryMuscles.length) { droppedNoPrimary++; continue; }
    const secondaryMuscles = mapMuscles(entry.secondaryMuscles).filter(m => !primaryMuscles.includes(m));
    kept.push({
      id: entry.id,
      name: entry.name,
      primaryMuscles,
      secondaryMuscles,
      equipment: entry.equipment || "",
      category: entry.category || "",
      instructions: Array.isArray(entry.instructions) ? entry.instructions : [],
      _images: Array.isArray(entry.images) ? entry.images.slice(0, 2) : [],
    });
  }

  kept.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Kept ${kept.length} exercises, dropped ${droppedNoPrimary} with no mappable primary muscle.`);

  await mkdir(OUT_IMAGES_DIR, { recursive: true });
  let imageCount = 0;
  for (const entry of kept) {
    if (!entry._images.length) continue;
    const dir = resolve(OUT_IMAGES_DIR, entry.id);
    await mkdir(dir, { recursive: true });
    for (let i = 0; i < entry._images.length; i++) {
      const imageResponse = await fetch(IMAGE_BASE + entry._images[i]);
      if (!imageResponse.ok) { console.warn(`Image fetch failed for ${entry.id}/${i}: ${imageResponse.status}`); continue; }
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      await writeFile(resolve(dir, `${i}.jpg`), buffer);
      imageCount++;
    }
  }
  console.log(`Downloaded ${imageCount} images.`);

  const output = kept.map(({ _images, ...rest }) => rest);
  await writeFile(OUT_JSON, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${OUT_JSON}`);
}

main().catch(err => { console.error(err); process.exit(1); });
