// ============================================
// SHARED SEARCH MODULE
// Fetches hawker centres and stalls from Firebase
// ============================================

import { db } from "../../firebase/config.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const SEARCH_HISTORY_KEY = "hawkr_search_history";
const MAX_SEARCH_HISTORY = 10;

let searchHistory = [];
let popularSearches = [];
let searchableItems = [];
let currentSearchQuery = "";
let selectedResultIndex = -1;
let dataLoaded = false;

// Navigation pages (static)
const navigationPages = [
  {
    id: "nav-favourites",
    type: "page",
    name: "Favourites",
    keywords: "favourites favorites liked saved hearts love",
    icon: "../../assets/icons/heart.svg",
    color: "#FFEBEB",
    url: "../Consumer Favourites/consumerFavourites.html",
  },
  {
    id: "nav-cart",
    type: "page",
    name: "Cart",
    keywords: "cart basket checkout bag shopping",
    icon: "../../assets/icons/cart.svg",
    color: "#F6EEF9",
    url: "../Consumer Order/consumerCart.html",
  },
  {
    id: "nav-notifications",
    type: "page",
    name: "Notifications",
    keywords: "notifications alerts messages bell updates",
    icon: "../../assets/icons/notifications.svg",
    color: "#F2F5FC",
    url: "../Consumer Settings/consumerNotifications.html",
  },
  {
    id: "nav-history",
    type: "page",
    name: "Order History",
    keywords: "history orders transactions past previous",
    icon: "../../assets/icons/history.svg",
    color: "#F6EEF9",
    url: "../Consumer Settings/consumerTransactions.html",
  },
  {
    id: "nav-settings",
    type: "page",
    name: "Settings",
    keywords: "settings account profile preferences",
    icon: "../../assets/icons/settings.svg",
    color: "#F2F2FF",
    url: "../Consumer Settings/consumerSettings.html",
  },
  {
    id: "nav-order",
    type: "page",
    name: "Order Food",
    keywords: "order food browse menu hawker",
    icon: "../../assets/icons/order.svg",
    color: "#EAF5E9",
    url: "../Consumer Order/consumerOrder.html",
  },
  {
    id: "nav-feedback",
    type: "page",
    name: "Leave Feedback",
    keywords:
      "feedback review rating rate comment complaint complain report experience opinion survey",
    icon: "../../assets/icons/feedback.svg",
    color: "#F2F5FC",
    url: "../Consumer Settings/consumerFeedback.html",
  },
];

// ============================================
// FIREBASE DATA FETCHING
// ============================================

async function fetchSearchableData() {
  if (dataLoaded) return;

  try {
    // Fetch hawker centres
    const hawkerCentresSnapshot = await getDocs(
      collection(db, "hawkerCentres"),
    );
    const hawkerCentres = hawkerCentresSnapshot.docs.map((doc) => ({
      id: doc.id,
      type: "hawkerCentre",
      name: doc.data().name,
      image:
        doc.data().imageUrl ||
        `../../mock-data/Consumer Dashboard/hawker-center/${doc.data().name}.png`,
    }));

    // Fetch food stalls
    const stallsSnapshot = await getDocs(collection(db, "foodStalls"));
    const stalls = stallsSnapshot.docs.map((doc) => {
      const data = doc.data();
      // Find parent hawker centre name
      const parentCentre = hawkerCentres.find(
        (h) => h.id === data.hawkerCentreId,
      );
      return {
        id: doc.id,
        type: "stall",
        name: data.name,
        parentName: parentCentre?.name || "",
        hawkerCentreId: data.hawkerCentreId,
        image:
          data.imageUrl ||
          `../../mock-data/Consumer Dashboard/hawker-center/${parentCentre?.name || "Maxwell Food Centre"}.png`,
      };
    });

    // Combine all searchable items
    searchableItems = [...hawkerCentres, ...stalls, ...navigationPages];

    // Set popular searches (first few hawker centres and stalls)
    popularSearches = [
      ...hawkerCentres.slice(0, 2).map((h) => ({ ...h, searchCount: 5 })),
      ...stalls.slice(0, 1).map((s) => ({ ...s, searchCount: 3 })),
    ];

    dataLoaded = true;
    console.log("Search module loaded", searchableItems.length, "items");
  } catch (error) {
    console.error("Error fetching searchable data:", error);
    // Fallback to navigation pages only
    searchableItems = [...navigationPages];
    popularSearches = [];
  }
}

