// ============================================
// MOCK DATA (Simulating Backend Database)
// ============================================

const mockItemData = {
  id: 1,
  name: "Mala Tang with soup and no soup",
  price: 23.9,
  image:
    "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
  description: "Lorem ipsum dolor yadda yadda",
  allergens: ["Seafood", "Nuts", "Dairy"],
  isFavourite: false,
  stall: {
    id: 1,
    name: "Chinese Foods Private Limited",
    cuisines: ["Chinese", "Halal"],
  },
};

// ============================================
// MOCK API FUNCTIONS (Simulating Backend Calls)
// ============================================

const api = {
  async fetchItemData(/* itemId */) {
    await this.simulateNetworkDelay();
    return mockItemData;
  },

  simulateNetworkDelay() {
    const delay = Math.random() * 300 + 200;
    return new Promise((resolve) => setTimeout(resolve, delay));
  },
};

// ============================================
// URL PARAMETER HELPERS
// ============================================

function getItemIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id") || urlParams.get("itemId") || 1;
}

// ============================================
// ALLERGEN ICON MAPPING
// ============================================

const allergenIcons = {
  seafood: "../../assets/icons/seafood.svg",
  nuts: "../../assets/icons/nuts.svg",
  dairy: "../../assets/icons/dairy.svg",
};

function getAllergenIcon(allergen) {
  const allergenLower = allergen.toLowerCase();
  return allergenIcons[allergenLower] || null;
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderCuisineTags(cuisines) {
  return cuisines
    .map((cuisine) => {
      const cuisineLower = cuisine.toLowerCase();
      if (cuisineLower === "halal") {
        return `<span class="cuisineTag halal">
                    <img src="../../assets/icons/halal.png" alt="Halal">
                    ${cuisine}
                </span>`;
      }
      if (cuisineLower === "kosher") {
        return `<span class="cuisineTag kosher">${cuisine}</span>`;
      }
      return `<span class="cuisineTag">${cuisine}</span>`;
    })
    .join("");
}

function renderAllergens(allergens) {
  if (!allergens || allergens.length === 0) {
    return "";
  }

  const allergenTagsHTML = allergens
    .map((allergen) => {
      const iconPath = getAllergenIcon(allergen);
      const iconHTML = iconPath
        ? `<img src="${iconPath}" alt="${allergen}">`
        : "";
      return `
            <span class="allergenTag">
                ${iconHTML}
                ${allergen}
            </span>
        `;
    })
    .join("");

  return `
        <div class="allergensSection">
            <span class="allergensLabel">Allergens</span>
            <div class="allergenTags">
                ${allergenTagsHTML}
            </div>
        </div>
    `;
}

function formatPrice(price) {
  return `$${price.toFixed(2)}`;
}

function renderItemHeader(stall) {
  const cuisineTagsHTML = renderCuisineTags(stall.cuisines);

  return `
        <section class="itemHeaderSection">
            <span class="nowOrderingLabel">Now Ordering</span>
            <div class="stallNameRow">
                <span class="stallName">${stall.name}</span>
                <div class="cuisineTags">
                    ${cuisineTagsHTML}
                </div>
            </div>
        </section>
    `;
}

function renderItemDetails(item) {
  const allergensHTML = renderAllergens(item.allergens);
  const heartIcon = `<div class="heartIconWrapper">
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="32" viewBox="0 0 36 32" fill="none">
      <path d="M31.2939 4.14215C30.5094 3.35738 29.5781 2.73484 28.553 2.3101C27.528 1.88536 26.4293 1.66675 25.3197 1.66675C24.2101 1.66675 23.1114 1.88536 22.0863 2.3101C21.0613 2.73484 20.1299 3.35738 19.3455 4.14215L17.7176 5.77007L16.0897 4.14215C14.5052 2.5577 12.3562 1.66757 10.1155 1.66757C7.87475 1.66757 5.72578 2.5577 4.14133 4.14215C2.55688 5.7266 1.66675 7.87557 1.66675 10.1163C1.66675 12.3571 2.55688 14.506 4.14133 16.0905L17.7176 29.6667L31.2939 16.0905C32.0786 15.3061 32.7012 14.3747 33.1259 13.3497C33.5506 12.3246 33.7693 11.2259 33.7693 10.1163C33.7693 9.00674 33.5506 7.90803 33.1259 6.88297C32.7012 5.8579 32.0786 4.92656 31.2939 4.14215Z" fill="#FF0000" stroke="#FF0000" stroke-width="3.33333" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
        </div>`;

  return `
        <section class="itemDetailsSection">
            <div class="itemTopSection">
                <div class="itemImage">
                    <img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">
                </div>
                <div class="itemInfo">
                    <h1 class="itemName">${item.name}</h1>
                    <span class="itemPrice">${formatPrice(item.price)}</span>
                    <div class="itemActions">
                        <button class="addToCartBtn" id="addToCartBtn">
                            <span class="btn-content">
                                <span class="btn-text">Add to Cart</span>
                                <span class="btn-tick">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="19" viewBox="0 0 28 19" fill="none">
                                        <path d="M2 9.5L9.77833 17L25.3333 2" stroke="#FFFAFA" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </span>
                            </span>
                        </button>
                        <button class="favouriteBtn" id="favouriteBtn" aria-label="Add to favourites">
                            ${heartIcon}
                        </button>
                    </div>
                </div>
            </div>
            <div class="itemBottomSection">
                ${allergensHTML}
                <div class="descriptionSection">
                    <span class="descriptionLabel">Description</span>
                    <p class="descriptionText">${item.description}</p>
                </div>
            </div>
        </section>
    `;
}

function renderItemPage(item) {
  const container = document.getElementById("itemContent");
  if (!container) return;

  // Store current item for later use
  window.currentItem = item;

  const itemHeaderHTML = renderItemHeader(item.stall);
  const itemDetailsHTML = renderItemDetails(item);

  container.innerHTML = itemHeaderHTML + itemDetailsHTML;

  // Add click handlers
  const addToCartBtn = document.getElementById("addToCartBtn");
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", () => {
      handleAddToCart(item);
    });
  }

  const favouriteBtn = document.getElementById("favouriteBtn");
  if (favouriteBtn) {
    favouriteBtn.addEventListener("click", () => {
      handleToggleFavourite(item);
    });
  }
}

