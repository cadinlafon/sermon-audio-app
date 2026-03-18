import { useState } from "react";

import Account from "./Account";
import Notifications from "./Notifications";
import Privacy from "./Privacy";
import About from "./About";
import HelpCenter from "./HelpCenter";
export default function Settings() {

const [page, setPage] = useState("account");

const renderPage = () => {

switch (page) {

case "account":
return <Account />;

case "help":
return <HelpCenter />;

case "notifications":
return <Notifications />;

case "privacy":
return <Privacy />;

case "about":
return <About />;

default:
return <Account />;

}

};

return (

<div style={container}>

{/* SIDEBAR */}

<div style={sidebar}>

<h2 style={{ marginBottom: "25px" }}>Settings</h2>

<button onClick={() => setPage("account")} style={navBtn}>
Account
</button>



<button onClick={() => setPage("notifications")} style={navBtn}>
Notifications
</button>

<button onClick={() => setPage("privacy")} style={navBtn}>
Privacy
</button>

<button onClick={() => setPage("help")} style={navBtn}>
Help Center
</button>

<button onClick={() => setPage("about")} style={navBtn}>
About
</button>

</div>

{/* PAGE CONTENT */}

<div style={content}>
{renderPage()}
</div>

</div>

);

}

const container = {
display: "flex",
minHeight: "100vh"
};

const sidebar = {
width: "220px",
background: "#f3f4f6",
padding: "30px",
display: "flex",
flexDirection: "column",
gap: "10px"
};

const content = {
flex: 1,
padding: "40px"
};

const navBtn = {
padding: "10px",
border: "none",
background: "#e5e7eb",
borderRadius: "6px",
cursor: "pointer",
textAlign: "left"
};