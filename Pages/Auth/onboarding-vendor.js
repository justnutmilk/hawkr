/**
 * Hawkr - Vendor Onboarding
 * Clean, settings-style onboarding with validation and Incomplete badges
 */

// ============================================
// IMPORTS
// ============================================

import { auth, db, storage } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { findOrCreateHawkerCentre } from "../../firebase/services/hawkerCentres.js";
import { createStall } from "../../firebase/services/foodStalls.js";
import { initLiquidGlassToggle } from "../../assets/js/liquidGlassToggle.js";
import Snap from "../../drag and drop/snap.esm.js";

// ============================================
// STATE
// ============================================

let currentUser = null;
let currentStep = "stall-details";

// Step configuration
const stepOrder = [
  "stall-details",
  "cuisines",
  "hours",
  "photos",
  "business-details",
  "certificates",
  "notification-settings",
  "review",
];

const stepToSection = {
  "stall-details": "stall",
  cuisines: "stall",
  hours: "stall",
  photos: "stall",
  "business-details": "business",
  certificates: "business",
  "notification-settings": "notifications",
  review: "review",
};

// Vendor data
const vendorData = {
  storeName: "",
  storeLocation: null,
  unitNumber: "",
  cuisines: [],
  operatingHours: [
    { day: "Sun", active: false, slots: [] },
    { day: "Mon", active: true, slots: [{ from: "09:00", to: "21:00" }] },
    { day: "Tue", active: true, slots: [{ from: "09:00", to: "21:00" }] },
    { day: "Wed", active: true, slots: [{ from: "09:00", to: "21:00" }] },
    { day: "Thu", active: true, slots: [{ from: "09:00", to: "21:00" }] },
    { day: "Fri", active: true, slots: [{ from: "09:00", to: "21:00" }] },
    { day: "Sat", active: true, slots: [{ from: "09:00", to: "21:00" }] },
  ],
  // File objects (for new uploads, before saving)
  storePhoto: null,
  hygieneCert: null,
  halalCert: null,
  // URLs from Firebase Storage (for existing uploads)
  storePhotoUrl: null,
  hygieneCertUrl: null,
  halalCertUrl: null,
  uen: "",
  contactPerson: "",
  contactNumber: "",
  browserNotifications: false,
  telegramConnected: false,
  telegramChatId: null,
};

// ============================================
// FILE UPLOAD TO FIREBASE STORAGE
// ============================================

/**
 * Upload a file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} path - Storage path (e.g., "vendors/{uid}/storePhoto")
 * @returns {Promise<string>} - Download URL
 */
async function uploadFileToStorage(file, path) {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}

/**
 * Upload all pending files to Firebase Storage
 * @returns {Promise<Object>} - Object with URLs for each uploaded file
 */
async function uploadPendingFiles() {
  if (!currentUser) throw new Error("User not logged in");

  const urls = {};
  const uploadPromises = [];

  // Upload store photo if it's a new File (not already a URL)
  if (vendorData.storePhoto instanceof File) {
    const ext = vendorData.storePhoto.name.split(".").pop();
    const path = `vendors/${currentUser.uid}/storePhoto.${ext}`;
    uploadPromises.push(
      uploadFileToStorage(vendorData.storePhoto, path).then((url) => {
        urls.storePhotoUrl = url;
      }),
    );
  }

  // Upload hygiene cert if it's a new File
  if (vendorData.hygieneCert instanceof File) {
    const ext = vendorData.hygieneCert.name.split(".").pop();
    const path = `vendors/${currentUser.uid}/hygieneCert.${ext}`;
    uploadPromises.push(
      uploadFileToStorage(vendorData.hygieneCert, path).then((url) => {
        urls.hygieneCertUrl = url;
      }),
    );
  }

  // Upload halal cert if it's a new File
  if (vendorData.halalCert instanceof File) {
    const ext = vendorData.halalCert.name.split(".").pop();
    const path = `vendors/${currentUser.uid}/halalCert.${ext}`;
    uploadPromises.push(
      uploadFileToStorage(vendorData.halalCert, path).then((url) => {
        urls.halalCertUrl = url;
      }),
    );
  }

  await Promise.all(uploadPromises);
  return urls;
}

const completedSteps = new Set();

// ============================================
// VALIDATION
// ============================================

/**
 * Check if a field is filled
 */
function isFieldFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Get validation status for each field
 */
function getFieldValidation() {
  return {
    storeName: isFieldFilled(vendorData.storeName),
    storeLocation: isFieldFilled(vendorData.storeLocation?.name),
    unitNumber: isFieldFilled(vendorData.unitNumber),
    cuisines: isFieldFilled(vendorData.cuisines),
    // File fields: check for either new File or existing URL
    storePhoto:
      isFieldFilled(vendorData.storePhoto) ||
      isFieldFilled(vendorData.storePhotoUrl),
    uen: isFieldFilled(vendorData.uen),
    contactPerson: isFieldFilled(vendorData.contactPerson),
    contactNumber: isFieldFilled(vendorData.contactNumber),
    hygieneCert:
      isFieldFilled(vendorData.hygieneCert) ||
      isFieldFilled(vendorData.hygieneCertUrl),
    // halalCert is optional, so always valid
    halalCert: true,
  };
}

/**
 * Check if all required fields are filled
 */
function isFormComplete() {
  const validation = getFieldValidation();
  return Object.entries(validation)
    .filter(([key]) => key !== "halalCert")
    .every(([, valid]) => valid);
}

/**
 * Render incomplete badge
 */
