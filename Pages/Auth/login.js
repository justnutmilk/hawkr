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

  // Verify critical DOM elements exist
  if (!loginForm || !emailInput || !passwordInput || !loginBtn) {
    console.error("Critical form elements not found. Check HTML structure.");
    return;
  }

  // Check if user is already logged in
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Check if user has completed onboarding
      await handleUserRedirect(user);
    }
  });

  /**
   * Check user profile and redirect appropriately
   */
  async function handleUserRedirect(user) {
    try {
      // Check if user profile exists
      const customerDoc = await getDoc(doc(db, "customers", user.uid));
      const vendorDoc = await getDoc(doc(db, "vendors", user.uid));

      if (customerDoc.exists()) {
        const data = customerDoc.data();
        if (!data.onboardingComplete) {
          // Redirect to customer onboarding
          window.location.href = "onboarding-consumer.html";
          return;
        }
        // Redirect to consumer dashboard
        window.location.href = "../Consumer Dashboard/consumerDashboard.html";
      } else if (vendorDoc.exists()) {
        const data = vendorDoc.data();
        if (!data.onboardingComplete) {
          // Redirect to vendor onboarding
          window.location.href = "onboarding-vendor.html";
          return;
        }
        // Redirect to vendor dashboard
        window.location.href = "../Vendor Dashboard/vendorDashboard.html";
      } else {
        // New user via Google - needs role selection
        window.location.href = "select-role.html";
      }
    } catch (error) {
      console.error("Error checking user profile:", error);
      // Default to consumer dashboard
      window.location.href = "../Consumer Dashboard/consumerDashboard.html";
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
    emailInput.classList.remove("error");
    passwordInput.classList.remove("error");
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

      // Sign in with email and password
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );

      console.log("Login successful:", userCredential.user.email);

      // Redirect handled by onAuthStateChanged
    } catch (error) {
      console.error("Login error:", error);
      showError(generalError, null, getErrorMessage(error.code));
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

        const result = await signInWithPopup(auth, provider);
        console.log("Google sign in successful:", result.user.email);

        // Redirect handled by onAuthStateChanged
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
} // End of initializeLoginPage function
