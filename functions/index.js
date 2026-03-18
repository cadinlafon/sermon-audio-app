const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendPushNotification = functions.https.onCall(async (data, context) => {
  // Only admins allowed
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Not logged in");
  }

  const userDoc = await admin.firestore()
    .collection("users")
    .doc(context.auth.uid)
    .get();

  if (!userDoc.exists || userDoc.data().role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Not admin");
  }

  const { title, body, targetUserId } = data;

  let tokens = [];

  if (targetUserId === "all") {
    const usersSnap = await admin.firestore().collection("users").get();

    usersSnap.forEach(doc => {
      const t = doc.data().fcmToken;
      if (t) tokens.push(t);
    });
  } else {
    const targetDoc = await admin.firestore()
      .collection("users")
      .doc(targetUserId)
      .get();

    const t = targetDoc.data()?.fcmToken;
    if (t) tokens.push(t);
  }

  // 🚨 SAVE NOTIFICATION (THIS IS WHAT YOU WERE MISSING)
  await admin.firestore().collection("notifications").add({
    title,
    body,
    targetUserId,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (tokens.length === 0) return { success: true };

  // Send push
  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title,
      body,
    },
  });

  return { success: true };
});