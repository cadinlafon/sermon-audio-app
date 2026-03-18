importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBhhdR6mms3JdLhXkl283k9yjm7zyLafpk",
  authDomain: "palousefellowshipsermonapp.firebaseapp.com",
  projectId: "palousefellowshipsermonapp",
  storageBucket: "palousefellowshipsermonapp.firebasestorage.app",
  messagingSenderId: "591678059434",
  appId: "1:591678059434:web:dfa8631fab9a2295f831d3",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {

self.registration.showNotification(payload.notification.title, {
  body: payload.notification.body,
  icon: "/icon-192.png"
});

});