import { useState } from "react";
import {
createUserWithEmailAndPassword,
signInWithPopup
} from "firebase/auth";

import {
doc,
setDoc,
serverTimestamp,
addDoc,
collection,
getDoc
} from "firebase/firestore";

import { auth, db, googleProvider } from "../firebase";

export default function SignUp() {

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [loading, setLoading] = useState(false);
const [fullName, setFullName] = useState("");

//////////////////////////////////////////////////
// EMAIL SIGNUP
//////////////////////////////////////////////////

const handleSignUp = async () => {

if (!fullName || !email || !password) {
alert("Please enter full name, email, and password.");
return;
}

try {

setLoading(true);

const userCredential = await createUserWithEmailAndPassword(
auth,
email,
password
);

const user = userCredential.user;

await setDoc(doc(db, "users", user.uid), {
uid: user.uid,
fullName,
email: user.email,
role: "user",
loginMethod: "email",
emailVerified: true,
createdAt: serverTimestamp()
});

await addDoc(collection(db, "logs"), {
type: "account_created",
userId: user.uid,
email: user.email,
timestamp: serverTimestamp()
});

alert("Account created!");

setEmail("");
setPassword("");
setFullName("");

} catch (error) {
alert(error.message);
} finally {
setLoading(false);
}

};

//////////////////////////////////////////////////
// GOOGLE SIGNUP
//////////////////////////////////////////////////

const signUpWithGoogle = async () => {

try {

const result = await signInWithPopup(auth, googleProvider);
const user = result.user;

const userRef = doc(db, "users", user.uid);
const userSnap = await getDoc(userRef);

if (!userSnap.exists()) {

await setDoc(userRef, {
uid: user.uid,
fullName: user.displayName,
email: user.email,
role: "user",
loginMethod: "google",
emailVerified: true,
createdAt: serverTimestamp()
});

await addDoc(collection(db, "logs"), {
type: "account_created_google",
userId: user.uid,
email: user.email,
timestamp: serverTimestamp()
});

}

} catch (error) {
alert(error.message);
}

};

//////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////

return (

<div style={{ padding: "40px", maxWidth: "400px", margin: "0 auto" }}>

<h2>Create Account</h2>

<input
type="text"
placeholder="Full Name"
value={fullName}
onChange={(e)=>setFullName(e.target.value)}
style={{width:"100%",padding:"10px",marginBottom:"10px"}}
/>

<input
type="email"
placeholder="Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
style={{width:"100%",padding:"10px",marginBottom:"10px"}}
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
style={{width:"100%",padding:"10px",marginBottom:"15px"}}
/>

<button
onClick={handleSignUp}
disabled={loading}
style={{
width:"100%",
padding:"10px",
background:"#111",
color:"white",
border:"none"
}}
>
{loading ? "Creating..." : "Sign Up"}
</button>

<div style={{textAlign:"center",margin:"20px 0"}}>
 — or —
</div>

<button
onClick={signUpWithGoogle}
style={{
width:"100%",
padding:"10px",
background:"#4285F4",
color:"white",
border:"none"
}}
>
Sign up with Google
</button>

</div>
);
}