// ============================================
// Authority Inspection — Schedule Only
// ============================================

import { db, auth, app } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { initLiquidGlassToggle } from "../../assets/js/liquidGlassToggle.js";
import { initNotificationBadge } from "../../assets/js/notificationBadge.js";

// ============================================
// STATE
// ============================================

let allStalls = [];
let hawkerCentreMap = {};
let selectedStallId = null;
let currentUser = null;
let authorityData = null;
let gradingStallId = null;

// Navigation pages for search
const navigationPages = [
  {
    type: "page",
    name: "Home",
    keywords: "home dashboard overview main",
    icon: "../../assets/icons/home.svg",
    color: "#F6EEF9",
    url: "../Authority Dashboard/authorityDashboard.html",
  },
  {
    type: "page",
    name: "Schedule Inspection",
    keywords: "inspect schedule inspection check audit review",
    icon: "../../assets/icons/clock.svg",
    color: "#F2F5FC",
    url: "authorityInspection.html",
  },
];

// ============================================
// DATA LOADING
// ============================================

async function loadData() {
  const centresSnap = await getDocs(collection(db, "hawkerCentres"));
  centresSnap.docs.forEach((d) => {
    hawkerCentreMap[d.id] = d.data().name || "Unknown Centre";
  });

  const stallsSnap = await getDocs(collection(db, "foodStalls"));
  allStalls = stallsSnap.docs
    .map((d) => ({
      id: d.id,
      ...d.data(),
      centreName: hawkerCentreMap[d.data().hawkerCentreId] || "",
    }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
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

  const largeInput = document.getElementById("searchInputLarge");
  if (largeInput) {
    largeInput.focus();
    const len = largeInput.value.length;
    largeInput.setSelectionRange(len, len);
    setupSearchInputListener();
  }

  bindSearchResultHandlers(dropdown);
}

function bindSearchResultHandlers(dropdown) {
  dropdown.querySelectorAll(".searchResultItem").forEach((item) => {
    item.addEventListener("click", (e) => {
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

  // Schedule button — pre-selects stall in the form below
  dropdown.querySelectorAll(".scheduleBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const stallId = btn.dataset.stallId;
      selectedStallId = stallId;
      const stallSelect = document.getElementById("stallSelect");
      if (stallSelect) stallSelect.value = stallId;
      const wrapper = document.getElementById("searchModuleWrapper");
      if (wrapper) wrapper.classList.remove("active");
      currentSearchQuery = "";
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
// RENDER
// ============================================

function renderPage() {
  const container = document.getElementById("pageContent");

  // Pre-select stall from URL params
  const params = new URLSearchParams(window.location.search);
  const preselectedId = params.get("stallId");

  if (preselectedId) {
    selectedStallId = preselectedId;
  }

  // Today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  const stallOptionsHTML = allStalls
    .map(
      (s) =>
        `<option value="${s.id}" ${s.id === preselectedId ? "selected" : ""}>${s.name}${s.centreName ? ` — ${s.centreName}` : ""}</option>`,
    )
    .join("");

  container.innerHTML = `
    <div>
      <span class="sectionLabel">Schedule Inspection</span>
    </div>

    <div class="formGroup">
      <label class="formLabel">Select Stall</label>
      <select class="stallSelect" id="stallSelect">
        <option value="">-- Choose a stall --</option>
        ${stallOptionsHTML}
      </select>
    </div>

    <div class="formGroup">
      <label class="formLabel">Inspection Date</label>
      <input type="date" class="dateInput" id="inspectionDate" value="${today}" />
    </div>

    <div class="formGroup">
      <div class="toggleRow">
        <div class="toggleInfo">
          <span class="toggleLabel">Notify Operator (Parent)</span>
          <span class="toggleDesc">Send in-app notification to the hawker centre operator</span>
        </div>
        <label class="liquidGlassToggle">
          <input type="checkbox" id="notifyOperator" checked />
          <span class="toggleTrack">
            <span class="toggleThumb"></span>
          </span>
        </label>
      </div>

      <div class="toggleRow">
        <div class="toggleInfo">
          <span class="toggleLabel">Notify Vendor (Child)</span>
          <span class="toggleDesc">Send in-app notification to the stall owner</span>
        </div>
        <label class="liquidGlassToggle">
          <input type="checkbox" id="notifyVendor" checked />
          <span class="toggleTrack">
            <span class="toggleThumb"></span>
          </span>
        </label>
      </div>
    </div>

    <button class="submitButton" id="submitInspection">Schedule Inspection</button>
  `;

  // Init liquid glass toggles
  const toggles = container.querySelectorAll(".liquidGlassToggle");
  toggles.forEach((toggle) => initLiquidGlassToggle(toggle));

  // Stall select change
  document.getElementById("stallSelect").addEventListener("change", (e) => {
    selectedStallId = e.target.value || null;
  });

  // Submit inspection
  document
    .getElementById("submitInspection")
    .addEventListener("click", handleSubmit);
}

// ============================================
// SUBMIT
// ============================================

async function handleSubmit() {
  const stallId = selectedStallId;
  const dateInput = document.getElementById("inspectionDate");
  const notifyOp = document.getElementById("notifyOperator").checked;
  const notifyVendor = document.getElementById("notifyVendor").checked;
  const submitBtn = document.getElementById("submitInspection");

  if (!stallId) {
    alert("Please select a stall.");
    return;
  }

  if (!dateInput.value) {
    alert("Please select a date.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Scheduling...";

  try {
    const stall = allStalls.find((s) => s.id === stallId);
    const inspectionDate = new Date(dateInput.value);

    // 1. Create inspection record
    await addDoc(collection(db, "inspections"), {
      stallId,
      stallName: stall?.name || "",
      hawkerCentreId: stall?.hawkerCentreId || "",
      hawkerCentreName: stall?.centreName || "",
      authorityId: currentUser.uid,
      authorityName: authorityData?.displayName || "",
      inspectionDate: Timestamp.fromDate(inspectionDate),
      hygieneGrade: stall?.hygieneGrade || "",
      createdAt: serverTimestamp(),
    });

    // 2. Update stall's lastInspectionDate
    await updateDoc(doc(db, "foodStalls", stallId), {
      lastInspectionDate: Timestamp.fromDate(inspectionDate),
      updatedAt: serverTimestamp(),
    });

    // 3. Send notifications via Cloud Function
    const functions = getFunctions(app, "asia-southeast1");
    const notifyInspection = httpsCallable(functions, "notifyInspection");
    const dateStr = inspectionDate.toLocaleDateString("en-SG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    if (notifyOp && stall?.operatorId) {
      notifyInspection({
        targetId: stall.operatorId,
        targetType: "operator",
        stallName: stall.name,
        grade: stall.hygieneGrade || "N/A",
        inspectionDate: dateStr,
      }).catch(() => {});
    }

    if (notifyVendor && stall?.ownerId) {
      notifyInspection({
        targetId: stall.ownerId,
        targetType: "vendor",
        stallName: stall.name,
        grade: stall.hygieneGrade || "N/A",
        inspectionDate: dateStr,
      }).catch(() => {});
    }

    // 4. Show success
    const container = document.getElementById("pageContent");
    const successDiv = document.createElement("div");
    successDiv.className = "successMessage";
    successDiv.textContent = `Inspection scheduled for ${stall?.name || "stall"} on ${dateStr}.`;
    container.appendChild(successDiv);

    submitBtn.textContent = "Scheduled";

    // Redirect back to dashboard after 1.5s
    setTimeout(() => {
      window.location.href = "../Authority Dashboard/authorityDashboard.html";
    }, 1500);
  } catch (err) {
    console.error("Failed to schedule inspection:", err);
    submitBtn.disabled = false;
    submitBtn.textContent = "Schedule Inspection";
    alert("Failed to schedule inspection. Please try again.");
  }
}

// ============================================
// INIT
// ============================================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../Auth/login.html";
    return;
  }

  currentUser = user;

  const authorityDoc = await getDoc(doc(db, "authorities", user.uid));
  if (!authorityDoc.exists()) {
    window.location.href = "../Auth/login.html";
    return;
  }

  authorityData = authorityDoc.data();

  // Replace skeleton with real account content
  const accountEl = document.getElementById("authorityAccount");
  if (accountEl) {
    accountEl.classList.remove("skeleton");
    accountEl.innerHTML = `
      <img class="authorityIcon" src="../../assets/icons/authorities.svg" alt="Authority" />
      <span class="authorityName">${authorityData.displayName || "Authority"}</span>
    `;
  }

  // Notification badge
  initNotificationBadge(`authorities/${user.uid}/notifications`);

  // Load data and render
  const container = document.getElementById("pageContent");
  container.innerHTML = `<div class="emptyState">Loading...</div>`;

  try {
    await loadData();
    renderPage();
    initSearch();
    initGradeModal();
  } catch (err) {
    console.error("Failed to load inspection page:", err);
    container.innerHTML = `<div class="emptyState">Something went wrong loading the page.</div>`;
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
