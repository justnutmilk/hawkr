/**
 * Hawkr - Vendor Onboarding
 * Multi-step onboarding flow for stall owners
 */

import { auth, db } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { findOrCreateHawkerCentre } from "../../firebase/services/hawkerCentres.js";
import { createStall } from "../../firebase/services/foodStalls.js";

// State
let currentUser = null;
let currentStep = 1;
const totalSteps = 6;

// Form data
const vendorData = {
  storeName: "",
  storeLocation: "",
  unitNumber: "",
  cuisines: [],
  operatingHours: [
    { day: "Mon", active: true, slots: [{ from: "09:00", to: "21:00" }] },
    { day: "Tue", active: true, slots: [{ from: "09:00", to: "21:00" }] },
    { day: "Wed", active: true, slots: [{ from: "09:00", to: "21:00" }] },
    { day: "Thu", active: true, slots: [{ from: "09:00", to: "21:00" }] },
    { day: "Fri", active: true, slots: [{ from: "09:00", to: "21:00" }] },
    { day: "Sat", active: true, slots: [{ from: "09:00", to: "21:00" }] },
    { day: "Sun", active: false, slots: [] },
  ],
  storePhoto: null,
  hygieneCert: null,
  halalCert: null,
  uen: "",
  contactPerson: "",
  contactNumber: "",
  browserNotifications: false,
  telegramConnected: false,
  telegramChatId: null,
};

// DOM Elements
const stepLabel = document.getElementById("stepLabel");
const progressSteps = document.querySelectorAll(".progressStep");

// Check auth state
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;

  // Check if vendor profile exists
  const vendorDoc = await getDoc(doc(db, "vendors", user.uid));
  if (vendorDoc.exists()) {
    const data = vendorDoc.data();
    if (data.onboardingComplete) {
      window.location.href = "../Vendor Dashboard/vendorDashboard.html";
      return;
    }
    // Resume from saved step
    if (data.onboardingStep) {
      currentStep = data.onboardingStep;
    }
    // Load existing data
    Object.keys(vendorData).forEach((key) => {
      if (data[key] !== undefined) {
        vendorData[key] = data[key];
      }
    });
    populateFormFromData();
  } else {
    // No profile - redirect to role selection
    window.location.href = "select-role.html";
  }

  initializeForm();
  updateStepUI(currentStep);
});

/**
 * Populate form fields from saved data
 */
function populateFormFromData() {
  document.getElementById("storeName").value = vendorData.storeName || "";
  document.getElementById("storeLocation").value =
    vendorData.storeLocation || "";
  document.getElementById("unitNumber").value = vendorData.unitNumber || "";
  document.getElementById("uen").value = vendorData.uen || "";
  document.getElementById("contactPerson").value =
    vendorData.contactPerson || "";
  document.getElementById("contactNumber").value =
    vendorData.contactNumber || "";
  document.getElementById("browserNotifications").checked =
    vendorData.browserNotifications;

  // Populate cuisines
  vendorData.cuisines.forEach((cuisine) => addCuisineTag(cuisine));
}

/**
 * Update step UI
 */
function updateStepUI(step) {
  currentStep = step;
  stepLabel.textContent = `Step ${step} of ${totalSteps}`;

  progressSteps.forEach((el, i) => {
    el.classList.remove("active", "completed");
    if (i + 1 < step) {
      el.classList.add("completed");
    } else if (i + 1 === step) {
      el.classList.add("active");
    }
  });

  // Show/hide steps
  for (let i = 1; i <= totalSteps; i++) {
    const stepEl = document.getElementById(`step${i}`);
    if (stepEl) {
      stepEl.style.display = i === step ? "block" : "none";
    }
  }
}

/**
 * Save current progress
 */
