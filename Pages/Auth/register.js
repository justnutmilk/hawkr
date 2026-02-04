/**
 * Hawkr - Registration Page
 * Handles new user registration with Firebase
 * After registration, users are redirected to role selection
 */

import { auth } from "../../firebase/config.js";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", initializeRegisterPage);

function initializeRegisterPage() {
  // DOM Elements
  const registerForm = document.getElementById("registerForm");
  const displayNameInput = document.getElementById("displayName");
  const emailInput = document.getElementById("email");
  const phoneInput = document.getElementById("phone");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const agreeTermsCheckbox = document.getElementById("agreeTerms");
  const registerBtn = document.getElementById("registerBtn");
  const googleBtn = document.getElementById("googleBtn");
  const passwordToggle = document.getElementById("passwordToggle");
  const confirmPasswordToggle = document.getElementById(
    "confirmPasswordToggle",
  );

  // Password strength elements
  const strengthBars = [
    document.getElementById("bar1"),
    document.getElementById("bar2"),
    document.getElementById("bar3"),
    document.getElementById("bar4"),
  ];
  const strengthText = document.getElementById("strengthText");

  // Error elements
  const nameError = document.getElementById("nameError");
  const emailError = document.getElementById("emailError");
  const phoneError = document.getElementById("phoneError");
  const passwordError = document.getElementById("passwordError");
  const confirmPasswordError = document.getElementById("confirmPasswordError");
  const generalError = document.getElementById("generalError");

  // Verify critical DOM elements exist
  if (!registerForm || !emailInput || !passwordInput || !registerBtn) {
    console.error("Critical form elements not found. Check HTML structure.");
    return;
  }

  // Store phone temporarily for later
  let tempPhone = "";

  // Check if user is already logged in
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User registered successfully - redirect to role selection
      window.location.href = "select-role.html";
    }
  });

  /**
   * Toggle password visibility
   */
  passwordToggle.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    passwordToggle.classList.toggle("visible", isPassword);
  });

  confirmPasswordToggle.addEventListener("click", () => {
    const isPassword = confirmPasswordInput.type === "password";
    confirmPasswordInput.type = isPassword ? "text" : "password";
    confirmPasswordToggle.classList.toggle("visible", isPassword);
  });

  /**
   * Password strength checker
   */
  function checkPasswordStrength(password) {
    let strength = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    Object.values(checks).forEach((passed) => {
      if (passed) strength++;
    });

    return {
      score: strength,
      checks,
    };
  }

  function updatePasswordStrengthUI(password) {
    const { score } = checkPasswordStrength(password);

    // Reset all bars
    strengthBars.forEach((bar) => {
      bar.className = "strengthBar";
    });

    strengthText.className = "strengthText";
    strengthText.textContent = "";

    if (password.length === 0) return;

    const levels = [
      { min: 1, max: 2, class: "weak", text: "Weak" },
      { min: 3, max: 3, class: "fair", text: "Fair" },
      { min: 4, max: 4, class: "good", text: "Good" },
      { min: 5, max: 5, class: "strong", text: "Strong" },
    ];

    const level = levels.find((l) => score >= l.min && score <= l.max);
    if (level) {
      for (let i = 0; i < score && i < 4; i++) {
        strengthBars[i].classList.add(level.class);
      }
      strengthText.classList.add(level.class);
      strengthText.textContent = level.text;
    }
  }

  passwordInput.addEventListener("input", () => {
    updatePasswordStrengthUI(passwordInput.value);
    if (passwordInput.classList.contains("error")) {
      passwordError.classList.remove("visible");
      passwordInput.classList.remove("error");
    }
  });

  /**
   * Clear error messages
   */
  function clearErrors() {
    [
      nameError,
      emailError,
      phoneError,
      passwordError,
      confirmPasswordError,
      generalError,
    ].forEach((el) => el.classList.remove("visible"));
    [
      displayNameInput,
      emailInput,
      phoneInput,
      passwordInput,
      confirmPasswordInput,
    ].forEach((el) => el.classList.remove("error"));
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
   * Validate phone number (Singapore format)
   */
  function isValidPhone(phone) {
    if (!phone) return true; // Phone is optional
    const phoneRegex = /^(\+65)?[689]\d{7}$/;
    return phoneRegex.test(phone.replace(/\s/g, ""));
  }

  /**
   * Set loading state
   */
  function setLoading(isLoading) {
    registerBtn.disabled = isLoading;
    registerBtn.classList.toggle("loading", isLoading);
    googleBtn.disabled = isLoading;
  }

  /**
   * Get user-friendly error message
   */
  function getErrorMessage(errorCode) {
    const errorMessages = {
      "auth/email-already-in-use":
        "An account with this email already exists. Please sign in instead.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/operation-not-allowed":
        "This sign-in method is not enabled. Please enable it in Firebase Console (Authentication > Sign-in method).",
      "auth/weak-password": "Password should be at least 6 characters.",
      "auth/network-request-failed":
        "Network error. Please check your connection.",
      "auth/popup-closed-by-user": "Sign up was cancelled.",
      "auth/popup-blocked":
        "Pop-up was blocked. Please allow pop-ups and try again.",
      "auth/unauthorized-domain":
        "This domain is not authorized for sign-in. Please add it in Firebase Console (Authentication > Settings > Authorized domains).",
    };

    return errorMessages[errorCode] || "An error occurred. Please try again.";
  }

  /**
   * Handle form submission
   */
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const displayName = displayNameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const agreeTerms = agreeTermsCheckbox.checked;

    // Validate inputs
    let hasError = false;

    if (!displayName) {
      showError(nameError, displayNameInput, "Full name is required.");
      hasError = true;
    } else if (displayName.length < 2) {
      showError(
        nameError,
        displayNameInput,
        "Name must be at least 2 characters.",
      );
      hasError = true;
    }

    if (!email) {
      showError(emailError, emailInput, "Email is required.");
      hasError = true;
    } else if (!isValidEmail(email)) {
      showError(emailError, emailInput, "Please enter a valid email address.");
      hasError = true;
    }

    if (phone && !isValidPhone(phone)) {
      showError(
        phoneError,
        phoneInput,
        "Please enter a valid Singapore phone number.",
      );
      hasError = true;
    }

    if (!password) {
      showError(passwordError, passwordInput, "Password is required.");
      hasError = true;
    } else if (password.length < 8) {
      showError(
        passwordError,
        passwordInput,
        "Password must be at least 8 characters.",
      );
      hasError = true;
    } else {
      const { score } = checkPasswordStrength(password);
      if (score < 3) {
        showError(
          passwordError,
          passwordInput,
          "Password is too weak. Add uppercase, numbers, or special characters.",
        );
        hasError = true;
      }
    }

    if (!confirmPassword) {
      showError(
        confirmPasswordError,
        confirmPasswordInput,
        "Please confirm your password.",
      );
      hasError = true;
    } else if (password !== confirmPassword) {
      showError(
        confirmPasswordError,
        confirmPasswordInput,
        "Passwords do not match.",
      );
      hasError = true;
    }

    if (!agreeTerms) {
      showError(
        generalError,
        null,
        "You must agree to the Terms of Service and Privacy Policy.",
      );
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    try {
      // Store phone for later use in role selection
      if (phone) {
        sessionStorage.setItem("hawkr_temp_phone", phone);
      }

      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      // Update display name
      await updateProfile(userCredential.user, {
        displayName: displayName,
      });

      console.log("Registration successful:", userCredential.user.email);

      // Redirect handled by onAuthStateChanged - goes to role selection
    } catch (error) {
      console.error("Registration error:", error);
      showError(generalError, null, getErrorMessage(error.code));
      setLoading(false);
    }
  });

  /**
   * Handle Google Sign Up
   */
  googleBtn.addEventListener("click", async () => {
    clearErrors();
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });

      const result = await signInWithPopup(auth, provider);
      console.log("Google sign up successful:", result.user.email);

      // Redirect handled by onAuthStateChanged - goes to role selection
    } catch (error) {
      console.error("Google sign up error:", error);
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

  /**
   * Real-time validation
   */
  displayNameInput.addEventListener("blur", () => {
    const name = displayNameInput.value.trim();
    if (name && name.length < 2) {
      showError(
        nameError,
        displayNameInput,
        "Name must be at least 2 characters.",
      );
    }
  });

  emailInput.addEventListener("blur", () => {
    const email = emailInput.value.trim();
    if (email && !isValidEmail(email)) {
      showError(emailError, emailInput, "Please enter a valid email address.");
    }
  });

  phoneInput.addEventListener("blur", () => {
    const phone = phoneInput.value.trim();
    if (phone && !isValidPhone(phone)) {
      showError(
        phoneError,
        phoneInput,
        "Please enter a valid Singapore phone number.",
      );
    }
  });

  confirmPasswordInput.addEventListener("input", () => {
    if (confirmPasswordInput.classList.contains("error")) {
      confirmPasswordError.classList.remove("visible");
      confirmPasswordInput.classList.remove("error");
    }
  });

  // Clear errors on input
  [displayNameInput, emailInput, phoneInput].forEach((input) => {
    input.addEventListener("input", () => {
      if (input.classList.contains("error")) {
        const errorEl = document.getElementById(
          input.id === "displayName" ? "nameError" : input.id + "Error",
        );
        errorEl.classList.remove("visible");
        input.classList.remove("error");
      }
    });
  });
} // End of initializeRegisterPage function
