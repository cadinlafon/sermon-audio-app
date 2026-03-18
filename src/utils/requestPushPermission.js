import { messaging } from "../firebase";
import { getToken } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

export async function requestPushPermission() {

try {

const permission = await Notification.requestPermission();

if (permission !== "granted") return;

const token = await getToken(messaging, {
  vapidKey: "BAxucnuOEIAqrKvmbYmhkfXS73uCD5vQ-OCmzSNQYYs1sLjZCxmk11TzlB8-bl3_tzFzAkUlAoW1vcVSnv_oWvE"
});

if (!token) return;

const user = auth.currentUser;

if (!user) return;

await setDoc(
  doc(db, "users", user.uid),
  { pushToken: token },
  { merge: true }
);

} catch (err) {
console.error("Push permission error", err);
}

}