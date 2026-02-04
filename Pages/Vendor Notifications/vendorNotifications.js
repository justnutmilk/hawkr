import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";

const mockNotifications = [
  // Customers
  {
    title: "New Order Received",
    body: "Sarah Chen has placed order #8890 — 2x Pad Thai with shrimp, 1x Coca-Cola. Total: $49.30. Please prepare within 15 minutes.",
    timestamp: new Date(),
    source: "customers",
    link: "../Vendor Order/vendorOrder.html",
  },
  {
    title: "Order Cancelled",
    body: 'Ahmad Rizal has cancelled order #8889. Reason: "Waiting too long". A refund of $16.50 has been automatically processed.',
    timestamp: new Date(2026, 0, 28, 13, 45),
    source: "customers",
    link: "../Vendor Payments/vendorPayments.html",
  },
  {
    title: "New Review",
    body: 'Jane Doe left a 4-star review: "Chinese Sala nubbad — It was very yummy, the chinese salad was so good."',
    timestamp: new Date(2026, 0, 27, 10, 20),
    source: "customers",
    link: "../Vendor Reviews/vendorReviews.html",
  },
  {
    title: "Refund Request",
    body: 'Emily Tan is requesting a refund of $8.00 for order #8875. Reason: "Wrong item received". Please review and respond.',
    timestamp: new Date(2026, 0, 26, 16, 30),
    source: "customers",
    link: "../Vendor Payments/vendorPayments.html",
  },

  // Operator
  {
    title: "Stall Inspection Scheduled",
    body: "Maxwell Food Centre management has scheduled a hygiene inspection for your stall on 02 Feb 2026, 10:00 AM. Please ensure compliance with NEA guidelines.",
    timestamp: new Date(2026, 0, 28, 9, 0),
    source: "operator",
    link: null,
  },
  {
    title: "Rental Payment Due",
    body: "Your monthly stall rental of $1,800.00 for Unit #01-42, Maxwell Food Centre is due on 01 Feb 2026. Please ensure timely payment to avoid late fees.",
    timestamp: new Date(2026, 0, 25, 8, 0),
    source: "operator",
    link: null,
  },
  {
    title: "Maintenance Notice",
    body: "Water supply maintenance is scheduled for 30 Jan 2026, 11:00 PM — 31 Jan 2026, 05:00 AM. Please plan your operations accordingly.",
    timestamp: new Date(2026, 0, 24, 14, 0),
    source: "operator",
    link: null,
  },

  // Hawkr
  {
    title: "Platform Update",
    body: "HawkrOS v2.4 is rolling out on 01 Feb 2026. New features include improved order tracking, bulk menu editing, and enhanced analytics dashboard.",
    timestamp: new Date(2026, 0, 28, 11, 0),
    source: "hawkr",
    link: null,
  },
  {
    title: "Payout Processed",
    body: "Your weekly payout of $2,340.50 has been processed and will arrive in your DBS account ending 9402 within 1-2 business days.",
    timestamp: new Date(2026, 0, 27, 6, 0),
    source: "hawkr",
    link: "../Vendor Payments/vendorPayments.html",
  },
  {
    title: "Scheduled Maintenance",
    body: "Hawkr's payment processing system will undergo maintenance on 29 Jan 2026, 02:00 — 04:30 AM. Orders can still be received but payouts may be delayed.",
    timestamp: new Date(2026, 0, 23),
    source: "hawkr",
    link: null,
  },
];

function formatNotificationTime(timestamp) {
  const now = new Date();
  const diff = now - timestamp;

  if (diff < 60 * 1000) return "Now";
  if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))} min ago`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))} hr ago`;
  }

  const day = timestamp.getDate();
  const month = timestamp.toLocaleString("en-US", { month: "short" });
  const year = timestamp.getFullYear();
  return `${day} ${month} ${year}`;
}

function renderNotificationCard(notification) {
  const seeMoreHtml = notification.link
    ? `<a class="seeMore" href="${notification.link}">see more ></a>`
    : "";

  return `
    <div class="notificationCard">
      <div class="notificationHeader">
        <span class="notificationTitle">${notification.title}</span>
        <span class="notificationTime">${formatNotificationTime(notification.timestamp)}</span>
      </div>
      <p class="notificationBody">${notification.body}</p>
      ${seeMoreHtml}
    </div>
  `;
}

let currentTab = "customers";

function renderNotifications(tab) {
  currentTab = tab;
  const container = document.getElementById("notificationsContent");
  const filtered = mockNotifications.filter(
    (notification) => notification.source === tab,
  );

  if (filtered.length === 0) {
    container.innerHTML = `<span class="emptyState">No notifications.</span>`;
    return;
  }

  container.innerHTML = filtered.map(renderNotificationCard).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialize vendor navbar (handles auth, vendor name, logout, keyboard shortcuts)
  initVendorNavbar();

  renderNotifications("customers");

  document
    .querySelectorAll('input[name="notificationTab"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        renderNotifications(radio.value);
      });
    });
});
