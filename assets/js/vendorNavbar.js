/**
 * Shared Vendor Navbar Component
 * Handles vendor name display, logout, and settings dropdown for all vendor pages
 */

import { auth, db } from "../../firebase/config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  initNotificationBadge,
  cleanupNotificationBadge,
} from "./notificationBadge.js";
import {
  initToastContainer,
  subscribeToNewNotifications,
  cleanupToastNotifications,
} from "./toastNotifications.js";

/**
 * Initialize the vendor navbar
 * Sets up auth listener, vendor name display, logout, and keyboard shortcuts
 */
export function initVendorNavbar() {
  // Inject skeleton styles if not already present
  if (!document.getElementById("vendor-skeleton-styles")) {
    const style = document.createElement("style");
    style.id = "vendor-skeleton-styles";
    style.textContent = `
      .skeleton {
        background: linear-gradient(90deg, #e8e4ec 25%, #f4f1f6 50%, #e8e4ec 75%);
        background-size: 200% 100%;
        animation: skeletonPulse 1.5s ease-in-out infinite;
        border-radius: 4px;
        min-height: 2.4em;
        flex: 1;
      }
      @keyframes skeletonPulse {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // Show skeleton loading state for vendor name
  const vendorNameEl = document.querySelector(".vendorName");
  if (vendorNameEl) {
    vendorNameEl.textContent = "\u00A0";
    vendorNameEl.classList.add("skeleton");
  }

  // Setup logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // Setup settings dropdown toggle
  initSettingsDropdown();

  // Setup keyboard shortcuts (Ctrl/Cmd+K for search)
  setupKeyboardShortcuts();

  // Listen for auth state changes
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const vendorData = await updateVendorDisplay(user.uid);
      initNotificationBadge(`vendors/${user.uid}/notifications`);

      // Only show browser toast notifications if the vendor has them enabled
      const browserNotifsEnabled = vendorData?.browserNotifications !== false;
      if (browserNotifsEnabled) {
        initToastContainer();
        subscribeToNewNotifications(`vendors/${user.uid}/notifications`);
      }
    } else {
      // Redirect to login if not authenticated
      window.location.href = "../Auth/login.html";
    }
  });
}

/**
 * Fetch vendor data and update display
 */
async function updateVendorDisplay(userId) {
  try {
    const vendorDoc = await getDoc(doc(db, "vendors", userId));

    if (vendorDoc.exists()) {
      const vendorData = vendorDoc.data();
      const displayName =
        vendorData.storeName || vendorData.displayName || "My Store";
      updateVendorName(displayName);
      return vendorData;
    } else {
      updateVendorName("My Store");
      return null;
    }
  } catch (error) {
    console.error("Error fetching vendor data:", error);
    updateVendorName("My Store");
    return null;
  }
}

/**
 * Update vendor name in sidebar
 */
function updateVendorName(name) {
  const vendorNameEl = document.querySelector(".vendorName");
  if (vendorNameEl) {
    vendorNameEl.classList.remove("skeleton");
    vendorNameEl.textContent = name;
  }
}

/**
 * Handle user logout
 */
async function handleLogout() {
  try {
    await signOut(auth);
    window.location.href = "../../index.html";
  } catch (error) {
    console.error("Logout error:", error);
    alert("Failed to logout. Please try again.");
  }
}

/**
 * Initialize settings dropdown toggle
 */
function initSettingsDropdown() {
  const settingsButton = document.querySelector(".settingsButton");
  const settingsDropdown = document.getElementById("settingsDropdown");

  if (settingsButton && settingsDropdown) {
    settingsButton.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsDropdown.classList.toggle("active");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (
        !settingsDropdown.contains(e.target) &&
        !settingsButton.contains(e.target)
      ) {
        settingsDropdown.classList.remove("active");
      }
    });
  }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  const isMac = window.navigator.userAgentData
    ? window.navigator.userAgentData.platform === "macOS"
    : /Mac/i.test(window.navigator.userAgent);

  // Update the search key modifier display
  const searchKeyModEl = document.getElementById("searchKeyMod");
  if (searchKeyModEl) {
    searchKeyModEl.textContent = isMac ? "⌘" : "CTRL";
  }

  // Ctrl/Cmd+K focuses search
  document.addEventListener("keydown", (e) => {
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    if (modifier && e.key === "k") {
      e.preventDefault();
      const searchInput = document.getElementById("searchInput");
      if (searchInput) {
        searchInput.focus();
      }
    }
  });
}

/**
 * Get current authenticated user
 * Returns a promise that resolves with the user or null
 */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Get current vendor data
 * Returns a promise that resolves with vendor data or null
 */
export async function getCurrentVendor() {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const vendorDoc = await getDoc(doc(db, "vendors", user.uid));
    if (vendorDoc.exists()) {
      return { id: vendorDoc.id, ...vendorDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return null;
  }
}
