/**
 * Toast Notifications Module
 * Provides in-browser toast notifications with liquid glass styling.
 * Import and call initToastContainer() from any page's navbar init.
 */

import { db } from "../../firebase/config.js";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// STATE
// ============================================

let toastContainerInjected = false;
let toastUnsubscribe = null;
let knownNotificationIds = new Set();
let isFirstSnapshot = true;

// ============================================
// CSS INJECTION
// ============================================

function injectToastStyles() {
  if (document.getElementById("hawkrToastStyles")) return;

  const style = document.createElement("style");
  style.id = "hawkrToastStyles";
  style.textContent = `
    #hawkrToastContainer {
      position: fixed;
      top: 100px;
      right: 24px;
      z-index: 100;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      max-width: 380px;
      width: calc(100% - 48px);
    }
    .hawkrToast {
      pointer-events: auto;
      background: rgba(200, 150, 210, 0.15);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 24px;
      box-shadow:
        0 8px 32px rgba(52, 21, 57, 0.1),
        inset 0 1px 1px rgba(255, 255, 255, 0.6),
        inset 0 -1px 1px rgba(0, 0, 0, 0.05);
      padding: 24px;
      cursor: pointer;
      opacity: 0;
      transform: translateX(100%);
      animation: hawkrToastSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .hawkrToast.dismissing {
      animation: hawkrToastSlideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    .hawkrToastTitle {
      font-family: "Source Serif", Georgia, serif;
      font-size: 20px;
      font-weight: 600;
      color: #341539;
      margin-bottom: 4px;
    }
    .hawkrToastMessage {
      font-family: Aptos, system-ui, sans-serif;
      font-size: 16px;
      color: #341539;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .hawkrToastTime {
      font-family: Aptos, system-ui, sans-serif;
      font-size: 14px;
      color: #808080;
      margin-top: 6px;
    }
    @keyframes hawkrToastSlideIn {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes hawkrToastSlideOut {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(100%); }
    }
    @media (max-width: 768px) {
      #hawkrToastContainer {
        top: 80px;
        right: 12px;
        max-width: calc(100% - 24px);
        width: calc(100% - 24px);
      }
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// TOAST CONTAINER
// ============================================

/**
 * Inject the toast container div and CSS into the DOM.
 * Safe to call multiple times — only injects once.
 */
export function initToastContainer() {
  if (toastContainerInjected) return;

  injectToastStyles();

  const container = document.createElement("div");
  container.id = "hawkrToastContainer";
  document.body.appendChild(container);

  toastContainerInjected = true;
}

// ============================================
// SHOW TOAST
// ============================================

/**
 * Display a toast notification.
 * @param {object} options
 * @param {string} options.title - Bold title text
 * @param {string} options.message - Body text
 * @param {string} [options.link] - URL to navigate on click
 * @param {number} [options.duration=5000] - Auto-dismiss ms
 */
export function showToast({ title, message, link = null, duration = 5000 }) {
  const container = document.getElementById("hawkrToastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "hawkrToast";
  if (link) toast.dataset.link = link;

  toast.innerHTML = `
    <div class="hawkrToastTitle">${escapeHtml(title)}</div>
    <div class="hawkrToastMessage">${escapeHtml(message)}</div>
    <div class="hawkrToastTime">Just now</div>
  `;

  // Click to navigate or dismiss
  toast.addEventListener("click", () => {
    if (link) {
      window.location.href = link;
    } else {
      dismissToast(toast);
    }
  });

  container.appendChild(toast);

  // Auto-dismiss
  const timeout = setTimeout(() => dismissToast(toast), duration);
  toast._dismissTimeout = timeout;
}

function dismissToast(toast) {
  if (toast._dismissed) return;
  toast._dismissed = true;

  if (toast._dismissTimeout) clearTimeout(toast._dismissTimeout);

  toast.classList.add("dismissing");
  toast.addEventListener("animationend", () => {
    toast.remove();
  });

  // Fallback removal
  setTimeout(() => toast.remove(), 400);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// REAL-TIME NEW NOTIFICATION LISTENER
// ============================================

/**
 * Subscribe to a Firestore notifications subcollection and show toasts
 * only for genuinely new documents (skips initial snapshot load).
 *
 * @param {string} collectionPath - e.g. "customers/abc123/notifications"
 */
export function subscribeToNewNotifications(collectionPath) {
  // Clean up previous subscription
  if (toastUnsubscribe) {
    toastUnsubscribe();
    toastUnsubscribe = null;
  }

  knownNotificationIds = new Set();
  isFirstSnapshot = true;

  const q = query(
    collection(db, ...collectionPath.split("/")),
    orderBy("createdAt", "desc"),
    limit(20),
  );

  toastUnsubscribe = onSnapshot(q, (snapshot) => {
    if (isFirstSnapshot) {
      // Record all existing notification IDs without showing toasts
      snapshot.docs.forEach((doc) => knownNotificationIds.add(doc.id));
      isFirstSnapshot = false;
      return;
    }

    // Find genuinely new documents
    snapshot.docs.forEach((doc) => {
      if (!knownNotificationIds.has(doc.id)) {
        knownNotificationIds.add(doc.id);

        const data = doc.data();
        showToast({
          title: data.title || "Notification",
          message: data.message || "",
          link: getNotificationLink(data),
        });
      }
    });
  });
}

/**
 * Determine a navigation link based on notification type and data.
 */
function getNotificationLink(notification) {
  const type = notification.type;

  if (type === "order_status" && notification.orderId) {
    return `consumerTransactionDetail.html?id=${encodeURIComponent(notification.orderId)}`;
  }
  if (type === "refund_processed" && notification.orderId) {
    return `consumerTransactionDetail.html?id=${encodeURIComponent(notification.orderId)}`;
  }
  if (type === "new_order" && notification.orderId) {
    return "../Vendor Order/vendorOrder.html";
  }
  if (type === "operator_linked" || type === "operator_unlinked") {
    return "../Vendor Tenancy/vendorTenancy.html";
  }

  return null;
}

/**
 * Clean up the notification listener.
 */
export function cleanupToastNotifications() {
  if (toastUnsubscribe) {
    toastUnsubscribe();
    toastUnsubscribe = null;
  }
  knownNotificationIds.clear();
  isFirstSnapshot = true;
}
