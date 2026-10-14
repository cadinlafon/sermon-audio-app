import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ShutdownProvider } from "./context/ShutdownContext";
import { AudioPlayerProvider } from "./context/AudioPlayerContext";
import { AuthProvider } from "./context/AuthContext";
import { PagesProvider } from "./context/PagesContext";
import { registerAppUpdates } from "./utils/appUpdate";
import UpdatePrompt from "./components/UpdatePrompt";
import { ToastProvider } from "./context/ToastContext";
import { PlaylistProvider } from "./context/PlaylistContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./theme-tokens.css";

//////////////////////////////////////////////////
// SERVICE WORKER (PWA)
//////////////////////////////////////////////////

// Registers the PWA service worker and watches for new deploys. A new
// version installs in the background and waits; <UpdatePrompt /> below
// asks the user to refresh instead of reloading the page on its own.
registerAppUpdates();

//////////////////////////////////////////////////
// RENDER
//////////////////////////////////////////////////

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <PagesProvider>
            <ShutdownProvider>
              <AudioPlayerProvider>
                <ToastProvider>
                  <PlaylistProvider>
                    <App />
                  </PlaylistProvider>
                </ToastProvider>
              </AudioPlayerProvider>
            </ShutdownProvider>
          </PagesProvider>
        </AuthProvider>
      </BrowserRouter>
      <UpdatePrompt />
    </ThemeProvider>
  </React.StrictMode>
);