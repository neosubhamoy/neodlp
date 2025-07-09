import React from "react";
import ReactDOM from "react-dom/client";
import TanstackProvider from "@/providers/tanstackProvider";
import App from "@/App";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/index.css";
import RootLayout from "@/pages/layout/root";
import DownloaderPage from "@/pages/downloader";
import LibraryPage from "@/pages/library";
import SettingsPage from "@/pages/settings";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <TanstackProvider>
        <App>
          <Routes>
            <Route path="/" element={<RootLayout />}>
              <Route index element={<DownloaderPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </App>
      </TanstackProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
