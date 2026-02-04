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
        "auth/user-not-found":
            "No account found with this email address.",
        "auth/too-many-requests":
            "Too many requests. Please try again later.",
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
