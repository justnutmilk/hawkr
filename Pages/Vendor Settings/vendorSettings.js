// ============================================
// IMPORTS
// ============================================

import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";
import { initNotificationBadge } from "../../assets/js/notificationBadge.js";
import {
  initToastContainer,
  subscribeToNewNotifications,
} from "../../assets/js/toastNotifications.js";
import {
  initLiquidGlassToggle,
  initMiniLiquidGlassToggle,
} from "../../assets/js/liquidGlassToggle.js";
import { auth, db, storage } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  deleteField,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { showToast } from "../../assets/js/toast.js";
import { findOrCreateHawkerCentre } from "../../firebase/services/hawkerCentres.js";
import Snap from "../../drag and drop/snap.esm.js";

// ============================================
// STATE
// ============================================

let currentUserId = null;

// Edit stall popup state
let editStallLocation = null;
let editStallCuisines = [];
let editStallHours = [];
let editStallMapInstance = null;
let editStallMapMarker = null;

let vendorData = {
  storeName: "",
  contactPerson: "",
  contactNumber: "",
  email: "",
  uen: "",
  storeLocation: "",
  unitNumber: "",
  telegramLinked: false,
  telegramUsername: null,
  browserNotifications: false,
  storePhotoUrl: null,
  hygieneCertUrl: null,
  halalCertUrl: null,
};

let stallData = null; // { id, cuisines, operatingHours, ... }

const icons = {
  edit: "../../assets/icons/edit.svg",
  singapore: "../../assets/icons/singapore.svg",
  information: "../../assets/icons/information.svg",
};

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderBusinessDetails(vendor) {
  return `
    <div class="settingsSection">
      <div class="sectionHeader">
        <span class="sectionTitle">Business Details</span>
        <div class="sectionActions">
          <button class="actionButton editButton" id="editBusinessDetails">
            <img src="${icons.edit}" alt="Edit" />
            Edit
          </button>
        </div>
      </div>
      <div class="detailRows">
        <div class="detailRow">
          <span class="detailLabel">Store Name</span>
          <span class="detailValue">${vendor.storeName || "Not set"}</span>
        </div>
        <div class="detailRow">
          <span class="detailLabel">UEN</span>
          <span class="detailValueMono">${vendor.uen || "Not set"}</span>
        </div>
        <div class="detailRow">
          <span class="detailLabel">Contact Person</span>
          <span class="detailValue">${vendor.contactPerson || "Not set"}</span>
        </div>
        <div class="detailRow">
          <span class="detailLabel">Contact Number</span>
          ${
            vendor.contactNumber
              ? `<span class="detailValuePhone">
                  <img src="${icons.singapore}" alt="SG" />
                  ${vendor.contactNumber}
                </span>`
              : `<span class="detailValueNotProvided">Not provided</span>`
          }
        </div>
        <div class="detailRow">
          <span class="detailLabel">Email</span>
          <span class="detailValue">${vendor.email}</span>
        </div>
      </div>
    </div>
  `;
}

const cuisineIcons = {
  Halal: "../../assets/icons/halal.png",
  Kosher: "../../assets/icons/kosher.svg",
};

