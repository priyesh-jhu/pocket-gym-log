import { useMemo, useState } from "react";
import { Button, Chip, ListItem, Sheet, TextField } from "./index.js";
import { MUSCLES } from "../data/formGuide.js";
import exerciseLibrary from "../data/exerciseLibrary.json" with { type: "json" };
import "./LibraryPickerSheet.css";

const MAX_RESULTS = 50;

export default function LibraryPickerSheet({ open, onClose, onSelect }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? exerciseLibrary.filter(item => item.name.toLowerCase().includes(q)) : exerciseLibrary;
    return matches.slice(0, MAX_RESULTS);
  }, [query]);

  return (
    <Sheet open={open} title="Exercise library" onClose={onClose}>
      <TextField label="Search exercises" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. Romanian deadlift" />
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
    </Sheet>
  );
}
