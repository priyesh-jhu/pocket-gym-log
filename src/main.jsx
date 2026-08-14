import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/manrope";
import "./index.css";
import { initTheme } from "./design/theme.js";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import PWAStatus from "./PWAStatus.jsx";

initTheme();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PWAStatus />
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
