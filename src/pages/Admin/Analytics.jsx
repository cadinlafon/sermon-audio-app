import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";

export default function Analytics() {

const [stats,setStats]=useState({
totalUsers:0,
newUsers:0,
totalUploads:0,
minutesPlayed:0,
activeUsers:0,
totalListens:0,

// NEW STATS
usesWeb:0,
usesPWA:0,
pwaIphone:0,
pwaAndroid:0,
pwaDesktop:0
});

const [sermonLeaderboard,setSermonLeaderboard]=useState([]);
const [userLeaderboard,setUserLeaderboard]=useState([]);

const [activeUsersList,setActiveUsersList]=useState([]);
const [playedAudio,setPlayedAudio]=useState([]);

const [activeWeekOffset,setActiveWeekOffset]=useState(0);
const [audioWeekOffset,setAudioWeekOffset]=useState(0);

const getWeekRange=(offset)=>{
const now=new Date();

const start=new Date(now);
start.setDate(now.getDate()-now.getDay()-(7*offset));
start.setHours(0,0,0,0);

const end=new Date(start);
end.setDate(start.getDate()+7);

return{start,end};
};

useEffect(()=>{

const fetchAnalytics=async()=>{

try{

const usersSnap=await getDocs(collection(db,"users"));
const audioSnap=await getDocs(collection(db,"audio"));
const usageSnap=await getDocs(collection(db,"appUsage"));
const logsSnap=await getDocs(collection(db,"logs"));

const users=usersSnap.docs.map(d=>({id:d.id,...d.data()}));
const audio=audioSnap.docs.map(d=>d.data());
const usage=usageSnap.docs.map(d=>d.data());
const logs=logsSnap.docs.map(d=>d.data());

const {start:endStart,end:endEnd}=getWeekRange(0);
const {start:activeStart,end:activeEnd}=getWeekRange(activeWeekOffset);
const {start:audioStart,end:audioEnd}=getWeekRange(audioWeekOffset);

const totalUsers=users.length;

const newUsers=users.filter(u=>{
if(!u.createdAt?.seconds)return false;
const d=new Date(u.createdAt.seconds*1000);
return d>=endStart&&d<=endEnd;
}).length;

const totalUploads=audio.length;

let minutesPlayed=0;
let totalListens=0;

const sermonCounts={};
const userCounts={};

const activeSet=new Set();
const audioSet=new Set();

//////////////////////////////////////////////////
// SERMON USAGE
//////////////////////////////////////////////////

usage.forEach(item=>{

if(!item.createdAt?.seconds)return;

const d=new Date(item.createdAt.seconds*1000);

if(d>=endStart&&d<=endEnd){

totalListens++;

if(item.duration)minutesPlayed+=item.duration;

if(!sermonCounts[item.sermonId]){
sermonCounts[item.sermonId]={
title:item.title,
speaker:item.speaker,
plays:0
};
}

sermonCounts[item.sermonId].plays++;

if(!userCounts[item.userId])userCounts[item.userId]=0;
userCounts[item.userId]++;
}

if(d>=activeStart&&d<=activeEnd){
activeSet.add(item.userId);
}

if(d>=audioStart&&d<=audioEnd){
audioSet.add(item.title);
}

});

minutesPlayed=Math.floor(minutesPlayed/60);

//////////////////////////////////////////////////
// PLATFORM ANALYTICS
//////////////////////////////////////////////////

let usesWeb=0;
let usesPWA=0;
let pwaIphone=0;
let pwaAndroid=0;
let pwaDesktop=0;

logs.forEach(log=>{

if(log.event==="app_opened"){

const device=log.device || "";

if(device.includes("iPhone")){
usesWeb++;
}

if(device.includes("Android")){
usesWeb++;
}

}

if(log.event==="pwa_installed"){

usesPWA++;

const device=log.device || "";

if(device.includes("iPhone") || device.includes("iPad")){
pwaIphone++;
}

else if(device.includes("Android")){
pwaAndroid++;
}

else{
pwaDesktop++;
}

}

});

//////////////////////////////////////////////////
// SET STATS
//////////////////////////////////////////////////

setStats({
totalUsers,
newUsers,
totalUploads,
minutesPlayed,
activeUsers:activeSet.size,
totalListens,

usesWeb,
usesPWA,
pwaIphone,
pwaAndroid,
pwaDesktop
});

setActiveUsersList([...activeSet]);
setPlayedAudio([...audioSet]);

setSermonLeaderboard(
Object.values(sermonCounts)
.sort((a,b)=>b.plays-a.plays)
.slice(0,5)
);

setUserLeaderboard(
Object.entries(userCounts)
.map(([uid,count])=>{

const user=users.find(u=>u.id===uid);

return{
name:user?.name || "Unknown User",
count
};

})
.sort((a,b)=>b.count-a.count)
.slice(0,5)
);

}catch(err){
console.error("Analytics error:",err);
}

};

fetchAnalytics();

},[activeWeekOffset,audioWeekOffset]);

return(

<div style={container}>

<h1 style={title}>Analytics Dashboard</h1>

{/* STAT CARDS */}

<div style={statGrid}>

<StatCard label="Total Users" value={stats.totalUsers}/>
<StatCard label="New Users This Week" value={stats.newUsers}/>
<StatCard label="Total Uploads" value={stats.totalUploads}/>

<StatCard label="Minutes Played This Week" value={stats.minutesPlayed}/>
<StatCard label="Active Users This Week" value={stats.activeUsers}/>
<StatCard label="Total Listens This Week" value={stats.totalListens}/>

{/* NEW PLATFORM STATS */}

<StatCard label="Uses on Web" value={stats.usesWeb}/>
<StatCard label="Uses on PWA" value={stats.usesPWA}/>
<StatCard label="PWA on iPhone" value={stats.pwaIphone}/>

<StatCard label="PWA on Android" value={stats.pwaAndroid}/>
<StatCard label="PWA on Desktop" value={stats.pwaDesktop}/>

</div>

<div style={divider}></div>

{/* LEADERBOARDS */}

<div style={leaderboardGrid}>

<LeaderboardCard title="Top Audio">

{sermonLeaderboard.map((s,i)=>(
<RowCard
key={i}
title={`${i+1}. ${s.title}`}
subtitle={s.speaker}
value={`${s.plays} plays`}
/>
))}

</LeaderboardCard>

<LeaderboardCard title="Top Listeners">

{userLeaderboard.map((u,i)=>(
<RowCard
key={i}
title={`${i+1}. ${u.name}`}
subtitle="Total Listens"
value={u.count}
/>
))}

</LeaderboardCard>

</div>

<div style={divider}></div>

{/* ACTIVE USERS */}

<SectionHeader
title="Active Users"
offset={activeWeekOffset}
setOffset={setActiveWeekOffset}
/>

<div style={cardGrid}>

{activeUsersList.map((u,i)=>(
<RowCard
key={i}
title={`User`}
subtitle={u || "Unknown User"}
value="Active"
/>
))}

</div>

<div style={divider}></div>

{/* PLAYED AUDIO */}

<SectionHeader
title="Played Audio"
offset={audioWeekOffset}
setOffset={setAudioWeekOffset}
/>

<div style={cardGrid}>

{playedAudio.map((a,i)=>(
<RowCard
key={i}
title={a}
subtitle="Audio Played"
value="Listen"
/>
))}

</div>

</div>

);
}

