const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();

exports.sendPushNotification = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Not logged in");
  }

  const db = getFirestore();
  const userDoc = await db.collection("users").doc(request.auth.uid).get();

  if (!userDoc.exists || userDoc.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Not admin");
  }

  const { title, body, targetUserId } = request.data;

  if (!title || !body || !targetUserId) {
    throw new HttpsError(
      "invalid-argument",
      "Title, body, and targetUserId are required"
    );
  }

  const tokens = [];

  if (targetUserId === "all") {
    const usersSnap = await db.collection("users").get();

    usersSnap.forEach((doc) => {
      const token = doc.data().fcmToken || doc.data().pushToken;
      if (token) tokens.push(token);
    });
  } else {
    const targetDoc = await db.collection("users").doc(targetUserId).get();
    const token = targetDoc.data()?.fcmToken || targetDoc.data()?.pushToken;

    if (token) tokens.push(token);
  }

  await db.collection("notifications").add({
    title,
    body,
    targetUserId,
    createdAt: FieldValue.serverTimestamp(),
  });

  if (tokens.length === 0) {
    return {
      success: true,
      sent: 0,
    };
  }

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title,
      body,
    },
  });

  return {
    success: true,
    sent: response.successCount,
    failed: response.failureCount,
  };
});
