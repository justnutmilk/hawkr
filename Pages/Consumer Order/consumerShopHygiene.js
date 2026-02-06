// ============================================
// IMPORTS
// ============================================

import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";
import { initMobileMenu } from "../../assets/js/mobileMenu.js";

// ============================================
// MOCK DATA (Simulating Backend Database)
// ============================================

const mockShopData = {
  id: 1,
  name: "Ching Ching Chong Foods Private Limited",
  cuisines: ["Chinese"],
};

// New grading system cutoff date: 19 January 2025
const NEW_GRADING_SYSTEM_DATE = new Date("2025-01-19");

// Old system: A, B, C, D
// New system (after 19 Jan 2025): A, B, NEW, C

const mockHygieneHistory = {
  current: {
    grade: "B",
    updated: "20 Jan 2025", // After cutoff - new system
  },
  archived: [
    { grade: "A", updated: "15 Jan 2025", activeTill: "19 Jan 2025" }, // Before cutoff - old system
    { grade: "B", updated: "10 Jun 2023", activeTill: "14 Jan 2025" },
    { grade: "A", updated: "2 Mar 2022", activeTill: "9 Jun 2023" },
    { grade: "D", updated: "18 Sep 2021", activeTill: "1 Mar 2022" },
    { grade: "C", updated: "5 Jan 2020", activeTill: "17 Sep 2021" },
  ],
};

const tagIcons = {
  halal: "../../assets/icons/halal.png",
  kosher: "../../assets/icons/kosher.svg",
};

// ============================================
// MOCK API FUNCTIONS (Simulating Backend Calls)
// ============================================

