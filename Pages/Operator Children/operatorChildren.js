/**
 * Hawkr - Operator Children (My Stalls)
 * Firebase-powered dynamic version.
 * Fetches operator's hawker centre(s) and their stalls from Firestore.
 * Provides an onboarding flow with 30-second rotating codes.
 */

// ============================================
// FIREBASE IMPORTS
// ============================================

import { db, auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getHawkerCentresByOperator,
  getHawkerCentreById,
  findOrCreateHawkerCentre,
} from "../../firebase/services/hawkerCentres.js";
import { getStallsByHawkerCentre } from "../../firebase/services/foodStalls.js";
import { showToast } from "../../assets/js/toast.js";

// ============================================
// STATE
// ============================================

let currentOperatorId = null;
let currentHawkerCentre = null; // { id, name, ... }
let stalls = []; // Active stalls fetched from Firestore
let archivedStalls = []; // Inactive stalls
let currentOnboardCode = "";
let codeRefreshInterval = null;
let codeSnapshotUnsubscribe = null;
let stallsUnsubscribe = null;
let linkedVendorData = null;
let autofillAnimationRunning = false;
let autofillTimeouts = [];

// ============================================
// AUTOFILL ANIMATION UTILITIES
// ============================================

function autofillDelay(ms) {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    autofillTimeouts.push(id);
  });
}

function typeIntoInput(inputId, text, charDelay = 28) {
  return new Promise((resolve) => {
    const input = document.getElementById(inputId);
    if (!input || !text) {
      if (input) input.value = text || "";
      resolve();
      return;
    }
    input.value = "";
    input.classList.add("autofill-active");
    let index = 0;

    function typeNext() {
      if (index < text.length) {
        input.value = text.substring(0, index + 1);
        index++;
        const id = setTimeout(typeNext, charDelay);
        autofillTimeouts.push(id);
      } else {
        input.classList.remove("autofill-active");
        resolve();
      }
    }
    typeNext();
  });
}

function fadeInElement(element, duration = 400) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }
    element.style.opacity = "0";
    element.style.transform = "translateY(8px)";
    element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
    element.offsetHeight; // force reflow
    element.style.opacity = "1";
    element.style.transform = "translateY(0)";
    const id = setTimeout(() => {
      element.style.transition = "";
      element.style.transform = "";
      resolve();
    }, duration);
    autofillTimeouts.push(id);
  });
}

function fadeInCuisineTags(delay = 120) {
  return new Promise((resolve) => {
    const container = document.getElementById("onboardCuisineContainer");
    if (!container) {
      resolve();
      return;
    }
    const tags = container.querySelectorAll(".onboardCuisineTag");
    if (!tags.length) {
      resolve();
      return;
    }
    let i = 0;
    function showNext() {
      if (i < tags.length) {
        tags[i].style.opacity = "1";
        tags[i].style.transform = "scale(1)";
        i++;
        const id = setTimeout(showNext, delay);
        autofillTimeouts.push(id);
      } else {
        resolve();
      }
    }
    showNext();
  });
}

// ============================================
// TIME / HOURS FORMATTING UTILITIES
// ============================================

/**
 * Converts 24h time string (e.g. "14:30") to 12h format (e.g. "2:30 PM")
 */
function formatTime12h(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

/**
 * Formats an array of time slots into a comma-separated string
 */
function formatSlots(slots) {
  return slots
    .map((s) => `${formatTime12h(s.from)}-${formatTime12h(s.to)}`)
    .join(", ");
}

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Collapses an array of day names into ranges (e.g. ["Mon","Tue","Wed","Fri"] -> "Mon-Wed, Fri")
 */
function formatDayRange(days) {
  const indices = days.map((d) => dayNames.indexOf(d));
  const ranges = [];
  let start = indices[0];
  let prev = indices[0];
  for (let i = 1; i <= indices.length; i++) {
    if (i < indices.length && indices[i] === prev + 1) {
      prev = indices[i];
    } else {
      if (prev - start >= 2) {
        ranges.push(`${dayNames[start]}-${dayNames[prev]}`);
      } else if (prev - start === 1) {
        ranges.push(`${dayNames[start]}, ${dayNames[prev]}`);
      } else {
        ranges.push(dayNames[start]);
      }
      if (i < indices.length) {
        start = indices[i];
        prev = indices[i];
      }
    }
  }
  return ranges.join(", ");
}

/**
 * Groups days by their hours and formats into multi-line summary string.
 * Accepts both array format (from vendor onboarding) and object format (from Firestore stalls).
 */
function formatOperatingHours(hours) {
  if (!hours) return "Hours not set";

  // If hours is an object (Firestore format: { monday: { open, close, isClosed }, ... })
  if (!Array.isArray(hours)) {
    return formatOperatingHoursObject(hours);
  }

  // Array format: [{ day, active, slots: [{ from, to }] }, ...]
  const groups = {};
  const dayOrder = [];
  hours.forEach((d) => {
    const key = d.active ? formatSlots(d.slots) : "Closed";
    if (!groups[key]) {
      groups[key] = [];
      dayOrder.push(key);
    }
    groups[key].push(d.day);
  });
  const sorted = dayOrder.filter((k) => k !== "Closed");
  const hasClosed = dayOrder.includes("Closed");
  if (hasClosed) sorted.push("Closed");
  return sorted
    .map((key) => `${formatDayRange(groups[key])}: ${key}`)
    .join("\n");
}

/**
 * Format operating hours from Firestore object format.
 */
function formatOperatingHoursObject(hours) {
  const dayMap = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  };
  const orderedKeys = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const groups = {};
  const dayOrder = [];

  orderedKeys.forEach((dayKey) => {
    const h = hours[dayKey];
    if (!h) return;
    const key = h.isClosed
      ? "Closed"
      : `${formatTime12h(h.open)}-${formatTime12h(h.close)}`;
    if (!groups[key]) {
      groups[key] = [];
      dayOrder.push(key);
    }
    groups[key].push(dayMap[dayKey]);
  });

  const sorted = dayOrder.filter((k) => k !== "Closed");
  const hasClosed = dayOrder.includes("Closed");
  if (hasClosed) sorted.push("Closed");
  return sorted
    .map((key) => `${formatDayRange(groups[key])}: ${key}`)
    .join("\n");
}

// ============================================
// ICONS
// ============================================