function renderIncompleteBadge() {
  return `<span class="incompleteBadge">Incomplete</span>`;
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render a review item with incomplete badge if empty
 */
function renderReviewItem(label, value, isOptional = false) {
  const isEmpty = !value || value === "-" || value === "Not uploaded";
  const displayValue = isEmpty ? "-" : value;
  const badge = isEmpty && !isOptional ? renderIncompleteBadge() : "";

  return `
    <div class="reviewItem">
      <span class="reviewLabel">${label}</span>
      <div class="reviewValueWrapper">
        ${badge}
        <span class="reviewValue ${isEmpty && !isOptional ? "empty" : ""}">${displayValue}</span>
      </div>
    </div>
  `;
}

/**
 * Update the review page with current data and validation badges
 */
function updateReviewPage() {
  const validation = getFieldValidation();

  // Stall information
  document.getElementById("reviewStoreName").innerHTML =
    (!validation.storeName ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.storeName ? "empty" : ""}">${vendorData.storeName || "-"}</span>`;

  const locText = vendorData.storeLocation?.name
    ? `${vendorData.storeLocation.name}${vendorData.storeLocation.address ? " — " + vendorData.storeLocation.address : ""}`
    : "-";
  document.getElementById("reviewLocation").innerHTML =
    (!validation.storeLocation ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.storeLocation ? "empty" : ""}">${locText}</span>`;

  document.getElementById("reviewUnit").innerHTML =
    (!validation.unitNumber ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.unitNumber ? "empty" : ""}">${vendorData.unitNumber || "-"}</span>`;

  document.getElementById("reviewCuisines").innerHTML =
    (!validation.cuisines ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.cuisines ? "empty" : ""}">${vendorData.cuisines.join(", ") || "-"}</span>`;

  // Business details
  document.getElementById("reviewUen").innerHTML =
    (!validation.uen ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.uen ? "empty" : ""}">${vendorData.uen || "-"}</span>`;

  document.getElementById("reviewContact").innerHTML =
    (!validation.contactPerson ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.contactPerson ? "empty" : ""}">${vendorData.contactPerson || "-"}</span>`;

  document.getElementById("reviewPhone").innerHTML =
    (!validation.contactNumber ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.contactNumber ? "empty" : ""}">${vendorData.contactNumber ? "+65 " + vendorData.contactNumber : "-"}</span>`;

  // Documents - check for File or URL
  const hasHygieneCert = vendorData.hygieneCert || vendorData.hygieneCertUrl;
  const hasHalalCert = vendorData.halalCert || vendorData.halalCertUrl;

  document.getElementById("reviewHygiene").innerHTML =
    (!validation.hygieneCert ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.hygieneCert ? "empty" : ""}">${hasHygieneCert ? "Uploaded" : "Not uploaded"}</span>`;

  // Halal cert is optional
  document.getElementById("reviewHalal").innerHTML =
    `<span class="reviewValue">${hasHalalCert ? "Uploaded" : "Not uploaded"}</span>`;

  // Update submit button state
  updateSubmitButton();
}

/**
 * Update submit button based on form completion
 */
function updateSubmitButton() {
  const submitBtn = document.getElementById("submitOnboarding");
  const termsCheckbox = document.getElementById("confirmTerms");

  if (!submitBtn) return;

  const formComplete = isFormComplete();
  const termsAccepted = termsCheckbox?.checked || false;

  submitBtn.disabled = !formComplete || !termsAccepted;

  // Update button text
  if (!formComplete) {
    submitBtn.textContent = "Complete all required fields";
    submitBtn.classList.add("disabled");
  } else if (!termsAccepted) {
    submitBtn.textContent = "Accept terms to continue";
    submitBtn.classList.add("disabled");
  } else {
    submitBtn.textContent = "Open stall";
    submitBtn.classList.remove("disabled");
  }
}

// ============================================
// NAVIGATION
// ============================================

/**
 * Navigate to a specific step
 */
async function navigateToStep(stepId) {
  // Collect current step data before navigating
  collectStepData(currentStep);

  currentStep = stepId;

  // Update step content visibility
  document.querySelectorAll(".stepContent").forEach((content) => {
    content.classList.remove("active");
  });

  const stepContent = document.getElementById(`step-${stepId}`);
  if (stepContent) stepContent.classList.add("active");

  // Update sidebar navigation
  updateSidebarNav();

  // Update review page if navigating there
  if (stepId === "review") {
    updateReviewPage();
  }

  // Save progress (including file uploads)
  try {
    await saveProgress();
  } catch (error) {
    console.error("Error saving progress:", error);
  }
}

/**
 * Update sidebar navigation state
 */
function updateSidebarNav() {
  const currentSection = stepToSection[currentStep];

  // Update section states
  document.querySelectorAll(".navSection").forEach((section) => {
    const sectionId = section.dataset.section;
    section.classList.remove("active", "completed");

    if (sectionId === currentSection) {
      section.classList.add("active");
    }
  });

  // Update nav items
  document.querySelectorAll(".navItem").forEach((item) => {
    const stepId = item.dataset.step;
    item.classList.remove("active", "completed");

    if (stepId === currentStep) {
      item.classList.add("active");
    } else if (completedSteps.has(stepId)) {
      item.classList.add("completed");
    }
  });
}

// ============================================
// DATA COLLECTION
// ============================================

/**
 * Collect data from current step
 */
function collectStepData(stepId) {
  switch (stepId) {
    case "stall-details":
      vendorData.storeName =
        document.getElementById("storeName")?.value.trim() || "";
      // storeLocation is managed by the map picker, not collected from input
      vendorData.unitNumber =
        document.getElementById("unitNumber")?.value.trim() || "";
      break;
    case "business-details":
      vendorData.uen = document.getElementById("uen")?.value.trim() || "";
      vendorData.contactPerson =
        document.getElementById("contactPerson")?.value.trim() || "";
      vendorData.contactNumber =
        document.getElementById("contactNumber")?.value.trim() || "";
      break;
  }
}

// ============================================
// FIREBASE OPERATIONS
// ============================================

/**
 * Save progress to Firebase
 */
async function saveProgress() {
  if (!currentUser) return;

  try {
    // Upload any new files to Firebase Storage first
    console.log("Saving progress...", {
      hasStorePhoto: !!vendorData.storePhoto,
      hasHygieneCert: !!vendorData.hygieneCert,
      hasHalalCert: !!vendorData.halalCert,
    });
    const uploadedUrls = await uploadPendingFiles();
    console.log("Uploaded URLs:", uploadedUrls);

    // Update vendorData with new URLs
    if (uploadedUrls.storePhotoUrl) {
      vendorData.storePhotoUrl = uploadedUrls.storePhotoUrl;
      vendorData.storePhoto = null; // Clear File object after upload
    }
    if (uploadedUrls.hygieneCertUrl) {
      vendorData.hygieneCertUrl = uploadedUrls.hygieneCertUrl;
      vendorData.hygieneCert = null;
    }
    if (uploadedUrls.halalCertUrl) {
      vendorData.halalCertUrl = uploadedUrls.halalCertUrl;
      vendorData.halalCert = null;
    }

    // Create a copy without File objects (Firebase doesn't support them)
    const dataToSave = {
      storeName: vendorData.storeName,
      storeLocation: vendorData.storeLocation,
      unitNumber: vendorData.unitNumber,
      cuisines: vendorData.cuisines,
      operatingHours: vendorData.operatingHours,
      uen: vendorData.uen,
      contactPerson: vendorData.contactPerson,
      contactNumber: vendorData.contactNumber,
      browserNotifications: vendorData.browserNotifications,
      telegramConnected: vendorData.telegramConnected,
      telegramChatId: vendorData.telegramChatId,
      // Store URLs from Firebase Storage
      storePhotoUrl: vendorData.storePhotoUrl || null,
      hygieneCertUrl: vendorData.hygieneCertUrl || null,
      halalCertUrl: vendorData.halalCertUrl || null,
      onboardingStep: currentStep,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, "vendors", currentUser.uid), dataToSave);
  } catch (error) {
    console.error("Error saving progress:", error);
  }
}