function renderCuisineTag(tag) {
  const icon = cuisineIcons[tag];
  const cls = tag.toLowerCase();
  if (icon) {
    return `<span class="stallCuisineTag ${cls}"><img class="stallCuisineIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="stallCuisineTag">${tag}</span>`;
}

function renderHoursTable(hours) {
  if (!hours || !Array.isArray(hours) || hours.length === 0) {
    return `<span class="detailValueNotProvided">Not set</span>`;
  }

  return `
    <div class="hoursTable stallHoursTableReadonly">
      ${hours
        .map(
          (day, dayIdx) => `
          <div class="hoursRow">
            <div class="hoursDay">${day.day}</div>
            <label class="liquidGlassToggle hoursToggle" data-day="${dayIdx}">
              <input type="checkbox" ${day.active ? "checked" : ""} disabled />
              <span class="toggleTrack">
                <span class="toggleThumb ${day.active ? "glass" : ""}"></span>
              </span>
            </label>
            <div class="hoursSlots">
              ${
                day.active && day.slots && day.slots.length > 0
                  ? day.slots
                      .map(
                        (slot) => `
                    <div class="hoursSlot">
                      <input type="time" class="hoursTime" value="${slot.from}" disabled />
                      <span class="hoursTo">to</span>
                      <input type="time" class="hoursTime" value="${slot.to}" disabled />
                    </div>`,
                      )
                      .join("")
                  : `<span class="hoursClosed">Closed</span>`
              }
            </div>
          </div>`,
        )
        .join("")}
    </div>
  `;
}

function renderStallDetails(stall) {
  if (!stall) {
    return `
      <div class="settingsSection">
        <div class="sectionHeader">
          <span class="sectionTitle">Stall Details</span>
        </div>
        <span class="detailValueNotProvided">No stall linked to this account.</span>
      </div>
    `;
  }

  const locationName =
    vendorData.centreName || stall.location || vendorData.storeLocation || "";
  const locationAddress = vendorData.centreAddress || "";
  const hasCoords = vendorData.centreLat && vendorData.centreLng;

  const cuisinesHtml =
    stall.cuisines && stall.cuisines.length > 0
      ? `<div class="stallCuisines">${stall.cuisines.map(renderCuisineTag).join("")}</div>`
      : `<span class="detailValueNotProvided">None set</span>`;

  return `
    <div class="settingsSection">
      <div class="sectionHeader">
        <span class="sectionTitle">Stall Details</span>
        <div class="sectionActions">
          <button class="actionButton editButton" id="editStallDetails">
            <img src="${icons.edit}" alt="Edit" />
            Edit
          </button>
        </div>
      </div>

      <div class="stallDetailBlock">
        <span class="stallDetailLabel">Location</span>
        ${
          hasCoords
            ? `<div class="stallMapContainer" id="settingsStallMap"></div>`
            : ""
        }
        <span class="stallLocationName">${locationName || "Not set"}</span>
        ${locationAddress ? `<span class="stallLocationAddress">${locationAddress}</span>` : ""}
        ${stall.unitNumber || vendorData.unitNumber ? `<span class="stallLocationUnit">Unit ${stall.unitNumber || vendorData.unitNumber}</span>` : ""}
      </div>

      <div class="stallDetailBlock">
        <span class="stallDetailLabel">Cuisines</span>
        ${cuisinesHtml}
      </div>

      <div class="stallDetailBlock">
        <span class="stallDetailLabel">Operating Hours</span>
        ${renderHoursTable(stall.operatingHours)}
      </div>
    </div>
  `;
}

function formatOperatingHours(hours) {
  if (!hours || !Array.isArray(hours)) return "Not set";

  const activeDays = hours.filter((d) => d.active);
  if (activeDays.length === 0) return "Closed";

  return activeDays
    .map((d) => {
      const slots =
        d.slots && d.slots.length > 0
          ? d.slots.map((s) => `${s.from}\u2013${s.to}`).join(", ")
          : "Closed";
      return `${d.day}: ${slots}`;
    })
    .join("<br/>");
}

function renderDocumentItem(label, url, fieldKey, accept, microcopy) {
  if (url) {
    const isImage = accept.startsWith("image");
    return `
      <div class="documentItem" data-field="${fieldKey}">
        <div class="documentItemTop">
          <span class="documentLabel">${label}</span>
          <div class="documentItemActions">
            <label class="documentReplaceBtn">
              Replace
              <input type="file" accept="${accept}" data-field="${fieldKey}" class="documentFileInput" hidden />
            </label>
            <button class="documentDeleteBtn" data-field="${fieldKey}">Remove</button>
          </div>
        </div>
        <div class="documentPreviewBox ${isImage ? "imagePreview" : "pdfPreview"}">
          ${isImage ? `<img class="documentPreviewImg" src="${url}" alt="${label}" />` : `<iframe class="documentPreviewPdf" src="${url}"></iframe>`}
        </div>
      </div>
    `;
  }
  return `
    <div class="documentItem" data-field="${fieldKey}">
      <div class="documentItemTop">
        <span class="documentLabel">${label}</span>
        <label class="documentUploadBtn">
          Upload
          <input type="file" accept="${accept}" data-field="${fieldKey}" class="documentFileInput" hidden />
        </label>
      </div>
      <span class="documentMicrocopy">${microcopy}</span>
    </div>
  `;
}

function renderDocumentsSection(vendor) {
  return `
    <div class="settingsSection">
      <div class="sectionHeader">
        <span class="sectionTitle">Documents</span>
      </div>
      <div class="documentItems">
        ${renderDocumentItem("Cover Photo", vendor.storePhotoUrl, "storePhotoUrl", "image/jpeg,image/png,image/webp", "JPEG, PNG, or WEBP under 2 MB.")}
        ${renderDocumentItem("Hygiene Certificate", vendor.hygieneCertUrl, "hygieneCertUrl", ".pdf", "PDF under 2 MB.")}
        ${renderDocumentItem("Halal Certificate", vendor.halalCertUrl, "halalCertUrl", ".pdf", "PDF under 2 MB.")}
      </div>
    </div>
  `;
}

function renderNotificationsSection(vendor) {
  let telegramHTML;

  if (vendor.telegramLinked) {
    const handle = vendor.telegramUsername
      ? `@${vendor.telegramUsername}`
      : "Linked";
    telegramHTML = `
      <div class="notificationMethodRight telegramConnected">
        <div class="telegramConnectedInfo">
          <span class="telegramConnectedLabel">Connected Telegram Account</span>
          <div class="telegramConnectedAccount">
            <span class="telegramHandle">${handle}</span>
            <button class="telegramDisconnectButton" id="telegramUnlink">Disconnect</button>
          </div>
        </div>
      </div>
    `;
  } else {
    telegramHTML = `
      <div class="notificationMethodRight">
        <span class="telegramStatus">Telegram isn't connected</span>
        <div id="telegramLoginWidget"></div>
      </div>
    `;
  }

  return `
    <div class="settingsSection">
      <span class="sectionTitle">Notifications</span>
      <span class="notificationsDescription">Get instant notifications for new orders, customer feedback, and important updates. Choose how you'd like to receive them.</span>
      <div class="notificationMethods">
        <div class="notificationMethod" id="telegramNotificationMethod">
          <div class="notificationMethodLeft">
            <span class="notificationMethodTitle">Telegram</span>
            <span class="notificationMethodDescription">${vendor.telegramLinked ? "You're receiving order notifications, feedback alerts, and security updates on Telegram." : "Get instant order alerts, customer feedback, and security notifications on Telegram, even when HawkrOS is closed."}</span>
          </div>
          ${telegramHTML}
        </div>
        <div class="notificationMethod">
          <div class="notificationMethodLeft">
            <span class="notificationMethodTitle">Browser</span>
            <span class="notificationMethodDescription">Shows pop-ups for new orders and updates only while you're on HawkrOS.</span>
          </div>
          <label class="liquidGlassToggle" id="browserToggleLabel">
            <input type="checkbox" id="browserToggle" ${vendor.browserNotifications ? "checked" : ""} />
            <span class="toggleTrack">
              <span class="toggleThumb ${vendor.browserNotifications ? "glass" : ""}"></span>
            </span>
          </label>
        </div>
      </div>
    </div>
  `;
}

function renderDangerZone() {
  return `
    <div class="dangerSection">
      <span class="dangerTitle">Danger Zone</span>
      <span class="dangerDescription">This place is dangerous. Buttons here trigger permanent actions that can't be undone. Only proceed if you're sure what you're doing.</span>
      <div class="dangerItem">
        <div class="dangerItemLeft">
          <div class="dangerItemTitleGroup">
            <span class="dangerItemTitle">Delete Account</span>
            <span class="informationIcon">
              <img src="${icons.information}" alt="Info" />
              <span class="informationTooltip">We'll permanently delete your HawkrOS vendor profile, stall data, and remove personal data linked to your account after the required retention periods end. Some records may be retained for security, fraud prevention, or legal compliance.</span>
            </span>
          </div>
          <span class="dangerItemDescription">We'll wipe your HawkrOS profile, stall data, and (almost) everything we know about you. <a href="404.html">View Privacy Policy ></a></span>
        </div>
        <button class="deleteButton" id="deleteAccount">Delete Account</button>
      </div>
    </div>
  `;
}

function renderSettingsPage(vendor, stall) {
  const container = document.getElementById("settingsContent");
  if (!container) return;

  container.innerHTML = `
    <span class="pageTitle">Settings</span>
    <div class="sectionsContainer">
      ${renderBusinessDetails(vendor)}
      ${renderStallDetails(stall)}
      ${renderDocumentsSection(vendor)}
      ${renderNotificationsSection(vendor)}
      ${renderDangerZone()}
    </div>
  `;

  attachEventListeners();
  initSettingsMap();
  // Init liquid glass toggles on read-only hours table (visual only, inputs are disabled)
  document
    .querySelectorAll(".stallHoursTableReadonly .hoursToggle")
    .forEach((toggleLabel) => {
      initMiniLiquidGlassToggle(toggleLabel);
    });
}

/**
 * Initialize the static Google Map in Stall Details (if coordinates are available)
 */
async function initSettingsMap() {
  const mapEl = document.getElementById("settingsStallMap");
  if (!mapEl || !vendorData.centreLat || !vendorData.centreLng) return;

  try {
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    const pos = { lat: vendorData.centreLat, lng: vendorData.centreLng };

    const map = new Map(mapEl, {
      center: pos,
      zoom: 16,
      mapId: "hawkr-settings",
      disableDefaultUI: true,
      zoomControl: false,
      gestureHandling: "none",
      clickableIcons: false,
    });

    new AdvancedMarkerElement({ position: pos, map });
  } catch (err) {
    console.warn("Could not load settings map:", err);
  }
}

// ============================================
// EDIT BUSINESS DETAILS POPUP
// ============================================

function renderEditBusinessPopup(vendor) {
  const phoneRaw = vendor.contactNumber
    ? vendor.contactNumber.replace("+65 ", "").replace("+65", "")
    : "";

  return `
    <div class="editPopupHeader">
      <h2 class="editPopupTitle">Edit Business Details</h2>
      <button class="editPopupClose" id="editBusinessClose" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="#341539" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <div class="editPopupContent">
      <div class="editFormGroup">
        <span class="editFormLabel">Store Name</span>
        <input type="text" class="editFormInput" id="editStoreName" value="${vendor.storeName}" />
      </div>
      <div class="editFormGroup">
        <span class="editFormLabel">UEN</span>
        <input type="text" class="editFormInput" id="editUen" value="${vendor.uen}" />
      </div>
      <div class="editFormGroup">
        <span class="editFormLabel">Contact Person</span>
        <input type="text" class="editFormInput" id="editContactPerson" value="${vendor.contactPerson}" />
      </div>
      <div class="editFormGroup">
        <div class="editFormLabelRow">
          <span class="editFormLabel">Contact Number</span>
        </div>
        <div class="editFormPhoneRow">
          <img src="${icons.singapore}" alt="SG" />
          <span class="editFormPhonePrefix">+65</span>
          <input type="tel" class="editFormInput" id="editContactNumber" value="${phoneRaw}" maxlength="9" placeholder="8XXX XXXX" />
        </div>
      </div>
      <div class="editFormGroup">
        <span class="editFormLabel">Email</span>
        <input type="email" class="editFormInput" id="editEmail" value="${vendor.email}" />
      </div>
    </div>
    <div class="editPopupFooter">
      <button class="editPopupSaveBtn" id="editBusinessSave">Save changes</button>
    </div>
  `;
}

function openEditBusiness() {
  const popup = document.getElementById("editBusinessPopup");
  const overlay = document.getElementById("editBusinessOverlay");
  if (!popup || !overlay) return;

  popup.innerHTML = renderEditBusinessPopup(vendorData);
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";

  document
    .getElementById("editBusinessClose")
    .addEventListener("click", closeEditBusiness);

  document
    .getElementById("editBusinessSave")
    .addEventListener("click", saveEditBusiness);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeEditBusiness();
  });
}