const tagIcons = {
  Halal: "../../assets/icons/halal.png",
  Kosher: "../../assets/icons/kosher.svg",
};

const starIcon = `<img class="childCardMetaIcon" src="../../assets/icons/star.svg" alt="Rating" />`;
const clockIcon = `<img class="childCardMetaIcon" src="../../assets/icons/clock.svg" alt="Hours" />`;

const loadingIcon = `<svg class="onboardWaitingIcon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none">
  <path d="M7.1825 0.682617V3.28262M7.1825 11.0826V13.6826M2.58699 2.58712L4.4265 4.42662M9.93849 9.93862L11.778 11.7781M0.682495 7.18262H3.2825M11.0825 7.18262H13.6825M2.58699 11.7781L4.4265 9.93862M9.93849 4.42662L11.778 2.58712" stroke="#808080" stroke-width="1.365" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const tickIcon = `<svg class="onboardFileBadgeIcon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">
  <path d="M20 6L9 17L4 12" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const uploadIcon = `<svg class="onboardUploadIcon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 650 650" fill="none">
  <path d="M343.45 8.13067C338.713 2.95067 332.02 0 325 0C317.98 0 311.287 2.95067 306.55 8.13067L173.216 153.964C163.899 164.154 164.607 179.967 174.797 189.284C184.988 198.601 200.801 197.893 210.117 187.703L300 89.3933V458.333C300 472.14 311.193 483.333 325 483.333C338.807 483.333 350 472.14 350 458.333V89.3933L439.883 187.703C449.2 197.893 465.013 198.601 475.203 189.284C485.393 179.967 486.1 164.154 476.783 153.964L343.45 8.13067Z" fill="#808080"/>
  <path d="M50 425C50 411.193 38.8074 400 25 400C11.193 400 1.74651e-05 411.193 1.74651e-05 425V426.83C-0.000649201 472.417 -0.00131822 509.16 3.88401 538.06C7.91801 568.063 16.5477 593.323 36.6117 613.387C56.6757 633.453 81.938 642.083 111.942 646.117C140.841 650 177.585 650 223.171 650H426.83C472.417 650 509.16 650 538.06 646.117C568.063 642.083 593.323 633.453 613.39 613.387C633.453 593.323 642.083 568.063 646.117 538.06C650 509.16 650 472.417 650 426.83V425C650 411.193 638.807 400 625 400C611.193 400 600 411.193 600 425C600 472.847 599.947 506.217 596.563 531.397C593.273 555.857 587.26 568.807 578.033 578.033C568.807 587.26 555.857 593.273 531.397 596.563C506.217 599.947 472.847 600 425 600H225C177.153 600 143.782 599.947 118.604 596.563C94.145 593.273 81.1923 587.26 71.967 578.033C62.7417 568.807 56.7267 555.857 53.4383 531.397C50.053 506.217 50 472.847 50 425Z" fill="#808080"/>
</svg>`;

// ============================================
// TAG RENDERING
// ============================================

