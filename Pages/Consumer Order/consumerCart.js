// ============================================
// FIREBASE IMPORTS
// ============================================

import { auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getCart,
  updateCartItemQuantity,
  updateCartItemNotes,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../../firebase/services/customers.js";
import { createOrder } from "../../firebase/services/orders.js";
import { getMenuItem } from "../../firebase/services/foodStalls.js";
import {
  loadStripe,
  createSetupIntent,
  getPaymentMethods,
  createPaymentIntent,
  processPayment,
  saveCard,
  createCardElement,
  getCardIcon,
  createPaymentRequest,
  mountPaymentRequestButton,
  processGrabPayPayment,
  processPayNowPayment,
  processAliPayPayment,
} from "../../firebase/services/stripe.js";
import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";
import { initMobileMenu } from "../../assets/js/mobileMenu.js";

// Check authentication state
let currentUser = null;

// ============================================
// DEFAULT DATA (For collection/payment details)
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

// Payment methods (loaded from Stripe)
let savedPaymentMethods = [];

// Selected payment method state
let selectedPaymentMethod = null;
let selectedWallet = null; // 'grabpay', 'paynow', 'alipay', or null

// Stripe state
let stripeInstance = null;
let cardElement = null;
let setupIntentClientSecret = null;
let paymentRequestInstance = null;

// ============================================
// PAYMENT ERROR HANDLING
// ============================================

/**
 * Redirect to the payment unsuccessful page with error details
 * @param {string} errorMessage - The error message to display
 * @param {string} paymentMethod - The payment method that failed (optional)
 */
function redirectToPaymentFailed(errorMessage, paymentMethod = null) {
  const params = new URLSearchParams();
  params.set("error", errorMessage);
  if (paymentMethod) {
    params.set("method", paymentMethod);
  }
  window.location.href = `consumerOrderUnsuccessful.html?${params.toString()}`;
}

// ============================================
// API FUNCTIONS (Firebase Backend Calls)
// ============================================

async function fetchCartData() {
  if (!currentUser) {
    // Fallback to localStorage for guests
    return fetchCartFromLocalStorage();
  }

  try {
    const cartItems = await getCart(currentUser.uid);

    // Transform Firebase cart data to match expected format
    const items = cartItems.map((item) => ({
      id: item.id, // Firebase document ID
      menuItemId: item.menuItemId,
      name: item.name,
      price: item.price,
      basePrice: item.basePrice || item.price,
      image: item.imageUrl || "",
      quantity: item.quantity,
      stall: {
        id: item.stallId,
        name: item.stallName || "Unknown Stall",
      },
      specialRequest: item.notes || "",
      selectedVariants: item.selectedVariants || [],
    }));

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    return {
      items,
      collectionDetails: defaultCollectionDetails,
      paymentMethod: defaultPaymentMethod,
      subtotal,
      total: subtotal,
    };
  } catch (error) {
    console.error("Error fetching cart data:", error);
    return {
      items: [],
      collectionDetails: defaultCollectionDetails,
      paymentMethod: defaultPaymentMethod,
      subtotal: 0,
      total: 0,
    };
  }
}

function fetchCartFromLocalStorage() {
  const cartItems = JSON.parse(localStorage.getItem("hawkrCart") || "[]");

  const items = cartItems.map((item, index) => ({
    id: `local-${index}`,
    menuItemId: item.menuItemId,
    name: item.name,
    price: item.price,
    basePrice: item.basePrice || item.price,
    image: item.imageUrl || "",
    quantity: item.quantity,
    stall: {
      id: item.stallId,
      name: item.stallName || "Unknown Stall",
    },
    specialRequest: item.notes || "",
    selectedVariants: item.selectedVariants || [],
  }));

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return {
    items,
    collectionDetails: defaultCollectionDetails,
    paymentMethod: defaultPaymentMethod,
    subtotal,
    total: subtotal,
  };
}

async function updateItemQuantity(cartItemId, newQuantity) {
  if (!currentUser) {
    // Update localStorage for guests
    return updateLocalStorageQuantity(cartItemId, newQuantity);
  }

  try {
    if (newQuantity <= 0) {
      await removeFromCart(currentUser.uid, cartItemId);
    } else {
      await updateCartItemQuantity(currentUser.uid, cartItemId, newQuantity);
    }
    return true;
  } catch (error) {
    console.error("Error updating cart item quantity:", error);
    return false;
  }
}

function updateLocalStorageQuantity(cartItemId, newQuantity) {
  const index = parseInt(cartItemId.replace("local-", ""));
  const cart = JSON.parse(localStorage.getItem("hawkrCart") || "[]");

  if (newQuantity <= 0) {
    cart.splice(index, 1);
  } else {
    cart[index].quantity = newQuantity;
  }

  localStorage.setItem("hawkrCart", JSON.stringify(cart));
  return true;
}

async function clearUserCart() {
  if (!currentUser) {
    localStorage.removeItem("hawkrCart");
    return true;
  }

  try {
    await clearCart(currentUser.uid);
    return true;
  } catch (error) {
    console.error("Error clearing cart:", error);
    return false;
  }
}

// ============================================
// STATE
// ============================================

let cartState = null;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatPrice(price) {
  return `$${price.toFixed(1)}`;
}

function calculateSubtotal(items) {
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

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderCartItem(item) {
  // Build variants display string
  const variantsDisplay =
    item.selectedVariants && item.selectedVariants.length > 0
      ? item.selectedVariants.map((v) => v.option).join(", ")
      : "";

  // Build special request display
  const specialRequestDisplay = item.specialRequest
    ? `<span class="cartItemSpecialRequest">↳ "${item.specialRequest}"</span>`
    : "";

  return `
        <div class="cartItem" data-item-id="${item.id}">
            <img
                src="${item.image}"
                alt="${item.name}"
                class="cartItemImage"
                onerror="this.style.background='#f4f1f6'"
            />
            <div class="cartItemDetails">
                <div class="cartItemTop">
                    <div class="cartItemInfo">
                        <span class="foodName">${item.name}</span>
                        ${variantsDisplay ? `<span class="cartItemVariants">${variantsDisplay}</span>` : ""}
                        <span class="storeName">${item.stall.name}</span>
                        ${specialRequestDisplay}
                    </div>
                    <button class="editBtn" data-item-id="${item.id}">
                        <span class="editBtnText">Edit</span>
                    </button>
                </div>
                <div class="cartItemFooter">
                    <span class="price">${formatPrice(item.price)}</span>
                    <div class="qtyControls">
                        <div class="qtyBtnGroup">
                            <button class="qtyBtn qtyDecrease" data-item-id="${item.id}" aria-label="Decrease quantity">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="2" viewBox="0 0 14 2" fill="none">
                                    <path d="M1 1H13" stroke="#1d1d1f" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </button>
                            <span class="qtyDivider"></span>
                            <button class="qtyBtn qtyIncrease" data-item-id="${item.id}" aria-label="Increase quantity">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M7 1V13M1 7H13" stroke="#1d1d1f" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </button>
                        </div>
                        <span class="qtyCount">${item.quantity}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderOrderSummary(items) {
  const subtotal = calculateSubtotal(items);
  const itemsHTML = items.map((item) => renderCartItem(item)).join("");

  return `
        <section class="orderSummarySection">
            <div class="orderSummaryHeader">
                <span class="orderSummaryLabel">Order Summary</span>
                <div class="cartItemsList">
                    ${itemsHTML}
                </div>
            </div>
            <div class="subtotalRow">
                <span class="subtotalLabel">Subtotal</span>
                <span class="subtotalPrice" id="subtotalPrice">${formatPrice(subtotal)}</span>
            </div>
        </section>
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

function renderPaymentDetails() {
  let savedCardsHTML = "";

  if (savedPaymentMethods.length > 0) {
    savedCardsHTML = savedPaymentMethods
      .map(
        (method) => `
          <label class="paymentOption ${selectedPaymentMethod?.id === method.id ? "selected" : ""}" data-payment-id="${method.id}">
              <input
                  type="radio"
                  name="paymentMethod"
                  value="${method.id}"
                  ${selectedPaymentMethod?.id === method.id ? "checked" : ""}
              />
              <div class="paymentOptionContent">
                  <img src="${getCardIcon(method.brand)}" alt="${method.brand}" class="paymentOptionIcon" />
                  <span class="paymentOptionDetails">•••• ${method.lastFour}</span>
                  ${method.isDefault ? '<span class="paymentOptionDefault">Default</span>' : ""}
              </div>
              <div class="paymentOptionCheck">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17L4 12" stroke="#913b9f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
              </div>
          </label>
        `,
      )
      .join("");
  } else {
    savedCardsHTML = `
      <div class="noPaymentMethods">
        <p>No saved payment methods</p>
      </div>
    `;
  }

  return `
        <section class="paymentDetailsSection">
            <span class="sectionLabel">Payment Method</span>

            <div class="savedPaymentMethods">
                ${savedCardsHTML}
            </div>

            <button class="addNewCardBtn" id="addNewCardBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5V19M5 12H19" stroke="#913b9f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Add new card</span>
            </button>

            <div class="paymentDivider">
                <span class="paymentDividerLine"></span>
                <span class="paymentDividerText">or pay with</span>
                <span class="paymentDividerLine"></span>
            </div>

            <div class="digitalWallets">
                <div id="paymentRequestButton"></div>
                <button class="walletBtn" data-wallet="grabpay">
                    <img src="../../images/GrabPay logo.svg" alt="GrabPay" />
                </button>
                <button class="walletBtn" data-wallet="alipay">
                    <img src="../../images/AliPay logo.svg" alt="AliPay" />
                </button>
                <button class="walletBtn" data-wallet="paynow">
                    <img src="../../images/PayNow logo.svg" alt="PayNow" />
                </button>
            </div>
        </section>
    `;
}

function renderCheckoutSection(items) {
  const total = calculateSubtotal(items);

  return `
        <section class="checkoutSection">
            <div class="totalRow">
                <span class="totalLabel">Total</span>
                <span class="totalPrice" id="totalPrice">${formatPrice(total)}</span>
            </div>
            <button class="placeOrderBtn" id="placeOrderBtn">
                Place Order - Pickup
            </button>
        </section>
    `;
}

function renderEmptyCart() {
  const container = document.getElementById("cartContent");
  if (!container) return;

  container.innerHTML = `
    <div class="emptyCart">
      <div class="emptyCartIcon">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="70" viewBox="0 0 32 35" fill="none">
          <path d="M1.33301 7.73301L6.2219 1.33301H25.7775L30.6663 7.73301M1.33301 7.73301V30.133C1.33301 30.9817 1.67639 31.7956 2.28762 32.3958C2.89885 32.9959 3.72786 33.333 4.59227 33.333H27.4071C28.2715 33.333 29.1005 32.9959 29.7117 32.3958C30.323 31.7956 30.6663 30.9817 30.6663 30.133V7.73301M1.33301 7.73301H30.6663M22.5182 14.133C22.5182 15.8304 21.8314 17.4583 20.609 18.6585C19.3865 19.8587 17.7285 20.533 15.9997 20.533C14.2709 20.533 12.6128 19.8587 11.3904 18.6585C10.1679 17.4583 9.48116 15.8304 9.48116 14.133" stroke="#d1d1d1" stroke-width="2.66667" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h2 class="emptyCartTitle">Your cart is empty</h2>
      <p class="emptyCartText">Looks like you haven't added any items yet.</p>
      <a href="consumerOrderShop.html" class="emptyCartBtn">Browse Food</a>
    </div>
  `;
}

function renderCartPage(cartData) {
  const container = document.getElementById("cartContent");
  if (!container) return;

  cartState = cartData;

  // Check if cart is empty
  if (!cartData.items || cartData.items.length === 0) {
    renderEmptyCart();
    return;
  }

  const orderSummaryHTML = renderOrderSummary(cartData.items);
  const collectionDetailsHTML = renderCollectionDetails(
    cartData.collectionDetails,
  );
  const paymentDetailsHTML = renderPaymentDetails();
  const checkoutSectionHTML = renderCheckoutSection(cartData.items);

  container.innerHTML =
    orderSummaryHTML +
    collectionDetailsHTML +
    paymentDetailsHTML +
    checkoutSectionHTML;

  attachEventListeners();
}

// ============================================
// EVENT HANDLERS
// ============================================

function attachEventListeners() {
  // Quantity buttons - using event delegation
  const cartContent = document.getElementById("cartContent");
  if (cartContent) {
    cartContent.addEventListener("click", handleCartClick);
  }

  // Place order button
  const placeOrderBtn = document.getElementById("placeOrderBtn");
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener("click", handlePlaceOrder);
  }

  // Edit button mouse tracking for subtle purple glow
  const editButtons = document.querySelectorAll(".editBtn");
  editButtons.forEach((btn) => {
    btn.addEventListener("mousemove", handleEditBtnMouseMove);
  });

  // Payment method selection
  const paymentOptions = document.querySelectorAll(".paymentOption");
  paymentOptions.forEach((option) => {
    option.addEventListener("click", handlePaymentMethodSelect);
  });

  // Add new card button
  const addNewCardBtn = document.getElementById("addNewCardBtn");
  if (addNewCardBtn) {
    addNewCardBtn.addEventListener("click", handleAddNewCard);
  }

  // Digital wallet buttons
  const walletBtns = document.querySelectorAll(".walletBtn");
  walletBtns.forEach((btn) => {
    btn.addEventListener("click", handleWalletSelect);
  });
}

function handleEditBtnMouseMove(e) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  btn.style.setProperty("--mouse-x", `${x}px`);
  btn.style.setProperty("--mouse-y", `${y}px`);
}

function handleCartClick(e) {
  const target = e.target.closest("button");
  if (!target) return;

  const itemId = target.dataset.itemId;

  if (target.classList.contains("qtyDecrease")) {
    updateQuantity(itemId, -1);
  } else if (target.classList.contains("qtyIncrease")) {
    updateQuantity(itemId, 1);
  } else if (target.classList.contains("editBtn")) {
    handleEdit(itemId);
  }
}

async function updateQuantity(itemId, delta) {
  const itemIndex = cartState.items.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) return;

  const item = cartState.items[itemIndex];
  const newQuantity = item.quantity + delta;

  // Update Firebase or localStorage
  const success = await updateItemQuantity(itemId, newQuantity);
  if (!success) {
    console.error("Failed to update quantity");
    return;
  }

  if (newQuantity < 1) {
    // Remove item from cart state
    cartState.items.splice(itemIndex, 1);

    // Remove item element from DOM
    const itemElement = document.querySelector(
      `.cartItem[data-item-id="${itemId}"]`,
    );
    if (itemElement) {
      itemElement.remove();
    }

    // Check if cart is empty and show empty state
    if (cartState.items.length === 0) {
      renderEmptyCart();
    }

    // Update subtotal and total
    updateTotals();
    return;
  }

  item.quantity = newQuantity;

  // Update UI
  const itemElement = document.querySelector(
    `.cartItem[data-item-id="${itemId}"]`,
  );
  if (itemElement) {
    const qtyCount = itemElement.querySelector(".qtyCount");
    if (qtyCount) {
      qtyCount.textContent = newQuantity;
    }
  }

  // Update subtotal and total
  updateTotals();
}

