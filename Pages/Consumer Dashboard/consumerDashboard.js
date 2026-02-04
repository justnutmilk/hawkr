// ============================================
// FIREBASE AUTHENTICATION & SERVICES
// ============================================

import { auth, db } from "../../firebase/config.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getFeaturedHawkerCentres,
  getNearbyHawkerCentres,
  getAllHawkerCentres,
} from "../../firebase/services/hawkerCentres.js";
import {
  searchStalls,
  getStallsByHawkerCentre,
} from "../../firebase/services/foodStalls.js";
import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";

// ============================================
// MOCK DATA (Simulating Backend Database)
// ============================================

const mockData = {
  // Search History (user's recent searches)
  searchHistory: [],

  // Navigation pages for search (static UI elements)
  searchableItems: [
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
  ],

  // Popular Searches - now fetched from Firebase, this is empty placeholder
  popularSearches: [],

  // Carousel/Ads Data
  carouselSlides: [
    {
      id: 1,
      image: "../../mock-data/Consumer Dashboard/ads/Ad-1.png",
      alt: "Hawkr Promo 1",
    },
    {
      id: 2,
      image: "../../mock-data/Consumer Dashboard/ads/Ad-2.png",
      alt: "Hawkr Promo 2",
    },
    {
      id: 3,
      image: "../../mock-data/Consumer Dashboard/ads/Ad-3.png",
      alt: "Hawkr Promo 3",
    },
    {
      id: 4,
      image: "../../mock-data/Consumer Dashboard/ads/Ad-4.png",
      alt: "Hawkr Promo 4",
    },
    {
      id: 5,
      image: "../../mock-data/Consumer Dashboard/ads/Ad-5.png",
      alt: "Hawkr Promo 5",
    },
  ],

  // Current Order Status (null if no active order)
  currentOrder: {
    orderNumber: "A-127",
    minsToCollection: 15,
  },

  // Quick Action Buttons
  quickActions: [
    {
      id: "order",
      label: "Order",
      icon: "../../assets/icons/order.svg",
      color: "#EAF5E9",
    },
    {
      id: "favourites",
      label: "Favourites",
      icon: "../../assets/icons/heart.svg",
      color: "#FFEBEB",
    },
    {
      id: "nearby",
      label: "Nearby",
      icon: "../../assets/icons/location.svg",
      color: "#F2F2FF",
    },
    {
      id: "vouchers",
      label: "Vouchers",
      icon: "../../assets/icons/vouchers.svg",
      color: "#FAFAC1",
    },
    {
      id: "history",
      label: "History",
      icon: "../../assets/icons/history.svg",
      color: "#F6EEF9",
    },
    {
      id: "feedback",
      label: "Feedback",
      icon: "../../assets/icons/feedback.svg",
      color: "#F2F5FC",
    },
  ],

  // User Vouchers
  userVouchers: [],
};

// ============================================
// API FUNCTIONS (Firebase Backend Calls)
// ============================================

