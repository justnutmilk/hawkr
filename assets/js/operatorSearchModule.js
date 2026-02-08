// ============================================
// OPERATOR SEARCH MODULE (Liquid Glass)
// Searches pages, actions, child stalls, transactions
// ============================================

import { db, auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// STATE
// ============================================

let currentSearchQuery = "";
let stalls = [];
let transactions = [];
let dataLoaded = false;

// Navigation pages
const navigationPages = [
  {
    type: "page",
    name: "Home",
    keywords: "home dashboard overview main centre center",
    icon: "../../assets/icons/home.svg",
    color: "#F6EEF9",
    url: "../Operator Dashboard/operatorDashboard.html",
  },
  {
    type: "page",
    name: "Transactions",
    keywords: "transactions payments rent revenue money income finance",
    icon: "../../assets/icons/payments.svg",
    color: "#EAF5E9",
    url: "../Operator Transactions/operatorTransactions.html",
  },
  {
    type: "page",
    name: "My Children",
    keywords: "children stalls vendors tenants shops stores food",
    icon: "../../assets/icons/organisation.svg",
    color: "#F2F5FC",
    url: "../Operator Children/operatorChildren.html",
  },
  {
    type: "page",
    name: "Notifications",
    keywords: "notifications alerts messages bell updates",
    icon: "../../assets/icons/notifications.svg",
    color: "#FFEBEB",
    url: "../Operator Notifications/operatorNotifications.html",
  },
];

// Action items
const actionItems = [
  {
    type: "action",
    name: "Onboard Child",
    keywords: "onboard child add vendor link stall new tenant register",
    icon: "../../assets/icons/add.svg",
    color: "#F6EEF9",
    url: "../Operator Children/operatorChildren.html?onboard=true",
  },
];

// ============================================
// DATA FETCHING
// ============================================

async function fetchOperatorSearchData(hawkerCentreId) {
  if (!hawkerCentreId || dataLoaded) return;

  try {
    const [stallsSnap, txnSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, "foodStalls"),
          where("hawkerCentreId", "==", hawkerCentreId),
        ),
      ),
      getDocs(
        query(
          collection(db, "operatorTransactions"),
          where("hawkerCentreId", "==", hawkerCentreId),
          orderBy("createdAt", "desc"),
          limit(200),
        ),
      ).catch(() =>
        // Fallback if index not ready
        getDocs(
          query(
            collection(db, "operatorTransactions"),
            where("hawkerCentreId", "==", hawkerCentreId),
            limit(200),
          ),
        ).catch(() => ({ docs: [] })),
      ),
    ]);

    stalls = stallsSnap.docs.map((d) => ({
      id: d.id,
      type: "stall",
      name: d.data().name || "Unnamed Stall",
      image: d.data().imageUrl || "",
    }));

    transactions = txnSnap.docs.map((d) => ({
      id: d.id,
      type: "transaction",
      hawkrTransactionId: d.data().hawkrTransactionId || "",
      vendorName: d.data().vendorName || "",
      amount: d.data().total || d.data().amount || 0,
    }));

    dataLoaded = true;
  } catch (error) {
    console.error("Error fetching operator search data:", error);
  }
}

// ============================================
// SEARCH
// ============================================

function searchItems(q) {
  if (!q || q.trim() === "") return [];
  const term = q.toLowerCase().trim();

  const results = [];

  // Search navigation pages
  navigationPages.forEach((page) => {
    const text = `${page.name} ${page.keywords}`.toLowerCase();
    if (text.includes(term)) results.push(page);
  });

  // Search action items
  actionItems.forEach((action) => {
    const text = `${action.name} ${action.keywords}`.toLowerCase();
    if (text.includes(term)) results.push(action);
  });

  // Search stalls
  stalls.forEach((stall) => {
    if (stall.name.toLowerCase().includes(term)) results.push(stall);
  });

  // Search transactions by ID or vendor name
  transactions.forEach((txn) => {
    const text = `${txn.hawkrTransactionId} ${txn.vendorName}`.toLowerCase();
    if (text.includes(term)) results.push(txn);
  });

  return results;
}

// ============================================
// RENDERING
// ============================================

