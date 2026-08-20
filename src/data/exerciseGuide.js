import { formGuide } from "./formGuide.js";
import { viewForMuscles } from "./muscleMap.js";
import { getExerciseLibraryEntrySync } from "./exerciseLibraryLoader.js";

export function guideFor(name, draftExercise) {
  const authored = formGuide[name];
  if (authored) return { kind: "authored", ...authored };

  const libraryId = draftExercise?.libraryId;
  const entry = libraryId && getExerciseLibraryEntrySync(libraryId);
  if (!entry) return null;

  const primary = draftExercise.primaryMuscles?.length ? draftExercise.primaryMuscles : entry.primaryMuscles;
  const secondary = draftExercise.secondaryMuscles?.length ? draftExercise.secondaryMuscles : entry.secondaryMuscles;
  return {
    kind: "library",
    view: viewForMuscles([...primary, ...secondary]),
    primary, secondary,
    instructions: entry.instructions,
    images: [`/exercise-images/${entry.id}/0.jpg`, `/exercise-images/${entry.id}/1.jpg`],
  };
}
