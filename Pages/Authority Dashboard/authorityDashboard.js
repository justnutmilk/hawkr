// ============================================
// Authority Dashboard — Firebase-powered
// ============================================

import { db, auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initNotificationBadge } from "../../assets/js/notificationBadge.js";

// ============================================
// STATE
// ============================================

let allStalls = [];
let hawkerCentreMap = {};
let scheduledStallIds = new Set();
let gradingStallId = null;
let currentFilter = "attention"; // "attention" or "scheduled"

// Navigation pages for search
const navigationPages = [
  {
    type: "page",
    name: "Home",
    keywords: "home dashboard overview main",
    icon: "../../assets/icons/home.svg",
    color: "#F6EEF9",
    url: "authorityDashboard.html",
  },
  {
    type: "page",
    name: "Schedule Inspection",
    keywords: "inspect schedule inspection check audit review",
    icon: "../../assets/icons/clock.svg",
    color: "#F2F5FC",
    url: "../Authority Inspection/authorityInspection.html",
  },
];

// ============================================
// DATA LOADING
// ============================================

async function loadData() {
  const [centresSnap, stallsSnap, inspectionsSnap] = await Promise.all([
    getDocs(collection(db, "hawkerCentres")),
    getDocs(collection(db, "foodStalls")),
    getDocs(
      query(
        collection(db, "inspections"),
        where("inspectionDate", ">=", Timestamp.fromDate(new Date())),
      ),
    ),
  ]);

  centresSnap.docs.forEach((d) => {
    hawkerCentreMap[d.id] = d.data().name || "Unknown Centre";
  });

  allStalls = stallsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    centreName: hawkerCentreMap[d.data().hawkerCentreId] || "",
  }));

  scheduledStallIds = new Set(
    inspectionsSnap.docs.map((d) => d.data().stallId),
  );
}

// ============================================
// SEARCH (Liquid Glass pattern)
// ============================================

let currentSearchQuery = "";

function searchStalls(q) {
  if (!q || q.trim() === "") return [];
  const term = q.toLowerCase().trim();
  return allStalls.filter((s) => {
    const text = `${s.name || ""} ${s.centreName || ""}`.toLowerCase();
    return text.includes(term);
  });
}

function searchNavPages(q) {
  if (!q || q.trim() === "") return [];
  const term = q.toLowerCase().trim();
  return navigationPages.filter((p) => {
    const text = `${p.name} ${p.keywords}`.toLowerCase();
    return text.includes(term);
  });
}

