/**
 * Notification Badge Module
 * Real-time unread notification count badge on bell icons.
 * Mirrors the cart badge pattern from consumerNavbar.js.
 */

import { db } from "../../firebase/config.js";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// STATE
// ============================================

let badgeUnsubscribe = null;

// ============================================
// CSS INJECTION
// ============================================

function injectBadgeStyles() {
  if (document.getElementById("notifBadgeStyles")) return;

  const style = document.createElement("style");
  style.id = "notifBadgeStyles";
  style.textContent = `
    [data-notification-bell] {
      position: relative;
      display: inline-flex;
    }
    .notifBadge {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 22px;
      height: 22px;
      padding: 0;
      border-radius: 50%;
      background: #913b9f;
      color: #fff;
      font-family: Aptos, system-ui, sans-serif;
      font-size: 10px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      border: 2px solid #fff;
      box-sizing: content-box;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// BADGE UPDATE
// ============================================

function updateBadge(count) {
  injectBadgeStyles();

  const bells = document.querySelectorAll("[data-notification-bell]");

  bells.forEach((bell) => {
    // Remove existing badge
    const existing = bell.querySelector(".notifBadge");
    if (existing) existing.remove();

    if (count > 0) {
      const badge = document.createElement("span");
      badge.className = "notifBadge";
      const display = count > 99 ? "99+" : count;
      badge.textContent = display;
      if (count >= 10) badge.classList.add("multi-digit");
      bell.appendChild(badge);
    }
  });
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Start a real-time listener for unread notifications and update bell badges.
 * @param {string} collectionPath - e.g. "customers/abc123/notifications"
 */
export function initNotificationBadge(collectionPath) {
  // Clean up previous
  cleanupNotificationBadge();

  injectBadgeStyles();

  const q = query(
    collection(db, ...collectionPath.split("/")),
    where("isRead", "==", false),
  );

  badgeUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
      updateBadge(snapshot.size);
    },
    (error) => {
      console.error("Notification badge listener error:", error);
    },
  );
}

/**
 * Stop listening and remove badges.
 */
export function cleanupNotificationBadge() {
  if (badgeUnsubscribe) {
    badgeUnsubscribe();
    badgeUnsubscribe = null;
  }
  updateBadge(0);
}
