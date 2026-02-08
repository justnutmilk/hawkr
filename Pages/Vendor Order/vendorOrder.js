/**
 * Hawkr - Vendor Orders Page
 * Queries Firestore for vendor info and orders
 */

import { auth, db, app } from "../../firebase/config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";
import { initNotificationBadge } from "../../assets/js/notificationBadge.js";
import {
  initToastContainer,
  subscribeToNewNotifications,
} from "../../assets/js/toastNotifications.js";
import { updateOrderStatus } from "../../firebase/services/orders.js";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const functions = getFunctions(app, "asia-southeast1");

// State
let currentVendor = null;
let currentStall = null;
let orders = [];
let currentTab = "preparing";
let isAnimating = false;
let pendingSnapshot = null;

/**
 * Initialize page when DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
  // Initialize vendor navbar (handles auth, vendor name, logout, keyboard shortcuts)
  initVendorNavbar();

  // Check auth state for loading orders
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      initNotificationBadge(`vendors/${user.uid}/notifications`);
      initToastContainer();
      subscribeToNewNotifications(`vendors/${user.uid}/notifications`);
      await loadVendorData(user.uid);
    }
  });

  // Setup tab switching
  setupTabSwitching();

  // Setup keyboard shortcuts (n key for new order)
  setupKeyboardShortcuts();
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
let ordersUnsubscribe = null;

function loadOrders(stallId) {
  const ordersQuery = query(
    collection(db, "orders"),
    where("stallId", "==", stallId),
    orderBy("createdAt", "desc"),
    limit(50),
  );

  let previousRenderedIds = new Set();
  let isFirstSnapshot = true;

  ordersUnsubscribe = onSnapshot(
    ordersQuery,
    (snapshot) => {
      const processSnapshot = () => {
        const newOrders = snapshot.docs
          .filter((d) => !d.data().archived)
          .map((d) => {
            const data = d.data();
            const createdAt = data.createdAt?.toDate?.() || new Date();

            return {
              id: d.id,
              orderNumber: data.orderNumber || d.id.slice(-4).toUpperCase(),
              customerName: data.customerName || "Customer",
              date: formatDate(createdAt),
              time: formatTime(createdAt),
              type: data.orderType || "Takeaway",
              status: mapStatus(data.status),
              items: (data.items || []).map((item) => ({
                qty: item.quantity || 1,
                name: item.name || "Item",
                price: item.totalPrice || item.unitPrice || 0,
                customizations: item.customizations || [],
                note: item.notes || null,
              })),
              total: data.total || 0,
              transactionId:
                data.hawkrTransactionId || data.transactionId || d.id,
            };
          });

        orders = newOrders;

        // Detect orders now visible on the current tab that weren't before
        const visibleStatuses =
          currentTab === "preparing" ? ["preparing"] : ["complete"];
        const currentRenderedIds = new Set(
          newOrders
            .filter((o) => visibleStatuses.includes(o.status))
            .map((o) => o.id),
        );
        const newlyRendered = isFirstSnapshot
          ? []
          : newOrders.filter(
              (o) =>
                visibleStatuses.includes(o.status) &&
                !previousRenderedIds.has(o.id),
            );

        renderOrders(currentTab);

        // Animate slide-in for new order cards
        if (newlyRendered.length > 0) {
          isAnimating = true;
          let totalCards = 0;
          let finishedCards = 0;

          newlyRendered.forEach((o) => {
            document.querySelectorAll(".orderLineItem").forEach((el) => {
              const numEl = el.querySelector(".orderItemNumber");
              if (numEl && numEl.textContent === `#${o.orderNumber}`) {
                totalCards++;
                el.classList.add("orderLineItemSlideIn");
                let animCount = 0;
                el.addEventListener("animationend", () => {
                  animCount++;
                  if (animCount >= 2) {
                    el.classList.remove("orderLineItemSlideIn");
                    finishedCards++;
                    if (finishedCards >= totalCards) {
                      isAnimating = false;
                      if (pendingSnapshot) {
                        const fn = pendingSnapshot;
                        pendingSnapshot = null;
                        fn();
                      }
                    }
                  }
                });
              }
            });
          });

          // Safety fallback: unlock after 1.5s even if animationend doesn't fire
          setTimeout(() => {
            if (isAnimating) {
              isAnimating = false;
              if (pendingSnapshot) {
                const fn = pendingSnapshot;
                pendingSnapshot = null;
                fn();
              }
            }
          }, 1500);
        }

        previousRenderedIds = currentRenderedIds;
        isFirstSnapshot = false;
      };

      // If an animation is in progress, defer this snapshot
      if (isAnimating) {
        pendingSnapshot = processSnapshot;
      } else {
        processSnapshot();
      }
    },
    (error) => {
      console.error("Error loading orders:", error);
      orders = [];
      renderOrders(currentTab);
    },
  );
}

/**
 * Map database status to UI status
 */
