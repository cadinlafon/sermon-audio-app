import { useEffect, useRef, useState } from "react";

// Wraps the Document Picture-in-Picture API (Chrome/Edge only — not
// Safari, not Firefox) so a real always-on-top floating window can
// keep following the user across tabs/apps. `open()` must be called
// from a user gesture (a click handler), per the browser's own rule.
export function useDocumentPiP() {
  const [pipWindow, setPipWindow] = useState(null);
  const supported = typeof window !== "undefined" && "documentPictureInPicture" in window;
  const pipWindowRef = useRef(null);

  useEffect(() => {
    pipWindowRef.current = pipWindow;
  }, [pipWindow]);

  const open = async ({ width = 300, height = 150 } = {}) => {
    if (!supported) throw new Error("Not supported in this browser.");
    const win = await window.documentPictureInPicture.requestWindow({ width, height });

    // Carry over the app's fonts/colors so the floating window doesn't
    // render unstyled — copy every <link rel="stylesheet"> and <style>.
    [...document.styleSheets].forEach((sheet) => {
      try {
        if (sheet.href) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = sheet.href;
          win.document.head.appendChild(link);
        } else {
          const style = document.createElement("style");
          style.textContent = [...sheet.cssRules].map((r) => r.cssText).join("\n");
          win.document.head.appendChild(style);
        }
      } catch {
        // Cross-origin stylesheets can't be read; harmless to skip.
      }
    });
    win.document.body.style.margin = "0";
    win.document.body.style.background = "#fffdf9";

    const handleClose = () => {
      setPipWindow(null);
      pipWindowRef.current = null;
    };
    win.addEventListener("pagehide", handleClose, { once: true });

    setPipWindow(win);
    return win;
  };

  const close = () => {
    pipWindowRef.current?.close();
    setPipWindow(null);
  };

  return { supported, pipWindow, active: !!pipWindow, open, close };
}
