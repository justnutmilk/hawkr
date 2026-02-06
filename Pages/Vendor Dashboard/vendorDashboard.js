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

// Search Module State
const VENDOR_SEARCH_HISTORY_KEY = "hawkr_vendor_search_history";
const MAX_SEARCH_HISTORY = 10;
let searchHistory = [];
let searchableItems = [];
let currentSearchQuery = "";
let selectedResultIndex = -1;

// Navigation pages for vendor (static)
const vendorNavigationPages = [
  {
    id: "nav-home",
    type: "page",
    name: "Home",
    keywords: "home dashboard main",
    icon: "../../assets/icons/home.svg",
    color: "#EAF5E9",
    url: "vendorDashboard.html",
  },
  {
    id: "nav-orders",
    type: "page",
    name: "Orders",
    keywords: "orders order list queue pending preparing ready",
    icon: "../../assets/icons/orders.svg",
    color: "#F6EEF9",
    url: "../Vendor Order/vendorOrder.html",
  },
  {
    id: "nav-payments",
    type: "page",
    name: "Payments",
    keywords: "payments transactions money revenue income payout",
    icon: "../../assets/icons/payments.svg",
    color: "#E8F5E9",
    url: "../Vendor Payments/vendorPayments.html",
  },
  {
    id: "nav-reviews",
    type: "page",
    name: "Reviews",
    keywords: "reviews feedback ratings stars comments customers",
    icon: "../../assets/icons/star.svg",
    color: "#FFF8E1",
    url: "../Vendor Reviews/vendorReviews.html",
  },
  {
    id: "nav-menu",
    type: "page",
    name: "Menu",
    keywords: "menu items food dishes products catalog",
    icon: "../../assets/icons/menu.svg",
    color: "#F2F5FC",
    url: "../Vendor Menu/vendorMenu.html",
  },
  {
    id: "nav-notifications",
    type: "page",
    name: "Notifications",
    keywords: "notifications alerts messages bell updates",
    icon: "../../assets/icons/notifications.svg",
    color: "#F2F5FC",
    url: "../Vendor Notifications/vendorNotifications.html",
  },
  {
    id: "nav-tenancy",
    type: "page",
    name: "Tenancy",
    keywords: "tenancy lease contract stall rental",
    icon: "../../assets/icons/tenancy.svg",
    color: "#FFEBEB",
    url: "#",
  },
  {
    id: "nav-create-order",
    type: "page",
    name: "Create Order",
    keywords: "create order new manual walk-in customer",
    icon: "../../assets/icons/add.svg",
    color: "#E3F2FD",
    url: "../Vendor Order/vendorCreateOrder.html",
  },
];

/**
 * Initialize dashboard when DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
  // Initialize vendor navbar (handles auth, vendor name, logout, keyboard shortcuts)
  initVendorNavbar();

  // Initialize search module
  initializeVendorSearchModule();

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

      // Get vendor's stall - first try using stallId from vendor profile
      let stallDoc = null;
      if (currentVendor.stallId) {
        console.log("Vendor has stallId in profile:", currentVendor.stallId);
        const stallRef = doc(db, "foodStalls", currentVendor.stallId);
        const stallSnap = await getDoc(stallRef);
        if (stallSnap.exists()) {
          stallDoc = { id: stallSnap.id, ...stallSnap.data() };
        }
      }

      // Fallback: query by ownerId
      if (!stallDoc) {
        console.log("Querying stalls by ownerId:", userId);
        const stallsQuery = query(
          collection(db, "foodStalls"),
          where("ownerId", "==", userId),
          limit(1),
        );
        const stallsSnapshot = await getDocs(stallsQuery);
        if (!stallsSnapshot.empty) {
          stallDoc = {
            id: stallsSnapshot.docs[0].id,
            ...stallsSnapshot.docs[0].data(),
          };
        }
      }

      if (stallDoc) {
        currentStall = stallDoc;
        console.log("Found stall:", currentStall.id, currentStall.name);

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
  console.log("Loading orders for stallId:", stallId);
  try {
    // Get recent orders (preparing, ready, or recent completed)
    const ordersQuery = query(
      collection(db, "orders"),
      where("stallId", "==", stallId),
      orderBy("createdAt", "desc"),
      limit(10),
    );

    const ordersSnapshot = await getDocs(ordersQuery);
    console.log("Orders found:", ordersSnapshot.size);

    orders = ordersSnapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();

      return {
        id: doc.id,
        orderNumber: data.orderNumber || doc.id.slice(-4).toUpperCase(),
        customerName: data.customerName || "Customer",
        date: formatDate(createdAt),
        time: formatTime(createdAt),
        type: data.orderType || "Takeaway",
        itemCount: data.items?.length || 0,
        total: data.total || 0,
        transactionId: data.hawkrTransactionId || data.transactionId || doc.id,
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

// ============================================
// VENDOR SEARCH MODULE
// ============================================

/**
 * Get search history from local storage
 */
