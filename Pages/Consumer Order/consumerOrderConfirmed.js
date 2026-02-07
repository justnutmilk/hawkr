// ============================================
// IMPORTS
// ============================================

import { auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getOrderById } from "../../firebase/services/orders.js";
import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";
import { injectMobileMenu } from "../../assets/js/mobileMenu.js";

// ============================================
// AUTH STATE
// ============================================

let currentUser = null;

// ============================================
// URL HELPERS
// ============================================

function getOrderIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("orderId");
}

// ============================================
// GENERATE ORDER NUMBER & TRANSACTION IDS
// ============================================

function generateOrderNumber(orderId) {
  // Generate a numeric-only order number from the order ID
  // Use a hash of the orderId to get consistent numbers
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    const char = orderId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Return a 3-digit number (100-999)
  return Math.abs(hash % 900) + 100;
}

function generateTransactionId(orderId) {
  // Generate c2b-XXXXXXXXXX-FOOD format
  // Use the orderId to generate consistent 10 alphanumeric characters
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) {
    const charIndex = orderId.charCodeAt(i % orderId.length) + i;
    id += chars.charAt(Math.abs(charIndex) % chars.length);
  }
  return `c2b-${id}-FOOD`;
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
        <img src="../../images/squirrelOrderConfirmed.svg" alt="Order confirmed" class="orderConfirmedIconImage" />
    `;
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderOrderConfirmedBanner(orderNumber) {
  return `
        <div class="orderConfirmedSection">
            <span class="orderConfirmedTitle">Order Confirmed</span>
            <div class="orderConfirmedIcon">
                ${getOrderConfirmedIcon()}
            </div>
            <span class="orderNumberLabel">Your order number is:</span>
            <span class="orderNumber">#${orderNumber}</span>
        </div>
    `;
}

function renderOrderItem(item) {
  // Render customizations/variants
  const customizationsHTML = (item.customizations || [])
    .map((c) => {
      const priceStr =
        c.priceAdjustment > 0 ? `+${formatPrice(c.priceAdjustment)}` : "";
      return `
        <div class="orderItemVariant">
          <span class="orderItemVariantName">${c.option || c.name}</span>
          ${priceStr ? `<span class="orderItemVariantPrice">${priceStr}</span>` : ""}
        </div>
      `;
    })
    .join("");

  const specialRequestHTML = item.specialRequest
    ? `<span class="specialRequest">↳ "${item.specialRequest}"</span>`
    : "";

  return `
        <div class="orderItem" data-item-id="${item.id}">
            <img
                src="${item.image}"
                alt="${item.name}"
                class="orderItemImage"
                onerror="this.src='../../images/placeholder-food.svg'; this.style.background='#f4f1f6'; this.style.padding='16px'; this.style.objectFit='contain';"
            />
            <div class="orderItemDetails">
                <div class="orderItemRow">
                    <div class="orderItemNameGroup">
                        <span class="itemName">${item.name}</span>
                        <span class="storeName">${item.stall.name}</span>
                        ${customizationsHTML}
                        ${specialRequestHTML}
                    </div>
                    <span class="price">${formatPrice(item.price)}</span>
                </div>
                <div class="orderItemRow">
                    <span></span>
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
  // Format payment details string (handle cases with no lastFour like GrabPay/PayNow)
  const paymentDetails = payment.lastFour
    ? `${payment.brand} ${payment.lastFour}`
    : payment.brand;

  // Build logo HTML — support multiple icons (e.g. Apple Pay + Visa)
  const icons = payment.icons || [payment.icon];
  const logosHTML = icons
    .map(
      (icon) =>
        `<img src="${icon}" alt="${payment.brand}" class="paymentMethodImage" onerror="this.style.background='#f4f1f6'" />`,
    )
    .join("");

  return `
        <section class="transactionDetailsSection">
            <span class="sectionLabel">Transaction Details</span>
            <div class="paymentMethodCard">
                ${logosHTML}
                <div class="paymentInfo">
                    <span class="paymentMethod">${payment.type}</span>
                    <span class="paymentMethodDetails">${paymentDetails}</span>
                </div>
            </div>
            <div class="transactionIds">
                <span class="transactionId">Hawkr Transaction ID: ${transactionIds.hawkr}</span>
                ${transactionIds.refund ? `<span class="transactionId refundTransactionId">Refund ID: ${transactionIds.refund}</span>` : ""}
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

  const orderId = getOrderIdFromUrl();

  if (!orderId) {
    // No order ID in URL - show error
    renderError("No order found. Please return to the menu.");
    return;
  }

  try {
    // Fetch order from Firebase
    const order = await getOrderById(orderId);

    if (!order) {
      renderError("Order not found. Please contact support.");
      return;
    }

    // Format order data for display
    const orderData = {
      orderNumber: order.orderNumber || generateOrderNumber(orderId), // Use saved order number from Firebase
      items: order.items.map((item) => ({
        id: item.menuItemId,
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.unitPrice,
        image: item.imageUrl || "",
        quantity: item.quantity,
        stall: {
          id: order.stallId,
          name: order.stallName || "Unknown Stall",
        },
        customizations: item.customizations || [],
        specialRequest: item.notes || "",
      })),
      collectionDetails: order.collectionDetails || defaultCollectionDetails,
      paymentMethod: formatPaymentMethodForDisplay(
        order.paymentDetails || { type: order.paymentMethod },
      ),
      transactionIds: {
        hawkr: order.hawkrTransactionId || generateTransactionId(orderId), // Use saved transaction ID from Firebase
        refund: order.refundTransactionId || null,
      },
      createdAt: order.createdAt,
    };

    renderConfirmedPage(orderData);
  } catch (error) {
    console.error("Error fetching order:", error);
    renderError("Failed to load order details. Please try again.");
  }
}

function renderError(message) {
  const container = document.getElementById("confirmedContent");
  if (!container) return;

  container.innerHTML = `
    <div class="errorState">
      <h2>Oops!</h2>
      <p>${message}</p>
      <a href="../Consumer Dashboard/consumerDashboard.html" class="errorBackBtn">Back to Home</a>
    </div>
  `;
}

/**
 * Format payment method data for display
 */
function formatPaymentMethodForDisplay(paymentMethod) {
  if (!paymentMethod) return defaultPaymentMethod;

  // Handle Stripe saved card
  if (paymentMethod.id && paymentMethod.brand) {
    return {
      type: "Credit Card",
      brand: capitalizeFirst(paymentMethod.brand),
      lastFour: paymentMethod.lastFour || "****",
      icon: getPaymentIcon(paymentMethod.brand),
    };
  }

  // Handle wallet payments (GrabPay, PayNow, Apple Pay, Google Pay)
  if (paymentMethod.type) {
    const type = paymentMethod.type.toLowerCase();

    if (type === "grabpay") {
      return {
        type: "GrabPay",
        brand: "GrabPay",
        lastFour: "",
        icon: "../../Payment Methods/GrabPay.svg",
      };
    }

    if (type === "paynow") {
      return {
        type: "PayNow",
        brand: "PayNow",
        lastFour: "",
        icon: "../../Payment Methods/PayNow.svg",
      };
    }

    if (type === "alipay") {
      return {
        type: "Alipay",
        brand: "支付宝",
        lastFour: "",
        icon: "../../Payment Methods/Alipay.svg",
      };
    }

    if (type === "applepay" || type === "apple_pay") {
      const cardBrand = paymentMethod.brand || "visa";
      return {
        type: "Apple Pay",
        brand: capitalizeFirst(cardBrand),
        lastFour: paymentMethod.lastFour || "",
        icon: "../../Payment Methods/Apple Pay.svg",
        icons: [
          "../../Payment Methods/Apple Pay.svg",
          getPaymentIcon(cardBrand),
        ],
      };
    }

    if (type === "googlepay" || type === "google_pay") {
      const cardBrand = paymentMethod.brand || "visa";
      return {
        type: "Google Pay",
        brand: capitalizeFirst(cardBrand),
        lastFour: paymentMethod.lastFour || "",
        icon: "../../Payment Methods/Google Pay.svg",
        icons: [
          "../../Payment Methods/Google Pay.svg",
          getPaymentIcon(cardBrand),
        ],
      };
    }

    if (type === "wallet") {
      const walletName = paymentMethod.walletName || paymentMethod.type;
      const cardBrand = paymentMethod.brand || "visa";
      if (walletName === "applePay" || walletName === "apple_pay") {
        return {
          type: "Apple Pay",
          brand: capitalizeFirst(cardBrand),
          lastFour: paymentMethod.lastFour || "",
          icon: "../../Payment Methods/Apple Pay.svg",
          icons: [
            "../../Payment Methods/Apple Pay.svg",
            getPaymentIcon(cardBrand),
          ],
        };
      }
      if (walletName === "googlePay" || walletName === "google_pay") {
        return {
          type: "Google Pay",
          brand: capitalizeFirst(cardBrand),
          lastFour: paymentMethod.lastFour || "",
          icon: "../../Payment Methods/Google Pay.svg",
          icons: [
            "../../Payment Methods/Google Pay.svg",
            getPaymentIcon(cardBrand),
          ],
        };
      }
      return {
        type: "Digital Wallet",
        brand: capitalizeFirst(cardBrand),
        lastFour: "",
        icon: getPaymentIcon(cardBrand),
      };
    }

    // Handle card type
    if (type === "card") {
      return {
        type: "Credit/Debit Card",
        brand: capitalizeFirst(paymentMethod.brand || "Card"),
        lastFour: paymentMethod.lastFour || "****",
        icon: getPaymentIcon(paymentMethod.brand),
      };
    }

    // Default card display
    return {
      type: "Credit/Debit Card",
      brand: capitalizeFirst(paymentMethod.brand || "Card"),
      lastFour: paymentMethod.lastFour || "****",
      icon: getPaymentIcon(paymentMethod.brand),
    };
  }

  return defaultPaymentMethod;
}

function capitalizeFirst(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getPaymentIcon(brand) {
  if (!brand) return "../../Payment Methods/Visa.svg";

  const brandLower = brand.toLowerCase();
  const icons = {
    visa: "../../Payment Methods/Visa.svg",
    mastercard: "../../Payment Methods/MasterCard.svg",
    amex: "../../Payment Methods/Amex.svg",
    unionpay: "../../Payment Methods/UnionPay.svg",
  };

  return icons[brandLower] || "../../Payment Methods/Visa.svg";
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();
  injectMobileMenu();

  // Listen for auth state and then initialize
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    await initializeConfirmedPage();
  });

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
