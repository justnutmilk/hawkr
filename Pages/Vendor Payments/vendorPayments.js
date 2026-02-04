import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize vendor navbar (handles auth, vendor name, logout)
  initVendorNavbar();

  const paymentMethodsBasePath = "../../Payment Methods/";
  const iconsBasePath = "../../assets/icons/";

  // Mock data: orders grouped by datetime
  const ordersByDate = {
    "28-01-2026, 02:34 pm": [
      {
        amount: 12.5,
        status: "Successful",
        logos: ["Apple Pay.svg", "Visa.svg"],
        methodLabel: "\u2022\u2022\u2022\u2022 9402",
        paymentBrand: "Apple Pay",
        paymentSub: "Visa 9402",
        txnId: "c2b-j29Sksix93Q-FOOD",
        customer: "Sarah Chen",
        type: "b2c",
        items: [
          {
            name: "Mala Tang",
            vendor: "Chinese Foods Private Limited",
            price: 5.5,
            qty: 1,
            image: "",
            specialRequest: "No spicy",
          },
          {
            name: "Wonton Noodles",
            vendor: "Chinese Foods Private Limited",
            price: 4.5,
            qty: 1,
            image: "",
            specialRequest: "",
          },
          {
            name: "Barley Drink",
            vendor: "Chinese Foods Private Limited",
            price: 2.5,
            qty: 1,
            image: "",
            specialRequest: "",
          },
        ],
        review: {
          title: "Chinese Sala nubbad",
          text: "Ingredients used were fresh, and portion was great too! The real value for money.",
          rating: 3,
          author: "Sarah Chen",
          daysAgo: 2,
        },
      },
      {
        amount: 49.02,
        status: "Successful",
        logos: ["MasterCard.svg"],
        methodLabel: "\u2022\u2022\u2022\u2022 0347",
        paymentBrand: "MasterCard",
        paymentSub: "MasterCard 0347",
        txnId: "c2b-xR3Kmp47aB-FOOD",
        customer: "Sarah Chen",
        type: "b2c",
        items: [
          {
            name: "Hokkien Mee",
            vendor: "Chinese Foods Private Limited",
            price: 7.0,
            qty: 3,
            image: "",
            specialRequest: "",
          },
          {
            name: "Satay",
            vendor: "Chinese Foods Private Limited",
            price: 5.0,
            qty: 4,
            image: "",
            specialRequest: "No peanut sauce",
          },
          {
            name: "Iced Milo",
            vendor: "Chinese Foods Private Limited",
            price: 4.01,
            qty: 2,
            image: "",
            specialRequest: "",
          },
        ],
        review: null,
      },
      {
        amount: 27.9,
        status: "Successful",
        logos: ["Apple Pay.svg", "Visa.svg"],
        methodLabel: "\u2022\u2022\u2022\u2022 9402",
        paymentBrand: "Apple Pay",
        paymentSub: "Visa 9402",
        txnId: "c2b-nT8Qwz61cD-FOOD",
        customer: "Sarah Chen",
        type: "b2c",
        items: [
          {
            name: "Laksa",
            vendor: "Chinese Foods Private Limited",
            price: 7.0,
            qty: 2,
            image: "",
            specialRequest: "",
          },
          {
            name: "Barley Drink",
            vendor: "Chinese Foods Private Limited",
            price: 2.5,
            qty: 1,
            image: "",
            specialRequest: "",
          },
          {
            name: "Roti Prata",
            vendor: "Chinese Foods Private Limited",
            price: 4.9,
            qty: 1,
            image: "",
            specialRequest: "",
          },
          {
            name: "Teh Tarik",
            vendor: "Chinese Foods Private Limited",
            price: 1.8,
            qty: 1,
            image: "",
            specialRequest: "Less sweet",
          },
        ],
        review: {
          title: "Great food!",
          text: "Really enjoyed the laksa here. Will come back for more.",
          rating: 4,
          author: "Sarah Chen",
          daysAgo: 3,
        },
      },
    ],
    "28-01-2026, 01:12 pm": [
      {
        amount: 8.0,
        status: "Refunded",
        logos: ["PayNow.svg"],
        methodLabel: "PayNow",
        paymentBrand: "PayNow",
        paymentSub: "",
        txnId: "c2b-k83Tmn20xP-FOOD",
        customer: "Ahmad Rizal",
        type: "b2c",
        items: [
          {
            name: "Nasi Lemak",
            vendor: "Ching Chong Foods Private Limited",
            price: 4.5,
            qty: 1,
            image: "",
            specialRequest: "",
          },
          {
            name: "Teh Tarik",
            vendor: "Ching Chong Foods Private Limited",
            price: 1.8,
            qty: 1,
            image: "",
            specialRequest: "Less sweet",
          },
          {
            name: "Otah",
            vendor: "Ching Chong Foods Private Limited",
            price: 1.7,
            qty: 1,
            image: "",
            specialRequest: "",
          },
        ],
        review: null,
      },
    ],
    "27-01-2026, 06:45 pm": [
      {
        amount: 45.0,
        status: "Successful",
        logos: ["GrabPay.svg"],
        methodLabel: "GrabPay",
        paymentBrand: "GrabPay",
        paymentSub: "",
        txnId: "b2b-pQ7Wvn41rK-FOOD",
        customer: "FoodPanda SG",
        type: "b2b",
        items: [
          {
            name: "Chicken Rice",
            vendor: "Ching Chong Foods Private Limited",
            price: 5.0,
            qty: 3,
            image: "",
            specialRequest: "",
          },
          {
            name: "Mala Tang",
            vendor: "Chinese Foods Private Limited",
            price: 15.0,
            qty: 2,
            image: "",
            specialRequest: "Extra chilli",
          },
        ],
        review: null,
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
        txnId: "c2b-aL5Rnp08yM-FOOD",
        customer: "Wei Ming Tan",
        type: "b2c",
        items: [
          {
            name: "Char Kway Teow",
            vendor: "Ching Chong Foods Private Limited",
            price: 6.5,
            qty: 1,
            image: "",
            specialRequest: "",
          },
        ],
        review: null,
      },
    ],
    "27-01-2026, 12:05 pm": [
      {
        amount: 15.0,
        status: "Successful",
        logos: ["TouchNGo.svg"],
        methodLabel: "Touch 'n Go",
        paymentBrand: "Touch 'n Go",
        paymentSub: "",
        txnId: "c2b-dF9Xbc62hJ-FOOD",
        customer: "Nurul Huda",
        type: "b2c",
        items: [
          {
            name: "Satay",
            vendor: "Ching Chong Foods Private Limited",
            price: 5.0,
            qty: 3,
            image: "",
            specialRequest: "",
          },
        ],
        review: null,
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
        txnId: "c2b-gH2Yem75sN-FOOD",
        customer: "James Lim",
        type: "b2c",
        items: [
          {
            name: "Laksa",
            vendor: "Ching Chong Foods Private Limited",
            price: 7.0,
            qty: 2,
            image: "",
            specialRequest: "Less coconut milk",
          },
          {
            name: "Iced Milo",
            vendor: "Ching Chong Foods Private Limited",
            price: 4.0,
            qty: 2,
            image: "",
            specialRequest: "",
          },
        ],
        review: {
          title: "Pretty decent hawker food",
          text: "Laksa was rich and flavourful. Would come back again.",
          rating: 4,
          author: "James Lim",
          daysAgo: 5,
        },
      },
    ],
    "26-01-2026, 03:15 pm": [
      {
        amount: 9.8,
        status: "Successful",
        logos: ["Google Pay.svg", "MasterCard.svg"],
        methodLabel: "\u2022\u2022\u2022\u2022 5201",
        paymentBrand: "Google Pay",
        paymentSub: "MasterCard 5201",
        txnId: "c2b-mN4Zpq89wT-FOOD",
        customer: "Priya Nair",
        type: "b2c",
        items: [
          {
            name: "Roti Prata",
            vendor: "Ching Chong Foods Private Limited",
            price: 4.9,
            qty: 2,
            image: "",
            specialRequest: "",
          },
        ],
        review: null,
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
        txnId: "c2b-rS6Atu13xV-FOOD",
        customer: "Tan Ah Kow",
        type: "b2c",
        items: [
          {
            name: "Hokkien Mee",
            vendor: "Ching Chong Foods Private Limited",
            price: 7.0,
            qty: 5,
            image: "",
            specialRequest: "",
          },
        ],
        review: null,
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
        txnId: "c2b-wU8Bvw47zX-FOOD",
        customer: "David Wong",
        type: "b2c",
        items: [
          {
            name: "Chicken Rice",
            vendor: "Ching Chong Foods Private Limited",
            price: 5.0,
            qty: 1,
            image: "",
            specialRequest: "",
          },
        ],
        review: null,
      },
    ],
  };

  // Flatten into transactions array, attaching date to each order
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
    { key: "succeeded", label: "Succeeded" },
    { key: "refunded", label: "Refunded" },
    { key: "b2b", label: "B2B" },
  ];

  function getCount(key) {
    if (key === "all") return transactions.length;
    if (key === "succeeded")
      return transactions.filter(
        (transaction) => transaction.status === "Successful",
      ).length;
    if (key === "refunded")
      return transactions.filter(
        (transaction) => transaction.status === "Refunded",
      ).length;
    if (key === "b2b")
      return transactions.filter((transaction) => transaction.type === "b2b")
        .length;
    return 0;
  }

  function getFiltered() {
    const query = document
      .getElementById("searchInput")
      .value.toLowerCase()
      .trim();
    let filtered = transactions;

    if (activeFilter === "succeeded")
      filtered = filtered.filter(
        (transaction) => transaction.status === "Successful",
      );
    else if (activeFilter === "refunded")
      filtered = filtered.filter(
        (transaction) => transaction.status === "Refunded",
      );
    else if (activeFilter === "b2b")
      filtered = filtered.filter((transaction) => transaction.type === "b2b");

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
                </div>
                <div class="transactionCell transactionCellCustomer">
                    <span class="transactionCustomer">${transaction.customer}</span>
                </div>
                <div class="transactionCell transactionCellDate">
                    <span class="transactionDateTime">${transaction.date}</span>
                </div>
            `;

      row.addEventListener("click", () => {
        sessionStorage.setItem(
          "selectedTransaction",
          JSON.stringify(transaction),
        );
        sessionStorage.setItem("ordersByDate", JSON.stringify(ordersByDate));
        window.location.href = "vendorPaymentDetail.html";
      });

      table.appendChild(row);
    });
  }

  // Search
  document.getElementById("searchInput").addEventListener("input", renderTable);

  // Keyboard shortcuts
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
  document.getElementById("btnRefund").addEventListener("click", () => {
    // Placeholder
  });
  document.getElementById("btnInvoice").addEventListener("click", () => {
    // Placeholder
  });

  // Initial render
  renderFilterCards();
  renderTable();
});
