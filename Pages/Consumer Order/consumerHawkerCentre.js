// ============================================
// FIREBASE IMPORTS
// ============================================

import { auth, db } from "../../firebase/config.js";
import { getHawkerCentreWithStalls } from "../../firebase/services/hawkerCentres.js";
import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";
import { injectMobileMenu } from "../../assets/js/mobileMenu.js";

// ============================================
// API FUNCTIONS (Firebase Backend Calls)
// ============================================

const api = {
  async fetchHawkerCentreData(hawkerCentreId) {
    try {
      if (!hawkerCentreId) {
        console.error("No hawker centre ID provided");
        return null;
      }

      const centreData = await getHawkerCentreWithStalls(
        String(hawkerCentreId),
      );

      if (!centreData) {
        console.error("Hawker centre not found:", hawkerCentreId);
        return null;
      }

      // Transform Firebase data to match expected format
      return {
        id: centreData.id,
        name: centreData.name,
        address: centreData.address || "",
        postalCode: centreData.postalCode
          ? `Singapore ${centreData.postalCode}`
          : "",
        rating: centreData.rating || 4.5,
        hours: formatOperatingHours(centreData.operatingHours),
        image:
          centreData.imageUrl ||
          `../../mock-data/Consumer Dashboard/hawker-center/${centreData.name}.png`,
        banner: centreData.coverImageUrl || null,
        stalls: (centreData.stalls || []).map((stall) => ({
          id: stall.id,
          name: stall.name,
          operatorName: stall.operatorName || "",
          image:
            stall.imageUrl ||
            `../../mock-data/Consumer Dashboard/hawker-center/${centreData.name}.png`,
          cuisines: stall.cuisineNames || [],
          rating: stall.rating || 4.5,
          hours: formatStallHours(stall.operatingHours),
        })),
      };
    } catch (error) {
      console.error("Error fetching hawker centre data:", error);
      return null;
    }
  },
};

// Helper function to format hawker centre operating hours
function formatOperatingHours(hours) {
  if (!hours) return "Hours vary";

  // Try to create a summary like "Mon-Sun: 08:00 - 22:00"
  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const openHours = days
    .map((day) => hours[day])
    .filter((h) => h && !h.isClosed);

  if (openHours.length === 0) return "Closed";

  // Get most common hours
  const firstHours = openHours[0];
  if (
    firstHours.slots &&
    Array.isArray(firstHours.slots) &&
    firstHours.slots.length > 0
  ) {
    return firstHours.slots.map((s) => `${s.from} - ${s.to}`).join(", ");
  }
  return `${firstHours.open || "08:00"} - ${firstHours.close || "22:00"}`;
}

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

  if (
    todayHours.slots &&
    Array.isArray(todayHours.slots) &&
    todayHours.slots.length > 0
  ) {
    return todayHours.slots.map((s) => `${s.from} - ${s.to}`).join(", ");
  }
  return `${todayHours.open || "08:00"} - ${todayHours.close || "22:00"}`;
}

// ============================================
// URL PARAMETER HELPERS
// ============================================

function getHawkerCentreIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id") || urlParams.get("hawkerCentreId");
  // Always return as string, or null if not provided
  return id ? String(id) : null;
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

function renderHawkerCentreHeader(hawkerCentre) {
  const imageHTML = hawkerCentre.image
    ? `<img class="hawkerCentreImage" src="${hawkerCentre.image}" alt="${hawkerCentre.name}" onerror="this.style.display='none'">`
    : "";

  return `
        <section class="hawkerCentreHeaderSection">
            ${imageHTML}
            <div class="hawkerCentreHeaderText">
                <span class="nowPerusingLabel">Now Perusing:</span>
                <div class="hawkerCentreInfo">
                    <h1 class="hawkerCentreName">${hawkerCentre.name}</h1>
                    <div class="hawkerCentreDetails">
                        <p class="hawkerCentreAddress">${hawkerCentre.address}<br>${hawkerCentre.postalCode}</p>
                        <div class="hawkerCentreMeta">
                            <span class="hawkerCentreRating">
                                ${icons.star}
                                ${hawkerCentre.rating}
                            </span>
                            <span class="hawkerCentreHours">
                                ${icons.clock}
                                ${hawkerCentre.hours}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `;
}

