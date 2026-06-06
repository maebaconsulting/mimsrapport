import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LangProvider } from "./i18n";
import { runPdfSelfTest } from "./reports/selftest";
import { isTauri } from "./lib/config";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </React.StrictMode>,
);

// Auto-test du pipeline PDF (build navigateur).
// - exposé sur window pour validation externe (Playwright/Chromium ≈ WebView2) ;
// - exécuté dans la coque Tauri pour valider WKWebView, résultat journalisé via
//   une commande Rust (visible dans le stdout de `tauri dev`).
(window as unknown as { __pdfSelfTest?: typeof runPdfSelfTest }).__pdfSelfTest =
  runPdfSelfTest;

if (isTauri()) {
  void (async () => {
    const result = await runPdfSelfTest();
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("log_pdf_selftest", { result: JSON.stringify(result) });
    } catch {
      console.log("[pdf-selftest]", JSON.stringify(result));
    }
  })();
}
