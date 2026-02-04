// ============================================
// FIREBASE IMPORTS
// ============================================

import { auth, db } from "../../firebase/config.js";
import { getStallWithMenu } from "../../firebase/services/foodStalls.js";
import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";

// ============================================
// API FUNCTIONS (Firebase Backend Calls)
// ============================================

const api = {
  async fetchShopData(stallId) {
    try {
      if (!stallId) {
        console.error("No stall ID provided");
        return null;
      }

      const stallData = await getStallWithMenu(String(stallId));

      if (!stallData) {
        console.error("Stall not found:", stallId);
        return null;
      }

      // Transform Firebase data to match expected format
      return {
        id: stallData.id,
        name: stallData.name,
        cuisines: stallData.cuisineNames || [],
        rating: {
          average: stallData.rating || 4.0,
          count: stallData.reviewCount || 0,
        },
        reviews: (stallData.reviews || []).map((review) => ({
          id: review.id,
          title: review.title || "Review",
          content: review.content || review.comment || "",
          rating: review.rating || 5,
          date: formatReviewDate(review.createdAt),
          author: review.authorName || "Anonymous",
        })),
        hygieneGrade: {
          grade: stallData.hygieneGrade || "A",
          lastUpdated: formatHygieneDate(stallData.hygieneUpdatedAt),
        },
        products: (stallData.menuItems || []).map((item) => ({
          id: item.id,
          name: item.name,
          image:
            item.imageUrl ||
            "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
          rating: item.rating || 4.5,
          price: item.price,
          allergens: item.allergens || [],
          description: item.description || "",
          isAvailable: item.isAvailable !== false,
        })),
      };
    } catch (error) {
      console.error("Error fetching stall data:", error);
      return null;
    }
  },
};

