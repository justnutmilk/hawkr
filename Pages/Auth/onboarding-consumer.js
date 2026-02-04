/**
 * Hawkr - Consumer Onboarding
 * Handles the consumer onboarding flow
 */

import { auth, db } from "../../firebase/config.js";
import {
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const stepLabel = document.getElementById("stepLabel");
const progressSteps = document.querySelectorAll(".progressStep");

const browserNotificationsToggle = document.getElementById("browserNotifications");
const connectTelegramBtn = document.getElementById("connectTelegram");
const telegramConnect = document.getElementById("telegramConnect");
const telegramConnectedState = document.getElementById("telegramConnectedState");

const skipStep1 = document.getElementById("skipStep1");
const nextStep1 = document.getElementById("nextStep1");
const skipStep2 = document.getElementById("skipStep2");
const completeOnboarding = document.getElementById("completeOnboarding");

let currentUser = null;
let currentStep = 1;
let preferences = {
    browserNotifications: false,
    telegramConnected: false,
    telegramChatId: null,
};

// Check auth state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    // Check if already onboarded
    const customerDoc = await getDoc(doc(db, "customers", user.uid));
    if (customerDoc.exists()) {
        const data = customerDoc.data();
        if (data.onboardingComplete) {
            window.location.href = "../Consumer Dashboard/consumerDashboard.html";
            return;
        }
        // Load existing preferences
        if (data.preferences) {
            preferences = { ...preferences, ...data.preferences };
            browserNotificationsToggle.checked = preferences.browserNotifications;
        }
    } else {
        // No profile exists - redirect to role selection
        window.location.href = "select-role.html";
    }
});

/**
 * Update step UI
 */
function updateStepUI(step) {
    currentStep = step;
    stepLabel.textContent = `Step ${step} of 2`;

    progressSteps.forEach((el, i) => {
        el.classList.remove("active", "completed");
        if (i + 1 < step) {
            el.classList.add("completed");
        } else if (i + 1 === step) {
            el.classList.add("active");
        }
    });

    step1.style.display = step === 1 ? "block" : "none";
    step2.style.display = step === 2 ? "block" : "none";
}

/**
 * Request browser notification permission
 */
async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("Browser doesn't support notifications");
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }

    return false;
}

/**
 * Handle notification toggle
 */
browserNotificationsToggle.addEventListener("change", async (e) => {
    if (e.target.checked) {
        const granted = await requestNotificationPermission();
        if (!granted) {
            e.target.checked = false;
            alert("Please enable notifications in your browser settings to receive updates.");
            return;
        }
    }
    preferences.browserNotifications = e.target.checked;
});

/**
 * Connect Telegram (placeholder - would integrate with Telegram Bot API)
 */
connectTelegramBtn.addEventListener("click", () => {
    // In production, this would open a Telegram bot link
    // For now, simulate connection
    const botUsername = "HawkrBot"; // Replace with actual bot username
    const startParam = currentUser ? currentUser.uid : "";

    // Open Telegram bot link
    window.open(`https://t.me/${botUsername}?start=${startParam}`, "_blank");

    // Show connected state after a delay (simulate)
    // In production, you'd poll the backend or use a webhook
    setTimeout(() => {
        telegramConnect.style.display = "none";
        telegramConnectedState.style.display = "flex";
        preferences.telegramConnected = true;
        preferences.telegramChatId = "simulated_" + Date.now();
    }, 3000);
});

/**
 * Save preferences and move to next step
 */
async function saveAndContinue() {
    if (!currentUser) return;

    try {
        await updateDoc(doc(db, "customers", currentUser.uid), {
            preferences: preferences,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error saving preferences:", error);
    }
}

/**
 * Complete onboarding
 */
async function finishOnboarding() {
    if (!currentUser) return;

    try {
        await updateDoc(doc(db, "customers", currentUser.uid), {
            preferences: preferences,
            onboardingComplete: true,
            updatedAt: serverTimestamp(),
        });

        // Redirect to dashboard
        window.location.href = "../Consumer Dashboard/consumerDashboard.html";
    } catch (error) {
        console.error("Error completing onboarding:", error);
        alert("Failed to complete setup. Please try again.");
    }
}

// Event Listeners
skipStep1.addEventListener("click", () => {
    updateStepUI(2);
});

nextStep1.addEventListener("click", async () => {
    await saveAndContinue();
    updateStepUI(2);
});

skipStep2.addEventListener("click", async () => {
    await finishOnboarding();
});

completeOnboarding.addEventListener("click", async () => {
    await finishOnboarding();
});
