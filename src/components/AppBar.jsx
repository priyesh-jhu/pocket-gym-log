import { useEffect, useRef, useState } from "react";
import "./AppBar.css";

export default function AppBar({ overline, title, actions }) {
  const sentinel = useRef(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { threshold: 1 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Scrolls away normally; the sticky header below does not. */}
      <div ref={sentinel} className="m3-appbar__sentinel" aria-hidden="true" />
      <header className={`m3-appbar${collapsed ? " is-collapsed" : ""}`}>
        <div className="m3-appbar__text">
          {overline && <div className="m3-appbar__overline">{overline}</div>}
          <h1 className="m3-appbar__title">{title}</h1>
        </div>
        {actions && <div className="m3-appbar__actions">{actions}</div>}
      </header>
    </>
  );
}