function renderTag(tag) {
  const icon = tagIcons[tag];
  if (icon) {
    return `<span class="childTag ${tag.toLowerCase()}"><img class="childTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="childTag">${tag}</span>`;
}

function renderOnboardTag(tag) {
  const icon = tagIcons[tag];
  if (icon) {
    return `<span class="childTag ${tag.toLowerCase()}"><img class="childTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="childTag">${tag}</span>`;
}

// ============================================
// STALL CARD RENDERING
// ============================================

function renderHoursLines(hours) {
  return formatOperatingHours(hours)
    .split("\n")
    .map((line) => `<span class="childCardHoursLine">${line}</span>`)
    .join("");
}

function renderChildCard(stall) {
  const cuisines = stall.cuisineNames || stall.tags || [];
  const tags = cuisines.map(renderTag).join("");
  const rating = stall.rating || 0;
  const image =
    stall.imageUrl || stall.image || "../../images/squirrelCard.svg";
  const stallId = stall.id || "";
  const stallName = stall.name || "Unnamed Stall";

  return `
    <button class="childCard" onclick="window.location.href='../Operator Children Detail/operatorChildrenDetail.html?id=${encodeURIComponent(stallId)}&store=${encodeURIComponent(stallName)}'">
      <img class="childCardImage" src="${image}" alt="${stallName}" onerror="this.src='../../images/squirrelCard.svg'" />
      <span class="childCardName">${stallName}</span>
      <div class="childCardTags">
        ${tags}
        <span class="ownerBadge">Owner</span>
      </div>
      <div class="childCardMeta">
        <span class="childCardMetaItem">${starIcon} ${rating.toFixed ? rating.toFixed(1) : rating}</span>
      </div>
      <div class="childCardHours">
        ${clockIcon}
        <div class="childCardHoursLines">${renderHoursLines(stall.operatingHours)}</div>
      </div>
    </button>
  `;
}

// ============================================
// PAGE RENDERING
// ============================================

function renderCurrentContent() {
  const stallCards =
    stalls.length > 0
      ? stalls.map(renderChildCard).join("")
      : `<div class="emptyState">
          <img src="../../images/noChildren.svg" alt="No children" class="emptyStateImage" onerror="this.style.display='none'" />
          <p class="emptyStateText">No children yet</p>
          <p class="emptyStateSubtext">Onboard your first vendor to get started.</p>
          <button class="emptyStateCta" id="emptyOnboardBtn">Onboard child</button>
        </div>`;

  return `
    <div class="pageHeader">
      <span class="pageTitle">My Children</span>
      <button class="onboardButton" id="onboardBtn">
        Onboard child
        <kbd id="onboardKeyMod"></kbd>
        <kbd>O</kbd>
      </button>
    </div>
    <div class="childrenGrid">
      ${stallCards}
    </div>
  `;
}

function renderArchivedContent() {
  const stallCards =
    archivedStalls.length > 0
      ? archivedStalls.map(renderChildCard).join("")
      : `<div class="emptyState">
          <p class="emptyStateText">No archived stalls.</p>
        </div>`;

  return `
    <div class="pageHeader">
      <span class="pageTitle">My Children</span>
      <button class="onboardButton" id="onboardBtn">
        Onboard child
        <kbd id="onboardKeyMod"></kbd>
        <kbd>O</kbd>
      </button>
    </div>
    <div class="childrenGrid">
      ${stallCards}
    </div>
  `;
}

function renderPage(tab) {
  const container = document.getElementById("pageContent");
  container.innerHTML =
    tab === "archived" ? renderArchivedContent() : renderCurrentContent();

  const isMacLocal = window.navigator.userAgentData
    ? window.navigator.userAgentData.platform === "macOS"
    : /Mac/i.test(window.navigator.userAgent);
  const modKey = document.getElementById("onboardKeyMod");
  if (modKey) {
    modKey.textContent = isMacLocal ? "\u2318" : "CTRL";
  }
  const onboardBtn = document.getElementById("onboardBtn");
  if (onboardBtn) {
    onboardBtn.addEventListener("click", openOnboardPanel);
  }
  const emptyOnboardBtn = document.getElementById("emptyOnboardBtn");
  if (emptyOnboardBtn) {
    emptyOnboardBtn.addEventListener("click", openOnboardPanel);
  }
}

// ============================================
// DATA FETCHING
// ============================================

async function loadOperatorData(userId) {
  try {
    currentOperatorId = userId;

    // Fetch operator's hawker centres
    let centres = await getHawkerCentresByOperator(userId);

    // Fallback: if no hawker centre has operatorId set, look up via operator doc
    if (!centres || centres.length === 0) {
      console.warn(
        "No hawker centres found via operatorId, trying fallback...",
      );
      const operatorDoc = await getDoc(doc(db, "operators", userId));
      if (operatorDoc.exists()) {
        const opData = operatorDoc.data();

        // Try hawkerCentreId first
        if (opData.hawkerCentreId) {
          const centre = await getHawkerCentreById(opData.hawkerCentreId);
          if (centre) {
            // Backfill operatorId on the hawker centre
            await updateDoc(doc(db, "hawkerCentres", centre.id), {
              operatorId: userId,
              updatedAt: serverTimestamp(),
            });
            centres = [centre];
          }
        }

        // Try managedLocation name as last resort
        if (
          (!centres || centres.length === 0) &&
          opData.managedLocation?.name
        ) {
          const centre = await findOrCreateHawkerCentre(
            opData.managedLocation.name,
            {
              address: opData.managedLocation.address || "",
              postalCode: opData.managedLocation.postalCode || "",
              placeId: opData.managedLocation.placeId || "",
              location: opData.managedLocation.latitude
                ? {
                    latitude: opData.managedLocation.latitude,
                    longitude: opData.managedLocation.longitude,
                  }
                : null,
            },
          );
          // Set operatorId on the hawker centre
          await updateDoc(doc(db, "hawkerCentres", centre.id), {
            operatorId: userId,
            updatedAt: serverTimestamp(),
          });
          // Also save hawkerCentreId on operator doc for future lookups
          await updateDoc(doc(db, "operators", userId), {
            hawkerCentreId: centre.id,
            updatedAt: serverTimestamp(),
          });
          centres = [centre];
        }
      }
    }

    if (!centres || centres.length === 0) {
      console.warn("No hawker centres found for operator:", userId);
      stalls = [];
      archivedStalls = [];
      renderPage("current");
      return;
    }

    // Use the first hawker centre (operator typically manages one)
    currentHawkerCentre = centres[0];

    // Update sidebar with actual centre name
    const operatorNameEl = document.querySelector(".operatorName");
    if (operatorNameEl) {
      operatorNameEl.textContent = currentHawkerCentre.name || "My Centre";
    }

    // Realtime listener on all stalls for this centre
    listenToStalls(currentHawkerCentre.id);
  } catch (error) {
    console.error("Error loading operator data:", error);
    stalls = [];
    archivedStalls = [];
    renderPage("current");
  }
}

/**
 * Realtime listener on foodStalls — updates grid when vendors link/unlink
 */
function listenToStalls(centreId) {
  // Clean up previous listener
  if (stallsUnsubscribe) {
    stallsUnsubscribe();
    stallsUnsubscribe = null;
  }

  const stallsQuery = query(
    collection(db, "foodStalls"),
    where("hawkerCentreId", "==", centreId),
  );

  stallsUnsubscribe = onSnapshot(
    stallsQuery,
    (snapshot) => {
      const allStalls = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const linked = allStalls.filter((s) => s.ownerId);
      stalls = linked.filter((s) => s.isActive !== false);
      archivedStalls = linked.filter((s) => s.isActive === false);

      // Get current active tab
      const activeRadio = document.querySelector(
        'input[name="stallTab"]:checked',
      );
      const tab = activeRadio ? activeRadio.value : "current";
      renderPage(tab);
    },
    (error) => {
      console.error("Error listening to stalls:", error);
    },
  );
}

// ============================================
// ONBOARDING CODE GENERATION
// ============================================

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Creates an onboarding code document in Firestore.
 * The document ID is the code itself for easy vendor lookup.
 */
async function createOnboardingCode() {
  const code = generateCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 1000); // 30 seconds from now

  await setDoc(doc(db, "onboardingCodes", code), {
    code: code,
    operatorId: currentOperatorId,
    hawkerCentreId: currentHawkerCentre?.id || null,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    status: "pending",
    vendorId: null,
  });

  return code;
}

/**
 * Deletes an onboarding code document from Firestore.
 */
async function deleteOnboardingCode(code) {
  if (!code) return;
  try {
    await deleteDoc(doc(db, "onboardingCodes", code));
  } catch (err) {
    console.warn("Could not delete onboarding code:", err);
  }
}

/**
 * Start listening for changes on the code document.
 * When status changes to "linked" and vendorId is set, transition to linked state.
 */
function listenForCodeLink(code) {
  // Unsubscribe from any previous listener
  if (codeSnapshotUnsubscribe) {
    codeSnapshotUnsubscribe();
    codeSnapshotUnsubscribe = null;
  }

  codeSnapshotUnsubscribe = onSnapshot(
    doc(db, "onboardingCodes", code),
    async (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.status === "linked" && data.vendorId) {
        // Stop the countdown and refresh interval since we have a linked vendor
        stopCountdown();
        if (codeRefreshInterval) {
          clearInterval(codeRefreshInterval);
          codeRefreshInterval = null;
        }
        // Unsubscribe from snapshot
        if (codeSnapshotUnsubscribe) {
          codeSnapshotUnsubscribe();
          codeSnapshotUnsubscribe = null;
        }
        // Fetch vendor data and show linked state
        await loadLinkedVendor(data.vendorId, code);
      }
    },
  );
}

