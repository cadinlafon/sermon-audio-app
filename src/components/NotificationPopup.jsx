import { useEffect, useState } from "react"
import { collection, query, where, getDocs, orderBy, limit, addDoc } from "firebase/firestore"
import { db, auth } from "../firebase"
import { logEvent } from "../utils/logEvent"
import { useNavigate } from "react-router-dom"

export default function NotificationPopup(){

const [notification,setNotification] = useState(null)
const [show,setShow] = useState(false)

const navigate = useNavigate()

useEffect(()=>{

const checkNotification = async()=>{

const user = auth.currentUser

const q = query(
collection(db,"notifications"),
where("active","==",true),
orderBy("createdAt","desc"),
limit(1)
)

const snap = await getDocs(q)

if(snap.empty) return

const doc = snap.docs[0]
const data = doc.data()

if(data.targetType === "user" && data.targetUser !== user?.uid){
return
}

const viewQuery = query(
collection(db,"notificationViews"),
where("notificationId","==",doc.id),
where("userId","==",user?.uid || "guest")
)

const viewSnap = await getDocs(viewQuery)

if(viewSnap.empty){

setNotification({id:doc.id,...data})
setShow(true)

}

}

checkNotification()

},[])

//////////////////////////////////////////////////
// CLOSE
//////////////////////////////////////////////////

const closePopup = async()=>{

await addDoc(collection(db,"notificationViews"),{

notificationId:notification.id,
userId:auth.currentUser?.uid || "guest",
viewed:true,
closed:true,
opened:false,
timestamp:new Date()

})

logEvent("notification_closed",{title:notification.title})

setShow(false)

}

//////////////////////////////////////////////////
// OPEN
//////////////////////////////////////////////////

const openLink = async()=>{

await addDoc(collection(db,"notificationViews"),{

notificationId:notification.id,
userId:auth.currentUser?.uid || "guest",
viewed:true,
opened:true,
closed:false,
timestamp:new Date()

})

logEvent("notification_opened",{title:notification.title})

if(notification.link?.startsWith("/")){
navigate(notification.link)
}else{
window.open(notification.link,"_blank")
}

setShow(false)

}

if(!show || !notification) return null

return(

<div style={overlay}>

<div style={popup}>

<h2 style={title}>{notification.title}</h2>

<p style={content}>{notification.content}</p>

<div style={buttons}>

<button
style={closeButton(notification.link)}
onClick={closePopup}
>
Close
</button>

{notification.link && (

<button
style={openButton}
onClick={openLink}
>
Open
</button>

)}

</div>

</div>

</div>

)

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
background:"rgba(0,0,0,0.45)",
display:"flex",
alignItems:"center",
justifyContent:"center",
zIndex:999
}

const popup={
background:"#fff",
padding:"28px",
width:"360px",
borderRadius:"10px",
display:"flex",
flexDirection:"column",
gap:"18px",
textAlign:"center"
}

const title={fontSize:"22px",margin:0}

const content={
fontSize:"14px",
lineHeight:"1.5"
}

const buttons={
display:"flex",
gap:"10px"
}

const closeButton=(link)=>({
flex:link ? 1 : 2,
background:"#eee",
border:"none",
padding:"12px",
borderRadius:"6px",
cursor:"pointer"
})

const openButton={
flex:1,
background:"#111",
color:"#fff",
border:"none",
padding:"12px",
borderRadius:"6px",
cursor:"pointer"
}