/**
 * Hawkr Firebase Cloud Functions
 *
 * Functions for order notifications via Telegram
 *
 * Setup:
 * 1. Create a Telegram bot via @BotFather
 * 2. Create .env file with TELEGRAM_BOT_TOKEN
 * 3. Deploy: firebase deploy --only functions
 * 4. Set webhook: Call the setupTelegramWebhook endpoint
 */

const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");
const {
  onRequest,
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");
// Set all functions to Singapore region
setGlobalOptions({ region: "asia-southeast1" });

// Initialize Firebase Admin
admin.initializeApp();

// Import Telegram helpers
const {
  sendMessage,
  setWebhook,
  deleteWebhook,
  getMe,
} = require("./src/telegram");
const { getOrderStatusMessage } = require("./src/notifications");

// Import Stripe helpers
const {
  getOrCreateStripeCustomer,
  createSetupIntent,
  createPaymentIntent,
  getPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
  confirmPaymentIntent,
  getPaymentIntentStatus,
  createRefund,
} = require("./src/stripe");

// Import feedback resolution helper
const { resolveFeedback } = require("./src/resolveFeedback");

// ============================================
// ORDER NOTIFICATION (callable)
// ============================================

/**
 * Send order notification to customer via Telegram and in-app
 * Called by client after order creation or status change
 */
exports.sendOrderNotification = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { orderId, status } = request.data;

  if (!orderId || !status) {
    throw new HttpsError(
      "invalid-argument",
      "Order ID and status are required",
    );
  }

  // Only allow notifications for confirmed and ready
  const allowedStatuses = ["confirmed", "ready"];
  if (!allowedStatuses.includes(status)) {
    return { success: false, reason: `Status ${status} not notifiable` };
  }

  try {
    // Get order data
    const orderDoc = await admin
      .firestore()
      .collection("orders")
      .doc(orderId)
      .get();

    if (!orderDoc.exists) {
      throw new HttpsError("not-found", "Order not found");
    }

    const orderData = { id: orderId, ...orderDoc.data() };
    const customerId = orderData.customerId;

    if (!customerId) {
      return { success: false, reason: "No customer ID on order" };
    }

    // Get customer data
    const customerDoc = await admin
      .firestore()
      .collection("customers")
      .doc(customerId)
      .get();

    if (!customerDoc.exists) {
      return { success: false, reason: "Customer not found" };
    }

    const customerData = customerDoc.data();
    const telegramChatId = customerData.telegramChatId;

    // Get notification content
    const notificationContent = getOrderStatusMessage(status, orderData);

    if (!notificationContent) {
      return { success: false, reason: `No template for status: ${status}` };
    }

    // Create in-app notification
    await admin
      .firestore()
      .collection("customers")
      .doc(customerId)
      .collection("notifications")
      .add({
        type: "order_status",
        title: notificationContent.title,
        message: notificationContent.message
          .replace(/\\/g, "")
          .replace(/\*/g, ""),
        orderId: orderId,
        status: status,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Send Telegram if linked
    if (telegramChatId) {
      const result = await sendMessage(
        telegramChatId,
        notificationContent.message,
        { parse_mode: "MarkdownV2" },
      );
      console.log(
        `Order ${orderId}: Telegram sent to ${telegramChatId}`,
        result.ok ? "OK" : result,
      );
      return { success: true, telegram: true };
    }

    console.log(`Order ${orderId}: No Telegram for customer ${customerId}`);
    return { success: true, telegram: false };
  } catch (error) {
    console.error(`sendOrderNotification error:`, error);
    throw new HttpsError("internal", error.message);
  }
});

// ============================================
// HTTP ENDPOINTS
// ============================================

/**
 * Webhook endpoint for Telegram Bot API
 * Handles incoming messages and commands
 */
exports.telegramWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const update = req.body;

  try {
    if (update.message) {
      await handleTelegramMessage(update.message);
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error handling Telegram update:", error);
    res.status(200).send("OK");
  }
});

/**
 * Handle incoming Telegram message
 */
