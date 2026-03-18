import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ShutdownProvider } from "./context/ShutdownContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ShutdownProvider>
        <App />
      </ShutdownProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Register service worker ONLY in production
// Service worker disabled during development