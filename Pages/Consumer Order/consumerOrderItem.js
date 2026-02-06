// ============================================
// IMPORTS
// ============================================

import { auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";
import { injectMobileMenu } from "../../assets/js/mobileMenu.js";
import {
  getMenuItem,
  getStallById,
} from "../../firebase/services/foodStalls.js";
import {
  addToCart,
  getCart,
  getCartItemCount,
  isFavourite,
  toggleFavourite,
} from "../../firebase/services/customers.js";

// ============================================
// URL PARAMETER HELPERS
// ============================================

function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    stallId: urlParams.get("stallId"),
    itemId: urlParams.get("itemId") || urlParams.get("id"),
  };
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
  if (!cuisines || cuisines.length === 0) return "";

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

// Track selected variants
// For single-select: { groupIndex: { name, option, optionIndex, priceAdjustment } }
// For multi-select: { groupIndex: { name, multiSelect: true, selections: [{ option, optionIndex, priceAdjustment }] } }
let selectedVariants = {};

function renderVariants(customizations) {
  if (!customizations || customizations.length === 0) return "";

  return `
    <div class="variantsSection">
      ${customizations
        .map((variant, groupIndex) => {
          const isMultiSelect = variant.multiSelect || false;
          const inputType = isMultiSelect ? "checkbox" : "radio";

          return `
        <div class="variantGroup" data-group="${groupIndex}" data-multiselect="${isMultiSelect}">
          <span class="variantGroupLabel">${variant.name}${isMultiSelect ? ' <span class="variantMultiHint">(select multiple)</span>' : ""}</span>
          <div class="variantOptions">
            ${variant.options
              .map(
                (option, optIndex) => `
              <label class="variantOption ${!isMultiSelect && optIndex === 0 ? "selected" : ""}" data-group="${groupIndex}" data-opt="${optIndex}">
                <input
                  type="${inputType}"
                  name="variant-${groupIndex}"
                  value="${optIndex}"
                  ${!isMultiSelect && optIndex === 0 ? "checked" : ""}
                  data-group="${groupIndex}"
                  data-opt="${optIndex}"
                  data-price="${variant.priceAdjustments?.[optIndex] || 0}"
                  data-option="${option}"
                  data-multiselect="${isMultiSelect}"
                >
                <span class="variantOptionName">${option}</span>
                ${variant.priceAdjustments?.[optIndex] > 0 ? `<span class="variantOptionPrice">+$${variant.priceAdjustments[optIndex].toFixed(2)}</span>` : ""}
              </label>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
        })
        .join("")}
    </div>
  `;
}

function initializeSelectedVariants(customizations) {
  selectedVariants = {};
  if (!customizations || customizations.length === 0) return;

  customizations.forEach((variant, groupIndex) => {
    if (variant.multiSelect) {
      // Multi-select: start with no selections
      selectedVariants[groupIndex] = {
        name: variant.name,
        multiSelect: true,
        selections: [],
      };
    } else {
      // Single-select: default to first option
      selectedVariants[groupIndex] = {
        name: variant.name,
        multiSelect: false,
        option: variant.options[0],
        optionIndex: 0,
        priceAdjustment: variant.priceAdjustments?.[0] || 0,
      };
    }
  });
}

function calculateTotalPrice(basePrice) {
  let total = basePrice;
  Object.values(selectedVariants).forEach((v) => {
    if (v.multiSelect && v.selections) {
      // Sum all selected options for multi-select
      v.selections.forEach((sel) => {
        total += sel.priceAdjustment || 0;
      });
    } else {
      // Single selection
      total += v.priceAdjustment || 0;
    }
  });
  return total;
}

function updatePriceDisplay(basePrice) {
  const priceElement = document.querySelector(".itemPrice");
  if (priceElement) {
    priceElement.textContent = formatPrice(calculateTotalPrice(basePrice));
  }
}

function bindVariantEvents(basePrice) {
  const customizations = window.currentItem?.customizations || [];

  // Handle single-select (radio buttons)
  document
    .querySelectorAll('.variantOption input[type="radio"]')
    .forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const groupIndex = parseInt(e.target.dataset.group);
        const optIndex = parseInt(e.target.dataset.opt);
        const priceAdjustment = parseFloat(e.target.dataset.price) || 0;
        const option = e.target.dataset.option;

        // Update selected state visually
        const group = e.target.closest(".variantGroup");
        group
          .querySelectorAll(".variantOption")
          .forEach((opt) => opt.classList.remove("selected"));
        e.target.closest(".variantOption").classList.add("selected");

        // Update selected variants state
        if (customizations[groupIndex]) {
          selectedVariants[groupIndex] = {
            name: customizations[groupIndex].name,
            multiSelect: false,
            option: option,
            optionIndex: optIndex,
            priceAdjustment: priceAdjustment,
          };
        }

        // Update price display
        updatePriceDisplay(basePrice);
      });
    });

  // Handle multi-select (checkboxes)
  document
    .querySelectorAll('.variantOption input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const groupIndex = parseInt(e.target.dataset.group);
        const optIndex = parseInt(e.target.dataset.opt);
        const priceAdjustment = parseFloat(e.target.dataset.price) || 0;
        const option = e.target.dataset.option;
        const isChecked = e.target.checked;

        // Update selected state visually
        if (isChecked) {
          e.target.closest(".variantOption").classList.add("selected");
        } else {
          e.target.closest(".variantOption").classList.remove("selected");
        }

        // Update selected variants state
        if (customizations[groupIndex]) {
          if (!selectedVariants[groupIndex]) {
            selectedVariants[groupIndex] = {
              name: customizations[groupIndex].name,
              multiSelect: true,
              selections: [],
            };
          }

          if (isChecked) {
            // Add selection
            selectedVariants[groupIndex].selections.push({
              option: option,
              optionIndex: optIndex,
              priceAdjustment: priceAdjustment,
            });
          } else {
            // Remove selection
            selectedVariants[groupIndex].selections = selectedVariants[
              groupIndex
            ].selections.filter((s) => s.optionIndex !== optIndex);
          }
        }

        // Update price display
        updatePriceDisplay(basePrice);
      });
    });
}

