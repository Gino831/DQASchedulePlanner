import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBP5H1cPEoWarJDPwyRF6AzIKrwlTW6Rak",
    authDomain: "dqa-schedule-planner.firebaseapp.com",
    projectId: "dqa-schedule-planner",
    storageBucket: "dqa-schedule-planner.firebasestorage.app",
    messagingSenderId: "230104036245",
    appId: "1:230104036245:web:1a750f4ae75b5a4e5b3c9c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 強制使用 HTTP 長輪詢 (Long Polling)，藉此繞過公司防火牆對 WebSocket 的阻擋
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});
