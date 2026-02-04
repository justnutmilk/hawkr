/**
 * Telegram Webhook Handler
 * Handles incoming messages from Telegram Bot API
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { sendMessage, answerCallbackQuery } = require("../telegram");
const {
  getWelcomeMessage,
  getLinkSuccessMessage,
  getLinkFailedMessage,
  getUnlinkSuccessMessage,
  getNotLinkedMessage,
  getOrdersStatusMessage,
  getHelpMessage,
} = require("../notifications");

// Token expiry time (10 minutes)
const TOKEN_EXPIRY_MS = 10 * 60 * 1000;

/**
 * HTTP Cloud Function to handle Telegram webhook
 */
const telegramWebhook = functions.https.onRequest(async (req, res) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const update = req.body;

  try {
    // Handle regular messages
    if (update.message) {
      await handleMessage(update.message);
    }

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error handling Telegram update:", error);
    res.status(200).send("OK"); // Still return 200 to prevent Telegram retries
  }
});

/**
 * Handle incoming message
 * @param {object} message - Telegram message object
 */
async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || "";
  const firstName = message.from?.first_name || "";

  // Parse command
  const command = text.split(" ")[0].toLowerCase();
  const args = text.split(" ").slice(1).join(" ");

  switch (command) {
    case "/start":
      // Check if started with a link token (deep link)
      if (args) {
        await handleLinkCommand(chatId, args, firstName);
      } else {
        await sendMessage(chatId, getWelcomeMessage(), {
          parse_mode: "MarkdownV2",
        });
      }
      break;

    case "/link":
      await handleLinkCommand(chatId, args, firstName);
      break;

    case "/unlink":
      await handleUnlinkCommand(chatId);
      break;

    case "/status":
      await handleStatusCommand(chatId);
      break;

    case "/help":
      await sendMessage(chatId, getHelpMessage(), {
        parse_mode: "MarkdownV2",
      });
      break;

    default:
      // Unknown command or regular message
      if (text.startsWith("/")) {
        await sendMessage(
          chatId,
          "Unknown command\\. Use /help to see available commands\\.",
          { parse_mode: "MarkdownV2" }
        );
      }
      break;
  }
}

/**
 * Handle /link command
 * @param {number} chatId - Telegram chat ID
 * @param {string} token - Link token from user
 * @param {string} firstName - User's first name
 */
async function handleLinkCommand(chatId, token, firstName) {
  if (!token) {
    await sendMessage(
      chatId,
      "Please provide your link code\\.\n\nUsage: `/link YOUR_CODE`\n\nGet your code from the Hawkr app under Settings \\> Link Telegram\\.",
      { parse_mode: "MarkdownV2" }
    );
    return;
  }

  try {
    // Check if this Telegram is already linked
    const existingLink = await admin
      .firestore()
      .collection("customers")
      .where("telegramChatId", "==", chatId.toString())
      .limit(1)
      .get();

    if (!existingLink.empty) {
      await sendMessage(chatId, getLinkFailedMessage("already_linked"), {
        parse_mode: "MarkdownV2",
      });
      return;
    }

    // Find customer with this token
    const customersSnapshot = await admin
      .firestore()
      .collection("customers")
      .where("telegramLinkToken", "==", token)
      .limit(1)
      .get();

    if (customersSnapshot.empty) {
      await sendMessage(chatId, getLinkFailedMessage("not_found"), {
        parse_mode: "MarkdownV2",
      });
      return;
    }

    const customerDoc = customersSnapshot.docs[0];
    const customerData = customerDoc.data();

    // Check if token has expired
    const tokenCreatedAt = customerData.telegramLinkTokenCreatedAt?.toDate();
    if (tokenCreatedAt && Date.now() - tokenCreatedAt.getTime() > TOKEN_EXPIRY_MS) {
      await sendMessage(chatId, getLinkFailedMessage("token_expired"), {
        parse_mode: "MarkdownV2",
      });

      // Clear expired token
      await customerDoc.ref.update({
        telegramLinkToken: null,
        telegramLinkTokenCreatedAt: null,
      });
      return;
    }

    // Link the account
    await customerDoc.ref.update({
      telegramChatId: chatId.toString(),
      telegramLinked: true,
      telegramLinkToken: null,
      telegramLinkTokenCreatedAt: null,
      telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const customerName = customerData.name || firstName;
    await sendMessage(chatId, getLinkSuccessMessage(customerName), {
      parse_mode: "MarkdownV2",
    });

    console.log(`Telegram linked: chatId ${chatId} -> customer ${customerDoc.id}`);
  } catch (error) {
    console.error("Error linking Telegram account:", error);
    await sendMessage(
      chatId,
      "An error occurred while linking your account\\. Please try again later\\.",
      { parse_mode: "MarkdownV2" }
    );
  }
}

/**
 * Handle /unlink command
 * @param {number} chatId - Telegram chat ID
 */
async function handleUnlinkCommand(chatId) {
  try {
    // Find customer with this Telegram chat ID
    const customersSnapshot = await admin
      .firestore()
      .collection("customers")
      .where("telegramChatId", "==", chatId.toString())
      .limit(1)
      .get();

    if (customersSnapshot.empty) {
      await sendMessage(chatId, getNotLinkedMessage(), {
        parse_mode: "MarkdownV2",
      });
      return;
    }

    const customerDoc = customersSnapshot.docs[0];

    // Unlink the account
    await customerDoc.ref.update({
      telegramChatId: null,
      telegramLinked: false,
      telegramUnlinkedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await sendMessage(chatId, getUnlinkSuccessMessage(), {
      parse_mode: "MarkdownV2",
    });

    console.log(`Telegram unlinked: chatId ${chatId} from customer ${customerDoc.id}`);
  } catch (error) {
    console.error("Error unlinking Telegram account:", error);
    await sendMessage(
      chatId,
      "An error occurred while unlinking your account\\. Please try again later\\.",
      { parse_mode: "MarkdownV2" }
    );
  }
}

/**
 * Handle /status command
 * @param {number} chatId - Telegram chat ID
 */
async function handleStatusCommand(chatId) {
  try {
    // Find customer with this Telegram chat ID
    const customersSnapshot = await admin
      .firestore()
      .collection("customers")
      .where("telegramChatId", "==", chatId.toString())
      .limit(1)
      .get();

    if (customersSnapshot.empty) {
      await sendMessage(chatId, getNotLinkedMessage(), {
        parse_mode: "MarkdownV2",
      });
      return;
    }

    const customerId = customersSnapshot.docs[0].id;

    // Get active orders for this customer
    const activeStatuses = ["pending", "confirmed", "preparing", "ready"];
    const ordersSnapshot = await admin
      .firestore()
      .collection("orders")
      .where("customerId", "==", customerId)
      .where("status", "in", activeStatuses)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    const orders = ordersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    await sendMessage(chatId, getOrdersStatusMessage(orders), {
      parse_mode: "MarkdownV2",
    });
  } catch (error) {
    console.error("Error getting order status:", error);
    await sendMessage(
      chatId,
      "An error occurred while fetching your orders\\. Please try again later\\.",
      { parse_mode: "MarkdownV2" }
    );
  }
}

/**
 * Handle callback query (button click)
 * @param {object} callbackQuery - Telegram callback query object
 */
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // Acknowledge the callback
  await answerCallbackQuery(callbackQuery.id);

  // Handle different callback data
  // (Can be extended for interactive buttons in the future)
  console.log(`Callback query from ${chatId}: ${data}`);
}

module.exports = {
  telegramWebhook,
};