function mapStatus(status) {
  if (status === "ready" || status === "completed") return "complete";
  if (status === "confirmed") return "preparing";
  return status; // pending, cancelled, etc.
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
  // Render customizations/variants
  const customizationsHTML = (item.customizations || [])
    .map((c) => {
      const priceStr =
        c.priceAdjustment > 0 ? `+$${c.priceAdjustment.toFixed(2)}` : "";
      return `
        <div class="orderEntryVariant">
          <span class="orderEntryVariantName">${c.option || c.name}</span>
          ${priceStr ? `<span class="orderEntryVariantPrice">${priceStr}</span>` : ""}
        </div>
      `;
    })
    .join("");

  return `
    <div class="orderEntry">
      <span class="orderEntryQty">${item.qty}</span>
      <div class="orderEntryDetails">
        <span class="orderEntryName">${item.name}</span>
        ${customizationsHTML}
        ${item.note ? `<span class="orderEntryNote">${item.note}</span>` : ""}
      </div>
    </div>
  `;
}

/**
 * Render order line item
 */
function renderOrderLineItem(order) {
  const isReady = order.status === "complete";
  const actionBtn = isReady
    ? `<div class="orderReadyTag">Ready</div>`
    : `<button class="orderReadyBtn" data-order-id="${order.id}" title="Mark as ready">
        <img src="../../assets/icons/orderConfirmed.svg" alt="Ready" width="20" height="20" />
        Mark Ready
      </button>`;

  return `
    <div class="orderLineItem ${isReady ? "orderLineItemReady" : ""}">
      ${actionBtn}
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
  const isMac = window.navigator.userAgentData
    ? window.navigator.userAgentData.platform === "macOS"
    : /Mac/i.test(window.navigator.userAgent);
  const modKey = isMac ? "\u2318" : "CTRL";

  const filtered = orders.filter((o) =>
    tab === "preparing" ? o.status === "preparing" : o.status === "complete",
  );

  const orderContent =
    filtered.length > 0
      ? filtered.map(renderOrderLineItem).join("")
      : renderEmptyOrderState(tab);

  const clearBtn =
    tab === "complete"
      ? `<button class="clearOrderLineBtn">Clear Order Line <kbd class="clearOrderLineKbd">${modKey}</kbd><kbd class="clearOrderLineKbd">${isMac ? "\u232B" : "DEL"}</kbd></button>`
      : "";

  container.innerHTML = `
    <div class="orderLineHeader">
      <span class="sectionLabel">Order Line</span>
      <div class="orderLineActions">
        ${clearBtn}
        <a class="newOrderButton" href="vendorCreateOrder.html">
          New order
          <kbd>n</kbd>
        </a>
      </div>
    </div>
    <div class="orderLineCards">
      ${orderContent}
    </div>
  `;

  bindCompleteOrderButtons();
  bindClearOrderLine();
}

/**
 * Bind complete order button click handlers (event delegation)
 */
let orderReadyDelegated = false;

function bindCompleteOrderButtons() {
  if (orderReadyDelegated) return;
  const container = document.getElementById("orderContent");
  if (!container) return;
  orderReadyDelegated = true;

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".orderReadyBtn");
    if (!btn) return;

    const orderId = btn.dataset.orderId;
    const card = btn.closest(".orderLineItem");
    btn.disabled = true;

    // Update local state immediately
    const order = orders.find((o) => o.id === orderId);
    if (order) order.status = "complete";

    // Fire API calls in background (non-blocking)
    updateOrderStatus(orderId, "ready")
      .then(() => {
        const sendNotification = httpsCallable(
          functions,
          "sendOrderNotification",
        );
        return sendNotification({ orderId, status: "ready" });
      })
      .catch((err) => console.error("Order update/notification error:", err));

    // Animate card out then re-render
    if (card) {
      isAnimating = true;
      card.style.setProperty("--card-width", card.offsetWidth + "px");
      card.classList.add("orderLineItemSwipeUp");
      card.addEventListener(
        "animationend",
        () => {
          card.classList.remove("orderLineItemSwipeUp");
          card.classList.add("orderLineItemCollapse");
          card.addEventListener(
            "animationend",
            () => {
              isAnimating = false;
              renderOrders(currentTab);
              if (pendingSnapshot) {
                const fn = pendingSnapshot;
                pendingSnapshot = null;
                fn();
              }
            },
            { once: true },
          );
        },
        { once: true },
      );
    } else {
      renderOrders(currentTab);
    }
  });
}

/**
 * Bind clear order line button
 */
function clearOrderLineWithAnimation() {
  const cards = document.querySelectorAll(".orderLineItem");
  if (cards.length === 0) return;

  isAnimating = true;

  // Archive in Firestore and remove from local data immediately
  const completedOrders = orders.filter((o) => o.status === "complete");
  orders = orders.filter((o) => o.status !== "complete");
  completedOrders.forEach((o) => {
    updateDoc(doc(db, "orders", o.id), { archived: true }).catch((err) =>
      console.error("Archive error:", err),
    );
  });

  // Play wave animation, then re-render when done
  let finished = 0;
  cards.forEach((card, i) => {
    card.style.setProperty("--card-width", card.offsetWidth + "px");
    setTimeout(() => {
      card.classList.add("orderLineItemSwipeUp");
      card.addEventListener(
        "animationend",
        () => {
          card.classList.remove("orderLineItemSwipeUp");
          card.classList.add("orderLineItemCollapse");
          card.addEventListener(
            "animationend",
            () => {
              finished++;
              if (finished === cards.length) {
                isAnimating = false;
                renderOrders(currentTab);
                if (pendingSnapshot) {
                  const fn = pendingSnapshot;
                  pendingSnapshot = null;
                  fn();
                }
              }
            },
            { once: true },
          );
        },
        { once: true },
      );
    }, i * 80);
  });
}

function bindClearOrderLine() {
  const btn = document.querySelector(".clearOrderLineBtn");
  if (!btn) return;
  btn.addEventListener("click", clearOrderLineWithAnimation);
}

/**
 * Setup tab switching
 */
function setupTabSwitching() {
  const segmented = document.querySelector(".segmentedControl");
  const radios = document.querySelectorAll('input[name="orderTab"]');
  const radioArr = Array.from(radios);

  radios.forEach((radio) => {
    radio.addEventListener("change", () => {
      currentTab = radio.value;
      if (segmented) {
        segmented.style.setProperty("--active-index", radioArr.indexOf(radio));
      }
      renderOrders(currentTab);
    });
  });

  // Set initial index
  if (segmented) {
    const checkedIdx = radioArr.findIndex((r) => r.checked);
    if (checkedIdx >= 0)
      segmented.style.setProperty("--active-index", checkedIdx);
  }
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
    // Ctrl+Delete (Win) / Cmd+Backspace (Mac) clears completed orders
    if (modifier && (e.key === "Delete" || (isMac && e.key === "Backspace"))) {
      e.preventDefault();
      if (currentTab === "complete") {
        clearOrderLineWithAnimation();
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
