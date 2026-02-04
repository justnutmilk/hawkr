/**
 * Customer Service
 * Handles customer profile and related operations
 */

import { db } from "../config.js";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// CUSTOMER PROFILE
// ============================================

/**
 * Get customer profile
 * @param {string} customerId - Firebase Auth UID
 * @returns {Promise<object|null>}
 */
export async function getCustomer(customerId) {
  try {
    const docRef = doc(db, "customers", customerId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting customer:", error);
    throw error;
  }
}

/**
 * Update customer profile
 * @param {string} customerId
 * @param {object} updates
 */
export async function updateCustomer(customerId, updates) {
  try {
    const allowedFields = [
      "name",
      "phone",
      "nric",
      "profilePhoto",
      "telegramChatId",
      "telegramLinked",
      "telegramUsername",
      "telegramFirstName",
      "telegramLastName",
      "telegramPhotoUrl",
      "telegramAuthDate",
      "browserNotifications",
    ];

    const filteredUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    filteredUpdates.updatedAt = serverTimestamp();

    await updateDoc(doc(db, "customers", customerId), filteredUpdates);
  } catch (error) {
    console.error("Error updating customer:", error);
    throw error;
  }
}

/**
 * Delete customer (soft delete by marking as deleted, or hard delete)
 * @param {string} customerId
 * @param {boolean} hardDelete - If true, permanently deletes
 */
export async function deleteCustomer(customerId, hardDelete = false) {
  try {
    if (hardDelete) {
      await deleteDoc(doc(db, "customers", customerId));
    } else {
      await updateDoc(doc(db, "customers", customerId), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error deleting customer:", error);
    throw error;
  }
}

// ============================================
// PAYMENT METHODS (Subcollection)
// ============================================

/**
 * Get all payment methods for a customer
 * @param {string} customerId
 * @returns {Promise<array>}
 */
export async function getPaymentMethods(customerId) {
  try {
    const paymentMethodsRef = collection(
      db,
      "customers",
      customerId,
      "paymentMethods",
    );
    const q = query(paymentMethodsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const methods = [];
    snapshot.forEach((doc) => {
      methods.push({ id: doc.id, ...doc.data() });
    });

    return methods;
  } catch (error) {
    console.error("Error getting payment methods:", error);
    throw error;
  }
}

/**
 * Add a payment method
 * @param {string} customerId
 * @param {object} paymentData - { type, lastFour, expiry, isDefault }
 * @returns {Promise<string>} - Payment method ID
 */
export async function addPaymentMethod(customerId, paymentData) {
  try {
    const paymentMethodsRef = collection(
      db,
      "customers",
      customerId,
      "paymentMethods",
    );

    // If this is set as default, unset other defaults first
    if (paymentData.isDefault) {
      const existingMethods = await getPaymentMethods(customerId);
      for (const method of existingMethods) {
        if (method.isDefault) {
          await updateDoc(
            doc(db, "customers", customerId, "paymentMethods", method.id),
            {
              isDefault: false,
            },
          );
        }
      }
    }

    const docRef = await addDoc(paymentMethodsRef, {
      type: paymentData.type,
      lastFour: paymentData.lastFour,
      expiry: paymentData.expiry,
      isDefault: paymentData.isDefault || false,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Error adding payment method:", error);
    throw error;
  }
}

/**
 * Remove a payment method
 * @param {string} customerId
 * @param {string} paymentMethodId
 */
export async function removePaymentMethod(customerId, paymentMethodId) {
  try {
    await deleteDoc(
      doc(db, "customers", customerId, "paymentMethods", paymentMethodId),
    );
  } catch (error) {
    console.error("Error removing payment method:", error);
    throw error;
  }
}

/**
 * Set a payment method as default
 * @param {string} customerId
 * @param {string} paymentMethodId
 */
export async function setDefaultPaymentMethod(customerId, paymentMethodId) {
  try {
    // Unset all existing defaults
    const existingMethods = await getPaymentMethods(customerId);
    for (const method of existingMethods) {
      if (method.isDefault && method.id !== paymentMethodId) {
        await updateDoc(
          doc(db, "customers", customerId, "paymentMethods", method.id),
          {
            isDefault: false,
          },
        );
      }
    }

    // Set the new default
    await updateDoc(
      doc(db, "customers", customerId, "paymentMethods", paymentMethodId),
      {
        isDefault: true,
      },
    );
  } catch (error) {
    console.error("Error setting default payment method:", error);
    throw error;
  }
}

// ============================================
// NOTIFICATIONS (Subcollection)
// ============================================

/**
 * Get notifications for a customer
 * @param {string} customerId
 * @param {object} options - { unreadOnly, limitCount }
 * @returns {Promise<array>}
 */
export async function getNotifications(customerId, options = {}) {
  try {
    const { unreadOnly = false, limitCount = 50 } = options;

    const notificationsRef = collection(
      db,
      "customers",
      customerId,
      "notifications",
    );
    let q = query(notificationsRef, orderBy("createdAt", "desc"));

    if (unreadOnly) {
      q = query(
        notificationsRef,
        where("isRead", "==", false),
        orderBy("createdAt", "desc"),
      );
    }

    const snapshot = await getDocs(q);
    const notifications = [];

    snapshot.forEach((doc) => {
      notifications.push({ id: doc.id, ...doc.data() });
    });

    return notifications.slice(0, limitCount);
  } catch (error) {
    console.error("Error getting notifications:", error);
    throw error;
  }
}

/**
 * Mark notification as read
 * @param {string} customerId
 * @param {string} notificationId
 */
export async function markNotificationRead(customerId, notificationId) {
  try {
    await updateDoc(
      doc(db, "customers", customerId, "notifications", notificationId),
      {
        isRead: true,
      },
    );
  } catch (error) {
    console.error("Error marking notification read:", error);
    throw error;
  }
}

/**
 * Mark all notifications as read
 * @param {string} customerId
 */
export async function markAllNotificationsRead(customerId) {
  try {
    const unreadNotifications = await getNotifications(customerId, {
      unreadOnly: true,
    });

    const promises = unreadNotifications.map((notif) =>
      updateDoc(doc(db, "customers", customerId, "notifications", notif.id), {
        isRead: true,
      }),
    );

    await Promise.all(promises);
  } catch (error) {
    console.error("Error marking all notifications read:", error);
    throw error;
  }
}

/**
 * Create a notification for a customer
 * @param {string} customerId
 * @param {object} notificationData
 * @returns {Promise<string>} - Notification ID
 */
export async function createNotification(customerId, notificationData) {
  try {
    const notificationsRef = collection(
      db,
      "customers",
      customerId,
      "notifications",
    );

    const docRef = await addDoc(notificationsRef, {
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      isRead: false,
      relatedType: notificationData.relatedType || null,
      relatedId: notificationData.relatedId || null,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

/**
 * Delete a notification
 * @param {string} customerId
 * @param {string} notificationId
 */
export async function deleteNotification(customerId, notificationId) {
  try {
    await deleteDoc(
      doc(db, "customers", customerId, "notifications", notificationId),
    );
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
}

/**
 * Get unread notification count
 * @param {string} customerId
 * @returns {Promise<number>}
 */
export async function getUnreadNotificationCount(customerId) {
  try {
    const notifications = await getNotifications(customerId, {
      unreadOnly: true,
    });
    return notifications.length;
  } catch (error) {
    console.error("Error getting unread count:", error);
    throw error;
  }
}
