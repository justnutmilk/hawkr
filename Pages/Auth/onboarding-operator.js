/**
 * Hawkr - Operator Onboarding
 * Clean, settings-style onboarding with validation
 */

// ============================================
// IMPORTS
// ============================================

import { auth, db } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { findOrCreateHawkerCentre } from "../../firebase/services/hawkerCentres.js";
import { initLiquidGlassToggle } from "../../assets/js/liquidGlassToggle.js";

// ============================================
// STATE
// ============================================

let currentUser = null;
let currentStep = "company-details";

// Step configuration
const stepOrder = [
  "company-details",
  "contact-info",
  "hawker-centres",
  "notification-settings",
  "review",
];

const stepToSection = {
  "company-details": "company",
  "contact-info": "company",
  "hawker-centres": "locations",
  "notification-settings": "notifications",
  review: "review",
};

// Operator data
const operatorData = {
  companyName: "",
  uen: "",
  operatorName: "",
  contactPerson: "",
  contactNumber: "",
  contactEmail: "",
  managedLocation: null,
  browserNotifications: false,
  telegramConnected: false,
  telegramChatId: null,
};

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
    companyName: isFieldFilled(operatorData.companyName),
    uen: isFieldFilled(operatorData.uen),
    operatorName: isFieldFilled(operatorData.operatorName),
    contactPerson: isFieldFilled(operatorData.contactPerson),
    contactNumber: isFieldFilled(operatorData.contactNumber),
    contactEmail: isFieldFilled(operatorData.contactEmail),
    managedLocation: isFieldFilled(operatorData.managedLocation?.name),
  };
}

/**
 * Check if all required fields are filled
 */
function isFormComplete() {
  const validation = getFieldValidation();
  return Object.values(validation).every((valid) => valid);
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
 * Update the review page with current data and validation badges
 */
function updateReviewPage() {
  const validation = getFieldValidation();

  // Company information
  document.getElementById("reviewCompanyName").innerHTML =
    (!validation.companyName ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.companyName ? "empty" : ""}">${operatorData.companyName || "-"}</span>`;

  document.getElementById("reviewUen").innerHTML =
    (!validation.uen ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.uen ? "empty" : ""}">${operatorData.uen || "-"}</span>`;

  document.getElementById("reviewOperatorName").innerHTML =
    (!validation.operatorName ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.operatorName ? "empty" : ""}">${operatorData.operatorName || "-"}</span>`;

  // Contact information
  document.getElementById("reviewContact").innerHTML =
    (!validation.contactPerson ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.contactPerson ? "empty" : ""}">${operatorData.contactPerson || "-"}</span>`;

  document.getElementById("reviewPhone").innerHTML =
    (!validation.contactNumber ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.contactNumber ? "empty" : ""}">${operatorData.contactNumber ? "+65 " + operatorData.contactNumber : "-"}</span>`;

  document.getElementById("reviewEmail").innerHTML =
    (!validation.contactEmail ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.contactEmail ? "empty" : ""}">${operatorData.contactEmail || "-"}</span>`;

  // Managed locations
  const loc = operatorData.managedLocation;
  const locationText = loc?.name
    ? `${loc.name}${loc.address ? " — " + loc.address : ""}`
    : "-";
  document.getElementById("reviewLocations").innerHTML =
    (!validation.managedLocation ? renderIncompleteBadge() : "") +
    `<span class="reviewValue ${!validation.managedLocation ? "empty" : ""}">${locationText}</span>`;

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
    submitBtn.textContent = "Complete setup";
    submitBtn.classList.remove("disabled");
  }
}

// ============================================
// NAVIGATION
// ============================================

/**
 * Navigate to a specific step
 */