// ============================================
// LOCAL STORAGE FUNCTIONS
// ============================================

function getSearchHistoryFromStorage() {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Error loading search history:", e);
    return [];
  }
}

function saveSearchHistoryToStorage(history) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Error saving search history:", e);
  }
}

function addToSearchHistory(item) {
  const historyEntry = {
    ...item,
    searchedAt: formatSearchTime(new Date()),
  };

  searchHistory = searchHistory.filter(
    (h) => !(h.id === item.id && h.type === item.type),
  );

  searchHistory.unshift(historyEntry);

  if (searchHistory.length > MAX_SEARCH_HISTORY) {
    searchHistory = searchHistory.slice(0, MAX_SEARCH_HISTORY);
  }

  saveSearchHistoryToStorage(searchHistory);
}

function formatSearchTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function fuzzyMatchWord(searchWord, textWords, maxDistance = 2) {
  if (
    textWords.some((tw) => tw.includes(searchWord) || searchWord.includes(tw))
  ) {
    return true;
  }

  const allowedDistance = searchWord.length <= 4 ? 1 : maxDistance;

  return textWords.some((tw) => {
    if (Math.abs(tw.length - searchWord.length) > allowedDistance) {
      return false;
    }
    return levenshteinDistance(searchWord, tw) <= allowedDistance;
  });
}

