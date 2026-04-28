// Firebase Admin SDK Configuration
const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin SDK
// Make sure you have a service account JSON file
let serviceAccount;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  } else {
    serviceAccount = require('./serviceAccountKey.json');
  }
} catch (error) {
  console.error("\n❌ CRITICAL ERROR: Failed to load Firebase credentials!");
  console.error("👉 Actual Node.js Error:", error.message);
  console.error("Please go to Firebase Console -> Project Settings -> Service Accounts.");
  console.error("Click 'Generate new private key', rename the file to 'serviceAccountKey.json', and place it in your 'backend' folder.\n");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://attendance-logging-syste-5540c-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();
const auth = admin.auth();

module.exports = {
  admin,
  db,
  auth
};
