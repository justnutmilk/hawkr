/**
 * Firebase Configuration
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project or select existing one
 * 3. Go to Project Settings > General > Your apps
 * 4. Click the web icon (</>) to add a web app
 * 5. Copy the firebaseConfig object and paste below
 * 6. Enable Firestore: Build > Firestore Database > Create database
 * 7. Enable Auth: Build > Authentication > Get started > Enable Email/Password
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Hawkr Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDDnphzWwGQ6rGxgBJsMv6hxNg7eKH55rY",
  authDomain: "hawkr-0.firebaseapp.com",
  projectId: "hawkr-0",
  storageBucket: "hawkr-0.firebasestorage.app",
  messagingSenderId: "660265694240",
  appId: "1:660265694240:web:baea70a40a35ea4f3ff845",
  measurementId: "G-EBEY7TFVFY",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