function searchItems(query) {
  if (!query || query.trim() === "") {
    return [];
  }

  const stopWords = [
    "at",
    "the",
    "in",
    "on",
    "a",
    "an",
    "of",
    "for",
    "and",
    "or",
    "from",
  ];

  const words = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((word) => !stopWords.includes(word) && word.length > 0);

  if (words.length === 0) {
    return [];
  }

  return searchableItems.filter((item) => {
    let searchText = item.name.toLowerCase();
    if (item.parentName) {
      searchText += ` ${item.parentName.toLowerCase()}`;
    }
    if (item.keywords) {
      searchText += ` ${item.keywords.toLowerCase()}`;
    }

    const textWords = searchText.split(/\s+/);

    return words.every((word) => fuzzyMatchWord(word, textWords));
  });
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderSearchResultItem(item, isHistory = false) {
  const displayName =
    item.type === "stall" && item.parentName
      ? `${item.name} • ${item.parentName}`
      : item.name;

  const metaText = isHistory
    ? item.searchedAt
    : `${item.searchCount || 0} ${(item.searchCount || 0) === 1 ? "Search" : "Searches"}`;

  const metaClass = isHistory ? "searchResultMeta history" : "searchResultMeta";

  if (item.type === "page") {
    const bgColor = item.color || "#F6EEF9";
    return `
      <div class="searchResultItem" data-type="${item.type}" data-id="${item.id}" data-url="${item.url}">
        <div class="searchResultImage searchResultIcon" style="background: ${bgColor}">
          <img src="${item.icon}" alt="${item.name}">
        </div>
        <div class="searchResultInfo">
          <span class="searchResultName">${displayName}</span>
          <span class="${metaClass}">${metaText}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="searchResultItem" data-type="${item.type}" data-id="${item.id}">
      <div class="searchResultImage">
        <img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">
      </div>
      <div class="searchResultInfo">
        <span class="searchResultName">${displayName}</span>
        <span class="${metaClass}">${metaText}</span>
      </div>
    </div>
  `;
}

function renderSearchResultItemSimple(item) {
  const displayName =
    item.type === "stall" && item.parentName
      ? `${item.name} • ${item.parentName}`
      : item.name;

  if (item.type === "page") {
    const bgColor = item.color || "#F6EEF9";
    return `
      <div class="searchResultItem" data-type="${item.type}" data-id="${item.id}" data-url="${item.url}">
        <div class="searchResultImage searchResultIcon" style="background: ${bgColor}">
          <img src="${item.icon}" alt="${item.name}">
        </div>
        <div class="searchResultInfo">
          <span class="searchResultName">${displayName}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="searchResultItem" data-type="${item.type}" data-id="${item.id}">
      <div class="searchResultImage">
        <img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">
      </div>
      <div class="searchResultInfo">
        <span class="searchResultName">${displayName}</span>
      </div>
    </div>
  `;
}

function renderSearchDropdown(query = "") {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  let contentHTML = "";

  if (query && query.trim() !== "") {
    const results = searchItems(query);
    if (results.length > 0) {
      const resultsHTML = results
        .map((item) => renderSearchResultItemSimple(item))
        .join("");
      contentHTML = `
        <div class="searchSection">
          <span class="searchSectionHeader">Search Results</span>
          ${resultsHTML}
        </div>
      `;
    } else {
      contentHTML = `
        <div class="searchSection">
          <span class="searchSectionHeader">Search Results</span>
          <span class="searchEmptyState">No results found for "${query}"</span>
        </div>
      `;
    }
  } else {
    const hasHistory = searchHistory.length > 0;

    let historySection = "";
    if (hasHistory) {
      const historyItemsHTML = searchHistory
        .map((item) => renderSearchResultItem(item, true))
        .join("");
      historySection = `
        <div class="searchSection">
          <span class="searchSectionHeader">History</span>
          ${historyItemsHTML}
        </div>
      `;
    } else {
      historySection = `
        <div class="searchSection">
          <span class="searchSectionHeader">History</span>
          <span class="searchEmptyState">None found... Get searching!</span>
        </div>
      `;
    }

    const suggestionsHeader = hasHistory
      ? "Suggestions"
      : "What People Are Searching...";
    const suggestionsItemsHTML = popularSearches
      .map((item) => renderSearchResultItem(item, false))
      .join("");
    const suggestionsSection = `
      <div class="searchSection">
        <span class="searchSectionHeader">${suggestionsHeader}</span>
        ${suggestionsItemsHTML || '<span class="searchEmptyState">Loading...</span>'}
      </div>
    `;

    contentHTML = historySection + suggestionsSection;
  }

  dropdown.innerHTML = `
    <div class="searchDropdownHeader">
      <span class="searchIcon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 18 18" fill="none">
          <path d="M16.6 18L10.3 11.7C9.8 12.1 9.225 12.4167 8.575 12.65C7.925 12.8833 7.23333 13 6.5 13C4.68333 13 3.14583 12.3708 1.8875 11.1125C0.629167 9.85417 0 8.31667 0 6.5C0 4.68333 0.629167 3.14583 1.8875 1.8875C3.14583 0.629167 4.68333 0 6.5 0C8.31667 0 9.85417 0.629167 11.1125 1.8875C12.3708 3.14583 13 4.68333 13 6.5C13 7.23333 12.8833 7.925 12.65 8.575C12.4167 9.225 12.1 9.8 11.7 10.3L18 16.6L16.6 18ZM6.5 11C7.75 11 8.8125 10.5625 9.6875 9.6875C10.5625 8.8125 11 7.75 11 6.5C11 5.25 10.5625 4.1875 9.6875 3.3125C8.8125 2.4375 7.75 2 6.5 2C5.25 2 4.1875 2.4375 3.3125 3.3125C2.4375 4.1875 2 5.25 2 6.5C2 7.75 2.4375 8.8125 3.3125 9.6875C4.1875 10.5625 5.25 11 6.5 11Z" fill="#49454F"/>
        </svg>
      </span>
      <input type="text" class="searchInputLarge" id="searchInputLarge" placeholder="Hungry for Hawkr Food?" autocomplete="off" value="${query}">
    </div>
    <div class="searchDropdownContent">
      ${contentHTML}
    </div>
  `;

  const largeInput = document.getElementById("searchInputLarge");
  if (largeInput) {
    largeInput.focus();
    const len = largeInput.value.length;
    largeInput.setSelectionRange(len, len);
  }

  const resultItems = dropdown.querySelectorAll(".searchResultItem");
  resultItems.forEach((item, index) => {
    item.addEventListener("click", () => {
      const type = item.dataset.type;
      const id = item.dataset.id;
      const url = item.dataset.url || null;
      handleSearchResultClick(type, id, url);
    });

    item.addEventListener("mousemove", (e) => {
      const rect = item.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      item.style.setProperty("--mouse-x", `${x}px`);
      item.style.setProperty("--mouse-y", `${y}px`);
    });

    item.addEventListener("mouseenter", () => {
      selectedResultIndex = index;
      updateSelectedResult();
    });

    item.addEventListener("mouseleave", () => {
      selectedResultIndex = -1;
      updateSelectedResult();
    });
  });
}

function updateSelectedResult() {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  const items = dropdown.querySelectorAll(".searchResultItem");
  items.forEach((item, index) => {
    if (index === selectedResultIndex) {
      item.classList.add("selected");
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      item.classList.remove("selected");
    }
  });
}

function handleSearchKeydown(e) {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  const items = dropdown.querySelectorAll(".searchResultItem");
  if (items.length === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedResultIndex = Math.min(selectedResultIndex + 1, items.length - 1);
    updateSelectedResult();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedResultIndex = Math.max(selectedResultIndex - 1, 0);
    updateSelectedResult();
  } else if (e.key === "Enter" && selectedResultIndex >= 0) {
    e.preventDefault();
    const selectedItem = items[selectedResultIndex];
    if (selectedItem) {
      const type = selectedItem.dataset.type;
      const id = selectedItem.dataset.id;
      const url = selectedItem.dataset.url || null;
      handleSearchResultClick(type, id, url);
    }
  }
}

function handleSearchResultClick(type, id, url = null) {
  const item = searchableItems.find(
    (i) => i.id.toString() === id.toString() && i.type === type,
  );

  if (item) {
    addToSearchHistory(item);
  }

  // Navigate - remove .html for query param URLs
  if (type === "page" && url) {
    window.location.href = url;
  } else if (type === "hawkerCentre") {
    window.location.href = `../Consumer Order/consumerHawkerCentre?id=${id}`;
  } else if (type === "stall") {
    window.location.href = `../Consumer Order/consumerOrderShop?id=${id}`;
  }
}

// ============================================
// INITIALIZATION
// ============================================

async function initializeSearchModule() {
  const searchWrapper = document.querySelector(".searchModuleWrapper");
  const searchInput = document.getElementById("searchInput");
  const searchDropdown = document.getElementById("searchDropdown");

  if (!searchWrapper || !searchInput || !searchDropdown) return;

  // Load data from Firebase
  await fetchSearchableData();

  searchInput.addEventListener("focus", async () => {
    selectedResultIndex = -1;

    searchHistory = getSearchHistoryFromStorage();

    currentSearchQuery = searchInput.value;

    requestAnimationFrame(() => {
      searchWrapper.classList.add("active");
      renderSearchDropdown(currentSearchQuery);

      searchInput.value = "";

      setupSearchInputListener();
    });
  });

  searchInput.addEventListener("input", () => {
    if (searchWrapper.classList.contains("active")) {
      const largeInput = document.getElementById("searchInputLarge");
      if (largeInput) {
        largeInput.value = searchInput.value;
        currentSearchQuery = searchInput.value;
        searchInput.value = "";
        largeInput.focus();
        renderSearchDropdown(currentSearchQuery);
        setupSearchInputListener();
      }
    }
  });

  document.addEventListener("click", (e) => {
    const isClickInsideDropdown = searchDropdown.contains(e.target);
    const isClickInsideWrapper = searchWrapper.contains(e.target);
    if (!isClickInsideWrapper && !isClickInsideDropdown) {
      searchWrapper.classList.remove("active");
      currentSearchQuery = "";
      selectedResultIndex = -1;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchWrapper.classList.remove("active");
      searchInput.blur();
      currentSearchQuery = "";
      selectedResultIndex = -1;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      const targetTag = e.target.tagName.toLowerCase();
      const isEditable = e.target.isContentEditable === true;

      if (targetTag === "input" || targetTag === "textarea" || isEditable) {
        return;
      }

      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

function setupSearchInputListener() {
  const largeInput = document.getElementById("searchInputLarge");
  if (!largeInput) return;

  largeInput.removeEventListener("input", handleSearchInput);
  largeInput.removeEventListener("keydown", handleSearchKeydown);

  largeInput.addEventListener("input", handleSearchInput);
  largeInput.addEventListener("keydown", handleSearchKeydown);
}

function handleSearchInput(e) {
  currentSearchQuery = e.target.value;
  selectedResultIndex = -1;
  renderSearchDropdown(currentSearchQuery);

  setupSearchInputListener();
}

// Auto-initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  initializeSearchModule();
});