function renderSearchDropdown(queryStr = "") {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  let contentHTML = "";

  if (queryStr && queryStr.trim() !== "") {
    const results = searchItems(queryStr);

    if (results.length === 0) {
      contentHTML = `
        <div class="searchSection">
          <span class="searchSectionHeader">Search Results</span>
          <span class="searchEmptyState">No results found for "${queryStr}"</span>
        </div>
      `;
    } else {
      let resultsHTML = "";

      // Pages and actions
      results
        .filter((r) => r.type === "page" || r.type === "action")
        .forEach((item) => {
          resultsHTML += `
          <div class="searchResultItem" data-type="${item.type}" data-url="${item.url}">
            <div class="searchResultImage searchResultIcon" style="background: ${item.color}">
              <img src="${item.icon}" alt="${item.name}">
            </div>
            <div class="searchResultInfo">
              <span class="searchResultName">${item.name}</span>
              <span class="searchResultMeta">${item.type === "action" ? "Action" : "Page"}</span>
            </div>
          </div>
        `;
        });

      // Stalls
      results
        .filter((r) => r.type === "stall")
        .slice(0, 10)
        .forEach((stall) => {
          resultsHTML += `
          <div class="searchResultItem" data-type="stall" data-stall-id="${stall.id}">
            <div class="searchResultImage">
              <img src="${stall.image || "../../images/squirrelCard.svg"}" alt="${stall.name}" onerror="this.style.display='none'">
            </div>
            <div class="searchResultInfo">
              <span class="searchResultName">${stall.name}</span>
              <span class="searchResultMeta">Child Stall</span>
            </div>
          </div>
        `;
        });

      // Transactions
      results
        .filter((r) => r.type === "transaction")
        .slice(0, 10)
        .forEach((txn) => {
          const display = txn.hawkrTransactionId || txn.id;
          const subtitle = txn.vendorName
            ? `${txn.vendorName} • S$${Number(txn.amount).toFixed(2)}`
            : `S$${Number(txn.amount).toFixed(2)}`;
          resultsHTML += `
          <div class="searchResultItem" data-type="transaction" data-txn-id="${txn.hawkrTransactionId || txn.id}">
            <div class="searchResultImage searchResultIcon" style="background: #EAF5E9">
              <img src="../../assets/icons/payments.svg" alt="Transaction">
            </div>
            <div class="searchResultInfo">
              <span class="searchResultName">${display}</span>
              <span class="searchResultMeta">${subtitle}</span>
            </div>
          </div>
        `;
        });

      contentHTML = `
        <div class="searchSection">
          <span class="searchSectionHeader">Search Results</span>
          ${resultsHTML}
        </div>
      `;
    }
  } else {
    // Empty state — show quick links
    const quickLinksHTML = [...navigationPages, ...actionItems]
      .map(
        (item) => `
      <div class="searchResultItem" data-type="${item.type}" data-url="${item.url}">
        <div class="searchResultImage searchResultIcon" style="background: ${item.color}">
          <img src="${item.icon}" alt="${item.name}">
        </div>
        <div class="searchResultInfo">
          <span class="searchResultName">${item.name}</span>
          <span class="searchResultMeta">${item.type === "action" ? "Action" : "Page"}</span>
        </div>
      </div>
    `,
      )
      .join("");

    contentHTML = `
      <div class="searchSection">
        <span class="searchSectionHeader">Quick Links</span>
        ${quickLinksHTML}
      </div>
    `;
  }

  dropdown.innerHTML = `
    <div class="searchDropdownHeader">
      <span class="searchIcon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 18 18" fill="none">
          <path d="M16.6 18L10.3 11.7C9.8 12.1 9.225 12.4167 8.575 12.65C7.925 12.8833 7.23333 13 6.5 13C4.68333 13 3.14583 12.3708 1.8875 11.1125C0.629167 9.85417 0 8.31667 0 6.5C0 4.68333 0.629167 3.14583 1.8875 1.8875C3.14583 0.629167 4.68333 0 6.5 0C8.31667 0 9.85417 0.629167 11.1125 1.8875C12.3708 3.14583 13 4.68333 13 6.5C13 7.23333 12.8833 7.925 12.65 8.575C12.4167 9.225 12.1 9.8 11.7 10.3L18 16.6L16.6 18ZM6.5 11C7.75 11 8.8125 10.5625 9.6875 9.6875C10.5625 8.8125 11 7.75 11 6.5C11 5.25 10.5625 4.1875 9.6875 3.3125C8.8125 2.4375 7.75 2 6.5 2C5.25 2 4.1875 2.4375 3.3125 3.3125C2.4375 4.1875 2 5.25 2 6.5C2 7.75 2.4375 8.8125 3.3125 9.6875C4.1875 10.5625 5.25 11 6.5 11Z" fill="#49454F"/>
        </svg>
      </span>
      <input type="text" class="searchInputLarge" id="searchInputLarge" placeholder="Search for anything..." autocomplete="off" value="${queryStr}">
    </div>
    <div class="searchDropdownContent">
      ${contentHTML}
    </div>
  `;

  // Focus the large input
  const largeInput = document.getElementById("searchInputLarge");
  if (largeInput) {
    largeInput.focus();
    const len = largeInput.value.length;
    largeInput.setSelectionRange(len, len);
    setupSearchInputListener();
  }

  // Bind click handlers
  bindSearchResultHandlers(dropdown);
}

