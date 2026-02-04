// ============================================
// IMPORTS
// ============================================

import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";

// ============================================
// MOCK NOTIFICATION DATA
// ============================================

const mockNotifications = [
  {
    id: "notif-001",
    title: "Order Complete",
    body: "Your order #888 from Chinese Foods Private Limited - Maxwell Food Centre is ready for collection. Please collect within 15 minutes to avoid 10% food wastage fee.",
    timestamp: new Date(),
    type: "order",
    orderId: "c2b-j29Sksix93Q-FOOD",
  },
  {
    id: "notif-002",
    title: "App Revamp",
    body: "Hawkr's web app is set to update on 23 Jan 2026, 02:00 - 04:30. Some services may be affected.",
    timestamp: new Date(2026, 0, 11),
    type: "announcement",
    link: null,
  },
  {
    id: "notif-003",
    title: "Order Confirmed",
    body: "Your order #456 from Tian Tian Hainanese - Maxwell Food Centre has been confirmed. Estimated pickup time: 12:30 PM.",
    timestamp: new Date(2026, 0, 10, 14, 30),
    type: "order",
    orderId: "c2b-p74Ghi5jK7L-FOOD",
  },
  {
    id: "notif-004",
    title: "Refund Processed",
    body: "Your refund of $6.70 for order #789 has been processed. The amount will be credited to your GrabPay account within 3-5 business days.",
    timestamp: new Date(2026, 0, 10, 10, 15),
    type: "refund",
    orderId: "b2c-j29Vb4HDj8Q-REFUND",
  },
  {
    id: "notif-005",
    title: "New Hawker Centre Added",
    body: "Explore the newly added Old Airport Road Food Centre with over 50 hawker stalls now available on Hawkr!",
    timestamp: new Date(2026, 0, 9),
    type: "announcement",
    link: null,
  },
  {
    id: "notif-006",
    title: "Order Complete",
    body: "Your order #321 from Hill Street Tai Hwa - Crawford Lane is ready for collection. Please collect within 15 minutes to avoid 10% food wastage fee.",
    timestamp: new Date(2026, 0, 8, 12, 45),
    type: "order",
    orderId: "c2b-q65Mno6pQ8R-FOOD",
  },
  {
    id: "notif-007",
    title: "Weekly Digest",
    body: "You've ordered from 5 different hawker stalls this week! Check out your transaction history to see your spending summary.",
    timestamp: new Date(2026, 0, 7),
    type: "digest",
    link: "404.html",
  },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatNotificationTime(timestamp) {
  const now = new Date();
  const diff = now - timestamp;

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
  const day = timestamp.getDate();
  const month = timestamp.toLocaleString("en-US", { month: "short" });
  const year = timestamp.getFullYear();

  return `${day} ${month} ${year}`;
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderNotificationCard(notification) {
  const hasSeeMore =
    notification.type === "order" ||
    notification.type === "refund" ||
    notification.link;

  let seeMoreHTML = "";
  if (hasSeeMore) {
    if (notification.type === "order" || notification.type === "refund") {
      seeMoreHTML = `<a class="seeMore" href="consumerTransactionDetail.html?id=${encodeURIComponent(notification.orderId)}" data-transaction="true">see more ></a>`;
    } else if (notification.link) {
      seeMoreHTML = `<a class="seeMore" href="${notification.link}">see more ></a>`;
    }
  }

  return `
    <div class="notificationCard" data-notification-id="${notification.id}">
      <div class="notificationHeader">
        <span class="notificationTitle">${notification.title}</span>
        <span class="notificationTime">${formatNotificationTime(notification.timestamp)}</span>
      </div>
      <p class="notificationBody">${notification.body}</p>
      ${seeMoreHTML}
    </div>
  `;
}

function renderNotifications(notifications) {
  const container = document.getElementById("notificationsContent");
  if (!container) return;

  const notificationsHTML = notifications
    .map((notif) => renderNotificationCard(notif))
    .join("");

  container.innerHTML = `
    <span class="pageTitle">Notifications</span>
    <div class="notificationsList">
      ${notificationsHTML}
    </div>
  `;

  // Attach click handlers for transaction links
  attachTransactionLinkListeners();
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

// ============================================
// LOADING STATE
// ============================================

function showLoading() {
  const container = document.getElementById("notificationsContent");
  if (container) {
    container.innerHTML = `<div class="loadingSpinner"></div>`;
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initializeNotificationsPage() {
  showLoading();

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  renderNotifications(mockNotifications);
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

  initializeNotificationsPage();

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