function updateTotals() {
  const subtotal = calculateSubtotal(cartState.items);

  const subtotalElement = document.getElementById("subtotalPrice");
  if (subtotalElement) {
    subtotalElement.textContent = formatPrice(subtotal);
  }

  const totalElement = document.getElementById("totalPrice");
  if (totalElement) {
    totalElement.textContent = formatPrice(subtotal);
  }
}

// ============================================
// EDIT POPUP FUNCTIONS
// ============================================

let currentEditItemId = null;
let currentEditItem = null;
let editSelectedVariants = {};
let currentMenuItemCustomizations = [];

async function openEditPopup(itemId) {
  const item = cartState.items.find((i) => i.id === itemId);
  if (!item) return;

  currentEditItemId = itemId;
  currentEditItem = item;

  // Populate item info
  const itemInfoContainer = document.getElementById("editPopupItemInfo");
  if (itemInfoContainer) {
    itemInfoContainer.innerHTML = `
      <img src="${item.image}" alt="${item.name}" class="editPopupItemImage" onerror="this.style.background='#f4f1f6'" />
      <div class="editPopupItemDetails">
        <span class="editPopupItemName">${item.name}</span>
        <span class="editPopupItemStall">${item.stall.name}</span>
      </div>
    `;
  }

  // Fetch menu item to get available customizations
  const variantsSection = document.getElementById("editPopupVariantsSection");
  if (variantsSection) {
    variantsSection.innerHTML =
      '<div class="editPopupLoading">Loading options...</div>';
  }

  try {
    // Fetch menu item customizations from Firebase
    const menuItem = await getMenuItem(item.stall.id, item.menuItemId);
    currentMenuItemCustomizations = menuItem?.customizations || [];

    // Initialize edit selected variants from current cart item selection
    // Initialize editSelectedVariants based on customizations and existing selections
    editSelectedVariants = {};
    currentMenuItemCustomizations.forEach((variant, groupIndex) => {
      const isMultiSelect = variant.multiSelect || false;

      if (isMultiSelect) {
        // Multi-select: find all matching selections from cart item
        const existingSelections = (item.selectedVariants || [])
          .filter((v) => v.name === variant.name)
          .map((v) => {
            const optIndex = variant.options.indexOf(v.option);
            return {
              option: v.option,
              optionIndex: optIndex >= 0 ? optIndex : 0,
              priceAdjustment: v.priceAdjustment || 0,
            };
          });

        editSelectedVariants[groupIndex] = {
          name: variant.name,
          multiSelect: true,
          selections: existingSelections,
        };
      } else {
        // Single-select: find matching selection or default to first
        const existing = (item.selectedVariants || []).find(
          (v) => v.name === variant.name,
        );
        if (existing) {
          const optIndex = variant.options.indexOf(existing.option);
          editSelectedVariants[groupIndex] = {
            name: variant.name,
            multiSelect: false,
            option: existing.option,
            optionIndex: optIndex >= 0 ? optIndex : 0,
            priceAdjustment: existing.priceAdjustment || 0,
          };
        } else {
          // Default to first option
          editSelectedVariants[groupIndex] = {
            name: variant.name,
            multiSelect: false,
            option: variant.options[0],
            optionIndex: 0,
            priceAdjustment: variant.priceAdjustments?.[0] || 0,
          };
        }
      }
    });

    // Render variants
    renderEditVariants();
  } catch (error) {
    console.error("Error fetching menu item:", error);
    if (variantsSection) {
      variantsSection.innerHTML = "";
    }
    currentMenuItemCustomizations = [];
  }

  // Restore special request text
  const specialRequestInput = document.getElementById("specialRequestInput");
  if (specialRequestInput) {
    specialRequestInput.value = item.specialRequest || "";
  }

  // Update price display
  updateEditPopupPrice();

  // Show popup
  const overlay = document.getElementById("editPopupOverlay");
  if (overlay) {
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function renderEditVariants() {
  const variantsSection = document.getElementById("editPopupVariantsSection");
  if (!variantsSection || currentMenuItemCustomizations.length === 0) {
    if (variantsSection) variantsSection.innerHTML = "";
    return;
  }

  variantsSection.innerHTML = currentMenuItemCustomizations
    .map((variant, groupIndex) => {
      const currentSelection = editSelectedVariants[groupIndex];
      const isMultiSelect = variant.multiSelect || false;
      const inputType = isMultiSelect ? "checkbox" : "radio";

      return `
        <div class="editVariantGroup" data-group="${groupIndex}" data-multiselect="${isMultiSelect}">
          <span class="editVariantGroupLabel">${variant.name}${isMultiSelect ? ' <span class="editVariantMultiHint">(select multiple)</span>' : ""}</span>
          <div class="editVariantOptions">
            ${variant.options
              .map((option, optIndex) => {
                let isSelected = false;
                if (isMultiSelect) {
                  // Check if option is in selections array
                  isSelected =
                    currentSelection?.selections?.some(
                      (s) => s.option === option,
                    ) || false;
                } else {
                  isSelected = currentSelection?.option === option;
                }
                const priceAdj = variant.priceAdjustments?.[optIndex] || 0;
                return `
                  <label class="editVariantOption ${isSelected ? "selected" : ""}" data-group="${groupIndex}" data-opt="${optIndex}">
                    <input
                      type="${inputType}"
                      name="edit-variant-${groupIndex}"
                      value="${optIndex}"
                      ${isSelected ? "checked" : ""}
                      data-group="${groupIndex}"
                      data-opt="${optIndex}"
                      data-price="${priceAdj}"
                      data-option="${option}"
                      data-multiselect="${isMultiSelect}"
                    >
                    <span class="editVariantOptionName">${option}</span>
                    ${priceAdj > 0 ? `<span class="editVariantOptionPrice">+${formatPrice(priceAdj)}</span>` : ""}
                  </label>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");

  // Bind variant change events
  bindEditVariantEvents();
}

function bindEditVariantEvents() {
  const variantsSection = document.getElementById("editPopupVariantsSection");
  if (!variantsSection) return;

  // Handle single-select (radio buttons)
  variantsSection.querySelectorAll('input[type="radio"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const groupIndex = parseInt(e.target.dataset.group);
      const optIndex = parseInt(e.target.dataset.opt);
      const priceAdj = parseFloat(e.target.dataset.price) || 0;
      const option = e.target.dataset.option;

      // Update visual selection
      const group = e.target.closest(".editVariantGroup");
      group
        .querySelectorAll(".editVariantOption")
        .forEach((opt) => opt.classList.remove("selected"));
      e.target.closest(".editVariantOption").classList.add("selected");

      // Update state
      const variant = currentMenuItemCustomizations[groupIndex];
      editSelectedVariants[groupIndex] = {
        name: variant.name,
        multiSelect: false,
        option: option,
        optionIndex: optIndex,
        priceAdjustment: priceAdj,
      };

      // Update price display
      updateEditPopupPrice();
    });
  });

  // Handle multi-select (checkboxes)
  variantsSection
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const groupIndex = parseInt(e.target.dataset.group);
        const optIndex = parseInt(e.target.dataset.opt);
        const priceAdj = parseFloat(e.target.dataset.price) || 0;
        const option = e.target.dataset.option;
        const isChecked = e.target.checked;

        // Update visual selection
        if (isChecked) {
          e.target.closest(".editVariantOption").classList.add("selected");
        } else {
          e.target.closest(".editVariantOption").classList.remove("selected");
        }

        // Update state
        const variant = currentMenuItemCustomizations[groupIndex];
        if (!editSelectedVariants[groupIndex]) {
          editSelectedVariants[groupIndex] = {
            name: variant.name,
            multiSelect: true,
            selections: [],
          };
        }

        if (isChecked) {
          // Add selection
          editSelectedVariants[groupIndex].selections.push({
            option: option,
            optionIndex: optIndex,
            priceAdjustment: priceAdj,
          });
        } else {
          // Remove selection
          editSelectedVariants[groupIndex].selections = editSelectedVariants[
            groupIndex
          ].selections.filter((s) => s.optionIndex !== optIndex);
        }

        // Update price display
        updateEditPopupPrice();
      });
    });
}