function renderSearchDropdown(query = "") {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  let contentHTML = "";

  if (query && query.trim() !== "") {
    const pageResults = searchNavPages(query);
    const stallResults = searchStalls(query);

    if (pageResults.length === 0 && stallResults.length === 0) {
      contentHTML = `
        <div class="searchSection">
          <span class="searchSectionHeader">Search Results</span>
          <span class="searchEmptyState">No results found for "${query}"</span>
        </div>
      `;
    } else {
      let resultsHTML = "";

      // Navigation pages
      resultsHTML += pageResults
        .map(
          (page) => `
        <div class="searchResultItem" data-type="page" data-url="${page.url}">
          <div class="searchResultImage searchResultIcon" style="background: ${page.color}">
            <img src="${page.icon}" alt="${page.name}">
          </div>
          <div class="searchResultInfo">
            <span class="searchResultName">${page.name}</span>
            <span class="searchResultMeta">Page</span>
          </div>
        </div>
      `,
        )
        .join("");

      // Stall results
      resultsHTML += stallResults
        .slice(0, 10)
        .map(
          (stall) => `
        <div class="searchResultItem" data-type="stall" data-stall-id="${stall.id}">
          <div class="searchResultImage">
            <img src="${stall.imageUrl || "../../images/squirrelCard.svg"}" alt="${stall.name || ""}" onerror="this.style.display='none'">
          </div>
          <div class="searchResultInfo">
            <span class="searchResultName">${stall.name || "Unnamed Stall"}</span>
            <span class="searchResultMeta">${stall.centreName}</span>
          </div>
          <div class="searchResultActions">
            <button class="searchActionBtn scheduleBtn" data-stall-id="${stall.id}">Schedule</button>
            <button class="searchActionBtn gradeBtn" data-stall-id="${stall.id}">Grade</button>
          </div>
        </div>
      `,
        )
        .join("");

      contentHTML = `
        <div class="searchSection">
          <span class="searchSectionHeader">Search Results</span>
          ${resultsHTML}
        </div>
      `;
    }
  } else {
    contentHTML = `
      <div class="searchSection">
        <span class="searchSectionHeader">Quick Links</span>
        ${navigationPages
          .map(
            (page) => `
          <div class="searchResultItem" data-type="page" data-url="${page.url}">
            <div class="searchResultImage searchResultIcon" style="background: ${page.color}">
              <img src="${page.icon}" alt="${page.name}">
            </div>
            <div class="searchResultInfo">
              <span class="searchResultName">${page.name}</span>
              <span class="searchResultMeta">Page</span>
            </div>
          </div>
        `,
          )
          .join("")}
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
      <input type="text" class="searchInputLarge" id="searchInputLarge" placeholder="Search..." autocomplete="off" value="${query}">
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

  // Bind result click handlers
  bindSearchResultHandlers(dropdown);
}

function bindSearchResultHandlers(dropdown) {
  dropdown.querySelectorAll(".searchResultItem").forEach((item) => {
    item.addEventListener("click", (e) => {
      // Don't navigate if clicking a button inside the item
      if (e.target.closest(".searchActionBtn")) return;
      const type = item.dataset.type;
      const url = item.dataset.url;
      if (type === "page" && url) {
        window.location.href = url;
      }
    });

    item.addEventListener("mousemove", (e) => {
      const rect = item.getBoundingClientRect();
      item.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
      item.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    });
  });

  dropdown.querySelectorAll(".scheduleBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `../Authority Inspection/authorityInspection.html?stallId=${btn.dataset.stallId}`;
    });
  });

  dropdown.querySelectorAll(".gradeBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openGradeModal(btn.dataset.stallId);
    });
  });
}

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

function initSearch() {
  const searchInput = document.getElementById("searchInput");
  const wrapper = document.getElementById("searchModuleWrapper");

  if (!searchInput || !wrapper) return;

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

  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("searchDropdown");
    if (!wrapper.contains(e.target) && !dropdown.contains(e.target)) {
      wrapper.classList.remove("active");
      currentSearchQuery = "";
    }
  });
}

// ============================================
// GRADE MODAL
// ============================================

function openGradeModal(stallId) {
  gradingStallId = stallId;
  const stall = allStalls.find((s) => s.id === stallId);
  const overlay = document.getElementById("gradeModalOverlay");
  const title = document.getElementById("gradeModalTitle");
  const cards = document.querySelectorAll("#gradeCards .gradeCard");

  title.textContent = `Grade: ${stall?.name || "Stall"}`;

  // Highlight current grade
  const currentGrade = stall?.hygieneGrade || null;
  cards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.grade === currentGrade);
  });

  // Clear toast
  const toast = document.getElementById("gradeToast");
  toast.textContent = "";
  toast.classList.remove("visible");

  overlay.classList.add("active");
}

function closeGradeModal() {
  gradingStallId = null;
  document.getElementById("gradeModalOverlay").classList.remove("active");
}

function initGradeModal() {
  const overlay = document.getElementById("gradeModalOverlay");
  const closeBtn = document.getElementById("gradeModalClose");
  const gradeCards = document.getElementById("gradeCards");

  closeBtn.addEventListener("click", closeGradeModal);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeGradeModal();
  });

  gradeCards.addEventListener("click", async (e) => {
    const card = e.target.closest(".gradeCard");
    if (!card || !gradingStallId) return;

    const newGrade = card.dataset.grade;
    const stall = allStalls.find((s) => s.id === gradingStallId);
    const oldGrade = stall?.hygieneGrade || null;

    // Highlight selected
    document.querySelectorAll("#gradeCards .gradeCard").forEach((c) => {
      c.classList.toggle("selected", c.dataset.grade === newGrade);
    });

    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-SG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      // 1. If there's an existing grade, archive it to hygieneHistory subcollection
      if (oldGrade) {
        const oldUpdatedAt = stall?.hygieneUpdatedAt;
        const oldDateStr = oldUpdatedAt
          ? (typeof oldUpdatedAt.toDate === "function"
              ? oldUpdatedAt.toDate()
              : new Date(oldUpdatedAt)
            ).toLocaleDateString("en-SG", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Unknown";

        await addDoc(
          collection(db, "foodStalls", gradingStallId, "hygieneHistory"),
          {
            grade: oldGrade,
            updatedAt: oldUpdatedAt || null,
            activeTill: dateStr,
            archivedAt: serverTimestamp(),
          },
        );
      }

      // 2. Update the stall's current grade, hygieneUpdatedAt, and lastInspectionDate
      await updateDoc(doc(db, "foodStalls", gradingStallId), {
        hygieneGrade: newGrade,
        hygieneUpdatedAt: serverTimestamp(),
        lastInspectionDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update local state
      if (stall) {
        stall.hygieneGrade = newGrade;
        stall.hygieneUpdatedAt = new Date();
        stall.lastInspectionDate = new Date();
      }

      // Show toast
      const toast = document.getElementById("gradeToast");
      toast.textContent = `Grade updated to ${newGrade}`;
      toast.classList.add("visible");

      // Re-render dashboard cards to reflect new grade
      renderDashboard();

      // Close modal after brief delay
      setTimeout(() => {
        closeGradeModal();
      }, 1000);
    } catch (err) {
      console.error("Failed to update grade:", err);
      const toast = document.getElementById("gradeToast");
      toast.textContent = "Failed to update grade";
      toast.style.color = "#d32f2f";
      toast.classList.add("visible");
    }
  });
}

// ============================================
// HELPERS
// ============================================

function daysSinceInspection(stall) {
  if (!stall.lastInspectionDate) return null;
  const inspDate =
    typeof stall.lastInspectionDate.toDate === "function"
      ? stall.lastInspectionDate.toDate()
      : new Date(stall.lastInspectionDate);
  if (isNaN(inspDate.getTime())) return null;
  const now = new Date();
  const days = Math.floor((now - inspDate) / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  return days;
}

function getGradeClass(grade) {
  if (!grade) return "grade-none";
  return `grade-${grade}`;
}

// ============================================
// RENDER
// ============================================

function renderDashboard() {
  const container = document.getElementById("dashboardContent");

  // Filter stalls based on current tab
  let filtered;
  if (currentFilter === "scheduled") {
    filtered = allStalls.filter((s) => scheduledStallIds.has(s.id));
  } else {
    // "attention" — never inspected, or >180 days, and not already scheduled
    filtered = allStalls.filter((s) => {
      const days = daysSinceInspection(s);
      return (days === null || days > 180) && !scheduledStallIds.has(s.id);
    });
  }

  // Sort: never inspected first, then by days since inspection (descending)
  filtered.sort((a, b) => {
    const daysA = daysSinceInspection(a);
    const daysB = daysSinceInspection(b);
    if (daysA === null && daysB === null)
      return (a.name || "").localeCompare(b.name || "");
    if (daysA === null) return -1;
    if (daysB === null) return 1;
    return daysB - daysA;
  });

  const emptyMsg =
    currentFilter === "scheduled"
      ? "No scheduled inspections."
      : "All stalls are up to date.";

  const cardsHTML =
    filtered.length === 0
      ? `<div class="emptyState">${emptyMsg}</div>`
      : filtered
          .map((stall) => {
            const days = daysSinceInspection(stall);
            const grade = stall.hygieneGrade || null;
            const gradeDisplay = grade || "--";
            const gradeClass = getGradeClass(grade);

            let daysText, daysClass;
            if (days === null) {
              daysText = "Never inspected";
              daysClass = "overdue";
            } else {
              daysText = `${days} day${days !== 1 ? "s" : ""} ago`;
              daysClass = days > 180 ? "overdue" : "";
            }

            return `
              <div class="inspectionCard">
                <div class="inspectionCardLeft">
                  <img class="inspectionStallImage" src="${stall.imageUrl || "../../images/squirrelCard.svg"}" alt="${stall.name || ""}" />
                  <div class="inspectionStallInfo">
                    <span class="inspectionStallName">${stall.name || "Unnamed Stall"}</span>
                    <span class="inspectionCentreName">${stall.centreName}</span>
                  </div>
                </div>
                <div class="inspectionCardRight">
                  <span class="inspectionGradeBadge ${gradeClass}">${gradeDisplay}</span>
                  <div class="inspectionDays">
                    <span class="inspectionDaysCount ${daysClass}">${daysText}</span>
                    <span class="inspectionDaysLabel">Last inspection</span>
                  </div>
                  <button class="scheduleButton" onclick="window.location.href='../Authority Inspection/authorityInspection.html?stallId=${stall.id}'">Schedule</button>
                </div>
              </div>
            `;
          })
          .join("");

  container.innerHTML = `
    <div class="dashboardHeader">
      <span class="sectionLabel">Stall Inspections</span>
      <div class="segmentedControl">
        <label class="segmentedButton">
          <input type="radio" name="inspectionFilter" value="attention" ${currentFilter === "attention" ? "checked" : ""} />
          Requires Attention
        </label>
        <label class="segmentedButton">
          <input type="radio" name="inspectionFilter" value="scheduled" ${currentFilter === "scheduled" ? "checked" : ""} />
          Scheduled
        </label>
      </div>
    </div>
    <div class="inspectionGrid">
      ${cardsHTML}
    </div>
  `;

  // Tab change listeners + Safari fallback
  const segControl = container.querySelector(".segmentedControl");
  container
    .querySelectorAll('input[name="inspectionFilter"]')
    .forEach((input, index) => {
      if (input.checked && segControl) {
        segControl.style.setProperty("--active-index", index);
      }
      input.addEventListener("change", (e) => {
        currentFilter = e.target.value;
        if (segControl) {
          const allInputs = container.querySelectorAll(
            'input[name="inspectionFilter"]',
          );
          allInputs.forEach((inp, i) => {
            if (inp.checked) segControl.style.setProperty("--active-index", i);
          });
        }
        renderDashboard();
      });
    });
}

// ============================================
// INIT
// ============================================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../Auth/login.html";
    return;
  }

  const authorityDoc = await getDoc(doc(db, "authorities", user.uid));
  if (!authorityDoc.exists()) {
    window.location.href = "../Auth/login.html";
    return;
  }

  // Replace skeleton with real account content
  const accountEl = document.getElementById("authorityAccount");
  if (accountEl) {
    accountEl.classList.remove("skeleton");
    accountEl.innerHTML = `
      <img class="authorityIcon" src="../../assets/icons/authorities.svg" alt="Authority" />
      <span class="authorityName">${authorityDoc.data().displayName || "Authority"}</span>
    `;
  }

  // Notification badge
  initNotificationBadge(`authorities/${user.uid}/notifications`);

  // Load data and render
  const container = document.getElementById("dashboardContent");
  container.innerHTML = `<div class="emptyState">Loading...</div>`;

  try {
    await loadData();
    renderDashboard();
    initSearch();
    initGradeModal();
  } catch (err) {
    console.error("Failed to load authority dashboard:", err);
    container.innerHTML = `<div class="emptyState">Something went wrong loading the dashboard.</div>`;
  }
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    document.getElementById("searchInput")?.focus();
  }
  if (e.key === "Escape") {
    const wrapper = document.getElementById("searchModuleWrapper");
    if (wrapper) wrapper.classList.remove("active");
    currentSearchQuery = "";
    closeGradeModal();
  }
});
