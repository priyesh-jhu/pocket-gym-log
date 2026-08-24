import { useEffect } from "react";
import "./Toast.css";

export default function Toast({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="m3-toast" role="status" onClick={onClose}>
      {children}
    </div>
  );
}
