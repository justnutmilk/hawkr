/**
 * Resolve Feedback Cloud Function
 * Handles vendor/operator response to feedback, optional refund, and notifications
 */

const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { sendMessage } = require("./telegram");
const { createRefund } = require("./stripe");

/**
 * Verify user is authorized to resolve feedback for this stall
 * @param {object} db - Firestore instance
 * @param {string} userId - User ID
 * @param {string} stallId - Stall ID
 * @returns {Promise<{authorized: boolean, type: string|null}>}
 */
async function verifyResolutionAuth(db, userId, stallId) {
  // Check if user is vendor for this stall
  const vendorDoc = await db.collection("vendors").doc(userId).get();
  if (vendorDoc.exists) {
    const vendorData = vendorDoc.data();
    if (vendorData.stallId === stallId) {
      return { authorized: true, type: "vendor" };
    }
  }

  // Check if user is operator of hawker centre containing this stall
  const stallDoc = await db.collection("foodStalls").doc(stallId).get();
  if (stallDoc.exists) {
    const hawkerCentreId = stallDoc.data().hawkerCentreId;
    const operatorDoc = await db.collection("operators").doc(userId).get();
    if (
      operatorDoc.exists &&
      operatorDoc.data().hawkerCentreId === hawkerCentreId
    ) {
      return { authorized: true, type: "operator" };
    }
  }

  return { authorized: false, type: null };
}

/**
 * Process refund for an order
 * @param {object} db - Firestore instance
 * @param {string} orderId - Order ID
 * @param {string} refundType - "full" or "partial"
 * @param {number} partialAmount - Amount for partial refund (in dollars)
 * @returns {Promise<object>} Refund result
 */
