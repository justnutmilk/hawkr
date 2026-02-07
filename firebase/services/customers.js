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
  increment,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { analyzeSentiment } from "./gemini.js";

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

// ============================================
// CART (Subcollection)
// ============================================

/**
 * Get cart items for a customer
 * @param {string} customerId
 * @returns {Promise<array>}
 */
export async function getCart(customerId) {
  try {
    const cartRef = collection(db, "customers", customerId, "cart");
    const snapshot = await getDocs(cartRef);

    const items = [];
    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });

    return items;
  } catch (error) {
    console.error("Error getting cart:", error);
    throw error;
  }
}

/**
 * Add item to cart or increment quantity if exists
 * Items with different variant selections are treated as different products
 * @param {string} customerId
 * @param {object} item - { menuItemId, stallId, name, price, basePrice, imageUrl, quantity, selectedVariants }
 * @returns {Promise<string>} - Cart item ID
 */
export async function addToCart(customerId, item) {
  try {
    const cartRef = collection(db, "customers", customerId, "cart");

    // Generate variants key for matching (same item with different variants = different cart item)
    const variantsKey = (item.selectedVariants || [])
      .map((v) => `${v.name}:${v.option}`)
      .sort()
      .join("|");

    // Check if item with same menuItemId, stallId, AND variants already exists
    const q = query(
      cartRef,
      where("menuItemId", "==", item.menuItemId),
      where("stallId", "==", item.stallId),
    );
    const snapshot = await getDocs(q);

    // Find exact match including variants
    const existingDoc = snapshot.docs.find((doc) => {
      const data = doc.data();
      const existingVariantsKey = (data.selectedVariants || [])
        .map((v) => `${v.name}:${v.option}`)
        .sort()
        .join("|");
      return existingVariantsKey === variantsKey;
    });

    if (existingDoc) {
      // Item with same variants exists, increment quantity
      const existingData = existingDoc.data();
      await updateDoc(
        doc(db, "customers", customerId, "cart", existingDoc.id),
        {
          quantity: existingData.quantity + (item.quantity || 1),
          updatedAt: serverTimestamp(),
        },
      );
      return existingDoc.id;
    }

    // Add new item (different variants or new item entirely)
    const docRef = await addDoc(cartRef, {
      menuItemId: item.menuItemId,
      stallId: item.stallId,
      stallName: item.stallName || "",
      name: item.name,
      basePrice: item.basePrice || item.price,
      price: item.price,
      imageUrl: item.imageUrl || "",
      quantity: item.quantity || 1,
      selectedVariants: item.selectedVariants || [],
      variantsKey: variantsKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Error adding to cart:", error);
    throw error;
  }
}

/**
 * Update cart item quantity
 * @param {string} customerId
 * @param {string} cartItemId
 * @param {number} quantity
 */
export async function updateCartItemQuantity(customerId, cartItemId, quantity) {
  try {
    if (quantity <= 0) {
      await removeFromCart(customerId, cartItemId);
      return;
    }

    await updateDoc(doc(db, "customers", customerId, "cart", cartItemId), {
      quantity: quantity,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating cart item:", error);
    throw error;
  }
}

/**
 * Remove item from cart
 * @param {string} customerId
 * @param {string} cartItemId
 */
export async function removeFromCart(customerId, cartItemId) {
  try {
    await deleteDoc(doc(db, "customers", customerId, "cart", cartItemId));
  } catch (error) {
    console.error("Error removing from cart:", error);
    throw error;
  }
}

/**
 * Clear entire cart
 * @param {string} customerId
 */
export async function clearCart(customerId) {
  try {
    const cartItems = await getCart(customerId);
    const promises = cartItems.map((item) =>
      deleteDoc(doc(db, "customers", customerId, "cart", item.id)),
    );
    await Promise.all(promises);
  } catch (error) {
    console.error("Error clearing cart:", error);
    throw error;
  }
}

/**
 * Get cart item count
 * @param {string} customerId
 * @returns {Promise<number>}
 */
export async function getCartItemCount(customerId) {
  try {
    const cartItems = await getCart(customerId);
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  } catch (error) {
    console.error("Error getting cart count:", error);
    throw error;
  }
}

/**
 * Update cart item notes (special requests)
 * @param {string} customerId
 * @param {string} cartItemId
 * @param {string} notes
 */
export async function updateCartItemNotes(customerId, cartItemId, notes) {
  try {
    await updateDoc(doc(db, "customers", customerId, "cart", cartItemId), {
      notes: notes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating cart item notes:", error);
    throw error;
  }
}

/**
 * Update cart item with multiple fields (variants, notes, price)
 * @param {string} customerId
 * @param {string} cartItemId
 * @param {object} updates - Object containing fields to update
 */
export async function updateCartItem(customerId, cartItemId, updates) {
  try {
    await updateDoc(doc(db, "customers", customerId, "cart", cartItemId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating cart item:", error);
    throw error;
  }
}

// ============================================
// FAVOURITES (Subcollection)
// ============================================

/**
 * Get all favourites for a customer
 * @param {string} customerId
 * @returns {Promise<array>}
 */
export async function getFavourites(customerId) {
  try {
    const favouritesRef = collection(db, "customers", customerId, "favourites");
    const q = query(favouritesRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const favourites = [];
    snapshot.forEach((doc) => {
      favourites.push({ id: doc.id, ...doc.data() });
    });

    return favourites;
  } catch (error) {
    console.error("Error getting favourites:", error);
    throw error;
  }
}

/**
 * Add item to favourites
 * @param {string} customerId
 * @param {object} item - { menuItemId, name, price, imageUrl, rating, stallId, stallName, hawkerCentreId, hawkerCentreName, allergens }
 * @returns {Promise<string>} - Favourite ID
 */
export async function addToFavourites(customerId, item) {
  try {
    const favouritesRef = collection(db, "customers", customerId, "favourites");

    // Check if item already exists in favourites
    const q = query(favouritesRef, where("menuItemId", "==", item.menuItemId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Already favourited, return existing ID
      return snapshot.docs[0].id;
    }

    // Add new favourite
    const docRef = await addDoc(favouritesRef, {
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl || "",
      rating: item.rating || 0,
      stallId: item.stallId,
      stallName: item.stallName || "",
      hawkerCentreId: item.hawkerCentreId || "",
      hawkerCentreName: item.hawkerCentreName || "",
      allergens: item.allergens || [],
      createdAt: serverTimestamp(),
    });

    // Increment like counter on the menu item
    if (item.stallId && item.menuItemId) {
      try {
        await updateDoc(
          doc(db, "foodStalls", item.stallId, "menuItems", item.menuItemId),
          { likesCount: increment(1) },
        );
      } catch (e) {
        console.warn("Could not update like count:", e);
      }
    }

    return docRef.id;
  } catch (error) {
    console.error("Error adding to favourites:", error);
    throw error;
  }
}

/**
 * Remove item from favourites by favourite document ID
 * @param {string} customerId
 * @param {string} favouriteId
 */
export async function removeFromFavourites(customerId, favouriteId) {
  try {
    const favDocRef = doc(
      db,
      "customers",
      customerId,
      "favourites",
      favouriteId,
    );
    const favSnap = await getDoc(favDocRef);
    const favData = favSnap.exists() ? favSnap.data() : null;

    await deleteDoc(favDocRef);

    // Decrement like counter on the menu item
    if (favData && favData.stallId && favData.menuItemId) {
      try {
        await updateDoc(
          doc(
            db,
            "foodStalls",
            favData.stallId,
            "menuItems",
            favData.menuItemId,
          ),
          { likesCount: increment(-1) },
        );
      } catch (e) {
        console.warn("Could not update like count:", e);
      }
    }
  } catch (error) {
    console.error("Error removing from favourites:", error);
    throw error;
  }
}

/**
 * Remove item from favourites by menu item ID
 * @param {string} customerId
 * @param {string} menuItemId
 */
export async function removeFromFavouritesByMenuItemId(customerId, menuItemId) {
  try {
    const favouritesRef = collection(db, "customers", customerId, "favourites");
    const q = query(favouritesRef, where("menuItemId", "==", menuItemId));
    const snapshot = await getDocs(q);

    // Collect stallIds before deleting for counter decrement
    const stallIds = snapshot.docs.map((d) => d.data().stallId).filter(Boolean);

    const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);

    // Decrement counter for each deleted favourite
    for (const stallId of stallIds) {
      try {
        await updateDoc(
          doc(db, "foodStalls", stallId, "menuItems", menuItemId),
          { likesCount: increment(-1) },
        );
      } catch (e) {
        console.warn("Could not update like count:", e);
      }
    }
  } catch (error) {
    console.error("Error removing from favourites:", error);
    throw error;
  }
}

/**
 * Check if an item is in favourites
 * @param {string} customerId
 * @param {string} menuItemId
 * @returns {Promise<boolean>}
 */
export async function isFavourite(customerId, menuItemId) {
  try {
    const favouritesRef = collection(db, "customers", customerId, "favourites");
    const q = query(favouritesRef, where("menuItemId", "==", menuItemId));
    const snapshot = await getDocs(q);

    return !snapshot.empty;
  } catch (error) {
    console.error("Error checking favourite:", error);
    throw error;
  }
}

/**
 * Toggle favourite status
 * @param {string} customerId
 * @param {object} item - Menu item data
 * @returns {Promise<{isFavourite: boolean, favouriteId: string|null}>}
 */
export async function toggleFavourite(customerId, item) {
  try {
    const favouritesRef = collection(db, "customers", customerId, "favourites");
    const q = query(favouritesRef, where("menuItemId", "==", item.menuItemId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Remove from favourites
      await deleteDoc(snapshot.docs[0].ref);

      // Decrement like counter
      if (item.stallId && item.menuItemId) {
        try {
          await updateDoc(
            doc(db, "foodStalls", item.stallId, "menuItems", item.menuItemId),
            { likesCount: increment(-1) },
          );
        } catch (e) {
          console.warn("Could not update like count:", e);
        }
      }

      return { isFavourite: false, favouriteId: null };
    } else {
      // Add to favourites
      const favouriteId = await addToFavourites(customerId, item);
      return { isFavourite: true, favouriteId };
    }
  } catch (error) {
    console.error("Error toggling favourite:", error);
    throw error;
  }
}

// ============================================
// FEEDBACK (Subcollection)
// ============================================

/**
 * Submit feedback for an order
 * @param {string} customerId
 * @param {object} feedbackData - { orderId, stallId, stallName, rating, tags, text, contactMe }
 * @returns {Promise<string>} - Feedback ID
 */
export async function submitFeedback(customerId, feedbackData) {
  try {
    const feedbackRef = collection(db, "customers", customerId, "feedback");

    // Analyze sentiment using Gemini API
    const sentiment = await analyzeSentiment(
      feedbackData.text,
      feedbackData.rating,
    );

    // Check if feedback already exists for this order
    const q = query(feedbackRef, where("orderId", "==", feedbackData.orderId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Update existing feedback
      const existingDoc = snapshot.docs[0];
      await updateDoc(
        doc(db, "customers", customerId, "feedback", existingDoc.id),
        {
          rating: feedbackData.rating,
          tags: feedbackData.tags || [],
          title: feedbackData.title || "",
          text: feedbackData.text || "",
          contactMe: feedbackData.contactMe || false,
          sentiment: sentiment,
          updatedAt: serverTimestamp(),
        },
      );
      return existingDoc.id;
    }

    // Create new feedback
    const docRef = await addDoc(feedbackRef, {
      orderId: feedbackData.orderId,
      stallId: feedbackData.stallId,
      stallName: feedbackData.stallName,
      venueName: feedbackData.venueName || "",
      rating: feedbackData.rating,
      tags: feedbackData.tags || [],
      title: feedbackData.title || "",
      text: feedbackData.text || "",
      contactMe: feedbackData.contactMe || false,
      sentiment: sentiment,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Also save to a top-level feedback collection for vendor access
    await addDoc(collection(db, "feedback"), {
      customerId: customerId,
      customerName: feedbackData.customerName || "Anonymous",
      orderId: feedbackData.orderId,
      stallId: feedbackData.stallId,
      stallName: feedbackData.stallName,
      venueName: feedbackData.venueName || "",
      rating: feedbackData.rating,
      tags: feedbackData.tags || [],
      title: feedbackData.title || "",
      text: feedbackData.text || "",
      comment: feedbackData.text || "",
      contactMe: feedbackData.contactMe || false,
      isPublic: true,
      sentiment: sentiment,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Error submitting feedback:", error);
    throw error;
  }
}

/**
 * Get all feedback submitted by a customer
 * @param {string} customerId
 * @returns {Promise<array>}
 */
export async function getCustomerFeedback(customerId) {
  try {
    const feedbackRef = collection(db, "customers", customerId, "feedback");
    const q = query(feedbackRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const feedback = [];
    snapshot.forEach((doc) => {
      feedback.push({ id: doc.id, ...doc.data() });
    });

    return feedback;
  } catch (error) {
    console.error("Error getting customer feedback:", error);
    throw error;
  }
}

/**
 * Check if feedback exists for an order
 * @param {string} customerId
 * @param {string} orderId
 * @returns {Promise<boolean>}
 */
export async function hasFeedbackForOrder(customerId, orderId) {
  try {
    const feedbackRef = collection(db, "customers", customerId, "feedback");
    const q = query(feedbackRef, where("orderId", "==", orderId));
    const snapshot = await getDocs(q);

    return !snapshot.empty;
  } catch (error) {
    console.error("Error checking feedback:", error);
    throw error;
  }
}

/**
 * Get feedback for a specific order
 * @param {string} customerId
 * @param {string} orderId
 * @returns {Promise<object|null>}
 */
export async function getFeedbackForOrder(customerId, orderId) {
  try {
    const feedbackRef = collection(db, "customers", customerId, "feedback");
    const q = query(feedbackRef, where("orderId", "==", orderId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("Error getting feedback for order:", error);
    throw error;
  }
}