function renderItemHeader(stall) {
  const cuisineTagsHTML = renderCuisineTags(
    stall.cuisineNames || stall.cuisines,
  );

  return `
        <section class="itemHeaderSection">
            <span class="nowOrderingLabel">Now Ordering:</span>
            <div class="stallNameRow">
                <span class="stallName">${stall.name}</span>
                <div class="cuisineTags">
                    ${cuisineTagsHTML}
                </div>
            </div>
        </section>
    `;
}

// Heart icon SVGs
const heartIconFilled = `<div class="heartIconWrapper">
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="32" viewBox="0 0 36 32" fill="none">
    <path d="M31.2939 4.14215C30.5094 3.35738 29.5781 2.73484 28.553 2.3101C27.528 1.88536 26.4293 1.66675 25.3197 1.66675C24.2101 1.66675 23.1114 1.88536 22.0863 2.3101C21.0613 2.73484 20.1299 3.35738 19.3455 4.14215L17.7176 5.77007L16.0897 4.14215C14.5052 2.5577 12.3562 1.66757 10.1155 1.66757C7.87475 1.66757 5.72578 2.5577 4.14133 4.14215C2.55688 5.7266 1.66675 7.87557 1.66675 10.1163C1.66675 12.3571 2.55688 14.506 4.14133 16.0905L17.7176 29.6667L31.2939 16.0905C32.0786 15.3061 32.7012 14.3747 33.1259 13.3497C33.5506 12.3246 33.7693 11.2259 33.7693 10.1163C33.7693 9.00674 33.5506 7.90803 33.1259 6.88297C32.7012 5.8579 32.0786 4.92656 31.2939 4.14215Z" fill="#FF0000" stroke="#FF0000" stroke-width="3.33333" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</div>`;

