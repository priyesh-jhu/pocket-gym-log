import { useEffect, useMemo, useState } from "react";
import { Chip, ListItem, Sheet, TextField } from "./index.js";
import { MUSCLES } from "../data/formGuide.js";
import { loadExerciseLibrary } from "../data/exerciseLibraryLoader.js";
import "./LibraryPickerSheet.css";

const MAX_RESULTS = 50;

export default function LibraryPickerSheet({ open, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [exerciseLibrary, setExerciseLibrary] = useState(null);

  useEffect(() => {
    if (open && !exerciseLibrary) loadExerciseLibrary().then(setExerciseLibrary);
  }, [open, exerciseLibrary]);

  const results = useMemo(() => {
    if (!exerciseLibrary) return [];
    const q = query.trim().toLowerCase();
    const matches = q ? exerciseLibrary.filter(item => item.name.toLowerCase().includes(q)) : exerciseLibrary;
    return matches.slice(0, MAX_RESULTS);
  }, [query, exerciseLibrary]);

  return (
    <Sheet open={open} title="Exercise library" onClose={onClose}>
      <TextField label="Search exercises" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. Romanian deadlift" />
      {!exerciseLibrary ? (
        <div className="library-picker__count">Loading exercises…</div>
      ) : (
        <>
          <div className="library-picker__count">
            {query
              ? `${results.length}${results.length === MAX_RESULTS ? "+" : ""} match${results.length === 1 ? "" : "es"}`
              : `${exerciseLibrary.length} exercises — type to search`}
          </div>
          <div className="library-picker__list">
            {results.map(item => (
              <button key={item.id} type="button" className="library-picker__row" onClick={() => onSelect(item)}>
                <ListItem
                  title={item.name}
                  subtitle={item.equipment || undefined}
                  trailing={<Chip>{MUSCLES[item.primaryMuscles[0]] || item.primaryMuscles[0]}</Chip>}
                />
              </button>
            ))}
            {results.length === 0 && <div className="library-picker__empty">No exercises match "{query}".</div>}
          </div>
        </>
      )}
    </Sheet>
  );
}
