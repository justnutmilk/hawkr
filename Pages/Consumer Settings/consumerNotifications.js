// ============================================
// IMPORTS
// ============================================

import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";
import { injectMobileMenu } from "../../assets/js/mobileMenu.js";
import { auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getNotifications,
  markAsRead,
  subscribeToNotifications,
  formatTimeAgo,
} from "../../firebase/services/notifications.js";

// State
let notifications = [];
let unsubscribeNotifications = null;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatNotificationTime(timestamp) {
  if (!timestamp) return "";

  // Handle Firestore timestamp
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // Less than 1 minute
  if (diff < 60 * 1000) {
    return "Now";
  }

  // Less than 1 hour
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes} min ago`;
  }

  // Less than 24 hours
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours} hr ago`;
  }

  // Otherwise show date
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

function getNotificationType(notification) {
  // Map notification types from Firebase
  const type = notification.type;
  if (type === "order_status") return "order";
  if (type === "feedback_resolved") return "feedback";
  if (type === "refund_processed") return "refund";
  return type || "announcement";
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderNotificationCard(notification) {
  const type = getNotificationType(notification);
  const orderId = notification.orderId;
  const isUnread = !notification.isRead;

  let seeMoreHTML = "";

  // Determine link based on notification type
  if (type === "order" && orderId) {
    seeMoreHTML = `<a class="seeMore" href="consumerTransactionDetail.html?id=${encodeURIComponent(orderId)}" data-transaction="true">see more ></a>`;
  } else if (type === "refund" && orderId) {
    seeMoreHTML = `<a class="seeMore" href="consumerTransactionDetail.html?id=${encodeURIComponent(orderId)}" data-transaction="true">see more ></a>`;
  } else if (type === "feedback" && notification.feedbackId) {
    // Link to feedback or just show the resolution details inline
    seeMoreHTML = notification.refundAmount
      ? `<span class="refundBadge">Refund: $${notification.refundAmount.toFixed(2)}</span>`
      : "";
  }

  const unreadClass = isUnread ? "notificationCard--unread" : "";

  return `
    <div class="notificationCard ${unreadClass}" data-notification-id="${notification.id}">
      <div class="notificationHeader">
        <span class="notificationTitle">${notification.title}</span>
        <span class="notificationTime">${formatNotificationTime(notification.createdAt)}</span>
      </div>
      <p class="notificationBody">${notification.message}</p>
      ${seeMoreHTML}
    </div>
  `;
}

function renderNotifications(notificationsList) {
  const container = document.getElementById("notificationsContent");
  if (!container) return;

  if (notificationsList.length === 0) {
    container.innerHTML = `
      <span class="pageTitle">Notifications</span>
      <div class="emptyState">
        <p>No notifications yet</p>
      </div>
    `;
    return;
  }

  const notificationsHTML = notificationsList
    .map((notif) => renderNotificationCard(notif))
    .join("");

  container.innerHTML = `
    <span class="pageTitle">Notifications</span>
    <div class="notificationsList">
      ${notificationsHTML}
    </div>
  `;

  // Attach click handlers for transaction links and mark as read
  attachTransactionLinkListeners();
  attachNotificationClickListeners();
}

function attachTransactionLinkListeners() {
  const transactionLinks = document.querySelectorAll(
    '.seeMore[data-transaction="true"]',
  );
  transactionLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      // Save referrer before navigating
      sessionStorage.setItem(
        "transactionDetailReferrer",
        "consumerNotifications.html",
      );
    });
  });
}

function attachNotificationClickListeners() {
  const notificationCards = document.querySelectorAll(".notificationCard");
  notificationCards.forEach((card) => {
    card.addEventListener("click", async function () {
      const notificationId = card.dataset.notificationId;
      if (
        notificationId &&
        card.classList.contains("notificationCard--unread")
      ) {
        try {
          await markAsRead(notificationId);
          card.classList.remove("notificationCard--unread");
        } catch (error) {
          console.error("Error marking notification as read:", error);
        }
      }
    });
  });
}

// ============================================
// LOADING STATE
// ============================================

function showLoading() {
  const container = document.getElementById("notificationsContent");
  if (container) {
    container.innerHTML = `
      <span class="pageTitle">Notifications</span>
      <div class="loadingSpinner"></div>
    `;
  }
}

function showError(message) {
  const container = document.getElementById("notificationsContent");
  if (container) {
    container.innerHTML = `
      <span class="pageTitle">Notifications</span>
      <div class="emptyState">
        <p>${message}</p>
      </div>
    `;
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initializeNotificationsPage(user) {
  showLoading();

  if (!user) {
    showError("Please log in to view notifications");
    return;
  }

  try {
    // Get initial notifications
    notifications = await getNotifications(50);
    renderNotifications(notifications);

    // Subscribe to real-time updates
    unsubscribeNotifications = subscribeToNotifications(
      (updatedNotifications) => {
        notifications = updatedNotifications;
        renderNotifications(notifications);
      },
    );
  } catch (error) {
    console.error("Error loading notifications:", error);
    showError("Failed to load notifications");
  }
}

// ============================================
// NAVIGATION HANDLERS
// ============================================

function handleBackClick() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "../Consumer Dashboard/consumerDashboard.html";
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();
  injectMobileMenu({ activePage: "notifications" });

  // Listen for auth state changes
  onAuthStateChanged(auth, async (user) => {
    await initializeNotificationsPage(user);
  });

  // Back button handler
  const backButton = document.getElementById("backButton");
  if (backButton) {
    backButton.addEventListener("click", handleBackClick);
  }

  // Search input focus shortcut
  const searchInput = document.getElementById("searchInput");

  document.addEventListener("keydown", function (e) {
    if (!searchInput) return;

    const targetTag = e.target.tagName.toLowerCase();
    const isEditable = e.target.isContentEditable === true;

    if (targetTag === "input" || targetTag === "textarea" || isEditable) {
      return;
    }

    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (unsubscribeNotifications) {
    unsubscribeNotifications();
  }
});
