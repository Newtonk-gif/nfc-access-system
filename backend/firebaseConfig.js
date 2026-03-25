// Firebase Admin SDK Configuration
const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin SDK
// Make sure you have a service account JSON file
const serviceAccount = require('./serviceAccountKey.json');

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
