import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";
import { db, auth } from "../../firebase/config.js";
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
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize vendor navbar (handles auth, vendor name, logout)
  initVendorNavbar();

  const paymentMethodsBasePath = "../../Payment Methods/";
  const iconsBasePath = "../../assets/icons/";

  let transactions = [];
  let activeFilter = "all";
  let refundSelectionMode = false;

  const filterDefs = [
    { key: "all", label: "All" },
    { key: "succeeded", label: "Succeeded" },
    { key: "refunded", label: "Refunded" },
    { key: "b2b", label: "B2B" },
  ];

  // ============================================
  // PAYMENT METHOD MAPPING
  // ============================================

  /**
   * Map order paymentMethod + paymentDetails to display info
   */
  function getPaymentDisplay(order) {
    const method = order.paymentMethod || "cash";
    const details = order.paymentDetails || {};

    const mapping = {
      card: () => {
        const brand = (
          details.brand ||
          details.cardBrand ||
          "visa"
        ).toLowerCase();
        const last4 = details.lastFour || details.cardLast4 || "****";
        const brandLogos = {
          visa: "Visa.svg",
          mastercard: "MasterCard.svg",
          amex: "Amex.svg",
        };
        // Check for digital wallet
        if (details.wallet === "apple_pay") {
          return {
            logos: ["Apple Pay.svg", brandLogos[brand] || "Visa.svg"],
            methodLabel: `\u2022\u2022\u2022\u2022 ${last4}`,
            paymentBrand: "Apple Pay",
            paymentSub: `${capitalize(brand)} ${last4}`,
          };
        }
        if (details.wallet === "google_pay") {
          return {
            logos: ["Google Pay.svg", brandLogos[brand] || "Visa.svg"],
            methodLabel: `\u2022\u2022\u2022\u2022 ${last4}`,
            paymentBrand: "Google Pay",
            paymentSub: `${capitalize(brand)} ${last4}`,
          };
        }
        return {
          logos: [brandLogos[brand] || "Visa.svg"],
          methodLabel: `\u2022\u2022\u2022\u2022 ${last4}`,
          paymentBrand: capitalize(brand),
          paymentSub: `${capitalize(brand)} ${last4}`,
        };
      },
      grabpay: () => ({
        logos: ["GrabPay.svg"],
        methodLabel: "GrabPay",
        paymentBrand: "GrabPay",
        paymentSub: "",
      }),
      paynow: () => ({
        logos: ["PayNow.svg"],
        methodLabel: "PayNow",
        paymentBrand: "PayNow",
        paymentSub: "",
      }),
      alipay: () => ({
        logos: ["Alipay.svg"],
        methodLabel: "Alipay",
        paymentBrand: "Alipay",
        paymentSub: "",
      }),
      applePay: () => {
        const brand = (details.brand || "visa").toLowerCase();
        const last4 = details.lastFour || "";
        const brandLogos = {
          visa: "Visa.svg",
          mastercard: "MasterCard.svg",
          amex: "Amex.svg",
        };
        return {
          logos: ["Apple Pay.svg", brandLogos[brand] || "Visa.svg"],
          methodLabel: last4
            ? `\u2022\u2022\u2022\u2022 ${last4}`
            : "Apple Pay",
          paymentBrand: "Apple Pay",
          paymentSub: last4
            ? `${capitalize(brand)} ${last4}`
            : capitalize(brand),
        };
      },
      googlePay: () => {
        const brand = (details.brand || "visa").toLowerCase();
        const last4 = details.lastFour || "";
        const brandLogos = {
          visa: "Visa.svg",
          mastercard: "MasterCard.svg",
          amex: "Amex.svg",
        };
        return {
          logos: ["Google Pay.svg", brandLogos[brand] || "Visa.svg"],
          methodLabel: last4
            ? `\u2022\u2022\u2022\u2022 ${last4}`
            : "Google Pay",
          paymentBrand: "Google Pay",
          paymentSub: last4
            ? `${capitalize(brand)} ${last4}`
            : capitalize(brand),
        };
      },
      cash: () => ({
        logos: ["Cash.png"],
        methodLabel: "Cash",
        paymentBrand: "Cash",
        paymentSub: "",
      }),
    };

    const getDisplay = mapping[method] || mapping.cash;
    return getDisplay();
  }

  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ============================================
  // DATE FORMATTING
  // ============================================

  function formatDate(timestamp) {
    if (!timestamp) return "—";
    const date = timestamp.toDate?.() || new Date(timestamp) || new Date();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;
    const hoursStr = String(hours).padStart(2, "0");
    return `${day}-${month}-${year}, ${hoursStr}:${minutes} ${ampm}`;
  }

  // ============================================
  // MAP ORDER TO TRANSACTION
  // ============================================

  function orderToTransaction(order) {
    const paymentDisplay = getPaymentDisplay(order);

    // Determine status
    let status = "Successful";
    let type = "b2c";
    if (order.paymentStatus === "refunded" || order.status === "cancelled") {
      status = "Refunded";
    }

    // Determine type from transaction ID prefix
    const txnId = order.hawkrTransactionId || "";
    if (txnId.startsWith("b2b-")) {
      type = "b2b";
    } else if (txnId.startsWith("b2c-")) {
      type = "b2c";
    }

    return {
      id: order.id,
      amount: order.total || 0,
      status,
      logos: paymentDisplay.logos,
      methodLabel: paymentDisplay.methodLabel,
      paymentBrand: paymentDisplay.paymentBrand,
      paymentSub: paymentDisplay.paymentSub,
      txnId: order.hawkrTransactionId || "—",
      refundTxnId: order.refundTransactionId || null,
      customer: order.customerName || "Customer",
      type,
      items: (order.items || []).map((item) => ({
        name: item.name,
        vendor: order.stallName || "",
        price: item.unitPrice || item.totalPrice / (item.quantity || 1),
        qty: item.quantity || 1,
        image: item.imageUrl || "",
        specialRequest: item.notes || "",
      })),
      review: null, // Reviews loaded separately if needed
      date: formatDate(order.createdAt),
      rawDate: order.createdAt,
      // Keep full order data for detail page
      orderData: order,
    };
  }

  // ============================================
  // LOAD DATA FROM FIREBASE
  // ============================================

  async function loadTransactions(userId) {
    try {
      // Get vendor profile to find stallId
      const vendorDoc = await getDoc(doc(db, "vendors", userId));
      if (!vendorDoc.exists()) {
        console.error("Vendor profile not found");
        renderEmptyState();
        return;
      }

      const vendorData = vendorDoc.data();
      let stallId = vendorData.stallId;

      // Fallback: query by ownerId
      if (!stallId) {
        const stallsQuery = query(
          collection(db, "foodStalls"),
          where("ownerId", "==", userId),
          limit(1),
        );
        const stallsSnapshot = await getDocs(stallsQuery);
        if (!stallsSnapshot.empty) {
          stallId = stallsSnapshot.docs[0].id;
        }
      }

      if (!stallId) {
        console.error("No stall associated with this vendor");
        renderEmptyState();
        return;
      }

      // Fetch orders for this stall
      let ordersSnapshot;
      try {
        const q = query(
          collection(db, "orders"),
          where("stallId", "==", stallId),
          orderBy("createdAt", "desc"),
          limit(100),
        );
        ordersSnapshot = await getDocs(q);
      } catch (indexError) {
        // Fallback without orderBy if composite index not ready
        console.warn("Index not ready, fetching without orderBy:", indexError);
        const fallbackQ = query(
          collection(db, "orders"),
          where("stallId", "==", stallId),
          limit(100),
        );
        ordersSnapshot = await getDocs(fallbackQ);
      }

      const orders = ordersSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Sort client-side (in case fallback was used)
      orders.sort((a, b) => {
        const dateA =
          a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
        const dateB =
          b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
        return dateB - dateA;
      });

      // Map orders to transaction display format
      transactions = orders.map(orderToTransaction);

      // Render everything
      renderFilterCards();
      renderTable();
    } catch (error) {
      console.error("Error loading transactions:", error);
      renderEmptyState();
    }
  }

  function renderEmptyState() {
    transactions = [];
    renderFilterCards();
    const table = document.getElementById("transactionTable");
    const header = table.querySelector(".transactionRowHeader");
    table.innerHTML = "";
    table.appendChild(header);
    const emptyRow = document.createElement("div");
    emptyRow.style.cssText =
      "padding: 48px; text-align: center; color: #808080; font-family: 'Geist Mono', monospace; font-size: 14px;";
    emptyRow.textContent = "No transactions yet";
    table.appendChild(emptyRow);
  }

  // ============================================
  // FILTERS & RENDERING
  // ============================================

  function getCount(key) {
    if (key === "all") return transactions.length;
    if (key === "succeeded")
      return transactions.filter((t) => t.status === "Successful").length;
    if (key === "refunded")
      return transactions.filter((t) => t.status === "Refunded").length;
    if (key === "b2b")
      return transactions.filter((t) => t.type === "b2b").length;
    return 0;
  }

  function getFiltered() {
    const query = document
      .getElementById("searchInput")
      .value.toLowerCase()
      .trim();
    let filtered = transactions;

    if (activeFilter === "succeeded")
      filtered = filtered.filter((t) => t.status === "Successful");
    else if (activeFilter === "refunded")
      filtered = filtered.filter((t) => t.status === "Refunded");
    else if (activeFilter === "b2b")
      filtered = filtered.filter((t) => t.type === "b2b");

    if (query) {
      filtered = filtered.filter(
        (t) =>
          t.customer.toLowerCase().includes(query) ||
          t.txnId.toLowerCase().includes(query) ||
          t.methodLabel.toLowerCase().includes(query) ||
          t.date.toLowerCase().includes(query) ||
          `s$${t.amount.toFixed(2)}`.includes(query),
      );
    }

    return filtered;
  }

  function renderFilterCards() {
    const container = document.getElementById("filterCards");
    container.innerHTML = filterDefs
      .map(
        (filterDef) => `
            <div class="filterCard${activeFilter === filterDef.key ? " active" : ""}" data-filter="${filterDef.key}">
                <span class="filterCardLabel">${filterDef.label}</span>
                <span class="filterCardCount">${getCount(filterDef.key)}</span>
            </div>
        `,
      )
      .join("");

    container.querySelectorAll(".filterCard").forEach((card) => {
      card.addEventListener("click", () => {
        activeFilter = card.dataset.filter;
        renderFilterCards();
        renderTable();
      });
    });
  }

  function renderTable() {
    const table = document.getElementById("transactionTable");
    const header = table.querySelector(".transactionRowHeader");
    table.innerHTML = "";
    table.appendChild(header);

    // Toggle refund mode class on table
    table.classList.toggle("refundSelectionMode", refundSelectionMode);

    // Show/hide refund banner
    let banner = document.getElementById("refundBanner");
    if (refundSelectionMode) {
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "refundBanner";
        banner.className = "refundBanner";
        banner.innerHTML = `
          <span class="refundBannerText">Select a transaction to refund</span>
          <button class="refundBannerCancel" id="refundBannerCancel">Cancel</button>
        `;
        table.parentNode.insertBefore(banner, table);
        document
          .getElementById("refundBannerCancel")
          .addEventListener("click", () => {
            toggleRefundMode(false);
          });
      }
    } else if (banner) {
      banner.remove();
    }

    const filtered = getFiltered();

    if (filtered.length === 0) {
      const emptyRow = document.createElement("div");
      emptyRow.style.cssText =
        "padding: 48px; text-align: center; color: #808080; font-family: 'Geist Mono', monospace; font-size: 14px;";
      emptyRow.textContent =
        activeFilter !== "all"
          ? `No ${activeFilter} transactions`
          : "No transactions found";
      table.appendChild(emptyRow);
      return;
    }

    filtered.forEach((transaction) => {
      const row = document.createElement("div");
      row.className = "transactionRow";
      row.style.cursor = "pointer";

      // In refund mode, mark refundable vs non-refundable rows
      const isRefundable =
        transaction.status === "Successful" &&
        transaction.txnId.startsWith("c2b-");
      if (refundSelectionMode) {
        row.classList.add(isRefundable ? "refundableRow" : "nonRefundableRow");
      }

      const badgeClass =
        transaction.status === "Successful" ? "successful" : "refunded";
      const badgeIcon =
        transaction.status === "Successful"
          ? `<img src="${iconsBasePath}successful.svg" alt="">`
          : `<img src="${iconsBasePath}refund.svg" alt="">`;

      const logosHtml = transaction.logos.length
        ? transaction.logos
            .map(
              (logoFilename) =>
                `<img src="${paymentMethodsBasePath}${logoFilename}" alt="">`,
            )
            .join("")
        : "";

      row.innerHTML = `
                <div class="transactionCell transactionCellAmount">
                    <span class="paymentAmount">S$${transaction.amount.toFixed(2)}</span>
                    <span class="transactionBadge ${badgeClass}">${badgeIcon}${transaction.status}</span>
                </div>
                <div class="transactionCell transactionCellMethod">
                    <div class="paymentMethodBox">
                        ${logosHtml ? `<div class="paymentLogos">${logosHtml}</div>` : ""}
                        <span class="paymentMethodLabel">${transaction.methodLabel}</span>
                    </div>
                </div>
                <div class="transactionCell transactionCellTransactionId">
                    <span class="transactionId">${transaction.txnId}</span>
                    ${transaction.refundTxnId ? `<span class="transactionId refundTransactionId">${transaction.refundTxnId}</span>` : ""}
                </div>
                <div class="transactionCell transactionCellCustomer">
                    <span class="transactionCustomer">${transaction.customer}</span>
                </div>
                <div class="transactionCell transactionCellDate">
                    <span class="transactionDateTime">${transaction.date}</span>
                </div>
            `;

      row.addEventListener("click", () => {
        // Build ordersByDate map for related orders (same date grouping)
        const ordersByDate = {};
        transactions.forEach((t) => {
          if (!ordersByDate[t.date]) ordersByDate[t.date] = [];
          ordersByDate[t.date].push(t);
        });

        sessionStorage.setItem(
          "selectedTransaction",
          JSON.stringify(transaction),
        );
        sessionStorage.setItem("ordersByDate", JSON.stringify(ordersByDate));

        // If in refund mode and row is refundable, navigate with auto-refund flag
        if (refundSelectionMode && isRefundable) {
          sessionStorage.setItem("autoOpenRefund", "true");
        }

        if (refundSelectionMode && !isRefundable) {
          showToast("This transaction cannot be refunded");
          return;
        }

        window.location.href = "vendorPaymentDetail.html";
      });

      table.appendChild(row);
    });
  }

  function toggleRefundMode(forceState) {
    refundSelectionMode =
      forceState !== undefined ? forceState : !refundSelectionMode;
    const btn = document.getElementById("btnRefund");
    btn.classList.toggle("active", refundSelectionMode);
    renderTable();
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  // Search
  document.getElementById("searchInput").addEventListener("input", renderTable);

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    if (e.key === "Escape" && refundSelectionMode) {
      e.preventDefault();
      toggleRefundMode(false);
      return;
    }
    if (e.key === "r") {
      e.preventDefault();
      toggleRefundMode();
    }
    if (e.key === "n") {
      e.preventDefault();
      document.getElementById("btnInvoice").click();
    }
  });

  // Ctrl/Cmd+K focus search
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      document.getElementById("searchInput").focus();
    }
  });

  // Button actions
  document.getElementById("btnRefund").addEventListener("click", () => {
    toggleRefundMode();
  });
  document.getElementById("btnInvoice").addEventListener("click", () => {
    // Placeholder
  });

  // Toast notification
  function showToast(message) {
    const existing = document.querySelector(".paymentsToast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "paymentsToast";
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: #341539; color: #fff; padding: 12px 24px; border-radius: 12px;
      font-family: Aptos, sans-serif; font-size: 14px; box-shadow: 0 8px 24px rgba(52,21,57,0.25);
      z-index: 2000; opacity: 0; transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
    });
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(20px)";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ============================================
  // INIT: Wait for auth, then load
  // ============================================

  // Show loading state
  renderFilterCards();
  const table = document.getElementById("transactionTable");
  const header = table.querySelector(".transactionRowHeader");
  const loadingRow = document.createElement("div");
  loadingRow.id = "loadingRow";
  loadingRow.style.cssText =
    "padding: 48px; text-align: center; color: #808080; font-family: 'Geist Mono', monospace; font-size: 14px;";
  loadingRow.textContent = "Loading transactions...";
  table.appendChild(loadingRow);

  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadTransactions(user.uid);
    } else {
      window.location.href = "../../Pages/Auth/login.html";
    }
  });
});