/**
 * Convert operating hours to Firebase format
 */
function convertOperatingHours(hours) {
  const dayMap = {
    Sun: "sunday",
    Mon: "monday",
    Tue: "tuesday",
    Wed: "wednesday",
    Thu: "thursday",
    Fri: "friday",
    Sat: "saturday",
  };

  const firebaseHours = {};
  hours.forEach((day) => {
    const dayKey = dayMap[day.day];
    if (!day.active || day.slots.length === 0) {
      firebaseHours[dayKey] = { isClosed: true, slots: [] };
    } else {
      firebaseHours[dayKey] = {
        isClosed: false,
        slots: day.slots.map((s) => ({ from: s.from, to: s.to })),
      };
    }
  });
  return firebaseHours;
}

/**
 * Complete onboarding and submit
 */
async function completeOnboarding() {
  // Final validation
  if (!isFormComplete()) {
    alert("Please complete all required fields before submitting.");
    return;
  }

  const termsCheckbox = document.getElementById("confirmTerms");
  if (!termsCheckbox?.checked) {
    alert("Please accept the terms and conditions to continue.");
    return;
  }

  const submitBtn = document.getElementById("submitOnboarding");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Opening...";
  }

  // Validate storeLocation before proceeding
  if (!vendorData.storeLocation?.name) {
    alert("Please select a hawker centre location on the map.");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Open stall";
    }
    return;
  }

  let hawkerCentre = null;
  let stallId = null;

  try {
    // Step 0: Upload any pending files to Firebase Storage
    if (submitBtn) submitBtn.textContent = "Uploading files...";
    const uploadedUrls = await uploadPendingFiles();

    // Update vendorData with new URLs
    if (uploadedUrls.storePhotoUrl) {
      vendorData.storePhotoUrl = uploadedUrls.storePhotoUrl;
    }
    if (uploadedUrls.hygieneCertUrl) {
      vendorData.hygieneCertUrl = uploadedUrls.hygieneCertUrl;
    }
    if (uploadedUrls.halalCertUrl) {
      vendorData.halalCertUrl = uploadedUrls.halalCertUrl;
    }
    console.log("Files uploaded successfully");
  } catch (error) {
    console.error("Error uploading files:", error);
    alert("Failed to upload your files. Please try again.");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Open stall";
    }
    return;
  }

  try {
    // Step 1: Create hawker centre if needed
    if (submitBtn) submitBtn.textContent = "Setting up location...";
    const loc = vendorData.storeLocation;
    console.log("Creating hawker centre with:", loc.name);
    hawkerCentre = await findOrCreateHawkerCentre(loc.name, {
      address: loc.address || "",
      postalCode: loc.postalCode || "",
      location: {
        latitude: loc.latitude,
        longitude: loc.longitude,
      },
      placeId: loc.placeId || "",
    });

    if (!hawkerCentre || !hawkerCentre.id) {
      throw new Error("Failed to create or find hawker centre");
    }
    console.log("Hawker centre created/found:", hawkerCentre.id);
  } catch (error) {
    console.error("Error creating hawker centre:", error);
    alert("Failed to set up your hawker centre location. Please try again.");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Open stall";
    }
    return;
  }

  try {
    // Step 2: Create or update stall
    if (submitBtn) submitBtn.textContent = "Creating stall...";
    const firebaseOperatingHours = convertOperatingHours(
      vendorData.operatingHours,
    );

    // Check if vendor already has a stall (e.g. re-onboarding after unlink)
    const vendorSnap = await getDoc(doc(db, "vendors", currentUser.uid));
    const existingStallId = vendorSnap.exists()
      ? vendorSnap.data().stallId
      : null;

    const stallFields = {
      ownerId: currentUser.uid,
      hawkerCentreId: hawkerCentre.id,
      name: vendorData.storeName,
      nameLower: vendorData.storeName.toLowerCase(),
      cuisineNames: vendorData.cuisines,
      isHalal:
        vendorData.cuisines.includes("Halal") ||
        !!vendorData.halalCert ||
        !!vendorData.halalCertUrl,
      unitNumber: vendorData.unitNumber,
      imageUrl: vendorData.storePhotoUrl || "",
      coverImageUrl: vendorData.storePhotoUrl || "",
      operatingHours: firebaseOperatingHours,
      updatedAt: serverTimestamp(),
    };

    if (existingStallId) {
      // Update existing stall instead of creating a duplicate
      // Also clear stale operator fields from any previous linking
      await updateDoc(doc(db, "foodStalls", existingStallId), {
        ...stallFields,
        operatorId: deleteField(),
        operatorName: deleteField(),
      });
      stallId = existingStallId;
      console.log("Existing stall updated:", stallId);
    } else {
      stallId = await createStall({
        ...stallFields,
        description: "",
        cuisineIds: [],
      });
      if (!stallId) {
        throw new Error("createStall returned empty stallId");
      }
      console.log("Stall created:", stallId);
    }
  } catch (error) {
    console.error("Error creating/updating stall:", error);
    alert("Failed to create your stall. Please try again.");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Open stall";
    }
    return;
  }

  try {
    // Step 3: Update vendor profile - only after stall is confirmed created
    if (submitBtn) submitBtn.textContent = "Finishing up...";
    await updateDoc(doc(db, "vendors", currentUser.uid), {
      hawkerCentreId: hawkerCentre.id,
      stallId: stallId,
      // Save file URLs to vendor profile
      storePhotoUrl: vendorData.storePhotoUrl || null,
      hygieneCertUrl: vendorData.hygieneCertUrl || null,
      halalCertUrl: vendorData.halalCertUrl || null,
      onboardingComplete: true,
      // Clear stale tenancy from any previous linking
      tenancyLinkedAt: deleteField(),
      updatedAt: serverTimestamp(),
    });
    console.log("Vendor profile updated with stallId:", stallId);

    // Redirect to dashboard
    window.location.href = "../Vendor Dashboard/vendorDashboard.html";
  } catch (error) {
    console.error("Error updating vendor profile:", error);
    // Stall was created but profile update failed - this is a problem
    // The stall exists but vendor profile doesn't have the reference
    alert(
      "Your stall was created but there was an error linking it to your account. " +
        "Please contact support with your stall name: " +
        vendorData.storeName,
    );
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Open stall";
    }
  }
}

