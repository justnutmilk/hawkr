/**
 * Hawkr - Vendor Tenancy
 * Allows vendors to enter an onboarding code from an operator
 * to link their stall to a hawker centre.
 */

import { db, auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteField,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";

// DOM Elements
const tenancyCardForm = document.getElementById("tenancyCardForm");
const tenancyCardLinked = document.getElementById("tenancyCardLinked");
const codeInput = document.getElementById("codeInput");
const linkButton = document.getElementById("linkButton");
const tenancyStatus = document.getElementById("tenancyStatus");
const linkedOperatorName = document.getElementById("linkedOperatorName");
const linkedDescription = document.getElementById("linkedDescription");
const tenancyLinkedBadge = document.getElementById("tenancyLinkedBadge");
const disconnectButton = document.getElementById("disconnectButton");

/**
 * Initialize the page
 */
document.addEventListener("DOMContentLoaded", () => {
  initVendorNavbar();
  setupMobileHamburger();

  // Listen for auth state
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await checkTenancyStatus(user.uid);
    }
  });

  // Bind link button
  if (linkButton) {
    linkButton.addEventListener("click", handleLinkCode);
  }

  // Bind disconnect button
  if (disconnectButton) {
    disconnectButton.addEventListener("click", handleDisconnect);
  }

  // Auto-uppercase and restrict input to alphanumeric
  if (codeInput) {
    codeInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    });

    // Allow Enter key to submit
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLinkCode();
      }
    });
  }
});

/**
 * Setup mobile hamburger toggle
 */
function setupMobileHamburger() {
  const hamburger = document.getElementById("hamburger");
  const sidebar = document.getElementById("sidebar");

  if (hamburger && sidebar) {
    hamburger.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", (e) => {
      if (
        sidebar.classList.contains("open") &&
        !sidebar.contains(e.target) &&
        !hamburger.contains(e.target)
      ) {
        sidebar.classList.remove("open");
      }
    });
  }
}

/**
 * Check if vendor already has a tenancy link
 */
async function checkTenancyStatus(uid) {
  try {
    const vendorDoc = await getDoc(doc(db, "vendors", uid));

    if (!vendorDoc.exists()) {
      showForm();
      return;
    }

    const vendorData = vendorDoc.data();

    if (vendorData.hawkerCentreId) {
      // Vendor is already linked - fetch hawker centre info
      await showLinkedState(vendorData.hawkerCentreId);
    } else {
      showForm();
    }
  } catch (error) {
    console.error("Error checking tenancy status:", error);
    showForm();
  }
}

/**
 * Show the code entry form
 */
function showForm() {
  if (tenancyCardForm) tenancyCardForm.style.display = "flex";
  if (tenancyCardLinked) tenancyCardLinked.style.display = "none";
}

/**
 * Show the linked state with operator info
 */
async function showLinkedState(hawkerCentreId) {
  if (tenancyCardForm) tenancyCardForm.style.display = "none";
  if (tenancyCardLinked) tenancyCardLinked.style.display = "flex";

  try {
    const centreDoc = await getDoc(doc(db, "hawkerCentres", hawkerCentreId));

    if (centreDoc.exists()) {
      const centreData = centreDoc.data();
      const centreName = centreData.name || "Hawker Centre";

      if (linkedOperatorName) {
        linkedOperatorName.textContent = `Linked to ${centreName}`;
      }
      if (linkedDescription) {
        linkedDescription.textContent = `Your stall is currently linked to ${centreName}. Contact your operator if you need to make changes.`;
      }
    } else {
      if (linkedOperatorName) {
        linkedOperatorName.textContent = "Linked to operator";
      }
      if (linkedDescription) {
        linkedDescription.textContent =
          "Your stall is linked to a hawker centre operator.";
      }
    }
  } catch (error) {
    console.error("Error fetching hawker centre info:", error);
    if (linkedOperatorName) {
      linkedOperatorName.textContent = "Linked to operator";
    }
  }
}

/**
 * Handle the link code button click
 */