const heartIconOutline = `<div class="heartIconWrapper">
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="32" viewBox="0 0 36 32" fill="none">
    <path d="M31.2939 4.14215C30.5094 3.35738 29.5781 2.73484 28.553 2.3101C27.528 1.88536 26.4293 1.66675 25.3197 1.66675C24.2101 1.66675 23.1114 1.88536 22.0863 2.3101C21.0613 2.73484 20.1299 3.35738 19.3455 4.14215L17.7176 5.77007L16.0897 4.14215C14.5052 2.5577 12.3562 1.66757 10.1155 1.66757C7.87475 1.66757 5.72578 2.5577 4.14133 4.14215C2.55688 5.7266 1.66675 7.87557 1.66675 10.1163C1.66675 12.3571 2.55688 14.506 4.14133 16.0905L17.7176 29.6667L31.2939 16.0905C32.0786 15.3061 32.7012 14.3747 33.1259 13.3497C33.5506 12.3246 33.7693 11.2259 33.7693 10.1163C33.7693 9.00674 33.5506 7.90803 33.1259 6.88297C32.7012 5.8579 32.0786 4.92656 31.2939 4.14215Z" fill="none" stroke="#808080" stroke-width="3.33333" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</div>`;

// Track favourite state
let isItemFavourited = false;