// ============================================
// FORM POPULATION
// ============================================

/**
 * Populate form fields from saved data
 */
function populateFormFromData() {
  const fields = {
    storeName: vendorData.storeName,
    unitNumber: vendorData.unitNumber,
    uen: vendorData.uen,
    contactPerson: vendorData.contactPerson,
    contactNumber: vendorData.contactNumber,
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && value) el.value = value;
  });

  // Map location is restored inside initVendorMapLocationPicker()

  // Cuisines - pass true to skip duplicate check since data is already loaded
  vendorData.cuisines.forEach((cuisine) => addCuisineTag(cuisine, true));

  // Update suggestion states after populating cuisines
  updateCuisineSuggestionStates();
}

// ============================================
// MAP LOCATION PICKER
// ============================================

let vendorMapInstance = null;
let vendorMapMarker = null;

async function initVendorMapLocationPicker() {
  const mapEl = document.getElementById("vendorMap");
  const addressInput = document.getElementById("storeLocation");

  if (!mapEl || !addressInput) return;

  // Load libraries via importLibrary
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  const { PlaceAutocompleteElement } =
    await google.maps.importLibrary("places");
  const { Geocoder } = await google.maps.importLibrary("geocoding");

  // Initialize map centered on Singapore
  vendorMapInstance = new Map(mapEl, {
    center: { lat: 1.3521, lng: 103.8198 },
    zoom: 12,
    mapId: "hawkr-onboarding",
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
  });

  // Create PlaceAutocompleteElement
  const placeAutocomplete = new PlaceAutocompleteElement({
    includedRegionCodes: ["sg"],
    locationBias: { lat: 1.3521, lng: 103.8198 },
  });

  // Replace the text input with the autocomplete element
  addressInput.parentNode.replaceChild(placeAutocomplete, addressInput);

  // Listen for place selection
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

      vendorMapInstance.setCenter(pos);
      vendorMapInstance.setZoom(17);
      placeVendorMapMarker(pos, AdvancedMarkerElement);

      const postalCode = extractVendorPostalCode(place.addressComponents);

      vendorData.storeLocation = {
        name: place.displayName || "",
        address: place.formattedAddress || "",
        postalCode: postalCode,
        latitude: pos.lat,
        longitude: pos.lng,
        placeId: place.id || "",
      };

      showVendorSelectedLocation(vendorData.storeLocation);
    },
  );

  // Click on map to drop pin
  vendorMapInstance.addListener("click", (e) => {
    const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    placeVendorMapMarker(pos, AdvancedMarkerElement);
    vendorReverseGeocode(pos, Geocoder);
  });

  // Clear button
  document.getElementById("clearLocation")?.addEventListener("click", () => {
    clearVendorMapSelection();
  });

  // Restore saved location if available
  if (vendorData.storeLocation?.latitude) {
    const pos = {
      lat: vendorData.storeLocation.latitude,
      lng: vendorData.storeLocation.longitude,
    };
    vendorMapInstance.setCenter(pos);
    vendorMapInstance.setZoom(17);
    placeVendorMapMarker(pos, AdvancedMarkerElement);
    showVendorSelectedLocation(vendorData.storeLocation);
  }
}

function placeVendorMapMarker(pos, AdvancedMarkerElement) {
  if (vendorMapMarker) {
    vendorMapMarker.position = pos;
  } else {
    vendorMapMarker = new AdvancedMarkerElement({
      position: pos,
      map: vendorMapInstance,
      gmpDraggable: true,
    });

    vendorMapMarker.addListener("dragend", () => {
      const newPos = {
        lat: vendorMapMarker.position.lat,
        lng: vendorMapMarker.position.lng,
      };
      vendorReverseGeocode(newPos);
    });
  }
}

function vendorReverseGeocode(pos, GeocoderClass) {
  const geocoder = GeocoderClass
    ? new GeocoderClass()
    : new google.maps.Geocoder();
  geocoder.geocode({ location: pos }, (results, status) => {
    if (status === "OK" && results[0]) {
      const result = results[0];
      const postalCode = extractVendorPostalCode(result.address_components);

      vendorData.storeLocation = {
        name: result.formatted_address.split(",")[0] || "",
        address: result.formatted_address || "",
        postalCode: postalCode,
        latitude: pos.lat,
        longitude: pos.lng,
        placeId: result.place_id || "",
      };

      showVendorSelectedLocation(vendorData.storeLocation);
    }
  });
}

function extractVendorPostalCode(addressComponents) {
  if (!addressComponents) return "";
  const postal = addressComponents.find(
    (c) => c.types?.includes("postal_code") || c.types?.includes("postal_code"),
  );
  return postal?.longText || postal?.long_name || "";
}

function showVendorSelectedLocation(loc) {
  const container = document.getElementById("selectedLocation");
  const nameEl = document.getElementById("selectedLocationName");
  const addressEl = document.getElementById("selectedLocationAddress");

  if (!container) return;

  nameEl.textContent = loc.name || "Dropped pin";
  addressEl.textContent = loc.address || "";
  container.style.display = "flex";
}

