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

usesWeb:0,
usesPWA:0,
pwaIphone:0,
pwaAndroid:0,
pwaDesktop:0
});

const [monthlyActivity,setMonthlyActivity]=useState([]);

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

//////////////////////////////////////////////////
// BASIC STATS
//////////////////////////////////////////////////

const totalUsers=users.length;

const newUsers=users.filter(u=>{
if(!u.createdAt?.seconds)return false;
const d=new Date(u.createdAt.seconds*1000);
return d>=endStart&&d<=endEnd;
}).length;

const totalUploads=audio.length;

let minutesPlayed=0;
let totalListens=0;

usage.forEach(item=>{
if(!item.createdAt?.seconds)return;

const d=new Date(item.createdAt.seconds*1000);

if(d>=endStart&&d<=endEnd){
totalListens++;
if(item.duration) minutesPlayed+=item.duration;
}
});

minutesPlayed=Math.floor(minutesPlayed/60);

//////////////////////////////////////////////////
// 🔥 MONTHLY ACTIVITY (FIXED)
//////////////////////////////////////////////////

const monthNames = [
"January","February","March","April","May","June",
"July","August","September","October","November","December"
];

const monthlyMap = {};

usage.forEach(item => {
if (!item.createdAt?.seconds) return;

const d = new Date(item.createdAt.seconds * 1000);
const key = `${d.getFullYear()}-${d.getMonth()}`;

if (!monthlyMap[key]) monthlyMap[key] = 0;

monthlyMap[key]++;
});

const monthlyData = Object.entries(monthlyMap)
.map(([key, count]) => {
const [year, month] = key.split("-");
return {
label: `${monthNames[month]} ${year}`,
count,
date: new Date(year, month)
};
})
.sort((a,b)=>a.date-b.date)
.slice(-6);

setMonthlyActivity(monthlyData);

//////////////////////////////////////////////////
// PLATFORM STATS
//////////////////////////////////////////////////

let usesWeb=0;
let usesPWA=0;
let pwaIphone=0;
let pwaAndroid=0;
let pwaDesktop=0;

logs.forEach(log=>{

if(log.event==="app_opened"){
const device=log.device || "";
if(device.includes("iPhone")||device.includes("Android")) usesWeb++;
}

if(log.event==="pwa_installed"){
usesPWA++;
const device=log.device || "";

if(device.includes("iPhone")||device.includes("iPad")) pwaIphone++;
else if(device.includes("Android")) pwaAndroid++;
else pwaDesktop++;
}

});

//////////////////////////////////////////////////
// SET STATE
//////////////////////////////////////////////////

setStats({
totalUsers,
newUsers,
totalUploads,
minutesPlayed,
activeUsers:0,
totalListens,

usesWeb,
usesPWA,
pwaIphone,
pwaAndroid,
pwaDesktop
});

}catch(err){
console.error("Analytics error:",err);
}

};

fetchAnalytics();

},[]);

//////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////

return(
<div style={container}>

<h1 style={title}>Analytics Dashboard</h1>

{/* STATS */}
<div style={statGrid}>
<StatCard label="Total Users" value={stats.totalUsers}/>
<StatCard label="New Users This Week" value={stats.newUsers}/>
<StatCard label="Total Uploads" value={stats.totalUploads}/>
<StatCard label="Minutes Played This Week" value={stats.minutesPlayed}/>
<StatCard label="Total Listens This Week" value={stats.totalListens}/>
<StatCard label="Uses on Web" value={stats.usesWeb}/>
<StatCard label="Uses on PWA" value={stats.usesPWA}/>
<StatCard label="PWA on iPhone" value={stats.pwaIphone}/>
<StatCard label="PWA on Android" value={stats.pwaAndroid}/>
<StatCard label="PWA on Desktop" value={stats.pwaDesktop}/>
</div>

{/* 🔥 CLEAN CHART */}
<div style={divider}></div>

<h2 style={{ marginBottom: "15px" }}>Monthly Activity</h2>

<div style={chartCard}>
<div style={chartInner}>

{monthlyActivity.map((m,i)=>{

const max=Math.max(...monthlyActivity.map(x=>x.count),1);
const heightPercent=(m.count/max)*100;

return(
<div key={i} style={barWrapper}>

<div style={{
...bar,
height:`${heightPercent}%`
}}/>

<div style={barValue}>{m.count}</div>
<div style={barLabel}>{m.label}</div>

</div>
);
})}

</div>
</div>

</div>
);
}

//////////////////////////////////////////////////
// COMPONENTS
//////////////////////////////////////////////////

function StatCard({label,value}){
return(
<div style={statCard}>
<div style={statLabel}>{label}</div>
<div style={statValue}>{value}</div>
</div>
);
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const container={
padding:"40px",
maxWidth:"1200px",
margin:"auto"
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

const statLabel={fontSize:"14px",color:"#666"};
const statValue={fontSize:"32px",fontWeight:"bold",marginTop:"10px"};

const divider={
height:"1px",
background:"#e5e5e5",
margin:"40px 0"
};

//////////////////////////////////////////////////
// CHART STYLES (FIXED)
//////////////////////////////////////////////////

const chartCard={
background:"#fff",
borderRadius:"14px",
boxShadow:"0 6px 16px rgba(0,0,0,0.08)",
padding:"20px"
};

const chartInner={
display:"flex",
alignItems:"flex-end",
gap:"16px",
height:"220px"
};

const barWrapper={
display:"flex",
flexDirection:"column",
alignItems:"center",
justifyContent:"flex-end",
flex:1,
height:"100%"
};

const bar={
width:"100%",
maxWidth:"40px",
background:"linear-gradient(180deg,#3b82f6,#2563eb)",
borderRadius:"6px 6px 0 0"
};

const barLabel={
fontSize:"11px",
marginTop:"8px",
textAlign:"center",
color:"#555"
};

const barValue={
fontSize:"12px",
fontWeight:"bold",
marginBottom:"4px"
};