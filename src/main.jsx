import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ShutdownProvider } from "./context/ShutdownContext";
import { AudioPlayerProvider } from "./context/AudioPlayerContext";
import { AuthProvider } from "./context/AuthContext";
import { PagesProvider } from "./context/PagesContext";
import { registerSW } from "virtual:pwa-register";
import { ToastProvider } from "./context/ToastContext";

//////////////////////////////////////////////////
// SERVICE WORKER (PWA)
//////////////////////////////////////////////////

// 🔥 This registers your PWA service worker
// "immediate: true" = updates instantly (good for your case)
registerSW({
  immediate: true,
});

//////////////////////////////////////////////////
// RENDER
//////////////////////////////////////////////////

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PagesProvider>
          <ShutdownProvider>
            <AudioPlayerProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </AudioPlayerProvider>
          </ShutdownProvider>
        </PagesProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);