import { formGuide } from "./formGuide.js";
import { viewForMuscles } from "./muscleMap.js";
import exerciseLibrary from "./exerciseLibrary.json" with { type: "json" };

const libraryById = new Map(exerciseLibrary.map(entry => [entry.id, entry]));

export function guideFor(name, draftExercise) {
  const authored = formGuide[name];
  if (authored) return { kind: "authored", ...authored };

  const libraryId = draftExercise?.libraryId;
  const entry = libraryId && libraryById.get(libraryId);
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
