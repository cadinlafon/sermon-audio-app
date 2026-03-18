import { useState } from "react";
import { auth, db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";

export default function Notifications() {

const [enabled, setEnabled] = useState(false);

const [prefs, setPrefs] = useState({
announcements: false,
sermons: false,
homilys: false,
sundaySchool: false
});

const toggleEnabled = async () => {

if (!enabled) {
await Notification.requestPermission();
}

setEnabled(!enabled);

await updateDoc(doc(db, "users", auth.currentUser.uid), {
notificationsEnabled: !enabled
});

};

const toggle = async (key) => {

const updated = {
...prefs,
[key]: !prefs[key]
};

setPrefs(updated);

await updateDoc(doc(db, "users", auth.currentUser.uid), {
notifications: updated
});

};

return (

<div>

<h2>Notifications</h2>

<label style={{ display: "block", marginBottom: "20px" }}>
<input
type="checkbox"
checked={enabled}
onChange={toggleEnabled}
/>
 Enable Notifications
</label>

<div style={{ opacity: enabled ? 1 : 0.4 }}>

<label>
<input
type="checkbox"
checked={prefs.announcements}
disabled={!enabled}
onChange={() => toggle("announcements")}
/>
 Announcements
</label>

<br/>

<label>
<input
type="checkbox"
checked={prefs.sermons}
disabled={!enabled}
onChange={() => toggle("sermons")}
/>
 Sermons
</label>

<br/>

<label>
<input
type="checkbox"
checked={prefs.homilys}
disabled={!enabled}
onChange={() => toggle("homilys")}
/>
 Homilys
</label>

<br/>

<label>
<input
type="checkbox"
checked={prefs.sundaySchool}
disabled={!enabled}
onChange={() => toggle("sundaySchool")}
/>
 Sunday School
</label>

</div>

</div>

);

}