function clearVendorMapSelection() {
  vendorData.storeLocation = null;

  if (vendorMapMarker) {
    vendorMapMarker.map = null;
    vendorMapMarker = null;
  }

  const container = document.getElementById("selectedLocation");
  if (container) container.style.display = "none";

  if (vendorMapInstance) {
    vendorMapInstance.setCenter({ lat: 1.3521, lng: 103.8198 });
    vendorMapInstance.setZoom(12);
  }
}

// ============================================
// CUISINE INPUT
// ============================================

const cuisineIcons = {
  Halal: "../../assets/icons/halal.png",
  Kosher: "../../assets/icons/kosher.svg",
};

function renderCuisineTagInner(tag) {
  const icon = cuisineIcons[tag];
  if (icon) {
    return `<span class="cuisineTagInner ${tag.toLowerCase()}"><img class="cuisineTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="cuisineTagInner">${tag}</span>`;
}

function addCuisineTag(cuisine, skipDuplicateCheck = false) {
  const container = document.getElementById("cuisineContainer");
  const input = document.getElementById("cuisineInput");
  if (!container || !input) return;

  const capitalized =
    cuisine.charAt(0).toUpperCase() + cuisine.slice(1).toLowerCase();

  // Check if tag already exists in DOM
  const existingTag = container.querySelector(
    `.cuisineTag[data-cuisine="${capitalized}"]`,
  );
  if (existingTag) return;

  // Check if already in data (unless we're loading from saved data)
  if (!skipDuplicateCheck && vendorData.cuisines.includes(capitalized)) return;

  const tag = document.createElement("span");
  tag.className = "cuisineTag";
  tag.dataset.cuisine = capitalized;
  tag.innerHTML = `
    ${renderCuisineTagInner(capitalized)}
    <button class="cuisineTagRemove" type="button">&times;</button>
  `;

  tag.querySelector(".cuisineTagRemove").addEventListener("click", () => {
    vendorData.cuisines = vendorData.cuisines.filter((c) => c !== capitalized);
    tag.remove();
    // Update suggestion states (use global function)
    if (typeof updateCuisineSuggestionStates === "function") {
      updateCuisineSuggestionStates();
    }
  });

  container.insertBefore(tag, input);
}

// Global function to update suggestion states
function updateCuisineSuggestionStates() {
  const suggestionsContainer = document.getElementById("cuisineSuggestions");
  if (!suggestionsContainer) return;
  const suggestions =
    suggestionsContainer.querySelectorAll(".cuisineSuggestion");
  suggestions.forEach((suggestion) => {
    const cuisine = suggestion.dataset.cuisine;
    if (vendorData.cuisines.includes(cuisine)) {
      suggestion.classList.add("added");
    } else {
      suggestion.classList.remove("added");
    }
  });
}

function initCuisineInput() {
  const container = document.getElementById("cuisineContainer");
  const input = document.getElementById("cuisineInput");
  const suggestionsContainer = document.getElementById("cuisineSuggestions");
  if (!container || !input) return;

  // Update suggestion states based on current cuisines
  const updateSuggestionStates = () => {
    if (!suggestionsContainer) return;
    const suggestions =
      suggestionsContainer.querySelectorAll(".cuisineSuggestion");
    suggestions.forEach((suggestion) => {
      const cuisine = suggestion.dataset.cuisine;
      if (vendorData.cuisines.includes(cuisine)) {
        suggestion.classList.add("added");
      } else {
        suggestion.classList.remove("added");
      }
    });
  };

  // Override addCuisineTag to also update suggestions
  const originalAddCuisineTag = addCuisineTag;
  window.addCuisineTagWithUpdate = (cuisine) => {
    originalAddCuisineTag(cuisine);
    updateSuggestionStates();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = input.value.trim();
      if (val && !vendorData.cuisines.includes(val)) {
        const capitalized =
          val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
        addCuisineTag(capitalized);
        vendorData.cuisines.push(capitalized);
        updateSuggestionStates();
      }
      input.value = "";
    } else if (e.key === "Backspace" && !input.value) {
      const tags = container.querySelectorAll(".cuisineTag");
      if (tags.length) {
        const lastTag = tags[tags.length - 1];
        const cuisine = lastTag.dataset.cuisine;
        vendorData.cuisines = vendorData.cuisines.filter((c) => c !== cuisine);
        lastTag.remove();
        updateSuggestionStates();
      }
    }
  });

  // Initialize drag and drop
  initCuisineDragDrop(updateSuggestionStates);

  // Initial state update
  updateSuggestionStates();
}

function initCuisineDragDrop(updateSuggestionStates) {
  const stepContent = document.getElementById("step-cuisines");
  if (!stepContent) return;

  const snap = new Snap(stepContent, {
    draggableSelector: "[data-draggable]:not(.added)",
    dropZoneSelector: "[data-droppable]",
    distance: 3,
    onDropZoneEnter: ({ dropZone }) => {
      dropZone.classList.add("snap-drop-active");
    },
    onDropZoneLeave: ({ dropZone }) => {
      dropZone.classList.remove("snap-drop-active");
    },
    onDrop: ({ element, dropZone }) => {
      dropZone.classList.remove("snap-drop-active");
      const cuisine = element.dataset.cuisine;
      if (cuisine && !vendorData.cuisines.includes(cuisine)) {
        addCuisineTag(cuisine);
        vendorData.cuisines.push(cuisine);
        updateSuggestionStates();
      }
    },
  });

  // Also allow click to add
  const suggestionsContainer = document.getElementById("cuisineSuggestions");
  if (suggestionsContainer) {
    suggestionsContainer.addEventListener("click", (e) => {
      const suggestion = e.target.closest(".cuisineSuggestion");
      if (suggestion && !suggestion.classList.contains("added")) {
        const cuisine = suggestion.dataset.cuisine;
        if (cuisine && !vendorData.cuisines.includes(cuisine)) {
          addCuisineTag(cuisine);
          vendorData.cuisines.push(cuisine);
          updateSuggestionStates();
        }
      }
    });
  }
}

