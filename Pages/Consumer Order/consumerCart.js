// ============================================
// LOCAL STORAGE CART FUNCTIONS
// ============================================

function getCartFromStorage() {
  const cart = localStorage.getItem("hawkrCart");
  return cart ? JSON.parse(cart) : [];
}

function saveCartToStorage(cart) {
  localStorage.setItem("hawkrCart", JSON.stringify(cart));
}

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

// ============================================
// MOCK CART ITEMS (For testing/demo purposes)
// ============================================

const mockCartItems = [
  {
    id: 1,
    name: "Mala Tang with soup and no soup",
    price: 23.9,
    image:
      "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
    quantity: 2,
    stall: {
      id: 1,
      name: "Chinese Foods Private Limited",
    },
  },
  {
    id: 2,
    name: "Chicken Rice",
    price: 5.5,
    image:
      "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
    quantity: 1,
    stall: {
      id: 2,
      name: "Tian Tian Hainanese",
    },
  },
  {
    id: 3,
    name: "Laksa",
    price: 8.0,
    image:
      "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
    quantity: 3,
    stall: {
      id: 3,
      name: "328 Katong Laksa",
    },
  },
];

// ============================================
// MOCK API FUNCTIONS (Simulating Backend Calls)
// ============================================

const api = {
  async fetchCartData() {
    await this.simulateNetworkDelay();

    // Get items from localStorage
    let cartItems = getCartFromStorage();

    // If cart is empty, load mock items for demo
    if (cartItems.length === 0) {
      cartItems = mockCartItems;
      saveCartToStorage(cartItems);
    }

    return {
      items: cartItems,
      collectionDetails: defaultCollectionDetails,
      paymentMethod: defaultPaymentMethod,
    };
  },

  simulateNetworkDelay() {
    const delay = Math.random() * 300 + 200;
    return new Promise((resolve) => setTimeout(resolve, delay));
  },
};

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
                        <span class="storeName">${item.stall.name}</span>
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

function renderPaymentDetails(payment) {
  return `
        <section class="paymentDetailsSection">
            <span class="sectionLabel">Payment Details</span>
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
  const paymentDetailsHTML = renderPaymentDetails(cartData.paymentMethod);
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

  const itemId = parseInt(target.dataset.itemId);

  if (target.classList.contains("qtyDecrease")) {
    updateQuantity(itemId, -1);
  } else if (target.classList.contains("qtyIncrease")) {
    updateQuantity(itemId, 1);
  } else if (target.classList.contains("editBtn")) {
    handleEdit(itemId);
  }
}

function updateQuantity(itemId, delta) {
  const itemIndex = cartState.items.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) return;

  const item = cartState.items[itemIndex];
  const newQuantity = item.quantity + delta;

  if (newQuantity < 1) {
    // Remove item from cart
    cartState.items.splice(itemIndex, 1);

    // Save to localStorage
    saveCartToStorage(cartState.items);

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

  // Save to localStorage
  saveCartToStorage(cartState.items);

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

function openEditPopup(itemId) {
  const item = cartState.items.find((i) => i.id === itemId);
  if (!item) return;

  currentEditItemId = itemId;

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

  // Restore special request text
  const specialRequestInput = document.getElementById("specialRequestInput");
  if (specialRequestInput) {
    specialRequestInput.value = item.specialRequest || "";
  }

  // Show popup
  const overlay = document.getElementById("editPopupOverlay");
  if (overlay) {
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
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

function saveEditPopup() {
  if (currentEditItemId === null) return;

  const item = cartState.items.find((i) => i.id === currentEditItemId);
  if (!item) return;

  // Get special request text
  const specialRequestInput = document.getElementById("specialRequestInput");
  const specialRequest = specialRequestInput
    ? specialRequestInput.value.trim()
    : "";

  // Update item
  item.specialRequest = specialRequest;

  // Save to localStorage
  saveCartToStorage(cartState.items);

  // Close popup
  closeEditPopup();
}

function handleEdit(itemId) {
  openEditPopup(itemId);
}

function handlePlaceOrder() {
  console.log("Place order:", cartState);
  // Clear any existing confirmed order to create a new one
  localStorage.removeItem("hawkrConfirmedOrder");
  // Navigate to order confirmed page
  window.location.href = "consumerOrderConfirmed.html";
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

async function initializeCartPage() {
  try {
    showLoading();

    const cartData = await api.fetchCartData();
    renderCartPage(cartData);
  } catch (error) {
    console.error("Failed to initialize cart page:", error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  initializeCartPage();

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
      const overlay = document.getElementById("editPopupOverlay");
      if (overlay && overlay.classList.contains("active")) {
        closeEditPopup();
      }
    }
  });

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