const api = {
  async fetchSearchHistory() {
    // Search history is stored locally - return from mockData
    return mockData.searchHistory;
  },

  async fetchPopularSearches() {
    // Popular searches can be fetched from Firebase later
    // For now return mockData
    return mockData.popularSearches;
  },

  async fetchCarouselSlides() {
    // Carousel slides/ads - return from mockData for now
    return mockData.carouselSlides;
  },

  async fetchCurrentOrder() {
    // Get current active order from Firebase
    try {
      const user = auth.currentUser;
      if (!user) return null;

      const ordersQuery = query(
        collection(db, "orders"),
        where("customerId", "==", user.uid),
        where("status", "in", ["pending", "confirmed", "preparing"]),
        orderBy("createdAt", "desc"),
        limit(1),
      );
      const snapshot = await getDocs(ordersQuery);

      if (snapshot.empty) return null;

      const orderDoc = snapshot.docs[0];
      const orderData = orderDoc.data();

      return {
        orderNumber:
          orderData.orderNumber || orderDoc.id.substring(0, 5).toUpperCase(),
        minsToCollection: orderData.estimatedMinutes || 15,
      };
    } catch (error) {
      console.error("Error fetching current order:", error);
      return null;
    }
  },

  async fetchQuickActions() {
    // Quick actions are static UI elements
    return mockData.quickActions;
  },

  async fetchFeaturedHawkers() {
    try {
      console.log("Fetching featured hawkers...");
      let hawkers = await getFeaturedHawkerCentres(5);
      console.log("Featured hawkers from Firebase:", hawkers);

      // If no featured hawkers, get all hawkers instead
      if (hawkers.length === 0) {
        console.log("No featured hawkers, fetching all...");
        hawkers = await getAllHawkerCentres();
        console.log("All hawkers from Firebase:", hawkers);
        hawkers = hawkers.slice(0, 5);
      }

      // Transform Firebase data to match expected format
      const transformed = hawkers.map((hawker) => ({
        id: hawker.id,
        name: hawker.name,
        address: hawker.address || "",
        postalCode: hawker.postalCode ? `Singapore ${hawker.postalCode}` : "",
        rating: hawker.rating || 4.5,
        hours: formatOperatingHours(hawker.operatingHours),
        image:
          hawker.imageUrl ||
          `../../mock-data/Consumer Dashboard/hawker-center/${hawker.name}.png`,
      }));
      console.log("Transformed hawkers:", transformed);
      return transformed;
    } catch (error) {
      console.error("Error fetching featured hawkers:", error);
      return [];
    }
  },

  async fetchNearbyHawkers() {
    try {
      // Get all hawker centres from Firebase
      const allHawkers = await getAllHawkerCentres();

      // Transform Firebase data to match expected format
      return allHawkers.slice(0, 5).map((hawker) => ({
        id: hawker.id,
        name: hawker.name,
        address: hawker.address || "",
        postalCode: hawker.postalCode ? `Singapore ${hawker.postalCode}` : "",
        rating: hawker.rating || 4.5,
        hours: formatOperatingHours(hawker.operatingHours),
        image:
          hawker.imageUrl ||
          `../../mock-data/Consumer Dashboard/hawker-center/${hawker.name}.png`,
      }));
    } catch (error) {
      console.error("Error fetching nearby hawkers:", error);
      return [];
    }
  },

  async fetchUserVouchers() {
    // Vouchers - return from mockData for now
    return mockData.userVouchers;
  },

  async fetchSearchableItems() {
    try {
      // Get hawker centres and stalls from Firebase for search
      const hawkerCentres = await getAllHawkerCentres();
      const searchableHawkers = hawkerCentres.map((h) => ({
        id: h.id,
        type: "hawkerCentre",
        name: h.name,
        image:
          h.imageUrl ||
          `../../mock-data/Consumer Dashboard/hawker-center/${h.name}.png`,
      }));

      // Get stalls from each hawker centre
      const stallsPromises = hawkerCentres.map((h) =>
        getStallsByHawkerCentre(h.id),
      );
      const stallsArrays = await Promise.all(stallsPromises);
      const allStalls = stallsArrays.flat();

      const searchableStalls = allStalls.map((s) => ({
        id: s.id,
        type: "stall",
        name: s.name,
        parentName:
          hawkerCentres.find((h) => h.id === s.hawkerCentreId)?.name || "",
        image: s.imageUrl || "",
      }));

      // Navigation pages are static UI elements (keep from mockData)
      const navPages = mockData.searchableItems.filter(
        (item) => item.type === "page",
      );

      return [...searchableHawkers, ...searchableStalls, ...navPages];
    } catch (error) {
      console.error("Error fetching searchable items:", error);
      // Only return navigation pages on error, no mock hawkers/stalls
      const navPages = mockData.searchableItems.filter(
        (item) => item.type === "page",
      );
      return navPages;
    }
  },
};

// Helper function to get current position
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 300000, // 5 minutes cache
    });
  });
}

