/**
 * Hawkr - Consumer Onboarding
 * Clean, settings-style onboarding matching vendor layout
 */

import { auth, db } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initLiquidGlassToggle } from "../../assets/js/liquidGlassToggle.js";

// ============================================
// STATE
// ============================================

let currentUser = null;
let currentStep = "profile-info";

const stepOrder = ["profile-info", "notification-settings", "review"];

const stepToSection = {
  "profile-info": "profile",
  "notification-settings": "notifications",
  review: "review",
};

const consumerData = {
  displayName: "",
  email: "",
  phone: "",
  preferences: {
    browserNotifications: false,
  },
  telegramConnected: false,
  telegramChatId: null,
  telegramUsername: null,
};

let isOAuthUser = false;
const completedSteps = new Set();

// ============================================
// NAVIGATION
// ============================================

function navigateToStep(stepId) {
  // Collect data before navigating
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

function collectStepData(stepId) {
  switch (stepId) {
    case "profile-info":
      consumerData.displayName =
        document.getElementById("displayName")?.value.trim() || "";
      // Only collect email if not OAuth user
      if (!isOAuthUser) {
        consumerData.email =
          document.getElementById("email")?.value.trim() || "";
      }
      consumerData.phone = document.getElementById("phone")?.value.trim() || "";
      break;
  }
}

// ============================================
// REVIEW PAGE
// ============================================

function updateReviewPage() {
  // Profile
  document.getElementById("reviewName").textContent =
    consumerData.displayName || "-";
  document.getElementById("reviewEmail").textContent =
    consumerData.email || "-";
  document.getElementById("reviewPhone").textContent = consumerData.phone
    ? "+65 " + consumerData.phone
    : "Not provided";

  // Notifications
  document.getElementById("reviewBrowser").textContent = consumerData
    .preferences.browserNotifications
    ? "Enabled"
    : "Disabled";
  document.getElementById("reviewTelegram").textContent =
    consumerData.telegramConnected ? "Connected" : "Not connected";
}

// ============================================
// FIREBASE OPERATIONS
// ============================================

async function saveProgress() {
  if (!currentUser) return;

  try {
    await updateDoc(doc(db, "customers", currentUser.uid), {
      displayName: consumerData.displayName,
      email: consumerData.email,
      phone: consumerData.phone,
      "preferences.browserNotifications":
        consumerData.preferences.browserNotifications,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error saving progress:", error);
  }
}

async function completeOnboarding() {
  if (!currentUser) return;

  // Collect final data
  collectStepData(currentStep);

  const btn = document.getElementById("completeOnboarding");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Setting up...";
  }

  try {
    await updateDoc(doc(db, "customers", currentUser.uid), {
      displayName: consumerData.displayName,
      email: consumerData.email,
      phone: consumerData.phone,
      "preferences.browserNotifications":
        consumerData.preferences.browserNotifications,
      onboardingComplete: true,
      updatedAt: serverTimestamp(),
    });

    window.location.href = "../Consumer Dashboard/consumerDashboard.html";
  } catch (error) {
    console.error("Error completing onboarding:", error);
    alert("Failed to complete setup. Please try again.");

    if (btn) {
      btn.disabled = false;
      btn.textContent = "Get started";
    }
  }
}

// ============================================
// FORM POPULATION
// ============================================

function populateFormFromData() {
  const nameInput = document.getElementById("displayName");
  const emailInput = document.getElementById("email");
  const oauthBadge = document.getElementById("oauthBadge");
  const phoneInput = document.getElementById("phone");

  if (nameInput && consumerData.displayName) {
    nameInput.value = consumerData.displayName;
  }
  if (emailInput && consumerData.email) {
    emailInput.value = consumerData.email;
  }
  if (phoneInput && consumerData.phone) {
    phoneInput.value = consumerData.phone;
  }

  // Lock email field and show badge if OAuth user
  if (isOAuthUser && emailInput) {
    emailInput.disabled = true;
    if (oauthBadge) {
      oauthBadge.style.display = "inline-flex";
    }
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

  // Set initial state
  const checkbox = toggleLabel.querySelector("input");
  const thumb = toggleLabel.querySelector(".toggleThumb");
  if (checkbox && consumerData.preferences.browserNotifications) {
    checkbox.checked = true;
    if (thumb) thumb.classList.add("glass");
  }

  initLiquidGlassToggle(toggleLabel, (isChecked) => {
    consumerData.preferences.browserNotifications = isChecked;
  });
}

function initTelegram() {
  const container = document.getElementById("telegramLoginWidget");
  const connectedState = document.getElementById("telegramConnectedState");

  // If already connected
  if (consumerData.telegramConnected) {
    const handle = consumerData.telegramUsername
      ? `@${consumerData.telegramUsername}`
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
    await updateDoc(doc(db, "customers", currentUser.uid), {
      telegramChatId: user.id.toString(),
      telegramLinked: true,
      telegramUsername: user.username || null,
      telegramFirstName: user.first_name || null,
      telegramPhotoUrl: user.photo_url || null,
      telegramAuthDate: user.auth_date,
    });

    consumerData.telegramConnected = true;
    consumerData.telegramChatId = user.id.toString();
    consumerData.telegramUsername = user.username || null;

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
    await updateDoc(doc(db, "customers", currentUser.uid), {
      telegramChatId: null,
      telegramLinked: false,
      telegramUsername: null,
      telegramFirstName: null,
      telegramPhotoUrl: null,
      telegramAuthDate: null,
    });

    consumerData.telegramConnected = false;
    consumerData.telegramChatId = null;
    consumerData.telegramUsername = null;

    const widget = document.getElementById("telegramLoginWidget");
    const connectedState = document.getElementById("telegramConnectedState");
    if (connectedState) connectedState.style.display = "none";
    if (widget) widget.style.display = "flex";

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
  // Back button - allows role change on first step, otherwise goes to previous step
  document.getElementById("backButton")?.addEventListener("click", async () => {
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex <= 0) {
      if (
        confirm(
          "Do you want to go back and choose a different role? Your current progress will be deleted.",
        )
      ) {
        try {
          if (currentUser) {
            await deleteDoc(doc(db, "customers", currentUser.uid));
          }
          window.location.href = "select-role.html";
        } catch (error) {
          console.error("Error deleting profile:", error);
          alert("Failed to go back. Please try again.");
        }
      }
    } else {
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

  // Complete button
  document
    .getElementById("completeOnboarding")
    ?.addEventListener("click", completeOnboarding);

  // Initialize components
  initLiquidGlassTopBar();
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

  // Check if user signed in with OAuth (Google, etc.)
  isOAuthUser = user.providerData.some(
    (provider) => provider.providerId !== "password",
  );

  // Pre-fill email from auth
  consumerData.email = user.email || "";
  consumerData.displayName = user.displayName || "";

  const customerDoc = await getDoc(doc(db, "customers", user.uid));
  if (customerDoc.exists()) {
    const data = customerDoc.data();
    if (data.onboardingComplete) {
      window.location.href = "../Consumer Dashboard/consumerDashboard.html";
      return;
    }
    // Load existing data
    if (data.displayName) consumerData.displayName = data.displayName;
    if (data.phone) consumerData.phone = data.phone;
    if (data.preferences?.browserNotifications) {
      consumerData.preferences.browserNotifications =
        data.preferences.browserNotifications;
    }
    // Telegram fields are top-level (matching vendor pattern)
    if (data.telegramLinked) {
      consumerData.telegramConnected = true;
      consumerData.telegramChatId = data.telegramChatId || null;
      consumerData.telegramUsername = data.telegramUsername || null;
    }
  } else {
    window.location.href = "select-role.html";
    return;
  }

  populateFormFromData();
  initializeForm();
  navigateToStep(currentStep);
});
