import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import App from "./App";
import { getLanguage, setLanguage } from "./lib/i18n";
import { lazy, Suspense } from "react";
import "./style.css";
setLanguage(getLanguage());
const CloudShell = lazy(() => import("./pages/CloudShell"));
createRoot(document.getElementById("root")!).render(
  import.meta.env.VITE_CLOUD_MODE === "true" ? (
    <Suspense fallback={<p>হিসাবখাতা খোলা হচ্ছে…</p>}>
      <CloudShell />
    </Suspense>
  ) : (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ),
);
