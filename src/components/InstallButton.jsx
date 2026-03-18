import { useState, useEffect } from "react";

export default function InstallButton() {

const [installPrompt, setInstallPrompt] = useState(null);
const [isInstalled, setIsInstalled] = useState(false);

//////////////////////////////////////////////////
// CHECK IF ALREADY INSTALLED
//////////////////////////////////////////////////

useEffect(() => {

const standalone =
window.matchMedia('(display-mode: standalone)').matches ||
window.navigator.standalone === true;

if (standalone) {
setIsInstalled(true);
}

}, []);

//////////////////////////////////////////////////
// CAPTURE INSTALL PROMPT
//////////////////////////////////////////////////

useEffect(() => {

const handler = (e) => {
e.preventDefault();
setInstallPrompt(e);
};

window.addEventListener("beforeinstallprompt", handler);

return () => window.removeEventListener("beforeinstallprompt", handler);

}, []);

//////////////////////////////////////////////////
// INSTALL APP
//////////////////////////////////////////////////

const installApp = async () => {

if (!installPrompt) return;

installPrompt.prompt();

const choice = await installPrompt.userChoice;

if (choice.outcome === "accepted") {
setInstallPrompt(null);
}

};

//////////////////////////////////////////////////
// HIDE BUTTON IF INSTALLED
//////////////////////////////////////////////////

if (!installPrompt || isInstalled) return null;

//////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////

return (

<button
onClick={installApp}
style={{
padding: "8px 14px",
borderRadius: "6px",
border: "none",
background: "#111827",
color: "white",
fontSize: "12px",
cursor: "pointer"
}}
>

Install App

</button>

);

}