import { useState, useEffect, useRef } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { requestPushPermission } from "../utils/requestPushPermission";
import {
signInWithEmailAndPassword,
signInWithPopup,
onAuthStateChanged,
signOut
} from "firebase/auth";

import {
doc,
getDoc,
setDoc,
serverTimestamp
} from "firebase/firestore";

import { auth, db, googleProvider } from "../firebase";
import { logEvent } from "../utils/logEvent";

import googleLogo from "../assets/auth/google-logo.png";
import userIcon from "../assets/auth/user-icon.png";

export default function Navbar(){

const navigate = useNavigate();
const location = useLocation();

const profileRef = useRef(null);
const moreRef = useRef(null);

const [user,setUser] = useState(null);
const [isAdmin,setIsAdmin] = useState(false);

const [showProfile,setShowProfile] = useState(false);
const [showMore,setShowMore] = useState(false);

const [email,setEmail] = useState("");
const [password,setPassword] = useState("");
const [error,setError] = useState("");

//////////////////////////////////////////////////
// AUTH
//////////////////////////////////////////////////

useEffect(()=>{

const unsubscribe = onAuthStateChanged(auth, async(currentUser)=>{

setUser(currentUser);

if(currentUser){

const userDoc = await getDoc(doc(db,"users",currentUser.uid));

if(userDoc.exists() && userDoc.data().role==="admin"){
setIsAdmin(true);
}else{
setIsAdmin(false);
}

}else{
setIsAdmin(false);
}

});

return ()=>unsubscribe();

},[]);

//////////////////////////////////////////////////
// PAGE LOGGING
//////////////////////////////////////////////////

useEffect(()=>{

logEvent("page_visit",{
page:location.pathname,
userId:user?.uid || "guest",
role:isAdmin ? "admin":"user"
});

},[location]);

//////////////////////////////////////////////////
// GOOGLE LOGIN
//////////////////////////////////////////////////

const signInWithGoogle = async ()=>{

try{

const result = await signInWithPopup(auth,googleProvider);
const gUser = result.user;

const userRef = doc(db,"users",gUser.uid);
const userDoc = await getDoc(userRef);

if(!userDoc.exists()){

await setDoc(userRef,{
uid:gUser.uid,
fullName:gUser.displayName,
email:gUser.email,
role:"user",
emailVerified:true,
createdAt:serverTimestamp()
});

}

logEvent("google_login",{uid:gUser.uid,email:gUser.email});

setShowProfile(false);

}catch{
setError("Google sign in failed");
}

};

//////////////////////////////////////////////////
// EMAIL LOGIN
//////////////////////////////////////////////////

const handleLogin = async ()=>{

try{

setError("");

const result = await signInWithEmailAndPassword(auth,email,password);

logEvent("user_login",{uid:result.user.uid,email:result.user.email});

setShowProfile(false);
setEmail("");
setPassword("");

}catch{
setError("Invalid email or password");
}

};

//////////////////////////////////////////////////
// LOGOUT
//////////////////////////////////////////////////

const handleLogout = async()=>{

await signOut(auth);

logEvent("logout",{uid:user.uid});

setShowProfile(false);

};

//////////////////////////////////////////////////
// CLOSE DROPDOWNS
//////////////////////////////////////////////////

useEffect(()=>{

function handleClickOutside(event){

if(profileRef.current && !profileRef.current.contains(event.target)){
setShowProfile(false);
}

if(moreRef.current && !moreRef.current.contains(event.target)){
setShowMore(false);
}

}

document.addEventListener("mousedown",handleClickOutside);

return ()=>document.removeEventListener("mousedown",handleClickOutside);

},[]);

//////////////////////////////////////////////////
// LINK STYLE
//////////////////////////////////////////////////

const linkStyle=({isActive})=>({
textDecoration:"none",
fontSize:"14px",
textTransform:"uppercase",
fontWeight:isActive?"600":"500",
letterSpacing:"0.6px",
color:isActive?"#000":"#666",
borderBottom:isActive?"2px solid black":"2px solid transparent",
padding:"10px 6px",
transition:"all 0.25s ease"
});

//////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////

return(

<div style={navbarStyle}>

<div style={navLinks}>

<NavLink to="/" style={linkStyle}>Home</NavLink>
<NavLink to="/sermons" style={linkStyle}>Sermons</NavLink>
<NavLink to="/sundayschool" style={linkStyle}>Sunday School</NavLink>
<NavLink to="/homilies" style={linkStyle}>Homilies</NavLink>

<div ref={moreRef} style={moreContainer}>

<div
style={moreText}
onClick={()=>setShowMore(!showMore)}
>
More ▾
</div>

{showMore &&(

<div style={dropdownAnimated}>

<NavLink to="/page-not-ready" style={dropdownLink} onClick={()=>setShowMore(false)}>
About
</NavLink>

<NavLink to="/feedback" style={dropdownLink} onClick={()=>setShowMore(false)}>
Feedback
</NavLink>

{isAdmin &&(
<NavLink to="/admin" style={dropdownLink} onClick={()=>setShowMore(false)}>
Admin
</NavLink>
)}

</div>

)}

</div>

</div>

<div style={{flex:1}}></div>

<div ref={profileRef} style={rightSide}>

<div
style={{cursor:"pointer"}}
onClick={()=>setShowProfile(!showProfile)}
>

{user ? (
<div style={profileCircle}>
{user.email?.charAt(0).toUpperCase()}
</div>
) : "👤"}

</div>

{showProfile && !user &&(

<div style={dropdownAnimated}>

<input
type="email"
placeholder="Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
style={inputStyle}
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
style={inputStyle}
/>

<button style={loginButton} onClick={handleLogin}>
LOGIN
</button>

<div style={orDivider}>or</div>

<button style={googleButton} onClick={signInWithGoogle}>
<img src={googleLogo} style={googleLogoStyle}/>
Continue with Google
</button>

<Link to="/signup" style={signupText}>
Don't have an account?
</Link>

{error && <p style={{color:"red",fontSize:"12px"}}>{error}</p>}

</div>

)}

{showProfile && user &&(

<div style={dropdownAnimated}>

<div style={userName}>
{user.displayName || user.email}
</div>

<hr/>

<button
style={accountButton}
onClick={()=>{
navigate("/settings")
setShowProfile(false)
}}
>
<img src={userIcon} style={accountIcon}/>
Account Page
</button>

<button
style={logoutButton}
onClick={handleLogout}
>
LOG OUT
</button>

</div>

)}

</div>

</div>

);

}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const navbarStyle={
display:"flex",
alignItems:"center",
padding:"14px 20px",
borderBottom:"1px solid #eee",
background:"#fff",
transition:"box-shadow 0.3s"
}

