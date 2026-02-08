import { auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getHawkerCentresByOperator } from "../../firebase/services/hawkerCentres.js";
import {
  subscribeToOperatorNotifications,
  markOperatorNotificationAsRead,
  formatTimeAgo,
} from "../../firebase/services/operatorNotifications.js";
import { initNotificationBadge } from "../../assets/js/notificationBadge.js";
import {
  initToastContainer,
  subscribeToNewNotifications,
} from "../../assets/js/toastNotifications.js";

// ============================================
// STATE
// ============================================

let notifications = [];
let unsubscribeNotifications = null;
let currentTab = "vendors";
let hasLoaded = false;

// Map notification types to tabs
const typeToTab = {
  vendor_linked: "vendors",
  vendor_unlinked: "vendors",
};

// ============================================
// SKELETON LOADING
// ============================================

function renderSkeletonCards(count = 3) {
  return Array.from(
    { length: count },
    () => `
    <div class="skeletonCard">
      <div class="skeletonHeader">
        <div class="skeletonLine skeletonTitle"></div>
        <div class="skeletonLine skeletonTime"></div>
      </div>
      <div class="skeletonLine skeletonBody"></div>
    </div>
  `,
  ).join("");
}

function showNotificationsLoading() {
  const container = document.getElementById("notificationsContent");
  if (container) container.innerHTML = renderSkeletonCards(3);
}

function showNameLoading() {
  const nameEl = document.querySelector(".operatorName");
  if (nameEl) {
    nameEl.classList.add("operatorName--loading");
    nameEl.innerHTML = `<div class="skeletonLine skeletonName"></div><div class="skeletonLine skeletonName skeletonNameShort"></div>`;
  }
}

function hideNameLoading() {
  const nameEl = document.querySelector(".operatorName");
  if (nameEl) {
    nameEl.classList.remove("operatorName--loading");
  }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function formatNotificationTime(timestamp) {
  if (!timestamp) return "";
  return formatTimeAgo(timestamp);
}

function getNotificationLink(notification) {
  const type = notification.type;
  if (type === "vendor_linked" || type === "vendor_unlinked") {
    return "../Operator Children/operatorChildren.html";
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

  if (!hasLoaded) {
    showNotificationsLoading();
    return;
  }

  const filtered = notifications.filter((n) => {
    const mappedTab = typeToTab[n.type] || "hawkr";
    return mappedTab === tab;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<span class="emptyState">No notifications.</span>`;
    return;
  }

  container.innerHTML = filtered.map(renderNotificationCard).join("");
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
          await markOperatorNotificationAsRead(notificationId);
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

  unsubscribeNotifications = subscribeToOperatorNotifications(
    (updatedNotifications) => {
      notifications = updatedNotifications;
      hasLoaded = true;
      renderNotifications(currentTab);
    },
  );
}

document.addEventListener("DOMContentLoaded", () => {
  showNameLoading();
  showNotificationsLoading();

  // Tab switching
  document
    .querySelectorAll('input[name="notificationTab"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        renderNotifications(radio.value);
      });
    });

  // Auth
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      initNotificationBadge(`operators/${user.uid}/notifications`);
      initToastContainer();
      subscribeToNewNotifications(`operators/${user.uid}/notifications`);

      // Load hawker centre name for sidebar (same as dashboard)
      try {
        const centres = await getHawkerCentresByOperator(user.uid);
        hideNameLoading();
        const nameEl = document.querySelector(".operatorName");
        if (centres && centres.length > 0) {
          if (nameEl) nameEl.textContent = centres[0].name || "My Centre";
        } else {
          if (nameEl) nameEl.textContent = "My Centre";
        }
      } catch (_) {
        hideNameLoading();
        const nameEl = document.querySelector(".operatorName");
        if (nameEl) nameEl.textContent = "My Centre";
      }

      initializeNotifications(user);
    } else {
      window.location.href = "../Auth/login.html";
    }
  });
});

window.addEventListener("beforeunload", () => {
  if (unsubscribeNotifications) {
    unsubscribeNotifications();
  }
});