// ============================================
// OPERATING HOURS
// ============================================

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
                  </div>
                `,
                    )
                    .join("")
                : `<span class="hoursClosed">Closed</span>`
            }
          </div>
          ${day.active ? `<button class="hoursAddSlot" data-day="${dayIdx}" type="button">+ Add</button>` : ""}
        </div>
      `,
    )
    .join("");

  // Initialize liquid glass toggles for operating hours
  container.querySelectorAll(".hoursToggle").forEach((toggleLabel) => {
    const dayIdx = parseInt(toggleLabel.dataset.day);
    initLiquidGlassToggle(toggleLabel, (isChecked) => {
      vendorData.operatingHours[dayIdx].active = isChecked;
      if (isChecked && vendorData.operatingHours[dayIdx].slots.length === 0) {
        vendorData.operatingHours[dayIdx].slots.push({
          from: "09:00",
          to: "21:00",
        });
      }
      renderOperatingHours();
    });
  });

  // Time inputs
  container.querySelectorAll(".hoursTime").forEach((input) => {
    input.addEventListener("change", (e) => {
      const { day, slot, field } = e.target.dataset;
      vendorData.operatingHours[parseInt(day)].slots[parseInt(slot)][field] =
        e.target.value;
    });
  });

  // Add slot buttons
  container.querySelectorAll(".hoursAddSlot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dayIdx = parseInt(btn.dataset.day);
      vendorData.operatingHours[dayIdx].slots.push({ from: "", to: "" });
      renderOperatingHours();
    });
  });

  // Remove slot buttons
  container.querySelectorAll(".hoursRemoveSlot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dayIdx = parseInt(btn.dataset.day);
      const slotIdx = parseInt(btn.dataset.slot);
      vendorData.operatingHours[dayIdx].slots.splice(slotIdx, 1);
      renderOperatingHours();
    });
  });
}

// ============================================
// FILE UPLOADS
// ============================================

// Store object URLs for cleanup
const filePreviewUrls = {};

function initFileUploads() {
  // Store photo - image only
  setupImageUpload(
    "storePhotoInput",
    "storePhotoUpload",
    "storePhotoPreview",
    "storePhotoImg",
    "storePhotoName",
    "storePhotoRemove",
    "storePhoto",
  );

  // Hygiene cert - PDF only
  setupPdfUpload(
    "hygieneCertInput",
    "hygieneCertUpload",
    "hygieneCertPreview",
    "hygieneCertIframe",
    "hygieneCertName",
    "hygieneCertRemove",
    "hygieneCert",
  );

  // Halal cert - PDF only
  setupPdfUpload(
    "halalCertInput",
    "halalCertUpload",
    "halalCertPreview",
    "halalCertIframe",
    "halalCertName",
    "halalCertRemove",
    "halalCert",
  );
}

/**
 * Setup image-only upload (store photo)
 */
function setupImageUpload(
  inputId,
  uploadAreaId,
  previewId,
  imgId,
  nameId,
  removeId,
  dataKey,
) {
  const input = document.getElementById(inputId);
  const uploadArea = document.getElementById(uploadAreaId);
  const preview = document.getElementById(previewId);
  const img = document.getElementById(imgId);
  const nameEl = document.getElementById(nameId);
  const removeBtn = document.getElementById(removeId);

  if (!input || !uploadArea) return;

  // Check if there's an existing URL from Firebase Storage
  const existingUrl = vendorData[`${dataKey}Url`];
  if (existingUrl) {
    if (img) img.src = existingUrl;
    if (nameEl) nameEl.textContent = "Previously uploaded";
    if (uploadArea) uploadArea.style.display = "none";
    if (preview) preview.style.display = "flex";
  }

  input.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be less than 2MB");
      return;
    }

    // Show preview immediately with loading state
    if (nameEl) nameEl.textContent = "Uploading...";
    if (uploadArea) uploadArea.style.display = "none";
    if (preview) preview.style.display = "flex";

    // Create local preview URL
    if (filePreviewUrls[dataKey]) {
      URL.revokeObjectURL(filePreviewUrls[dataKey]);
    }
    const localUrl = URL.createObjectURL(file);
    filePreviewUrls[dataKey] = localUrl;
    if (img) img.src = localUrl;

    // Upload to Firebase Storage immediately
    try {
      const ext = file.name.split(".").pop();
      const path = `vendors/${currentUser.uid}/${dataKey}.${ext}`;
      const downloadUrl = await uploadFileToStorage(file, path);

      // Save URL to vendorData
      vendorData[`${dataKey}Url`] = downloadUrl;
      vendorData[dataKey] = null; // Clear File object since it's uploaded

      // Save to Firestore
      await updateDoc(doc(db, "vendors", currentUser.uid), {
        [`${dataKey}Url`]: downloadUrl,
        updatedAt: serverTimestamp(),
      });

      if (nameEl) nameEl.textContent = file.name;
      console.log(`${dataKey} uploaded:`, downloadUrl);
    } catch (error) {
      console.error(`Error uploading ${dataKey}:`, error);
      if (nameEl) nameEl.textContent = "Upload failed - click to retry";
      vendorData[dataKey] = file; // Keep file for retry
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      vendorData[dataKey] = null;
      vendorData[`${dataKey}Url`] = null; // Also clear the stored URL
      input.value = "";
      if (filePreviewUrls[dataKey]) {
        URL.revokeObjectURL(filePreviewUrls[dataKey]);
        delete filePreviewUrls[dataKey];
      }
      if (img) img.src = "";
      if (uploadArea) uploadArea.style.display = "flex";
      if (preview) preview.style.display = "none";
    });
  }

  // Drag and drop
  setupDragDrop(uploadArea, input);
}

/**
 * Setup PDF-only upload (certificates)
 */
