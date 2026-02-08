/**
 * Hawkr - Login Page
 * Handles user authentication with Firebase
 */

import { auth, db } from "../../firebase/config.js";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", initializeLoginPage);

function initializeLoginPage() {
  // DOM Elements
  const loginForm = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const rememberMeCheckbox = document.getElementById("rememberMe");
  const loginBtn = document.getElementById("loginBtn");
  const googleBtn = document.getElementById("googleBtn");
  const passwordToggle = document.getElementById("passwordToggle");

  // Error elements
  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");
  const generalError = document.getElementById("generalError");
  const invalidCredentialsNotif = document.getElementById(
    "invalidCredentialsNotif",
  );
  const invalidCredentialsClose = document.getElementById(
    "invalidCredentialsClose",
  );

  // Verify critical DOM elements exist
  if (!loginForm || !emailInput || !passwordInput || !loginBtn) {
    console.error("Critical form elements not found. Check HTML structure.");
    return;
  }

  // Track if user just logged in (vs already being logged in)
  let userJustLoggedIn = false;

  // Only redirect after a successful login action, not on page load
  onAuthStateChanged(auth, async (user) => {
    if (user && userJustLoggedIn) {
      await handleUserRedirect(user);
    }
  });

  /**
   * Check user profile and redirect appropriately
   */
  async function handleUserRedirect(user) {
    try {
      // Check if user profile exists in each collection
      const customerDoc = await getDoc(doc(db, "customers", user.uid));
      const vendorDoc = await getDoc(doc(db, "vendors", user.uid));
      const operatorDoc = await getDoc(doc(db, "operators", user.uid));
      const authorityDoc = await getDoc(doc(db, "authorities", user.uid));

      if (authorityDoc.exists()) {
        window.location.href = "../Authority Dashboard/authorityDashboard.html";
        return;
      }

      if (vendorDoc.exists()) {
        const data = vendorDoc.data();
        if (!data.onboardingComplete) {
          // Redirect to vendor onboarding
          window.location.href = "onboarding-vendor.html";
          return;
        }
        // Redirect to vendor dashboard
        window.location.href = "../Vendor Dashboard/vendorDashboard.html";
      } else if (operatorDoc.exists()) {
        const data = operatorDoc.data();
        if (!data.onboardingComplete) {
          window.location.href = "onboarding-operator.html";
          return;
        }
        window.location.href = "../Operator Dashboard/operatorDashboard.html";
      } else if (customerDoc.exists()) {
        const data = customerDoc.data();
        if (!data.onboardingComplete) {
          // Redirect to customer onboarding
          window.location.href = "onboarding-consumer.html";
          return;
        }
        // Redirect to consumer dashboard
        window.location.href = "../Consumer Dashboard/consumerDashboard.html";
      } else {
        // New user via Google - needs role selection
        window.location.href = "select-role.html";
      }
    } catch (error) {
      console.error("Error checking user profile:", error);
      // Default to role selection instead of assuming consumer
      window.location.href = "select-role.html";
    }
  }

  /**
   * Toggle password visibility
   */
  if (passwordToggle) {
    passwordToggle.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      passwordToggle.classList.toggle("visible", isPassword);
    });
  }

  /**
   * Clear error messages
   */
  function clearErrors() {
    emailError.classList.remove("visible");
    passwordError.classList.remove("visible");
    generalError.classList.remove("visible");
    if (invalidCredentialsNotif) {
      invalidCredentialsNotif.classList.remove("visible");
    }
    emailInput.classList.remove("error");
    passwordInput.classList.remove("error");
  }

  /**
   * Show invalid credentials notification (slide-in)
   */
  function showInvalidCredentialsError() {
    if (invalidCredentialsNotif) {
      invalidCredentialsNotif.classList.add("visible");
    }
  }

  /**
   * Hide invalid credentials notification
   */
  function hideInvalidCredentialsError() {
    if (invalidCredentialsNotif) {
      invalidCredentialsNotif.classList.remove("visible");
    }
  }

  // Close button for invalid credentials notification
  if (invalidCredentialsClose) {
    invalidCredentialsClose.addEventListener(
      "click",
      hideInvalidCredentialsError,
    );
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
    loginBtn.disabled = isLoading;
    loginBtn.classList.toggle("loading", isLoading);
    if (googleBtn) {
      googleBtn.disabled = isLoading;
    }
  }

  /**
   * Get user-friendly error message
   */
  function getErrorMessage(errorCode) {
    const errorMessages = {
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/user-disabled":
        "This account has been disabled. Please contact support.",
      "auth/user-not-found":
        "No account found with this email address. Please create an account first.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/invalid-credential":
        "No account found with this email, or the password is incorrect. Please check your details or create an account.",
      "auth/too-many-requests":
        "Too many failed attempts. Please try again later.",
      "auth/network-request-failed":
        "Network error. Please check your connection.",
      "auth/popup-closed-by-user": "Sign in was cancelled.",
      "auth/popup-blocked":
        "Pop-up was blocked. Please allow pop-ups and try again.",
      "auth/operation-not-allowed":
        "This sign-in method is not enabled. Please enable it in Firebase Console (Authentication > Sign-in method) or use email/password.",
      "auth/unauthorized-domain":
        "This domain is not authorized for sign-in. Please add it in Firebase Console (Authentication > Settings > Authorized domains).",
    };

    return errorMessages[errorCode] || "An error occurred. Please try again.";
  }

  /**
   * Handle form submission
   */
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;

    // Validate inputs
    let hasError = false;

    if (!email) {
      showError(emailError, emailInput, "Email is required.");
      hasError = true;
    } else if (!isValidEmail(email)) {
      showError(emailError, emailInput, "Please enter a valid email address.");
      hasError = true;
    }

    if (!password) {
      showError(passwordError, passwordInput, "Password is required.");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    try {
      // Set persistence based on "Remember me" checkbox
      const persistence = rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence;
      await setPersistence(auth, persistence);

      // Mark that user is actively logging in
      userJustLoggedIn = true;

      // Sign in with email and password
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );

      console.log("Login successful:", userCredential.user.email);

      // Redirect after successful login
      await handleUserRedirect(userCredential.user);
    } catch (error) {
      console.error("Login error:", error);
      // Show squirrel error for invalid credentials
      const invalidCredentialCodes = [
        "auth/invalid-credential",
        "auth/user-not-found",
        "auth/wrong-password",
      ];
      if (invalidCredentialCodes.includes(error.code)) {
        showInvalidCredentialsError();
      } else {
        showError(generalError, null, getErrorMessage(error.code));
      }
      setLoading(false);
    }
  });

  /**
   * Handle Google Sign In
   */
  if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
      clearErrors();
      setLoading(true);

      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: "select_account",
        });

        // Mark that user is actively logging in
        userJustLoggedIn = true;

        const result = await signInWithPopup(auth, provider);
        console.log("Google sign in successful:", result.user.email);

        // Redirect after successful login
        await handleUserRedirect(result.user);
      } catch (error) {
        console.error("Google sign in error:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);

        if (error.code !== "auth/popup-closed-by-user") {
          // Provide more specific guidance for common configuration issues
          let errorMessage = getErrorMessage(error.code);
          if (error.code === "auth/operation-not-allowed") {
            errorMessage =
              "Google Sign-In is not enabled. To enable it: Go to Firebase Console > Authentication > Sign-in method > Google > Enable.";
          }
          showError(generalError, null, errorMessage);
        }
        setLoading(false);
      }
    });
  }

  /**
   * Real-time validation
   */
  emailInput.addEventListener("blur", () => {
    const email = emailInput.value.trim();
    if (email && !isValidEmail(email)) {
      showError(emailError, emailInput, "Please enter a valid email address.");
    } else {
      emailError.classList.remove("visible");
      emailInput.classList.remove("error");
    }
  });

  emailInput.addEventListener("input", () => {
    if (emailInput.classList.contains("error")) {
      emailError.classList.remove("visible");
      emailInput.classList.remove("error");
    }
  });

  passwordInput.addEventListener("input", () => {
    if (passwordInput.classList.contains("error")) {
      passwordError.classList.remove("visible");
      passwordInput.classList.remove("error");
    }
  });
  // Initialize liquid glass top bar
  initLiquidGlassTopBar();
} // End of initializeLoginPage function

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

  // Subtle hover bounce effect
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