function bindSearchResultHandlers(dropdown) {
  dropdown.querySelectorAll(".searchResultItem").forEach((item) => {
    item.addEventListener("click", () => {
      const type = item.dataset.type;

      if ((type === "page" || type === "action") && item.dataset.url) {
        window.location.href = item.dataset.url;
      } else if (type === "stall" && item.dataset.stallId) {
        window.location.href = `../Operator Children Detail/operatorChildrenDetail.html?id=${item.dataset.stallId}`;
      } else if (type === "transaction" && item.dataset.txnId) {
        window.location.href = `../Operator Transactions/operatorTransactions.html?txn=${item.dataset.txnId}`;
      }
    });

    item.addEventListener("mousemove", (e) => {
      const rect = item.getBoundingClientRect();
      item.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
      item.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    });
  });
}

// ============================================
// INPUT LISTENERS
// ============================================

function setupSearchInputListener() {
  const largeInput = document.getElementById("searchInputLarge");
  if (!largeInput) return;
  largeInput.removeEventListener("input", handleSearchInput);
  largeInput.addEventListener("input", handleSearchInput);
}

function handleSearchInput(e) {
  currentSearchQuery = e.target.value;
  renderSearchDropdown(currentSearchQuery);
}

// ============================================
// INITIALIZATION
// ============================================

function initOperatorSearch() {
  const searchInput = document.getElementById("searchInput");
  const wrapper = document.getElementById("searchModuleWrapper");
  const searchDropdown = document.getElementById("searchDropdown");

  if (!searchInput || !wrapper || !searchDropdown) return;

  // Inject shortcut styles if not already present
  if (!document.getElementById("operatorSearchShortcutStyles")) {
    const style = document.createElement("style");
    style.id = "operatorSearchShortcutStyles";
    style.textContent = `
      .searchModule {
        height: 48px;
        padding: 0px 16px 0px 20px;
        border-radius: 24px;
      }
      .searchInput {
        font-size: 16px;
      }
      .searchIcon {
        width: 40px;
        height: 40px;
      }
      .searchShortcut {
        display: flex;
        align-items: center;
        gap: 6px;
        pointer-events: none;
      }
      .searchKey {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
        padding: 0 8px;
        border-radius: 6px;
        background: #e8e4ec;
        box-shadow: 0 2px 0 #d0cad6;
        color: #49454f;
        font-family: Aptos, sans-serif;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  // Add keyboard shortcut hint
  const isMac = window.navigator.userAgentData
    ? window.navigator.userAgentData.platform === "macOS"
    : /Mac/i.test(window.navigator.userAgent);
  const searchModule = document.getElementById("searchModule");
  if (searchModule && !searchModule.querySelector(".searchShortcut")) {
    const shortcut = document.createElement("span");
    shortcut.className = "searchShortcut";
    shortcut.innerHTML = `<kbd class="searchKey">${isMac ? "\u2318" : "CTRL"}</kbd><kbd class="searchKey">K</kbd>`;
    searchModule.appendChild(shortcut);
  }

  searchInput.addEventListener("focus", () => {
    currentSearchQuery = searchInput.value;
    requestAnimationFrame(() => {
      wrapper.classList.add("active");
      renderSearchDropdown(currentSearchQuery);
      searchInput.value = "";
    });
  });

  searchInput.addEventListener("input", () => {
    if (wrapper.classList.contains("active")) {
      const largeInput = document.getElementById("searchInputLarge");
      if (largeInput) {
        largeInput.value = searchInput.value;
        currentSearchQuery = searchInput.value;
        searchInput.value = "";
        largeInput.focus();
        renderSearchDropdown(currentSearchQuery);
      }
    }
  });

  // Click on search module icon (for when input is hidden on mobile)
  if (searchModule) {
    searchModule.addEventListener("click", (e) => {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        currentSearchQuery = "";
        requestAnimationFrame(() => {
          wrapper.classList.add("active");
          renderSearchDropdown(currentSearchQuery);
        });
      }
    });
  }

  // Close on click outside
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target) && !searchDropdown.contains(e.target)) {
      wrapper.classList.remove("active");
      currentSearchQuery = "";
    }
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      wrapper.classList.remove("active");
      searchInput.blur();
      currentSearchQuery = "";
    }

    // Cmd/Ctrl + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      const targetTag = e.target.tagName.toLowerCase();
      if (
        targetTag === "input" ||
        targetTag === "textarea" ||
        e.target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      searchInput.focus();
    }
  });
}

// Auto-init on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  initOperatorSearch();

  // Resolve hawkerCentreId via auth + operator doc, then fetch data
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
      const operatorDoc = await getDoc(doc(db, "operators", user.uid));
      if (operatorDoc.exists()) {
        const hawkerCentreId = operatorDoc.data().hawkerCentreId;
        if (hawkerCentreId) {
          await fetchOperatorSearchData(hawkerCentreId);
        }
      }
    } catch (error) {
      console.error(
        "Error resolving operator hawkerCentreId for search:",
        error,
      );
    }
  });
});