function renderItemDetails(item) {
  const allergensHTML = renderAllergens(item.allergens);
  const variantsHTML = renderVariants(item.customizations);
  const heartIcon = isItemFavourited ? heartIconFilled : heartIconOutline;

  // Initialize selected variants with defaults
  initializeSelectedVariants(item.customizations);
  const totalPrice = calculateTotalPrice(item.price);

  return `
        <section class="itemDetailsSection">
            <div class="itemTopSection">
                <div class="itemImage">
                    ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" onerror="this.style.display='none'">` : ""}
                </div>
                <div class="itemInfo">
                    <h1 class="itemName">${item.name}</h1>
                    <span class="itemPrice">${formatPrice(totalPrice)}</span>
                    ${variantsHTML}
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
                    <p class="descriptionText">${item.description || "No description available."}</p>
                </div>
            </div>
        </section>
    `;
}

function renderItemPage(item, stall) {
  const container = document.getElementById("itemContent");
  if (!container) return;

  // Store current item for later use (include customizations)
  window.currentItem = {
    ...item,
    stall,
    customizations: item.customizations || [],
  };

  const itemHeaderHTML = renderItemHeader(stall);
  const itemDetailsHTML = renderItemDetails(item);

  container.innerHTML = itemHeaderHTML + itemDetailsHTML;

  // Bind variant selection events
  if (item.customizations && item.customizations.length > 0) {
    bindVariantEvents(item.price);
  }

  // Add click handlers
  const addToCartBtn = document.getElementById("addToCartBtn");
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", () => {
      handleAddToCart(item, stall);
    });
  }

  const favouriteBtn = document.getElementById("favouriteBtn");
  if (favouriteBtn) {
    favouriteBtn.addEventListener("click", () => {
      handleToggleFavourite(item, stall);
    });
  }
}

function renderError(message) {
  const container = document.getElementById("itemContent");
  if (container) {
    container.innerHTML = `
      <div class="errorState">
        <p>${message}</p>
        <button onclick="window.history.back()" class="backBtn">Go Back</button>
      </div>
    `;
  }
}

// Cart state
let popupTimeout = null;
let currentUserId = null;

// ============================================
// CART FUNCTIONS (Firebase + localStorage fallback)
// ============================================

async function handleAddToCart(item, stall) {
  const addToCartBtn = document.getElementById("addToCartBtn");
  if (!addToCartBtn || addToCartBtn.classList.contains("added")) return;

  // Build selected variants array for cart (flatten multi-select into individual entries)
  const selectedVariantsArray = [];
  Object.values(selectedVariants).forEach((v) => {
    if (v.multiSelect && v.selections && v.selections.length > 0) {
      // Multi-select: add each selected option
      v.selections.forEach((sel) => {
        selectedVariantsArray.push({
          name: v.name,
          option: sel.option,
          priceAdjustment: sel.priceAdjustment,
        });
      });
    } else if (!v.multiSelect && v.option) {
      // Single-select
      selectedVariantsArray.push({
        name: v.name,
        option: v.option,
        priceAdjustment: v.priceAdjustment,
      });
    }
  });

  const totalPrice = calculateTotalPrice(item.price);

  try {
    if (currentUserId) {
      // Save to Firebase for logged-in users
      await addToCart(currentUserId, {
        menuItemId: item.id,
        stallId: stall.id,
        stallName: stall.name,
        name: item.name,
        basePrice: item.price,
        price: totalPrice,
        imageUrl: item.imageUrl || "",
        quantity: 1,
        selectedVariants: selectedVariantsArray,
      });
    } else {
      // Fallback to localStorage for guests
      addItemToLocalStorage(item, stall, selectedVariantsArray, totalPrice);
    }

    // Update badge
    await updateCartBadge();

    // Show tick animation
    addToCartBtn.classList.add("added");

    // Show cart popup
    showCartPopup(item, totalPrice);
  } catch (error) {
    console.error("Error adding to cart:", error);
  }
}

function addItemToLocalStorage(
  item,
  stall,
  selectedVariantsArray = [],
  totalPrice = null,
) {
  const cart = JSON.parse(localStorage.getItem("hawkrCart") || "[]");
  const price = totalPrice !== null ? totalPrice : item.price;

  // Create a unique key based on item ID and selected variants
  const variantsKey = selectedVariantsArray
    .map((v) => `${v.name}:${v.option}`)
    .join("|");

  const existingItemIndex = cart.findIndex(
    (cartItem) =>
      cartItem.menuItemId === item.id &&
      cartItem.stallId === stall.id &&
      (cartItem.variantsKey || "") === variantsKey,
  );

  if (existingItemIndex > -1) {
    cart[existingItemIndex].quantity += 1;
  } else {
    cart.push({
      menuItemId: item.id,
      stallId: stall.id,
      stallName: stall.name,
      name: item.name,
      basePrice: item.price,
      price: price,
      imageUrl: item.imageUrl || "",
      quantity: 1,
      selectedVariants: selectedVariantsArray,
      variantsKey: variantsKey,
    });
  }

  localStorage.setItem("hawkrCart", JSON.stringify(cart));
}

async function updateCartBadge() {
  const cartBadge = document.getElementById("cartBadge");
  if (!cartBadge) return;

  try {
    let cartCount = 0;

    if (currentUserId) {
      // Get count from Firebase
      cartCount = await getCartItemCount(currentUserId);
    } else {
      // Get count from localStorage
      const cart = JSON.parse(localStorage.getItem("hawkrCart") || "[]");
      cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    }

    if (cartCount > 0) {
      cartBadge.textContent = cartCount;
      cartBadge.style.display = "flex";
    } else {
      cartBadge.style.display = "none";
    }
  } catch (error) {
    console.error("Error updating cart badge:", error);
  }
}

function showCartPopup(item, totalPrice = null) {
  const cartPopup = document.getElementById("cartPopup");
  const cartPopupItem = document.getElementById("cartPopupItem");

  if (!cartPopup || !cartPopupItem) return;

  const displayPrice = totalPrice !== null ? totalPrice : item.price;

  // Build variants summary for popup (handle both single and multi-select)
  const variantOptions = [];
  Object.values(selectedVariants).forEach((v) => {
    if (v.multiSelect && v.selections && v.selections.length > 0) {
      v.selections.forEach((sel) => variantOptions.push(sel.option));
    } else if (!v.multiSelect && v.option) {
      variantOptions.push(v.option);
    }
  });
  const variantsSummary = variantOptions.join(", ");

  // Populate popup content
  cartPopupItem.innerHTML = `
    <div class="cartPopupItemImage">
      ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" onerror="this.style.display='none'">` : ""}
    </div>
    <div class="cartPopupItemInfo">
      <p class="cartPopupItemName">${item.name}</p>
      ${variantsSummary ? `<p class="cartPopupItemVariants">${variantsSummary}</p>` : ""}
      <p class="cartPopupItemPrice">${formatPrice(displayPrice)}</p>
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

