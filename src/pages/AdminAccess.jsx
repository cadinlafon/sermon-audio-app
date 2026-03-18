import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";

function AdminAccess() {

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [error, setError] = useState("");

const navigate = useNavigate();

const handleLogin = async (e) => {
  e.preventDefault();

  try {

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists() && userDoc.data().role === "admin") {

      navigate("/admin");

    } else {

      setError("Access denied. Admins only.");

    }

  } catch (err) {

    setError("Login failed.");

  }

};

return (

<div style={{ padding: "40px", maxWidth: "400px", margin: "auto" }}>

<h2>Admin Access</h2>

<form onSubmit={handleLogin}>

<input
type="email"
placeholder="Email"
value={email}
onChange={(e) => setEmail(e.target.value)}
required
/>

<br/><br/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e) => setPassword(e.target.value)}
required
/>

<br/><br/>

<button type="submit">
Login
</button>

</form>

{error && <p style={{ color: "red" }}>{error}</p>}

</div>

);

}

export default AdminAccess;