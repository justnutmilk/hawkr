/**
 * Operator Notifications Service
 * Handles in-app notification operations for operators.
 * Mirrors firebase/services/vendorNotifications.js but uses operators/{operatorId}/notifications.
 */

import { db, auth } from "../config.js";
import {
  collection,
  doc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export { formatTimeAgo } from "./notifications.js";

/**
 * Subscribe to operator notifications in real-time
 * @param {function} callback - Callback with notifications array
 * @returns {function} Unsubscribe function
 */
export function subscribeToOperatorNotifications(callback) {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(
    collection(db, "operators", user.uid, "notifications"),
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
 * Mark an operator notification as read
 * @param {string} notificationId
 */
export async function markOperatorNotificationAsRead(notificationId) {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in");

  await updateDoc(
    doc(db, "operators", user.uid, "notifications", notificationId),
    {
      isRead: true,
      readAt: serverTimestamp(),
    },
  );
}
