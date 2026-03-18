import { useEffect, useState } from "react";
import { db } from "../../firebase";
import {
collection,
getDocs,
doc,
updateDoc,
deleteDoc,
} from "firebase/firestore";

export default function Users() {
const [users, setUsers] = useState([]);
const [editingId, setEditingId] = useState(null);
const [editData, setEditData] = useState({ fullName: "", email: "" });

const fetchUsers = async () => {
try {
const snapshot = await getDocs(collection(db, "users"));

const userList = snapshot.docs.map((docItem) => ({
id: docItem.id,
...docItem.data(),
}));

setUsers(userList);
} catch (error) {
console.error("Error fetching users:", error);
}
};

useEffect(() => {
fetchUsers();
}, []);

//////////////////////////////////////////////////
// LOGIN METHOD HELPER
//////////////////////////////////////////////////

const getLoginMethod = (user) => {

if (user.provider === "google" || user.provider === "google.com") {
return "Google";
}

if (user.provider === "password") {
return "Email";
}

return "Other";

};

//////////////////////////////////////////////////
// EDITING
//////////////////////////////////////////////////

const startEdit = (user) => {
setEditingId(user.id);
setEditData({
fullName: user.fullName || user.name || "",
email: user.email || "",
});
};

const cancelEdit = () => {
setEditingId(null);
setEditData({ fullName: "", email: "" });
};

const saveEdit = async (id) => {
try {
await updateDoc(doc(db, "users", id), {
fullName: editData.fullName,
name: editData.fullName,
email: editData.email,
});

setEditingId(null);
fetchUsers();
} catch (error) {
console.error("Error updating user:", error);
}
};

//////////////////////////////////////////////////
// ADMIN ROLE
//////////////////////////////////////////////////

const makeAdmin = async (id) => {
await updateDoc(doc(db, "users", id), {
role: "admin",
});

fetchUsers();
};

const removeAdmin = async (id) => {
await updateDoc(doc(db, "users", id), {
role: "user",
});

fetchUsers();
};

//////////////////////////////////////////////////
// DELETE USER
//////////////////////////////////////////////////

const deleteUser = async (id) => {
if (!window.confirm("Delete this user?")) return;

await deleteDoc(doc(db, "users", id));
fetchUsers();
};

//////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////

return (
<div>
<h1 style={{ marginBottom: "20px" }}>Users</h1>

<table style={{ width: "100%", borderCollapse: "collapse" }}>
<thead>
<tr>
<th style={thStyle}>Name</th>
<th style={thStyle}>Email</th>
<th style={thStyle}>Login</th>
<th style={thStyle}>Status</th>
<th style={thStyle}>Modify</th>
</tr>
</thead>

<tbody>
{users.map((user) => {
const isEditing = editingId === user.id;
const isAdmin = user.role === "admin";

return (
<tr key={user.id}>

{/* NAME */}
<td style={tdStyle}>
{isEditing ? (
<input
value={editData.fullName}
onChange={(e) =>
setEditData({
...editData,
fullName: e.target.value,
})
}
/>
) : (
user.fullName || user.name || "—"
)}
</td>

{/* EMAIL */}
<td style={tdStyle}>
{isEditing ? (
<input
value={editData.email}
onChange={(e) =>
setEditData({
...editData,
email: e.target.value,
})
}
/>
) : (
user.email || "—"
)}
</td>

{/* LOGIN METHOD */}
<td style={tdStyle}>
<span
style={{
padding: "4px 8px",
borderRadius: "6px",
backgroundColor: "#eef2ff",
fontSize: "12px",
}}
>
{getLoginMethod(user)}
</span>
</td>

{/* STATUS */}
<td style={tdStyle}>
<span
style={{
padding: "4px 8px",
borderRadius: "6px",
backgroundColor: isAdmin ? "#d1fae5" : "#e5e7eb",
fontSize: "12px",
}}
>
{isAdmin ? "Admin" : "User"}
</span>
</td>

{/* MODIFY */}
<td style={tdStyle}>
{isEditing ? (
<>
<button onClick={() => saveEdit(user.id)}>Save</button>
<button onClick={cancelEdit}>Cancel</button>
</>
) : (
<select
defaultValue=""
onChange={(e) => {
const action = e.target.value;
e.target.value = "";

if (action === "edit") startEdit(user);
if (action === "delete") deleteUser(user.id);
if (action === "makeAdmin") makeAdmin(user.id);
if (action === "removeAdmin") removeAdmin(user.id);
}}
>
<option value="" disabled>
Select
</option>

{isAdmin ? (
<option value="removeAdmin">Remove Admin</option>
) : (
<option value="makeAdmin">Make Admin</option>
)}

<option value="edit">Edit</option>
<option value="delete">Delete</option>
</select>
)}
</td>

</tr>
);
})}
</tbody>
</table>
</div>
);
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const thStyle = {
borderBottom: "2px solid #ccc",
padding: "10px",
textAlign: "left",
};

const tdStyle = {
borderBottom: "1px solid #eee",
padding: "10px",
};