/**
 * Refresh the code: delete old, create new, re-attach snapshot listener.
 */
async function refreshCode() {
  const oldCode = currentOnboardCode;

  // Delete old code document
  await deleteOnboardingCode(oldCode);

  // Unsubscribe from old listener
  if (codeSnapshotUnsubscribe) {
    codeSnapshotUnsubscribe();
    codeSnapshotUnsubscribe = null;
  }

  // Create new code
  const newCode = await createOnboardingCode();
  currentOnboardCode = newCode;

  // Update UI
  const codeEl = document.querySelector(".onboardCode");
  if (codeEl) {
    codeEl.innerHTML = `<span class="onboardCodePrefix">OBD-</span>${newCode}`;
  }

  // Reset countdown
  startCountdown();

  // Re-attach listener
  listenForCodeLink(newCode);
}

// ============================================
// ONBOARD PANEL — CODE STATE
// ============================================

let countdownInterval = null;
let countdownSeconds = 30;

function startCountdown() {
  countdownSeconds = 30;
  updateCountdownRing();

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(async () => {
    countdownSeconds--;
    if (countdownSeconds <= 0) {
      try {
        await refreshCode();
      } catch (err) {
        console.error("Error refreshing onboarding code:", err);
        countdownSeconds = 30;
        updateCountdownRing();
      }
      return;
    }
    updateCountdownRing();
  }, 1000);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function updateCountdownRing() {
  const circle = document.getElementById("countdownCircle");
  const text = document.getElementById("countdownText");
  if (!circle || !text) return;

  const circumference = 2 * Math.PI * 54;
  const progress = countdownSeconds / 30;
  circle.style.strokeDashoffset = circumference * (1 - progress);
  text.textContent = countdownSeconds;
}

function renderCodeState() {
  const circumference = 2 * Math.PI * 54;

  // Render countdown ring in header (replacing close button)
  document.getElementById("onboardHeaderRight").innerHTML = `
    <div class="countdownRing" id="countdownRingWrapper">
      <svg class="countdownSvg" viewBox="0 0 120 120">
        <circle class="countdownTrack" cx="60" cy="60" r="54" />
        <circle class="countdownProgress" id="countdownCircle" cx="60" cy="60" r="54"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="0" />
      </svg>
      <span class="countdownText" id="countdownText">30</span>
      <div class="countdownTooltip">Each code refreshes every 30s</div>
    </div>
  `;

  document.getElementById("onboardBody").innerHTML = `
    <div class="onboardCodeSection">
      <span class="onboardCode"><span class="onboardCodePrefix">OBD-</span>${currentOnboardCode}</span>
      <span class="onboardCodeSubtitle">Share this code with the vendor. They can key it in under their Tenancy page to begin onboarding.</span>
      <button class="onboardCopyBtn" id="copyCodeBtn">Copy code</button>
      <span class="onboardWaiting">${loadingIcon} Waiting for vendor...</span>
    </div>
  `;
  startCountdown();
  document.getElementById("onboardFooter").innerHTML = `
    <button class="onboardCancelBtn" id="onboardCancelBtn">Cancel <kbd class="onboardCancelKbd">ESC</kbd></button>
  `;

  document.getElementById("copyCodeBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(currentOnboardCode);
    document.getElementById("copyCodeBtn").textContent = "Copied!";
    setTimeout(() => {
      const btn = document.getElementById("copyCodeBtn");
      if (btn) btn.textContent = "Copy code";
    }, 2000);
  });

  document
    .getElementById("onboardCancelBtn")
    .addEventListener("click", closeOnboardPanel);
}

// ============================================
// ONBOARD PANEL — LINKED STATE
// ============================================

const filePreviewUrls = {};

function renderCertField(certValue, fieldKey) {
  if (certValue) {
    const previewUrl = filePreviewUrls[fieldKey];
    return `<div class="onboardFilePreview">
      <div class="onboardFilePreviewBox">
        ${previewUrl ? `<iframe class="onboardPdfPreview" src="${previewUrl}"></iframe>` : `<div class="onboardPdfPlaceholder"><span class="onboardPdfPlaceholderText">PDF</span></div>`}
        <button class="onboardFileDelete" data-field="${fieldKey}"><img src="../../assets/icons/delete.svg" alt="Delete" class="onboardFileDeleteIcon" /></button>
      </div>
      <span class="onboardFileBadge">${tickIcon} ${certValue}</span>
    </div>`;
  }
  return `
    <span class="onboardFieldMicrocopy">PDF under 2MB.</span>
    <label class="onboardUploadBtn" data-field="${fieldKey}">
      ${uploadIcon}
      <span class="onboardUploadText">Upload</span>
      <input class="onboardUploadInput" type="file" accept=".pdf" data-field="${fieldKey}" />
    </label>
  `;
}

function renderPhotoField(photoValue) {
  if (photoValue) {
    const previewUrl = filePreviewUrls["coverPhoto"];
    return `<div class="onboardFilePreview">
      <div class="onboardFilePreviewBox">
        ${previewUrl ? `<img class="onboardImagePreview" src="${previewUrl}" alt="Cover photo" />` : `<div class="onboardPdfPlaceholder"><span class="onboardPdfPlaceholderText">IMG</span></div>`}
        <button class="onboardFileDelete" data-field="coverPhoto"><img src="../../assets/icons/delete.svg" alt="Delete" class="onboardFileDeleteIcon" /></button>
      </div>
      <span class="onboardFileBadge">${tickIcon} ${photoValue}</span>
    </div>`;
  }
  return `
    <span class="onboardFieldMicrocopy">JPEG, PNG, or WEBP under 2MB.</span>
    <label class="onboardUploadBtn" data-field="coverPhoto">
      <img src="../../assets/icons/uploadPhoto.svg" alt="Upload" class="onboardUploadIcon" />
      <span class="onboardUploadText">Upload</span>
      <input class="onboardUploadInput" type="file" accept="image/jpeg,image/png,image/webp" data-field="coverPhoto" />
    </label>
  `;
}

function refreshPhotoField() {
  const container = document.querySelector(
    '.onboardField[data-cert="coverPhoto"]',
  );
  if (!container) return;
  const label = container.querySelector(".onboardFieldLabel");
  container.innerHTML = "";
  container.appendChild(label);
  container.insertAdjacentHTML(
    "beforeend",
    renderPhotoField(linkedVendorData?.coverPhoto || null),
  );
  bindCertUploads();
}