// Helper function to format operating hours from Firebase format
function formatOperatingHours(hours) {
  if (!hours) return "Hours vary";

  // Get today's day
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
  // Order icon - Fork and spoon (green)
  order: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M9.33333 2.66667V14.6667H12V29.3333H14.6667V2.66667H12V10.6667H9.33333V2.66667H6.66667V10.6667H4V2.66667H1.33333V14.6667C1.33333 16.1333 2.53333 17.3333 4 17.3333H6.66667V29.3333H9.33333V17.3333H12C13.4667 17.3333 14.6667 16.1333 14.6667 14.6667V2.66667H9.33333ZM22.6667 8V18.6667H18.6667V29.3333H21.3333V21.3333H26.6667C28.1333 21.3333 29.3333 20.1333 29.3333 18.6667V8C29.3333 5.05333 26.9467 2.66667 24 2.66667C21.0533 2.66667 18.6667 5.05333 18.6667 8H21.3333C21.3333 6.53333 22.5333 5.33333 24 5.33333C25.4667 5.33333 26.6667 6.53333 26.6667 8V18.6667H22.6667V8Z" fill="#77B573"/>
  </svg>`,

  // Favourites icon - Heart (red/coral)
  favourites: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M16 28.4533L14.12 26.7467C7.2 20.48 2.66667 16.3733 2.66667 11.3333C2.66667 7.22667 5.89333 4 10 4C12.32 4 14.5467 5.08 16 6.78667C17.4533 5.08 19.68 4 22 4C26.1067 4 29.3333 7.22667 29.3333 11.3333C29.3333 16.3733 24.8 20.48 17.88 26.76L16 28.4533Z" fill="#E57373"/>
  </svg>`,

  // Nearby icon - Location pin (purple)
  nearby: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M16 2.66667C10.48 2.66667 6 7.14667 6 12.6667C6 20 16 29.3333 16 29.3333C16 29.3333 26 20 26 12.6667C26 7.14667 21.52 2.66667 16 2.66667ZM16 16C14.16 16 12.6667 14.5067 12.6667 12.6667C12.6667 10.8267 14.16 9.33333 16 9.33333C17.84 9.33333 19.3333 10.8267 19.3333 12.6667C19.3333 14.5067 17.84 16 16 16Z" fill="#9C27B0"/>
  </svg>`,

  // Vouchers icon - Ticket/coupon (yellow/gold)
  vouchers: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M26.6667 6.66667H5.33333C3.86667 6.66667 2.68 7.86667 2.68 9.33333L2.66667 22.6667C2.66667 24.1333 3.86667 25.3333 5.33333 25.3333H26.6667C28.1333 25.3333 29.3333 24.1333 29.3333 22.6667V9.33333C29.3333 7.86667 28.1333 6.66667 26.6667 6.66667ZM26.6667 22.6667H5.33333V17.3333H8V14.6667H5.33333V9.33333H26.6667V14.6667H24V17.3333H26.6667V22.6667ZM14.6667 14.6667H17.3333V17.3333H14.6667V14.6667ZM10.6667 14.6667H13.3333V17.3333H10.6667V14.6667ZM18.6667 14.6667H21.3333V17.3333H18.6667V14.6667Z" fill="#D4A017"/>
  </svg>`,

  // History icon - Clock with arrow (purple)
  history: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M17.3333 2.66667C10.7067 2.66667 5.33333 8.04 5.33333 14.6667H1.33333L6.44 19.7733L6.53333 19.96L11.8267 14.6667H7.82667C7.82667 9.42667 12.0933 5.16 17.3333 5.16C22.5733 5.16 26.84 9.42667 26.84 14.6667C26.84 19.9067 22.5733 24.1733 17.3333 24.1733C14.72 24.1733 12.3467 23.1067 10.6267 21.3733L8.86667 23.1333C11.04 25.3067 14.0267 26.6667 17.3333 26.6667C23.96 26.6667 29.3333 21.2933 29.3333 14.6667C29.3333 8.04 23.96 2.66667 17.3333 2.66667ZM16 8V16L22.4933 19.8667L23.6 17.9867L18 14.6667V8H16Z" fill="#7E57C2"/>
  </svg>`,

  // Feedback icon - Chat bubble (teal/blue)
  feedback: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M28 2.66667H4C2.53333 2.66667 1.34667 3.86667 1.34667 5.33333L1.33333 29.3333L6.66667 24H28C29.4667 24 30.6667 22.8 30.6667 21.3333V5.33333C30.6667 3.86667 29.4667 2.66667 28 2.66667ZM9.33333 12H22.6667V14.6667H9.33333V12ZM18.6667 18.6667H9.33333V16H18.6667V18.6667ZM22.6667 10.6667H9.33333V8H22.6667V10.6667Z" fill="#5C9EAD"/>
  </svg>`,

  star: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M6 0L7.34708 4.1459H11.7063L8.17963 6.7082L9.52671 10.8541L6 8.2918L2.47329 10.8541L3.82037 6.7082L0.293661 4.1459H4.65292L6 0Z" fill="#FFC107"/>
  </svg>`,

  clock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M6 0C2.7 0 0 2.7 0 6C0 9.3 2.7 12 6 12C9.3 12 12 9.3 12 6C12 2.7 9.3 0 6 0ZM6 10.8C3.36 10.8 1.2 8.64 1.2 6C1.2 3.36 3.36 1.2 6 1.2C8.64 1.2 10.8 3.36 10.8 6C10.8 8.64 8.64 10.8 6 10.8ZM6.3 3H5.4V6.6L8.55 8.49L9 7.74L6.3 6.15V3Z" fill="#666"/>
  </svg>`,
};

