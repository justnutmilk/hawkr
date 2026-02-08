import { db, auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initNotificationBadge } from "../../assets/js/notificationBadge.js";
import {
  initToastContainer,
  subscribeToNewNotifications,
} from "../../assets/js/toastNotifications.js";

const tagIcons = {
  Halal: "../../assets/icons/halal.png",
  Kosher: "../../assets/icons/kosher.svg",
};

let currentTab = "current";
let hygieneData = null;
let storeData = null;

// ============================================
// URL & DATA
// ============================================

function getStallIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id") || null;
}

function formatDate(timestamp) {
  if (!timestamp) return "Not available";
  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);
  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Singapore",
  });
}

async function fetchStallAndHygieneData(stallId) {
  if (!stallId) return { store: null, hygiene: null };

  const stallDoc = await getDoc(doc(db, "foodStalls", stallId));
  if (!stallDoc.exists()) return { store: null, hygiene: null };

  const data = stallDoc.data();

  const store = {
    name: data.name || "Unknown Stall",
    tags: data.cuisineNames || [],
  };

  const currentGrade = data.hygieneGrade || null;
  const currentUpdatedStr = formatDate(
    data.hygieneUpdatedAt || data.lastInspectionDate || data.updatedAt,
  );

  let archived = [];
  try {
    const historyQuery = query(
      collection(db, "foodStalls", stallId, "hygieneHistory"),
      orderBy("archivedAt", "desc"),
    );
    const historySnap = await getDocs(historyQuery);
    archived = historySnap.docs.map((d) => {
      const hData = d.data();
      return {
        grade: hData.grade || "--",
        updated: formatDate(hData.updatedAt),
        activeTill: hData.activeTill || "Unknown",
      };
    });
  } catch (err) {
    console.error("Error fetching hygiene history:", err);
  }

  const hygiene = {
    current: currentGrade
      ? { grade: currentGrade, updated: currentUpdatedStr }
      : null,
    archived,
  };

  return { store, hygiene };
}

// ============================================
// RENDER
// ============================================

function renderTag(tag) {
  const icon = tagIcons[tag];
  if (icon) {
    return `<span class="storeTag ${tag.toLowerCase()}"><img class="storeTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="storeTag">${tag}</span>`;
}

function renderCurrentGrade() {
  const data = hygieneData?.current;
  if (!data) {
    return `<div class="hygieneEmpty">No hygiene grade on record.</div>`;
  }
  return `
    <div class="hygieneCurrentCard">
      <span class="hygieneGradeLetter">${data.grade}</span>
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
        .map(
          (item) => `
        <div class="hygieneArchiveCard">
          <span class="hygieneArchiveGrade">${item.grade}</span>
          <div class="hygieneArchiveInfo">
            <span class="hygieneArchiveDate">Updated ${item.updated}</span>
            <span class="hygieneArchiveActive">Active till ${item.activeTill}</span>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderContent() {
  const container = document.getElementById("hygieneContent");
  if (!container) return;
  container.innerHTML =
    currentTab === "current" ? renderCurrentGrade() : renderArchivedGrades();
}

function renderPage() {
  const store = storeData;
  if (!store) {
    document.getElementById("pageContent").innerHTML =
      `<div class="hygieneEmpty">Stall not found.</div>`;
    return;
  }

  const tags = store.tags.map(renderTag).join("");

  document.getElementById("pageContent").innerHTML = `
    <div class="storeHeader">
      <div class="storeHeaderTop">
        <div class="storeHeaderInfo">
          <span class="storePerusing">Now Perusing</span>
          <span class="storeName">${store.name}</span>
        </div>
        <div class="storeTags">${tags}</div>
      </div>
    </div>

    <div class="hygieneSection">
      <div class="hygieneHeader">
        <span class="hygieneTitle">Hygiene Grade</span>
        <div class="segmentedControl hygieneSegmented">
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
      <div class="hygieneMicrocopy">Hygiene grades are verified and can only be updated by the authorities.</div>
      <div id="hygieneContent"></div>
    </div>
  `;

  renderContent();

  document.querySelectorAll('input[name="hygieneTab"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      currentTab = e.target.value;
      renderContent();
    });
  });
}

// ============================================
// INIT
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "../Auth/login.html";
      return;
    }

    initNotificationBadge(`operators/${user.uid}/notifications`);
    initToastContainer();
    subscribeToNewNotifications(`operators/${user.uid}/notifications`);

    const operatorDoc = await getDoc(doc(db, "operators", user.uid));
    if (!operatorDoc.exists() || !operatorDoc.data().onboardingComplete) {
      window.location.href = "../Auth/onboarding-operator.html";
      return;
    }

    const stallId = getStallIdFromUrl();
    if (!stallId) {
      document.getElementById("pageContent").innerHTML =
        `<div class="hygieneEmpty">No stall specified.</div>`;
      return;
    }

    try {
      const { store, hygiene } = await fetchStallAndHygieneData(stallId);
      storeData = store;
      hygieneData = hygiene;
      renderPage();
    } catch (err) {
      console.error("Failed to load hygiene data:", err);
      document.getElementById("pageContent").innerHTML =
        `<div class="hygieneEmpty">Something went wrong.</div>`;
    }
  });
});