function closeEditBusiness() {
  const overlay = document.getElementById("editBusinessOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }
}

async function saveEditBusiness() {
  const storeName = document.getElementById("editStoreName").value.trim();
  const uen = document.getElementById("editUen").value.trim();
  const contactPerson = document
    .getElementById("editContactPerson")
    .value.trim();
  const phoneRaw = document.getElementById("editContactNumber").value.trim();
  const email = document.getElementById("editEmail").value.trim();
  const phoneDigits = phoneRaw.replace(/\D/g, "");

  if (phoneRaw && phoneDigits.length !== 8) {
    const phoneInput = document.getElementById("editContactNumber");
    phoneInput.style.borderColor = "#eb001b";
    phoneInput.focus();
    return;
  }

  const saveBtn = document.getElementById("editBusinessSave");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    const updates = {};
    if (storeName) updates.storeName = storeName;
    if (uen) updates.uen = uen;
    if (contactPerson) updates.contactPerson = contactPerson;
    updates.contactNumber = phoneRaw
      ? `+65 ${phoneDigits.slice(0, 4)} ${phoneDigits.slice(4)}`
      : "";

    if (currentUserId) {
      await updateDoc(doc(db, "vendors", currentUserId), updates);
    }

    vendorData.storeName = storeName || vendorData.storeName;
    vendorData.uen = uen || vendorData.uen;
    vendorData.contactPerson = contactPerson || vendorData.contactPerson;
    vendorData.contactNumber = updates.contactNumber;
    if (email) vendorData.email = email;

    closeEditBusiness();
    renderSettingsPage(vendorData, stallData);
  } catch (error) {
    console.error("Error saving business details:", error);
    alert("Failed to save changes. Please try again.");
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save changes";
    }
  }
}

// ============================================
// EDIT STALL DETAILS POPUP
// ============================================