// ============================================
// SEARCH DROPDOWN FUNCTIONS
// ============================================

const SEARCH_HISTORY_KEY = "hawkr_search_history";
const MAX_SEARCH_HISTORY = 10;

let searchHistory = [];
let popularSearches = [];
let searchableItems = [];
let currentSearchQuery = "";
let selectedResultIndex = -1;

// Load search history from localStorage
function getSearchHistoryFromStorage() {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Error loading search history:", e);
    return [];
  }
}

// Save search history to localStorage
function saveSearchHistoryToStorage(history) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Error saving search history:", e);
  }
}

// Add item to search history
function addToSearchHistory(item) {
  // Create history entry with timestamp
  const historyEntry = {
    ...item,
    searchedAt: formatSearchTime(new Date()),
  };

  // Remove existing entry for same item (to avoid duplicates)
  searchHistory = searchHistory.filter(
    (h) => !(h.id === item.id && h.type === item.type),
  );

  // Add to beginning of array
  searchHistory.unshift(historyEntry);

  // Limit history size
  if (searchHistory.length > MAX_SEARCH_HISTORY) {
    searchHistory = searchHistory.slice(0, MAX_SEARCH_HISTORY);
  }

  // Save to localStorage
  saveSearchHistoryToStorage(searchHistory);
}

// Format timestamp for display
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

// Calculate Levenshtein distance between two strings
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

