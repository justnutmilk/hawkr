/**
 * Notification Message Templates
 * Templates for Telegram notifications sent to customers
 */

/**
 * Format order ID for display (show last 4 characters)
 * @param {string} orderId - Full order ID
 * @returns {string} - Formatted order ID
 */
function formatOrderId(orderId) {
  if (!orderId) return "N/A";
  return orderId.slice(-4).toUpperCase();
}

/**
 * Format currency for Singapore
 * @param {number} amount - Amount in dollars
 * @returns {string} - Formatted currency string
 */
function formatCurrency(amount) {
  return `S$${amount.toFixed(2)}`;
}

/**
 * Format estimated time
 * @param {Date|object} timestamp - Firestore timestamp or Date
 * @returns {string} - Formatted time string
 */
function formatTime(timestamp) {
  if (!timestamp) return "soon";

  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }

  return date.toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Get notification message for order status change
 * @param {string} status - New order status
 * @param {object} orderData - Order data
 * @returns {object} - { title, message } for the notification
 */
function getOrderStatusMessage(status, orderData) {
  const orderId = formatOrderId(orderData.id || orderData.orderId);
  const stallName = orderData.stallName || "the stall";
  const total = orderData.total ? formatCurrency(orderData.total) : "";
  const estimatedTime = formatTime(orderData.estimatedReadyTime);

  const messages = {
    confirmed: {
      title: "Order Confirmed",
      message:
        `*Order Confirmed* \\#${orderId}\n\n` +
        `Your order from *${stallName}* has been confirmed\\!\n\n` +
        `*Total:* ${total}\n` +
        `*Estimated Ready:* ${estimatedTime}\n\n` +
        `We'll notify you when your order is ready for collection\\.`,
    },

    preparing: {
      title: "Order Being Prepared",
      message:
        `*Now Preparing* \\#${orderId}\n\n` +
        `Your order from *${stallName}* is now being prepared\\!\n\n` +
        `Please head to the hawker centre soon\\.`,
    },

    ready: {
      title: "Order Ready",
      message:
        `*Order Ready\\!* \\#${orderId}\n\n` +
        `Your order from *${stallName}* is ready for collection\\!\n\n` +
        `Please collect your order now\\.`,
    },

    completed: {
      title: "Order Complete",
      message:
        `*Order Complete* \\#${orderId}\n\n` +
        `Your order from *${stallName}* is complete\\.\n\n` +
        `*Please collect within 15 minutes to avoid wastage\\.*\n\n` +
        `Thank you for using Hawkr\\!`,
    },

    cancelled: {
      title: "Order Cancelled",
      message:
        `*Order Cancelled* \\#${orderId}\n\n` +
        `Unfortunately, your order from *${stallName}* has been cancelled\\.\n\n` +
        (orderData.cancellationReason
          ? `*Reason:* ${orderData.cancellationReason}\n\n`
          : "") +
        `If you were charged, a refund will be processed shortly\\.`,
    },
  };

  return messages[status] || null;
}

/**
 * Get welcome message for new Telegram users
 * @param {string} botUsername - Bot username for linking
 * @returns {string} - Welcome message
 */
function getWelcomeMessage(botUsername) {
  return (
    `*Welcome to Hawkr\\!* 🍜\n\n` +
    `I'll send you notifications about your orders:\n` +
    `• Order confirmations\n` +
    `• Preparation updates\n` +
    `• Ready for collection alerts\n\n` +
    `To link your Hawkr account, go to *Settings* at hawkr\\.org and tap *Link Telegram*\\.\n\n` +
    `Or use the command:\n` +
    `\`/link YOUR_CODE\`\n\n` +
    `Need help? Contact support@hawkr\\.org`
  );
}

/**
 * Get message for successful account linking
 * @param {string} customerName - Customer's name
 * @returns {string}
 */
function getLinkSuccessMessage(customerName) {
  const name = customerName || "there";
  return (
    `*Account Linked\\!* ✅\n\n` +
    `Hi ${name}\\! Your Telegram is now connected to your Hawkr account\\.\n\n` +
    `You'll receive notifications here when:\n` +
    `• Your order is confirmed\n` +
    `• Your food is being prepared\n` +
    `• Your order is ready for collection\n\n` +
    `To unlink, use \`/unlink\` or go to Settings in the app\\.`
  );
}

/**
 * Get message for failed linking attempt
 * @param {string} reason - Reason for failure
 * @returns {string}
 */
function getLinkFailedMessage(reason) {
  const reasons = {
    invalid_token: "The link code is invalid or has expired\\.",
    already_linked:
      "This Telegram account is already linked to a Hawkr account\\.",
    token_expired:
      "The link code has expired\\. Please generate a new one in the app\\.",
    not_found: "No account found with this link code\\.",
  };

  return (
    `*Linking Failed* ❌\n\n` +
    `${reasons[reason] || reason}\n\n` +
    `Please try again or contact support@hawkr\\.sg`
  );
}

/**
 * Get message for successful unlinking
 * @returns {string}
 */
function getUnlinkSuccessMessage() {
  return (
    `*Account Unlinked* ✅\n\n` +
    `Your Telegram has been disconnected from your Hawkr account\\.\n\n` +
    `You will no longer receive order notifications here\\.\n\n` +
    `To reconnect, use \`/link YOUR_CODE\` with a new code from the app\\.`
  );
}

/**
 * Get message when user is not linked
 * @returns {string}
 */
function getNotLinkedMessage() {
  return (
    `*Not Linked* ⚠️\n\n` +
    `Your Telegram is not connected to a Hawkr account\\.\n\n` +
    `To link your account:\n` +
    `1\\. Open the Hawkr app\n` +
    `2\\. Go to Settings\n` +
    `3\\. Tap "Link Telegram"\n` +
    `4\\. Use the code here: \`/link YOUR_CODE\``
  );
}

/**
 * Get active orders status message
 * @param {Array} orders - Array of active orders
 * @returns {string}
 */
function getOrdersStatusMessage(orders) {
  if (!orders || orders.length === 0) {
    return (
      `*No Active Orders* 📋\n\n` +
      `You don't have any active orders at the moment\\.\n\n` +
      `Open the Hawkr app to place an order\\!`
    );
  }

  let message = `*Your Active Orders* 📋\n\n`;

  orders.forEach((order, index) => {
    const orderId = formatOrderId(order.id);
    const status = order.status.charAt(0).toUpperCase() + order.status.slice(1);
    const stallName = order.stallName || "Unknown";

    message += `*${index + 1}\\. Order \\#${orderId}*\n`;
    message += `   Stall: ${stallName}\n`;
    message += `   Status: ${status}\n\n`;
  });

  return message;
}

/**
 * Get help message
 * @returns {string}
 */
function getHelpMessage() {
  return (
    `*Hawkr Bot Commands* 📖\n\n` +
    `\`/start\` \\- Welcome message\n` +
    `\`/link CODE\` \\- Link your Hawkr account\n` +
    `\`/unlink\` \\- Disconnect your account\n` +
    `\`/status\` \\- Check your active orders\n` +
    `\`/help\` \\- Show this help message\n\n` +
    `Need assistance? Contact support@hawkr\\.org`
  );
}

module.exports = {
  formatOrderId,
  formatCurrency,
  formatTime,
  getOrderStatusMessage,
  getWelcomeMessage,
  getLinkSuccessMessage,
  getLinkFailedMessage,
  getUnlinkSuccessMessage,
  getNotLinkedMessage,
  getOrdersStatusMessage,
  getHelpMessage,
};