function renderEditStallPopup(stall) {
  const locationName =
    vendorData.centreName || stall?.location || vendorData.storeLocation || "";
  const locationAddress = vendorData.centreAddress || "";

  return `
    <div class="editPopupHeader">
      <h2 class="editPopupTitle">Edit Stall Details</h2>
      <button class="editPopupClose" id="editStallClose" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="#341539" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <div class="editPopupContent" id="editStallContent">
      <div class="editFormGroup">
        <span class="editFormLabel">Location</span>
        <div class="editStallMapContainer" id="editStallMap"></div>
        <input type="text" class="editFormInput" id="editStallLocationInput" placeholder="Search for a location..." />
        <div class="editSelectedLocation" id="editSelectedLocation" style="display:${locationName ? "flex" : "none"}">
          <div class="editSelectedLocationInfo">
            <span class="editSelectedLocationName" id="editSelectedLocationName">${locationName}</span>
            <span class="editSelectedLocationAddress" id="editSelectedLocationAddress">${locationAddress}</span>
          </div>
          <button class="editSelectedLocationClear" id="editClearLocation" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
      <div class="editFormGroup">
        <span class="editFormLabel">Unit Number</span>
        <input type="text" class="editFormInput" id="editStallUnit" value="${stall?.unitNumber || vendorData.unitNumber || ""}" placeholder="e.g. #01-23" />
      </div>
      <div class="editFormGroup">
        <span class="editFormLabel">Cuisines</span>
        <div class="cuisineContainer" id="editCuisineContainer" data-droppable>
          <input type="text" class="cuisineInput" id="editCuisineInput" placeholder="Add cuisine..." />
        </div>
        <div class="cuisineSuggestions" id="editCuisineSuggestions">
          <span class="cuisineSuggestionsLabel">Drag or click to add:</span>
          <span class="cuisineSuggestion" data-draggable data-cuisine="Halal"><span class="cuisineTagInner halal"><img class="cuisineTagIcon" src="../../assets/icons/halal.png" alt="Halal" /> Halal</span></span>
          <span class="cuisineSuggestion" data-draggable data-cuisine="Kosher"><span class="cuisineTagInner kosher"><img class="cuisineTagIcon" src="../../assets/icons/kosher.svg" alt="Kosher" /> Kosher</span></span>
          <span class="cuisineSuggestion" data-draggable data-cuisine="Chinese"><span class="cuisineTagInner">Chinese</span></span>
          <span class="cuisineSuggestion" data-draggable data-cuisine="Malay"><span class="cuisineTagInner">Malay</span></span>
          <span class="cuisineSuggestion" data-draggable data-cuisine="Peranakan"><span class="cuisineTagInner">Peranakan</span></span>
          <span class="cuisineSuggestion" data-draggable data-cuisine="Indian"><span class="cuisineTagInner">Indian</span></span>
        </div>
      </div>
      <div class="editFormGroup">
        <span class="editFormLabel">Operating Hours</span>
        <div class="hoursTable" id="editHoursContainer"></div>
      </div>
    </div>
    <div class="editPopupFooter">
      <button class="editPopupSaveBtn" id="editStallSave">Save changes</button>
    </div>
  `;
}

const defaultHours = [
  { day: "Mon", active: true, slots: [{ from: "09:00", to: "21:00" }] },
  { day: "Tue", active: true, slots: [{ from: "09:00", to: "21:00" }] },
  { day: "Wed", active: true, slots: [{ from: "09:00", to: "21:00" }] },
  { day: "Thu", active: true, slots: [{ from: "09:00", to: "21:00" }] },
  { day: "Fri", active: true, slots: [{ from: "09:00", to: "21:00" }] },
  { day: "Sat", active: true, slots: [{ from: "09:00", to: "21:00" }] },
  { day: "Sun", active: false, slots: [] },
];

// Convert operatingHours from Firestore into the array format used by the UI.
// Handles: array format (new), map/object format (legacy from foodStalls.js), or empty/null.
const dayMap = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function normalizeOperatingHours(raw) {
  if (!raw) return [];
  // Already an array (new format)
  if (Array.isArray(raw) && raw.length > 0) return raw;
  // Legacy object/map format: { monday: { open, close, isClosed }, ... }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const keys = Object.keys(raw);
    if (keys.length === 0) return [];
    // Check if it's the legacy map with day-name keys
    const dayOrder = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    const matched = dayOrder.filter((d) => raw[d]);
    if (matched.length > 0) {
      return dayOrder.map((dayKey) => {
        const entry = raw[dayKey];
        if (!entry) return { day: dayMap[dayKey], active: false, slots: [] };
        // New format: { slots: [...] }
        if (entry.slots && Array.isArray(entry.slots)) {
          return {
            day: dayMap[dayKey],
            active: !entry.isClosed,
            slots: entry.isClosed ? [] : entry.slots,
          };
        }
        // Legacy format: { open, close }
        return {
          day: dayMap[dayKey],
          active: !entry.isClosed,
          slots: entry.isClosed
            ? []
            : [{ from: entry.open || "09:00", to: entry.close || "21:00" }],
        };
      });
    }
  }
  return [];
}

function openEditStall() {
  const popup = document.getElementById("editStallPopup");
  const overlay = document.getElementById("editStallOverlay");
  if (!popup || !overlay) return;

  // Reset edit state
  editStallLocation = vendorData.centreLat
    ? {
        name: vendorData.centreName || "",
        address: vendorData.centreAddress || "",
        lat: vendorData.centreLat,
        lng: vendorData.centreLng,
      }
    : null;
  editStallCuisines = stallData?.cuisines ? [...stallData.cuisines] : [];
  editStallHours =
    stallData?.operatingHours && stallData.operatingHours.length > 0
      ? JSON.parse(JSON.stringify(stallData.operatingHours))
      : JSON.parse(JSON.stringify(defaultHours));
  editStallMapInstance = null;
  editStallMapMarker = null;

  popup.classList.add("editPopupWide");
  popup.innerHTML = renderEditStallPopup(stallData);
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";

  document
    .getElementById("editStallClose")
    .addEventListener("click", closeEditStall);
  document
    .getElementById("editStallSave")
    .addEventListener("click", saveEditStall);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeEditStall();
  });

  // Initialize all sub-systems
  initEditStallMap();
  initEditCuisines();
  renderEditHours();
}

// --- MAP ---