function refreshCertField(fieldKey) {
  const container = document.querySelector(
    `.onboardField[data-cert="${fieldKey}"]`,
  );
  if (!container) return;
  const label = container.querySelector(".onboardFieldLabel");
  container.innerHTML = "";
  container.appendChild(label);
  container.insertAdjacentHTML(
    "beforeend",
    renderCertField(linkedVendorData?.[fieldKey] || null, fieldKey),
  );
  bindCertUploads();
}

function bindCertUploads() {
  document.querySelectorAll(".onboardUploadInput").forEach((input) => {
    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fieldKey = e.target.dataset.field;
      if (linkedVendorData) linkedVendorData[fieldKey] = file.name;
      if (filePreviewUrls[fieldKey])
        URL.revokeObjectURL(filePreviewUrls[fieldKey]);
      filePreviewUrls[fieldKey] = URL.createObjectURL(file);
      if (fieldKey === "coverPhoto") {
        refreshPhotoField();
      } else {
        refreshCertField(fieldKey);
      }
    });
  });
  document.querySelectorAll(".onboardFileDelete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fieldKey = btn.dataset.field;
      if (linkedVendorData) linkedVendorData[fieldKey] = null;
      if (filePreviewUrls[fieldKey]) {
        URL.revokeObjectURL(filePreviewUrls[fieldKey]);
        delete filePreviewUrls[fieldKey];
      }
      if (fieldKey === "coverPhoto") {
        refreshPhotoField();
      } else {
        refreshCertField(fieldKey);
      }
    });
  });
}

// ============================================
// SCHEDULE EDITING (for linked vendor form)
// ============================================

let scheduleData = [];

function renderScheduleSlot(dayIdx, slotIdx, slot, showRemove) {
  return `
    <div class="onboardScheduleSlot">
      <input class="onboardScheduleTime" type="time" value="${slot.from}" data-day="${dayIdx}" data-slot="${slotIdx}" data-field="from" />
      <span class="onboardScheduleTo">to</span>
      <input class="onboardScheduleTime" type="time" value="${slot.to}" data-day="${dayIdx}" data-slot="${slotIdx}" data-field="to" />
      ${showRemove ? `<button class="onboardScheduleRemoveSlot" data-day="${dayIdx}" data-slot="${slotIdx}">&times;</button>` : ""}
    </div>
  `;
}

function renderScheduleRow(dayData, dayIdx) {
  const slotsHtml =
    dayData.active && dayData.slots.length
      ? dayData.slots
          .map((slot, si) => renderScheduleSlot(dayIdx, si, slot, si > 0))
          .join("")
      : `<span class="onboardScheduleClosed">Closed</span>`;

  return `
    <div class="onboardScheduleRow">
      <span class="onboardScheduleDay">${dayData.day}</span>
      <label class="onboardScheduleToggleLabel">
        <input class="onboardScheduleToggleInput" type="checkbox" ${dayData.active ? "checked" : ""} data-day="${dayIdx}" />
        <span class="onboardScheduleToggle"></span>
      </label>
      <div class="onboardScheduleSlots">
        ${slotsHtml}
      </div>
      ${dayData.active ? `<button class="onboardScheduleAddSlot" data-day="${dayIdx}">+ Add</button>` : ""}
    </div>
  `;
}

function renderSchedule() {
  return `
    <div class="onboardSchedule" id="onboardSchedule">
      ${scheduleData.map((d, i) => renderScheduleRow(d, i)).join("")}
    </div>
  `;
}

function bindSchedule() {
  const container = document.getElementById("onboardSchedule");
  if (!container) return;

  container.addEventListener("change", (e) => {
    if (e.target.classList.contains("onboardScheduleToggleInput")) {
      const dayIdx = parseInt(e.target.dataset.day);
      scheduleData[dayIdx].active = e.target.checked;
      if (e.target.checked && scheduleData[dayIdx].slots.length === 0) {
        scheduleData[dayIdx].slots.push({ from: "09:00", to: "17:00" });
      }
      refreshSchedule();
    }
    if (e.target.classList.contains("onboardScheduleTime")) {
      const { day, slot, field } = e.target.dataset;
      scheduleData[parseInt(day)].slots[parseInt(slot)][field] = e.target.value;
    }
  });

  container.addEventListener("click", (e) => {
    const addBtn = e.target.closest(".onboardScheduleAddSlot");
    if (addBtn) {
      const dayIdx = parseInt(addBtn.dataset.day);
      scheduleData[dayIdx].slots.push({ from: "", to: "" });
      refreshSchedule();
    }
    const removeBtn = e.target.closest(".onboardScheduleRemoveSlot");
    if (removeBtn) {
      const dayIdx = parseInt(removeBtn.dataset.day);
      const slotIdx = parseInt(removeBtn.dataset.slot);
      scheduleData[dayIdx].slots.splice(slotIdx, 1);
      refreshSchedule();
    }
  });
}

function refreshSchedule() {
  const container = document.getElementById("onboardSchedule");
  if (container) {
    container.innerHTML = scheduleData
      .map((d, i) => renderScheduleRow(d, i))
      .join("");
  }
}

// ============================================
// LOAD LINKED VENDOR
// ============================================

/**
 * Fetch vendor data from Firestore and show the linked state in the panel.
 */
async function loadLinkedVendor(vendorId, code) {
  try {
    const vendorDoc = await getDoc(doc(db, "vendors", vendorId));
    if (!vendorDoc.exists()) {
      console.error("Linked vendor not found:", vendorId);
      return;
    }

    const v = vendorDoc.data();
    linkedVendorData = {
      vendorId: vendorId,
      onboardCode: code,
      storeName: v.storeName || v.businessName || v.name || "",
      unitNumber: v.unitNumber || "",
      cuisines: v.cuisines || v.cuisineNames || [],
      operatingHours: v.operatingHours || null,
      coverPhoto: v.coverPhoto || v.imageUrl || null,
      hygieneCert: v.hygieneCert || null,
      halalCert: v.halalCert || null,
      bizRegNo: v.bizRegNo || v.uen || "",
      contactPerson: v.contactPerson || v.name || "",
      contactNumber: v.contactNumber || v.phone || "",
    };

    renderLinkedState();
  } catch (error) {
    console.error("Error fetching linked vendor:", error);
  }
}

