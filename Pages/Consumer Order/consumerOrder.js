// ============================================
// FIREBASE IMPORTS
// ============================================

import { auth, db } from "../../firebase/config.js";
import {
  getAllHawkerCentres,
  getHawkerCentreWithStalls,
} from "../../firebase/services/hawkerCentres.js";
import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";

// ============================================
// API FUNCTIONS (Firebase Backend Calls)
// ============================================

const api = {
  async fetchHawkerCenters() {
    try {
      // Get all hawker centres with their stalls
      const hawkerCentres = await getAllHawkerCentres();

      // Fetch stalls for each hawker centre
      const centresWithStalls = await Promise.all(
        hawkerCentres.map(async (centre) => {
          const centreWithStalls = await getHawkerCentreWithStalls(centre.id);
          return {
            id: centre.id,
            name: centre.name,
            stalls: (centreWithStalls?.stalls || []).map((stall) => ({
              id: stall.id,
              name: stall.name,
              image:
                stall.imageUrl ||
                `../../mock-data/Consumer Dashboard/hawker-center/${centre.name}.png`,
              cuisines: stall.cuisineNames || [],
              rating: stall.rating || 4.5,
              hours: formatStallHours(stall.operatingHours),
              isHalal: stall.isHalal || false,
            })),
          };
        }),
      );

      // Filter out centres with no stalls
      return centresWithStalls.filter((centre) => centre.stalls.length > 0);
    } catch (error) {
      console.error("Error fetching hawker centers:", error);
      return [];
    }
  },
};

// Helper function to format stall operating hours
function formatStallHours(hours) {
  if (!hours) return "Hours vary";

  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const today = days[new Date().getDay()];
  const todayHours = hours[today];

  if (!todayHours || todayHours.isClosed) {
    return "Closed today";
  }

  return `${todayHours.open || "08:00"} - ${todayHours.close || "22:00"}`;
}

// ============================================
// ICON SVG TEMPLATES
// ============================================

const icons = {
  star: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 0L7.34708 4.1459H11.7063L8.17963 6.7082L9.52671 10.8541L6 8.2918L2.47329 10.8541L3.82037 6.7082L0.293661 4.1459H4.65292L6 0Z" fill="#FFC107"/>
    </svg>`,

  clock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 0C2.7 0 0 2.7 0 6C0 9.3 2.7 12 6 12C9.3 12 12 9.3 12 6C12 2.7 9.3 0 6 0ZM6 10.8C3.36 10.8 1.2 8.64 1.2 6C1.2 3.36 3.36 1.2 6 1.2C8.64 1.2 10.8 3.36 10.8 6C10.8 8.64 8.64 10.8 6 10.8ZM6.3 3H5.4V6.6L8.55 8.49L9 7.74L6.3 6.15V3Z" fill="#666"/>
    </svg>`,
};

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderStallCard(stall) {
  const cuisineTagsHTML = stall.cuisines
    .map((cuisine) => {
      if (cuisine.toLowerCase() === "halal") {
        return `<span class="cuisineTag halal">
                    <img src="../../assets/icons/halal.png" alt="Halal">
                    ${cuisine}
                </span>`;
      }
      return `<span class="cuisineTag">${cuisine}</span>`;
    })
    .join("");

  return `
        <div class="stallCard" data-stall-id="${stall.id}">
            <div class="stallCardImage">
                <img src="${stall.image}" alt="${stall.name}" onerror="this.style.display='none'">
            </div>
            <div class="stallCardInfo">
                <h3 class="stallName">${stall.name}</h3>
                <div class="cuisineTags">
                    ${cuisineTagsHTML}
                </div>
                <div class="stallMeta">
                    <span class="stallRating">
                        ${icons.star}
                        ${stall.rating}
                    </span>
                    <span class="stallHours">
                        ${icons.clock}
                        ${stall.hours}
                    </span>
                </div>
            </div>
        </div>
    `;
}

function renderHawkerCenterSection(hawkerCenter) {
  const stallCardsHTML = hawkerCenter.stalls
    .map((stall) => renderStallCard(stall))
    .join("");

  return `
        <section class="hawkerCenterSection" data-center-id="${hawkerCenter.id}">
            <div class="centreTitleParent">
                <h2 class="centerTitle">${hawkerCenter.name}</h2>
                <span class="seeAllButton">see all</span>
            </div>
            <div class="stallCardsGrid">
                ${stallCardsHTML}
            </div>
        </section>
    `;
}

function renderNowBrowsingHelper() {
  return `
        <div class="nowBrowsingHelper">
            <span class="nowBrowsingLabel">Now Browsing:</span>
            <span class="nowBrowsingValue">Hawker Centres</span>
        </div>
    `;
}

function renderOrderPage(hawkerCenters) {
  const container = document.getElementById("orderContent");
  if (!container) return;

  const nowBrowsingHTML = renderNowBrowsingHelper();

  // Handle empty state
  if (!hawkerCenters || hawkerCenters.length === 0) {
    container.innerHTML =
      nowBrowsingHTML +
      `
      <div class="emptyState">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5">
          <path d="M3 3h18v18H3zM12 8v8M8 12h8"/>
        </svg>
        <p class="emptyStateTitle">No hawker centres found</p>
        <p class="emptyStateText">Check back later for available hawker centres.</p>
      </div>
    `;
    return;
  }

  const sectionsHTML = hawkerCenters
    .map((center) => renderHawkerCenterSection(center))
    .join("");

  container.innerHTML = nowBrowsingHTML + sectionsHTML;

  // Add click handlers to stall cards
  container.querySelectorAll(".stallCard").forEach((card) => {
    card.addEventListener("click", () => {
      const stallId = card.dataset.stallId;
      handleStallClick(stallId);
    });
  });
}

function handleStallClick(stallId) {
  // Navigate to store profile page with stall ID
  window.location.href = `consumerOrderShop?id=${stallId}`;
}

// ============================================
// LOADING STATE HELPERS
// ============================================

function showLoading() {
  const container = document.getElementById("orderContent");
  if (container) {
    container.innerHTML = `<div class="loadingSpinner"></div>`;
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initializeOrderPage() {
  try {
    showLoading();

    const hawkerCenters = await api.fetchHawkerCenters();
    renderOrderPage(hawkerCenters);
  } catch (error) {
    console.error("Failed to initialize order page:", error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();

  initializeOrderPage();

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