async function processRefund(db, orderId, refundType, partialAmount) {
  const orderDoc = await db.collection("orders").doc(orderId).get();
  if (!orderDoc.exists) {
    throw new HttpsError("not-found", "Order not found");
  }

  const orderData = orderDoc.data();
  const paymentIntentId = orderData.paymentIntentId;

  if (!paymentIntentId) {
    throw new HttpsError(
      "failed-precondition",
      "No payment found for this order",
    );
  }

  // Calculate refund amount in cents
  const amount =
    refundType === "full"
      ? Math.round(orderData.total * 100)
      : Math.round(partialAmount * 100);

  // Call Stripe refund
  const refund = await createRefund(
    paymentIntentId,
    amount,
    "requested_by_customer",
  );

  // Update order with refund info
  await db
    .collection("orders")
    .doc(orderId)
    .update({
      refundStatus: refundType,
      refundAmount: amount / 100,
      refundId: refund.id,
      refundedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return {
    status: refund.status === "succeeded" ? "completed" : "processing",
    amount: amount / 100,
    currency: "sgd",
    paymentIntentId: paymentIntentId,
    refundId: refund.id,
    reason: "Feedback resolution refund",
  };
}

/**
 * Create in-app notification for customer
 * @param {object} db - Firestore instance
 * @param {object} feedbackData - Feedback document data
 * @param {string} feedbackId - Feedback document ID
 * @param {object} resolution - Resolution data
 */
async function createNotification(db, feedbackData, feedbackId, resolution) {
  const refundInfo = resolution.refund
    ? ` A refund of $${resolution.refund.amount.toFixed(2)} has been processed.`
    : "";

  const responsePreview =
    resolution.response.length > 100
      ? `${resolution.response.substring(0, 100)}...`
      : resolution.response;

  await db
    .collection("customers")
    .doc(feedbackData.customerId)
    .collection("notifications")
    .add({
      type: resolution.refund ? "refund_processed" : "feedback_resolved",
      title: `${feedbackData.stallName} responded to your feedback`,
      message: `"${responsePreview}"${refundInfo}`,
      feedbackId: feedbackId,
      stallId: feedbackData.stallId,
      stallName: feedbackData.stallName,
      orderId: feedbackData.orderId || null,
      refundAmount: resolution.refund?.amount || null,
      refundStatus: resolution.refund?.status || null,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

/**
 * Send Telegram notification to customer
 * @param {object} db - Firestore instance
 * @param {object} feedbackData - Feedback document data
 * @param {object} resolution - Resolution data
 * @returns {Promise<boolean>} Whether notification was sent
 */
async function sendTelegramNotification(db, feedbackData, resolution) {
  // Get customer's Telegram chat ID
  const customerDoc = await db
    .collection("customers")
    .doc(feedbackData.customerId)
    .get();
  if (!customerDoc.exists) return false;

  const telegramChatId = customerDoc.data().telegramChatId;
  if (!telegramChatId) return false;

  // Escape special characters for MarkdownV2
  const escapeMarkdown = (text) => {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
  };

  const stallName = escapeMarkdown(feedbackData.stallName || "The stall");
  const responseText = escapeMarkdown(resolution.response);

  let refundText = "";
  if (resolution.refund) {
    refundText = `\n\n*Refund:* S\\$${resolution.refund.amount.toFixed(2)} \\(${resolution.refund.status}\\)`;
  }

  const message =
    `*Feedback Response* from *${stallName}*\n\n` +
    `"${responseText}"` +
    refundText +
    `\n\nThank you for your feedback\\!`;

  try {
    await sendMessage(telegramChatId, message, { parse_mode: "MarkdownV2" });
    return true;
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
    return false;
  }
}

/**
 * Main resolve feedback function
 * @param {object} request - Cloud Function request
 * @returns {Promise<object>} Resolution result
 */
async function resolveFeedback(request) {
  const {
    feedbackId,
    response,
    refundType = "none", // "none" | "full" | "partial"
    refundAmount = 0, // For partial refunds
  } = request.data;

  const auth = request.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!feedbackId || !response) {
    throw new HttpsError(
      "invalid-argument",
      "Feedback ID and response are required",
    );
  }

  if (response.length > 1000) {
    throw new HttpsError(
      "invalid-argument",
      "Response must be 1000 characters or less",
    );
  }

  const db = admin.firestore();

  // 1. Get feedback document
  const feedbackRef = db.collection("feedback").doc(feedbackId);
  const feedbackDoc = await feedbackRef.get();

  if (!feedbackDoc.exists) {
    throw new HttpsError("not-found", "Feedback not found");
  }

  const feedbackData = feedbackDoc.data();

  // Check if already resolved
  if (feedbackData.resolution) {
    throw new HttpsError(
      "already-exists",
      "This feedback has already been resolved",
    );
  }

  // 2. Verify authorization
  const authResult = await verifyResolutionAuth(
    db,
    auth.uid,
    feedbackData.stallId,
  );

  if (!authResult.authorized) {
    throw new HttpsError(
      "permission-denied",
      "Not authorized to resolve this feedback",
    );
  }

  // Operators cannot initiate refunds
  if (authResult.type === "operator" && refundType !== "none") {
    throw new HttpsError(
      "permission-denied",
      "Operators cannot initiate refunds",
    );
  }

  // 3. Process refund if requested
  let refundResult = null;
  if (refundType !== "none" && feedbackData.orderId) {
    // Validate partial refund amount
    if (refundType === "partial") {
      if (!refundAmount || refundAmount <= 0) {
        throw new HttpsError(
          "invalid-argument",
          "Partial refund amount must be greater than 0",
        );
      }
      // Get order to validate amount
      const orderDoc = await db
        .collection("orders")
        .doc(feedbackData.orderId)
        .get();
      if (orderDoc.exists && refundAmount > orderDoc.data().total) {
        throw new HttpsError(
          "invalid-argument",
          "Refund amount cannot exceed order total",
        );
      }
    }

    refundResult = await processRefund(
      db,
      feedbackData.orderId,
      refundType,
      refundAmount,
    );
  }

  // 4. Build resolution object
  const resolution = {
    type:
      refundType === "none"
        ? "response_only"
        : refundType === "full"
          ? "full_refund"
          : "partial_refund",
    response: response,
    resolvedBy: auth.uid,
    resolvedByType: authResult.type,
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    refund: refundResult,
  };

  // 5. Update feedback document
  await feedbackRef.update({
    stallResponse: response,
    stallResponseDate: admin.firestore.FieldValue.serverTimestamp(),
    resolution: resolution,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 6. Create in-app notification
  await createNotification(db, feedbackData, feedbackId, resolution);

  // 7. Send Telegram notification
  const telegramSent = await sendTelegramNotification(
    db,
    feedbackData,
    resolution,
  );

  // 8. Create vendor notification confirming resolution
  try {
    const resolverName =
      authResult.type === "operator" ? "your operator" : "you";
    const orderNumber = feedbackData.orderId
      ? (await db.collection("orders").doc(feedbackData.orderId).get()).data()
          ?.orderNumber || feedbackData.orderId.slice(-4).toUpperCase()
      : "N/A";

    let vendorMessage = `Feedback for order #${orderNumber} has been resolved by ${resolverName}.`;
    if (resolution.refund) {
      vendorMessage += ` Refund of S$${resolution.refund.amount.toFixed(2)} processed.`;
    }
    if (authResult.type === "operator") {
      vendorMessage +=
        " Organisations do not have permissions to initiate refunds on your behalf.";
    }

    // Find the vendor for this stall
    const vendorStallDoc = await db
      .collection("foodStalls")
      .doc(feedbackData.stallId)
      .get();
    const feedbackVendorId = vendorStallDoc.exists
      ? vendorStallDoc.data().vendorId
      : null;

    if (feedbackVendorId) {
      await db
        .collection("vendors")
        .doc(feedbackVendorId)
        .collection("notifications")
        .add({
          type: "feedback_resolved",
          title: "Feedback Resolved",
          message: vendorMessage,
          feedbackId: feedbackId,
          orderId: feedbackData.orderId || null,
          stallId: feedbackData.stallId,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
  } catch (vendorNotifErr) {
    console.error(
      "Error creating vendor feedback resolution notification:",
      vendorNotifErr,
    );
  }

  // 9. Update notification tracking
  await feedbackRef.update({
    notificationSent: {
      inApp: true,
      telegram: telegramSent,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  });

  return {
    success: true,
    refundStatus: refundResult?.status || null,
    refundAmount: refundResult?.amount || null,
  };
}

module.exports = {
  resolveFeedback,
  verifyResolutionAuth,
  processRefund,
  createNotification,
  sendTelegramNotification,
};