function renderHawkerCentreHero(hawkerCentre) {
  if (!hawkerCentre.banner) {
    return "";
  }

  return `
        <section class="hawkerCentreHero">
            <div class="hawkerCentreHeroImage">
                <img src="${hawkerCentre.banner}" alt="${hawkerCentre.name}" onerror="this.parentElement.parentElement.style.display='none'">
            </div>
        </section>
    `;
}

function renderStallCard(stall) {
  const cuisineTagsHTML = renderCuisineTags(stall.cuisines);

  return `
        <div class="stallCard" data-stall-id="${stall.id}">
            <div class="stallCardImage">
                <img src="${stall.image}" alt="${stall.name}" onerror="this.style.display='none'">
            </div>
            <div class="stallCardInfo">
                <h3 class="stallName">${stall.name}</h3>
                ${stall.operatorName ? `<span class="stallOperatorName">${stall.operatorName}</span>` : ""}
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

function renderStallsSection(stalls) {
  const stallCardsHTML = stalls.map((stall) => renderStallCard(stall)).join("");

  return `
        <section class="stallsSection">
            <h3 class="sectionHeader">Stalls</h3>
            <div class="stallCardsGrid">
                ${stallCardsHTML}
            </div>
        </section>
    `;
}

function renderHawkerCentrePage(hawkerCentre) {
  const container = document.getElementById("hawkerCentreContent");
  if (!container) return;

  // Handle not found state
  if (!hawkerCentre) {
    container.innerHTML = `
      <div class="notFoundState">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
        <p class="notFoundTitle">Hawker Centre Not Found</p>
        <p class="notFoundText">The hawker centre you're looking for doesn't exist or has been removed.</p>
        <a href="../Consumer Dashboard/consumerDashboard.html" class="backToDashboardBtn">Back to Dashboard</a>
      </div>
    `;
    return;
  }

  const headerHTML = renderHawkerCentreHeader(hawkerCentre);
  const heroHTML = renderHawkerCentreHero(hawkerCentre);
  const stallsHTML = renderStallsSection(hawkerCentre.stalls);

  container.innerHTML = headerHTML + heroHTML + stallsHTML;

  // Set image height to match hawkerCentreInfo height
  const infoElement = container.querySelector(".hawkerCentreInfo");
  const imageElement = container.querySelector(".hawkerCentreImage");
  if (infoElement && imageElement) {
    const infoHeight = infoElement.offsetHeight;
    imageElement.style.height = `${infoHeight}px`;
    imageElement.style.width = `${infoHeight}px`;
  }

  // Add click handlers to stall cards
  container.querySelectorAll(".stallCard").forEach((card) => {
    card.addEventListener("click", () => {
      const stallId = card.dataset.stallId;
      handleStallClick(stallId);
    });
  });
}

function handleStallClick(stallId) {
  // Navigate to shop detail page with stall ID
  window.location.href = `consumerOrderShop.html?id=${stallId}`;
}

// ============================================
// LOADING STATE HELPERS
// ============================================

function showLoading() {
  const container = document.getElementById("hawkerCentreContent");
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
    // Fallback to dashboard if no history
    window.location.href = "../Consumer Dashboard/consumerDashboard.html";
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initializeHawkerCentrePage() {
  try {
    showLoading();

    const hawkerCentreId = getHawkerCentreIdFromUrl();
    const hawkerCentreData = await api.fetchHawkerCentreData(hawkerCentreId);
    renderHawkerCentrePage(hawkerCentreData);
  } catch (error) {
    console.error("Failed to initialize hawker centre page:", error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();
  injectMobileMenu();

  initializeHawkerCentrePage();

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
