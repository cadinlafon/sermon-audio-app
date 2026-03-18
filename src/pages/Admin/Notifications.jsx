import { useEffect, useState } from "react"
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from "firebase/firestore"
import { db } from "../../firebase"

export default function AdminNotifications(){

const [title,setTitle] = useState("")
const [content,setContent] = useState("")
const [link,setLink] = useState("")

const [targetType,setTargetType] = useState("all")
const [targetUser,setTargetUser] = useState("")

const [users,setUsers] = useState([])
const [history,setHistory] = useState([])

//////////////////////////////////////////////////
// LOAD USERS
//////////////////////////////////////////////////

useEffect(()=>{

const loadUsers = async()=>{

const snap = await getDocs(collection(db,"users"))

let list = []

snap.forEach(doc=>{
list.push({uid:doc.id,...doc.data()})
})

list.sort((a,b)=>
(a.fullName || "").localeCompare(b.fullName || "")
)

setUsers(list)

}

loadUsers()

},[])

//////////////////////////////////////////////////
// LOAD HISTORY
//////////////////////////////////////////////////

useEffect(()=>{

const loadHistory = async()=>{

const q = query(
collection(db,"notifications"),
orderBy("createdAt","desc")
)

const snap = await getDocs(q)

let list=[]

snap.forEach(doc=>{
list.push({id:doc.id,...doc.data()})
})

setHistory(list)

}

loadHistory()

},[])

//////////////////////////////////////////////////
// SEND NOTIFICATION
//////////////////////////////////////////////////

const sendNotification = async()=>{

if(!title || !content){
alert("Title and content required")
return
}

await addDoc(collection(db,"notifications"),{

title,
content,
link:link || null,

targetType,
targetUser: targetType==="user" ? targetUser : null,

active:true,
createdAt:serverTimestamp()

})

setTitle("")
setContent("")
setLink("")
alert("Notification sent")

}

return(

<div style={container}>

<h2>Send Notification</h2>

<input
placeholder="Title"
value={title}
onChange={(e)=>setTitle(e.target.value)}
/>

<textarea
placeholder="Content"
value={content}
onChange={(e)=>setContent(e.target.value)}
/>

<input
placeholder="Optional link"
value={link}
onChange={(e)=>setLink(e.target.value)}
/>

<select
value={targetType}
onChange={(e)=>setTargetType(e.target.value)}
>
<option value="all">All Users</option>
<option value="user">Target User</option>
</select>

{targetType==="user" &&(

<select
value={targetUser}
onChange={(e)=>setTargetUser(e.target.value)}
>

<option value="">Select User</option>

{users.map(user=>(
<option key={user.uid} value={user.uid}>
{user.fullName || user.email}
</option>
))}

</select>

)}

<button onClick={sendNotification}>
Send Notification
</button>

<h3>Notification History</h3>

{history.map(n=>(
<div key={n.id} style={historyItem}>
<strong>{n.title}</strong>
<p>{n.content}</p>
</div>
))}

</div>

)

}

const container={
maxWidth:"600px",
margin:"40px auto",
display:"flex",
flexDirection:"column",
gap:"10px"
}

const historyItem={
border:"1px solid #ddd",
padding:"10px",
borderRadius:"6px"
}