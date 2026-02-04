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