// Check if a word fuzzy matches any word in the text
function fuzzyMatchWord(searchWord, textWords, maxDistance = 2) {
  // First check exact/partial match
  if (
    textWords.some((tw) => tw.includes(searchWord) || searchWord.includes(tw))
  ) {
    return true;
  }

  // Then check fuzzy match with Levenshtein distance
  // Allow more distance for longer words
  const allowedDistance = searchWord.length <= 4 ? 1 : maxDistance;

  return textWords.some((tw) => {
    // Only compare words of similar length
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

  // Common stop words to ignore
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

  // If all words were stop words, return empty
  if (words.length === 0) {
    return [];
  }

  return searchableItems.filter((item) => {
    // Combine name, parent name, and keywords for searching
    let searchText = item.name.toLowerCase();
    if (item.parentName) {
      searchText += ` ${item.parentName.toLowerCase()}`;
    }
    if (item.keywords) {
      searchText += ` ${item.keywords.toLowerCase()}`;
    }

    const textWords = searchText.split(/\s+/);

    // All search words must fuzzy match somewhere in the text
    return words.every((word) => fuzzyMatchWord(word, textWords));
  });
}

function renderSearchResultItem(item, isHistory = false) {
  const displayName =
    item.type === "stall" && item.parentName
      ? `${item.name} • ${item.parentName}`
      : item.name;

  const metaText = isHistory
    ? item.searchedAt
    : `${item.searchCount} ${item.searchCount === 1 ? "Search" : "Searches"}`;

  const metaClass = isHistory ? "searchResultMeta history" : "searchResultMeta";

  // Handle page type items (navigation pages) with icon
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

  // Handle page type items (navigation pages) with icon
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

  // If there's a search query, show search results
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
    // No query - show history and suggestions
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
        ${suggestionsItemsHTML}
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

  // Focus the large search input and set cursor at end
  const largeInput = document.getElementById("searchInputLarge");
  if (largeInput) {
    largeInput.focus();
    // Set cursor to end of input
    const len = largeInput.value.length;
    largeInput.setSelectionRange(len, len);
  }

  // Add click and mouse handlers to search result items
  const resultItems = dropdown.querySelectorAll(".searchResultItem");
  resultItems.forEach((item, index) => {
    // Click handler
    item.addEventListener("click", () => {
      const type = item.dataset.type;
      const id = item.dataset.id;
      const url = item.dataset.url || null;
      handleSearchResultClick(type, id, url);
    });

    // Mouse move handler for light effect
    item.addEventListener("mousemove", (e) => {
      const rect = item.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      item.style.setProperty("--mouse-x", `${x}px`);
      item.style.setProperty("--mouse-y", `${y}px`);
    });

    // Mouse enter to update selected index
    item.addEventListener("mouseenter", () => {
      selectedResultIndex = index;
      updateSelectedResult();
    });

    // Mouse leave to clear selection
    item.addEventListener("mouseleave", () => {
      selectedResultIndex = -1;
      updateSelectedResult();
    });
  });
}

// Update visual selection state
function updateSelectedResult() {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  const items = dropdown.querySelectorAll(".searchResultItem");
  items.forEach((item, index) => {
    if (index === selectedResultIndex) {
      item.classList.add("selected");
      // Scroll into view if needed
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      item.classList.remove("selected");
    }
  });
}

// Handle keyboard navigation in search dropdown
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
  // Find the item in searchableItems to add to history
  const item = searchableItems.find(
    (i) => i.id.toString() === id.toString() && i.type === type,
  );

  if (item) {
    addToSearchHistory(item);
  }

  // Navigate to the appropriate page
  if (type === "page" && url) {
    window.location.href = url;
  } else if (type === "hawkerCentre") {
    window.location.href = `../Consumer Order/consumerHawkerCentre?id=${id}`;
  } else if (type === "stall") {
    window.location.href = `../Consumer Order/consumerOrderShop?id=${id}`;
  }
}

function initializeSearchDropdown() {
  const searchWrapper = document.getElementById("searchModuleWrapper");
  const searchInput = document.getElementById("searchInput");
  const searchDropdown = document.getElementById("searchDropdown");

  if (!searchWrapper || !searchInput || !searchDropdown) return;

  // Show dropdown on focus
  searchInput.addEventListener("focus", async () => {
    selectedResultIndex = -1; // Reset selection

    // Load search history from localStorage
    searchHistory = getSearchHistoryFromStorage();

    // Load other data if not already loaded
    if (searchableItems.length === 0) {
      [popularSearches, searchableItems] = await Promise.all([
        api.fetchPopularSearches(),
        api.fetchSearchableItems(),
      ]);
    }

    // Transfer any text from small input to large input
    currentSearchQuery = searchInput.value;

    // Small delay to ensure initial state is rendered before animating
    requestAnimationFrame(() => {
      searchWrapper.classList.add("active");
      renderSearchDropdown(currentSearchQuery);

      // Clear the small input
      searchInput.value = "";

      // Add input listener to the large search input after it's rendered
      setupSearchInputListener();
    });
  });

  // Also handle typing in small input before dropdown fully opens
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

  // Hide dropdown on click outside
  document.addEventListener("click", (e) => {
    const isClickInsideDropdown = searchDropdown.contains(e.target);
    const isClickInsideWrapper = searchWrapper.contains(e.target);
    if (!isClickInsideWrapper && !isClickInsideDropdown) {
      searchWrapper.classList.remove("active");
      currentSearchQuery = "";
      selectedResultIndex = -1;
    }
  });

  // Hide dropdown on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchWrapper.classList.remove("active");
      searchInput.blur();
      currentSearchQuery = "";
      selectedResultIndex = -1;
    }
  });
}

function setupSearchInputListener() {
  const largeInput = document.getElementById("searchInputLarge");
  if (!largeInput) return;

  // Remove existing listeners to prevent duplicates
  largeInput.removeEventListener("input", handleSearchInput);
  largeInput.removeEventListener("keydown", handleSearchKeydown);

  // Add listeners
  largeInput.addEventListener("input", handleSearchInput);
  largeInput.addEventListener("keydown", handleSearchKeydown);
}

function handleSearchInput(e) {
  currentSearchQuery = e.target.value;
  selectedResultIndex = -1; // Reset selection when typing
  renderSearchDropdown(currentSearchQuery);

  // Re-setup listener since we re-rendered
  setupSearchInputListener();
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderCarousel(slides) {
  const carouselContainer = document.getElementById("carouselSlides");
  const dotsContainer = document.getElementById("carouselDots");

  if (!carouselContainer || !dotsContainer) return;

  // Render slides with images
  carouselContainer.innerHTML = slides
    .map(
      (slide, index) => `
    <div class="carouselSlide ${index === 0 ? "active" : ""}" data-slide-id="${slide.id}">
      <img src="${slide.image}" alt="${slide.alt}" class="carouselImage">
    </div>
  `,
    )
    .join("");

  // Render dots
  dotsContainer.innerHTML = slides
    .map(
      (_, index) => `
    <span class="dot ${index === 0 ? "active" : ""}" data-index="${index}"></span>
  `,
    )
    .join("");

  // Add click handlers to dots
  dotsContainer.querySelectorAll(".dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = parseInt(dot.dataset.index);
      goToSlide(index);
    });
  });

  // Start auto-rotation
  startCarouselAutoRotation();
}