/* COMPONENTS */

function StatCard({label,value}){
return(
<div style={statCard}>
<div style={statLabel}>{label}</div>
<div style={statValue}>{value}</div>
</div>
);
}

function LeaderboardCard({title,children}){
return(
<div style={leaderboardCard}>
<h2 style={leaderboardTitle}>{title}</h2>
{children}
</div>
);
}

function RowCard({title,subtitle,value}){
return(
<div style={rowCard}>
<div>
<div style={rowTitle}>{title}</div>
<div style={rowSubtitle}>{subtitle}</div>
</div>
<div style={rowValue}>{value}</div>
</div>
);
}

function SectionHeader({title,offset,setOffset}){
return(
<div style={sectionHeader}>

<button
onClick={()=>setOffset(offset+1)}
style={arrowBtn}
>
◀
</button>

<h2 style={{fontSize:"22px"}}>
{title} — {offset===0?"This Week":`${offset} Week${offset>1?"s":""} Ago`}
</h2>

<button
disabled={offset===0}
onClick={()=>setOffset(offset-1)}
style={{
...arrowBtn,
opacity:offset===0?0.3:1
}}
>
▶
</button>

</div>
);
}

/* STYLES */

const container={
padding:"40px",
maxWidth:"1200px",
margin:"auto",
fontFamily:"system-ui"
};

const title={
fontSize:"34px",
marginBottom:"30px"
};

const statGrid={
display:"grid",
gridTemplateColumns:"repeat(3,1fr)",
gap:"20px"
};

const statCard={
background:"#fff",
padding:"25px",
borderRadius:"14px",
boxShadow:"0 6px 16px rgba(0,0,0,0.08)"
};

const statLabel={
fontSize:"14px",
color:"#666"
};

const statValue={
fontSize:"32px",
fontWeight:"bold",
marginTop:"10px"
};

const leaderboardGrid={
display:"grid",
gridTemplateColumns:"1fr 1fr",
gap:"30px"
};

const leaderboardCard={
background:"#fff",
padding:"25px",
borderRadius:"14px",
boxShadow:"0 6px 16px rgba(0,0,0,0.08)"
};

const leaderboardTitle={
marginBottom:"20px"
};

const rowCard={
display:"flex",
justifyContent:"space-between",
alignItems:"center",
padding:"14px 0",
borderBottom:"1px solid #eee"
};

const rowTitle={
fontSize:"16px",
fontWeight:"600"
};

const rowSubtitle={
fontSize:"13px",
color:"#777"
};

const rowValue={
fontWeight:"bold",
fontSize:"16px"
};

const sectionHeader={
display:"flex",
alignItems:"center",
gap:"15px",
marginBottom:"15px",
marginTop:"10px"
};

const cardGrid={
display:"grid",
gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",
gap:"15px"
};

const arrowBtn={
padding:"6px 12px",
fontSize:"16px",
borderRadius:"6px",
border:"none",
cursor:"pointer"
};

const divider={
height:"1px",
background:"#e5e5e5",
margin:"40px 0"
};