function getSearchHistoryFromStorage() {
  try {
    const stored = localStorage.getItem(VENDOR_SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Error loading search history:", e);
    return [];
  }
}

/**
 * Save search history to local storage
 */
function saveSearchHistoryToStorage(history) {
  try {
    localStorage.setItem(VENDOR_SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Error saving search history:", e);
  }
}

/**
 * Add item to search history
 */
function addToSearchHistory(item) {
  const historyEntry = {
    ...item,
    searchedAt: formatSearchTime(new Date()),
  };

  searchHistory = searchHistory.filter(
    (h) => !(h.id === item.id && h.type === item.type),
  );

  searchHistory.unshift(historyEntry);

  if (searchHistory.length > MAX_SEARCH_HISTORY) {
    searchHistory = searchHistory.slice(0, MAX_SEARCH_HISTORY);
  }

  saveSearchHistoryToStorage(searchHistory);
}

/**
 * Format search time for display
 */
function formatSearchTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Build searchable items from orders and navigation pages
 */
function buildSearchableItems() {
  searchableItems = [...vendorNavigationPages];

  // Add orders to searchable items
  orders.forEach((order) => {
    // Mask transaction ID (show first 3 chars, mask middle, show last 4)
    const txnId = order.transactionId || order.id;
    const maskedTxnId =
      txnId.length > 10
        ? `${txnId.slice(0, 3)}-${"*".repeat(8)}-${txnId.slice(-4).toUpperCase()}`
        : txnId;

    searchableItems.push({
      id: order.id,
      type: "order",
      name: `Order #${order.orderNumber}`,
      dateTime: `${order.date}, ${order.time}`,
      customerName: order.customerName,
      keywords:
        `order ${order.orderNumber} ${order.customerName} ${order.transactionId}`.toLowerCase(),
      icon: "../../assets/icons/orders.svg",
      color: "#F6EEF9",
      image: order.image || null,
      url: `../Vendor Order/vendorOrder.html?order=${order.id}`,
      data: order,
    });

    // Add customer as searchable
    searchableItems.push({
      id: `customer-${order.id}`,
      type: "customer",
      name: order.customerName,
      subtitle: `Order #${order.orderNumber} • $${order.total.toFixed(2)}`,
      keywords: `customer ${order.customerName}`.toLowerCase(),
      icon: "../../assets/icons/vendor.svg",
      color: "#E3F2FD",
      url: `../Vendor Order/vendorOrder.html?order=${order.id}`,
      data: order,
    });

    // Add payment/transaction as searchable
    searchableItems.push({
      id: `payment-${order.id}`,
      type: "payment",
      name: "Transaction",
      dateTime: `${order.date}, ${order.time}`,
      transactionId: maskedTxnId,
      customerName: order.customerName,
      keywords:
        `payment transaction ${order.transactionId} ${order.total} ${order.customerName}`.toLowerCase(),
      icon: "../../assets/icons/payments.svg",
      color: "#F6EEF9",
      url: `../Vendor Payments/vendorPayments.html?transaction=${order.transactionId}`,
      data: order,
    });
  });

  // TODO: Fetch reviews from Firebase - using mock data for now
  const mockReviews = [
    {
      id: "review-1",
      feedbackId: "FB001",
      title: "Great food, fast service!",
      customerName: "John Tan",
      stars: 5,
      requiresContact: false,
    },
    {
      id: "review-2",
      feedbackId: "FB002",
      title: "Food was cold",
      customerName: "Sarah Lim",
      stars: 2,
      requiresContact: true,
    },
  ];

  mockReviews.forEach((review) => {
    searchableItems.push({
      id: review.id,
      type: "review",
      name: review.title,
      customerName: review.customerName,
      stars: review.stars,
      requiresContact: review.requiresContact,
      feedbackId: review.feedbackId,
      keywords:
        `review feedback ${review.title} ${review.customerName} ${review.feedbackId} ${review.stars} star`.toLowerCase(),
      icon: "../../assets/icons/star.svg",
      color: "#FFF8E1",
      url: `../Vendor Reviews/vendorReviews.html?review=${review.id}`,
      data: review,
    });
  });
}

/**
 * Fuzzy search with Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Check if a search word fuzzy matches any text words
 */
function fuzzyMatchWord(searchWord, textWords, maxDistance = 2) {
  if (
    textWords.some((tw) => tw.includes(searchWord) || searchWord.includes(tw))
  ) {
    return true;
  }

  const allowedDistance = searchWord.length <= 4 ? 1 : maxDistance;

  return textWords.some((tw) => {
    if (Math.abs(tw.length - searchWord.length) > allowedDistance) {
      return false;
    }
    return levenshteinDistance(searchWord, tw) <= allowedDistance;
  });
}

/**
 * Search items by query
 */
function searchItems(query) {
  if (!query || query.trim() === "") {
    return [];
  }

  const stopWords = [
    "at",
    "the",
    "in",
    "on",
    "a",
    "an",
    "of",
    "for",
    "and",
    "or",
    "from",
  ];

  const words = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((word) => !stopWords.includes(word) && word.length > 0);

  if (words.length === 0) {
    return [];
  }

  return searchableItems.filter((item) => {
    let searchText = item.name.toLowerCase();
    if (item.subtitle) {
      searchText += ` ${item.subtitle.toLowerCase()}`;
    }
    if (item.keywords) {
      searchText += ` ${item.keywords.toLowerCase()}`;
    }

    const textWords = searchText.split(/\s+/);

    return words.every((word) => fuzzyMatchWord(word, textWords));
  });
}

/**
 * Render star icons using star.svg
 */
function renderStars(count) {
  let stars = "";
  for (let i = 0; i < count; i++) {
    stars += `<img class="searchResultStar" src="../../assets/icons/star.svg" alt="star">`;
  }
  return stars;
}

/**
 * Render a search result item
 */
function renderSearchResultItem(item, isHistory = false) {
  const metaText = isHistory ? item.searchedAt : "";
  const metaClass = isHistory ? "searchResultMeta history" : "searchResultMeta";
  const bgColor = item.color || "#F6EEF9";

  // Order format: image/icon, order number, dateTime, customerName on right
  if (item.type === "order") {
    const imageHTML = item.image
      ? `<div class="searchResultImage"><img src="${item.image}" alt="${item.name}"></div>`
      : `<div class="searchResultImage searchResultIcon" style="background: ${bgColor}"><img src="${item.icon}" alt="${item.name}"></div>`;

    return `
      <div class="searchResultItem searchResultOrder" data-type="${item.type}" data-id="${item.id}" data-url="${item.url || ""}">
        ${imageHTML}
        <div class="searchResultInfo">
          <span class="searchResultName">${item.name}</span>
          <span class="searchResultSubtitle">${item.dateTime}</span>
        </div>
        <span class="searchResultCustomerName">${item.customerName}</span>
      </div>
    `;
  }

  // Transaction format: icon, "Transaction", dateTime, masked txn ID, customerName on right
  if (item.type === "payment") {
    return `
      <div class="searchResultItem searchResultTransaction" data-type="${item.type}" data-id="${item.id}" data-url="${item.url || ""}">
        <div class="searchResultImage searchResultIcon" style="background: ${bgColor}">
          <img src="${item.icon}" alt="${item.name}">
        </div>
        <div class="searchResultInfo">
          <span class="searchResultName">${item.name}</span>
          <span class="searchResultSubtitle">${item.dateTime}</span>
          <span class="searchResultTxnId">${item.transactionId}</span>
        </div>
        <span class="searchResultCustomerName">${item.customerName}</span>
      </div>
    `;
  }

  // Review format: icon | title+stars (space-between with toggle) | customerName
  if (item.type === "review") {
    const toggleOn = item.requiresContact;

    return `
      <div class="searchResultItem searchResultReview" data-type="${item.type}" data-id="${item.id}" data-url="${item.url || ""}">
        <div class="searchResultLeft">
          <div class="searchResultImage searchResultIcon" style="background: ${bgColor}">
            <img src="${item.icon}" alt="${item.name}">
          </div>
          <div class="searchResultReviewContent">
            <div class="searchResultReviewTop">
              <span class="searchResultName">${item.name}</span>
              <span class="searchResultCustomerName">${item.customerName}</span>
            </div>
            <div class="searchResultReviewBottom">
              <div class="searchResultStars">${renderStars(item.stars)}</div>
              <div class="searchResultToggle ${toggleOn ? "on" : ""}" title="Contact requested: ${toggleOn ? "Yes" : "No"}">
                <div class="searchResultToggleTrack">
                  <div class="searchResultToggleThumb"></div>
                </div>
                <span class="searchResultToggleLabel">Contact me</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Default format for pages, customers, etc.
  return `
    <div class="searchResultItem" data-type="${item.type}" data-id="${item.id}" data-url="${item.url || ""}">
      <div class="searchResultImage searchResultIcon" style="background: ${bgColor}">
        <img src="${item.icon}" alt="${item.name}">
      </div>
      <div class="searchResultInfo">
        <span class="searchResultName">${item.name}</span>
        ${item.subtitle ? `<span class="searchResultSubtitle">${item.subtitle}</span>` : ""}
        ${metaText ? `<span class="${metaClass}">${metaText}</span>` : ""}
      </div>
    </div>
  `;
}

/**
 * Render the search dropdown
 */
function renderSearchDropdown(query = "") {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  // Rebuild searchable items to include latest orders
  buildSearchableItems();

  let contentHTML = "";

  if (query && query.trim() !== "") {
    const results = searchItems(query);
    if (results.length > 0) {
      // Group results by type
      const pages = results.filter((r) => r.type === "page");
      const ordersResults = results.filter((r) => r.type === "order");
      const customers = results.filter((r) => r.type === "customer");
      const payments = results.filter((r) => r.type === "payment");
      const reviews = results.filter((r) => r.type === "review");

      if (pages.length > 0) {
        contentHTML += `
          <div class="searchSection">
            <span class="searchSectionHeader">Pages</span>
            ${pages.map((item) => renderSearchResultItem(item)).join("")}
          </div>
        `;
      }
      if (ordersResults.length > 0) {
        contentHTML += `
          <div class="searchSection">
            <span class="searchSectionHeader">Orders</span>
            ${ordersResults.map((item) => renderSearchResultItem(item)).join("")}
          </div>
        `;
      }
      if (customers.length > 0) {
        contentHTML += `
          <div class="searchSection">
            <span class="searchSectionHeader">Customers</span>
            ${customers.map((item) => renderSearchResultItem(item)).join("")}
          </div>
        `;
      }
      if (payments.length > 0) {
        contentHTML += `
          <div class="searchSection">
            <span class="searchSectionHeader">Transactions</span>
            ${payments.map((item) => renderSearchResultItem(item)).join("")}
          </div>
        `;
      }
      if (reviews.length > 0) {
        contentHTML += `
          <div class="searchSection">
            <span class="searchSectionHeader">Reviews</span>
            ${reviews.map((item) => renderSearchResultItem(item)).join("")}
          </div>
        `;
      }
    } else {
      contentHTML = `
        <div class="searchSection">
          <span class="searchSectionHeader">Search Results</span>
          <span class="searchEmptyState">No results found for "${query}"</span>
        </div>
      `;
    }
  } else {
    // Show history and suggestions when no query
    const hasHistory = searchHistory.length > 0;

    let historySection = "";
    if (hasHistory) {
      const historyItemsHTML = searchHistory
        .map((item) => renderSearchResultItem(item, true))
        .join("");
      historySection = `
        <div class="searchSection">
          <span class="searchSectionHeader">Recent</span>
          ${historyItemsHTML}
        </div>
      `;
    }

    // Quick actions section
    const quickActions = vendorNavigationPages.slice(0, 5);
    const quickActionsHTML = quickActions
      .map((item) => renderSearchResultItem(item))
      .join("");
    const quickActionsSection = `
      <div class="searchSection">
        <span class="searchSectionHeader">Quick Actions</span>
        ${quickActionsHTML}
      </div>
    `;

    contentHTML = historySection + quickActionsSection;
  }

  dropdown.innerHTML = `
    <div class="searchDropdownHeader">
      <span class="searchIcon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 18 18" fill="none">
          <path d="M16.6 18L10.3 11.7C9.8 12.1 9.225 12.4167 8.575 12.65C7.925 12.8833 7.23333 13 6.5 13C4.68333 13 3.14583 12.3708 1.8875 11.1125C0.629167 9.85417 0 8.31667 0 6.5C0 4.68333 0.629167 3.14583 1.8875 1.8875C3.14583 0.629167 4.68333 0 6.5 0C8.31667 0 9.85417 0.629167 11.1125 1.8875C12.3708 3.14583 13 4.68333 13 6.5C13 7.23333 12.8833 7.925 12.65 8.575C12.4167 9.225 12.1 9.8 11.7 10.3L18 16.6L16.6 18ZM6.5 11C7.75 11 8.8125 10.5625 9.6875 9.6875C10.5625 8.8125 11 7.75 11 6.5C11 5.25 10.5625 4.1875 9.6875 3.3125C8.8125 2.4375 7.75 2 6.5 2C5.25 2 4.1875 2.4375 3.3125 3.3125C2.4375 4.1875 2 5.25 2 6.5C2 7.75 2.4375 8.8125 3.3125 9.6875C4.1875 10.5625 5.25 11 6.5 11Z" fill="#49454F"/>
        </svg>
      </span>
      <input type="text" class="searchInputLarge" id="searchInputLarge" placeholder="Search for anything..." autocomplete="off" value="${query}">
    </div>
    <div class="searchDropdownContent">
      ${contentHTML}
    </div>
  `;

  // Focus the large input
  const largeInput = document.getElementById("searchInputLarge");
  if (largeInput) {
    largeInput.focus();
    const len = largeInput.value.length;
    largeInput.setSelectionRange(len, len);
  }

  // Attach event listeners to result items
  const resultItems = dropdown.querySelectorAll(".searchResultItem");
  resultItems.forEach((item, index) => {
    item.addEventListener("click", () => {
      const type = item.dataset.type;
      const id = item.dataset.id;
      const url = item.dataset.url || null;
      handleSearchResultClick(type, id, url);
    });

    item.addEventListener("mousemove", (e) => {
      const rect = item.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      item.style.setProperty("--mouse-x", `${x}px`);
      item.style.setProperty("--mouse-y", `${y}px`);
    });

    item.addEventListener("mouseenter", () => {
      selectedResultIndex = index;
      updateSelectedResult();
    });

    item.addEventListener("mouseleave", () => {
      selectedResultIndex = -1;
      updateSelectedResult();
    });
  });
}

/**
 * Update visual selection state
 */
function updateSelectedResult() {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  const items = dropdown.querySelectorAll(".searchResultItem");
  items.forEach((item, index) => {
    if (index === selectedResultIndex) {
      item.classList.add("selected");
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      item.classList.remove("selected");
    }
  });
}

/**
 * Handle keyboard navigation in search
 */
function handleSearchKeydown(e) {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  const items = dropdown.querySelectorAll(".searchResultItem");
  if (items.length === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedResultIndex = Math.min(selectedResultIndex + 1, items.length - 1);
    updateSelectedResult();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedResultIndex = Math.max(selectedResultIndex - 1, 0);
    updateSelectedResult();
  } else if (e.key === "Enter" && selectedResultIndex >= 0) {
    e.preventDefault();
    const selectedItem = items[selectedResultIndex];
    if (selectedItem) {
      const type = selectedItem.dataset.type;
      const id = selectedItem.dataset.id;
      const url = selectedItem.dataset.url || null;
      handleSearchResultClick(type, id, url);
    }
  }
}

/**
 * Handle click on search result
 */
function handleSearchResultClick(type, id, url = null) {
  const item = searchableItems.find(
    (i) => i.id.toString() === id.toString() && i.type === type,
  );

  if (item) {
    addToSearchHistory(item);
  }

  // Navigate to appropriate page
  if (url && url !== "#") {
    window.location.href = url;
  }
}

/**
 * Handle search input changes
 */
function handleSearchInput(e) {
  currentSearchQuery = e.target.value;
  selectedResultIndex = -1;
  renderSearchDropdown(currentSearchQuery);
  setupSearchInputListener();
}

/**
 * Setup listener for the large search input
 */
function setupSearchInputListener() {
  const largeInput = document.getElementById("searchInputLarge");
  if (!largeInput) return;

  largeInput.removeEventListener("input", handleSearchInput);
  largeInput.removeEventListener("keydown", handleSearchKeydown);

  largeInput.addEventListener("input", handleSearchInput);
  largeInput.addEventListener("keydown", handleSearchKeydown);
}

/**
 * Initialize the vendor search module
 */
function initializeVendorSearchModule() {
  const searchWrapper = document.getElementById("searchModuleWrapper");
  const searchInput = document.getElementById("searchInput");
  const searchDropdown = document.getElementById("searchDropdown");

  if (!searchWrapper || !searchInput || !searchDropdown) return;

  // Load search history
  searchHistory = getSearchHistoryFromStorage();

  // Build initial searchable items
  buildSearchableItems();

  // Handle focus on search input
  searchInput.addEventListener("focus", () => {
    selectedResultIndex = -1;
    searchHistory = getSearchHistoryFromStorage();
    currentSearchQuery = searchInput.value;

    requestAnimationFrame(() => {
      searchWrapper.classList.add("active");
      renderSearchDropdown(currentSearchQuery);
      searchInput.value = "";
      setupSearchInputListener();
    });
  });

  // Handle input in the small search bar
  searchInput.addEventListener("input", () => {
    if (searchWrapper.classList.contains("active")) {
      const largeInput = document.getElementById("searchInputLarge");
      if (largeInput) {
        largeInput.value = searchInput.value;
        currentSearchQuery = searchInput.value;
        searchInput.value = "";
        largeInput.focus();
        renderSearchDropdown(currentSearchQuery);
        setupSearchInputListener();
      }
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    const isClickInsideDropdown = searchDropdown.contains(e.target);
    const isClickInsideWrapper = searchWrapper.contains(e.target);
    if (!isClickInsideWrapper && !isClickInsideDropdown) {
      searchWrapper.classList.remove("active");
      currentSearchQuery = "";
      selectedResultIndex = -1;
    }
  });

  // Handle escape key and keyboard shortcut
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchWrapper.classList.remove("active");
      searchInput.blur();
      currentSearchQuery = "";
      selectedResultIndex = -1;
    }

    // Cmd/Ctrl + K shortcut
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      const targetTag = e.target.tagName.toLowerCase();
      const isEditable = e.target.isContentEditable === true;

      if (targetTag === "input" || targetTag === "textarea" || isEditable) {
        return;
      }

      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}
