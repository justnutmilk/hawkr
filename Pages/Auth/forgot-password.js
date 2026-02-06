/**
 * Hawkr - Forgot Password Page
 * Handles password reset emails via Firebase
 */

import { auth } from "../../firebase/config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// DOM Elements
const resetForm = document.getElementById("resetForm");
const emailInput = document.getElementById("email");
const resetBtn = document.getElementById("resetBtn");
const resendBtn = document.getElementById("resendBtn");
const formView = document.getElementById("formView");
const successView = document.getElementById("successView");
const sentEmail = document.getElementById("sentEmail");

// Error elements
const emailError = document.getElementById("emailError");
const generalError = document.getElementById("generalError");

// Store email for resend functionality
let lastEmail = "";

/**
 * Clear error messages
 */
function clearErrors() {
  emailError.classList.remove("visible");
  generalError.classList.remove("visible");
  emailInput.classList.remove("error");
}

/**
 * Show error message
 */
function showError(element, inputElement, message) {
  element.textContent = message;
  element.classList.add("visible");
  if (inputElement) {
    inputElement.classList.add("error");
  }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Set loading state
 */
function setLoading(isLoading) {
  resetBtn.disabled = isLoading;
  resetBtn.classList.toggle("loading", isLoading);
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(errorCode) {
  const errorMessages = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-not-found": "No account found with this email address.",
    "auth/too-many-requests": "Too many requests. Please try again later.",
    "auth/network-request-failed":
      "Network error. Please check your connection.",
  };

  return errorMessages[errorCode] || "An error occurred. Please try again.";
}

/**
 * Show success view
 */
function showSuccess(email) {
  formView.style.display = "none";
  successView.classList.add("visible");
  sentEmail.textContent = email;
}

/**
 * Show form view (for retry)
 */
function showForm() {
  successView.classList.remove("visible");
  formView.style.display = "block";
  emailInput.value = lastEmail;
}

/**
 * Send password reset email
 */
async function sendReset(email) {
  setLoading(true);
  clearErrors();

  try {
    await sendPasswordResetEmail(auth, email, {
      url: window.location.origin + "/Pages/Auth/login.html",
      handleCodeInApp: false,
    });

    lastEmail = email;
    showSuccess(email);
    console.log("Password reset email sent to:", email);
  } catch (error) {
    console.error("Password reset error:", error);

    // For security, we show success even if email doesn't exist
    // This prevents email enumeration attacks
    if (error.code === "auth/user-not-found") {
      lastEmail = email;
      showSuccess(email);
    } else {
      showError(generalError, null, getErrorMessage(error.code));
    }
  } finally {
    setLoading(false);
  }
}

/**
 * Handle form submission
 */
resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();

  const email = emailInput.value.trim();

  // Validate email
  if (!email) {
    showError(emailError, emailInput, "Email is required.");
    return;
  }

  if (!isValidEmail(email)) {
    showError(emailError, emailInput, "Please enter a valid email address.");
    return;
  }

  await sendReset(email);
});

/**
 * Handle resend button click
 */
resendBtn.addEventListener("click", () => {
  showForm();
});

/**
 * Real-time validation
 */
emailInput.addEventListener("blur", () => {
  const email = emailInput.value.trim();
  if (email && !isValidEmail(email)) {
    showError(emailError, emailInput, "Please enter a valid email address.");
  }
});

emailInput.addEventListener("input", () => {
  if (emailInput.classList.contains("error")) {
    emailError.classList.remove("visible");
    emailInput.classList.remove("error");
  }
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
