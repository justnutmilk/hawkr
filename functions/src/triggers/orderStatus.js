/**
 * Order Status Change Trigger
 * Sends Telegram notifications when order status changes
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { sendMessage } = require("../telegram");
const { getOrderStatusMessage } = require("../notifications");

/**
 * Firestore trigger for order status changes
 * Triggers when any order document is updated
 */
const onOrderStatusChange = functions.firestore
  .document("orders/{orderId}")
  .onUpdate(async (change, context) => {
    const orderId = context.params.orderId;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if status actually changed
    if (beforeData.status === afterData.status) {
      console.log(`Order ${orderId}: No status change, skipping notification`);
      return null;
    }

    const oldStatus = beforeData.status;
    const newStatus = afterData.status;

    console.log(`Order ${orderId}: Status changed from ${oldStatus} to ${newStatus}`);

    // Get customer data to find Telegram chat ID
    const customerId = afterData.customerId;
    if (!customerId) {
      console.error(`Order ${orderId}: No customerId found`);
      return null;
    }

    try {
      const customerDoc = await admin
        .firestore()
        .collection("customers")
        .doc(customerId)
        .get();

      if (!customerDoc.exists) {
        console.log(`Order ${orderId}: Customer ${customerId} not found`);
        return null;
      }

      const customerData = customerDoc.data();
      const telegramChatId = customerData.telegramChatId;

      // Also create in-app notification regardless of Telegram status
      await createInAppNotification(customerId, newStatus, {
        id: orderId,
        ...afterData,
      });

      // Check if customer has Telegram linked
      if (!telegramChatId) {
        console.log(
          `Order ${orderId}: Customer ${customerId} has no Telegram linked`
        );
        return null;
      }

      // Get the appropriate notification message
      const notification = getOrderStatusMessage(newStatus, {
        id: orderId,
        ...afterData,
      });

      if (!notification) {
        console.log(`Order ${orderId}: No notification template for status ${newStatus}`);
        return null;
      }

      // Send Telegram notification
      const result = await sendMessage(telegramChatId, notification.message, {
        parse_mode: "MarkdownV2",
      });

      if (result.ok) {
        console.log(
          `Order ${orderId}: Telegram notification sent to ${telegramChatId}`
        );
      } else {
        console.error(
          `Order ${orderId}: Failed to send Telegram notification:`,
          result
        );
      }

      return result;
    } catch (error) {
      console.error(`Order ${orderId}: Error processing notification:`, error);
      return null;
    }
  });

/**
 * Create in-app notification in Firestore
 * @param {string} customerId - Customer ID
 * @param {string} status - New order status
 * @param {object} orderData - Order data
 */
async function createInAppNotification(customerId, status, orderData) {
  const notificationTypes = {
    confirmed: "order_confirmed",
    preparing: "order_preparing",
    ready: "order_ready",
    completed: "order_complete",
    cancelled: "order_cancelled",
  };

  const titles = {
    confirmed: "Order Confirmed",
    preparing: "Order Being Prepared",
    ready: "Order Ready for Collection",
    completed: "Order Complete",
    cancelled: "Order Cancelled",
  };

  const messages = {
    confirmed: `Your order #${orderData.id?.slice(-4).toUpperCase()} from ${orderData.stallName} has been confirmed.`,
    preparing: `Your order #${orderData.id?.slice(-4).toUpperCase()} is now being prepared.`,
    ready: `Your order #${orderData.id?.slice(-4).toUpperCase()} is ready! Please collect from ${orderData.stallName}.`,
    completed: `Your order #${orderData.id?.slice(-4).toUpperCase()} is complete. Please collect within 15 minutes.`,
    cancelled: `Your order #${orderData.id?.slice(-4).toUpperCase()} has been cancelled.`,
  };

  const type = notificationTypes[status];
  if (!type) return;

  try {
    await admin
      .firestore()
      .collection("customers")
      .doc(customerId)
      .collection("notifications")
      .add({
        type: type,
        title: titles[status],
        message: messages[status],
        isRead: false,
        relatedType: "order",
        relatedId: orderData.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    console.log(`In-app notification created for customer ${customerId}`);
  } catch (error) {
    console.error("Error creating in-app notification:", error);
  }
}

module.exports = {
  onOrderStatusChange,
};