// Cart state
let popupTimeout = null;

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

function getCartCount() {
  const cart = getCartFromStorage();
  return cart.reduce((total, item) => total + item.quantity, 0);
}

function addItemToCart(item) {
  const cart = getCartFromStorage();

  // Check if item already exists in cart
  const existingItemIndex = cart.findIndex(
    (cartItem) => cartItem.id === item.id,
  );

  if (existingItemIndex > -1) {
    // Increment quantity if item exists
    cart[existingItemIndex].quantity += 1;
  } else {
    // Add new item to cart
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity: 1,
      stall: item.stall,
    });
  }

  saveCartToStorage(cart);
  return cart;
}

function handleAddToCart(item) {
  console.log("Add to cart:", item.id, item.name);

  const addToCartBtn = document.getElementById("addToCartBtn");
  if (!addToCartBtn || addToCartBtn.classList.contains("added")) return;

  // Add item to cart in localStorage
  addItemToCart(item);

  // Update badge
  updateCartBadge();

  // Show tick animation
  addToCartBtn.classList.add("added");

  // Show cart popup
  showCartPopup(item);
}

function updateCartBadge() {
  const cartBadge = document.getElementById("cartBadge");
  const cartCount = getCartCount();

  if (cartBadge) {
    if (cartCount > 0) {
      cartBadge.textContent = cartCount;
      cartBadge.style.display = "flex";
    } else {
      cartBadge.style.display = "none";
    }
  }
}

function showCartPopup(item) {
  const cartPopup = document.getElementById("cartPopup");
  const cartPopupItem = document.getElementById("cartPopupItem");

  if (!cartPopup || !cartPopupItem) return;

  // Populate popup content
  cartPopupItem.innerHTML = `
    <div class="cartPopupItemImage">
      <img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">
    </div>
    <div class="cartPopupItemInfo">
      <p class="cartPopupItemName">${item.name}</p>
      <p class="cartPopupItemPrice">${formatPrice(item.price)}</p>
    </div>
    <span class="cartPopupItemQty">x1</span>
  `;

  // Clear any existing timeout
  if (popupTimeout) {
    clearTimeout(popupTimeout);
  }

  // Show popup
  cartPopup.classList.add("show");

  // Auto-hide after 3 seconds
  popupTimeout = setTimeout(() => {
    hideCartPopup();
  }, 3000);
}

function hideCartPopup() {
  const cartPopup = document.getElementById("cartPopup");
  if (cartPopup) {
    cartPopup.classList.remove("show");
  }
}

function handleToggleFavourite(item) {
  console.log("Toggle favourite:", item.id, item.name);
  // TODO: Implement toggle favourite functionality
}

// ============================================
// LOADING STATE HELPERS
// ============================================

function showLoading() {
  const container = document.getElementById("itemContent");
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

async function initializeItemPage() {
  try {
    showLoading();

    // Load cart badge count from localStorage
    updateCartBadge();

    const itemId = getItemIdFromUrl();
    const itemData = await api.fetchItemData(itemId);
    renderItemPage(itemData);
  } catch (error) {
    console.error("Failed to initialize item page:", error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  initializeItemPage();

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
