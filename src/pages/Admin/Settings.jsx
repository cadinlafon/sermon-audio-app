import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

function Settings() {

const [shutdown, setShutdown] = useState(false);
const [message, setMessage] = useState("");
const [returnDate, setReturnDate] = useState("");
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);

const configRef = doc(db, "appConfig", "status");

useEffect(() => {
const fetchConfig = async () => {

try {

const snap = await getDoc(configRef);

if (snap.exists()) {

const data = snap.data();

setShutdown(data.shutdown || false);
setMessage(data.message || "");

if (data.returnDate) {
const date = data.returnDate.toDate();
setReturnDate(date.toISOString().slice(0,16));
}

}

} catch (err) {
console.error("Failed to load config:", err);
}

setLoading(false);

};

fetchConfig();

}, []);

const handleSave = async () => {

setSaving(true);

try {

await updateDoc(configRef, {
shutdown,
message,
returnDate: returnDate ? new Date(returnDate) : null
});

alert("Settings saved!");

} catch (err) {

console.error("Failed to save:", err);
alert("Error saving settings.");

}

setSaving(false);

};

if (loading) return <p style={{padding:"40px"}}>Loading settings...</p>;

return (

<div style={{padding:"40px", maxWidth:"600px"}}>

<h2>Admin Settings</h2>

{/* Shutdown Toggle */}
<div style={{marginTop:"30px"}}>

<label style={{display:"flex", gap:"10px", alignItems:"center"}}>
<input
type="checkbox"
checked={shutdown}
onChange={(e)=>setShutdown(e.target.checked)}
/>

Enable Maintenance Mode
</label>

</div>

{/* Message */}
<div style={{marginTop:"20px"}}>

<label>Maintenance Message</label>

<textarea
value={message}
onChange={(e)=>setMessage(e.target.value)}
rows="4"
style={{width:"100%", marginTop:"5px"}}
/>

</div>

{/* Return Date */}
<div style={{marginTop:"20px"}}>

<label>Return Date</label>

<input
type="datetime-local"
value={returnDate}
onChange={(e)=>setReturnDate(e.target.value)}
style={{display:"block", marginTop:"5px"}}
/>

</div>

{/* Save Button */}
<button
onClick={handleSave}
disabled={saving}
style={{
marginTop:"30px",
padding:"10px 20px",
fontSize:"16px",
cursor:"pointer"
}}
>

{saving ? "Saving..." : "Save Settings"}

</button>

</div>

);

}

export default Settings;