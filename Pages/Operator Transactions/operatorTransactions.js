import { db, auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

document.addEventListener("DOMContentLoaded", () => {
  // Firebase Auth — check onboarding before initialising page
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const operatorDoc = await getDoc(doc(db, "operators", user.uid));
      if (!operatorDoc.exists() || !operatorDoc.data().onboardingComplete) {
        window.location.href = "../Auth/onboarding-operator.html";
        return;
      }
      loadTransactions(user.uid);
    } else {
      window.location.href = "../Auth/login.html";
      return;
    }
  });

  // Search key modifier
  const isMac =
    navigator.platform.toUpperCase().indexOf("MAC") >= 0 ||
    navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
  document.getElementById("searchKeyMod").textContent = isMac
    ? "\u2318"
    : "CTRL";

  const paymentMethodsBasePath = "../../Payment Methods/";
  const iconsBasePath = "../../assets/icons/";

  let transactions = [];
  let activeFilter = "all";

  const filterDefs = [
    { key: "all", label: "All" },
    { key: "successful", label: "Successful" },
    { key: "refunds", label: "Refunds" },
    { key: "failed", label: "Failed" },
    { key: "b2b", label: "B2B" },
    { key: "b2c", label: "B2C" },
  ];

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
  // PAYMENT METHOD MAPPING
  // ============================================

  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function getPaymentDisplay(order) {
    const method = order.paymentMethod || "paynow";
    const details = order.paymentDetails || {};

    const mapping = {
      card: () => {
        const brand = (details.brand || "visa").toLowerCase();
        const last4 = details.lastFour || details.cardLast4 || "****";
        const brandLogos = {
          visa: "Visa.svg",
          mastercard: "MasterCard.svg",
          amex: "Amex.svg",
        };
        if (details.wallet === "apple_pay") {
          return {
            logos: ["Apple Pay.svg", brandLogos[brand] || "Visa.svg"],
            methodLabel: `\u2022\u2022\u2022\u2022 ${last4}`,
          };
        }
        if (details.wallet === "google_pay") {
          return {
            logos: ["Google Pay.svg", brandLogos[brand] || "Visa.svg"],
            methodLabel: `\u2022\u2022\u2022\u2022 ${last4}`,
          };
        }
        return {
          logos: [brandLogos[brand] || "Visa.svg"],
          methodLabel: `\u2022\u2022\u2022\u2022 ${last4}`,
        };
      },
      grabpay: () => ({ logos: ["GrabPay.svg"], methodLabel: "GrabPay" }),
      paynow: () => ({ logos: ["PayNow.svg"], methodLabel: "PayNow" }),
      alipay: () => ({ logos: ["Alipay.svg"], methodLabel: "Alipay" }),
      nets: () => ({ logos: ["NETS.svg"], methodLabel: "NETS" }),
      cash: () => ({ logos: ["Cash.png"], methodLabel: "Cash" }),
    };

    const getDisplay = mapping[method] || mapping.paynow;
    return getDisplay();
  }

  // ============================================
  // MAP ORDER TO TRANSACTION
  // ============================================

  function orderToTransaction(order) {
    const paymentDisplay = getPaymentDisplay(order);
    let status = "Successful";
    if (order.paymentStatus === "refunded" || order.status === "cancelled") {
      status = "Refunded";
    }
    if (order.paymentStatus === "failed" || order.status === "failed") {
      status = "Failed";
    }

    const txnId = order.hawkrTransactionId || "—";
    let type = "b2b";
    if (txnId.startsWith("b2c-")) type = "b2c";

    return {
      id: order.id,
      amount: order.total || order.amount || 0,
      status,
      logos: paymentDisplay.logos,
      methodLabel: paymentDisplay.methodLabel,
      txnId,
      customer: order.vendorName || order.customerName || "—",
      type,
      date: formatDate(order.createdAt),
    };
  }

  // ============================================
  // LOAD TRANSACTIONS FROM FIREBASE
  // ============================================

  async function loadTransactions(userId) {
    try {
      const operatorDoc = await getDoc(doc(db, "operators", userId));
      if (!operatorDoc.exists()) {
        renderEmptyState();
        return;
      }

      const opData = operatorDoc.data();
      const hawkerCentreId = opData.hawkerCentreId;
      if (!hawkerCentreId) {
        renderEmptyState();
        return;
      }

      // Query rent/operator transactions for this hawker centre
      let ordersSnapshot;
      try {
        const q = query(
          collection(db, "operatorTransactions"),
          where("hawkerCentreId", "==", hawkerCentreId),
          orderBy("createdAt", "desc"),
          limit(100),
        );
        ordersSnapshot = await getDocs(q);
      } catch (indexError) {
        console.warn("Index not ready, fetching without orderBy:", indexError);
        try {
          const fallbackQ = query(
            collection(db, "operatorTransactions"),
            where("hawkerCentreId", "==", hawkerCentreId),
            limit(100),
          );
          ordersSnapshot = await getDocs(fallbackQ);
        } catch {
          // Collection may not exist yet
          renderEmptyState();
          return;
        }
      }

      const orders = ordersSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      orders.sort((a, b) => {
        const dateA =
          a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
        const dateB =
          b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
        return dateB - dateA;
      });

      transactions = orders.map(orderToTransaction);

      renderFilterCards();
      renderTable();
    } catch (error) {
      console.error("Error loading transactions:", error);
      renderEmptyState();
    }
  }

  // ============================================
  // EMPTY STATE
  // ============================================

  function renderEmptyState() {
    transactions = [];
    renderFilterCards();
    const table = document.getElementById("transactionTable");
    const header = table.querySelector(".transactionRowHeader");
    table.innerHTML = "";
    table.appendChild(header);

    const paymentIcons = [
      "Apple Pay.svg",
      "Google Pay.svg",
      "Visa.svg",
      "MasterCard.svg",
      "Amex.svg",
      "UnionPay.svg",
      "Alipay.svg",
      "GrabPay.svg",
      "PayNow.svg",
      "Link.svg",
    ];

    const emptyState = document.createElement("div");
    emptyState.className = "paymentsEmptyState";
    emptyState.innerHTML = `
      <p class="paymentsEmptyFilterMsg">No transactions yet</p>
      <img src="../../images/noTransactions.svg" alt="" class="paymentsEmptyIllustration" />
      <p class="paymentsEmptyTitle">Hawkr opens possibilities you've never thought of.</p>
      <p class="paymentsEmptySubtitle">We connect all the popular payment methods into one system.</p>
      <div class="paymentsEmptyIcons">
        ${paymentIcons.map((icon) => `<img src="${paymentMethodsBasePath}${icon}" alt="${icon.replace(".svg", "")}" class="paymentsEmptyIcon" />`).join("")}
      </div>
      <div class="paymentsEmptyFooterWrap">
        <div class="paymentsEmptyFooter">
          <span class="paymentsEmptyFooterText">powered by</span>
          <img src="../../images/Stripe logo.svg" alt="Stripe" class="paymentsEmptyStripeLogo" />
        </div>
        <img src="../../images/hawkrOS.svg" alt="HawkrOS" class="paymentsEmptyLogo" />
      </div>
    `;
    table.appendChild(emptyState);
  }

  // ============================================
  // FILTERS & RENDERING
  // ============================================

  const isRefund = (transaction) => transaction.txnId.endsWith("-REFUND");

  function getCount(key) {
    if (key === "all") return transactions.length;
    if (key === "successful")
      return transactions.filter(
        (t) => t.status === "Successful" && !isRefund(t),
      ).length;
    if (key === "refunds")
      return transactions.filter((t) => isRefund(t)).length;
    if (key === "failed")
      return transactions.filter((t) => t.status === "Failed").length;
    if (key === "b2b")
      return transactions.filter((t) => t.type === "b2b").length;
    if (key === "b2c")
      return transactions.filter((t) => t.type === "b2c").length;
    return 0;
  }

  function getFiltered() {
    const searchQuery = document
      .getElementById("searchInput")
      .value.toLowerCase()
      .trim();
    let filtered = transactions;

    if (activeFilter === "successful")
      filtered = filtered.filter(
        (t) => t.status === "Successful" && !isRefund(t),
      );
    else if (activeFilter === "refunds")
      filtered = filtered.filter((t) => isRefund(t));
    else if (activeFilter === "failed")
      filtered = filtered.filter((t) => t.status === "Failed");
    else if (activeFilter === "b2b")
      filtered = filtered.filter((t) => t.type === "b2b");
    else if (activeFilter === "b2c")
      filtered = filtered.filter((t) => t.type === "b2c");

    if (searchQuery) {
      filtered = filtered.filter(
        (t) =>
          t.customer.toLowerCase().includes(searchQuery) ||
          t.txnId.toLowerCase().includes(searchQuery) ||
          t.methodLabel.toLowerCase().includes(searchQuery) ||
          t.date.toLowerCase().includes(searchQuery) ||
          `s$${t.amount.toFixed(2)}`.includes(searchQuery),
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

    const filtered = getFiltered();

    if (filtered.length === 0) {
      const msg =
        activeFilter !== "all"
          ? `No ${activeFilter} transactions`
          : "No transactions yet";
      const paymentIcons = [
        "Apple Pay.svg",
        "Google Pay.svg",
        "Visa.svg",
        "MasterCard.svg",
        "Amex.svg",
        "UnionPay.svg",
        "Alipay.svg",
        "GrabPay.svg",
        "PayNow.svg",
        "Link.svg",
      ];
      const emptyRow = document.createElement("div");
      emptyRow.className = "paymentsEmptyState";
      emptyRow.innerHTML = `
        <p class="paymentsEmptyFilterMsg">${msg}</p>
        <img src="../../images/noTransactions.svg" alt="" class="paymentsEmptyIllustration" />
        <p class="paymentsEmptyTitle">Hawkr opens possibilities you've never thought of.</p>
        <p class="paymentsEmptySubtitle">We connect all the popular payment methods into one system.</p>
        <div class="paymentsEmptyIcons">
          ${paymentIcons.map((icon) => `<img src="${paymentMethodsBasePath}${icon}" alt="${icon.replace(".svg", "")}" class="paymentsEmptyIcon" />`).join("")}
        </div>
        <div class="paymentsEmptyFooterWrap">
          <div class="paymentsEmptyFooter">
            <span class="paymentsEmptyFooterText">powered by</span>
            <img src="../../images/Stripe logo.svg" alt="Stripe" class="paymentsEmptyStripeLogo" />
          </div>
          <img src="../../images/hawkrOS.svg" alt="HawkrOS" class="paymentsEmptyLogo" />
        </div>
      `;
      table.appendChild(emptyRow);
      return;
    }

    filtered.forEach((transaction) => {
      const row = document.createElement("div");
      row.className = "transactionRow";
      row.style.cursor = "pointer";

      const transactionIsRefund = isRefund(transaction);
      const badgeClass =
        transaction.status === "Failed"
          ? "failed"
          : transactionIsRefund
            ? "refunded"
            : "successful";
      const badgeLabel =
        transaction.status === "Failed"
          ? "Failed"
          : transactionIsRefund
            ? "Refund"
            : "Successful";
      const failedIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 13 13" fill="none" style="transform:rotate(45deg)"><path d="M5.57143 8.02857C5.57143 7.6972 5.3028 7.42857 4.97143 7.42857H0.6C0.268629 7.42857 0 7.15994 0 6.82857V6.17143C0 5.84006 0.268629 5.57143 0.6 5.57143H4.97143C5.3028 5.57143 5.57143 5.3028 5.57143 4.97143V0.6C5.57143 0.268629 5.84006 0 6.17143 0H6.82857C7.15994 0 7.42857 0.268629 7.42857 0.6V4.97143C7.42857 5.3028 7.6972 5.57143 8.02857 5.57143H12.4C12.7314 5.57143 13 5.84006 13 6.17143V6.82857C13 7.15994 12.7314 7.42857 12.4 7.42857H8.02857C7.6972 7.42857 7.42857 7.6972 7.42857 8.02857V12.4C7.42857 12.7314 7.15994 13 6.82857 13H6.17143C5.84006 13 5.57143 12.7314 5.57143 12.4V8.02857Z" fill="#eb001b"/></svg>`;
      const badgeIcon =
        transaction.status === "Failed"
          ? failedIcon
          : transactionIsRefund
            ? `<img src="${iconsBasePath}refund.svg" alt="">`
            : `<img src="${iconsBasePath}successful.svg" alt="">`;

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
                    <span class="transactionBadge ${badgeClass}">${badgeIcon}${badgeLabel}</span>
                </div>
                <div class="transactionCell transactionCellMethod">
                    <div class="paymentMethodBox">
                        ${logosHtml ? `<div class="paymentLogos">${logosHtml}</div>` : ""}
                        <span class="paymentMethodLabel">${transaction.methodLabel}</span>
                    </div>
                </div>
                <div class="transactionCell transactionCellTransactionId">
                    <span class="transactionId">${transaction.txnId}</span>
                </div>
                <div class="transactionCell transactionCellCustomer">
                    <span class="transactionCustomer">${transaction.customer}</span>
                </div>
                <div class="transactionCell transactionCellDate">
                    <span class="transactionDateTime">${transaction.date}</span>
                </div>
            `;

      table.appendChild(row);
    });
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  document.getElementById("searchInput").addEventListener("input", renderTable);

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    if (e.key === "r") {
      e.preventDefault();
      document.getElementById("btnRefund").click();
    }
    if (e.key === "n") {
      e.preventDefault();
      document.getElementById("btnInvoice").click();
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      document.getElementById("searchInput").focus();
    }
  });

  document.getElementById("btnRefund").addEventListener("click", () => {});
  document.getElementById("btnInvoice").addEventListener("click", () => {});

  // ============================================
  // INIT: Show skeleton while loading
  // ============================================

  renderFilterCards();
  const table = document.getElementById("transactionTable");
  for (let i = 0; i < 6; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "transactionRow skeletonRow";
    skeleton.innerHTML = `
      <div class="transactionCell transactionCellAmount">
        <span class="skeleton" style="width:64px;height:16px"></span>
        <span class="skeleton" style="width:72px;height:20px;border-radius:8px"></span>
      </div>
      <div class="transactionCell transactionCellMethod">
        <div class="paymentMethodBox">
          <span class="skeleton" style="width:24px;height:24px;border-radius:6px"></span>
          <span class="skeleton" style="width:80px;height:14px"></span>
        </div>
      </div>
      <div class="transactionCell transactionCellTransactionId">
        <span class="skeleton" style="width:140px;height:14px"></span>
      </div>
      <div class="transactionCell transactionCellCustomer">
        <span class="skeleton" style="width:90px;height:14px"></span>
      </div>
      <div class="transactionCell transactionCellDate">
        <span class="skeleton" style="width:130px;height:14px"></span>
      </div>
    `;
    table.appendChild(skeleton);
  }
});
