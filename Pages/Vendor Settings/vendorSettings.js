// ============================================
// IMPORTS
// ============================================

import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";
import { initLiquidGlassToggle } from "../../assets/js/liquidGlassToggle.js";
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

// ============================================
// STATE
// ============================================

let currentUserId = null;

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

  const cuisinesDisplay =
    stall.cuisines && stall.cuisines.length > 0
      ? stall.cuisines.join(", ")
      : "None set";

  const hoursDisplay = formatOperatingHours(stall.operatingHours);

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
      <div class="detailRows">
        <div class="detailRow">
          <span class="detailLabel">Location</span>
          <span class="detailValue">${stall.location || vendorData.storeLocation || "Not set"}</span>
        </div>
        <div class="detailRow">
          <span class="detailLabel">Unit Number</span>
          <span class="detailValue">${stall.unitNumber || vendorData.unitNumber || "Not set"}</span>
        </div>
        <div class="detailRow">
          <span class="detailLabel">Cuisines</span>
          <span class="detailValueList">${cuisinesDisplay}</span>
        </div>
        <div class="detailRow">
          <span class="detailLabel">Operating Hours</span>
          <span class="detailValueList">${hoursDisplay}</span>
        </div>
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
        <div class="documentPreviewBox">
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
      ${renderDocumentsSection(vendor)}
      ${renderNotificationsSection(vendor)}
      ${renderDangerZone()}
    </div>
  `;

  attachEventListeners();
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
  return `
    <div class="editPopupHeader">
      <h2 class="editPopupTitle">Edit Stall Details</h2>
      <button class="editPopupClose" id="editStallClose" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="#341539" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <div class="editPopupContent">
      <div class="editFormGroup">
        <span class="editFormLabel">Location</span>
        <input type="text" class="editFormInput" id="editStallLocation" value="${stall?.location || vendorData.storeLocation || ""}" />
      </div>
      <div class="editFormGroup">
        <span class="editFormLabel">Unit Number</span>
        <input type="text" class="editFormInput" id="editStallUnit" value="${stall?.unitNumber || vendorData.unitNumber || ""}" placeholder="e.g. #01-23" />
      </div>
    </div>
    <div class="editPopupFooter">
      <button class="editPopupSaveBtn" id="editStallSave">Save changes</button>
    </div>
  `;
}

function openEditStall() {
  const popup = document.getElementById("editStallPopup");
  const overlay = document.getElementById("editStallOverlay");
  if (!popup || !overlay) return;

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
}

function closeEditStall() {
  const overlay = document.getElementById("editStallOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }
}

async function saveEditStall() {
  const location = document.getElementById("editStallLocation").value.trim();
  const unitNumber = document.getElementById("editStallUnit").value.trim();

  const saveBtn = document.getElementById("editStallSave");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    // Update vendor doc
    const vendorUpdates = {};
    if (location) vendorUpdates.storeLocation = location;
    if (unitNumber) vendorUpdates.unitNumber = unitNumber;

    if (currentUserId && Object.keys(vendorUpdates).length > 0) {
      await updateDoc(doc(db, "vendors", currentUserId), vendorUpdates);
    }

    // Update stall doc if we have one
    if (stallData && stallData.id) {
      const stallUpdates = {};
      if (location) stallUpdates.location = location;
      if (unitNumber) stallUpdates.unitNumber = unitNumber;

      if (Object.keys(stallUpdates).length > 0) {
        await updateDoc(doc(db, "foodStalls", stallData.id), stallUpdates);
      }

      if (location) stallData.location = location;
      if (unitNumber) stallData.unitNumber = unitNumber;
    }

    if (location) vendorData.storeLocation = location;
    if (unitNumber) vendorData.unitNumber = unitNumber;

    closeEditStall();
    renderSettingsPage(vendorData, stallData);
  } catch (error) {
    console.error("Error saving stall details:", error);
    alert("Failed to save changes. Please try again.");
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
      }
    } catch (error) {
      console.error("Error loading vendor data:", error);
    }

    // Load stall data
    try {
      const stallsQuery = query(
        collection(db, "foodStalls"),
        where("vendorId", "==", currentUserId),
      );
      const stallsSnapshot = await getDocs(stallsQuery);
      if (!stallsSnapshot.empty) {
        const stallDoc = stallsSnapshot.docs[0];
        const data = stallDoc.data();
        stallData = {
          id: stallDoc.id,
          location: data.location || data.hawkerCentre || "",
          unitNumber: data.unitNumber || "",
          cuisines: data.cuisines || [],
          operatingHours: data.operatingHours || [],
        };
      }
    } catch (error) {
      console.error("Error loading stall data:", error);
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
