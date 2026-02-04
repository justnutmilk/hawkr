/**
 * Telegram Bot API Wrapper
 * Handles sending messages via Telegram Bot API
 */

const fetch = require("node-fetch");

// Get bot token from environment variables
const getBotToken = () => {
  return process.env.TELEGRAM_BOT_TOKEN;
};

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

/**
 * Send a message to a Telegram chat
 * @param {string} chatId - Telegram chat ID
 * @param {string} text - Message text (supports Markdown)
 * @param {object} options - Additional options (parse_mode, reply_markup, etc.)
 * @returns {Promise<object>} - Telegram API response
 */
async function sendMessage(chatId, text, options = {}) {
  const botToken = getBotToken();
  if (!botToken) {
    console.error("Telegram bot token not configured");
    return { ok: false, error: "Bot token not configured" };
  }

  const url = `${TELEGRAM_API_BASE}${botToken}/sendMessage`;

  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: options.parse_mode || "Markdown",
    disable_web_page_preview: options.disable_web_page_preview || true,
    ...options,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!result.ok) {
      console.error("Telegram API error:", result);
    }

    return result;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return { ok: false, error: error.message };
  }
}

/**
 * Send a message with inline keyboard buttons
 * @param {string} chatId - Telegram chat ID
 * @param {string} text - Message text
 * @param {Array} buttons - Array of button rows, each row is an array of buttons
 * @returns {Promise<object>}
 */
async function sendMessageWithButtons(chatId, text, buttons) {
  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: buttons,
    },
  });
}

/**
 * Set webhook URL for the bot
 * @param {string} webhookUrl - HTTPS URL for webhook
 * @returns {Promise<object>}
 */
async function setWebhook(webhookUrl) {
  const botToken = getBotToken();
  if (!botToken) {
    return { ok: false, error: "Bot token not configured" };
  }

  const url = `${TELEGRAM_API_BASE}${botToken}/setWebhook`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      }),
    });

    return await response.json();
  } catch (error) {
    console.error("Error setting webhook:", error);
    return { ok: false, error: error.message };
  }
}

/**
 * Delete webhook (switch to polling mode)
 * @returns {Promise<object>}
 */
async function deleteWebhook() {
  const botToken = getBotToken();
  if (!botToken) {
    return { ok: false, error: "Bot token not configured" };
  }

  const url = `${TELEGRAM_API_BASE}${botToken}/deleteWebhook`;

  try {
    const response = await fetch(url, {
      method: "POST",
    });

    return await response.json();
  } catch (error) {
    console.error("Error deleting webhook:", error);
    return { ok: false, error: error.message };
  }
}

/**
 * Get bot info
 * @returns {Promise<object>}
 */
async function getMe() {
  const botToken = getBotToken();
  if (!botToken) {
    return { ok: false, error: "Bot token not configured" };
  }

  const url = `${TELEGRAM_API_BASE}${botToken}/getMe`;

  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("Error getting bot info:", error);
    return { ok: false, error: error.message };
  }
}

/**
 * Answer a callback query (button click)
 * @param {string} callbackQueryId - Callback query ID
 * @param {string} text - Optional notification text
 * @returns {Promise<object>}
 */
async function answerCallbackQuery(callbackQueryId, text = "") {
  const botToken = getBotToken();
  if (!botToken) {
    return { ok: false, error: "Bot token not configured" };
  }

  const url = `${TELEGRAM_API_BASE}${botToken}/answerCallbackQuery`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
      }),
    });

    return await response.json();
  } catch (error) {
    console.error("Error answering callback query:", error);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  sendMessage,
  sendMessageWithButtons,
  setWebhook,
  deleteWebhook,
  getMe,
  answerCallbackQuery,
};
