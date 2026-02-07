/**
 * Feedback Service
 * Handles feedback CRUD operations
 */

import { db, app } from "../config.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  runTransaction,
  increment,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Submit new feedback
 * @param {object} feedbackData
 * @returns {Promise<string>} - Feedback document ID
 *
 * @example
 * await submitFeedback({
 *   customerId: "user123",
 *   customerName: "John Doe",
 *   orderId: "order456",        // optional
 *   stallId: "stall789",
 *   stallName: "Ah Heng Curry",
 *   rating: 4,
 *   comment: "Great food!",
 *   tags: ["Fast service", "Good value"],
 *   contactRequested: true,
 *   contactEmail: "john@example.com",
 *   contactPhone: "+65 9123 4567",
 *   isPublic: true
 * });
 */
export async function submitFeedback(feedbackData) {
  try {
    // Validate required fields
    const required = ["customerId", "stallId", "rating"];
    for (const field of required) {
      if (!feedbackData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate rating
    if (feedbackData.rating < 1 || feedbackData.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    // Use transaction to update both feedback and stall rating
    const feedbackId = await runTransaction(db, async (transaction) => {
      // Get current stall data
      const stallRef = doc(db, "foodStalls", feedbackData.stallId);
      const stallDoc = await transaction.get(stallRef);

      if (!stallDoc.exists()) {
        throw new Error("Stall not found");
      }

      const stallData = stallDoc.data();
      const currentRating = stallData.rating || 0;
      const currentReviews = stallData.totalReviews || 0;

      // Calculate new average rating
      const newTotalReviews = currentReviews + 1;
      const newRating =
        (currentRating * currentReviews + feedbackData.rating) /
        newTotalReviews;

      // Create feedback document
      const feedbackRef = doc(collection(db, "feedback"));
      transaction.set(feedbackRef, {
        customerId: feedbackData.customerId,
        customerName: feedbackData.customerName || "",
        orderId: feedbackData.orderId || null,
        stallId: feedbackData.stallId,
        stallName: feedbackData.stallName || stallData.name || "",
        rating: feedbackData.rating,
        comment: feedbackData.comment || "",
        tags: feedbackData.tags || [],
        contactRequested: feedbackData.contactRequested || false,
        contactEmail: feedbackData.contactRequested
          ? feedbackData.contactEmail || ""
          : "",
        contactPhone: feedbackData.contactRequested
          ? feedbackData.contactPhone || ""
          : "",
        isPublic: feedbackData.isPublic !== false, // Default to true
        stallResponse: null,
        stallResponseDate: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update stall rating
      transaction.update(stallRef, {
        rating: Math.round(newRating * 10) / 10, // Round to 1 decimal
        totalReviews: newTotalReviews,
        updatedAt: serverTimestamp(),
      });

      return feedbackRef.id;
    });

    // Notify vendor of new feedback (non-blocking)
    try {
      const fns = getFunctions(app, "asia-southeast1");
      const notifyVendor = httpsCallable(fns, "notifyVendorFeedback");
      notifyVendor({
        feedbackId,
        stallId: feedbackData.stallId,
        customerName: feedbackData.customerName || "A customer",
        message: feedbackData.comment || "",
      });
    } catch (err) {
      console.error("Vendor feedback notification failed:", err);
    }

    return feedbackId;
  } catch (error) {
    console.error("Error submitting feedback:", error);
    throw error;
  }
}

/**
 * Get feedback by ID
 * @param {string} feedbackId
 * @returns {Promise<object|null>}
 */
export async function getFeedbackById(feedbackId) {
  try {
    const docRef = doc(db, "feedback", feedbackId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting feedback:", error);
    throw error;
  }
}

/**
 * Get feedback for a stall
 * @param {string} stallId
 * @param {object} options - { limitCount, lastDoc, publicOnly }
 * @returns {Promise<{feedback: array, lastDoc: doc}>}
 */
export async function getFeedbackByStall(stallId, options = {}) {
  try {
    const { limitCount = 10, lastDoc = null, publicOnly = true } = options;

    let q = query(
      collection(db, "feedback"),
      where("stallId", "==", stallId),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );

    if (publicOnly) {
      q = query(
        collection(db, "feedback"),
        where("stallId", "==", stallId),
        where("isPublic", "==", true),
        orderBy("createdAt", "desc"),
        limit(limitCount),
      );
    }

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const feedback = [];
    let newLastDoc = null;

    snapshot.forEach((doc) => {
      feedback.push({ id: doc.id, ...doc.data() });
      newLastDoc = doc;
    });

    return { feedback, lastDoc: newLastDoc };
  } catch (error) {
    console.error("Error getting stall feedback:", error);
    throw error;
  }
}

/**
 * Get feedback by customer
 * @param {string} customerId
 * @param {object} options - { limitCount, lastDoc }
 * @returns {Promise<{feedback: array, lastDoc: doc}>}
 */
export async function getFeedbackByCustomer(customerId, options = {}) {
  try {
    const { limitCount = 10, lastDoc = null } = options;

    let q = query(
      collection(db, "feedback"),
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const feedback = [];
    let newLastDoc = null;

    snapshot.forEach((doc) => {
      feedback.push({ id: doc.id, ...doc.data() });
      newLastDoc = doc;
    });

    return { feedback, lastDoc: newLastDoc };
  } catch (error) {
    console.error("Error getting customer feedback:", error);
    throw error;
  }
}

/**
 * Get feedback for an order
 * @param {string} orderId
 * @returns {Promise<object|null>}
 */
export async function getFeedbackByOrder(orderId) {
  try {
    const q = query(
      collection(db, "feedback"),
      where("orderId", "==", orderId),
      limit(1),
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("Error getting order feedback:", error);
    throw error;
  }
}

/**
 * Update feedback (customer can only update their own)
 * @param {string} feedbackId
 * @param {object} updates
 */
export async function updateFeedback(feedbackId, updates) {
  try {
    const allowedUpdates = [
      "comment",
      "tags",
      "isPublic",
      "contactRequested",
      "contactEmail",
      "contactPhone",
    ];
    const filteredUpdates = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    filteredUpdates.updatedAt = serverTimestamp();

    await updateDoc(doc(db, "feedback", feedbackId), filteredUpdates);
  } catch (error) {
    console.error("Error updating feedback:", error);
    throw error;
  }
}

/**
 * Add stall owner response to feedback
 * @param {string} feedbackId
 * @param {string} response
 */
export async function addStallResponse(feedbackId, response) {
  try {
    await updateDoc(doc(db, "feedback", feedbackId), {
      stallResponse: response,
      stallResponseDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding stall response:", error);
    throw error;
  }
}

/**
 * Delete feedback (only by customer who created it)
 * Note: This should also update the stall's rating/review count
 * @param {string} feedbackId
 */
export async function deleteFeedback(feedbackId) {
  try {
    // Get feedback first to get stallId and rating
    const feedbackDoc = await getDoc(doc(db, "feedback", feedbackId));

    if (!feedbackDoc.exists()) {
      throw new Error("Feedback not found");
    }

    const feedbackData = feedbackDoc.data();

    // Use transaction to update stall rating
    await runTransaction(db, async (transaction) => {
      const stallRef = doc(db, "foodStalls", feedbackData.stallId);
      const stallDoc = await transaction.get(stallRef);

      if (stallDoc.exists()) {
        const stallData = stallDoc.data();
        const currentRating = stallData.rating || 0;
        const currentReviews = stallData.totalReviews || 0;

        if (currentReviews > 1) {
          // Recalculate rating without this feedback
          const newTotalReviews = currentReviews - 1;
          const newRating =
            (currentRating * currentReviews - feedbackData.rating) /
            newTotalReviews;

          transaction.update(stallRef, {
            rating: Math.round(newRating * 10) / 10,
            totalReviews: newTotalReviews,
            updatedAt: serverTimestamp(),
          });
        } else {
          // This was the only review
          transaction.update(stallRef, {
            rating: 0,
            totalReviews: 0,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Delete the feedback
      transaction.delete(doc(db, "feedback", feedbackId));
    });
  } catch (error) {
    console.error("Error deleting feedback:", error);
    throw error;
  }
}

/**
 * Get feedback statistics for a stall
 * @param {string} stallId
 * @returns {Promise<object>} - { averageRating, totalReviews, ratingBreakdown }
 */
export async function getStallFeedbackStats(stallId) {
  try {
    const q = query(
      collection(db, "feedback"),
      where("stallId", "==", stallId),
    );

    const snapshot = await getDocs(q);

    const stats = {
      averageRating: 0,
      totalReviews: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      tagCounts: {},
    };

    let totalRating = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      stats.totalReviews++;
      totalRating += data.rating;
      stats.ratingBreakdown[data.rating]++;

      // Count tags
      if (data.tags && Array.isArray(data.tags)) {
        data.tags.forEach((tag) => {
          stats.tagCounts[tag] = (stats.tagCounts[tag] || 0) + 1;
        });
      }
    });

    if (stats.totalReviews > 0) {
      stats.averageRating =
        Math.round((totalRating / stats.totalReviews) * 10) / 10;
    }

    return stats;
  } catch (error) {
    console.error("Error getting feedback stats:", error);
    throw error;
  }
}

/**
 * Get order details for a feedback (for refund info)
 * @param {string} orderId - Order document ID
 * @returns {Promise<object|null>}
 */
export async function getOrderForFeedback(orderId) {
  if (!orderId) return null;

  try {
    const orderDoc = await getDoc(doc(db, "orders", orderId));
    if (!orderDoc.exists()) return null;

    return {
      id: orderDoc.id,
      ...orderDoc.data(),
    };
  } catch (error) {
    console.error("Error getting order for feedback:", error);
    throw error;
  }
}

/**
 * Resolve feedback with optional refund
 * Calls the resolveFeedback Cloud Function
 * @param {string} feedbackId - Feedback document ID
 * @param {string} response - Response message to customer
 * @param {string} refundType - "none" | "full" | "partial"
 * @param {number} refundAmount - Amount for partial refund (in dollars)
 * @returns {Promise<object>} - { success, refundStatus, refundAmount }
 */
export async function resolveFeedbackWithResponse(
  feedbackId,
  response,
  refundType = "none",
  refundAmount = 0,
) {
  try {
    const functions = getFunctions(app, "asia-southeast1");
    const resolveFn = httpsCallable(functions, "resolveFeedback");

    const result = await resolveFn({
      feedbackId,
      response,
      refundType,
      refundAmount,
    });

    return result.data;
  } catch (error) {
    console.error("Error resolving feedback:", error);
    throw error;
  }
}
