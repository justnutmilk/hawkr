/**
 * Hawkr - Vendor Dashboard
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

/**
 * Initialize dashboard when DOM is ready
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
        renderDashboard();
      }
    } else {
      // Vendor profile doesn't exist - might be new user
      updateVendorName("My Store");
      orders = [];
      renderDashboard();
    }
  } catch (error) {
    console.error("Error loading vendor data:", error);
    // Fallback to empty state
    updateVendorName("My Store");
    orders = [];
    renderDashboard();
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
    // Get recent orders (preparing, ready, or recent completed)
    const ordersQuery = query(
      collection(db, "orders"),
      where("stallId", "==", stallId),
      orderBy("createdAt", "desc"),
      limit(10),
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
        itemCount: data.items?.length || 0,
        total: data.total || 0,
        transactionId: data.transactionId || doc.id,
        status: data.status || "pending",
      };
    });

    renderDashboard();
  } catch (error) {
    console.error("Error loading orders:", error);
    orders = [];
    renderDashboard();
  }
}

/**
 * Format date for display
 */
function formatDate(date) {
  return date.toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/**
 * Format time for display
 */
function formatTime(date) {
  return date.toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
      <a href="../Vendor Order/vendorOrder.html" class="orderItemCount">${order.itemCount} Item${order.itemCount !== 1 ? "s" : ""} &rarr;</a>
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
function renderEmptyOrderState() {
  return `
    <div class="emptyOrderState">
      <svg class="emptyOrderIcon" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
        <path d="M9 14l2 2 4-4"></path>
      </svg>
      <h3 class="emptyOrderTitle">No orders yet</h3>
      <p class="emptyOrderDescription">When customers place orders, they'll appear here.</p>
    </div>
  `;
}

/**
 * Render dashboard content
 */
function renderDashboard() {
  const container = document.getElementById("dashboardContent");

  const orderLineContent =
    orders.length > 0
      ? orders.map(renderOrderLineItem).join("")
      : renderEmptyOrderState();

  container.innerHTML = `
    <div class="orderLineSection">
      <span class="sectionLabel">ORDER LINE</span>
      <div class="orderLineCards">
        ${orderLineContent}
      </div>
    </div>

    <div class="quickStatsSection">
      <span class="sectionLabel">QUICK STATS</span>
      <div class="quickStatsBlocks">
        <div class="statBlock">
          <span class="statBlockLabel">Today</span>
          <span class="statBlockValue">$${calculateTodayRevenue().toFixed(2)}</span>
        </div>
        <div class="statBlock">
          <span class="statBlockLabel">This Month</span>
          <span class="statBlockValue">$${calculateMonthRevenue().toFixed(2)}</span>
        </div>
        <div class="statBlock">
          <span class="statBlockLabel">Customer Satisfaction</span>
          <span class="statBlockPlaceholder">Graph coming soon</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Calculate today's revenue from loaded orders
 */
function calculateTodayRevenue() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return orders
    .filter((order) => {
      const orderDate = parseOrderDate(order.date);
      return orderDate >= today;
    })
    .reduce((sum, order) => sum + order.total, 0);
}

/**
 * Calculate this month's revenue from loaded orders
 */
function calculateMonthRevenue() {
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  return orders
    .filter((order) => {
      const orderDate = parseOrderDate(order.date);
      return orderDate >= firstOfMonth;
    })
    .reduce((sum, order) => sum + order.total, 0);
}

/**
 * Parse order date string back to Date object
 */
function parseOrderDate(dateStr) {
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10) + 2000;
    return new Date(year, month, day);
  }
  return new Date();
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
    searchKeyModEl.textContent = isMac ? "⌘" : "CTRL";
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
