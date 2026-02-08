import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";
import { initNotificationBadge } from "../../assets/js/notificationBadge.js";
import {
  initToastContainer,
  subscribeToNewNotifications,
} from "../../assets/js/toastNotifications.js";
import { auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  subscribeToVendorNotifications,
  markVendorNotificationAsRead,
  formatTimeAgo,
} from "../../firebase/services/vendorNotifications.js";

// ============================================
// STATE
// ============================================

let notifications = [];
let unsubscribeNotifications = null;
let currentTab = "customers";

// Map notification types to tabs
const typeToTab = {
  new_order: "customers",
  customer_feedback: "customers",
  refund_processed: "customers",
  feedback_resolved: "customers",
  operator_linked: "operator",
  operator_unlinked: "operator",
  inspection_result: "operator",
};

// ============================================
// RENDER FUNCTIONS
// ============================================

function formatNotificationTime(timestamp) {
  if (!timestamp) return "";
  return formatTimeAgo(timestamp);
}

function getNotificationLink(notification) {
  const type = notification.type;
  if (type === "new_order" && notification.orderId) {
    return "../Vendor Order/vendorOrder.html";
  }
  if (type === "customer_feedback" && notification.feedbackId) {
    return "../Vendor Reviews/vendorReviews.html";
  }
  if (type === "refund_processed" && notification.orderId) {
    return "../Vendor Payments/vendorPayments.html";
  }
  if (type === "feedback_resolved" && notification.feedbackId) {
    return "../Vendor Reviews/vendorReviews.html";
  }
  if (type === "operator_linked" || type === "operator_unlinked") {
    return "../Vendor Tenancy/vendorTenancy.html";
  }
  return null;
}

function renderNotificationCard(notification) {
  const link = getNotificationLink(notification);
  const isUnread = !notification.isRead;
  const unreadClass = isUnread ? "notificationCard--unread" : "";

  const seeMoreHtml = link
    ? `<a class="seeMore" href="${link}">see more ></a>`
    : "";

  return `
    <div class="notificationCard ${unreadClass}" data-notification-id="${notification.id}">
      <div class="notificationHeader">
        <span class="notificationTitle">${notification.title || "Notification"}</span>
        <span class="notificationTime">${formatNotificationTime(notification.createdAt)}</span>
      </div>
      <p class="notificationBody">${notification.message || ""}</p>
      ${seeMoreHtml}
    </div>
  `;
}

function renderNotifications(tab) {
  currentTab = tab;
  const container = document.getElementById("notificationsContent");
  if (!container) return;

  // Filter notifications by tab
  const filtered = notifications.filter((n) => {
    const mappedTab = typeToTab[n.type] || "hawkr";
    return mappedTab === tab;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<span class="emptyState">No notifications.</span>`;
    return;
  }

  container.innerHTML = filtered.map(renderNotificationCard).join("");

  // Attach click-to-mark-as-read
  attachNotificationClickListeners();
}

function attachNotificationClickListeners() {
  const cards = document.querySelectorAll(".notificationCard");
  cards.forEach((card) => {
    card.addEventListener("click", async () => {
      const notificationId = card.dataset.notificationId;
      if (
        notificationId &&
        card.classList.contains("notificationCard--unread")
      ) {
        try {
          await markVendorNotificationAsRead(notificationId);
          card.classList.remove("notificationCard--unread");
        } catch (error) {
          console.error("Error marking notification as read:", error);
        }
      }
    });
  });
}

// ============================================
// INITIALIZATION
// ============================================

function initializeNotifications(user) {
  if (!user) return;

  // Subscribe to real-time vendor notifications
  unsubscribeNotifications = subscribeToVendorNotifications(
    (updatedNotifications) => {
      notifications = updatedNotifications;
      renderNotifications(currentTab);
    },
  );
}

document.addEventListener("DOMContentLoaded", () => {
  initVendorNavbar();

  // Render empty state until auth resolves
  renderNotifications("customers");

  // Tab switching
  document
    .querySelectorAll('input[name="notificationTab"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        renderNotifications(radio.value);
      });
    });

  // Wait for auth then initialize
  onAuthStateChanged(auth, (user) => {
    if (user) {
      initNotificationBadge(`vendors/${user.uid}/notifications`);
      initToastContainer();
      subscribeToNewNotifications(`vendors/${user.uid}/notifications`);
      initializeNotifications(user);
    }
  });
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (unsubscribeNotifications) {
    unsubscribeNotifications();
  }
});
