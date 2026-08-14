import { useEffect, useState } from "react";
import { CHART_THEMES } from "./chartTheme.js";

function activeTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export default function useThemeTokens() {
  const [theme, setTheme] = useState(activeTheme);
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTheme(activeTheme()));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return CHART_THEMES[theme];
}