function setupPdfUpload(
  inputId,
  uploadAreaId,
  previewId,
  iframeId,
  nameId,
  removeId,
  dataKey,
) {
  const input = document.getElementById(inputId);
  const uploadArea = document.getElementById(uploadAreaId);
  const preview = document.getElementById(previewId);
  const iframe = document.getElementById(iframeId);
  const nameEl = document.getElementById(nameId);
  const removeBtn = document.getElementById(removeId);

  if (!input || !uploadArea) return;

  // Check if there's an existing URL from Firebase Storage
  const existingUrl = vendorData[`${dataKey}Url`];
  if (existingUrl) {
    if (iframe) iframe.src = existingUrl + "#toolbar=0&navpanes=0&scrollbar=0";
    if (nameEl) nameEl.textContent = "Previously uploaded";
    if (uploadArea) uploadArea.style.display = "none";
    if (preview) preview.style.display = "flex";
  }

  input.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be less than 2MB");
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file");
      return;
    }

    // Show preview immediately with loading state
    if (nameEl) nameEl.textContent = "Uploading...";
    if (uploadArea) uploadArea.style.display = "none";
    if (preview) preview.style.display = "flex";

    // Create local preview URL
    if (filePreviewUrls[dataKey]) {
      URL.revokeObjectURL(filePreviewUrls[dataKey]);
    }
    const localUrl = URL.createObjectURL(file);
    filePreviewUrls[dataKey] = localUrl;
    if (iframe) iframe.src = localUrl + "#toolbar=0&navpanes=0&scrollbar=0";

    // Upload to Firebase Storage immediately
    try {
      const ext = file.name.split(".").pop();
      const path = `vendors/${currentUser.uid}/${dataKey}.${ext}`;
      const downloadUrl = await uploadFileToStorage(file, path);

      // Save URL to vendorData
      vendorData[`${dataKey}Url`] = downloadUrl;
      vendorData[dataKey] = null; // Clear File object since it's uploaded

      // Save to Firestore
      await updateDoc(doc(db, "vendors", currentUser.uid), {
        [`${dataKey}Url`]: downloadUrl,
        updatedAt: serverTimestamp(),
      });

      if (nameEl) nameEl.textContent = file.name;
      console.log(`${dataKey} uploaded:`, downloadUrl);
    } catch (error) {
      console.error(`Error uploading ${dataKey}:`, error);
      if (nameEl) nameEl.textContent = "Upload failed - click to retry";
      vendorData[dataKey] = file; // Keep file for retry
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      vendorData[dataKey] = null;
      vendorData[`${dataKey}Url`] = null; // Also clear the stored URL
      input.value = "";
      if (filePreviewUrls[dataKey]) {
        URL.revokeObjectURL(filePreviewUrls[dataKey]);
        delete filePreviewUrls[dataKey];
      }
      if (iframe) {
        iframe.src = "";
      }
      if (uploadArea) uploadArea.style.display = "flex";
      if (preview) preview.style.display = "none";
    });
  }

  // Drag and drop
  setupDragDrop(uploadArea, input);
}

/**
 * Setup drag and drop for upload area
 */
function setupDragDrop(uploadArea, input) {
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", (e) => {
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

// ============================================
// NOTIFICATIONS
// ============================================

function initBrowserNotifications() {
  const toggleLabel = document.querySelector(
    "#step-notification-settings .liquidGlassToggle",
  );
  if (!toggleLabel) return;

  initLiquidGlassToggle(toggleLabel, async (isChecked) => {
    if (isChecked && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        // Reset toggle if permission denied
        const checkbox = toggleLabel.querySelector("input");
        const thumb = toggleLabel.querySelector(".toggleThumb");
        if (checkbox) checkbox.checked = false;
        if (thumb) thumb.classList.remove("glass");
        return;
      }
    }
    vendorData.browserNotifications = isChecked;
  });
}

function initTelegram() {
  const container = document.getElementById("telegramLoginWidget");
  const connectedState = document.getElementById("telegramConnectedState");

  // If already connected (check both old and new field names)
  if (vendorData.telegramConnected || vendorData.telegramLinked) {
    const handle = vendorData.telegramUsername
      ? `@${vendorData.telegramUsername}`
      : "Linked";
    showTelegramConnected(handle);
    return;
  }

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
  if (!currentUser) return;

  try {
    await updateDoc(doc(db, "vendors", currentUser.uid), {
      telegramChatId: user.id.toString(),
      telegramLinked: true,
      telegramUsername: user.username || null,
      telegramFirstName: user.first_name || null,
      telegramLastName: user.last_name || null,
      telegramPhotoUrl: user.photo_url || null,
      telegramAuthDate: user.auth_date,
    });

    vendorData.telegramConnected = true;
    vendorData.telegramChatId = user.id.toString();

    const handle = user.username
      ? `@${user.username}`
      : user.first_name || "Linked";
    showTelegramConnected(handle);
  } catch (error) {
    console.error("Error linking Telegram:", error);
    alert("Failed to link Telegram account. Please try again.");
  }
};

function showTelegramConnected(handle) {
  const widget = document.getElementById("telegramLoginWidget");
  const connectedState = document.getElementById("telegramConnectedState");
  const handleEl = document.getElementById("telegramHandle");
  if (widget) widget.style.display = "none";
  if (handleEl) handleEl.textContent = handle;
  if (connectedState) connectedState.style.display = "flex";

  const disconnectBtn = document.getElementById("telegramDisconnect");
  if (disconnectBtn) {
    disconnectBtn.addEventListener("click", handleTelegramDisconnect);
  }
}

async function handleTelegramDisconnect() {
  if (!currentUser) return;

  try {
    await updateDoc(doc(db, "vendors", currentUser.uid), {
      telegramChatId: null,
      telegramLinked: false,
      telegramUsername: null,
      telegramFirstName: null,
      telegramLastName: null,
      telegramPhotoUrl: null,
      telegramAuthDate: null,
    });

    vendorData.telegramConnected = false;
    vendorData.telegramChatId = null;

    const widget = document.getElementById("telegramLoginWidget");
    const connectedState = document.getElementById("telegramConnectedState");
    if (connectedState) connectedState.style.display = "none";
    if (widget) widget.style.display = "flex";

    // Re-init widget
    initTelegram();
  } catch (error) {
    console.error("Error unlinking Telegram:", error);
    alert("Failed to unlink Telegram. Please try again.");
  }
}

// ============================================
// LIQUID GLASS TOP BAR
// ============================================