async function handleToggleFavourite(item, stall) {
  if (!currentUserId) {
    // Redirect to login if not logged in
    alert("Please log in to add favourites.");
    window.location.href = "../Auth/login.html";
    return;
  }

  const favouriteBtn = document.getElementById("favouriteBtn");
  if (!favouriteBtn) return;

  try {
    // Toggle favourite in Firebase
    const result = await toggleFavourite(currentUserId, {
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl || "",
      rating: item.rating || 0,
      stallId: stall.id,
      stallName: stall.name,
      hawkerCentreId: stall.hawkerCentreId || "",
      hawkerCentreName: stall.hawkerCentreName || "",
      allergens: item.allergens || [],
    });

    // Update state and UI
    isItemFavourited = result.isFavourite;
    favouriteBtn.innerHTML = isItemFavourited
      ? heartIconFilled
      : heartIconOutline;

    // Add a quick animation
    favouriteBtn.classList.add("pulse");
    setTimeout(() => favouriteBtn.classList.remove("pulse"), 300);
  } catch (error) {
    console.error("Error toggling favourite:", error);
    alert("Failed to update favourite. Please try again.");
  }
}

async function checkFavouriteStatus(itemId) {
  if (!currentUserId) return false;

  try {
    return await isFavourite(currentUserId, itemId);
  } catch (error) {
    console.error("Error checking favourite status:", error);
    return false;
  }
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

    const { stallId, itemId } = getUrlParams();

    if (!stallId || !itemId) {
      renderError("Invalid item URL. Missing stallId or itemId.");
      return;
    }

    // Fetch menu item and stall data from Firebase
    const [menuItem, stall] = await Promise.all([
      getMenuItem(stallId, itemId),
      getStallById(stallId),
    ]);

    if (!menuItem) {
      renderError("Menu item not found.");
      return;
    }

    if (!stall) {
      renderError("Stall not found.");
      return;
    }

    // Check favourite status if user is logged in
    if (currentUserId) {
      isItemFavourited = await checkFavouriteStatus(menuItem.id);
    }

    renderItemPage(menuItem, stall);
  } catch (error) {
    console.error("Failed to initialize item page:", error);
    renderError("Failed to load item. Please try again later.");
  }
}

// Track if page has been initialized
let pageInitialized = false;

// Initialize auth state listener
function initAuthListener() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUserId = user.uid;
    } else {
      currentUserId = null;
    }
    // Update cart badge with correct source
    await updateCartBadge();

    // Initialize page after auth state is known (only once)
    if (!pageInitialized) {
      pageInitialized = true;
      await initializeItemPage();
    } else {
      // If user logs in/out after page load, update favourite button
      const favouriteBtn = document.getElementById("favouriteBtn");
      if (favouriteBtn && window.currentItem) {
        if (currentUserId) {
          isItemFavourited = await checkFavouriteStatus(window.currentItem.id);
        } else {
          isItemFavourited = false;
        }
        favouriteBtn.innerHTML = isItemFavourited
          ? heartIconFilled
          : heartIconOutline;
      }
    }
  });
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();
  injectMobileMenu();

  // Initialize auth listener for cart and page initialization
  initAuthListener();

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
