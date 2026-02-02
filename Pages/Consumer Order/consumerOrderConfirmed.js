// ============================================
// LOCAL STORAGE FUNCTIONS
// ============================================

function getOrderFromStorage() {
  const order = localStorage.getItem("hawkrConfirmedOrder");
  return order ? JSON.parse(order) : null;
}

function getCartFromStorage() {
  const cart = localStorage.getItem("hawkrCart");
  return cart ? JSON.parse(cart) : [];
}

function clearCart() {
  localStorage.removeItem("hawkrCart");
}

// ============================================
// GENERATE ORDER NUMBER & TRANSACTION IDS
// ============================================

function generateOrderNumber() {
  return Math.floor(Math.random() * 900) + 100;
}

function generateTransactionId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `c2b-${id.substring(0, 10)}-FOOD`;
}

// ============================================
// DEFAULT DATA
// ============================================

const defaultCollectionDetails = {
  venueName: "Maxwell Food Centre",
  address: "1 Kadayanallur St, Singapore 069184",
  pickupTime: 9,
  secureTime: 15,
};

const defaultPaymentMethod = {
  type: "Credit Card",
  brand: "MasterCard",
  lastFour: "0392",
  icon: "../../Payment Methods/MasterCard.svg",
};

// ============================================
// MOCK ORDER DATA (For testing/demo)
// ============================================

const mockOrderItems = [
  {
    id: 1,
    name: "Mala Tang",
    price: 23.9,
    image:
      "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
    quantity: 1,
    stall: {
      id: 1,
      name: "Chinese Foods Private Limited",
    },
    specialRequest: "No spicy",
  },
];

// ============================================
// STATE
// ============================================

let orderState = null;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatPrice(price) {
  return `$${price.toFixed(1)}`;
}

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// ============================================
// ICON COMPONENTS
// ============================================

function getLocationIcon() {
  return `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="28" viewBox="0 0 52 61" fill="none">
            <path d="M26 1.79297C32.4461 1.79297 38.0834 3.89747 42.9863 8.13867C47.7763 12.2822 50.207 17.836 50.207 24.9961C50.207 29.565 48.2666 34.726 44.0859 40.5215C40.0929 46.0569 34.0844 52.1038 26 58.6611C17.9156 52.1038 11.9071 46.0569 7.91406 40.5215C3.73337 34.726 1.79303 29.565 1.79297 24.9961C1.79297 17.836 4.22366 12.2822 9.01367 8.13867C13.9166 3.89747 19.5539 1.79297 26 1.79297ZM26 4.30371C20.1035 4.30371 15.0382 6.22234 10.9199 10.085C6.76556 13.9815 4.70703 19.0033 4.70703 24.9961C4.7071 29.1178 6.52242 33.6041 9.81641 38.3955C13.1334 43.2204 18.1612 48.5038 24.8301 54.2461L26 55.2539L27.1699 54.2461C33.8388 48.5038 38.8666 43.2204 42.1836 38.3955C45.4776 33.6041 47.2929 29.1178 47.293 24.9961C47.293 19.0033 45.2344 13.9815 41.0801 10.085C36.9618 6.22234 31.8965 4.30371 26 4.30371ZM26 20.083C27.3441 20.083 28.4325 20.5148 29.3643 21.3887C30.2921 22.2591 30.7069 23.2274 30.707 24.3857C30.707 25.5443 30.2922 26.5133 29.3643 27.3838C28.4325 28.2577 27.3441 28.6895 26 28.6895C24.6559 28.6895 23.5675 28.2577 22.6357 27.3838C21.7078 26.5133 21.293 25.5443 21.293 24.3857C21.2931 23.2274 21.7079 22.2591 22.6357 21.3887C23.5675 20.5148 24.6559 20.083 26 20.083Z" fill="#FF5F00" stroke="#FF5F00" stroke-width="1.412"/>
        </svg>
    `;
}