function navigateToStep(stepId) {
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

  // Save progress
  saveProgress();
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
    case "company-details":
      operatorData.companyName =
        document.getElementById("companyName")?.value.trim() || "";
      operatorData.uen = document.getElementById("uen")?.value.trim() || "";
      operatorData.operatorName =
        document.getElementById("operatorName")?.value.trim() || "";
      break;
    case "contact-info":
      operatorData.contactPerson =
        document.getElementById("contactPerson")?.value.trim() || "";
      operatorData.contactNumber =
        document.getElementById("contactNumber")?.value.trim() || "";
      operatorData.contactEmail =
        document.getElementById("contactEmail")?.value.trim() || "";
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
    const dataToSave = {
      companyName: operatorData.companyName,
      uen: operatorData.uen,
      operatorName: operatorData.operatorName,
      contactPerson: operatorData.contactPerson,
      contactNumber: operatorData.contactNumber,
      contactEmail: operatorData.contactEmail,
      managedLocation: operatorData.managedLocation,
      browserNotifications: operatorData.browserNotifications,
      telegramConnected: operatorData.telegramConnected,
      telegramChatId: operatorData.telegramChatId,
      onboardingStep: currentStep,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, "operators", currentUser.uid), dataToSave);
  } catch (error) {
    console.error("Error saving progress:", error);
  }
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
    submitBtn.textContent = "Setting up...";
  }

  try {
    // Find or create the hawker centre and set operatorId on it
    const loc = operatorData.managedLocation;
    let hawkerCentreId = null;
    if (loc?.name) {
      const centre = await findOrCreateHawkerCentre(loc.name, {
        address: loc.address || "",
        postalCode: loc.postalCode || "",
        placeId: loc.placeId || "",
        location: loc.latitude
          ? { latitude: loc.latitude, longitude: loc.longitude }
          : null,
      });
      hawkerCentreId = centre.id;

      // Set operatorId on the hawker centre document
      await updateDoc(doc(db, "hawkerCentres", centre.id), {
        operatorId: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
    }

    // Update operator profile
    await updateDoc(doc(db, "operators", currentUser.uid), {
      companyName: operatorData.companyName,
      uen: operatorData.uen,
      operatorName: operatorData.operatorName,
      contactPerson: operatorData.contactPerson,
      contactNumber: operatorData.contactNumber,
      contactEmail: operatorData.contactEmail,
      managedLocation: operatorData.managedLocation,
      hawkerCentreId: hawkerCentreId,
      browserNotifications: operatorData.browserNotifications,
      telegramConnected: operatorData.telegramConnected,
      telegramChatId: operatorData.telegramChatId,
      onboardingComplete: true,
      updatedAt: serverTimestamp(),
    });

    // Redirect to dashboard
    window.location.href = "../Operator Dashboard/operatorDashboard.html";
  } catch (error) {
    console.error("Error completing onboarding:", error);
    alert("There was an error submitting your application. Please try again.");

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Complete setup";
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
    companyName: operatorData.companyName,
    uen: operatorData.uen,
    operatorName: operatorData.operatorName,
    contactPerson: operatorData.contactPerson,
    contactNumber: operatorData.contactNumber,
    contactEmail: operatorData.contactEmail,
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && value) el.value = value;
  });

  // Map location is restored inside initMapLocationPicker()
}

// ============================================
// MAP LOCATION PICKER
// ============================================

let mapInstance = null;
let mapMarker = null;

async function initMapLocationPicker() {
  const mapEl = document.getElementById("map");
  const addressInput = document.getElementById("addressInput");

  if (!mapEl || !addressInput) return;

  // Load libraries via importLibrary
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  const { PlaceAutocompleteElement } =
    await google.maps.importLibrary("places");
  const { Geocoder } = await google.maps.importLibrary("geocoding");

  // Initialize map centered on Singapore
  mapInstance = new Map(mapEl, {
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

      mapInstance.setCenter(pos);
      mapInstance.setZoom(17);
      placeMapMarker(pos, AdvancedMarkerElement);

      const postalCode = extractPostalCode(place.addressComponents);

      operatorData.managedLocation = {
        name: place.displayName || "",
        address: place.formattedAddress || "",
        postalCode: postalCode,
        latitude: pos.lat,
        longitude: pos.lng,
        placeId: place.id || "",
      };

      showSelectedLocation(operatorData.managedLocation);
    },
  );

  // Click on map to drop pin
  mapInstance.addListener("click", (e) => {
    const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    placeMapMarker(pos, AdvancedMarkerElement);
    reverseGeocode(pos, Geocoder);
  });

  // Clear button
  document.getElementById("clearLocation")?.addEventListener("click", () => {
    clearMapSelection();
  });

  // Restore saved location if available
  if (operatorData.managedLocation?.latitude) {
    const pos = {
      lat: operatorData.managedLocation.latitude,
      lng: operatorData.managedLocation.longitude,
    };
    mapInstance.setCenter(pos);
    mapInstance.setZoom(17);
    placeMapMarker(pos, AdvancedMarkerElement);
    showSelectedLocation(operatorData.managedLocation);
  }
}

