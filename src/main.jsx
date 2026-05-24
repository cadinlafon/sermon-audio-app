import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ShutdownProvider } from "./context/ShutdownContext";
import { AudioPlayerProvider } from "./context/AudioPlayerContext";
import { registerSW } from "virtual:pwa-register";

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
      <ShutdownProvider>
        <AudioPlayerProvider>
          <App />
        </AudioPlayerProvider>
      </ShutdownProvider>
    </BrowserRouter>
  </React.StrictMode>
);