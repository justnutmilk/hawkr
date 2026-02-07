import { db, auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  // Firebase Auth — check onboarding before initialising page
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Check onboarding status
      const operatorDoc = await getDoc(doc(db, "operators", user.uid));
      if (!operatorDoc.exists() || !operatorDoc.data().onboardingComplete) {
        window.location.href = "../Auth/onboarding-operator.html";
        return;
      }
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

  // Mock data: operator transactions (B2B and B2C)
  const ordersByDate = {
    "28-01-2026, 02:34 pm": [
      {
        amount: 1250.0,
        status: "Successful",
        logos: ["PayNow.svg"],
        methodLabel: "PayNow",
        paymentBrand: "PayNow",
        paymentSub: "",
        txnId: "b2b-kR4Tmn82xP-RENT",
        customer: "Ching Chong Foods Pte Ltd",
        type: "b2b",
      },
      {
        amount: 12.5,
        status: "Successful",
        logos: ["Apple Pay.svg", "Visa.svg"],
        methodLabel: "\u2022\u2022\u2022\u2022 9402",
        paymentBrand: "Apple Pay",
        paymentSub: "Visa 9402",
        txnId: "b2c-j29Sksix93Q-FOOD",
        customer: "Sarah Chen",
        type: "b2c",
      },
      {
        amount: 49.02,
        status: "Successful",
        logos: ["MasterCard.svg"],
        methodLabel: "\u2022\u2022\u2022\u2022 0347",
        paymentBrand: "MasterCard",
        paymentSub: "MasterCard 0347",
        txnId: "b2c-xR3Kmp47aB-FOOD",
        customer: "Sarah Chen",
        type: "b2c",
      },
    ],
    "28-01-2026, 01:12 pm": [
      {
        amount: 8.0,
        status: "Successful",
        logos: ["PayNow.svg"],
        methodLabel: "PayNow",
        paymentBrand: "PayNow",
        paymentSub: "",
        txnId: "b2c-k83Tmn20xP-REFUND",
        customer: "Ahmad Rizal",
        type: "b2c",
      },
    ],
    "27-01-2026, 06:45 pm": [
      {
        amount: 850.0,
        status: "Successful",
        logos: ["NETS.svg"],
        methodLabel: "NETS",
        paymentBrand: "NETS",
        paymentSub: "",
        txnId: "b2b-pQ7Wvn41rK-RENT",
        customer: "Malay Delights Pte Ltd",
        type: "b2b",
      },
      {
        amount: 45.0,
        status: "Successful",
        logos: ["GrabPay.svg"],
        methodLabel: "GrabPay",
        paymentBrand: "GrabPay",
        paymentSub: "",
        txnId: "b2b-nT8Qwz61cD-FOOD",
        customer: "FoodPanda SG",
        type: "b2b",
      },
    ],
    "27-01-2026, 04:20 pm": [
      {
        amount: 6.5,
        status: "Successful",
        logos: ["NETS.svg"],
        methodLabel: "NETS",
        paymentBrand: "NETS",
        paymentSub: "",
        txnId: "b2c-aL5Rnp08yM-FOOD",
        customer: "Wei Ming Tan",
        type: "b2c",
      },
    ],
    "27-01-2026, 12:05 pm": [
      {
        amount: 2400.0,
        status: "Successful",
        logos: ["PayNow.svg"],
        methodLabel: "PayNow",
        paymentBrand: "PayNow",
        paymentSub: "",
        txnId: "b2b-dF9Xbc62hJ-UTIL",
        customer: "SP Group",
        type: "b2b",
      },
    ],
    "26-01-2026, 07:30 pm": [
      {
        amount: 22.0,
        status: "Successful",
        logos: ["MasterCard.svg"],
        methodLabel: "\u2022\u2022\u2022\u2022 1738",
        paymentBrand: "MasterCard",
        paymentSub: "MasterCard 1738",
        txnId: "b2c-gH2Yem75sN-FOOD",
        customer: "James Lim",
        type: "b2c",
      },
      {
        amount: 9.8,
        status: "Successful",
        logos: ["Google Pay.svg", "MasterCard.svg"],
        methodLabel: "\u2022\u2022\u2022\u2022 5201",
        paymentBrand: "Google Pay",
        paymentSub: "MasterCard 5201",
        txnId: "b2c-mN4Zpq89wT-REFUND",
        customer: "Priya Nair",
        type: "b2c",
      },
    ],
    "26-01-2026, 03:15 pm": [
      {
        amount: 750.0,
        status: "Successful",
        logos: ["PayNow.svg"],
        methodLabel: "PayNow",
        paymentBrand: "PayNow",
        paymentSub: "",
        txnId: "b2b-rS6Atu13xV-RENT",
        customer: "Indian Cuisine Pte Ltd",
        type: "b2b",
      },
    ],
    "25-01-2026, 11:50 am": [
      {
        amount: 35.0,
        status: "Successful",
        logos: ["CDC Voucher.png"],
        methodLabel: "CDC Voucher",
        paymentBrand: "CDC Voucher",
        paymentSub: "",
        txnId: "b2c-rS6Atu13xV-FOOD",
        customer: "Tan Ah Kow",
        type: "b2c",
      },
    ],
    "25-01-2026, 10:20 am": [
      {
        amount: 5.0,
        status: "Successful",
        logos: ["Cash.png"],
        methodLabel: "Cash",
        paymentBrand: "Cash",
        paymentSub: "",
        txnId: "b2c-wU8Bvw47zX-FOOD",
        customer: "David Wong",
        type: "b2c",
      },
      {
        amount: 18.5,
        status: "Failed",
        logos: ["Visa.svg"],
        methodLabel: "\u2022\u2022\u2022\u2022 4411",
        paymentBrand: "Visa",
        paymentSub: "Visa 4411",
        txnId: "b2c-qJ3Lfn92kW-FOOD",
        customer: "Rachel Tan",
        type: "b2c",
      },
    ],
  };

  // Flatten the grouped orders into a single transactions array, attaching the date to each
  const transactions = [];
  for (const [dateTime, orders] of Object.entries(ordersByDate)) {
    for (const order of orders) {
      order.date = dateTime;
      transactions.push(order);
    }
  }

  let activeFilter = "all";

  const filterDefs = [
    { key: "all", label: "All" },
    { key: "successful", label: "Successful" },
    { key: "refunds", label: "Refunds" },
    { key: "failed", label: "Failed" },
    { key: "b2b", label: "B2B" },
    { key: "b2c", label: "B2C" },
  ];

  // Check if a transaction is a refund based on its transaction ID suffix
  const isRefund = (transaction) => transaction.txnId.endsWith("-REFUND");

  // Returns the count of transactions matching a given filter key
  function getCount(key) {
    if (key === "all") return transactions.length;
    if (key === "successful")
      return transactions.filter(
        (transaction) =>
          transaction.status === "Successful" && !isRefund(transaction),
      ).length;
    if (key === "refunds")
      return transactions.filter((transaction) => isRefund(transaction)).length;
    if (key === "failed")
      return transactions.filter(
        (transaction) => transaction.status === "Failed",
      ).length;
    if (key === "b2b")
      return transactions.filter((transaction) => transaction.type === "b2b")
        .length;
    if (key === "b2c")
      return transactions.filter((transaction) => transaction.type === "b2c")
        .length;
    return 0;
  }

  // Returns transactions filtered by the active filter card and search query
  function getFiltered() {
    const query = document
      .getElementById("searchInput")
      .value.toLowerCase()
      .trim();
    let filtered = transactions;

    // Apply the active filter card
    if (activeFilter === "successful")
      filtered = filtered.filter(
        (transaction) =>
          transaction.status === "Successful" && !isRefund(transaction),
      );
    else if (activeFilter === "refunds")
      filtered = filtered.filter((transaction) => isRefund(transaction));
    else if (activeFilter === "failed")
      filtered = filtered.filter(
        (transaction) => transaction.status === "Failed",
      );
    else if (activeFilter === "b2b")
      filtered = filtered.filter((transaction) => transaction.type === "b2b");
    else if (activeFilter === "b2c")
      filtered = filtered.filter((transaction) => transaction.type === "b2c");

    // Apply search query across customer name, transaction ID, payment method, date, and amount
    if (query) {
      filtered = filtered.filter(
        (transaction) =>
          transaction.customer.toLowerCase().includes(query) ||
          transaction.txnId.toLowerCase().includes(query) ||
          transaction.methodLabel.toLowerCase().includes(query) ||
          transaction.date.toLowerCase().includes(query) ||
          `s$${transaction.amount.toFixed(2)}`.includes(query),
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

    filtered.forEach((transaction) => {
      const row = document.createElement("div");
      row.className = "transactionRow";
      row.style.cursor = "pointer";

      // Determine badge styling based on transaction status and refund flag
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

      // Build payment method logo images
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

  // Re-render the table whenever the search input changes
  document.getElementById("searchInput").addEventListener("input", renderTable);

  // Keyboard shortcuts for refund (r) and invoice (n) buttons
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

  // Ctrl/Cmd+K focus search
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      document.getElementById("searchInput").focus();
    }
  });

  // Placeholder button actions
  document.getElementById("btnRefund").addEventListener("click", () => {});
  document.getElementById("btnInvoice").addEventListener("click", () => {});

  // Initial render
  renderFilterCards();
  renderTable();
});
