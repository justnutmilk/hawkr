/**
 * Hawkr - Vendor Orders Page
 * Queries Firestore for vendor info and orders
 */

import { auth, db } from "../../firebase/config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// State
let currentVendor = null;
let currentStall = null;
let orders = [];
let currentTab = "preparing";

/**
 * Initialize page when DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
  // Initialize vendor navbar (handles auth, vendor name, logout, keyboard shortcuts)
  initVendorNavbar();

  // Check auth state for loading orders
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await loadVendorData(user.uid);
    }
  });

  // Setup tab switching
  setupTabSwitching();
});

/**
 * Load vendor data from Firestore
 */
async function loadVendorData(userId) {
  try {
    // Get vendor profile
    const vendorDoc = await getDoc(doc(db, "vendors", userId));

    if (vendorDoc.exists()) {
      currentVendor = { id: vendorDoc.id, ...vendorDoc.data() };

      // Update vendor name in sidebar
      updateVendorName(
        currentVendor.storeName || currentVendor.displayName || "My Store",
      );

      // Get vendor's stall
      const stallsQuery = query(
        collection(db, "foodStalls"),
        where("ownerId", "==", userId),
        limit(1),
      );
      const stallsSnapshot = await getDocs(stallsQuery);

      if (!stallsSnapshot.empty) {
        currentStall = {
          id: stallsSnapshot.docs[0].id,
          ...stallsSnapshot.docs[0].data(),
        };

        // Load orders for this stall
        await loadOrders(currentStall.id);
      } else {
        // No stall found - render with empty orders
        orders = [];
        renderOrders(currentTab);
      }
    } else {
      // Vendor profile doesn't exist
      updateVendorName("My Store");
      orders = [];
      renderOrders(currentTab);
    }
  } catch (error) {
    console.error("Error loading vendor data:", error);
    updateVendorName("My Store");
    orders = [];
    renderOrders(currentTab);
  }
}

/**
 * Update vendor name in sidebar
 */
function updateVendorName(name) {
  const vendorNameEl = document.querySelector(".vendorName");
  if (vendorNameEl) {
    vendorNameEl.textContent = name;
  }
}

/**
 * Load orders for a stall
 */
async function loadOrders(stallId) {
  try {
    const ordersQuery = query(
      collection(db, "orders"),
      where("stallId", "==", stallId),
      orderBy("createdAt", "desc"),
      limit(50),
    );

    const ordersSnapshot = await getDocs(ordersQuery);

    orders = ordersSnapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();

      return {
        id: doc.id,
        orderNumber: doc.id.slice(-4).toUpperCase(),
        customerName: data.customerName || "Customer",
        date: formatDate(createdAt),
        time: formatTime(createdAt),
        type: data.orderType || "Takeaway",
        status: mapStatus(data.status),
        items: (data.items || []).map((item) => ({
          qty: item.quantity || 1,
          name: item.name || "Item",
          price: item.totalPrice || item.unitPrice || 0,
          note: item.notes || null,
        })),
        total: data.total || 0,
        transactionId: data.transactionId || doc.id,
      };
    });

    renderOrders(currentTab);
  } catch (error) {
    console.error("Error loading orders:", error);
    orders = [];
    renderOrders(currentTab);
  }
}

/**
 * Map database status to UI status
 */
function mapStatus(status) {
  const preparingStatuses = ["pending", "confirmed", "preparing", "ready"];
  const completeStatuses = ["completed", "cancelled"];

  if (completeStatuses.includes(status)) {
    return "complete";
  }
  return "preparing";
}

/**
 * Format date for display
 */
function formatDate(date) {
  return date
    .toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "-");
}

/**
 * Format time for display
 */
function formatTime(date) {
  return date.toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Render order entry (item within an order)
 */
function renderOrderEntry(item) {
  return `
    <div class="orderEntry">
      <span class="orderEntryQty">${item.qty}</span>
      <div class="orderEntryDetails">
        <span class="orderEntryName">${item.name}</span>
        ${item.note ? `<span class="orderEntryNote">${item.note}</span>` : ""}
      </div>
      ${item.price !== null ? `<span class="orderEntryPrice">$${item.price.toFixed(2)}</span>` : ""}
    </div>
  `;
}

/**
 * Render order line item
 */
function renderOrderLineItem(order) {
  return `
    <div class="orderLineItem">
      <div class="orderItemNumber">#${order.orderNumber}</div>
      <div class="orderLineImportant">
        <div class="orderItemCustomerName">${order.customerName}</div>
        <div class="orderItemDateTime">${order.date}, ${order.time}</div>
      </div>
      <div class="orderItemType">${order.type}</div>
      <div class="orderItemsList">
        ${order.items.map(renderOrderEntry).join("")}
      </div>
      <div class="orderLineImportant">
        <div class="orderItemTotalRow">
          <div class="orderItemTotal">Total</div>
          <div class="orderItemTotalValue">$${order.total.toFixed(2)}</div>
        </div>
        <div class="orderItemTransaction">
          <span class="orderItemTransactionLabel">Transaction ID: </span><span class="orderItemTransactionId">${order.transactionId}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render empty order state
 */
function renderEmptyOrderState(tab) {
  const message =
    tab === "preparing"
      ? "No orders being prepared right now."
      : "No completed orders yet.";

  return `
    <div class="emptyOrderState">
      <svg class="emptyOrderIcon" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
        <path d="M9 14l2 2 4-4"></path>
      </svg>
      <h3 class="emptyOrderTitle">No orders</h3>
      <p class="emptyOrderDescription">${message}</p>
    </div>
  `;
}

/**
 * Render orders
 */
function renderOrders(tab) {
  const container = document.getElementById("orderContent");
  const filtered = orders.filter((o) => o.status === tab);

  const orderContent =
    filtered.length > 0
      ? filtered.map(renderOrderLineItem).join("")
      : renderEmptyOrderState(tab);

  container.innerHTML = `
    <div class="orderLineHeader">
      <span class="sectionLabel">Order Line</span>
      <a class="newOrderButton" href="vendorCreateOrder.html">
        New order
        <kbd>n</kbd>
      </a>
    </div>
    <div class="orderLineCards">
      ${orderContent}
    </div>
  `;
}

/**
 * Setup tab switching
 */
function setupTabSwitching() {
  document.querySelectorAll('input[name="orderTab"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      currentTab = radio.value;
      renderOrders(currentTab);
    });
  });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  const isMac = window.navigator.userAgentData
    ? window.navigator.userAgentData.platform === "macOS"
    : /Mac/i.test(window.navigator.userAgent);

  const searchKeyModEl = document.getElementById("searchKeyMod");
  if (searchKeyModEl) {
    searchKeyModEl.textContent = isMac ? "\u2318" : "CTRL";
  }

  document.addEventListener("keydown", (e) => {
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    if (modifier && e.key === "k") {
      e.preventDefault();
      const searchInput = document.getElementById("searchInput");
      if (searchInput) {
        searchInput.focus();
      }
    }
    // "n" key navigates to create order page (only when not typing in an input)
    if (
      e.key === "n" &&
      !modifier &&
      !e.altKey &&
      e.target.tagName !== "INPUT" &&
      e.target.tagName !== "TEXTAREA"
    ) {
      window.location.href = "vendorCreateOrder.html";
    }
  });
}

/**
 * Setup logout button handler
 */
function setupLogoutButton() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }
}

/**
 * Handle user logout
 */
async function handleLogout() {
  try {
    await signOut(auth);
    // Redirect will be handled by onAuthStateChanged
  } catch (error) {
    console.error("Logout error:", error);
    alert("Failed to logout. Please try again.");
  }
}