// Helper function to format review date
function formatReviewDate(timestamp) {
  if (!timestamp) return "Recently";

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Helper function to format hygiene update date
function formatHygieneDate(timestamp) {
  if (!timestamp) return "Not available";

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ============================================
// URL PARAMETER HELPERS
// ============================================

function getShopIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id") || urlParams.get("shopId");
  // Always return as string, or null if not provided
  return id ? String(id) : null;
}

// ============================================
// ICON SVG TEMPLATES
// ============================================

const icons = {
  star: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M6.36175 0.578369L8.14882 4.19877L12.1451 4.78289L9.25345 7.5994L9.93589 11.5784L6.36175 9.69877L2.78762 11.5784L3.47006 7.5994L0.578369 4.78289L4.57469 4.19877L6.36175 0.578369Z" fill="#E9E932" stroke="#E9E932" stroke-width="1.15668" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  storeStarFilled: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="24" viewBox="-2 -2 17 17" fill="none">
        <path d="M6.36175 0.578369L8.14882 4.19877L12.1451 4.78289L9.25345 7.5994L9.93589 11.5784L6.36175 9.69877L2.78762 11.5784L3.47006 7.5994L0.578369 4.78289L4.57469 4.19877L6.36175 0.578369Z" fill="#E9E932" stroke="#E9E932" stroke-width="2.524" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  storeStarEmpty: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="24" viewBox="-2 -2 17 17" fill="none">
        <path d="M6.36175 0.578369L8.14882 4.19877L12.1451 4.78289L9.25345 7.5994L9.93589 11.5784L6.36175 9.69877L2.78762 11.5784L3.47006 7.5994L0.578369 4.78289L4.57469 4.19877L6.36175 0.578369Z" fill="none" stroke="#E9E932" stroke-width="2.524" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  reviewStar: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="12" viewBox="0 0 13 13" fill="none">
        <path d="M6.36175 0.578369L8.14882 4.19877L12.1451 4.78289L9.25345 7.5994L9.93589 11.5784L6.36175 9.69877L2.78762 11.5784L3.47006 7.5994L0.578369 4.78289L4.57469 4.19877L6.36175 0.578369Z" fill="#E9E932" stroke="#E9E932" stroke-width="1.15668" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  reviewStarEmpty: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="12" viewBox="0 0 13 13" fill="none">
        <path d="M6.36175 0.578369L8.14882 4.19877L12.1451 4.78289L9.25345 7.5994L9.93589 11.5784L6.36175 9.69877L2.78762 11.5784L3.47006 7.5994L0.578369 4.78289L4.57469 4.19877L6.36175 0.578369Z" fill="none" stroke="#E9E932" stroke-width="1.15668" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
};

// Allergen icon mapping
const allergenIcons = {
  seafood: "../../assets/icons/seafood.svg",
  nuts: "../../assets/icons/nuts.svg",
  dairy: "../../assets/icons/dairy",
};

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

function formatPrice(price) {
  return `$${price.toFixed(2)}`;
}

function renderProductCard(product) {
  const allergensHTML = renderAllergens(product.allergens);
  const priceHTML =
    product.price != null
      ? `<span class="productPrice">${formatPrice(product.price)}</span>`
      : "";

  return `
        <div class="productCard" data-product-id="${product.id}">
            <div class="productCardImage">
                <img src="${product.image}" alt="${product.name}" onerror="this.style.display='none'">
            </div>
            <div class="productCardInfo">
                <h3 class="productName">${product.name}</h3>
                <div class="productMeta">
                    <div class="productRating">
                        ${icons.star}
                        ${product.rating}
                    </div>
                    ${priceHTML}
                </div>
                ${allergensHTML}
            </div>
        </div>
    `;
}

function renderShopHeader(shop) {
  const cuisineTagsHTML = renderCuisineTags(shop.cuisines);

  return `
        <section class="shopHeaderSection">
            <span class="nowBrowsingLabel">Now Browsing:</span>
            <h1 class="shopName">${shop.name}</h1>
            <div class="cuisineTags">
                ${cuisineTagsHTML}
            </div>
        </section>
    `;
}

function renderProductsSection(products) {
  const productCardsHTML = products
    .map((product) => renderProductCard(product))
    .join("");

  return `
        <section class="productsSection">
            <div class="productCardsGrid">
                ${productCardsHTML}
            </div>
        </section>
    `;
}

function renderStoreStars(rating, maxStars = 5) {
  const fullStars = Math.floor(rating);
  const hasPartial = rating % 1 !== 0;
  let starsHTML = "";

  for (let i = 0; i < fullStars; i++) {
    starsHTML += icons.storeStarFilled;
  }

  if (hasPartial && fullStars < maxStars) {
    starsHTML += icons.storeStarEmpty;
  }

  for (let i = fullStars + (hasPartial ? 1 : 0); i < maxStars; i++) {
    starsHTML += icons.storeStarEmpty;
  }

  return starsHTML;
}

function renderReviewStars(rating, maxStars = 5) {
  let starsHTML = "";

  for (let i = 0; i < rating; i++) {
    starsHTML += icons.reviewStar;
  }

  for (let i = rating; i < maxStars; i++) {
    starsHTML += icons.reviewStarEmpty;
  }

  return starsHTML;
}

function renderReviewCard(review) {
  return `
        <div class="reviewCard">
            <h4 class="reviewTitle">${review.title}</h4>
            <p class="reviewContent">${review.content}</p>
            <div class="reviewMeta">
                <div class="reviewStars">${renderReviewStars(review.rating)}</div>
                <span class="reviewDate">${review.date}</span>
                <span class="reviewAuthor">By ${review.author}</span>
            </div>
        </div>
    `;
}

function renderRatingsSection(rating, reviews) {
  const reviewsHTML = reviews
    .map((review) => renderReviewCard(review))
    .join("");

  return `
        <section class="ratingsSection">
            <div class="ratingsSectionHeader">
                <h3 class="sectionHeader">Ratings & Reviews</h3>
                <a href="../Consumer Settings/consumerFeedback.html" class="leaveFeedbackBtn">Leave feedback</a>
            </div>
            <div class="ratingsOverview">
                <span class="storeRatingNumber">${rating.average}</span>
                <div class="storeStars">${renderStoreStars(rating.average)}</div>
                <span class="ratingCount">${rating.count} Ratings</span>
            </div>
            <div class="reviewsList">
                ${reviewsHTML}
            </div>
        </section>
    `;
}

function renderHygieneSection(hygieneGrade) {
  const shopId = getShopIdFromUrl();
  return `
        <section class="hygieneSection">
            <div class="hygieneHeader">
                <h3 class="sectionHeader">Hygiene Grade</h3>
                <button class="hygieneInfoBtn" aria-label="More info about hygiene grade">
                    <img src="../../assets/icons/information.svg" alt="Info" draggable="false">
                    <span class="hygieneInfoTooltip">Hawkr believes transparency in hygiene records fosters trust between consumers and the brand.</span>
                </button>
            </div>
            <span class="hygieneGrade">${hygieneGrade.grade}</span>
            <p class="hygieneLastUpdated">Last updated ${hygieneGrade.lastUpdated}</p>
            <a href="consumerShopHygiene.html?id=${shopId}" class="hygieneHistoryLink">view history ></a>
        </section>
    `;
}

function renderShopPage(shop) {
  const container = document.getElementById("shopContent");
  if (!container) return;

  // Handle not found state
  if (!shop) {
    container.innerHTML = `
      <div class="notFoundState">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
        <p class="notFoundTitle">Stall Not Found</p>
        <p class="notFoundText">The stall you're looking for doesn't exist or has been removed.</p>
        <a href="consumerOrder.html" class="backToOrderBtn">Browse Hawker Centres</a>
      </div>
    `;
    return;
  }

  const shopHeaderHTML = renderShopHeader(shop);
  const productsHTML = renderProductsSection(shop.products);
  const ratingsHTML = renderRatingsSection(shop.rating, shop.reviews);
  const hygieneHTML = renderHygieneSection(shop.hygieneGrade);

  container.innerHTML =
    shopHeaderHTML + productsHTML + ratingsHTML + hygieneHTML;

  // Add click handlers to product cards
  container.querySelectorAll(".productCard").forEach((card) => {
    card.addEventListener("click", () => {
      const productId = card.dataset.productId;
      handleProductClick(productId);
    });
  });
}

function handleProductClick(productId) {
  window.location.href = `consumerOrderItem.html?id=${productId}`;
}

// ============================================
// LOADING STATE HELPERS
// ============================================

function showLoading() {
  const container = document.getElementById("shopContent");
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
    // Fallback to order page if no history
    window.location.href = "consumerOrder.html";
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initializeShopPage() {
  try {
    showLoading();

    const shopId = getShopIdFromUrl();
    const shopData = await api.fetchShopData(shopId);
    renderShopPage(shopData);
  } catch (error) {
    console.error("Failed to initialize shop page:", error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();

  initializeShopPage();

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
