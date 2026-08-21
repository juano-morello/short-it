import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@short-it/design-system/styles.css";
import { App } from "./App.js";
import "./app.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("The application root is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
