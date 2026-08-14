import { useEffect, useId } from "react";
import { X } from "lucide-react";
import "./Sheet.css";

export default function Sheet({ open, title, onClose, children }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="m3-sheet__scrim" onClick={onClose}>
      <section className="m3-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
        <div className="m3-sheet__handle" />
        <header className="m3-sheet__header"><h2 id={titleId}>{title}</h2><button type="button" aria-label="Close" onClick={onClose}><X size={20} /></button></header>
        <div className="m3-sheet__body">{children}</div>
      </section>
    </div>
  );
}
