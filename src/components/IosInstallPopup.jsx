import { useEffect, useState } from "react";
import { logEvent } from "../utils/logEvent";

export default function IosInstallPopup() {

const [showPopup,setShowPopup] = useState(false);
const [showInstructions,setShowInstructions] = useState(false);

//////////////////////////////////////////////////
// DETECT IOS SAFARI
//////////////////////////////////////////////////

useEffect(()=>{

const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);

const isStandalone =
window.navigator.standalone === true ||
window.matchMedia("(display-mode: standalone)").matches;

if(isIos && isSafari && !isStandalone){

setShowPopup(true);

logEvent("ios_install_popup_shown",{
device:"iphone"
});

}

},[]);

//////////////////////////////////////////////////
// CLOSE POPUP
//////////////////////////////////////////////////

const closePopup = ()=>{

setShowPopup(false);

logEvent("ios_install_popup_closed",{
step:showInstructions ? "instructions" : "intro"
});

};

//////////////////////////////////////////////////
// INSTALL BUTTON
//////////////////////////////////////////////////

const handleInstall = ()=>{

setShowInstructions(true);

logEvent("ios_install_button_clicked",{
device:"iphone"
});

};

//////////////////////////////////////////////////
// HIDE
//////////////////////////////////////////////////

if(!showPopup) return null;

//////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////

return(

<div style={overlay}>

<div style={popup}>

{!showInstructions ? (

<>

<h3 style={{marginTop:0}}>Install App</h3>

<p style={{fontSize:"14px"}}>
Install this app on your iPhone for faster access and a real app experience.
</p>

<div style={buttonRow}>

<button style={installBtn} onClick={handleInstall}>
Install
</button>

<button style={closeBtn} onClick={closePopup}>
No Thanks
</button>

</div>

</>

) : (

<>

<h3 style={{marginTop:0}}>How to Install</h3>

<ol style={{fontSize:"14px",paddingLeft:"18px"}}>

<li>Tap the <b>Share</b> button in Safari</li>

<li>Select <b>Add to Home Screen</b></li>

<li>Make sure <b>"Open as Web App"</b> is toggled ON</li>

<li>Tap <b>Add</b></li>

</ol>

<div style={buttonRow}>

<button style={closeBtn} onClick={closePopup}>
Close
</button>

</div>

</>

)}

</div>

</div>

);

}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const overlay={
position:"fixed",
top:0,
left:0,
right:0,
bottom:0,
background:"rgba(0,0,0,0.55)",
display:"flex",
alignItems:"center",
justifyContent:"center",
zIndex:9999
};

const popup={
background:"#fff",
padding:"25px",
borderRadius:"10px",
width:"300px",
maxWidth:"90%",
boxShadow:"0 6px 20px rgba(0,0,0,0.25)",
textAlign:"center"
};

const buttonRow={
display:"flex",
justifyContent:"center",
gap:"10px",
marginTop:"15px"
};

const installBtn={
background:"#111",
color:"#fff",
border:"none",
padding:"8px 16px",
borderRadius:"6px",
cursor:"pointer"
};

const closeBtn={
background:"#eee",
border:"none",
padding:"8px 16px",
borderRadius:"6px",
cursor:"pointer"
};