async function handleTelegramMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || "";
  const command = text.split(" ")[0].toLowerCase();

  switch (command) {
    case "/start":
      await sendMessage(
        chatId,
        "Welcome to Hawkr\\! 🦅\n\nLink your account in the Hawkr app to receive order notifications here\\.\n\nCommands:\n/status \\- Check active orders\n/help \\- Show help",
        { parse_mode: "MarkdownV2" },
      );
      break;

    case "/status":
      await handleStatusCommand(chatId);
      break;

    case "/unlink":
      await handleUnlinkCommand(chatId);
      break;

    case "/help":
      await sendMessage(
        chatId,
        "Hawkr Bot Commands:\n\n/status \\- View your active orders\n/unlink \\- Disconnect Telegram from your Hawkr account\n/help \\- Show this message",
        { parse_mode: "MarkdownV2" },
      );
      break;

    default:
      if (text.startsWith("/")) {
        await sendMessage(
          chatId,
          "Unknown command\\. Use /help for available commands\\.",
          {
            parse_mode: "MarkdownV2",
          },
        );
      }
      break;
  }
}

/**
 * Handle /status command
 */
async function handleStatusCommand(chatId) {
  try {
    const customersSnapshot = await admin
      .firestore()
      .collection("customers")
      .where("telegramChatId", "==", chatId.toString())
      .limit(1)
      .get();

    if (customersSnapshot.empty) {
      await sendMessage(
        chatId,
        "Your Telegram is not linked to a Hawkr account\\. Link it in the Hawkr app under Settings\\.",
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    const customerId = customersSnapshot.docs[0].id;
    const activeStatuses = ["pending", "confirmed", "preparing", "ready"];

    const ordersSnapshot = await admin
      .firestore()
      .collection("orders")
      .where("customerId", "==", customerId)
      .where("status", "in", activeStatuses)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    if (ordersSnapshot.empty) {
      await sendMessage(chatId, "You have no active orders\\.", {
        parse_mode: "MarkdownV2",
      });
      return;
    }

    let message = "Your active orders:\n\n";
    ordersSnapshot.docs.forEach((doc) => {
      const order = doc.data();
      const shortId = doc.id.slice(-4);
      message += `Order \\#${shortId}: ${order.status}\n`;
    });

    await sendMessage(chatId, message, { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.error("Error handling status command:", error);
    await sendMessage(chatId, "Error fetching orders\\. Please try again\\.", {
      parse_mode: "MarkdownV2",
    });
  }
}

/**
 * Handle /unlink command
 */
async function handleUnlinkCommand(chatId) {
  try {
    const customersSnapshot = await admin
      .firestore()
      .collection("customers")
      .where("telegramChatId", "==", chatId.toString())
      .limit(1)
      .get();

    if (customersSnapshot.empty) {
      await sendMessage(
        chatId,
        "Your Telegram is not linked to any Hawkr account\\.",
        {
          parse_mode: "MarkdownV2",
        },
      );
      return;
    }

    await customersSnapshot.docs[0].ref.update({
      telegramChatId: null,
      telegramLinked: false,
    });

    await sendMessage(
      chatId,
      "Your Telegram has been unlinked from your Hawkr account\\. You will no longer receive notifications here\\.",
      { parse_mode: "MarkdownV2" },
    );
  } catch (error) {
    console.error("Error handling unlink command:", error);
    await sendMessage(
      chatId,
      "Error unlinking account\\. Please try again\\.",
      {
        parse_mode: "MarkdownV2",
      },
    );
  }
}

/**
 * Setup webhook for Telegram bot
 */
exports.setupTelegramWebhook = onRequest(async (req, res) => {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const region = "asia-southeast1";
  const webhookUrl = `https://${region}-${projectId}.cloudfunctions.net/telegramWebhook`;

  console.log(`Setting up Telegram webhook: ${webhookUrl}`);

  const result = await setWebhook(webhookUrl);

  if (result.ok) {
    res.json({ success: true, message: "Webhook configured", webhookUrl });
  } else {
    res
      .status(500)
      .json({ success: false, error: result.error || "Failed to set webhook" });
  }
});

/**
 * Remove webhook from Telegram bot
 */
exports.removeTelegramWebhook = onRequest(async (req, res) => {
  const result = await deleteWebhook();

  if (result.ok) {
    res.json({ success: true, message: "Webhook removed" });
  } else {
    res.status(500).json({
      success: false,
      error: result.error || "Failed to remove webhook",
    });
  }
});

/**
 * Get bot info (for testing)
 */
exports.telegramBotInfo = onRequest(async (req, res) => {
  const result = await getMe();

  if (result.ok) {
    res.json({ success: true, bot: result.result });
  } else {
    res.status(500).json({
      success: false,
      error: result.error || "Failed to get bot info",
    });
  }
});

/**
 * Generate a link token for a customer
 */
exports.generateTelegramLinkToken = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const userId = request.auth.uid;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  await admin.firestore().collection("customers").doc(userId).update({
    telegramLinkToken: token,
    telegramLinkTokenCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { token, expiresIn: 600 };
});

// ============================================
// FEEDBACK RESOLUTION
// ============================================

/**
 * Resolve feedback with optional refund
 * Called by vendors/operators to respond to customer feedback
 */
exports.resolveFeedback = onCall(async (request) => {
  return await resolveFeedback(request);
});

// ============================================
// STRIPE PAYMENT FUNCTIONS
// ============================================

/**
 * Create a SetupIntent for saving a new payment method
 * Returns client secret for Stripe Elements
 */
exports.createSetupIntent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const userId = request.auth.uid;

  try {
    // Get user info
    const userDoc = await admin
      .firestore()
      .collection("customers")
      .doc(userId)
      .get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Customer not found");
    }

    const userData = userDoc.data();
    const email = request.auth.token.email || userData.email;
    const name = userData.name || "Hawkr Customer";

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(
      admin,
      userId,
      email,
      name,
    );

    // Create SetupIntent
    const setupIntent = await createSetupIntent(stripeCustomerId);

    return {
      clientSecret: setupIntent.clientSecret,
      customerId: stripeCustomerId,
    };
  } catch (error) {
    console.error("Error creating SetupIntent:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Get saved payment methods for the current user
 */
exports.getPaymentMethods = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const userId = request.auth.uid;

  try {
    const userDoc = await admin
      .firestore()
      .collection("customers")
      .doc(userId)
      .get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Customer not found");
    }

    const userData = userDoc.data();
    const stripeCustomerId = userData.stripeCustomerId;

    if (!stripeCustomerId) {
      return { paymentMethods: [] };
    }

    const paymentMethods = await getPaymentMethods(stripeCustomerId);

    return { paymentMethods };
  } catch (error) {
    console.error("Error getting payment methods:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Delete a saved payment method
 */
exports.deletePaymentMethod = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { paymentMethodId } = request.data;

  if (!paymentMethodId) {
    throw new HttpsError("invalid-argument", "Payment method ID required");
  }

  try {
    await deletePaymentMethod(paymentMethodId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting payment method:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Set a payment method as default
 */
exports.setDefaultPaymentMethod = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const userId = request.auth.uid;
  const { paymentMethodId } = request.data;

  if (!paymentMethodId) {
    throw new HttpsError("invalid-argument", "Payment method ID required");
  }

  try {
    const userDoc = await admin
      .firestore()
      .collection("customers")
      .doc(userId)
      .get();

    const userData = userDoc.data();
    const stripeCustomerId = userData.stripeCustomerId;

    if (!stripeCustomerId) {
      throw new HttpsError("failed-precondition", "No Stripe customer found");
    }

    await setDefaultPaymentMethod(stripeCustomerId, paymentMethodId);

    return { success: true };
  } catch (error) {
    console.error("Error setting default payment method:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Create a PaymentIntent for processing an order
 */
exports.createPaymentIntent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const userId = request.auth.uid;
  const { amount, paymentMethodId, orderId } = request.data;

  if (!amount || amount <= 0) {
    throw new HttpsError("invalid-argument", "Valid amount required");
  }

  try {
    const userDoc = await admin
      .firestore()
      .collection("customers")
      .doc(userId)
      .get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Customer not found");
    }

    const userData = userDoc.data();
    const email = request.auth.token.email || userData.email;
    const name = userData.name || "Hawkr Customer";

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(
      admin,
      userId,
      email,
      name,
    );

    // Convert amount to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    // Create PaymentIntent
    const paymentIntent = await createPaymentIntent(
      amountInCents,
      "sgd",
      stripeCustomerId,
      paymentMethodId,
      {
        orderId: orderId || "",
        userId: userId,
      },
    );

    return {
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.paymentIntentId,
      status: paymentIntent.status,
    };
  } catch (error) {
    console.error("Error creating PaymentIntent:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Confirm a PaymentIntent with a specific payment method
 */
exports.confirmPayment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { paymentIntentId, paymentMethodId } = request.data;

  if (!paymentIntentId || !paymentMethodId) {
    throw new HttpsError(
      "invalid-argument",
      "Payment intent ID and payment method ID required",
    );
  }

  try {
    const result = await confirmPaymentIntent(paymentIntentId, paymentMethodId);
    return result;
  } catch (error) {
    console.error("Error confirming payment:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Get payment status
 */
exports.getPaymentStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { paymentIntentId } = request.data;

  if (!paymentIntentId) {
    throw new HttpsError("invalid-argument", "Payment intent ID required");
  }

  try {
    const status = await getPaymentIntentStatus(paymentIntentId);
    return status;
  } catch (error) {
    console.error("Error getting payment status:", error);
    throw new HttpsError("internal", error.message);
  }
});

// ============================================
// REFUND FUNCTIONS
// ============================================

/**
 * Initiate a refund for an order from the vendor payments page
 * Supports full and partial refunds
 */
exports.initiateRefund = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const userId = request.auth.uid;
  const {
    orderId,
    refundType = "full", // "full" | "partial"
    refundAmount = 0, // For partial refunds, in dollars
    reason = "",
  } = request.data;

  if (!orderId) {
    throw new HttpsError("invalid-argument", "Order ID is required");
  }

  const db = admin.firestore();

  // 1. Get the order
  const orderDoc = await db.collection("orders").doc(orderId).get();
  if (!orderDoc.exists) {
    throw new HttpsError("not-found", "Order not found");
  }

  const orderData = orderDoc.data();

  // 2. Verify the vendor owns this stall
  const vendorDoc = await db.collection("vendors").doc(userId).get();
  if (!vendorDoc.exists) {
    throw new HttpsError("permission-denied", "Vendor profile not found");
  }

  const vendorData = vendorDoc.data();
  if (vendorData.stallId !== orderData.stallId) {
    throw new HttpsError(
      "permission-denied",
      "Not authorized to refund this order",
    );
  }

  // 3. Check order has a payment intent
  const paymentIntentId = orderData.paymentIntentId;
  if (!paymentIntentId) {
    throw new HttpsError(
      "failed-precondition",
      "No payment found for this order (cash orders cannot be refunded via Stripe)",
    );
  }

  // 4. Check not already refunded
  if (orderData.refundStatus === "full") {
    throw new HttpsError(
      "already-exists",
      "This order has already been fully refunded",
    );
  }

  // 5. Calculate refund amount in cents
  let amountInCents;
  if (refundType === "full") {
    amountInCents = Math.round(orderData.total * 100);
  } else {
    if (!refundAmount || refundAmount <= 0) {
      throw new HttpsError(
        "invalid-argument",
        "Partial refund amount must be greater than 0",
      );
    }
    if (refundAmount > orderData.total) {
      throw new HttpsError(
        "invalid-argument",
        "Refund amount cannot exceed order total",
      );
    }
    amountInCents = Math.round(refundAmount * 100);
  }

  // 6. Create Stripe refund
  const refund = await createRefund(
    paymentIntentId,
    amountInCents,
    "requested_by_customer",
  );

  // 7. Generate refund transaction ID
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let refundTxnChars = "";
  for (let i = 0; i < 10; i++) {
    refundTxnChars += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const refundTransactionId = `b2c-${refundTxnChars}-REFUND`;

  // 8. Update order with refund info
  await db
    .collection("orders")
    .doc(orderId)
    .update({
      paymentStatus: "refunded",
      refundStatus: refundType,
      refundAmount: amountInCents / 100,
      refundId: refund.id,
      refundTransactionId: refundTransactionId,
      refundReason: reason,
      refundedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // 9. Create in-app notification for customer
  const customerName = orderData.customerName || "Customer";
  const refundAmountDisplay = (amountInCents / 100).toFixed(2);

  await db
    .collection("customers")
    .doc(orderData.customerId)
    .collection("notifications")
    .add({
      type: "refund_processed",
      title: `Refund of S$${refundAmountDisplay} processed`,
      message: `Your ${refundType} refund of S$${refundAmountDisplay} for order #${orderData.orderNumber} from ${orderData.stallName} has been processed.${reason ? ` Reason: "${reason}"` : ""}`,
      orderId: orderId,
      stallId: orderData.stallId,
      stallName: orderData.stallName,
      refundAmount: amountInCents / 100,
      refundTransactionId: refundTransactionId,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // 10. Create vendor notification for the refund
  try {
    const stallDoc = await db
      .collection("foodStalls")
      .doc(orderData.stallId)
      .get();
    const refundVendorId = stallDoc.exists ? stallDoc.data().ownerId : null;

    if (refundVendorId) {
      await db
        .collection("vendors")
        .doc(refundVendorId)
        .collection("notifications")
        .add({
          type: "refund_processed",
          title: `Refund of S$${refundAmountDisplay} processed`,
          message: `A ${refundType} refund of S$${refundAmountDisplay} for order #${orderData.orderNumber} has been processed. Secure your account now if this isn't you.`,
          orderId: orderId,
          stallId: orderData.stallId,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Send Telegram to vendor if linked
      const refundVendorDoc = await db
        .collection("vendors")
        .doc(refundVendorId)
        .get();
      if (refundVendorDoc.exists) {
        const vendorTgChatId = refundVendorDoc.data().telegramChatId;
        if (vendorTgChatId) {
          const escMd = (text) =>
            text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
          const vendorTgMsg =
            `*Refund Processed*\n\n` +
            `A ${escMd(refundType === "full" ? "full" : "partial")} refund of S\\$${escMd(refundAmountDisplay)} for order \\#${escMd(String(orderData.orderNumber))} has been processed\\.\n\n` +
            `Secure your account now if this isn't you\\.`;
          await sendMessage(vendorTgChatId, vendorTgMsg, {
            parse_mode: "MarkdownV2",
          });
        }
      }
    }
  } catch (vendorNotifError) {
    console.error(
      "Error sending vendor refund notification:",
      vendorNotifError,
    );
  }

  // 11. Send Telegram notification to customer if linked
  try {
    const customerDoc = await db
      .collection("customers")
      .doc(orderData.customerId)
      .get();
    if (customerDoc.exists) {
      const telegramChatId = customerDoc.data().telegramChatId;
      if (telegramChatId) {
        const escapeMarkdown = (text) =>
          text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
        const escapedAmount = escapeMarkdown(refundAmountDisplay);
        const message =
          `*Refund Processed* from *${escapeMarkdown(orderData.stallName || "Hawkr")}*\n\n` +
          `Amount: S\\$${escapedAmount}\n` +
          `Type: ${escapeMarkdown(refundType === "full" ? "Full Refund" : "Partial Refund")}\n` +
          `Transaction: \`${refundTransactionId}\`` +
          (reason ? `\nReason: "${escapeMarkdown(reason)}"` : "");

        await sendMessage(telegramChatId, message, {
          parse_mode: "MarkdownV2",
        });
      }
    }
  } catch (telegramError) {
    console.error("Error sending Telegram refund notification:", telegramError);
    // Don't fail the refund if Telegram notification fails
  }

  return {
    success: true,
    refundId: refund.id,
    refundStatus: refund.status === "succeeded" ? "completed" : "processing",
    refundAmount: amountInCents / 100,
    refundTransactionId: refundTransactionId,
  };
});

// ============================================
// VENDOR NEW ORDER NOTIFICATION (callable)
// ============================================

/**
 * Notify vendor of a new order via in-app notification and Telegram.
 * Called by client after order is created with confirmed status.
 */
exports.notifyVendorNewOrder = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { orderId } = request.data;
  if (!orderId) {
    throw new HttpsError("invalid-argument", "Order ID is required");
  }

  const db = admin.firestore();

  try {
    // Get order data
    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
      throw new HttpsError("not-found", "Order not found");
    }
    const orderData = orderDoc.data();

    // Get stall to find vendor
    const stallDoc = await db
      .collection("foodStalls")
      .doc(orderData.stallId)
      .get();
    if (!stallDoc.exists) {
      return { success: false, reason: "Stall not found" };
    }
    const vendorId = stallDoc.data().ownerId;
    if (!vendorId) {
      return { success: false, reason: "No vendor linked to stall" };
    }

    // Build item summary
    const items = orderData.items || [];
    const itemSummary = items
      .map((item) => {
        let line = `${item.quantity}x ${item.name}`;
        if (item.selectedVariants && item.selectedVariants.length > 0) {
          const variants = item.selectedVariants
            .map((v) => v.option || v.name || v)
            .join(", ");
          line += ` (${variants})`;
        }
        return line;
      })
      .join(", ");

    const specialRequest =
      items
        .filter((i) => i.specialRequest)
        .map((i) => i.specialRequest)
        .join("; ") || "";

    const total = (orderData.total || 0).toFixed(2);
    const paymentMethod = orderData.paymentMethod || "Unknown";
    const orderNumber =
      orderData.orderNumber || orderId.slice(-4).toUpperCase();

    const now = new Date();
    const datetimeSGT = now.toLocaleString("en-SG", {
      timeZone: "Asia/Singapore",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Build message
    let message = `${orderData.customerName || "Customer"} — ${itemSummary}.`;
    if (specialRequest) {
      message += ` Special request: ${specialRequest}.`;
    }
    message += ` Total: S$${total}. Payment: ${paymentMethod}. ${datetimeSGT}.`;

    // Create in-app notification for vendor
    await db
      .collection("vendors")
      .doc(vendorId)
      .collection("notifications")
      .add({
        type: "new_order",
        title: `New Order #${orderNumber}`,
        message: message,
        orderId: orderId,
        stallId: orderData.stallId,
        customerName: orderData.customerName || "Customer",
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Send Telegram to vendor if linked
    const vendorDoc = await db.collection("vendors").doc(vendorId).get();
    if (vendorDoc.exists) {
      const vendorTelegramChatId = vendorDoc.data().telegramChatId;
      if (vendorTelegramChatId) {
        const escapeMarkdown = (text) =>
          text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");

        const tgItems = items
          .map((item) => {
            let line = `${item.quantity}x ${escapeMarkdown(item.name)}`;
            if (item.selectedVariants && item.selectedVariants.length > 0) {
              const variants = item.selectedVariants
                .map((v) => escapeMarkdown(v.option || v.name || String(v)))
                .join(", ");
              line += ` \\(${variants}\\)`;
            }
            return line;
          })
          .join("\n");

        let tgMessage =
          `*New Order \\#${escapeMarkdown(String(orderNumber))}*\n\n` +
          `${tgItems}\n\n`;

        if (specialRequest) {
          tgMessage += `*Special Request:* ${escapeMarkdown(specialRequest)}\n`;
        }

        tgMessage +=
          `*Total:* S\\$${escapeMarkdown(total)}\n` +
          `*Payment:* ${escapeMarkdown(paymentMethod)}\n` +
          `*Time:* ${escapeMarkdown(datetimeSGT)}`;

        try {
          await sendMessage(vendorTelegramChatId, tgMessage, {
            parse_mode: "MarkdownV2",
          });
        } catch (tgErr) {
          console.error("Vendor Telegram notification failed:", tgErr);
        }

        return { success: true, telegram: true };
      }
    }

    return { success: true, telegram: false };
  } catch (error) {
    console.error("notifyVendorNewOrder error:", error);
    throw new HttpsError("internal", error.message);
  }
});

// ============================================
// CARD EVENT NOTIFICATION (callable)
// ============================================

/**
 * Notify customer when a card is added or removed.
 * Creates in-app notification and sends Telegram.
 */
exports.notifyCardEvent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { eventType, cardBrand, cardLast4 } = request.data;
  if (!eventType || !["card_added", "card_removed"].includes(eventType)) {
    throw new HttpsError("invalid-argument", "Valid eventType required");
  }

  const userId = request.auth.uid;
  const db = admin.firestore();

  const now = new Date();
  const datetimeSGT = now.toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const brand = cardBrand || "Card";
  const last4 = cardLast4 || "****";
  const action = eventType === "card_added" ? "added" : "removed";
  const title = eventType === "card_added" ? "Card Added" : "Card Removed";
  const message = `${brand} card ending ${last4} has been ${action} at ${datetimeSGT}.`;

  // Create in-app notification
  await db.collection("customers").doc(userId).collection("notifications").add({
    type: eventType,
    title: title,
    message: message,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Send Telegram if linked
  try {
    const customerDoc = await db.collection("customers").doc(userId).get();
    if (customerDoc.exists) {
      const telegramChatId = customerDoc.data().telegramChatId;
      if (telegramChatId) {
        const escapeMarkdown = (text) =>
          text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");

        const tgMessage = `*${escapeMarkdown(title)}*\n\n${escapeMarkdown(message)}`;

        await sendMessage(telegramChatId, tgMessage, {
          parse_mode: "MarkdownV2",
        });
        return { success: true, telegram: true };
      }
    }
  } catch (tgErr) {
    console.error("Card event Telegram notification failed:", tgErr);
  }

  return { success: true, telegram: false };
});

// ============================================
// VENDOR TENANCY NOTIFICATION (callable)
// ============================================

/**
 * Notify vendor when they are linked/unlinked from an operator.
 * Optionally also notify the operator (e.g. when vendor disconnects).
 * Called from operator children, operator children detail, and vendor tenancy pages.
 */
exports.notifyVendorTenancy = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { vendorId, action, centreName, operatorId, vendorName } = request.data;
  if (!vendorId || !action) {
    throw new HttpsError(
      "invalid-argument",
      "vendorId and action are required",
    );
  }

  const db = admin.firestore();

  const isLink = action === "linked";
  const vendorTitle = isLink
    ? `Linked to ${centreName || "a hawker centre"}`
    : `Unlinked from ${centreName || "a hawker centre"}`;
  const vendorMessage = isLink
    ? `Your stall has been linked to ${centreName || "a hawker centre"}. You are now managed by this operator. They have access to your stall's details and data.`
    : `Your stall has been unlinked from ${centreName || "a hawker centre"}. You are no longer managed by this operator. They no longer have access to your stall's details and data.`;

  try {
    // In-app notification for vendor
    await db
      .collection("vendors")
      .doc(vendorId)
      .collection("notifications")
      .add({
        type: isLink ? "operator_linked" : "operator_unlinked",
        title: vendorTitle,
        message: vendorMessage,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Telegram notification for vendor
    const vendorDoc = await db.collection("vendors").doc(vendorId).get();
    if (vendorDoc.exists) {
      const chatId = vendorDoc.data().telegramChatId;
      if (chatId) {
        const escapeMarkdown = (text) =>
          text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");

        const tgMessage = `*${escapeMarkdown(vendorTitle)}*\n\n${escapeMarkdown(vendorMessage)}`;
        await sendMessage(chatId, tgMessage, { parse_mode: "MarkdownV2" });
      }
    }

    // Notify operator if operatorId is provided (e.g. vendor-initiated disconnect)
    if (operatorId) {
      const stallName =
        vendorName ||
        (vendorDoc.exists ? vendorDoc.data().storeName : "") ||
        "A vendor";
      const opTitle = isLink
        ? `${stallName} linked`
        : `${stallName} disconnected`;
      const opMessage = isLink
        ? `${stallName} has been linked to your hawker centre.`
        : `${stallName} has disconnected from your hawker centre.`;

      await db
        .collection("operators")
        .doc(operatorId)
        .collection("notifications")
        .add({
          type: isLink ? "vendor_linked" : "vendor_unlinked",
          title: opTitle,
          message: opMessage,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    return { success: true };
  } catch (error) {
    console.error("notifyVendorTenancy error:", error);
    throw new HttpsError("internal", error.message);
  }
});

// ============================================
// VENDOR FEEDBACK NOTIFICATION (callable)
// ============================================

/**
 * Notify vendor when a customer submits feedback for their stall.
 */
exports.notifyVendorFeedback = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { feedbackId, stallId, customerName, message } = request.data;
  if (!feedbackId || !stallId) {
    throw new HttpsError(
      "invalid-argument",
      "feedbackId and stallId are required",
    );
  }

  const db = admin.firestore();

  try {
    // Get stall to find vendor
    const stallDoc = await db.collection("foodStalls").doc(stallId).get();
    if (!stallDoc.exists) {
      return { success: false, reason: "Stall not found" };
    }
    const vendorId = stallDoc.data().ownerId;
    if (!vendorId) {
      return { success: false, reason: "No vendor linked to stall" };
    }

    const name = customerName || "A customer";
    const preview = message
      ? message.length > 100
        ? `${message.substring(0, 100)}...`
        : message
      : "No comment provided";

    // Create in-app notification
    await db
      .collection("vendors")
      .doc(vendorId)
      .collection("notifications")
      .add({
        type: "customer_feedback",
        title: "New Feedback Received",
        message: `${name} left feedback: "${preview}"`,
        feedbackId: feedbackId,
        stallId: stallId,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return { success: true };
  } catch (error) {
    console.error("notifyVendorFeedback error:", error);
    throw new HttpsError("internal", error.message);
  }
});

// ============================================
// STRIPE WEBHOOK
// ============================================

/**
 * Stripe webhook handler for payment events
 */
exports.stripeWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const { stripe } = require("./src/stripe");
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      console.log(`PaymentIntent ${paymentIntent.id} succeeded`);

      // Update order status if orderId in metadata
      if (paymentIntent.metadata?.orderId) {
        await admin
          .firestore()
          .collection("orders")
          .doc(paymentIntent.metadata.orderId)
          .update({
            status: "confirmed",
            paymentStatus: "paid",
            paymentIntentId: paymentIntent.id,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      }
      break;

    case "payment_intent.payment_failed":
      const failedPayment = event.data.object;
      console.log(`PaymentIntent ${failedPayment.id} failed`);

      if (failedPayment.metadata?.orderId) {
        await admin
          .firestore()
          .collection("orders")
          .doc(failedPayment.metadata.orderId)
          .update({
            paymentStatus: "failed",
            paymentError:
              failedPayment.last_payment_error?.message || "Payment failed",
          });
      }
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// ============================================
// GEMINI SENTIMENT ANALYSIS (callable)
// ============================================

/**
 * Analyze review sentiment using Gemini API.
 * Keeps the API key server-side only.
 */
exports.analyzeSentiment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { reviewText, rating } = request.data;

  // If no text, fallback to rating-based sentiment
  if (!reviewText || reviewText.trim() === "") {
    if (rating >= 4) return { sentiment: "positive" };
    if (rating <= 2) return { sentiment: "negative" };
    return { sentiment: "neutral" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not configured");
    // Fallback to rating
    if (rating >= 4) return { sentiment: "positive" };
    if (rating <= 2) return { sentiment: "negative" };
    return { sentiment: "neutral" };
  }

  try {
    const prompt = `Analyze the sentiment of this food stall review text. Focus ONLY on what the text says, ignore the star rating. Respond with ONLY one word: "positive", "negative", or "neutral".

Review text: "${reviewText}"

Response (one word only):`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 10 },
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        response.status,
        await response.text(),
      );
      if (rating >= 4) return { sentiment: "positive" };
      if (rating <= 2) return { sentiment: "negative" };
      return { sentiment: "neutral" };
    }

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text
      ?.toLowerCase()
      .trim();

    if (result?.includes("positive")) return { sentiment: "positive" };
    if (result?.includes("negative")) return { sentiment: "negative" };
    if (result?.includes("neutral")) return { sentiment: "neutral" };

    // Fallback
    if (rating >= 4) return { sentiment: "positive" };
    if (rating <= 2) return { sentiment: "negative" };
    return { sentiment: "neutral" };
  } catch (error) {
    console.error("Gemini sentiment analysis error:", error);
    if (rating >= 4) return { sentiment: "positive" };
    if (rating <= 2) return { sentiment: "negative" };
    return { sentiment: "neutral" };
  }
});

// ============================================
// INSPECTION NOTIFICATION (callable)
// ============================================

/**
 * Notify an operator or vendor about an inspection result.
 * Called from the authority inspection page.
 */
exports.notifyInspection = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { targetId, targetType, stallName, grade, inspectionDate } =
    request.data;
  if (!targetId || !targetType || !stallName) {
    throw new HttpsError(
      "invalid-argument",
      "targetId, targetType, and stallName are required",
    );
  }

  const db = admin.firestore();
  const collectionName = targetType === "operator" ? "operators" : "vendors";

  try {
    // Create in-app notification
    await db
      .collection(collectionName)
      .doc(targetId)
      .collection("notifications")
      .add({
        type: "inspection_result",
        title: `Hygiene Inspection: Grade ${grade}`,
        message: `${stallName} received grade ${grade} from inspection on ${inspectionDate}.`,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Send Telegram if connected
    const targetDoc = await db.collection(collectionName).doc(targetId).get();
    if (targetDoc.exists) {
      const data = targetDoc.data();
      const chatId = data.telegramChatId || data.preferences?.telegramChatId;
      if (chatId) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (botToken) {
          const text = `🔍 Hygiene Inspection\n\n${stallName} received grade ${grade} from inspection on ${inspectionDate}.`;
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: "HTML",
            }),
          });
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error("notifyInspection error:", error);
    throw new HttpsError("internal", error.message);
  }
});
