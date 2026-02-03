const mockOrders = [
  {
    orderNumber: "8887",
    customerName: "Jane",
    date: "23-01-2026",
    time: "6:07 pm",
    type: "Takeaway",
    status: "preparing",
    items: [
      {
        qty: 1,
        name: "Pad Thai with shrimp",
        price: 23.9,
        note: '"sawatdee"',
      },
      {
        qty: 1,
        name: "Pad Thai with shrimp, extra peanuts, and lime",
        price: 15.5,
        note: null,
      },
      {
        qty: 1,
        name: "Coca-Cola",
        price: 1.5,
        note: '"ooh gassy"',
      },
    ],
    total: 32.5,
    transactionId: "c2b-j29Sksix93Q-FOOD",
  },
  {
    orderNumber: "8886",
    customerName: "Emily",
    date: "23-01-2026",
    time: "6:20 pm",
    type: "Dine-In",
    status: "preparing",
    items: [
      {
        qty: 1,
        name: "Sushi platter",
        price: 28.0,
        note: null,
      },
      {
        qty: 1,
        name: "Sushi platter with tuna, salmon, and eel, served with miso soup",
        price: 18.8,
        note: '"UNCLE PLS add extra seafood I promise i will pay you on the spot."',
      },
      {
        qty: 1,
        name: "Green Tea",
        price: 2.0,
        note: null,
      },
    ],
    total: 48.8,
    transactionId: "c2b-eM4kPq8rW2-FOOD",
  },
  {
    orderNumber: "8885",
    customerName: "Ahmad",
    date: "23-01-2026",
    time: "6:35 pm",
    type: "Takeaway",
    status: "preparing",
    items: [
      {
        qty: 2,
        name: "Nasi Lemak",
        price: 7.0,
        note: null,
      },
      {
        qty: 1,
        name: "Teh Tarik",
        price: 2.5,
        note: '"kurang manis"',
      },
    ],
    total: 16.5,
    transactionId: "c2b-rT5nLx3vQ9-FOOD",
  },
  {
    orderNumber: "8880",
    customerName: "Sarah",
    date: "23-01-2026",
    time: "5:00 pm",
    type: "Dine-In",
    status: "complete",
    items: [
      {
        qty: 1,
        name: "Chicken Rice",
        price: 5.5,
        note: null,
      },
      {
        qty: 1,
        name: "Iced Milo",
        price: 2.0,
        note: '"extra milo pls"',
      },
    ],
    total: 7.5,
    transactionId: "c2b-wK9mHj4sP1-FOOD",
  },
  {
    orderNumber: "8879",
    customerName: "Ravi",
    date: "23-01-2026",
    time: "4:45 pm",
    type: "Takeaway",
    status: "complete",
    items: [
      {
        qty: 3,
        name: "Roti Prata",
        price: 1.5,
        note: null,
      },
      {
        qty: 1,
        name: "Fish Head Curry",
        price: 18.0,
        note: '"more spicy"',
      },
    ],
    total: 22.5,
    transactionId: "c2b-bN6cFd2xA7-FOOD",
  },
];

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

function renderOrders(tab) {
  const container = document.getElementById("orderContent");
  const filtered = mockOrders.filter((o) => o.status === tab);

  container.innerHTML = `
    <div class="orderLineHeader">
      <span class="sectionLabel">Order Line</span>
      <a class="newOrderButton" href="vendorCreateOrder.html">
        New order
        <kbd>n</kbd>
      </a>
    </div>
    <div class="orderLineCards">
      ${filtered.map(renderOrderLineItem).join("")}
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  // Check for new order from Create Order page (via sessionStorage)
  const newOrderData = sessionStorage.getItem("newOrder");
  if (newOrderData) {
    sessionStorage.removeItem("newOrder");
    const newOrder = JSON.parse(newOrderData);
    mockOrders.unshift(newOrder);
  }

  renderOrders("preparing");

  const isMac = window.navigator.userAgentData
    ? window.navigator.userAgentData.platform === "macOS"
    : /Mac/i.test(window.navigator.userAgent);

  document.getElementById("searchKeyMod").textContent = isMac
    ? "\u2318"
    : "CTRL";

  document.addEventListener("keydown", (e) => {
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    if (modifier && e.key === "k") {
      e.preventDefault();
      document.getElementById("searchInput").focus();
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

  document.querySelectorAll('input[name="orderTab"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      renderOrders(radio.value);
    });
  });
});