function getClockIcon() {
  return `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 23 23" fill="none">
            <path d="M11.2584 5.11744V11.2584L15.3524 13.3054M21.4934 11.2584C21.4934 16.9111 16.9111 21.4934 11.2584 21.4934C5.6058 21.4934 1.02344 16.9111 1.02344 11.2584C1.02344 5.6058 5.6058 1.02344 11.2584 1.02344C16.9111 1.02344 21.4934 5.6058 21.4934 11.2584Z" stroke="#7375CF" stroke-width="2.047" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
}

function getOrderConfirmedIcon() {
  return `
        <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34" fill="none">
            <path d="M18.3825 18.1724L11.7325 11.5224C11.5267 11.3166 11.3634 11.0722 11.252 10.8033C11.1407 10.5344 11.0833 10.2462 11.0833 9.95518C11.0833 9.66413 11.1407 9.37593 11.252 9.10703C11.3634 8.83813 11.5267 8.59381 11.7325 8.388C11.9383 8.18219 12.1826 8.01894 12.4515 7.90756C12.7204 7.79618 13.0086 7.73885 13.2997 7.73885C13.5907 7.73885 13.8789 7.79618 14.1478 7.90756C14.4167 8.01894 14.661 8.18219 14.8668 8.388L19.9497 13.4708L29.4658 3.95467C29.8815 3.53902 30.4452 3.30552 31.033 3.30552C31.3241 3.30552 31.6123 3.36284 31.8812 3.47423C32.1501 3.58561 32.3944 3.74886 32.6002 3.95467C32.806 4.16047 32.9692 4.4048 33.0806 4.6737C33.192 4.94259 33.2493 5.2308 33.2493 5.52185C33.2493 5.8129 33.192 6.1011 33.0806 6.37C32.9692 6.6389 32.806 6.88323 32.6002 7.08903L21.5168 18.1724C21.3115 18.3789 21.0673 18.5428 20.7983 18.6547C20.5294 18.7666 20.241 18.8241 19.9497 18.8241C19.6584 18.8241 19.37 18.7666 19.101 18.6547C18.8321 18.5428 18.5879 18.3789 18.3825 18.1724Z" fill="#5C5F62"/>
            <path d="M3.73333 3.73333V24.2667H10.2667C11.7133 24.2667 12.8576 25.5024 13.8619 26.5888L14.0672 26.8128C14.7504 27.5427 15.7211 28 16.8 28C17.8789 28 18.8496 27.5427 19.5309 26.8109L19.7363 26.5888H19.7381C20.7424 25.5024 21.8867 24.2667 23.3333 24.2667H29.8667V20.5333C29.8667 20.0383 30.0633 19.5635 30.4134 19.2134C30.7635 18.8633 31.2383 18.6667 31.7333 18.6667C32.2284 18.6667 32.7032 18.8633 33.0533 19.2134C33.4033 19.5635 33.6 20.0383 33.6 20.5333V30.8C33.6 31.5426 33.305 32.2548 32.7799 32.7799C32.2548 33.305 31.5426 33.6 30.8 33.6H2.8C2.05739 33.6 1.3452 33.305 0.820101 32.7799C0.294999 32.2548 0 31.5426 0 30.8V2.8C0 2.05739 0.294999 1.3452 0.820101 0.820101C1.3452 0.294999 2.05739 0 2.8 0H11.2C11.6951 0 12.1699 0.196666 12.5199 0.546734C12.87 0.896802 13.0667 1.3716 13.0667 1.86667C13.0667 2.36174 12.87 2.83653 12.5199 3.1866C12.1699 3.53667 11.6951 3.73333 11.2 3.73333H3.73333Z" fill="#5C5F62"/>
        </svg>
    `;
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderOrderConfirmedBanner(orderNumber) {
  return `
        <div class="orderConfirmedBanner">
            <div class="orderConfirmedIcon">
                ${getOrderConfirmedIcon()}
            </div>
            <span class="orderConfirmedText">Order confirmed.</span>
            <span class="orderNumber">#${orderNumber}</span>
        </div>
    `;
}

function renderOrderItem(item) {
  const specialRequestHTML = item.specialRequest
    ? `<span class="specialRequest">"${item.specialRequest}"</span>`
    : "";

  return `
        <div class="orderItem" data-item-id="${item.id}">
            <img
                src="${item.image}"
                alt="${item.name}"
                class="orderItemImage"
                onerror="this.style.background='#f4f1f6'"
            />
            <div class="orderItemDetails">
                <div class="orderItemRow">
                    <div class="orderItemNameGroup">
                        <span class="itemName">${item.name}</span>
                        <span class="storeName">${item.stall.name}</span>
                    </div>
                    <span class="price">${formatPrice(item.price)}</span>
                </div>
                <div class="orderItemRow">
                    ${specialRequestHTML || "<span></span>"}
                    <span class="qtyCount">${item.quantity}</span>
                </div>
            </div>
        </div>
    `;
}

function renderOrderItems(items) {
  return `
        <div class="orderItemsList">
            ${items.map((item) => renderOrderItem(item)).join("")}
        </div>
    `;
}

function renderTotalRow(items) {
  const total = calculateTotal(items);
  return `
        <div class="totalRow">
            <span class="totalLabel">Total</span>
            <span class="totalPrice">${formatPrice(total)}</span>
        </div>
    `;
}

function renderCollectionDetails(details) {
  return `
        <section class="collectionDetailsSection">
            <span class="sectionLabel">Collection Details</span>
            <div class="collectionRow">
                <div class="collectionIcon location">
                    ${getLocationIcon()}
                </div>
                <div class="collectionInfo">
                    <span class="collectionTitle">${details.venueName}</span>
                    <span class="collectionSubtitle">${details.address}</span>
                </div>
            </div>
            <div class="collectionRow">
                <div class="collectionIcon time">
                    ${getClockIcon()}
                </div>
                <div class="collectionInfo">
                    <span class="collectionTitle">Pick up in ${details.pickupTime} minutes</span>
                    <span class="collectionSubtitle">The vendor will only secure your order for ${details.secureTime} minutes.</span>
                </div>
            </div>
        </section>
    `;
}

function renderTransactionDetails(payment, transactionIds) {
  return `
        <section class="transactionDetailsSection">
            <span class="sectionLabel">Transaction Details</span>
            <div class="paymentMethodCard">
                <img
                    src="${payment.icon}"
                    alt="${payment.brand}"
                    class="paymentMethodImage"
                    onerror="this.style.background='#f4f1f6'"
                />
                <div class="paymentInfo">
                    <span class="paymentMethod">${payment.type}</span>
                    <span class="paymentMethodDetails">${payment.brand} ${payment.lastFour}</span>
                </div>
            </div>
            <div class="transactionIds">
                <span class="transactionId">Hawkr Transaction ID: ${transactionIds.hawkr}</span>
                <span class="transactionId">Stripe Transaction ID: ${transactionIds.stripe}</span>
            </div>
        </section>
    `;
}

function renderConfirmedPage(orderData) {
  const container = document.getElementById("confirmedContent");
  if (!container) return;

  orderState = orderData;

  const bannerHTML = renderOrderConfirmedBanner(orderData.orderNumber);
  const itemsHTML = renderOrderItems(orderData.items);
  const totalHTML = renderTotalRow(orderData.items);
  const collectionHTML = renderCollectionDetails(orderData.collectionDetails);
  const transactionHTML = renderTransactionDetails(
    orderData.paymentMethod,
    orderData.transactionIds,
  );

  container.innerHTML = `
        ${bannerHTML}
        ${itemsHTML}
        ${totalHTML}
        <div class="detailsRow">
            ${collectionHTML}
            ${transactionHTML}
        </div>
    `;
}

// ============================================
// LOADING STATE HELPERS
// ============================================

function showLoading() {
  const container = document.getElementById("confirmedContent");
  if (container) {
    container.innerHTML = `<div class="loadingSpinner"></div>`;
  }
}

// ============================================
// NAVIGATION HANDLERS
// ============================================

function handleBackClick() {
  // Go back to dashboard or home
  window.location.href = "../Consumer Dashboard/consumerDashboard.html";
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initializeConfirmedPage() {
  showLoading();

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Try to get order from storage, or use cart items
  let orderData = getOrderFromStorage();

  if (!orderData) {
    // If no confirmed order, create one from cart
    const cartItems = getCartFromStorage();
    const items = cartItems.length > 0 ? cartItems : mockOrderItems;

    const transactionId = generateTransactionId();

    orderData = {
      orderNumber: generateOrderNumber(),
      items: items,
      collectionDetails: defaultCollectionDetails,
      paymentMethod: defaultPaymentMethod,
      transactionIds: {
        hawkr: transactionId,
        stripe: transactionId,
      },
      createdAt: new Date().toISOString(),
    };

    // Save to storage
    localStorage.setItem("hawkrConfirmedOrder", JSON.stringify(orderData));

    // Clear the cart after order is confirmed
    clearCart();
  }

  renderConfirmedPage(orderData);
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  initializeConfirmedPage();

  // Back button handler
  const backButton = document.getElementById("backButton");
  if (backButton) {
    backButton.addEventListener("click", handleBackClick);
  }

  // Search input focus shortcut
  const searchInput = document.getElementById("searchInput");

  document.addEventListener("keydown", function (e) {
    if (!searchInput) return;

    const targetTag = e.target.tagName.toLowerCase();
    const isEditable = e.target.isContentEditable === true;

    if (targetTag === "input" || targetTag === "textarea" || isEditable) {
      return;
    }

    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
});
