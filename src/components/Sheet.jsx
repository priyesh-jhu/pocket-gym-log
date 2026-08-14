import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import "./Sheet.css";

export default function Sheet({ open, title, onClose, children, closeLabel = "Close", initialFocusRef = null, returnFocusRef = null, dismissOnHistory = false }) {
  const titleId = useId();
  const sheetRef = useRef(null);
  const headingRef = useRef(null);
  const historyKey = useRef(null);
  const previousFocus = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    const sheetNode = sheetRef.current;
    const returnTarget = returnFocusRef?.current || previousFocus.current;
    const frame = requestAnimationFrame(() => (initialFocusRef?.current || headingRef.current)?.focus());
    const focusable = () => [...(sheetRef.current?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
    const closeFromUi = () => {
      if (dismissOnHistory && historyKey.current && window.history.state?.sheetKey === historyKey.current) window.history.back();
      else onClose();
    };
    const onKeyDown = event => {
      if (event.key === "Escape") { event.preventDefault(); closeFromUi(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); headingRef.current?.focus(); return; }
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const onPopState = event => {
      if (historyKey.current && event.state?.sheetKey !== historyKey.current) onClose();
    };
    sheetNode?.addEventListener("keydown", onKeyDown);
    if (dismissOnHistory) {
      historyKey.current = `sheet-${titleId}`;
      window.history.pushState({ ...window.history.state, sheetKey: historyKey.current }, "");
      window.addEventListener("popstate", onPopState);
    }
    return () => {
      cancelAnimationFrame(frame);
      sheetNode?.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
      requestAnimationFrame(() => returnTarget?.isConnected && returnTarget.focus?.());
      historyKey.current = null;
    };
  }, [dismissOnHistory, initialFocusRef, onClose, open, returnFocusRef, titleId]);
  if (!open) return null;
  const requestClose = () => {
    if (dismissOnHistory && historyKey.current && window.history.state?.sheetKey === historyKey.current) window.history.back();
    else onClose();
  };
  return (
    <div className="m3-sheet__scrim" onClick={requestClose}>
      <section ref={sheetRef} className="m3-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
        <div className="m3-sheet__handle" />
        <header className="m3-sheet__header"><h2 ref={headingRef} tabIndex={-1} id={titleId}>{title}</h2><button type="button" aria-label={closeLabel} onClick={requestClose}><X size={20} /></button></header>
        <div className="m3-sheet__body">{children}</div>
      </section>
    </div>
  );
}