async function initEditStallMap() {
  const mapEl = document.getElementById("editStallMap");
  const locationInput = document.getElementById("editStallLocationInput");
  if (!mapEl) return;

  try {
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    const { PlaceAutocompleteElement } =
      await google.maps.importLibrary("places");
    const { Geocoder } = await google.maps.importLibrary("geocoding");

    const startPos = editStallLocation
      ? { lat: editStallLocation.lat, lng: editStallLocation.lng }
      : { lat: 1.3521, lng: 103.8198 };
    const startZoom = editStallLocation ? 17 : 12;

    editStallMapInstance = new Map(mapEl, {
      center: startPos,
      zoom: startZoom,
      mapId: "hawkr-edit-stall",
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false,
    });

    // Place autocomplete
    const placeAutocomplete = new PlaceAutocompleteElement({
      includedRegionCodes: ["sg"],
      locationBias: { lat: 1.3521, lng: 103.8198 },
    });
    if (locationInput) {
      locationInput.parentNode.replaceChild(placeAutocomplete, locationInput);
    }

    placeAutocomplete.addEventListener(
      "gmp-select",
      async ({ placePrediction }) => {
        const place = placePrediction.toPlace();
        await place.fetchFields({
          fields: [
            "displayName",
            "formattedAddress",
            "location",
            "addressComponents",
            "id",
          ],
        });
        const pos = {
          lat: place.location.lat(),
          lng: place.location.lng(),
        };
        editStallMapInstance.setCenter(pos);
        editStallMapInstance.setZoom(17);
        placeEditStallMarker(pos, AdvancedMarkerElement);

        const pc = extractPostalCode(place.addressComponents);
        editStallLocation = {
          name: place.displayName || "",
          address: place.formattedAddress || "",
          lat: pos.lat,
          lng: pos.lng,
          postalCode: pc,
          placeId: place.id || "",
        };
        showEditSelectedLocation();
      },
    );

    // Click map to drop pin
    editStallMapInstance.addListener("click", (e) => {
      const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      placeEditStallMarker(pos, AdvancedMarkerElement);
      editStallReverseGeocode(pos, Geocoder);
    });

    // Restore marker if location exists
    if (editStallLocation) {
      placeEditStallMarker(startPos, AdvancedMarkerElement);
    }

    // Clear button
    document
      .getElementById("editClearLocation")
      ?.addEventListener("click", () => {
        editStallLocation = null;
        if (editStallMapMarker) {
          editStallMapMarker.map = null;
          editStallMapMarker = null;
        }
        editStallMapInstance.setCenter({ lat: 1.3521, lng: 103.8198 });
        editStallMapInstance.setZoom(12);
        const sel = document.getElementById("editSelectedLocation");
        if (sel) sel.style.display = "none";
      });
  } catch (err) {
    console.warn("Could not init edit stall map:", err);
  }
}

function placeEditStallMarker(pos, AdvancedMarkerElement) {
  if (editStallMapMarker) {
    editStallMapMarker.position = pos;
  } else {
    editStallMapMarker = new AdvancedMarkerElement({
      position: pos,
      map: editStallMapInstance,
      gmpDraggable: true,
    });
    editStallMapMarker.addListener("dragend", () => {
      const newPos = {
        lat: editStallMapMarker.position.lat,
        lng: editStallMapMarker.position.lng,
      };
      editStallReverseGeocode(newPos);
    });
  }
}

function editStallReverseGeocode(pos, GeocoderClass) {
  const geocoder = GeocoderClass
    ? new GeocoderClass()
    : new google.maps.Geocoder();
  geocoder.geocode({ location: pos }, (results, status) => {
    if (status === "OK" && results[0]) {
      const result = results[0];
      const pc = extractPostalCode(result.address_components);
      editStallLocation = {
        name: result.formatted_address.split(",")[0] || "",
        address: result.formatted_address || "",
        lat: pos.lat,
        lng: pos.lng,
        postalCode: pc,
        placeId: result.place_id || "",
      };
      showEditSelectedLocation();
    }
  });
}

function extractPostalCode(components) {
  if (!components) return "";
  for (const c of components) {
    const types = c.types || [];
    if (types.includes("postal_code")) return c.longText || c.long_name || "";
  }
  return "";
}

function showEditSelectedLocation() {
  const sel = document.getElementById("editSelectedLocation");
  const nameEl = document.getElementById("editSelectedLocationName");
  const addrEl = document.getElementById("editSelectedLocationAddress");
  if (!sel || !editStallLocation) return;
  sel.style.display = "flex";
  if (nameEl) nameEl.textContent = editStallLocation.name;
  if (addrEl) addrEl.textContent = editStallLocation.address;
}

// --- CUISINES ---

function editCuisineTagInner(tag) {
  const icons = {
    Halal: "../../assets/icons/halal.png",
    Kosher: "../../assets/icons/kosher.svg",
  };
  const icon = icons[tag];
  if (icon) {
    return `<span class="cuisineTagInner ${tag.toLowerCase()}"><img class="cuisineTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="cuisineTagInner">${tag}</span>`;
}

function addEditCuisineTag(cuisine) {
  const container = document.getElementById("editCuisineContainer");
  const input = document.getElementById("editCuisineInput");
  if (!container || !input) return;

  const cap = cuisine.charAt(0).toUpperCase() + cuisine.slice(1).toLowerCase();
  if (editStallCuisines.includes(cap)) return;

  editStallCuisines.push(cap);

  const tag = document.createElement("span");
  tag.className = "cuisineTag";
  tag.dataset.cuisine = cap;
  tag.innerHTML = `${editCuisineTagInner(cap)}<button class="cuisineTagRemove" type="button">&times;</button>`;

  tag.querySelector(".cuisineTagRemove").addEventListener("click", () => {
    editStallCuisines = editStallCuisines.filter((c) => c !== cap);
    tag.remove();
    updateEditSuggestionStates();
  });

  container.insertBefore(tag, input);
  updateEditSuggestionStates();
}

function updateEditSuggestionStates() {
  const suggestions = document.querySelectorAll(
    "#editCuisineSuggestions .cuisineSuggestion",
  );
  suggestions.forEach((s) => {
    if (editStallCuisines.includes(s.dataset.cuisine)) {
      s.classList.add("added");
    } else {
      s.classList.remove("added");
    }
  });
}

function initEditCuisines() {
  const container = document.getElementById("editCuisineContainer");
  const input = document.getElementById("editCuisineInput");
  const suggestionsEl = document.getElementById("editCuisineSuggestions");
  const content = document.getElementById("editStallContent");
  if (!container || !input) return;

  // Load existing cuisine tags
  for (const c of editStallCuisines) {
    const tag = document.createElement("span");
    tag.className = "cuisineTag";
    tag.dataset.cuisine = c;
    tag.innerHTML = `${editCuisineTagInner(c)}<button class="cuisineTagRemove" type="button">&times;</button>`;
    tag.querySelector(".cuisineTagRemove").addEventListener("click", () => {
      editStallCuisines = editStallCuisines.filter((x) => x !== c);
      tag.remove();
      updateEditSuggestionStates();
    });
    container.insertBefore(tag, input);
  }
  updateEditSuggestionStates();

  // Keyboard input
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = input.value.trim();
      if (val) {
        addEditCuisineTag(val);
        input.value = "";
      }
    } else if (e.key === "Backspace" && !input.value) {
      const tags = container.querySelectorAll(".cuisineTag");
      if (tags.length) {
        const lastTag = tags[tags.length - 1];
        const cuisine = lastTag.dataset.cuisine;
        editStallCuisines = editStallCuisines.filter((c) => c !== cuisine);
        lastTag.remove();
        updateEditSuggestionStates();
      }
    }
  });

  // Click to add suggestions
  if (suggestionsEl) {
    suggestionsEl.addEventListener("click", (e) => {
      const suggestion = e.target.closest(".cuisineSuggestion");
      if (suggestion && !suggestion.classList.contains("added")) {
        addEditCuisineTag(suggestion.dataset.cuisine);
      }
    });
  }

  // Drag and drop
  if (content) {
    try {
      new Snap(content, {
        draggableSelector:
          "#editCuisineSuggestions [data-draggable]:not(.added)",
        dropZoneSelector: "#editCuisineContainer[data-droppable]",
        distance: 3,
        onDropZoneEnter: ({ dropZone }) =>
          dropZone.classList.add("snap-drop-active"),
        onDropZoneLeave: ({ dropZone }) =>
          dropZone.classList.remove("snap-drop-active"),
        onDrop: ({ element, dropZone }) => {
          dropZone.classList.remove("snap-drop-active");
          const cuisine = element.dataset.cuisine;
          if (cuisine) addEditCuisineTag(cuisine);
        },
      });
    } catch (err) {
      console.warn("Could not init cuisine drag-drop:", err);
    }
  }
}