function placeMapMarker(pos, AdvancedMarkerElement) {
  if (mapMarker) {
    mapMarker.position = pos;
  } else {
    mapMarker = new AdvancedMarkerElement({
      position: pos,
      map: mapInstance,
      gmpDraggable: true,
    });

    mapMarker.addListener("dragend", () => {
      const newPos = {
        lat: mapMarker.position.lat,
        lng: mapMarker.position.lng,
      };
      reverseGeocode(newPos);
    });
  }
}

function reverseGeocode(pos, GeocoderClass) {
  const geocoder = GeocoderClass
    ? new GeocoderClass()
    : new google.maps.Geocoder();
  geocoder.geocode({ location: pos }, (results, status) => {
    if (status === "OK" && results[0]) {
      const result = results[0];
      const postalCode = extractPostalCode(result.address_components);

      operatorData.managedLocation = {
        name: result.formatted_address.split(",")[0] || "",
        address: result.formatted_address || "",
        postalCode: postalCode,
        latitude: pos.lat,
        longitude: pos.lng,
        placeId: result.place_id || "",
      };

      showSelectedLocation(operatorData.managedLocation);
    }
  });
}

function extractPostalCode(addressComponents) {
  if (!addressComponents) return "";
  // Support both old format (types/long_name) and new format (types/longText)
  const postal = addressComponents.find(
    (c) => c.types?.includes("postal_code") || c.types?.includes("postal_code"),
  );
  return postal?.longText || postal?.long_name || "";
}

function showSelectedLocation(loc) {
  const container = document.getElementById("selectedLocation");
  const nameEl = document.getElementById("selectedLocationName");
  const addressEl = document.getElementById("selectedLocationAddress");

  if (!container) return;

  nameEl.textContent = loc.name || "Dropped pin";
  addressEl.textContent = loc.address || "";
  container.style.display = "flex";
}

function clearMapSelection() {
  operatorData.managedLocation = null;

  if (mapMarker) {
    mapMarker.map = null;
    mapMarker = null;
  }

  const container = document.getElementById("selectedLocation");
  if (container) container.style.display = "none";

  // Reset map view
  if (mapInstance) {
    mapInstance.setCenter({ lat: 1.3521, lng: 103.8198 });
    mapInstance.setZoom(12);
  }
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
    operatorData.browserNotifications = isChecked;
  });
}

function initTelegram() {
  const connectBtn = document.getElementById("connectTelegram");
  const connectedState = document.getElementById("telegramConnectedState");

  if (!connectBtn) return;

  connectBtn.addEventListener("click", () => {
    const botUsername = "hawkrOrgBot";
    const startParam = currentUser?.uid || "";
    window.open(`https://t.me/${botUsername}?start=${startParam}`, "_blank");
  });

  // Check if already connected
  if (operatorData.telegramConnected && connectedState) {
    connectBtn.parentElement.style.display = "none";
    connectedState.style.display = "flex";
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
          // Delete the operator profile so they can choose again
          if (currentUser) {
            await deleteDoc(doc(db, "operators", currentUser.uid));
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
  initMapLocationPicker();
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

  // Pre-fill email from auth
  operatorData.contactEmail = user.email || "";

  // Check if operator profile exists
  const operatorDoc = await getDoc(doc(db, "operators", user.uid));
  if (operatorDoc.exists()) {
    const data = operatorDoc.data();
    if (data.onboardingComplete) {
      window.location.href = "../Operator Dashboard/operatorDashboard.html";
      return;
    }
    // Load existing data
    Object.keys(operatorData).forEach((key) => {
      if (data[key] !== undefined) {
        operatorData[key] = data[key];
      }
    });

    // Handle migration from old managedLocations array
    if (data.managedLocations && !data.managedLocation) {
      // Old format — user will re-select on map
      operatorData.managedLocation = null;
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
