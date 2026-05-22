import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import App from "./App";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root not found");

createRoot(container).render(
  <StrictMode>
    <FluentProvider theme={webLightTheme} style={{ height: "100%" }}>
      <App />
    </FluentProvider>
  </StrictMode>,
);