const api = {
  async fetchShopData(/* shopId */) {
    await this.simulateNetworkDelay();
    return mockShopData;
  },

  async fetchHygieneHistory(/* shopId */) {
    await this.simulateNetworkDelay();
    return mockHygieneHistory;
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
// STATE
// ============================================

let currentTab = "current";
let hygieneData = null;

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseDate(dateStr) {
  // Parse dates like "15 Jan 2025"
  const months = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };
  const parts = dateStr.split(" ");
  const day = parseInt(parts[0], 10);
  const month = months[parts[1]];
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

function isOldGradingSystem(dateStr) {
  const date = parseDate(dateStr);
  return date < NEW_GRADING_SYSTEM_DATE;
}

const icons = {
  deprecatedInfo: `<svg xmlns="http://www.w3.org/2000/svg" width="3" height="7" viewBox="0 0 3 7" fill="none">
    <path d="M1.7947 1.85164C2.30499 1.80703 2.68268 1.35707 2.63775 0.846791C2.59344 0.336503 2.14348 -0.0410316 1.6332 0.0035797C1.12291 0.0482046 0.745224 0.498009 0.789835 1.0083C0.834473 1.5189 1.28443 1.89627 1.7947 1.85164Z" fill="#913B9F"/>
    <path d="M2.07688 5.55562C1.85629 5.63637 1.48458 5.86387 1.48458 5.86387C1.48458 5.86387 1.76643 4.56098 1.77806 4.50426C1.89715 3.93238 2.23556 3.12531 1.77712 2.63467C1.45788 2.29375 1.04751 2.3855 0.685847 2.73146C0.447041 2.95972 0.320412 3.10568 0.0992151 3.35109C0.00966448 3.45053 -0.0242692 3.54339 0.0181409 3.68902C0.0636955 3.84645 0.247828 3.92453 0.410591 3.86499C0.631173 3.78439 1.00258 3.55691 1.00258 3.55691C1.00258 3.55691 0.830386 4.34983 0.744608 4.74636C0.732659 4.80292 0.251601 6.29527 0.71036 6.78593C1.0296 7.12702 1.43966 7.03511 1.80163 6.68932C2.04044 6.46103 2.16707 6.31508 2.38827 6.06952C2.47782 5.97022 2.51144 5.87738 2.46934 5.73174C2.42346 5.57448 2.23964 5.49623 2.07688 5.55562Z" fill="#913B9F"/>
  </svg>`,
};

function renderInformationIcon() {
  return `<span class="informationIcon">
    ${icons.deprecatedInfo}
    <span class="informationTooltip">This grading system has been retired and does not reflect the latest assessment. From 19 Jan 2026, grades follow the SAFE framework. <a href="https://www.sfa.gov.sg/news-publications/newsroom/new-safety-assurance-for-food-establishment--safe--framework--to-strengthen-food-safety" target="_blank" rel="noopener noreferrer">Learn more →</a></span>
  </span>`;
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderTag(tag) {
  const tagLower = tag.toLowerCase();
  const icon = tagIcons[tagLower];
  if (icon) {
    return `<span class="shopTag ${tagLower}"><img class="shopTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="shopTag">${tag}</span>`;
}

function renderShopHeader(shop) {
  const tagsHTML = shop.cuisines.map(renderTag).join("");

  return `
        <div class="shopHeader">
            <span class="nowPerusingLabel">Now Perusing:</span>
            <h1 class="shopName">${shop.name}</h1>
            <div class="shopTags">${tagsHTML}</div>
        </div>
    `;
}

function renderCurrentGrade() {
  const data = hygieneData?.current;
  if (!data) {
    return `<div class="hygieneEmpty">No hygiene grade on record.</div>`;
  }
  const isOldSystem = isOldGradingSystem(data.updated);
  const informationIcon = isOldSystem ? renderInformationIcon() : "";

  return `
        <div class="hygieneCurrentCard">
            <div class="hygieneGradeHeader">
                <span class="hygieneGradeLetter">${data.grade}</span>
                ${informationIcon}
            </div>
            <span class="hygieneGradeUpdated">Last updated ${data.updated}</span>
        </div>
    `;
}

function renderArchivedGrades() {
  const items = hygieneData?.archived || [];
  if (items.length === 0) {
    return `<div class="hygieneEmpty">No archived grades.</div>`;
  }
  return `
        <div class="hygieneArchiveList">
            ${items
              .map((item) => {
                const isOldSystem = isOldGradingSystem(item.updated);
                const informationIcon = isOldSystem
                  ? renderInformationIcon()
                  : "";
                return `
                <div class="hygieneArchiveCard">
                    <div class="hygieneArchiveGradeWrapper">
                        <span class="hygieneArchiveGrade">${item.grade}</span>
                        ${informationIcon}
                    </div>
                    <div class="hygieneArchiveInfo">
                        <span class="hygieneArchiveDate">Updated ${item.updated}</span>
                        <span class="hygieneArchiveActive">Active till ${item.activeTill}</span>
                    </div>
                </div>
            `;
              })
              .join("")}
        </div>
    `;
}

function renderHygieneContent() {
  const container = document.getElementById("hygieneContent");
  if (!container) return;

  container.innerHTML =
    currentTab === "current" ? renderCurrentGrade() : renderArchivedGrades();
}

function renderTransparencySection() {
  return `
        <div class="transparencySection">
            <img src="../../assets/icons/transparency.svg" alt="Transparency" class="transparencyIcon" />
            <div class="transparencyContent">
                <h3 class="transparencyHeader">Why it's shown here</h3>
                <p class="transparencySubtext">Food choices should come with clear information. That's why we display each stall's hygiene grade and update it based on official releases. We don't override or conceal grades—so you can decide with confidence.</p>
            </div>
        </div>
    `;
}

function renderHygieneSection() {
  return `
        <div class="hygieneSection">
            <div class="hygieneHeader">
                <span class="hygieneTitle">Hygiene Grade</span>
                <div class="segmentedControl">
                    <label class="segmentedButton">
                        <input type="radio" name="hygieneTab" value="current" ${currentTab === "current" ? "checked" : ""} />
                        Current
                    </label>
                    <label class="segmentedButton">
                        <input type="radio" name="hygieneTab" value="archived" ${currentTab === "archived" ? "checked" : ""} />
                        Archived
                    </label>
                </div>
            </div>
            <div class="hygieneMicrocopyWrapper">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M13 8L9 12L7 10M10 1C9.39102 0.999201 8.79179 1.1529 8.25837 1.44671C7.72495 1.74053 7.27479 2.16486 6.95 2.68C6.6554 2.60892 6.35301 2.57532 6.05 2.58C5.13815 2.61387 4.27318 2.99274 3.63 3.64C3.20785 4.07042 2.90056 4.59997 2.73632 5.18005C2.57208 5.76013 2.55615 6.37217 2.69 6.96C2.17443 7.2827 1.74903 7.73076 1.4535 8.26236C1.15797 8.79397 1.00195 9.39178 1 10C1.00026 10.6099 1.15548 11.2098 1.45109 11.7433C1.7467 12.2768 2.173 12.7264 2.69 13.05C2.55742 13.6387 2.57494 14.2512 2.74094 14.8313C2.90694 15.4115 3.2161 15.9406 3.64 16.37C4.07146 16.8005 4.60517 17.1145 5.1911 17.2824C5.77703 17.4503 6.396 17.4667 6.99 17.33C7.31234 17.8376 7.75668 18.2564 8.28247 18.5481C8.80825 18.8398 9.39873 18.9952 10 19C10.6064 19.0002 11.2029 18.8472 11.7344 18.5553C12.2658 18.2633 12.7149 17.8419 13.04 17.33C13.632 17.4626 14.2479 17.4435 14.8306 17.2744C15.4132 17.1053 15.9437 16.7917 16.3727 16.3627C16.8017 15.9337 17.1153 15.4032 17.2844 14.8206C17.4535 14.2379 17.4726 13.622 17.34 13.03C17.8486 12.7047 18.2672 12.2566 18.5572 11.7272C18.8473 11.1977 18.9996 10.6037 19 10C19.0002 9.39365 18.8472 8.79707 18.5553 8.26562C18.2633 7.73417 17.8419 7.28508 17.33 6.96C17.4626 6.36799 17.4435 5.75206 17.2744 5.16941C17.1053 4.58677 16.7917 4.05631 16.3627 3.62732C15.9337 3.19833 15.4032 2.88471 14.8206 2.71559C14.2379 2.54648 13.622 2.52736 13.03 2.66C12.7047 2.15143 12.2566 1.73285 11.7271 1.44277C11.1977 1.15269 10.6037 1.00043 10 1Z" stroke="#913B9F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p class="hygieneMicrocopy">Hygiene grades are verified and can only be updated by the authorities.</p>
            </div>
            <div id="hygieneContent" class="hygieneContent"></div>
        </div>
    `;
}

function renderPage(shop) {
  const container = document.getElementById("hygienePageContent");
  if (!container) return;

  const shopHeaderHTML = renderShopHeader(shop);
  const hygieneSectionHTML = renderHygieneSection();
  const transparencySectionHTML = renderTransparencySection();

  container.innerHTML =
    shopHeaderHTML + hygieneSectionHTML + transparencySectionHTML;

  renderHygieneContent();

  // Add tab change listeners
  document.querySelectorAll('input[name="hygieneTab"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      currentTab = e.target.value;
      renderHygieneContent();
    });
  });
}

// ============================================
// LOADING STATE HELPERS
// ============================================

function showLoading() {
  const container = document.getElementById("hygienePageContent");
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

async function initializePage() {
  try {
    showLoading();

    const shopId = getShopIdFromUrl();
    const [shopData, hygieneHistoryData] = await Promise.all([
      api.fetchShopData(shopId),
      api.fetchHygieneHistory(shopId),
    ]);

    hygieneData = hygieneHistoryData;
    renderPage(shopData);
  } catch (error) {
    console.error("Failed to initialize hygiene page:", error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();
  initMobileMenu();

  initializePage();

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
