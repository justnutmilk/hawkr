/**
 * Notifications Service
 * Handles in-app notification operations for customers
 */

import { db, auth } from "../config.js";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Get notifications for current user
 * @param {number} limitCount - Max notifications to fetch
 * @returns {Promise<array>}
 */
export async function getNotifications(limitCount = 50) {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in");

  const q = query(
    collection(db, "customers", user.uid, "notifications"),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Mark notification as read
 * @param {string} notificationId
 */
export async function markAsRead(notificationId) {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in");

  await updateDoc(
    doc(db, "customers", user.uid, "notifications", notificationId),
    {
      isRead: true,
      readAt: serverTimestamp(),
    }
  );
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead() {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in");

  const q = query(
    collection(db, "customers", user.uid, "notifications"),
    where("isRead", "==", false)
  );

  const snapshot = await getDocs(q);

  const updates = snapshot.docs.map((docSnap) =>
    updateDoc(doc(db, "customers", user.uid, "notifications", docSnap.id), {
      isRead: true,
      readAt: serverTimestamp(),
    })
  );

  await Promise.all(updates);
}

/**
 * Subscribe to notifications in real-time
 * @param {function} callback - Callback with notifications array
 * @returns {function} Unsubscribe function
 */
export function subscribeToNotifications(callback) {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(
    collection(db, "customers", user.uid, "notifications"),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(notifications);
  });
}

/**
 * Get unread notification count
 * @returns {Promise<number>}
 */
export async function getUnreadCount() {
  const user = auth.currentUser;
  if (!user) return 0;

  const q = query(
    collection(db, "customers", user.uid, "notifications"),
    where("isRead", "==", false)
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Format time ago string
 * @param {object} timestamp - Firestore timestamp
 * @returns {string}
 */
export function formatTimeAgo(timestamp) {
  if (!timestamp) return "";

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
  });
}