// --- OPERATING HOURS ---

function renderEditHours() {
  const container = document.getElementById("editHoursContainer");
  if (!container) return;

  container.innerHTML = editStallHours
    .map(
      (day, dayIdx) => `
        <div class="hoursRow">
          <div class="hoursDay">${day.day}</div>
          <label class="liquidGlassToggle hoursToggle" data-day="${dayIdx}">
            <input type="checkbox" ${day.active ? "checked" : ""} />
            <span class="toggleTrack">
              <span class="toggleThumb ${day.active ? "glass" : ""}"></span>
            </span>
          </label>
          <div class="hoursSlots" data-day="${dayIdx}">
            ${
              day.active && day.slots.length
                ? day.slots
                    .map(
                      (slot, slotIdx) => `
                  <div class="hoursSlot">
                    <input type="time" class="hoursTime" value="${slot.from}" data-day="${dayIdx}" data-slot="${slotIdx}" data-field="from" />
                    <span class="hoursTo">to</span>
                    <input type="time" class="hoursTime" value="${slot.to}" data-day="${dayIdx}" data-slot="${slotIdx}" data-field="to" />
                    ${slotIdx > 0 ? `<button class="hoursRemoveSlot" data-day="${dayIdx}" data-slot="${slotIdx}" type="button">&times;</button>` : ""}
                  </div>`,
                    )
                    .join("")
                : `<span class="hoursClosed">Closed</span>`
            }
          </div>
          ${day.active ? `<button class="hoursAddSlot" data-day="${dayIdx}" type="button">+ Add</button>` : ""}
        </div>`,
    )
    .join("");

  // Toggles
  container.querySelectorAll(".hoursToggle").forEach((toggleLabel) => {
    const dayIdx = parseInt(toggleLabel.dataset.day);
    initMiniLiquidGlassToggle(toggleLabel, (isChecked) => {
      editStallHours[dayIdx].active = isChecked;
      if (isChecked && editStallHours[dayIdx].slots.length === 0) {
        editStallHours[dayIdx].slots.push({ from: "09:00", to: "21:00" });
      }
      renderEditHours();
    });
  });

  // Time inputs
  container.querySelectorAll(".hoursTime").forEach((input) => {
    input.addEventListener("change", (e) => {
      const { day, slot, field } = e.target.dataset;
      editStallHours[parseInt(day)].slots[parseInt(slot)][field] =
        e.target.value;
    });
  });

  // Add slot
  container.querySelectorAll(".hoursAddSlot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dayIdx = parseInt(btn.dataset.day);
      editStallHours[dayIdx].slots.push({ from: "", to: "" });
      renderEditHours();
    });
  });

  // Remove slot
  container.querySelectorAll(".hoursRemoveSlot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dayIdx = parseInt(btn.dataset.day);
      const slotIdx = parseInt(btn.dataset.slot);
      editStallHours[dayIdx].slots.splice(slotIdx, 1);
      renderEditHours();
    });
  });
}

function closeEditStall() {
  const overlay = document.getElementById("editStallOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }
}

function convertHoursArrayToObject(hours) {
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
  hours.forEach((day) => {
    const key = dayMap[day.day];
    if (!day.active || day.slots.length === 0) {
      result[key] = { isClosed: true, slots: [] };
    } else {
      result[key] = {
        isClosed: false,
        slots: day.slots.map((s) => ({ from: s.from, to: s.to })),
      };
    }
  });
  return result;
}

async function saveEditStall() {
  const unitNumber =
    document.getElementById("editStallUnit")?.value.trim() || "";

  const saveBtn = document.getElementById("editStallSave");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    const vendorUpdates = { unitNumber };
    const stallUpdates = {
      unitNumber,
      cuisineNames: editStallCuisines,
      isHalal: editStallCuisines.includes("Halal"),
      operatingHours: convertHoursArrayToObject(editStallHours),
    };

    // Handle location
    if (editStallLocation) {
      const locationName = editStallLocation.name;
      vendorUpdates.storeLocation = locationName;
      stallUpdates.location = locationName;

      // Find or create hawker centre for this location
      const hawkerCentre = await findOrCreateHawkerCentre(locationName, {
        address: editStallLocation.address,
        postalCode: editStallLocation.postalCode || "",
        location: {
          latitude: editStallLocation.lat,
          longitude: editStallLocation.lng,
        },
      });

      if (hawkerCentre) {
        vendorUpdates.hawkerCentreId = hawkerCentre.id;
        stallUpdates.hawkerCentreId = hawkerCentre.id;
        vendorData.hawkerCentreId = hawkerCentre.id;
        vendorData.centreName = hawkerCentre.name || locationName;
        vendorData.centreAddress = editStallLocation.address;
        vendorData.centreLat = editStallLocation.lat;
        vendorData.centreLng = editStallLocation.lng;
      }
    }

    if (currentUserId) {
      await updateDoc(doc(db, "vendors", currentUserId), vendorUpdates);
    }

    if (stallData && stallData.id) {
      await updateDoc(doc(db, "foodStalls", stallData.id), stallUpdates);
      stallData.unitNumber = unitNumber;
      stallData.cuisines = [...editStallCuisines];
      stallData.operatingHours = JSON.parse(JSON.stringify(editStallHours));
      if (editStallLocation) stallData.location = editStallLocation.name;
    }

    vendorData.unitNumber = unitNumber;
    if (editStallLocation) vendorData.storeLocation = editStallLocation.name;

    closeEditStall();
    renderSettingsPage(vendorData, stallData);
    showToast("Stall details saved.", "success");
  } catch (error) {
    console.error("Error saving stall details:", error);
    showToast("Failed to save changes. Please try again.", "error");
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save changes";
    }
  }
}

