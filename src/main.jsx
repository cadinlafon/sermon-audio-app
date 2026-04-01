import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ShutdownProvider } from "./context/ShutdownContext";
import { AudioPlayerProvider } from "./context/AudioPlayerContext";
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
})

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

// Register service worker ONLY in production
// Service worker disabled during development