async function saveProgress() {
  if (!currentUser) return;

  try {
    await updateDoc(doc(db, "vendors", currentUser.uid), {
      ...vendorData,
      onboardingStep: currentStep,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error saving progress:", error);
  }
}

/**
 * Collect data from current step
 */
function collectStepData(step) {
  switch (step) {
    case 1:
      vendorData.storeName = document.getElementById("storeName").value.trim();
      vendorData.storeLocation = document
        .getElementById("storeLocation")
        .value.trim();
      vendorData.unitNumber = document
        .getElementById("unitNumber")
        .value.trim();
      break;
    case 2:
      // Cuisines and hours are already collected in real-time
      break;
    case 3:
      // Files are handled by upload handlers
      break;
    case 4:
      vendorData.uen = document.getElementById("uen").value.trim();
      vendorData.contactPerson = document
        .getElementById("contactPerson")
        .value.trim();
      vendorData.contactNumber = document
        .getElementById("contactNumber")
        .value.trim();
      break;
    case 5:
      vendorData.browserNotifications = document.getElementById(
        "browserNotifications",
      ).checked;
      break;
  }
}

/**
 * Validate current step
 */
function validateStep(step) {
  switch (step) {
    case 1:
      if (!vendorData.storeName) {
        alert("Please enter your store name.");
        return false;
      }
      if (!vendorData.storeLocation) {
        alert("Please enter your store location.");
        return false;
      }
      if (!vendorData.unitNumber) {
        alert("Please enter your unit number.");
        return false;
      }
      return true;
    case 2:
      if (vendorData.cuisines.length === 0) {
        alert("Please add at least one cuisine.");
        return false;
      }
      return true;
    case 3:
      if (!vendorData.storePhoto) {
        alert("Please upload a store photo.");
        return false;
      }
      if (!vendorData.hygieneCert) {
        alert("Please upload your hygiene certificate.");
        return false;
      }
      return true;
    case 4:
      if (!vendorData.uen) {
        alert("Please enter your UEN.");
        return false;
      }
      if (!vendorData.contactPerson) {
        alert("Please enter a contact person.");
        return false;
      }
      if (!vendorData.contactNumber) {
        alert("Please enter a contact number.");
        return false;
      }
      return true;
    default:
      return true;
  }
}

/**
 * Go to next step
 */
async function nextStep() {
  collectStepData(currentStep);

  if (!validateStep(currentStep)) {
    return;
  }

  await saveProgress();

  if (currentStep < totalSteps) {
    updateStepUI(currentStep + 1);
  }
}

/**
 * Go to previous step
 */
function prevStep() {
  if (currentStep > 1) {
    updateStepUI(currentStep - 1);
  }
}

/**
 * Convert vendor operating hours format to Firebase format
 */
function convertOperatingHours(vendorHours) {
  const dayMap = {
    Mon: "monday",
    Tue: "tuesday",
    Wed: "wednesday",
    Thu: "thursday",
    Fri: "friday",
    Sat: "saturday",
    Sun: "sunday",
  };

  const firebaseHours = {};

  vendorHours.forEach((day) => {
    const dayKey = dayMap[day.day];
    if (!dayKey) return;

    if (!day.active || day.slots.length === 0) {
      firebaseHours[dayKey] = { open: "", close: "", isClosed: true };
    } else {
      // Use first slot for simplicity
      const slot = day.slots[0];
      firebaseHours[dayKey] = {
        open: slot.from || "09:00",
        close: slot.to || "21:00",
        isClosed: false,
      };
    }
  });

  return firebaseHours;
}

/**
 * Complete onboarding
 */
async function completeOnboarding() {
  if (!currentUser) return;

  try {
    // 1. Find or create the hawker centre
    const hawkerCentre = await findOrCreateHawkerCentre(
      vendorData.storeLocation,
      {
        address: vendorData.storeLocation,
      },
    );

    console.log(
      "Hawker Centre:",
      hawkerCentre.isNew ? "Created new" : "Found existing",
      hawkerCentre.id,
    );

    // 2. Convert operating hours to Firebase format
    const firebaseOperatingHours = convertOperatingHours(
      vendorData.operatingHours,
    );

    // 3. Create the food stall
    const stallId = await createStall({
      hawkerCentreId: hawkerCentre.id,
      name: vendorData.storeName,
      description: "",
      cuisineIds: [],
      cuisineNames: vendorData.cuisines,
      isHalal: vendorData.cuisines.some((c) => c.toLowerCase() === "halal"),
      unitNumber: vendorData.unitNumber,
      imageUrl: "",
      coverImageUrl: "",
      operatingHours: firebaseOperatingHours,
    });

    console.log("Created stall:", stallId);

    // 4. Update vendor profile with references
    await updateDoc(doc(db, "vendors", currentUser.uid), {
      ...vendorData,
      hawkerCentreId: hawkerCentre.id,
      stallId: stallId,
      onboardingComplete: true,
      updatedAt: serverTimestamp(),
    });

    // Redirect to vendor dashboard
    window.location.href = "../Vendor Dashboard/vendorDashboard.html";
  } catch (error) {
    console.error("Error completing onboarding:", error);
    alert("Failed to complete setup. Please try again.");
  }
}

/**
 * Initialize form interactions
 */
function initializeForm() {
  // Step navigation buttons
  document.getElementById("nextStep1")?.addEventListener("click", nextStep);
  document.getElementById("nextStep2")?.addEventListener("click", nextStep);
  document.getElementById("nextStep3")?.addEventListener("click", nextStep);
  document.getElementById("nextStep4")?.addEventListener("click", nextStep);
  document.getElementById("nextStep5")?.addEventListener("click", nextStep);

  document.getElementById("backStep2")?.addEventListener("click", prevStep);
  document.getElementById("backStep3")?.addEventListener("click", prevStep);
  document.getElementById("backStep4")?.addEventListener("click", prevStep);
  document.getElementById("backStep5")?.addEventListener("click", prevStep);

  document
    .getElementById("skipStep6")
    ?.addEventListener("click", completeOnboarding);
  document
    .getElementById("completeOnboarding")
    ?.addEventListener("click", completeOnboarding);

  // Initialize cuisine input
  initCuisineInput();

  // Initialize operating hours
  initOperatingHours();

  // Initialize file uploads
  initFileUploads();

  // Initialize Telegram
  initTelegram();

  // Initialize browser notifications
  initBrowserNotifications();
}

/**
 * Cuisine input handling
 */
function initCuisineInput() {
  const container = document.getElementById("cuisineContainer");
  const input = document.getElementById("cuisineInput");

  if (!container || !input) return;

  container.addEventListener("click", () => input.focus());

  input.addEventListener("keydown", (e) => {
    const val = input.value.trim();
    if (e.key === "Enter" && val) {
      e.preventDefault();
      addCuisineTag(val);
      input.value = "";
    }
    if (e.key === "Backspace" && !val) {
      const tags = container.querySelectorAll(".cuisineTag");
      if (tags.length) {
        const lastTag = tags[tags.length - 1];
        const cuisine = lastTag.dataset.cuisine;
        vendorData.cuisines = vendorData.cuisines.filter((c) => c !== cuisine);
        lastTag.remove();
      }
    }
  });
}

function addCuisineTag(cuisine) {
  const container = document.getElementById("cuisineContainer");
  const input = document.getElementById("cuisineInput");

  const capitalized =
    cuisine.charAt(0).toUpperCase() + cuisine.slice(1).toLowerCase();

  // Check for duplicates
  if (vendorData.cuisines.includes(capitalized)) return;

  vendorData.cuisines.push(capitalized);

  const tag = document.createElement("span");
  tag.className = `cuisineTag ${capitalized.toLowerCase() === "halal" ? "halal" : ""}`;
  tag.dataset.cuisine = capitalized;
  tag.innerHTML = `
        ${capitalized}
        <button class="cuisineTagRemove">&times;</button>
    `;

  tag.querySelector(".cuisineTagRemove").addEventListener("click", () => {
    vendorData.cuisines = vendorData.cuisines.filter((c) => c !== capitalized);
    tag.remove();
  });

  container.insertBefore(tag, input);
}

/**
 * Operating hours handling
 */
function initOperatingHours() {
  const container = document.getElementById("hoursContainer");
  if (!container) return;

  renderOperatingHours();
}

function renderOperatingHours() {
  const container = document.getElementById("hoursContainer");
  if (!container) return;

  container.innerHTML = vendorData.operatingHours
    .map(
      (day, dayIdx) => `
        <div class="hoursRow">
            <span class="hoursDay">${day.day}</span>
            <label class="toggleSwitch hoursToggle">
                <input type="checkbox" ${day.active ? "checked" : ""} data-day="${dayIdx}" class="hoursDayToggle" />
                <span class="toggleSlider"></span>
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
                        ${slotIdx > 0 ? `<button class="hoursRemoveSlot" data-day="${dayIdx}" data-slot="${slotIdx}">&times;</button>` : ""}
                    </div>
                `,
                        )
                        .join("")
                    : `<span class="hoursClosed">Closed</span>`
                }
            </div>
            ${day.active ? `<button class="hoursAddSlot" data-day="${dayIdx}">+ Add</button>` : ""}
        </div>
    `,
    )
    .join("");

  // Bind events
  container.querySelectorAll(".hoursDayToggle").forEach((toggle) => {
    toggle.addEventListener("change", (e) => {
      const dayIdx = parseInt(e.target.dataset.day);
      vendorData.operatingHours[dayIdx].active = e.target.checked;
      if (
        e.target.checked &&
        vendorData.operatingHours[dayIdx].slots.length === 0
      ) {
        vendorData.operatingHours[dayIdx].slots.push({
          from: "09:00",
          to: "21:00",
        });
      }
      renderOperatingHours();
    });
  });

  container.querySelectorAll(".hoursTime").forEach((input) => {
    input.addEventListener("change", (e) => {
      const { day, slot, field } = e.target.dataset;
      vendorData.operatingHours[parseInt(day)].slots[parseInt(slot)][field] =
        e.target.value;
    });
  });

  container.querySelectorAll(".hoursAddSlot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dayIdx = parseInt(btn.dataset.day);
      vendorData.operatingHours[dayIdx].slots.push({ from: "", to: "" });
      renderOperatingHours();
    });
  });

  container.querySelectorAll(".hoursRemoveSlot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dayIdx = parseInt(btn.dataset.day);
      const slotIdx = parseInt(btn.dataset.slot);
      vendorData.operatingHours[dayIdx].slots.splice(slotIdx, 1);
      renderOperatingHours();
    });
  });
}

/**
 * File upload handling
 */
function initFileUploads() {
  // Store photo
  setupFileUpload(
    "storePhotoInput",
    "storePhotoUpload",
    "storePhotoPreview",
    "storePhotoImg",
    "storePhotoName",
    "storePhotoSize",
    "storePhotoRemove",
    "storePhoto",
    true,
  );

  // Hygiene cert
  setupFileUpload(
    "hygieneCertInput",
    "hygieneCertUpload",
    "hygieneCertPreview",
    null,
    "hygieneCertName",
    "hygieneCertSize",
    "hygieneCertRemove",
    "hygieneCert",
    false,
  );

  // Halal cert
  setupFileUpload(
    "halalCertInput",
    "halalCertUpload",
    "halalCertPreview",
    null,
    "halalCertName",
    "halalCertSize",
    "halalCertRemove",
    "halalCert",
    false,
  );
}

function setupFileUpload(
  inputId,
  uploadId,
  previewId,
  imgId,
  nameId,
  sizeId,
  removeId,
  dataKey,
  isImage,
) {
  const input = document.getElementById(inputId);
  const uploadArea = document.getElementById(uploadId);
  const preview = document.getElementById(previewId);
  const img = imgId ? document.getElementById(imgId) : null;
  const nameEl = document.getElementById(nameId);
  const sizeEl = document.getElementById(sizeId);
  const removeBtn = document.getElementById(removeId);

  if (!input) return;

  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("File is too large. Maximum size is 2MB.");
      return;
    }

    vendorData[dataKey] = file.name;

    if (isImage && img) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }

    nameEl.textContent = file.name;
    sizeEl.textContent = formatFileSize(file.size);

    uploadArea.style.display = "none";
    preview.style.display = "flex";
  });

  removeBtn?.addEventListener("click", () => {
    vendorData[dataKey] = null;
    input.value = "";
    uploadArea.style.display = "block";
    preview.style.display = "none";
  });

  // Drag and drop
  uploadArea?.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea?.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragover");
  });

  uploadArea?.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change"));
    }
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/**
 * Telegram handling
 */
function initTelegram() {
  const connectBtn = document.getElementById("connectTelegram");
  const connectState = document.getElementById("telegramConnect");
  const connectedState = document.getElementById("telegramConnectedState");

  connectBtn?.addEventListener("click", () => {
    // In production, open actual Telegram bot link
    const botUsername = "HawkrVendorBot";
    const startParam = currentUser ? currentUser.uid : "";

    window.open(`https://t.me/${botUsername}?start=${startParam}`, "_blank");

    // Simulate connection (in production, poll backend)
    setTimeout(() => {
      connectState.style.display = "none";
      connectedState.style.display = "flex";
      vendorData.telegramConnected = true;
      vendorData.telegramChatId = "simulated_" + Date.now();
    }, 3000);
  });
}

/**
 * Browser notifications handling
 */
function initBrowserNotifications() {
  const toggle = document.getElementById("browserNotifications");

  toggle?.addEventListener("change", async (e) => {
    if (e.target.checked) {
      if (!("Notification" in window)) {
        e.target.checked = false;
        alert("Your browser doesn't support notifications.");
        return;
      }

      if (Notification.permission === "denied") {
        e.target.checked = false;
        alert(
          "Notifications are blocked. Please enable them in your browser settings.",
        );
        return;
      }

      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          e.target.checked = false;
          return;
        }
      }
    }

    vendorData.browserNotifications = e.target.checked;
  });
}