// ============================================
// TELEGRAM
// ============================================

function initTelegramLoginWidget() {
  const container = document.getElementById("telegramLoginWidget");
  if (!container) return;

  container.innerHTML = "";

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://telegram.org/js/telegram-widget.js?22";
  script.setAttribute("data-telegram-login", "hawkrOrgBot");
  script.setAttribute("data-size", "large");
  script.setAttribute("data-onauth", "onTelegramAuth(user)");
  script.setAttribute("data-request-access", "write");

  container.appendChild(script);
}

window.onTelegramAuth = async function (user) {
  if (!currentUserId) {
    alert("Please log in to link your Telegram account.");
    return;
  }

  try {
    await updateDoc(doc(db, "vendors", currentUserId), {
      telegramChatId: user.id.toString(),
      telegramLinked: true,
      telegramUsername: user.username || null,
      telegramFirstName: user.first_name || null,
      telegramLastName: user.last_name || null,
      telegramPhotoUrl: user.photo_url || null,
      telegramAuthDate: user.auth_date,
    });

    vendorData.telegramLinked = true;
    vendorData.telegramUsername = user.username || null;

    renderSettingsPage(vendorData, stallData);
  } catch (error) {
    console.error("Error linking Telegram:", error);
    alert("Failed to link Telegram account. Please try again.");
  }
};

async function handleTelegramUnlink() {
  if (!currentUserId) return;

  if (
    !confirm(
      "Are you sure you want to unlink your Telegram account? You will no longer receive order notifications on Telegram.",
    )
  ) {
    return;
  }

  try {
    await updateDoc(doc(db, "vendors", currentUserId), {
      telegramChatId: null,
      telegramLinked: false,
      telegramUsername: null,
      telegramFirstName: null,
      telegramLastName: null,
      telegramPhotoUrl: null,
      telegramAuthDate: null,
    });

    vendorData.telegramLinked = false;
    vendorData.telegramUsername = null;

    renderSettingsPage(vendorData, stallData);
  } catch (error) {
    console.error("Error unlinking Telegram:", error);
    alert("Failed to unlink Telegram. Please try again.");
  }
}

// ============================================
// DOCUMENT UPLOAD / DELETE
// ============================================

const storagePathMap = {
  storePhotoUrl: (uid, ext) => `vendors/${uid}/storePhoto.${ext}`,
  hygieneCertUrl: (uid, ext) => `vendors/${uid}/hygieneCert.${ext}`,
  halalCertUrl: (uid, ext) => `vendors/${uid}/halalCert.${ext}`,
};

async function handleDocumentUpload(file, fieldKey) {
  if (!currentUserId || !file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast("File must be under 2 MB.", "error");
    return;
  }

  const ext = file.name.split(".").pop();
  const path = storagePathMap[fieldKey](currentUserId, ext);

  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);

    const updates = { [fieldKey]: downloadUrl };

    // Also update the food stall doc if linked
    if (vendorData.stallId) {
      const stallFieldMap = {
        storePhotoUrl: { imageUrl: downloadUrl, coverImageUrl: downloadUrl },
        hygieneCertUrl: { hygieneCert: downloadUrl },
        halalCertUrl: { halalCert: downloadUrl },
      };
      const stallUpdates = stallFieldMap[fieldKey];
      if (stallUpdates) {
        try {
          await updateDoc(
            doc(db, "foodStalls", vendorData.stallId),
            stallUpdates,
          );
        } catch (err) {
          console.warn("Could not update stall doc:", err);
        }
      }
    }

    await updateDoc(doc(db, "vendors", currentUserId), updates);
    vendorData[fieldKey] = downloadUrl;
    renderSettingsPage(vendorData, stallData);
    showToast("File uploaded.", "success");
  } catch (error) {
    console.error("Error uploading document:", error);
    showToast("Failed to upload file. Please try again.", "error");
  }
}

async function handleDocumentDelete(fieldKey) {
  if (!currentUserId) return;

  try {
    const updates = { [fieldKey]: deleteField() };

    if (vendorData.stallId) {
      const stallFieldMap = {
        storePhotoUrl: {
          imageUrl: deleteField(),
          coverImageUrl: deleteField(),
        },
        hygieneCertUrl: { hygieneCert: deleteField() },
        halalCertUrl: { halalCert: deleteField() },
      };
      const stallUpdates = stallFieldMap[fieldKey];
      if (stallUpdates) {
        try {
          await updateDoc(
            doc(db, "foodStalls", vendorData.stallId),
            stallUpdates,
          );
        } catch (err) {
          console.warn("Could not update stall doc:", err);
        }
      }
    }

    await updateDoc(doc(db, "vendors", currentUserId), updates);
    vendorData[fieldKey] = null;
    renderSettingsPage(vendorData, stallData);
    showToast("File removed.", "success");
  } catch (error) {
    console.error("Error removing document:", error);
    showToast("Failed to remove file. Please try again.", "error");
  }
}

function bindDocumentListeners() {
  document.querySelectorAll(".documentFileInput").forEach((input) => {
    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      const fieldKey = e.target.dataset.field;
      if (file && fieldKey) handleDocumentUpload(file, fieldKey);
    });
  });

  document.querySelectorAll(".documentDeleteBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const fieldKey = e.currentTarget.dataset.field;
      if (fieldKey) handleDocumentDelete(fieldKey);
    });
  });
}

