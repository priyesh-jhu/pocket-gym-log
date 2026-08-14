// Theme preference and resolution.
// The two colour literals below are the ONLY ones outside tokens.css. They
// exist because <meta name="theme-color"> cannot read a CSS variable. Keep
// them equal to --surface in each theme, and to the copies in index.html.
const KEY = "workout-theme";
const META_LIGHT = "#FCFCF8";
const META_DARK  = "#0B0B0F";

export function getThemePref() {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch { return "system"; }
}

function systemPrefersDark() {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(pref = getThemePref()) {
  return pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
}

function apply(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? META_DARK : META_LIGHT);
}

export function setThemePref(pref) {
  try { window.localStorage.setItem(KEY, pref); }
  catch { /* Preference is not persisted when storage is unavailable. */ }
  apply(resolveTheme(pref));
}

export function initTheme() {
  apply(resolveTheme());
  if (typeof window.matchMedia !== "function") return;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemePref() === "system") apply(resolveTheme());
  });
}
