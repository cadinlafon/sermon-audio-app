import { useState, useEffect } from "react";
import { auth, db } from "../../firebase";

import {
updateEmail,
deleteUser,
signOut
} from "firebase/auth";

import {
doc,
getDoc,
updateDoc,
deleteDoc
} from "firebase/firestore";

export default function Account() {

const user = auth.currentUser;

const [name, setName] = useState("");
const [email, setEmail] = useState("");

useEffect(() => {

async function loadUser() {

const snap = await getDoc(doc(db, "users", user.uid));

if (snap.exists()) {
setName(snap.data().name || "");
}

setEmail(user.email);

}

loadUser();

}, [user]);

const saveChanges = async () => {

try {

await updateDoc(doc(db, "users", user.uid), {
name
});

if (email !== user.email) {
await updateEmail(user, email);
}

alert("Account updated");

} catch (error) {
console.error(error);
alert("Update failed");
}

};

const logout = async () => {
await signOut(auth);
};

const deleteAccount = async () => {

if (!confirm("Delete your account permanently?")) return;

try {

await deleteDoc(doc(db, "users", user.uid));

await deleteUser(user);

} catch (error) {
console.error(error);
alert("Delete failed. You may need to re-login.");
}

};

return (

<div>

<h2>Account</h2>

<div style={form}>

<input
value={name}
onChange={(e) => setName(e.target.value)}
placeholder="Name"
style={input}
/>

<input
value={email}
onChange={(e) => setEmail(e.target.value)}
placeholder="Email"
style={input}
/>

<button onClick={saveChanges} style={saveBtn}>
Save Changes
</button>

<button onClick={logout} style={logoutBtn}>
Logout
</button>

<button onClick={deleteAccount} style={deleteBtn}>
Delete Account
</button>

</div>

</div>

);

}

const form = {
display: "flex",
flexDirection: "column",
gap: "10px",
maxWidth: "400px"
};

const input = {
padding: "10px",
borderRadius: "6px",
border: "1px solid #ccc"
};

const saveBtn = {
padding: "10px",
background: "#16a34a",
color: "white",
border: "none",
borderRadius: "6px"
};

const logoutBtn = {
padding: "10px",
background: "#2563eb",
color: "white",
border: "none",
borderRadius: "6px"
};

const deleteBtn = {
padding: "10px",
background: "#dc2626",
color: "white",
border: "none",
borderRadius: "6px"
};