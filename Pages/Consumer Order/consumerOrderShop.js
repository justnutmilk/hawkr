// ============================================
// MOCK DATA (Simulating Backend Database)
// ============================================

const mockShopData = {
  id: 1,
  name: "Ching Ching Chong Foods Private Limited",
  cuisines: ["Chinese"],
  rating: {
    average: 3.8,
    count: 20,
  },
  reviews: [
    {
      id: 1,
      title: "Chinese Sala nubbad",
      content:
        "Ingredients used were fresh, and portion was great too! The real value for money.",
      rating: 3,
      date: "2 days ago",
      author: "Jane Doe",
    },
  ],
  hygieneGrade: {
    grade: "A",
    lastUpdated: "15 Jan 2025",
  },
  products: [
    {
      id: 1,
      name: "Chinese Sala",
      image:
        "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
      rating: 4.5,
      price: 5.5,
      allergens: [],
    },
    {
      id: 2,
      name: "Chinese Salad",
      image:
        "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
      rating: 4.5,
      price: 6.0,
      allergens: [],
    },
    {
      id: 3,
      name: "Mala Tang",
      image:
        "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
      rating: 4.5,
      price: 8.9,
      allergens: ["Seafood"],
    },
    {
      id: 4,
      name: "Mala Tang",
      image:
        "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
      rating: 4.5,
      price: 8.9,
      allergens: ["Seafood"],
    },
    {
      id: 5,
      name: "Mala Tang",
      image:
        "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
      rating: 4.5,
      price: 8.9,
      allergens: ["Seafood"],
    },
  ],
};

// ============================================
// MOCK API FUNCTIONS (Simulating Backend Calls)
// ============================================

const api = {
  async fetchShopData(/* shopId */) {
    await this.simulateNetworkDelay();
    // In real implementation, fetch shop by ID from backend
    return mockShopData;
  },

  simulateNetworkDelay() {
    const delay = Math.random() * 300 + 200;
    return new Promise((resolve) => setTimeout(resolve, delay));
  },
};

// ============================================
// URL PARAMETER HELPERS
// ============================================

function getShopIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id") || urlParams.get("shopId") || 1;
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
            <h3 class="sectionHeader">Ratings & Reviews</h3>
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
