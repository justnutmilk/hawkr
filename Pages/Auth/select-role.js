/**
 * Hawkr - Role Selection Page
 * Allows new users to select their role (Customer or Vendor)
 */

import { auth, db } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const customerRoleBtn = document.getElementById("customerRole");
const vendorRoleBtn = document.getElementById("vendorRole");
const operatorRoleBtn = document.getElementById("operatorRole");
const generalError = document.getElementById("generalError");

let currentUser = null;

// Check auth state
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Not logged in - redirect to login
    window.location.href = "login.html";
    return;
  }

  currentUser = user;

  // Check if user already has a role
  const customerDoc = await getDoc(doc(db, "customers", user.uid));
  const vendorDoc = await getDoc(doc(db, "vendors", user.uid));
  const operatorDoc = await getDoc(doc(db, "operators", user.uid));

  if (vendorDoc.exists()) {
    // Already a vendor - go to onboarding or dashboard
    const data = vendorDoc.data();
    if (!data.onboardingComplete) {
      window.location.href = "onboarding-vendor.html";
    } else {
      window.location.href = "../Vendor Dashboard/vendorDashboard.html";
    }
    return;
  }

  if (operatorDoc.exists()) {
    // Already an operator - go to onboarding or dashboard
    const data = operatorDoc.data();
    if (!data.onboardingComplete) {
      window.location.href = "onboarding-operator.html";
    } else {
      window.location.href = "../Operator Dashboard/operatorDashboard.html";
    }
    return;
  }

  if (customerDoc.exists()) {
    // Already a customer - go to onboarding or dashboard
    const data = customerDoc.data();
    if (!data.onboardingComplete) {
      window.location.href = "onboarding-consumer.html";
    } else {
      window.location.href = "../Consumer Dashboard/consumerDashboard.html";
    }
    return;
  }
});

/**
 * Show error message
 */
function showError(message) {
  generalError.textContent = message;
  generalError.classList.add("visible");
}

/**
 * Create user profile based on selected role
 */
async function selectRole(role) {
  if (!currentUser) {
    showError("Please wait while we verify your account...");
    return;
  }

  try {
    const { displayName, email, photoURL } = currentUser;

    if (role === "customer") {
      // Create customer profile
      await setDoc(doc(db, "customers", currentUser.uid), {
        displayName: displayName || "",
        email: email,
        photoURL: photoURL || "",
        phone: "",
        role: "customer",
        onboardingComplete: false,
        preferences: {
          browserNotifications: false,
          telegramConnected: false,
          telegramChatId: null,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Redirect to customer onboarding
      window.location.href = "onboarding-consumer.html";
    } else if (role === "vendor") {
      // Create vendor profile
      await setDoc(doc(db, "vendors", currentUser.uid), {
        displayName: displayName || "",
        email: email,
        photoURL: photoURL || "",
        role: "vendor",
        onboardingComplete: false,
        onboardingStep: 1,
        // Store data (to be filled during onboarding)
        storeName: "",
        storeLocation: null,
        unitNumber: "",
        cuisines: [],
        operatingHours: [],
        storePhoto: null,
        hygieneCert: null,
        halalCert: null,
        uen: "",
        contactPerson: "",
        contactNumber: "",
        preferences: {
          browserNotifications: false,
          telegramConnected: false,
          telegramChatId: null,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Redirect to vendor onboarding
      window.location.href = "onboarding-vendor.html";
    } else if (role === "operator") {
      // Create operator profile
      await setDoc(doc(db, "operators", currentUser.uid), {
        displayName: displayName || "",
        email: email,
        photoURL: photoURL || "",
        role: "operator",
        onboardingComplete: false,
        onboardingStep: 1,
        // Operator data (to be filled during onboarding)
        operatorName: "",
        companyName: "",
        uen: "",
        contactPerson: "",
        contactNumber: "",
        managedLocations: [],
        preferences: {
          browserNotifications: false,
          telegramConnected: false,
          telegramChatId: null,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Redirect to operator onboarding
      window.location.href = "onboarding-operator.html";
    }
  } catch (error) {
    console.error("Error creating profile:", error);
    showError("Failed to create profile. Please try again.");
  }
}

// Event listeners
customerRoleBtn.addEventListener("click", () => {
  customerRoleBtn.classList.add("selected");
  vendorRoleBtn.classList.remove("selected");
  operatorRoleBtn.classList.remove("selected");
  selectRole("customer");
});

vendorRoleBtn.addEventListener("click", () => {
  vendorRoleBtn.classList.add("selected");
  customerRoleBtn.classList.remove("selected");
  operatorRoleBtn.classList.remove("selected");
  selectRole("vendor");
});

operatorRoleBtn.addEventListener("click", () => {
  operatorRoleBtn.classList.add("selected");
  customerRoleBtn.classList.remove("selected");
  vendorRoleBtn.classList.remove("selected");
  selectRole("operator");
});

// Initialize liquid glass top bar
initLiquidGlassTopBar();

// ============================================
// LIQUID GLASS TOP BAR - DRAGGABLE & BOUNCY
// ============================================

function initLiquidGlassTopBar() {
  const topBar = document.getElementById("authGlassTopBar");
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
    if (e.target.closest("button") || e.target.closest("a")) return;

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