let carouselInterval = null;
let currentSlideIndex = 0;

function goToSlide(index) {
  const slides = document.querySelectorAll(".carouselSlide");
  const dots = document.querySelectorAll(".dot");

  if (slides.length === 0) return;

  // Remove active class from all
  slides.forEach((slide) => slide.classList.remove("active"));
  dots.forEach((dot) => dot.classList.remove("active"));

  // Add active class to current
  currentSlideIndex = index;
  slides[index].classList.add("active");
  dots[index].classList.add("active");
}

function startCarouselAutoRotation() {
  if (carouselInterval) clearInterval(carouselInterval);

  carouselInterval = setInterval(() => {
    const slides = document.querySelectorAll(".carouselSlide");
    if (slides.length === 0) return;

    const nextIndex = (currentSlideIndex + 1) % slides.length;
    goToSlide(nextIndex);
  }, 4000);
}

function renderOrderStatus(order, carouselSlides) {
  const orderStatusContainer = document.querySelector(".orderStatusContainer");
  if (!orderStatusContainer) return;

  if (order) {
    // Show order status cards
    orderStatusContainer.innerHTML = `
      <div class="orderStatusCard">
        <p class="orderStatusLabel">Order no.</p>
        <p class="orderStatusValue" id="orderNumber">${order.orderNumber}</p>
      </div>
      <div class="orderStatusCard">
        <p class="orderStatusLabel">Mins to collection</p>
        <p class="orderStatusValue" id="minsToCollection">${order.minsToCollection}</p>
      </div>
    `;
  } else {
    // Show ads when no active order
    const ads = carouselSlides || [];
    const shuffled = [...ads].sort(() => Math.random() - 0.5);
    const ad1 = shuffled[0];
    const ad2 = shuffled[1] || shuffled[0];

    orderStatusContainer.innerHTML = `
      <div class="orderStatusCard ad-card">
        ${ad1 ? `<img src="${ad1.image}" alt="${ad1.alt}" class="adImage">` : ""}
      </div>
      <div class="orderStatusCard ad-card">
        ${ad2 ? `<img src="${ad2.image}" alt="${ad2.alt}" class="adImage">` : ""}
      </div>
    `;
  }
}

function renderQuickActions(actions) {
  const container = document.getElementById("quickActionsContainer");
  if (!container) return;

  container.innerHTML = actions
    .map(
      (action) => `
    <div class="quickActionItem" data-action="${action.id}">
      <div class="quickActionIcon" style="background: ${action.color}">
        <img src="${action.icon}" alt="${action.label}" class="quickActionIconImg">
      </div>
      <span class="quickActionLabel">${action.label}</span>
    </div>
  `,
    )
    .join("");

  // Add click handlers
  container.querySelectorAll(".quickActionItem").forEach((item) => {
    item.addEventListener("click", () => {
      const actionId = item.dataset.action;
      handleQuickAction(actionId);
    });
  });
}

function handleQuickAction(actionId) {
  switch (actionId) {
    case "order":
      window.location.href = "../Consumer Order/consumerOrder.html";
      break;
    case "favourites":
      window.location.href = "../Consumer Favourites/consumerFavourites.html";
      break;
    case "nearby":
      document
        .querySelector(".nearbyHawkersSection")
        ?.scrollIntoView({ behavior: "smooth" });
      break;
    case "vouchers":
      document
        .querySelector(".vouchersSection")
        ?.scrollIntoView({ behavior: "smooth" });
      break;
    case "history":
      window.location.href = "../Consumer Settings/consumerTransactions.html";
      break;
    case "feedback":
      window.location.href = "../Consumer Settings/consumerFeedback.html";
      break;
    default:
      console.log(`Quick action clicked: ${actionId}`);
  }
}