/**
 * Convert Firestore operating hours object to the array format used in the schedule editor.
 */
function operatingHoursToArray(hours) {
  if (!hours) {
    return dayNames.map((d) => ({ day: d, active: false, slots: [] }));
  }

  // If already an array, return as-is
  if (Array.isArray(hours)) return JSON.parse(JSON.stringify(hours));

  const dayMap = {
    Mon: "monday",
    Tue: "tuesday",
    Wed: "wednesday",
    Thu: "thursday",
    Fri: "friday",
    Sat: "saturday",
    Sun: "sunday",
  };

  return dayNames.map((d) => {
    const key = dayMap[d];
    const h = hours[key];
    if (!h || h.isClosed) {
      return { day: d, active: false, slots: [] };
    }
    return {
      day: d,
      active: true,
      slots: [{ from: h.open || "09:00", to: h.close || "17:00" }],
    };
  });
}

/**
 * Convert the schedule editor array back to Firestore object format.
 */
function scheduleArrayToObject(arr) {
  const dayMap = {
    Mon: "monday",
    Tue: "tuesday",
    Wed: "wednesday",
    Thu: "thursday",
    Fri: "friday",
    Sat: "saturday",
    Sun: "sunday",
  };

  const result = {};
  arr.forEach((d) => {
    const key = dayMap[d.day];
    if (!d.active || d.slots.length === 0) {
      result[key] = { open: "00:00", close: "00:00", isClosed: true };
    } else {
      // Use first slot as the main operating hours
      result[key] = {
        open: d.slots[0].from || "09:00",
        close: d.slots[0].to || "17:00",
        isClosed: false,
      };
    }
  });
  return result;
}