const navLinks={
display:"flex",
gap:"18px",
alignItems:"center"
}

const moreContainer={
position:"relative"
}

const moreText={
cursor:"pointer",
fontSize:"14px",
padding:"10px 6px",
transition:"color 0.25s"
}

const dropdownAnimated={
position:"absolute",
right:0,
top:"44px",
background:"#fff",
border:"1px solid #ddd",
padding:"18px",
display:"flex",
flexDirection:"column",
gap:"10px",
width:"240px",
boxShadow:"0 10px 22px rgba(0,0,0,0.12)",
animation:"fadeSlide 0.25s ease"
}

const dropdownLink={
textDecoration:"none",
fontSize:"14px",
color:"#444",
padding:"6px 0",
transition:"color 0.2s"
}

const rightSide={
display:"flex",
alignItems:"center",
gap:"20px",
position:"relative"
}

const profileCircle={
width:"34px",
height:"34px",
borderRadius:"50%",
background:"#111",
color:"#fff",
display:"flex",
alignItems:"center",
justifyContent:"center"
}

const inputStyle={
border:"1px solid #ddd",
borderRadius:"8px",
padding:"10px",
fontSize:"13px",
background:"#fafafa"
}

const loginButton={
background:"#111",
color:"#fff",
border:"none",
padding:"10px",
fontWeight:"600",
cursor:"pointer",
borderRadius:"6px",
transition:"all 0.25s"
}

const googleButton={
display:"flex",
alignItems:"center",
justifyContent:"center",
gap:"10px",
border:"1px solid #ddd",
background:"#fff",
padding:"12px",
cursor:"pointer",
fontWeight:"600",
borderRadius:"6px",
transition:"all 0.25s"
}

const googleLogoStyle={
width:"24px",
height:"24px"
}

const signupText={
fontSize:"12px",
textAlign:"center"
}

const orDivider={
textAlign:"center",
fontSize:"12px",
color:"#777"
}

const userName={
fontWeight:"600",
fontSize:"14px"
}

const accountButton={
display:"flex",
alignItems:"center",
gap:"10px",
background:"#f7f7f7",
border:"1px solid #ddd",
padding:"10px",
cursor:"pointer",
fontWeight:"500",
justifyContent:"center",
borderRadius:"6px",
transition:"all 0.25s"
}

const accountIcon={
width:"18px",
height:"18px"
}

const logoutButton={
background:"#111",
color:"#fff",
border:"none",
padding:"10px",
fontWeight:"600",
cursor:"pointer",
borderRadius:"6px",
transition:"all 0.25s"
}