function renderHawkerCard(hawker) {
  console.log("Rendering hawker card:", hawker.name, "ID:", hawker.id);
  const hasDetails = hawker.address && hawker.rating;
  const hawkerId = hawker.id || "";

  return `
    <a href="../Consumer Order/consumerHawkerCentre?id=${hawkerId}" class="hawkerCard" data-hawker-id="${hawkerId}">
      <div class="hawkerCardImage">
        <img src="${hawker.image}" alt="${hawker.name}" onerror="this.style.display='none'">
      </div>
      <div class="hawkerCardInfo">
        <h3 class="hawkerCardName">${hawker.name}</h3>
        ${
          hasDetails
            ? `
          <p class="hawkerCardAddress">${hawker.address}<br>${hawker.postalCode}</p>
          <div class="hawkerCardMeta">
            <span class="hawkerRating">
              ${icons.star}
              ${hawker.rating}
            </span>
            <span class="hawkerHours">
              ${icons.clock}
              ${hawker.hours}
            </span>
          </div>
        `
            : ""
        }
      </div>
    </a>
  `;
}

function renderFeaturedHawkers(hawkers) {
  const container = document.getElementById("featuredHawkersContainer");
  if (!container) return;

  console.log("Rendering featured hawkers:", hawkers);

  container.innerHTML = hawkers
    .map((hawker) => renderHawkerCard(hawker))
    .join("");
}

function renderNearbyHawkers(hawkers) {
  const container = document.getElementById("nearbyHawkersContainer");
  if (!container) return;

  const hawkerCards = hawkers
    .map((hawker) => renderHawkerCard(hawker))
    .join("");
  const message =
    hawkers.length > 0 && hawkers.length < 3
      ? `<p class="nearbyMessage">That's it! Couldn't find any more in your vicinity...</p>`
      : "";

  container.innerHTML = hawkerCards + message;
}

function handleHawkerClick(hawkerId) {
  console.log("handleHawkerClick called with ID:", hawkerId);
  if (!hawkerId) {
    console.error("No hawker ID provided to handleHawkerClick");
    return;
  }
  window.location.href = `../Consumer Order/consumerHawkerCentre?id=${hawkerId}`;
}

// Expose navigation function globally for inline onclick handlers (needed for ES modules)
window.navigateToHawker = function (hawkerId) {
  console.log("navigateToHawker called with ID:", hawkerId);
  console.log("Type of hawkerId:", typeof hawkerId);
  const targetUrl = `../Consumer Order/consumerHawkerCentre?id=${hawkerId}`;
  console.log("Navigating to:", targetUrl);
  window.location.href = targetUrl;
};

function renderVouchers(vouchers) {
  const container = document.getElementById("vouchersContainer");
  if (!container) return;

  if (vouchers.length === 0) {
    container.innerHTML = `<p class="vouchersEmptyMessage">More vouchers coming soon!</p>`;
  } else {
    container.innerHTML = vouchers
      .map(
        (voucher) => `
      <div class="voucherCard" data-voucher-id="${voucher.id}">
        <p class="voucherTitle">${voucher.title}</p>
        <p class="voucherExpiry">Expires: ${voucher.expiry}</p>
      </div>
    `,
      )
      .join("");
  }
}

// ============================================
// LOADING STATE HELPERS
// ============================================

function showLoading(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `<div class="loadingSpinner"></div>`;
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initializeDashboard() {
  try {
    // Fetch all data in parallel
    const [
      carouselSlides,
      currentOrder,
      quickActions,
      featuredHawkers,
      nearbyHawkers,
      userVouchers,
    ] = await Promise.all([
      api.fetchCarouselSlides(),
      api.fetchCurrentOrder(),
      api.fetchQuickActions(),
      api.fetchFeaturedHawkers(),
      api.fetchNearbyHawkers(),
      api.fetchUserVouchers(),
    ]);

    // Render all sections
    renderCarousel(carouselSlides);
    renderOrderStatus(currentOrder, carouselSlides);
    renderQuickActions(quickActions);
    renderFeaturedHawkers(featuredHawkers);
    renderNearbyHawkers(nearbyHawkers);
    renderVouchers(userVouchers);
  } catch (error) {
    console.error("Failed to initialize dashboard:", error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();

  // Initialize dashboard with dynamic content
  initializeDashboard();

  // Initialize search dropdown
  initializeSearchDropdown();

  // Search input focus shortcut
  const searchInput = document.getElementById("searchInput");

  document.addEventListener("keydown", function (e) {
    if (!searchInput) return;

    // Check if user is already typing in an input field
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