async function handleLinkCode() {
  if (!codeInput || !linkButton) return;

  // Get raw input and strip OBD- prefix if the user included it
  let rawCode = codeInput.value.trim().toUpperCase();
  rawCode = rawCode.replace(/^OBD-/, "");

  if (!rawCode || rawCode.length !== 6) {
    setStatus("Please enter a valid 6-character code.", "error");
    return;
  }

  const fullCode = `OBD-${rawCode}`;

  // Disable button while processing
  linkButton.disabled = true;
  setStatus("Verifying code...", "loading");

  try {
    const user = auth.currentUser;
    if (!user) {
      setStatus("You must be logged in to link a code.", "error");
      linkButton.disabled = false;
      return;
    }

    // Look up the onboarding code document
    const codeDoc = await getDoc(doc(db, "onboardingCodes", fullCode));

    if (!codeDoc.exists()) {
      setStatus("Invalid code. Please check and try again.", "error");
      linkButton.disabled = false;
      return;
    }

    const codeData = codeDoc.data();

    // Check if code is already used
    if (codeData.status === "linked") {
      setStatus("This code has already been used.", "error");
      linkButton.disabled = false;
      return;
    }

    // Check if code is pending
    if (codeData.status !== "pending") {
      setStatus("This code is no longer valid.", "error");
      linkButton.disabled = false;
      return;
    }

    // Check expiry
    const now = new Date();
    const expiresAt = codeData.expiresAt?.toDate?.()
      ? codeData.expiresAt.toDate()
      : new Date(codeData.expiresAt);

    if (expiresAt <= now) {
      setStatus(
        "This code has expired. Please ask your operator for a new code.",
        "error",
      );
      linkButton.disabled = false;
      return;
    }

    // Code is valid - update it with vendor info
    await updateDoc(doc(db, "onboardingCodes", fullCode), {
      status: "linked",
      vendorId: user.uid,
      linkedAt: serverTimestamp(),
    });

    // If the code has a hawkerCentreId, update the vendor profile too
    if (codeData.hawkerCentreId) {
      await updateDoc(doc(db, "vendors", user.uid), {
        hawkerCentreId: codeData.hawkerCentreId,
        tenancyLinkedAt: serverTimestamp(),
      });
    }

    // Show success
    setStatus(
      "Successfully linked! The operator will review your details.",
      "success",
    );

    // Transition to linked state after a brief delay
    setTimeout(async () => {
      if (codeData.hawkerCentreId) {
        await showLinkedState(codeData.hawkerCentreId);
      } else {
        if (tenancyCardForm) tenancyCardForm.style.display = "none";
        if (tenancyCardLinked) tenancyCardLinked.style.display = "flex";
        if (linkedOperatorName) {
          linkedOperatorName.textContent = "Linked to operator";
        }
        if (linkedDescription) {
          linkedDescription.textContent =
            "Successfully linked! The operator will review your details.";
        }
      }
    }, 1500);
  } catch (error) {
    console.error("Error linking code:", error);
    setStatus("An error occurred. Please try again.", "error");
    linkButton.disabled = false;
  }
}

/**
 * Handle disconnect button click
 */
async function handleDisconnect() {
  if (!disconnectButton) return;

  const confirmed = confirm(
    "Are you sure you want to disconnect from your operator? You will need a new onboarding code to reconnect.",
  );
  if (!confirmed) return;

  disconnectButton.disabled = true;
  disconnectButton.textContent = "Disconnecting...";

  try {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in.");
      disconnectButton.disabled = false;
      disconnectButton.textContent = "Disconnect";
      return;
    }

    // Remove hawkerCentreId and tenancyLinkedAt from vendor doc
    await updateDoc(doc(db, "vendors", user.uid), {
      hawkerCentreId: deleteField(),
      tenancyLinkedAt: deleteField(),
    });

    // Show the code entry form again
    showForm();
    if (codeInput) codeInput.value = "";
    setStatus("", "");
    disconnectButton.disabled = false;
    disconnectButton.textContent = "Disconnect";
  } catch (error) {
    console.error("Error disconnecting:", error);
    alert("An error occurred while disconnecting. Please try again.");
    disconnectButton.disabled = false;
    disconnectButton.textContent = "Disconnect";
  }
}

/**
 * Set the status message
 */
function setStatus(message, type) {
  if (!tenancyStatus) return;

  tenancyStatus.textContent = message;
  tenancyStatus.className = "tenancyStatus";

  if (type) {
    tenancyStatus.classList.add(type);
  }
}
