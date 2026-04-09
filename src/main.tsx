/*
 * (c) 2026 Alan Alves. All rights reserved.
 * CineFlow Suite — Professional Production to Post Hub
 * hello@expose-u.com | https://alan-design.com/
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

window.__TAURI_RELOADING__ = false;
window.addEventListener("beforeunload", () => {
  window.__TAURI_RELOADING__ = true;
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.__TAURI_RELOADING__ = true;
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
