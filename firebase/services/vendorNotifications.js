/**
 * Vendor Notifications Service
 * Handles in-app notification operations for vendors.
 * Mirrors firebase/services/notifications.js but uses vendors/{vendorId}/notifications.
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

// Re-export shared utility
export { formatTimeAgo } from "./notifications.js";

/**
 * Get notifications for current vendor
 * @param {number} limitCount - Max notifications to fetch
 * @returns {Promise<array>}
 */
export async function getVendorNotifications(limitCount = 50) {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in");

  const q = query(
    collection(db, "vendors", user.uid, "notifications"),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Mark a vendor notification as read
 * @param {string} notificationId
 */
export async function markVendorNotificationAsRead(notificationId) {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in");

  await updateDoc(
    doc(db, "vendors", user.uid, "notifications", notificationId),
    {
      isRead: true,
      readAt: serverTimestamp(),
    },
  );
}

/**
 * Mark all vendor notifications as read
 */
export async function markAllVendorNotificationsAsRead() {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in");

  const q = query(
    collection(db, "vendors", user.uid, "notifications"),
    where("isRead", "==", false),
  );

  const snapshot = await getDocs(q);

  const updates = snapshot.docs.map((docSnap) =>
    updateDoc(doc(db, "vendors", user.uid, "notifications", docSnap.id), {
      isRead: true,
      readAt: serverTimestamp(),
    }),
  );

  await Promise.all(updates);
}

/**
 * Subscribe to vendor notifications in real-time
 * @param {function} callback - Callback with notifications array
 * @returns {function} Unsubscribe function
 */
export function subscribeToVendorNotifications(callback) {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(
    collection(db, "vendors", user.uid, "notifications"),
    orderBy("createdAt", "desc"),
    limit(50),
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
 * Get unread vendor notification count
 * @returns {Promise<number>}
 */
export async function getVendorUnreadCount() {
  const user = auth.currentUser;
  if (!user) return 0;

  const q = query(
    collection(db, "vendors", user.uid, "notifications"),
    where("isRead", "==", false),
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}