async function runAutofillAnimation() {
  autofillAnimationRunning = true;
  const v = linkedVendorData;
  if (!v) {
    autofillAnimationRunning = false;
    return;
  }

  const phoneClean = (v.contactNumber || "")
    .replace("+65 ", "")
    .replace("+65", "")
    .trim();
  const body = document.getElementById("onboardBody");

  function scrollToField(el) {
    if (el && body) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Wait for panel transition to finish
  await autofillDelay(350);

  // Store Name
  scrollToField(
    document.getElementById("onboardStoreName")?.closest(".onboardField"),
  );
  await typeIntoInput("onboardStoreName", v.storeName, 28);
  await autofillDelay(180);

  // Unit Number
  scrollToField(
    document.getElementById("onboardUnitNo")?.closest(".onboardField"),
  );
  await typeIntoInput("onboardUnitNo", v.unitNumber, 28);
  await autofillDelay(180);

  // Cuisines — tags pop in one by one
  scrollToField(
    document
      .getElementById("onboardCuisineContainer")
      ?.closest(".onboardField"),
  );
  await fadeInCuisineTags(120);
  await autofillDelay(200);

  // Operating Hours — fade in
  const scheduleWrap = document.getElementById("onboardScheduleWrap");
  scrollToField(scheduleWrap?.closest(".onboardField"));
  await fadeInElement(scheduleWrap, 450);
  await autofillDelay(180);

  // Cover Photo — fade in
  const coverWrap = document.querySelector(
    '[data-cert="coverPhoto"] .autofill-fade-wrap',
  );
  scrollToField(coverWrap?.closest(".onboardField"));
  await fadeInElement(coverWrap, 400);
  await autofillDelay(150);

  // Hygiene Certificate — fade in
  const hygieneWrap = document.querySelector(
    '[data-cert="hygieneCert"] .autofill-fade-wrap',
  );
  scrollToField(hygieneWrap?.closest(".onboardField"));
  await fadeInElement(hygieneWrap, 400);
  await autofillDelay(150);

  // Halal Certification — fade in
  const halalWrap = document.querySelector(
    '[data-cert="halalCert"] .autofill-fade-wrap',
  );
  scrollToField(halalWrap?.closest(".onboardField"));
  await fadeInElement(halalWrap, 400);
  await autofillDelay(180);

  // UEN
  scrollToField(
    document.getElementById("onboardBizReg")?.closest(".onboardField"),
  );
  await typeIntoInput("onboardBizReg", v.bizRegNo, 28);
  await autofillDelay(180);

  // Contact Person
  scrollToField(
    document.getElementById("onboardContact")?.closest(".onboardField"),
  );
  await typeIntoInput("onboardContact", v.contactPerson, 28);
  await autofillDelay(180);

  // Contact Number
  scrollToField(
    document.getElementById("onboardPhone")?.closest(".onboardField"),
  );
  await typeIntoInput("onboardPhone", phoneClean, 35);
  await autofillDelay(100);

  // Animation complete — unlock form
  unlockAutofillForm();
  autofillAnimationRunning = false;
}

function unlockAutofillForm() {
  // Remove readonly from all text inputs
  document
    .querySelectorAll(".onboardFields .onboardFieldInput[readonly]")
    .forEach((input) => {
      input.removeAttribute("readonly");
    });

  // Enable approve/reject buttons
  const approveBtn = document.getElementById("onboardApproveBtn");
  const rejectBtn = document.getElementById("onboardRejectBtn");
  if (approveBtn) approveBtn.disabled = false;
  if (rejectBtn) rejectBtn.disabled = false;

  // Bind interactive handlers now
  bindCuisineInput();
  bindSchedule();
  bindCertUploads();
}

function renderLinkedState() {
  const v = linkedVendorData;
  scheduleData = operatingHoursToArray(v.operatingHours);

  // Clear the countdown ring from the header
  const headerRight = document.getElementById("onboardHeaderRight");
  if (headerRight) headerRight.innerHTML = "";

  const phoneClean = (v.contactNumber || "")
    .replace("+65 ", "")
    .replace("+65", "")
    .trim();

  document.getElementById("onboardBody").innerHTML = `
    <div class="onboardFields">
      <div class="onboardField">
        <label class="onboardFieldLabel" for="onboardStoreName">Store Name</label>
        <span class="onboardFieldMicrocopy">Enter your ACRA-registered business name — we'll use this for verification and records.</span>
        <input class="onboardFieldInput" id="onboardStoreName" type="text" value="" readonly />
      </div>
      <div class="onboardField">
        <label class="onboardFieldLabel" for="onboardUnitNo">Unit Number</label>
        <input class="onboardFieldInput" id="onboardUnitNo" type="text" value="" readonly />
      </div>
      <div class="onboardField">
        <label class="onboardFieldLabel" for="onboardCuisineInput">Cuisines Served</label>
        <div class="onboardCuisineContainer" id="onboardCuisineContainer">
          ${v.cuisines.map((c) => `<span class="onboardCuisineTag ${c.toLowerCase()}" data-cuisine="${c}" style="opacity:0;transform:scale(0.8);transition:opacity 150ms ease,transform 150ms ease">${renderOnboardTag(c)}<button class="onboardCuisineRemove" data-cuisine="${c}">&times;</button></span>`).join("")}
          <input class="onboardCuisineInput" id="onboardCuisineInput" type="text" placeholder="Add cuisine..." />
        </div>
      </div>
      <div class="onboardField">
        <label class="onboardFieldLabel">Operating Hours</label>
        <div id="onboardScheduleWrap" style="opacity:0;transform:translateY(8px)">${renderSchedule()}</div>
      </div>
      <div class="onboardField" data-cert="coverPhoto">
        <label class="onboardFieldLabel">Cover Photo</label>
        <div class="autofill-fade-wrap" style="opacity:0;transform:translateY(8px)">${renderPhotoField(v.coverPhoto)}</div>
      </div>
      <div class="onboardField" data-cert="hygieneCert">
        <label class="onboardFieldLabel">Hygiene Certificate</label>
        <div class="autofill-fade-wrap" style="opacity:0;transform:translateY(8px)">${renderCertField(v.hygieneCert, "hygieneCert")}</div>
      </div>
      <div class="onboardField" data-cert="halalCert">
        <label class="onboardFieldLabel">Halal Certification</label>
        <div class="autofill-fade-wrap" style="opacity:0;transform:translateY(8px)">${renderCertField(v.halalCert, "halalCert")}</div>
      </div>
      <div class="onboardField">
        <label class="onboardFieldLabel" for="onboardBizReg">UEN</label>
        <input class="onboardFieldInput" id="onboardBizReg" type="text" value="" readonly />
      </div>
      <div class="onboardField">
        <label class="onboardFieldLabel" for="onboardContact">Contact Person</label>
        <input class="onboardFieldInput" id="onboardContact" type="text" value="" readonly />
      </div>
      <div class="onboardField">
        <label class="onboardFieldLabel" for="onboardPhone">Contact Number</label>
        <div class="onboardPhoneRow">
          <img src="../../assets/icons/singapore.svg" alt="SG" class="onboardPhoneFlag" />
          <span class="onboardPhonePrefix">+65</span>
          <input class="onboardFieldInput" id="onboardPhone" type="tel" value="" maxlength="9" placeholder="8XXX XXXX" readonly />
        </div>
      </div>
    </div>
  `;

  document.getElementById("onboardFooter").innerHTML = `
    <button class="onboardRejectBtn" id="onboardRejectBtn" disabled>Reject</button>
    <button class="onboardApproveBtn" id="onboardApproveBtn" disabled>Approve Onboarding</button>
  `;

  document
    .getElementById("onboardRejectBtn")
    .addEventListener("click", handleReject);
  document
    .getElementById("onboardApproveBtn")
    .addEventListener("click", handleApprove);

  // Kick off the autofill animation (binds interactive handlers after completion)
  runAutofillAnimation();
}

// ============================================
// CUISINE INPUT
// ============================================

function bindCuisineInput() {
  const container = document.getElementById("onboardCuisineContainer");
  const input = document.getElementById("onboardCuisineInput");
  if (!container || !input) return;

  container.addEventListener("click", (e) => {
    const removeBtn = e.target.closest(".onboardCuisineRemove");
    if (removeBtn) {
      removeBtn.closest(".onboardCuisineTag").remove();
    } else {
      input.focus();
    }
  });

  input.addEventListener("keydown", (e) => {
    const val = input.value.trim();
    if (e.key === "Enter" && val) {
      e.preventDefault();
      addCuisineTag(val);
      input.value = "";
    }
    if (e.key === "Backspace" && !val) {
      const tags = container.querySelectorAll(".onboardCuisineTag");
      if (tags.length) tags[tags.length - 1].remove();
    }
  });
}

function addCuisineTag(cuisine) {
  const container = document.getElementById("onboardCuisineContainer");
  const input = document.getElementById("onboardCuisineInput");
  if (!container || !input) return;
  const capitalized =
    cuisine.charAt(0).toUpperCase() + cuisine.slice(1).toLowerCase();
  const tag = document.createElement("span");
  tag.className = `onboardCuisineTag ${capitalized.toLowerCase()}`;
  tag.dataset.cuisine = capitalized;
  tag.innerHTML = `${renderOnboardTag(capitalized)}<button class="onboardCuisineRemove" data-cuisine="${capitalized}">&times;</button>`;
  container.insertBefore(tag, input);
}

// ============================================
// APPROVE / REJECT HANDLERS
// ============================================

/**
 * Approve onboarding: create the foodStall document and link it to the hawker centre.
 */
async function handleApprove() {
  if (!linkedVendorData || !currentHawkerCentre) return;

  const approveBtn = document.getElementById("onboardApproveBtn");
  if (approveBtn) {
    approveBtn.disabled = true;
    approveBtn.textContent = "Approving...";
  }

  try {
    // Gather form values
    const storeName =
      document.getElementById("onboardStoreName")?.value ||
      linkedVendorData.storeName;
    const unitNumber =
      document.getElementById("onboardUnitNo")?.value ||
      linkedVendorData.unitNumber;
    const bizRegNo =
      document.getElementById("onboardBizReg")?.value ||
      linkedVendorData.bizRegNo;
    const contactPerson =
      document.getElementById("onboardContact")?.value ||
      linkedVendorData.contactPerson;
    const contactNumber =
      document.getElementById("onboardPhone")?.value ||
      linkedVendorData.contactNumber;

    // Gather cuisines from tags
    const cuisineTags = document.querySelectorAll(
      "#onboardCuisineContainer .onboardCuisineTag",
    );
    const cuisines = Array.from(cuisineTags).map((tag) => tag.dataset.cuisine);

    // Convert schedule to Firestore format
    const operatingHours = scheduleArrayToObject(scheduleData);

    // Create foodStall document
    const stallRef = await addDoc(collection(db, "foodStalls"), {
      name: storeName,
      nameLower: storeName.toLowerCase(),
      ownerId: linkedVendorData.vendorId,
      operatorId: currentOperatorId,
      operatorName: currentHawkerCentre.name || "",
      hawkerCentreId: currentHawkerCentre.id,
      unitNumber: unitNumber,
      cuisineNames: cuisines,
      cuisineIds: [],
      isHalal: cuisines.some((c) => c.toLowerCase() === "halal"),
      operatingHours: operatingHours,
      imageUrl: linkedVendorData.coverPhoto || "",
      coverImageUrl: linkedVendorData.coverPhoto || "",
      rating: 0,
      reviewCount: 0,
      isActive: true,
      isOpen: true,
      bizRegNo: bizRegNo,
      contactPerson: contactPerson,
      contactNumber: contactNumber,
      hygieneCert: linkedVendorData.hygieneCert || null,
      halalCert: linkedVendorData.halalCert || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update the onboarding code to "approved"
    if (linkedVendorData.onboardCode) {
      try {
        await updateDoc(
          doc(db, "onboardingCodes", linkedVendorData.onboardCode),
          {
            status: "approved",
            stallId: stallRef.id,
          },
        );
      } catch (err) {
        console.warn("Could not update onboarding code status:", err);
      }
    }

    // Update vendor document with stall reference
    try {
      await updateDoc(doc(db, "vendors", linkedVendorData.vendorId), {
        stallId: stallRef.id,
        hawkerCentreId: currentHawkerCentre.id,
        storeLocation: currentHawkerCentre.name || "",
        tenancyLinkedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Could not update vendor doc:", err);
    }

    // Close panel — stalls grid updates automatically via realtime listener
    closeOnboardPanel();
  } catch (error) {
    console.error("Error approving onboarding:", error);
    if (approveBtn) {
      approveBtn.disabled = false;
      approveBtn.textContent = "Approve Onboarding";
    }
    showToast("Failed to approve onboarding. Please try again.", "error");
  }
}

/**
 * Reject onboarding: delete the code and close the panel.
 */
async function handleReject() {
  if (linkedVendorData?.onboardCode) {
    try {
      await updateDoc(
        doc(db, "onboardingCodes", linkedVendorData.onboardCode),
        {
          status: "rejected",
        },
      );
    } catch (err) {
      // If doc doesn't exist, ignore
      console.warn("Could not update onboarding code on reject:", err);
    }
    await deleteOnboardingCode(linkedVendorData.onboardCode);
  }
  closeOnboardPanel();
}

// ============================================
// OPEN / CLOSE ONBOARD PANEL
// ============================================

async function openOnboardPanel() {
  if (!currentHawkerCentre) {
    showToast(
      "No hawker centre data loaded yet. Please wait and try again.",
      "error",
    );
    return;
  }

  try {
    // Generate initial code and store in Firestore
    const code = await createOnboardingCode();
    currentOnboardCode = code;

    // Render the code state UI
    renderCodeState();

    // Start listening for vendor link
    listenForCodeLink(code);

    // Open the panel
    document.getElementById("onboardOverlay").classList.add("active");
    document.getElementById("onboardPanel").classList.add("active");
    document.body.style.overflow = "hidden";
  } catch (error) {
    console.error("Error opening onboard panel:", error);
    showToast("Failed to generate onboarding code. Please try again.", "error");
  }
}

function closeOnboardPanel() {
  // Clear any running autofill animation
  autofillTimeouts.forEach((id) => clearTimeout(id));
  autofillTimeouts = [];
  autofillAnimationRunning = false;

  // Clear the countdown
  stopCountdown();

  // Clear the header ring
  const headerRight = document.getElementById("onboardHeaderRight");
  if (headerRight) headerRight.innerHTML = "";

  // Clear the code refresh interval
  if (codeRefreshInterval) {
    clearInterval(codeRefreshInterval);
    codeRefreshInterval = null;
  }

  // Unsubscribe from snapshot listener
  if (codeSnapshotUnsubscribe) {
    codeSnapshotUnsubscribe();
    codeSnapshotUnsubscribe = null;
  }

  // Delete pending code from Firestore (fire-and-forget)
  if (currentOnboardCode) {
    deleteOnboardingCode(currentOnboardCode);
    currentOnboardCode = "";
  }

  // Reset linked vendor data
  linkedVendorData = null;

  // Revoke any preview object URLs
  Object.keys(filePreviewUrls).forEach((key) => {
    URL.revokeObjectURL(filePreviewUrls[key]);
    delete filePreviewUrls[key];
  });

  // Close the panel
  document.getElementById("onboardOverlay").classList.remove("active");
  document.getElementById("onboardPanel").classList.remove("active");
  document.body.style.overflow = "";
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  // Initial empty render while waiting for auth
  renderPage("current");

  // Tab switching
  document.querySelectorAll('input[name="childrenTab"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      renderPage(radio.value);
    });
  });

  // Keyboard shortcut setup
  const isMac = window.navigator.userAgentData
    ? window.navigator.userAgentData.platform === "macOS"
    : /Mac/i.test(window.navigator.userAgent);

  const searchKeyMod = document.getElementById("searchKeyMod");
  if (searchKeyMod) {
    searchKeyMod.textContent = isMac ? "\u2318" : "CTRL";
  }

  document.addEventListener("keydown", (e) => {
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    if (modifier && e.key === "k") {
      e.preventDefault();
      const searchInput = document.getElementById("searchInput");
      if (searchInput) searchInput.focus();
    }
    if (modifier && e.key === "o") {
      e.preventDefault();
      openOnboardPanel();
    }
    if (e.key === "Escape") {
      const panel = document.getElementById("onboardPanel");
      if (panel && panel.classList.contains("active")) {
        closeOnboardPanel();
      }
    }
  });

  // Onboard panel close handlers
  document
    .getElementById("onboardOverlay")
    .addEventListener("click", closeOnboardPanel);

  // Firebase Auth — load operator data when authenticated
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Check onboarding status
      const operatorDoc = await getDoc(doc(db, "operators", user.uid));
      if (!operatorDoc.exists() || !operatorDoc.data().onboardingComplete) {
        window.location.href = "../Auth/onboarding-operator.html";
        return;
      }

      await loadOperatorData(user.uid);
    } else {
      // Not authenticated — redirect to login
      window.location.href = "../Auth/login.html";
    }
  });
});