function calculateEditTotalPrice() {
  if (!currentEditItem) return 0;
  const basePrice = currentEditItem.basePrice || currentEditItem.price;
  let total = basePrice;
  Object.values(editSelectedVariants).forEach((v) => {
    if (v.multiSelect) {
      // Sum all selected options for multi-select groups
      (v.selections || []).forEach((sel) => {
        total += sel.priceAdjustment || 0;
      });
    } else {
      // Single-select: just add the one price adjustment
      total += v.priceAdjustment || 0;
    }
  });
  return total;
}

function updateEditPopupPrice() {
  const priceElement = document.getElementById("editPopupPrice");
  if (priceElement) {
    priceElement.textContent = formatPrice(calculateEditTotalPrice());
  }
}

function closeEditPopup() {
  const overlay = document.getElementById("editPopupOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }
  currentEditItemId = null;
}

async function saveEditPopup() {
  if (currentEditItemId === null) return;

  const item = cartState.items.find((i) => i.id === currentEditItemId);
  if (!item) return;

  // Get special request text
  const specialRequestInput = document.getElementById("specialRequestInput");
  const specialRequest = specialRequestInput
    ? specialRequestInput.value.trim()
    : "";

  // Build selected variants array (flatten multi-select into individual entries)
  const selectedVariantsArray = [];
  Object.values(editSelectedVariants).forEach((v) => {
    if (v.multiSelect) {
      // Multi-select: add each selection as separate entry
      (v.selections || []).forEach((sel) => {
        selectedVariantsArray.push({
          name: v.name,
          option: sel.option,
          priceAdjustment: sel.priceAdjustment,
        });
      });
    } else {
      // Single-select: add the one selection
      selectedVariantsArray.push({
        name: v.name,
        option: v.option,
        priceAdjustment: v.priceAdjustment,
      });
    }
  });

  // Calculate new total price
  const newPrice = calculateEditTotalPrice();

  // Update item locally
  item.specialRequest = specialRequest;
  item.selectedVariants = selectedVariantsArray;
  item.price = newPrice;

  // Save to Firebase if logged in, otherwise update localStorage
  if (currentUser) {
    try {
      await updateCartItem(currentUser.uid, currentEditItemId, {
        notes: specialRequest,
        selectedVariants: selectedVariantsArray,
        price: newPrice,
      });
    } catch (error) {
      console.error("Error saving cart item:", error);
    }
  } else {
    // Update localStorage for guests
    const index = parseInt(currentEditItemId.replace("local-", ""));
    const cart = JSON.parse(localStorage.getItem("hawkrCart") || "[]");
    if (cart[index]) {
      cart[index].notes = specialRequest;
      cart[index].selectedVariants = selectedVariantsArray;
      cart[index].price = newPrice;
      // Update variants key for proper matching
      cart[index].variantsKey = selectedVariantsArray
        .map((v) => `${v.name}:${v.option}`)
        .join("|");
      localStorage.setItem("hawkrCart", JSON.stringify(cart));
    }
  }

  // Re-render cart to show updated variants and price
  renderCartPage(cartState);
  attachEventListeners();
  updateTotals();

  // Close popup
  closeEditPopup();
}

function handleEdit(itemId) {
  openEditPopup(itemId);
}

// ============================================
// PAYMENT METHOD HANDLERS
// ============================================

function handlePaymentMethodSelect(e) {
  const option = e.currentTarget;
  const paymentId = option.dataset.paymentId;

  // Find the selected payment method
  const method = savedPaymentMethods.find((m) => m.id === paymentId);
  if (!method) return;

  // Update state - select card, deselect wallet
  selectedPaymentMethod = method;
  selectedWallet = null;

  // Update UI - remove selected class from all options and wallets
  document.querySelectorAll(".paymentOption").forEach((opt) => {
    opt.classList.remove("selected");
    opt.querySelector('input[type="radio"]').checked = false;
  });

  document.querySelectorAll(".walletBtn").forEach((btn) => {
    btn.classList.remove("selected");
  });

  // Add selected class to clicked option
  option.classList.add("selected");
  option.querySelector('input[type="radio"]').checked = true;

  console.log("Selected payment method:", selectedPaymentMethod);
}

async function handleAddNewCard() {
  if (!currentUser) {
    alert("Please log in to add a payment method");
    return;
  }

  try {
    // Load Stripe if not already loaded
    if (!stripeInstance) {
      stripeInstance = await loadStripe();
    }

    // Create SetupIntent for saving card
    const { clientSecret } = await createSetupIntent();
    setupIntentClientSecret = clientSecret;

    // Open the modal
    openCardModal();

    // Create and mount card element
    if (cardElement) {
      cardElement.destroy();
    }
    cardElement = createCardElement(stripeInstance, "cardElement");

    // Listen for card element changes
    cardElement.on("change", (event) => {
      const errorElement = document.getElementById("cardError");
      if (event.error) {
        errorElement.textContent = event.error.message;
      } else {
        errorElement.textContent = "";
      }
    });
  } catch (error) {
    console.error("Error setting up card input:", error);
    alert("Failed to set up card input. Please try again.");
  }
}

function openCardModal() {
  const overlay = document.getElementById("cardModalOverlay");
  if (overlay) {
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeCardModal() {
  const overlay = document.getElementById("cardModalOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  // Clear error
  const errorElement = document.getElementById("cardError");
  if (errorElement) {
    errorElement.textContent = "";
  }
}

async function handleSaveCard() {
  const saveBtn = document.getElementById("cardModalSaveBtn");
  const errorElement = document.getElementById("cardError");

  if (!stripeInstance || !cardElement || !setupIntentClientSecret) {
    console.error("Missing required:", {
      stripeInstance: !!stripeInstance,
      cardElement: !!cardElement,
      setupIntentClientSecret: !!setupIntentClientSecret,
    });
    errorElement.textContent = "Card setup not ready. Please try again.";
    return;
  }

  try {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    console.log(
      "Saving card with client secret:",
      setupIntentClientSecret?.substring(0, 20) + "...",
    );

    const result = await saveCard(
      stripeInstance,
      cardElement,
      setupIntentClientSecret,
    );

    console.log("Save card result:", result);

    if (!result.success) {
      errorElement.textContent = result.error;
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Card";
      return;
    }

    // Card saved successfully - reload payment methods
    await loadSavedPaymentMethods();

    // Close modal
    closeCardModal();

    // Re-render payment section
    refreshPaymentSection();
  } catch (error) {
    console.error("Error saving card:", error);
    errorElement.textContent = "Failed to save card. Please try again.";
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Card";
  }
}

async function loadSavedPaymentMethods() {
  if (!currentUser) {
    savedPaymentMethods = [];
    selectedPaymentMethod = null;
    return;
  }

  try {
    const methods = await getPaymentMethods();
    savedPaymentMethods = methods.map((m, index) => ({
      ...m,
      isDefault: index === 0, // First one is default for now
    }));

    // Select the first method by default
    if (savedPaymentMethods.length > 0 && !selectedPaymentMethod) {
      selectedPaymentMethod = savedPaymentMethods[0];
    }
  } catch (error) {
    console.error("Error loading payment methods:", error);
    savedPaymentMethods = [];
  }
}

function refreshPaymentSection() {
  const paymentSection = document.querySelector(".paymentDetailsSection");
  if (paymentSection) {
    paymentSection.outerHTML = renderPaymentDetails();
    // Re-attach event listeners for payment options
    attachPaymentEventListeners();
  }
}

function attachPaymentEventListeners() {
  const paymentOptions = document.querySelectorAll(".paymentOption");
  paymentOptions.forEach((option) => {
    option.addEventListener("click", handlePaymentMethodSelect);
  });

  const addNewCardBtn = document.getElementById("addNewCardBtn");
  if (addNewCardBtn) {
    addNewCardBtn.addEventListener("click", handleAddNewCard);
  }

  const walletBtns = document.querySelectorAll(".walletBtn");
  walletBtns.forEach((btn) => {
    btn.addEventListener("click", handleWalletSelect);
  });

  // Initialize Payment Request Button (Apple Pay / Google Pay)
  initPaymentRequestButton();
}

async function initPaymentRequestButton() {
  if (!stripeInstance || !cartState?.items?.length) {
    return;
  }

  const total = calculateSubtotal(cartState.items);
  const container = document.getElementById("paymentRequestButton");

  if (!container) return;

  try {
    const { paymentRequest, canMakePayment, applePay, googlePay } =
      await createPaymentRequest(stripeInstance, total, "sgd", "Hawkr Order");

    if (!canMakePayment) {
      // Hide the container if no wallet payment is available
      container.style.display = "none";
      console.log(
        "Apple Pay / Google Pay not available on this device/browser",
      );
      return;
    }

    console.log("Payment Request available:", { applePay, googlePay });

    // Store the payment request instance
    paymentRequestInstance = paymentRequest;

    // Mount the button
    mountPaymentRequestButton(
      stripeInstance,
      paymentRequest,
      "paymentRequestButton",
    );

    // Handle payment method received from Apple Pay / Google Pay
    paymentRequest.on("paymentmethod", async (ev) => {
      try {
        showPaymentProcessing();

        // Create PaymentIntent on the server
        const { clientSecret, paymentIntentId } =
          await createPaymentIntent(total);

        // Confirm the payment with the wallet payment method
        const { paymentIntent, error } =
          await stripeInstance.confirmCardPayment(
            clientSecret,
            { payment_method: ev.paymentMethod.id },
            { handleActions: false },
          );

        if (error) {
          ev.complete("fail");
          hidePaymentProcessing();
          redirectToPaymentFailed(error.message, "wallet");
          return;
        }

        if (paymentIntent.status === "requires_action") {
          const { error: confirmError } =
            await stripeInstance.confirmCardPayment(clientSecret);
          if (confirmError) {
            ev.complete("fail");
            hidePaymentProcessing();
            redirectToPaymentFailed(confirmError.message, "wallet");
            return;
          }
        }

        ev.complete("success");

        // Determine wallet type (Apple Pay or Google Pay)
        const walletBrand = ev.paymentMethod.card?.brand || "wallet";
        const walletType = ev.walletName || "wallet"; // "applePay" or "googlePay"

        // Create order in Firebase
        const orderId = await createOrderInFirebase(
          paymentIntentId,
          walletType,
          { type: walletType, brand: walletBrand },
        );

        // Validate orderId before redirect
        if (!orderId || typeof orderId !== "string") {
          throw new Error("Order creation failed - no valid order ID returned");
        }

        hidePaymentProcessing();
        window.location.href = `consumerOrderConfirmed.html?orderId=${orderId}`;
      } catch (err) {
        console.error("Wallet payment error:", err);
        ev.complete("fail");
        hidePaymentProcessing();
        redirectToPaymentFailed(err.message || "Payment failed", "wallet");
      }
    });
  } catch (error) {
    console.error("Error setting up Payment Request Button:", error);
    container.style.display = "none";
  }
}

function handleWalletSelect(e) {
  const wallet = e.currentTarget.dataset.wallet;
  console.log("Wallet selected:", wallet);

  // Update state - select wallet, deselect card
  selectedWallet = wallet;
  selectedPaymentMethod = null;

  // Update UI - remove selected class from all payment options and wallets
  document.querySelectorAll(".paymentOption").forEach((opt) => {
    opt.classList.remove("selected");
    const radio = opt.querySelector('input[type="radio"]');
    if (radio) radio.checked = false;
  });

  document.querySelectorAll(".walletBtn").forEach((btn) => {
    btn.classList.remove("selected");
  });

  // Add selected class to clicked wallet
  e.currentTarget.classList.add("selected");

  console.log("Selected wallet:", selectedWallet);
}

async function handleGrabPayPayment(total) {
  try {
    showPaymentProcessing();

    // Create PaymentIntent first
    const { clientSecret, paymentIntentId } = await createPaymentIntent(total);

    // Store only the paymentIntentId - we'll fetch cart from Firebase on return
    localStorage.setItem("hawkrGrabPayIntentId", paymentIntentId);

    // Return URL goes back to cart page with payment_intent param
    const returnUrl = `${window.location.origin}${window.location.pathname}?payment_intent=${paymentIntentId}&redirect_status=succeeded`;

    // Process GrabPay payment (will redirect to GrabPay)
    const result = await processGrabPayPayment(
      stripeInstance,
      clientSecret,
      returnUrl,
    );

    if (!result.success) {
      localStorage.removeItem("hawkrGrabPayIntentId");
      hidePaymentProcessing();
      redirectToPaymentFailed(result.error, "grabpay");
    }
    // If successful, user will be redirected to GrabPay
  } catch (error) {
    console.error("GrabPay payment error:", error);
    localStorage.removeItem("hawkrGrabPayIntentId");
    hidePaymentProcessing();
    redirectToPaymentFailed(error.message || "Payment failed", "grabpay");
  }
}

async function handleAliPayPayment(total) {
  try {
    showPaymentProcessing();

    // Create PaymentIntent first
    const { clientSecret, paymentIntentId } = await createPaymentIntent(total);

    // Store only the paymentIntentId - we'll fetch cart from Firebase on return
    localStorage.setItem("hawkrAliPayIntentId", paymentIntentId);

    // Return URL goes back to cart page with payment_intent param
    const returnUrl = `${window.location.origin}${window.location.pathname}?payment_intent=${paymentIntentId}&redirect_status=succeeded`;

    // Process AliPay payment (will redirect to AliPay)
    const result = await processAliPayPayment(
      stripeInstance,
      clientSecret,
      returnUrl,
    );

    if (!result.success) {
      localStorage.removeItem("hawkrAliPayIntentId");
      hidePaymentProcessing();
      redirectToPaymentFailed(result.error, "alipay");
    }
    // If successful, user will be redirected to AliPay
  } catch (error) {
    console.error("AliPay payment error:", error);
    localStorage.removeItem("hawkrAliPayIntentId");
    hidePaymentProcessing();
    redirectToPaymentFailed(error.message || "Payment failed", "alipay");
  }
}

async function handlePayNowPayment(total) {
  try {
    showPaymentProcessing();

    console.log("=== PayNow Payment Flow Started ===");
    console.log(
      "currentUser:",
      currentUser ? currentUser.uid : "NOT LOGGED IN",
    );
    console.log("cartState:", cartState);
    console.log("cartState.items:", cartState?.items);
    console.log("Creating PaymentIntent for PayNow, amount:", total);

    // Create PaymentIntent
    const { clientSecret, paymentIntentId } = await createPaymentIntent(total);

    console.log("PaymentIntent created:", {
      paymentIntentId,
      clientSecret: clientSecret?.substring(0, 20) + "...",
    });

    // Process PayNow payment (will show QR code)
    const result = await processPayNowPayment(stripeInstance, clientSecret);

    console.log("PayNow result:", result);

    hidePaymentProcessing();

    if (!result.success) {
      redirectToPaymentFailed(result.error, "paynow");
      return;
    }

    if (result.qrCode) {
      // Show PayNow QR code modal
      showPayNowQRCode(result.qrCode, paymentIntentId, total);
    } else if (result.status === "succeeded") {
      // Payment already succeeded
      await completePayNowOrder(paymentIntentId, total);
    }
  } catch (error) {
    console.error("PayNow payment error:", error);
    hidePaymentProcessing();
    redirectToPaymentFailed(error.message || "Payment failed", "paynow");
  }
}

// Store cart data for PayNow flow (preserved across polling)
let pendingPayNowCartData = null;

// Flag to prevent re-initialization during payment processing
let isPaymentInProgress = false;

// Flag to prevent multiple order completion attempts (race condition fix)
let isCompletingOrder = false;

function showPayNowQRCode(qrCodeData, paymentIntentId, total) {
  // Mark payment as in progress to prevent page re-initialization
  isPaymentInProgress = true;

  // IMPORTANT: Store cart data before showing QR code so it's preserved during polling
  pendingPayNowCartData = JSON.parse(JSON.stringify(cartState));
  console.log("Stored cart data for PayNow:", pendingPayNowCartData);

  // Create QR code modal
  const modal = document.createElement("div");
  modal.className = "paynowModalOverlay active";
  modal.id = "paynowModalOverlay";
  modal.innerHTML = `
    <div class="paynowModal">
      <div class="paynowModalHeader">
        <h2 class="paynowModalTitle">Scan to Pay with PayNow</h2>
        <button class="paynowModalClose" id="paynowModalClose">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="#341539" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="paynowModalContent">
        <img src="${qrCodeData.image_url_png}" alt="PayNow QR Code" class="paynowQRCode" />
        <p class="paynowAmount">Amount: $${total.toFixed(2)}</p>
        <p class="paynowInstructions">Open your banking app and scan this QR code to complete payment</p>
        <div class="paynowPolling">
          <div class="paynowSpinner"></div>
          <span>Waiting for payment...</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close button handler
  document.getElementById("paynowModalClose").addEventListener("click", () => {
    modal.remove();
    stopPayNowPolling();
    pendingPayNowCartData = null; // Clear stored cart on cancel
    isPaymentInProgress = false; // Allow page re-initialization
  });

  // Start polling for payment status
  startPayNowPolling(paymentIntentId, total);
}

let paynowPollingInterval = null;

function startPayNowPolling(paymentIntentId, total) {
  console.log("=== Starting PayNow polling ===");
  console.log("paymentIntentId:", paymentIntentId);
  console.log("total:", total);
  console.log(
    "currentUser at polling start:",
    currentUser ? currentUser.uid : "NOT LOGGED IN",
  );
  console.log("cartState at polling start:", cartState);

  paynowPollingInterval = setInterval(async () => {
    try {
      const { getPaymentStatus } =
        await import("../../firebase/services/stripe.js");

      console.log("Polling payment status for:", paymentIntentId);
      const result = await getPaymentStatus(paymentIntentId);
      console.log("Payment status result:", result);

      const status = result?.status;
      console.log("PayNow polling status:", status);

      if (status === "succeeded") {
        console.log("=== PayNow payment succeeded! ===");
        console.log(
          "currentUser at success:",
          currentUser ? currentUser.uid : "NOT LOGGED IN",
        );
        console.log("cartState at success:", cartState);
        console.log("pendingPayNowCartData at success:", pendingPayNowCartData);

        // Stop polling immediately to prevent duplicate calls
        stopPayNowPolling();

        // Remove the QR modal
        const modal = document.getElementById("paynowModalOverlay");
        if (modal) modal.remove();

        // Complete the order (await to ensure it completes before anything else)
        console.log("Calling completePayNowOrder...");
        await completePayNowOrder(paymentIntentId, total);
        console.log("completePayNowOrder finished");
      }
    } catch (error) {
      console.error("Error polling PayNow status:", error);
      console.error("Error details:", error.message, error.stack);
    }
  }, 3000); // Poll every 3 seconds
}

function stopPayNowPolling() {
  if (paynowPollingInterval) {
    clearInterval(paynowPollingInterval);
    paynowPollingInterval = null;
  }
}

async function completePayNowOrder(paymentIntentId, total) {
  console.log("completePayNowOrder called:", { paymentIntentId, total });

  // Prevent multiple simultaneous order completion attempts
  if (isCompletingOrder) {
    console.log(
      "Order completion already in progress, skipping duplicate call",
    );
    return;
  }
  isCompletingOrder = true;

  try {
    showPaymentProcessing();

    // Use stored cart data from when QR code was shown (most reliable)
    if (
      pendingPayNowCartData &&
      pendingPayNowCartData.items &&
      pendingPayNowCartData.items.length > 0
    ) {
      console.log("Using stored PayNow cart data:", pendingPayNowCartData);
      cartState = pendingPayNowCartData;
    }
    // Fallback: try current cartState
    else if (!cartState || !cartState.items || cartState.items.length === 0) {
      console.log("cartState is empty, fetching from Firebase...");
      const cartData = await fetchCartData();
      cartState = cartData;
      console.log("Fetched cartState from Firebase:", cartState);
    }

    // Check if cart is still empty after all attempts
    if (!cartState || !cartState.items || cartState.items.length === 0) {
      throw new Error(
        "Cart is empty. Cannot create order. Please add items to cart first.",
      );
    }

    console.log("Creating order in Firebase for PayNow...");
    console.log("Cart items:", cartState.items);

    // Create order in Firebase
    const orderId = await createOrderInFirebase(paymentIntentId, "paynow", {
      type: "paynow",
      brand: "PayNow",
    });

    console.log("PayNow order created successfully, orderId:", orderId);
    console.log("orderId type:", typeof orderId);

    // Validate orderId before redirect
    if (!orderId || typeof orderId !== "string") {
      throw new Error("Order creation failed - no valid order ID returned");
    }

    // Clear the stored cart data
    pendingPayNowCartData = null;

    hidePaymentProcessing();

    // Navigate to order confirmed page with order ID
    const redirectUrl = `consumerOrderConfirmed.html?orderId=${orderId}`;
    console.log("Redirecting to:", redirectUrl);
    window.location.href = redirectUrl;
  } catch (error) {
    console.error("Error creating PayNow order:", error);
    pendingPayNowCartData = null; // Clear on error too
    isCompletingOrder = false; // Reset flag on error to allow retry
    hidePaymentProcessing();
    redirectToPaymentFailed(error.message || "Order creation failed", "paynow");
  }
}

function showPaymentProcessing() {
  isPaymentInProgress = true;
  const overlay = document.getElementById("paymentProcessingOverlay");
  if (overlay) {
    overlay.classList.add("active");
  }
}

function hidePaymentProcessing() {
  isPaymentInProgress = false;
  const overlay = document.getElementById("paymentProcessingOverlay");
  if (overlay) {
    overlay.classList.remove("active");
  }
}

async function handlePlaceOrder() {
  if (!cartState.items || cartState.items.length === 0) {
    alert("Your cart is empty");
    return;
  }

  if (!selectedPaymentMethod && !selectedWallet) {
    alert("Please select a payment method");
    return;
  }

  const total = calculateSubtotal(cartState.items);

  // Handle wallet payments (GrabPay, PayNow, AliPay)
  if (selectedWallet) {
    if (selectedWallet === "grabpay") {
      await handleGrabPayPayment(total);
    } else if (selectedWallet === "paynow") {
      await handlePayNowPayment(total);
    } else if (selectedWallet === "alipay") {
      await handleAliPayPayment(total);
    }
    return;
  }

  // Handle card payment below

  try {
    showPaymentProcessing();

    console.log("Processing card payment for total:", total);
    console.log("Selected payment method:", selectedPaymentMethod);

    // Create PaymentIntent
    const { clientSecret, paymentIntentId, status } = await createPaymentIntent(
      total,
      selectedPaymentMethod.id,
    );

    console.log("PaymentIntent created:", { paymentIntentId, status });

    // If payment requires confirmation
    if (status === "requires_confirmation" || status === "requires_action") {
      const result = await processPayment(
        stripeInstance,
        clientSecret,
        selectedPaymentMethod.id,
      );

      if (!result.success) {
        hidePaymentProcessing();
        redirectToPaymentFailed(result.error || "Payment failed", "card");
        return;
      }
    }

    console.log("Payment successful, creating order in Firebase...");

    // Payment successful - create order in Firebase
    const orderId = await createOrderInFirebase(
      paymentIntentId,
      "card",
      selectedPaymentMethod,
    );

    console.log("Order created successfully:", orderId);

    // Validate orderId before redirect
    if (!orderId || typeof orderId !== "string") {
      throw new Error("Order creation failed - no valid order ID returned");
    }

    hidePaymentProcessing();

    // Navigate to order confirmed page with order ID
    const redirectUrl = `consumerOrderConfirmed.html?orderId=${orderId}`;
    console.log("Redirecting to:", redirectUrl);
    window.location.href = redirectUrl;
  } catch (error) {
    console.error("Error processing payment:", error);
    hidePaymentProcessing();
    redirectToPaymentFailed(error.message || "Payment failed", "card");
  }
}

/**
 * Create order in Firebase after successful payment
 */
async function createOrderInFirebase(
  paymentIntentId,
  paymentType,
  paymentMethod,
) {
  console.log("createOrderInFirebase called:", {
    paymentIntentId,
    paymentType,
    paymentMethod,
  });
  console.log("cartState:", cartState);

  // Validate cart state
  if (!cartState || !cartState.items || cartState.items.length === 0) {
    throw new Error("Cart is empty. Cannot create order.");
  }

  // Group items by stall
  const itemsByStall = {};
  cartState.items.forEach((item) => {
    const stallId = item.stall?.id || item.stallId;
    if (!itemsByStall[stallId]) {
      itemsByStall[stallId] = {
        stallId: stallId,
        stallName: item.stall?.name || item.stallName || "Unknown Stall",
        items: [],
      };
    }
    itemsByStall[stallId].items.push(item);
  });

  console.log("Items grouped by stall:", itemsByStall);

  // Create an order for each stall (in case cart has items from multiple stalls)
  const orderIds = [];
  for (const stallId in itemsByStall) {
    const stallData = itemsByStall[stallId];
    const stallItems = stallData.items;
    const stallSubtotal = stallItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const orderData = {
      stallId: stallId,
      stallName: stallData.stallName,
      hawkerCentreId: cartState.collectionDetails?.hawkerCentreId || null,
      items: stallItems.map((item) => ({
        menuItemId: item.menuItemId || item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity,
        notes: item.specialRequest || item.notes || "",
        imageUrl: item.image || item.imageUrl || "",
        customizations: item.selectedVariants || [],
      })),
      subtotal: stallSubtotal,
      serviceFee: 0,
      total: stallSubtotal,
      paymentMethod: paymentType,
      paymentStatus: "paid",
      paymentIntentId: paymentIntentId,
      paymentDetails: {
        type: paymentType,
        brand: paymentMethod?.brand || paymentType,
        lastFour: paymentMethod?.lastFour || "",
      },
      collectionDetails:
        cartState.collectionDetails || defaultCollectionDetails,
    };

    console.log("Creating order with data:", orderData);

    try {
      const orderId = await createOrder(orderData);
      console.log("Order created successfully with ID:", orderId);
      orderIds.push(orderId);
    } catch (orderError) {
      console.error("Error creating order in Firebase:", orderError);
      throw new Error(`Failed to create order: ${orderError.message}`);
    }
  }

  // Verify we got an order ID
  if (orderIds.length === 0) {
    throw new Error("No orders were created");
  }

  // Clear the cart after order creation
  if (currentUser) {
    try {
      await clearCart(currentUser.uid);
      console.log("Cart cleared successfully");
    } catch (clearError) {
      console.error("Error clearing cart (non-fatal):", clearError);
      // Don't throw here - order was created, cart clear is secondary
    }
  }

  // Return the first order ID (or could return all for multi-stall orders)
  console.log("Returning orderId:", orderIds[0]);
  return orderIds[0];
}

// ============================================
// LOADING STATE HELPERS
// ============================================

function showLoading() {
  const container = document.getElementById("cartContent");
  if (container) {
    container.innerHTML = `<div class="loadingSpinner"></div>`;
  }
}

// ============================================
// NAVIGATION HANDLERS
// ============================================

function handleBackClick() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "consumerOrderShop.html";
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

/**
 * Check if returning from GrabPay redirect and complete the order
 */
async function handleGrabPayReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentIntent = urlParams.get("payment_intent");
  const redirectStatus = urlParams.get("redirect_status");

  console.log("GrabPay return check:", { paymentIntent, redirectStatus });

  if (!paymentIntent) return false;

  // Verify this is a GrabPay return by checking stored intent ID
  const storedIntentId = localStorage.getItem("hawkrGrabPayIntentId");
  if (!storedIntentId || storedIntentId !== paymentIntent) {
    console.log("Payment intent doesn't match stored GrabPay intent");
    return false;
  }

  if (redirectStatus === "succeeded") {
    try {
      showPaymentProcessing();

      // Fetch cart from Firebase (this is the reliable source)
      console.log("Fetching cart from Firebase...");
      const cartData = await fetchCartData();
      cartState = cartData;
      console.log("Cart fetched:", cartState);

      if (!cartState.items || cartState.items.length === 0) {
        throw new Error("Cart is empty. Order may have already been placed.");
      }

      console.log("Creating order in Firebase for GrabPay...");
      console.log("Cart items:", cartState.items);

      // Create order in Firebase
      const orderId = await createOrderInFirebase(paymentIntent, "grabpay", {
        type: "grabpay",
        brand: "GrabPay",
      });

      console.log("GrabPay order created successfully:", orderId);

      // Validate orderId before redirect
      if (!orderId || typeof orderId !== "string") {
        throw new Error("Order creation failed - no valid order ID returned");
      }

      // Clear stored intent ID
      localStorage.removeItem("hawkrGrabPayIntentId");

      hidePaymentProcessing();

      // Redirect to order confirmed page
      const redirectUrl = `consumerOrderConfirmed.html?orderId=${orderId}`;
      console.log("Redirecting to:", redirectUrl);
      window.location.href = redirectUrl;
      return true;
    } catch (error) {
      console.error("Error completing GrabPay order:", error);
      hidePaymentProcessing();
      localStorage.removeItem("hawkrGrabPayIntentId");
      redirectToPaymentFailed(
        error.message || "Failed to complete order",
        "grabpay",
      );
      return false;
    }
  } else {
    // Payment failed or was cancelled
    console.log("GrabPay payment not succeeded, status:", redirectStatus);
    localStorage.removeItem("hawkrGrabPayIntentId");
    redirectToPaymentFailed("GrabPay payment was not completed", "grabpay");
    return false;
  }
}

/**
 * Check if returning from AliPay redirect and complete the order
 */
async function handleAliPayReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentIntent = urlParams.get("payment_intent");
  const redirectStatus = urlParams.get("redirect_status");

  console.log("AliPay return check:", { paymentIntent, redirectStatus });

  if (!paymentIntent) return false;

  // Verify this is an AliPay return by checking stored intent ID
  const storedIntentId = localStorage.getItem("hawkrAliPayIntentId");
  if (!storedIntentId || storedIntentId !== paymentIntent) {
    console.log("Payment intent doesn't match stored AliPay intent");
    return false;
  }

  if (redirectStatus === "succeeded") {
    try {
      showPaymentProcessing();

      // Fetch cart from Firebase (this is the reliable source)
      console.log("Fetching cart from Firebase...");
      const cartData = await fetchCartData();
      cartState = cartData;
      console.log("Cart fetched:", cartState);

      if (!cartState.items || cartState.items.length === 0) {
        throw new Error("Cart is empty. Order may have already been placed.");
      }

      console.log("Creating order in Firebase for AliPay...");
      console.log("Cart items:", cartState.items);

      // Create order in Firebase
      const orderId = await createOrderInFirebase(paymentIntent, "alipay", {
        type: "alipay",
        brand: "AliPay",
      });

      console.log("AliPay order created successfully:", orderId);

      // Validate orderId before redirect
      if (!orderId || typeof orderId !== "string") {
        throw new Error("Order creation failed - no valid order ID returned");
      }

      // Clear stored intent ID
      localStorage.removeItem("hawkrAliPayIntentId");

      hidePaymentProcessing();

      // Redirect to order confirmed page
      const redirectUrl = `consumerOrderConfirmed.html?orderId=${orderId}`;
      console.log("Redirecting to:", redirectUrl);
      window.location.href = redirectUrl;
      return true;
    } catch (error) {
      console.error("Error completing AliPay order:", error);
      hidePaymentProcessing();
      localStorage.removeItem("hawkrAliPayIntentId");
      redirectToPaymentFailed(
        error.message || "Failed to complete order",
        "alipay",
      );
      return false;
    }
  } else {
    // Payment failed or was cancelled
    console.log("AliPay payment not succeeded, status:", redirectStatus);
    localStorage.removeItem("hawkrAliPayIntentId");
    redirectToPaymentFailed("AliPay payment was not completed", "alipay");
    return false;
  }
}

/**
 * Check if returning from PayNow redirect and complete the order
 */
async function handlePayNowReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentIntent = urlParams.get("payment_intent");
  const redirectStatus = urlParams.get("redirect_status");

  // Also check localStorage for pending PayNow payment
  const storedIntentId = localStorage.getItem("hawkrPendingPayNowIntent");

  console.log("PayNow return check:", {
    paymentIntent,
    redirectStatus,
    storedIntentId,
  });

  // If no payment_intent in URL but we have a stored one, check its status
  if (!paymentIntent && storedIntentId) {
    try {
      const { getPaymentStatus } =
        await import("../../firebase/services/stripe.js");
      const { status } = await getPaymentStatus(storedIntentId);

      console.log("Stored PayNow intent status:", status);

      if (status === "succeeded") {
        return await completePayNowFromReturn(storedIntentId);
      } else if (status === "requires_action") {
        // Payment still pending, clear stored intent and let user try again
        localStorage.removeItem("hawkrPendingPayNowIntent");
        return false;
      }
    } catch (error) {
      console.error("Error checking stored PayNow intent:", error);
      localStorage.removeItem("hawkrPendingPayNowIntent");
    }
    return false;
  }

  if (!paymentIntent) return false;

  // Verify this matches our stored intent
  if (storedIntentId && storedIntentId !== paymentIntent) {
    console.log("Payment intent doesn't match stored PayNow intent");
    return false;
  }

  if (redirectStatus === "succeeded") {
    return await completePayNowFromReturn(paymentIntent);
  } else {
    // Payment failed or was cancelled
    console.log("PayNow payment not succeeded, status:", redirectStatus);
    localStorage.removeItem("hawkrPendingPayNowIntent");
    redirectToPaymentFailed("PayNow payment was not completed", "paynow");
    return false;
  }
}

async function completePayNowFromReturn(paymentIntentId) {
  try {
    showPaymentProcessing();

    // Fetch cart from Firebase
    console.log("Fetching cart from Firebase for PayNow return...");
    const cartData = await fetchCartData();
    cartState = cartData;
    console.log("Cart fetched:", cartState);

    if (!cartState.items || cartState.items.length === 0) {
      throw new Error("Cart is empty. Order may have already been placed.");
    }

    console.log("Creating order in Firebase for PayNow...");

    // Create order in Firebase
    const orderId = await createOrderInFirebase(paymentIntentId, "paynow", {
      type: "paynow",
      brand: "PayNow",
    });

    console.log("PayNow order created successfully:", orderId);

    // Validate orderId before redirect
    if (!orderId || typeof orderId !== "string") {
      throw new Error("Order creation failed - no valid order ID returned");
    }

    // Clear stored intent ID
    localStorage.removeItem("hawkrPendingPayNowIntent");

    hidePaymentProcessing();

    // Redirect to order confirmed page
    const redirectUrl = `consumerOrderConfirmed.html?orderId=${orderId}`;
    console.log("Redirecting to:", redirectUrl);
    window.location.href = redirectUrl;
    return true;
  } catch (error) {
    console.error("Error completing PayNow order from return:", error);
    hidePaymentProcessing();
    localStorage.removeItem("hawkrPendingPayNowIntent");
    redirectToPaymentFailed(
      error.message || "Failed to complete order",
      "paynow",
    );
    return false;
  }
}

async function initializeCartPage() {
  // Skip re-initialization if payment is in progress (e.g., PayNow QR polling)
  if (isPaymentInProgress) {
    console.log("Skipping cart re-initialization - payment in progress");
    return;
  }

  try {
    showLoading();

    // Load Stripe instance early
    stripeInstance = await loadStripe();

    // Check if returning from payment redirect (must be after auth is set)
    if (currentUser) {
      // Check for GrabPay return
      const handledGrabPay = await handleGrabPayReturn();
      if (handledGrabPay) return; // Will redirect to order confirmed

      // Check for AliPay return
      const handledAliPay = await handleAliPayReturn();
      if (handledAliPay) return; // Will redirect to order confirmed

      // Check for PayNow return (in case Stripe redirected)
      const handledPayNow = await handlePayNowReturn();
      if (handledPayNow) return; // Will redirect to order confirmed
    }

    // Load saved payment methods if user is logged in
    await loadSavedPaymentMethods();

    const cartData = await fetchCartData();
    renderCartPage(cartData);
  } catch (error) {
    console.error("Failed to initialize cart page:", error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();

  // Initialize mobile menu
  initMobileMenu();

  // Listen for auth state changes and then initialize cart
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    await initializeCartPage();
  });

  // Back button handler
  const backButton = document.getElementById("backButton");
  if (backButton) {
    backButton.addEventListener("click", handleBackClick);
  }

  // Edit popup event listeners
  const editPopupOverlay = document.getElementById("editPopupOverlay");
  const editPopupClose = document.getElementById("editPopupClose");
  const editPopupSaveBtn = document.getElementById("editPopupSaveBtn");

  if (editPopupClose) {
    editPopupClose.addEventListener("click", closeEditPopup);
  }

  if (editPopupSaveBtn) {
    editPopupSaveBtn.addEventListener("click", saveEditPopup);
  }

  // Close popup when clicking overlay (outside popup)
  if (editPopupOverlay) {
    editPopupOverlay.addEventListener("click", function (e) {
      if (e.target === editPopupOverlay) {
        closeEditPopup();
      }
    });
  }

  // Close popup on Escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      const editOverlay = document.getElementById("editPopupOverlay");
      if (editOverlay && editOverlay.classList.contains("active")) {
        closeEditPopup();
      }

      const cardOverlay = document.getElementById("cardModalOverlay");
      if (cardOverlay && cardOverlay.classList.contains("active")) {
        closeCardModal();
      }
    }
  });

  // Card modal event listeners
  const cardModalClose = document.getElementById("cardModalClose");
  const cardModalCancelBtn = document.getElementById("cardModalCancelBtn");
  const cardModalSaveBtn = document.getElementById("cardModalSaveBtn");
  const cardModalOverlay = document.getElementById("cardModalOverlay");

  if (cardModalClose) {
    cardModalClose.addEventListener("click", closeCardModal);
  }

  if (cardModalCancelBtn) {
    cardModalCancelBtn.addEventListener("click", closeCardModal);
  }

  if (cardModalSaveBtn) {
    cardModalSaveBtn.addEventListener("click", handleSaveCard);
  }

  // Close card modal when clicking overlay
  if (cardModalOverlay) {
    cardModalOverlay.addEventListener("click", function (e) {
      if (e.target === cardModalOverlay) {
        closeCardModal();
      }
    });
  }

  // Change placeholder on focus/blur for special request input
  const specialRequestInput = document.getElementById("specialRequestInput");
  if (specialRequestInput) {
    specialRequestInput.addEventListener("focus", function () {
      this.placeholder = "E.g., No chilli, no beansprouts, less spicy...";
    });
    specialRequestInput.addEventListener("blur", function () {
      this.placeholder = "We get it, we're picky eaters too...";
    });
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
