// ============================================================
//  RFID Attendance System — Shared Firebase Configuration
//  /config/firebase_config.js
//
//  ⚠️  DO NOT share this file publicly or commit to a public repo.
//  Keep the repository PRIVATE on GitHub.
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyB-DK6trmKoPfbUvrCBTfzonLWh4dU_N28",           // Replace with real value from Firebase Console
  authDomain:        "attendance-logging-syste-5540c.firebaseapp.com",
  databaseURL:       "https://attendance-logging-syste-5540c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "attendance-logging-syste-5540c",
  storageBucket:     "attendance-logging-syste-5540c.firebasestorage.app",
  messagingSenderId: "685548152341",
  appId:             "1:685548152341:web:e5eb89e21018f3e316901c",
  measurementId:     "G-70JLBXGXFD"
};

export default firebaseConfig;

// ============================================================
//  HOW TO USE
//
//  Dashboard (JS/React):
//    import firebaseConfig from './config/firebase_config.js';
//    import { initializeApp } from 'firebase/app';
//    const app = initializeApp(firebaseConfig);
//
//  ESP8266 (Arduino) — copy these values into your sketch:
//    #define API_KEY       "YOUR_API_KEY"
//    #define DATABASE_URL  "https://attendance-logging-syste-5540c-default-rtdb.europe-west1.firebasedatabase.app"
//    #define PROJECT_ID    "attendance-logging-syste-5540c"
// ============================================================
