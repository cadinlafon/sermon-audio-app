import { useEffect, useState } from "react";
import {
collection,
query,
orderBy,
limit,
onSnapshot,
getDocs
} from "firebase/firestore";

import { db } from "../../firebase";

export default function Logs() {

const [logs, setLogs] = useState([]);
const [userMap, setUserMap] = useState({});

//////////////////////////////////////////////////
// LOAD USERS (UID → NAME MAP)
//////////////////////////////////////////////////

useEffect(() => {

const fetchUsers = async () => {

const usersSnap = await getDocs(collection(db,"users"));

const map = {};

usersSnap.docs.forEach(doc => {

const data = doc.data();

map[doc.id] =
data.name ||
data.fullName ||
data.email ||
doc.id;

});

setUserMap(map);

};

fetchUsers();

},[]);

//////////////////////////////////////////////////
// LOAD LOGS
//////////////////////////////////////////////////

useEffect(() => {

const q = query(
collection(db, "logs"),
orderBy("timestamp", "desc"),
limit(100)
);

const unsubscribe = onSnapshot(q, (snapshot) => {

const logList = snapshot.docs.map(doc => ({
id: doc.id,
...doc.data()
}));

setLogs(logList);

});

return () => unsubscribe();

}, []);

//////////////////////////////////////////////////
// FORMAT TIME
//////////////////////////////////////////////////

function formatTime(timestamp) {

if (!timestamp) return "";

const date = new Date(timestamp.seconds * 1000);

return date.toLocaleString();

}

//////////////////////////////////////////////////
// GET USER NAME
//////////////////////////////////////////////////

function getUserName(log){

if(log.email) return log.email;

if(log.userId && userMap[log.userId]){
return userMap[log.userId];
}

return "Guest";

}

//////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////

return (

<div style={container}>

<h2 style={title}>Activity Logs</h2>

<div style={table}>

<div style={headerRow}>
<div style={cell}>Time</div>
<div style={cell}>Event</div>
<div style={cell}>User</div>
<div style={cell}>Details</div>
</div>

{logs.map(log => (

<div key={log.id} style={row}>

<div style={cell}>
{formatTime(log.timestamp)}
</div>

<div style={cell}>
{log.type || log.event}
</div>

<div style={wrapCell}>
{getUserName(log)}
</div>

<div style={wrapCell}>
{log.page || log.message || log.mode || "-"}
</div>

</div>

))}

</div>

</div>

);

}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const container = {
padding: "30px"
};

const title = {
marginBottom: "20px"
};

const table = {
display: "flex",
flexDirection: "column",
border: "1px solid #ddd"
};

const headerRow = {
display: "grid",
gridTemplateColumns: "200px 200px 220px 1fr",
background: "#f5f5f5",
fontWeight: "600",
borderBottom: "1px solid #ddd"
};

const row = {
display: "grid",
gridTemplateColumns: "200px 200px 220px 1fr",
borderBottom: "1px solid #eee"
};

const cell = {
padding: "10px",
fontSize: "13px"
};

const wrapCell = {
padding: "10px",
fontSize: "13px",
wordBreak: "break-all",
overflowWrap: "anywhere",
maxWidth: "220px"
};