function initLiquidGlassTopBar() {
  const topBar = document.getElementById("glassTopBar");
  if (!topBar) return;

  let isDragging = false;
  let startY = 0;
  let startX = 0;
  let currentY = 0;
  let currentX = 0;
  let velocityY = 0;
  let velocityX = 0;
  let lastY = 0;
  let lastX = 0;
  let lastTime = 0;
  let animationFrame = null;

  const maxDragY = 100;
  const maxDragX = 150;
  const springStrength = 0.15;
  const damping = 0.7;

  const updateTransform = () => {
    topBar.style.transform = `translateX(calc(-50% + ${currentX}px)) translateY(${currentY}px) scale(${1 + Math.abs(currentY) * 0.0005})`;
  };

  const startDrag = (e) => {
    if (e.target.closest("button")) return;

    isDragging = true;
    topBar.classList.add("dragging");

    const clientY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
    const clientX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;

    startY = clientY - currentY;
    startX = clientX - currentX;
    lastY = clientY;
    lastX = clientX;
    lastTime = Date.now();
    velocityY = 0;
    velocityX = 0;

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  };

  const doDrag = (e) => {
    if (!isDragging) return;
    e.preventDefault();

    const clientY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
    const clientX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;

    const now = Date.now();
    const dt = Math.max(now - lastTime, 1);

    velocityY = ((clientY - lastY) / dt) * 10;
    velocityX = ((clientX - lastX) / dt) * 10;

    lastY = clientY;
    lastX = clientX;
    lastTime = now;

    let newY = clientY - startY;
    let newX = clientX - startX;

    if (Math.abs(newY) > maxDragY) {
      const overflow = Math.abs(newY) - maxDragY;
      const resistance = 1 / (1 + overflow * 0.02);
      newY = Math.sign(newY) * (maxDragY + overflow * resistance);
    }

    if (Math.abs(newX) > maxDragX) {
      const overflow = Math.abs(newX) - maxDragX;
      const resistance = 1 / (1 + overflow * 0.02);
      newX = Math.sign(newX) * (maxDragX + overflow * resistance);
    }

    currentY = newY;
    currentX = newX;
    updateTransform();
  };

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    topBar.classList.remove("dragging");
    topBar.classList.add("bouncing");

    const animate = () => {
      const forceY = -currentY * springStrength;
      const forceX = -currentX * springStrength;

      velocityY += forceY;
      velocityX += forceX;

      velocityY *= damping;
      velocityX *= damping;

      currentY += velocityY;
      currentX += velocityX;

      updateTransform();

      if (
        Math.abs(currentY) < 0.5 &&
        Math.abs(velocityY) < 0.1 &&
        Math.abs(currentX) < 0.5 &&
        Math.abs(velocityX) < 0.1
      ) {
        currentY = 0;
        currentX = 0;
        updateTransform();
        topBar.classList.remove("bouncing");
        return;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animate();
  };

  topBar.addEventListener("mousedown", startDrag);
  document.addEventListener("mousemove", doDrag);
  document.addEventListener("mouseup", endDrag);

  topBar.addEventListener("touchstart", startDrag, { passive: false });
  document.addEventListener("touchmove", doDrag, { passive: false });
  document.addEventListener("touchend", endDrag);

  topBar.addEventListener("mouseenter", () => {
    if (!isDragging && currentY === 0 && currentX === 0) {
      currentY = -3;
      updateTransform();
      setTimeout(() => {
        if (!isDragging) {
          topBar.classList.add("bouncing");
          currentY = 0;
          updateTransform();
          setTimeout(() => topBar.classList.remove("bouncing"), 500);
        }
      }, 100);
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================

function initializeForm() {
  // Back button in top bar - navigates to previous step or allows role change on first step
  document.getElementById("backButton")?.addEventListener("click", async () => {
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex <= 0) {
      // On first step, offer to change role
      if (
        confirm(
          "Do you want to go back and choose a different role? Your current progress will be deleted.",
        )
      ) {
        try {
          // Delete the vendor profile so they can choose again
          if (currentUser) {
            await deleteDoc(doc(db, "vendors", currentUser.uid));
          }
          window.location.href = "select-role.html";
        } catch (error) {
          console.error("Error deleting profile:", error);
          alert("Failed to go back. Please try again.");
        }
      }
    } else {
      // Navigate to previous step
      collectStepData(currentStep);
      const prevStep = stepOrder[currentIndex - 1];
      navigateToStep(prevStep);
    }
  });

  // Navigation buttons
  document.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      collectStepData(currentStep);
      const nextStep = btn.dataset.next;
      completedSteps.add(currentStep);
      navigateToStep(nextStep);
    });
  });

  // Sidebar nav items
  document.querySelectorAll(".navItem").forEach((item) => {
    item.addEventListener("click", () => {
      const stepId = item.dataset.step;
      if (stepId) {
        collectStepData(currentStep);
        navigateToStep(stepId);
      }
    });
  });

  // Clickable section headers
  document.querySelectorAll(".navSectionHeader.clickable").forEach((header) => {
    header.addEventListener("click", () => {
      const stepId = header.dataset.step;
      if (stepId) {
        collectStepData(currentStep);
        navigateToStep(stepId);
      }
    });
  });

  // Edit buttons on review page
  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const stepId = btn.dataset.edit;
      navigateToStep(stepId);
    });
  });

  // Terms checkbox
  document.getElementById("confirmTerms")?.addEventListener("change", () => {
    updateSubmitButton();
  });

  // Submit button
  document
    .getElementById("submitOnboarding")
    ?.addEventListener("click", completeOnboarding);

  // Initialize components
  initLiquidGlassTopBar();
  initVendorMapLocationPicker();
  initCuisineInput();
  initOperatingHours();
  initFileUploads();
  initBrowserNotifications();
  initTelegram();
}

// ============================================
// AUTH & ENTRY POINT
// ============================================

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
    // Load existing data
    Object.keys(vendorData).forEach((key) => {
      if (data[key] !== undefined) {
        if (Array.isArray(data[key]) && data[key].length === 0) {
          return;
        }
        vendorData[key] = data[key];
      }
    });

    // Handle migration from old string storeLocation
    if (typeof vendorData.storeLocation === "string") {
      vendorData.storeLocation = null;
    }

    if (data.onboardingStep) {
      currentStep = data.onboardingStep;
    }

    initializeForm();
    populateFormFromData();
  } else {
    window.location.href = "select-role.html";
    return;
  }

  navigateToStep(currentStep);
});
