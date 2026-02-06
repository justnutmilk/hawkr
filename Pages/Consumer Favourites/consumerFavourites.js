// ============================================
// IMPORTS
// ============================================

import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";
import { initMobileMenu } from "../../assets/js/mobileMenu.js";
import { auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFavourites,
  removeFromFavourites,
} from "../../firebase/services/customers.js";

// ============================================
// ICON SVG TEMPLATES
// ============================================

const icons = {
  star: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.36175 0.578369L8.14882 4.19877L12.1451 4.78289L9.25345 7.5994L9.93589 11.5784L6.36175 9.69877L2.78762 11.5784L3.47006 7.5994L0.578369 4.78289L4.57469 4.19877L6.36175 0.578369Z" fill="#E9E932" stroke="#E9E932" stroke-width="1.15668" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  heartFilled: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#eb001b" stroke="#eb001b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>`,
  emptyHeart: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>`,
};

// Allergen icon mapping
const allergenIcons = {
  seafood: "../../assets/icons/seafood.svg",
  nuts: "../../assets/icons/nuts.svg",
  dairy: "../../assets/icons/dairy.svg",
};

// ============================================
// STATE
// ============================================

let favourites = [];
let currentUser = null;

// ============================================
// RENDER FUNCTIONS
// ============================================

function formatPrice(price) {
  return `$${price.toFixed(2)}`;
}

function getAllergenIcon(allergen) {
  const allergenLower = allergen.toLowerCase();
  return allergenIcons[allergenLower] || null;
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

function renderFavouriteCard(item) {
  const allergensHTML = renderAllergens(item.allergens);
  const imageUrl = item.imageUrl || "../../images/placeholder-food.jpg";
  const rating = item.rating || 0;
  const price = item.price || 0;

  return `
    <div class="favouriteCard" data-id="${item.id}" data-menu-item-id="${item.menuItemId}">
      <div class="favouriteCardImage">
        <img src="${imageUrl}" alt="${item.name}" onerror="this.src='../../images/placeholder-food.jpg'">
        <button class="favouriteButton" data-id="${item.id}" aria-label="Remove from favourites">
          ${icons.heartFilled}
        </button>
      </div>
      <div class="favouriteCardInfo">
        <h3 class="favouriteCardName">${item.name}</h3>
        <div class="favouriteCardMeta">
          <span class="favouriteCardRating">
            ${icons.star}
            ${rating.toFixed(1)}
          </span>
          <span class="favouriteCardPrice">${formatPrice(price)}</span>
        </div>
        ${allergensHTML}
        <span class="favouriteCardLocation">${item.stallName || "Unknown Stall"} <span class="locationSeparator">·</span> ${item.hawkerCentreName || "Unknown Location"}</span>
      </div>
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="emptyState">
      <img src="../../images/favouritesEmptyState.svg" alt="Sad squirrel" class="emptyStateImage" />
      <h3 class="emptyStateTitle">No favourite items yet</h3>
      <p class="emptyStateDescription">
        When you find food you love, tap the heart icon to save them here for quick access.
      </p>
      <a href="../Consumer Order/consumerOrder.html" class="emptyStateButton">Start Exploring</a>
    </div>
  `;
}

function renderLoginPrompt() {
  return `
    <div class="emptyState">
      <img src="../../images/favouritesEmptyState.svg" alt="Sad squirrel" class="emptyStateImage" />
      <h3 class="emptyStateTitle">Please log in</h3>
      <p class="emptyStateDescription">
        Log in to view and manage your favourite items.
      </p>
      <a href="../Auth/login.html" class="emptyStateButton">Log In</a>
    </div>
  `;
}

function renderFavouritesGrid() {
  const container = document.getElementById("favouritesGrid");
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = renderLoginPrompt();
    return;
  }

  if (favourites.length === 0) {
    container.innerHTML = renderEmptyState();
  } else {
    container.innerHTML = favourites.map(renderFavouriteCard).join("");
  }

  // Add click handlers
  attachCardListeners();
}

function renderPageHeader() {
  return `
    <div class="pageHeader">
      <span class="nowBrowsingLabel">Your Collection:</span>
      <h1 class="pageTitle">Favourites</h1>
    </div>
  `;
}

function renderPage() {
  const container = document.getElementById("favouritesPageContent");
  if (!container) return;

  container.innerHTML = `
    ${renderPageHeader()}
    <div id="favouritesGrid" class="favouritesGrid"></div>
  `;

  renderFavouritesGrid();
}

// ============================================
// EVENT HANDLERS
// ============================================

function attachCardListeners() {
  // Favourite button clicks
  document.querySelectorAll(".favouriteButton").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await handleRemoveFavourite(id);
    });
  });

  // Card clicks (navigate to item)
  document.querySelectorAll(".favouriteCard").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".favouriteButton")) return;
      const menuItemId = card.dataset.menuItemId;
      handleCardClick(menuItemId);
    });
  });
}

async function handleRemoveFavourite(id) {
  if (!currentUser) return;

  try {
    await removeFromFavourites(currentUser.uid, id);
    favourites = favourites.filter((item) => item.id !== id);
    renderFavouritesGrid();
  } catch (error) {
    console.error("Error removing favourite:", error);
    alert("Failed to remove favourite. Please try again.");
  }
}

function handleCardClick(menuItemId) {
  window.location.href = `../Consumer Order/consumerOrderItem.html?id=${menuItemId}`;
}

// ============================================
// NAVIGATION HANDLERS
// ============================================

function handleBackClick() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "../Consumer Dashboard/consumerDashboard.html";
  }
}

// ============================================
// LOADING STATE HELPERS
// ============================================

function showLoading() {
  const container = document.getElementById("favouritesPageContent");
  if (container) {
    container.innerHTML = `<div class="loadingSpinner"></div>`;
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initializePage() {
  try {
    showLoading();

    if (!currentUser) {
      renderPage();
      return;
    }

    // Fetch favourites from Firebase
    favourites = await getFavourites(currentUser.uid);

    renderPage();
  } catch (error) {
    console.error("Failed to initialize favourites page:", error);
    const container = document.getElementById("favouritesPageContent");
    if (container) {
      container.innerHTML = `
        <div class="emptyState">
          <p>Failed to load favourites. Please try again.</p>
        </div>
      `;
    }
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();
  initMobileMenu();

  // Listen for auth state and then initialize
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    await initializePage();
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
