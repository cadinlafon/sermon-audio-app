import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { getTrafficData } from "./trafficSource";

export async function logEvent(event, data = {}) {
  try {
    //////////////////////////////////////////////////
    // SESSION
    //////////////////////////////////////////////////

    let sessionId = localStorage.getItem("sessionId");

    if (!sessionId) {
      sessionId = crypto.randomUUID();

      localStorage.setItem("sessionId", sessionId);
      localStorage.setItem("sessionStart", Date.now());
    }

    //////////////////////////////////////////////////
    // VISITOR / TRAFFIC SOURCE
    //////////////////////////////////////////////////

    const trafficData = getTrafficData();

    //////////////////////////////////////////////////
    // USER INFO
    //////////////////////////////////////////////////

    const currentUser = auth.currentUser;

    let userData = {
      userId: null,
      fullName: null,
      email: null,
    };

    if (currentUser) {
      userData.userId = currentUser.uid;
      userData.email = currentUser.email || null;
    }

    //////////////////////////////////////////////////
    // DEVICE INFO
    //////////////////////////////////////////////////

    const device = {
      userAgent: navigator.userAgent,
      language: navigator.language || null,
      platform: navigator.platform || null,
      screenWidth: window.screen?.width || null,
      screenHeight: window.screen?.height || null,
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || null,

      isMobile:
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),

      isStandalone:
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true,
    };

    //////////////////////////////////////////////////
    // LOG OBJECT
    //////////////////////////////////////////////////

    const logData = {
      event,
      ...data,

      sessionId,

      visitorId: trafficData.visitorId,

      firstTrafficSource:
        trafficData.firstTrafficSource,

      firstTrafficMedium:
        trafficData.firstTrafficMedium,

      firstTrafficCampaign:
        trafficData.firstTrafficCampaign,

      latestTrafficSource:
        trafficData.latestTrafficSource,

      latestTrafficMedium:
        trafficData.latestTrafficMedium,

      latestTrafficCampaign:
        trafficData.latestTrafficCampaign,

      // Normalized platform buckets (facebook, instagram, youtube,
      // chatgpt, claude, google, direct, etc.) — this is what the
      // Referrals admin page groups by, so it doesn't need to
      // re-derive it from raw source strings every time it loads.
      firstPlatform: trafficData.firstPlatform,
      latestPlatform: trafficData.latestPlatform,

      trafficCapturedAt:
        trafficData.trafficCapturedAt,

      ...userData,

      device,

      page: window.location.pathname,

      createdAt: serverTimestamp(),
    };

    console.log("Logging event:", logData);

    await addDoc(collection(db, "logs"), logData);

  } catch (error) {
    console.error("Logging error:", error);
  }
}