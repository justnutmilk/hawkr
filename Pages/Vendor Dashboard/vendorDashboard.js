const mockOrders = [
  {
    orderNumber: "0024",
    customerName: "Jane Doe",
    date: "12/01/25",
    time: "14:32",
    type: "Dine-in",
    itemCount: 3,
    total: 18.5,
    transactionId: "c2b-j29Sksix93-FOOD",
  },
  {
    orderNumber: "0023",
    customerName: "Ahmad bin Ismail",
    date: "12/01/25",
    time: "14:18",
    type: "Takeaway",
    itemCount: 1,
    total: 6.0,
    transactionId: "c2b-4a3B2c1D0e-FOOD",
  },
  {
    orderNumber: "0022",
    customerName: "Mei Ling Tan",
    date: "12/01/25",
    time: "13:55",
    type: "Dine-in",
    itemCount: 5,
    total: 32.0,
    transactionId: "c2b-7x6Y5z4W3v-FOOD",
  },
  {
    orderNumber: "0021",
    customerName: "Ravi Kumar",
    date: "12/01/25",
    time: "13:40",
    type: "Delivery",
    itemCount: 2,
    total: 14.5,
    transactionId: "c2b-1q2W3e4R5t-FOOD",
  },
  {
    orderNumber: "0020",
    customerName: "Sarah Chen",
    date: "12/01/25",
    time: "13:22",
    type: "Takeaway",
    itemCount: 4,
    total: 24.0,
    transactionId: "c2b-8m7N6b5V4c-FOOD",
  },
];

function renderOrderLineItem(order) {
  return `
    <div class="orderLineItem">
      <div class="orderItemNumber">#${order.orderNumber}</div>
      <div class="orderLineImportant">
        <div class="orderItemCustomerName">${order.customerName}</div>
        <div class="orderItemDateTime">${order.date}, ${order.time}</div>
      </div>
      <div class="orderItemType">${order.type}</div>
      <a href="#" class="orderItemCount">${order.itemCount} Item${order.itemCount !== 1 ? "s" : ""} &rarr;</a>
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

function renderDashboard() {
  const container = document.getElementById("dashboardContent");

  container.innerHTML = `
    <div class="orderLineSection">
      <span class="sectionLabel">ORDER LINE</span>
      <div class="orderLineCards">
        ${mockOrders.map(renderOrderLineItem).join("")}
      </div>
    </div>

    <div class="quickStatsSection">
      <span class="sectionLabel">QUICK STATS</span>
      <div class="quickStatsBlocks">
        <div class="statBlock">
          <span class="statBlockLabel">Today</span>
          <span class="statBlockValue">$142.50</span>
        </div>
        <div class="statBlock">
          <span class="statBlockLabel">This Month</span>
          <span class="statBlockValue">$3,842.00</span>
        </div>
        <div class="statBlock">
          <span class="statBlockLabel">Customer Satisfaction</span>
          <span class="statBlockPlaceholder">Graph coming soon</span>
        </div>
      </div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  renderDashboard();

  const isMac = window.navigator.userAgentData
    ? window.navigator.userAgentData.platform === "macOS"
    : /Mac/i.test(window.navigator.userAgent);

  document.getElementById("searchKeyMod").textContent = isMac ? "⌘" : "CTRL";

  document.addEventListener("keydown", (e) => {
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    if (modifier && e.key === "k") {
      e.preventDefault();
      document.getElementById("searchInput").focus();
    }
  });
});
