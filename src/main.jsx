import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import PWAStatus from "./PWAStatus.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PWAStatus />
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
