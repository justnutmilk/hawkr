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
const {
  onRequest,
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");

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
// FIRESTORE TRIGGERS
// ============================================

/**
 * Trigger: Order status change
 * Sends Telegram notification when order status changes
 */
exports.onOrderStatusChange = onDocumentUpdated(
  "orders/{orderId}",
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const orderId = event.params.orderId;

    // Check if status changed
    if (beforeData.status === afterData.status) {
      return null;
    }

    const oldStatus = beforeData.status;
    const newStatus = afterData.status;
    const customerId = afterData.customerId;

    console.log(
      `Order ${orderId} status changed: ${oldStatus} -> ${newStatus}`,
    );

    if (!customerId) {
      console.log("No customerId found in order");
      return null;
    }

    try {
      // Get customer to find their Telegram chat ID
      const customerDoc = await admin
        .firestore()
        .collection("customers")
        .doc(customerId)
        .get();

      if (!customerDoc.exists) {
        console.log(`Customer ${customerId} not found`);
        return null;
      }

      const customerData = customerDoc.data();
      const telegramChatId = customerData.telegramChatId;

      // Get notification content
      const orderDataWithId = { ...afterData, id: orderId };
      const notificationContent = getOrderStatusMessage(
        newStatus,
        orderDataWithId,
      );

      if (!notificationContent) {
        console.log(`No notification template for status: ${newStatus}`);
        return null;
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
          status: newStatus,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Send Telegram notification if linked
      if (telegramChatId) {
        await sendMessage(telegramChatId, notificationContent.message, {
          parse_mode: "MarkdownV2",
        });
        console.log(`Telegram notification sent to ${telegramChatId}`);
      } else {
        console.log(`Customer ${customerId} has no Telegram linked`);
      }

      return null;
    } catch (error) {
      console.error("Error processing order status change:", error);
      return null;
    }
  },
);

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
  const region = "us-central1";
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

  // 10. Send Telegram notification if linked
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
        const message =
          `*Refund Processed* from *${escapeMarkdown(orderData.stallName || "Hawkr")}*\n\n` +
          `Amount: S\\$${refundAmountDisplay}\n` +
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
