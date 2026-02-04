/**
 * Hawkr - Role Selection Page
 * Allows new users to select their role (Customer or Vendor)
 */

import { auth, db } from "../../firebase/config.js";
import {
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const customerRoleBtn = document.getElementById("customerRole");
const vendorRoleBtn = document.getElementById("vendorRole");
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
    selectRole("customer");
});

vendorRoleBtn.addEventListener("click", () => {
    vendorRoleBtn.classList.add("selected");
    customerRoleBtn.classList.remove("selected");
    selectRole("vendor");
});