// ============================================
// EVENT LISTENERS
// ============================================

function attachEventListeners() {
  // Browser notifications toggle
  const browserToggleLabel = document.getElementById("browserToggleLabel");
  if (browserToggleLabel) {
    initLiquidGlassToggle(browserToggleLabel, (isChecked) => {
      vendorData.browserNotifications = isChecked;
      if (currentUserId) {
        updateDoc(doc(db, "vendors", currentUserId), {
          browserNotifications: isChecked,
        }).catch((err) =>
          console.error("Error saving browser notification pref:", err),
        );
      }
    });
  }

  // Telegram unlink
  const telegramUnlink = document.getElementById("telegramUnlink");
  if (telegramUnlink) {
    telegramUnlink.addEventListener("click", handleTelegramUnlink);
  }

  // Init Telegram widget if not connected
  const telegramWidgetContainer = document.getElementById(
    "telegramLoginWidget",
  );
  if (telegramWidgetContainer && !vendorData.telegramLinked) {
    initTelegramLoginWidget();
  }

  // Edit business details
  const editBusinessDetails = document.getElementById("editBusinessDetails");
  if (editBusinessDetails) {
    editBusinessDetails.addEventListener("click", openEditBusiness);
  }

  // Edit stall details
  const editStallDetails = document.getElementById("editStallDetails");
  if (editStallDetails) {
    editStallDetails.addEventListener("click", openEditStall);
  }

  // Documents (upload / delete)
  bindDocumentListeners();

  // Delete account
  const deleteAccount = document.getElementById("deleteAccount");
  if (deleteAccount) {
    deleteAccount.addEventListener("click", function () {
      console.log("Delete account clicked");
    });
  }
}

// ============================================
// LOADING
// ============================================

function showLoading() {
  const container = document.getElementById("settingsContent");
  if (container) {
    container.innerHTML = `<div class="loadingSpinner"></div>`;
  }
}

// ============================================
// INITIALIZATION
// ============================================

async function initializeSettingsPage() {
  showLoading();

  if (currentUserId) {
    // Load vendor data
    try {
      const vendorDoc = await getDoc(doc(db, "vendors", currentUserId));
      if (vendorDoc.exists()) {
        const data = vendorDoc.data();
        vendorData.storeName = data.storeName || "";
        vendorData.contactPerson = data.contactPerson || "";
        vendorData.contactNumber = data.contactNumber || "";
        vendorData.uen = data.uen || "";
        vendorData.storeLocation = data.storeLocation || "";
        vendorData.unitNumber = data.unitNumber || "";
        vendorData.telegramLinked = data.telegramLinked || false;
        vendorData.telegramUsername = data.telegramUsername || null;
        vendorData.browserNotifications = data.browserNotifications || false;
        vendorData.storePhotoUrl = data.storePhotoUrl || null;
        vendorData.hygieneCertUrl = data.hygieneCertUrl || null;
        vendorData.halalCertUrl = data.halalCertUrl || null;
        vendorData.stallId = data.stallId || null;
        vendorData.hawkerCentreId = data.hawkerCentreId || null;
      }
    } catch (error) {
      console.error("Error loading vendor data:", error);
    }

    // Load stall data — prefer direct fetch by stallId from vendor doc
    try {
      let stallDocData = null;
      let stallDocId = null;

      if (vendorData.stallId) {
        const stallDocSnap = await getDoc(
          doc(db, "foodStalls", vendorData.stallId),
        );
        if (stallDocSnap.exists()) {
          stallDocData = stallDocSnap.data();
          stallDocId = stallDocSnap.id;
        }
      } else {
        // Fallback: query by ownerId
        const stallsQuery = query(
          collection(db, "foodStalls"),
          where("ownerId", "==", currentUserId),
        );
        const stallsSnapshot = await getDocs(stallsQuery);
        if (!stallsSnapshot.empty) {
          stallDocData = stallsSnapshot.docs[0].data();
          stallDocId = stallsSnapshot.docs[0].id;
        }
      }

      if (stallDocData) {
        stallData = {
          id: stallDocId,
          location: stallDocData.location || stallDocData.hawkerCentre || "",
          unitNumber: stallDocData.unitNumber || "",
          cuisines: stallDocData.cuisineNames || stallDocData.cuisines || [],
          operatingHours: normalizeOperatingHours(stallDocData.operatingHours),
          hawkerCentreId:
            stallDocData.hawkerCentreId || vendorData.hawkerCentreId || null,
        };
      }
    } catch (error) {
      console.error("Error loading stall data:", error);
    }

    // Fetch hawker centre location for the map
    const centreId =
      stallData?.hawkerCentreId || vendorData.hawkerCentreId || null;
    if (centreId) {
      try {
        const centreDoc = await getDoc(doc(db, "hawkerCentres", centreId));
        if (centreDoc.exists()) {
          const cd = centreDoc.data();
          vendorData.centreName = cd.name || "";
          vendorData.centreAddress = cd.address || "";
          vendorData.centreLat =
            cd.location?.latitude || cd.location?._lat || null;
          vendorData.centreLng =
            cd.location?.longitude || cd.location?._long || null;
        }
      } catch (error) {
        console.error("Error loading hawker centre:", error);
      }
    }
  }

  renderSettingsPage(vendorData, stallData);
}

// ============================================
// DOM CONTENT LOADED
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  initVendorNavbar();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      initNotificationBadge(`vendors/${user.uid}/notifications`);
      initToastContainer();
      subscribeToNewNotifications(`vendors/${user.uid}/notifications`);
      currentUserId = user.uid;
      vendorData.email = user.email || "";
      initializeSettingsPage();
    } else {
      window.location.href = "../Auth/login.html";
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      const businessOverlay = document.getElementById("editBusinessOverlay");
      if (businessOverlay && businessOverlay.classList.contains("active")) {
        closeEditBusiness();
        return;
      }
      const stallOverlay = document.getElementById("editStallOverlay");
      if (stallOverlay && stallOverlay.classList.contains("active")) {
        closeEditStall();
        return;
      }
    }

    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    const targetTag = e.target.tagName.toLowerCase();
    const isEditable = e.target.isContentEditable === true;
    if (targetTag === "input" || targetTag === "textarea" || isEditable) return;

    const isMac = /Mac/i.test(window.navigator.userAgent);
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
});
