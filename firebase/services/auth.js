/**
 * Authentication Service
 * Handles user registration, login, logout, and auth state
 */

import { auth, db } from "../config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Register a new customer
 * @param {string} email
 * @param {string} password
 * @param {object} profileData - { name, phone, etc. }
 * @returns {Promise<User>}
 */
export async function registerCustomer(email, password, profileData) {
  try {
    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update display name in Auth
    await updateProfile(user, {
      displayName: profileData.name,
    });

    // Create customer document in Firestore
    await setDoc(doc(db, "customers", user.uid), {
      name: profileData.name,
      email: email,
      phone: profileData.phone || "",
      nric: profileData.nric || "",
      profilePhoto: "",
      telegramConnected: false,
      browserNotifications: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return user;
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
}

/**
 * Register a new stall owner
 * @param {string} email
 * @param {string} password
 * @param {object} profileData
 * @returns {Promise<User>}
 */
export async function registerStallOwner(email, password, profileData) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await updateProfile(user, {
      displayName: profileData.name,
    });

    await setDoc(doc(db, "stallOwners", user.uid), {
      name: profileData.name,
      email: email,
      phone: profileData.phone || "",
      nric: profileData.nric || "",
      profilePhoto: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return user;
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
}

/**
 * Login user
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

/**
 * Logout current user
 */
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
}

/**
 * Get current user
 * @returns {User|null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Listen to auth state changes
 * @param {function} callback - Called with user object or null
 * @returns {function} Unsubscribe function
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get user profile from Firestore
 * @param {string} uid
 * @param {string} userType - "customers" | "stallOwners" | "operators"
 * @returns {Promise<object|null>}
 */
export async function getUserProfile(uid, userType = "customers") {
  try {
    const docRef = doc(db, userType, uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
}

/**
 * Send password reset email
 * @param {string} email
 */
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Password reset error:", error);
    throw error;
  }
}

/**
 * Update user email (requires recent login)
 * @param {string} newEmail
 */
export async function changeEmail(newEmail) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");
    await updateEmail(user, newEmail);
  } catch (error) {
    console.error("Email update error:", error);
    throw error;
  }
}

/**
 * Update user password (requires recent login)
 * @param {string} newPassword
 */
export async function changePassword(newPassword) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");
    await updatePassword(user, newPassword);
  } catch (error) {
    console.error("Password update error:", error);
    throw error;
  }
}

/**
 * Re-authenticate user (required before sensitive operations)
 * @param {string} password - Current password
 */
export async function reauthenticate(password) {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("No user logged in");

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  } catch (error) {
    console.error("Reauthentication error:", error);
    throw error;
  }
}

// Error message helper
export function getAuthErrorMessage(errorCode) {
  const messages = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email": "Invalid email address.",
    "auth/operation-not-allowed": "Email/password accounts are not enabled.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/too-many-requests": "Too many failed attempts. Please try again later.",
    "auth/requires-recent-login": "Please log in again to perform this action.",
  };
  return messages[errorCode] || "An error occurred. Please try again.";
}
