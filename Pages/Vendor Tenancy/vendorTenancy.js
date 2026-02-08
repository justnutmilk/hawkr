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
  deleteDoc,
  deleteField,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { app } from "../../firebase/config.js";
import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";
import { initNotificationBadge } from "../../assets/js/notificationBadge.js";
import {
  initToastContainer,
  subscribeToNewNotifications,
} from "../../assets/js/toastNotifications.js";
import { showToast, showConfirm } from "../../assets/js/toast.js";
import { getHawkerCentreById } from "../../firebase/services/hawkerCentres.js";

// DOM Elements
const tenancyCardLinked = document.getElementById("tenancyCardLinked");
const codeInput = document.getElementById("codeInput");
const linkButton = document.getElementById("linkButton");
const tenancyStatus = document.getElementById("tenancyStatus");
const linkedOperatorName = document.getElementById("linkedOperatorName");
const linkedDescription = document.getElementById("linkedDescription");
const tenancyLinkedBadge = document.getElementById("tenancyLinkedBadge");
const disconnectButton = document.getElementById("disconnectButton");
const tenancyEmptyState = document.getElementById("tenancyEmptyState");
const headerLinkBtn = document.getElementById("headerLinkBtn");
const emptyLinkBtn = document.getElementById("emptyLinkBtn");
const linkPanel = document.getElementById("linkPanel");
const linkOverlay = document.getElementById("linkOverlay");
const linkCancelBtn = document.getElementById("linkCancelBtn");
const linkBody = document.getElementById("linkBody");
const linkFooter = document.getElementById("linkFooter");
const tenancySkeleton = document.getElementById("tenancySkeleton");

// Store original panel HTML for reset after confirmation state
const originalLinkBodyHTML = linkBody ? linkBody.innerHTML : "";
const originalLinkFooterHTML = linkFooter ? linkFooter.innerHTML : "";

// Snapshot listeners
let approvalUnsubscribe = null;
let vendorUnsubscribe = null;
let stallUnsubscribe = null;

/**
 * Initialize the page
 */
document.addEventListener("DOMContentLoaded", () => {
  initVendorNavbar();
  setupMobileHamburger();

  // Listen for auth state
  onAuthStateChanged(auth, (user) => {
    // Clean up previous listener
    if (vendorUnsubscribe) {
      vendorUnsubscribe();
      vendorUnsubscribe = null;
    }

    if (user) {
      initNotificationBadge(`vendors/${user.uid}/notifications`);
      initToastContainer();
      subscribeToNewNotifications(`vendors/${user.uid}/notifications`);
      listenToVendorStatus(user.uid);
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

  // Bind header and empty state CTA buttons
  if (headerLinkBtn) {
    headerLinkBtn.addEventListener("click", openLinkPanel);
  }
  if (emptyLinkBtn) {
    emptyLinkBtn.addEventListener("click", openLinkPanel);
  }

  // Bind panel close handlers
  if (linkOverlay) {
    linkOverlay.addEventListener("click", closeLinkPanel);
  }
  if (linkCancelBtn) {
    linkCancelBtn.addEventListener("click", closeLinkPanel);
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (linkPanel && linkPanel.classList.contains("active")) {
        closeLinkPanel();
      }
    }
    if (e.key === "l" || e.key === "L") {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if (tenancyEmptyState && tenancyEmptyState.style.display !== "none") {
        openLinkPanel();
      }
    }
  });

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
 * Realtime listener on vendor doc — updates UI when tenancy changes
 */
function listenToVendorStatus(uid) {
  vendorUnsubscribe = onSnapshot(
    doc(db, "vendors", uid),
    async (snapshot) => {
      if (!snapshot.exists()) {
        stopStallListener();
        showEmptyState();
        return;
      }

      const vendorData = snapshot.data();

      if (vendorData.tenancyLinkedAt) {
        // Actively linked to an operator — start listening to the stall for operator-initiated unlinks
        if (vendorData.stallId) {
          startStallListener(uid, vendorData.stallId);
        }
        await showLinkedState(vendorData.hawkerCentreId);
      } else {
        stopStallListener();
        showEmptyState();
      }
    },
    (error) => {
      console.error("Error listening to vendor status:", error);
      showEmptyState();
    },
  );
}

/**
 * Listen to the food stall doc. If operatorId is removed (operator unlinked),
 * the vendor cleans up their own doc so the UI updates.
 */
let currentStallListenerId = null;

function startStallListener(uid, stallId) {
  // Don't restart if already listening to the same stall
  if (currentStallListenerId === stallId) return;
  stopStallListener();
  currentStallListenerId = stallId;

  let initialLoad = true;

  stallUnsubscribe = onSnapshot(
    doc(db, "foodStalls", stallId),
    async (snapshot) => {
      // Skip the initial snapshot — only react to changes
      if (initialLoad) {
        initialLoad = false;
        return;
      }

      const operatorRemoved = !snapshot.exists() || !snapshot.data().operatorId;
      if (operatorRemoved) {
        // Operator removed operatorId — vendor self-cleans tenancy fields (keep hawkerCentreId — that's the stall location)
        stopStallListener();
        try {
          await updateDoc(doc(db, "vendors", uid), {
            tenancyLinkedAt: deleteField(),
          });
        } catch (err) {
          console.warn("Could not self-clean vendor doc:", err);
        }
        // Refresh the page to show unlinked state
        window.location.reload();
      }
    },
    (error) => {
      console.warn("Stall listener error:", error);
    },
  );
}

function stopStallListener() {
  if (stallUnsubscribe) {
    stallUnsubscribe();
    stallUnsubscribe = null;
  }
  currentStallListenerId = null;
}

/**
 * Show address mismatch confirmation inside the link panel.
 * Replaces the panel body/footer with maps and confirm/cancel buttons.
 * Returns Promise<boolean> — true if vendor wants to update address.
 */
function showAddressMismatchConfirm(vendorCentre, operatorCentre) {
  return new Promise((resolve) => {
    const body = document.getElementById("linkBody");
    const footer = document.getElementById("linkFooter");
    const title = document.querySelector(".linkTitle");
    if (!body || !footer) return resolve(false);

    if (title) title.textContent = "Address Mismatch";

    const vLat =
      vendorCentre.location?.latitude || vendorCentre.location?._lat || 1.3521;
    const vLng =
      vendorCentre.location?.longitude ||
      vendorCentre.location?._long ||
      103.8198;
    const oLat =
      operatorCentre.location?.latitude ||
      operatorCentre.location?._lat ||
      1.3521;
    const oLng =
      operatorCentre.location?.longitude ||
      operatorCentre.location?._long ||
      103.8198;

    body.innerHTML = `
      <p class="mismatchDescription">Your stall location doesn't match this operator's hawker centre. Would you like to update your address?</p>
      <div class="mismatchLocation">
        <span class="mismatchLocationLabel">Your location</span>
        <div class="mismatchMapContainer" id="mismatchMapVendor"></div>
        <span class="mismatchLocationName">${vendorCentre.name || "Unknown"}</span>
        <span class="mismatchLocationAddress">${vendorCentre.address || ""}</span>
      </div>
      <div class="mismatchArrow">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
      </div>
      <div class="mismatchLocation">
        <span class="mismatchLocationLabel">Operator's location</span>
        <div class="mismatchMapContainer" id="mismatchMapOperator"></div>
        <span class="mismatchLocationName">${operatorCentre.name || "Unknown"}</span>
        <span class="mismatchLocationAddress">${operatorCentre.address || ""}</span>
      </div>
    `;

    footer.innerHTML = `
      <button class="linkCancelBtn" id="mismatchCancel">Cancel <kbd class="linkCancelKbd">Esc</kbd></button>
      <button class="linkButton" id="mismatchConfirm">Update & Link</button>
    `;

    // Initialize maps
    (async () => {
      try {
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } =
          await google.maps.importLibrary("marker");

        const mapOptions = {
          zoom: 15,
          mapId: "hawkr-mismatch",
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: "none",
          clickableIcons: false,
        };

        const vendorMap = new Map(
          document.getElementById("mismatchMapVendor"),
          { ...mapOptions, center: { lat: vLat, lng: vLng } },
        );
        new AdvancedMarkerElement({
          position: { lat: vLat, lng: vLng },
          map: vendorMap,
        });

        const operatorMap = new Map(
          document.getElementById("mismatchMapOperator"),
          { ...mapOptions, center: { lat: oLat, lng: oLng } },
        );
        new AdvancedMarkerElement({
          position: { lat: oLat, lng: oLng },
          map: operatorMap,
        });
      } catch (err) {
        console.warn("Could not load maps for mismatch:", err);
      }
    })();

    document
      .getElementById("mismatchCancel")
      .addEventListener("click", () => resolve(false));
    document
      .getElementById("mismatchConfirm")
      .addEventListener("click", () => resolve(true));
  });
}

/**
 * Show the empty state (default for unlinked vendors)
 */
function showEmptyState() {
  if (tenancySkeleton) tenancySkeleton.style.display = "none";
  if (tenancyEmptyState) tenancyEmptyState.style.display = "flex";
  if (tenancyCardLinked) tenancyCardLinked.style.display = "none";
  if (headerLinkBtn) headerLinkBtn.style.display = "flex";
}

/**
 * Open the link panel
 */
function openLinkPanel() {
  if (linkOverlay) linkOverlay.classList.add("active");
  if (linkPanel) linkPanel.classList.add("active");
  document.body.style.overflow = "hidden";
  if (codeInput) {
    codeInput.value = "";
    setTimeout(() => codeInput.focus(), 300);
  }
  setStatus("", "");
}

/**
 * Close the link panel and reset to original state
 */
function closeLinkPanel() {
  if (linkOverlay) linkOverlay.classList.remove("active");
  if (linkPanel) linkPanel.classList.remove("active");
  document.body.style.overflow = "";

  // Clean up approval listener
  if (approvalUnsubscribe) {
    approvalUnsubscribe();
    approvalUnsubscribe = null;
  }

  // Reset panel content back to original (in case confirmation state was shown)
  if (linkBody) linkBody.innerHTML = originalLinkBodyHTML;
  if (linkFooter) linkFooter.innerHTML = originalLinkFooterHTML;

  // Reset title
  const title = document.querySelector(".linkTitle");
  if (title) title.textContent = "Link to Operator";

  // Re-bind event listeners on restored elements
  const restoredCodeInput = document.getElementById("codeInput");
  const restoredLinkButton = document.getElementById("linkButton");
  const restoredCancelBtn = document.getElementById("linkCancelBtn");

  if (restoredCodeInput) {
    restoredCodeInput.value = "";
    restoredCodeInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    });
    restoredCodeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLinkCode();
      }
    });
  }
  if (restoredLinkButton) {
    restoredLinkButton.disabled = false;
    restoredLinkButton.addEventListener("click", handleLinkCode);
  }
  if (restoredCancelBtn) {
    restoredCancelBtn.addEventListener("click", closeLinkPanel);
  }

  setStatus("", "");
}

/**
 * Show the linked state with operator info
 */
async function showLinkedState(hawkerCentreId) {
  closeLinkPanel();
  if (tenancySkeleton) tenancySkeleton.style.display = "none";
  if (tenancyEmptyState) tenancyEmptyState.style.display = "none";
  if (tenancyCardLinked) tenancyCardLinked.style.display = "flex";
  if (headerLinkBtn) headerLinkBtn.style.display = "none";

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
  const activeCodeInput = document.getElementById("codeInput");
  const activeLinkButton = document.getElementById("linkButton");
  if (!activeCodeInput || !activeLinkButton) return;

  // Get raw input and strip OBD- prefix if the user included it
  let rawCode = activeCodeInput.value.trim().toUpperCase();
  rawCode = rawCode.replace(/^OBD-/, "");

  if (!rawCode || rawCode.length !== 6) {
    setStatus("Please enter a valid 6-character code.", "error");
    return;
  }

  // Document ID in Firestore is the raw code (without OBD- prefix)
  const fullCode = rawCode;

  // Disable button while processing
  activeLinkButton.disabled = true;
  setStatus("Verifying code...", "loading");

  try {
    const user = auth.currentUser;
    if (!user) {
      setStatus("You must be logged in to link a code.", "error");
      activeLinkButton.disabled = false;
      return;
    }

    // Look up the onboarding code document
    const codeDoc = await getDoc(doc(db, "onboardingCodes", fullCode));

    if (!codeDoc.exists()) {
      setStatus("Invalid code. Please check and try again.", "error");
      activeLinkButton.disabled = false;
      return;
    }

    const codeData = codeDoc.data();

    // Check if code is already used
    if (codeData.status === "linked") {
      setStatus("This code has already been used.", "error");
      activeLinkButton.disabled = false;
      return;
    }

    // Check if code is pending
    if (codeData.status !== "pending") {
      setStatus("This code is no longer valid.", "error");
      activeLinkButton.disabled = false;
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
      activeLinkButton.disabled = false;
      return;
    }

    // Validate that vendor's hawker centre matches operator's hawker centre
    const vendorDoc = await getDoc(doc(db, "vendors", user.uid));
    const vendorHawkerCentreId = vendorDoc.data()?.hawkerCentreId;
    const operatorHawkerCentreId = codeData.hawkerCentreId;

    if (!vendorHawkerCentreId) {
      setStatus("Please complete your stall setup before linking.", "error");
      activeLinkButton.disabled = false;
      return;
    }

    if (vendorHawkerCentreId !== operatorHawkerCentreId) {
      // Fetch both hawker centre docs for the map confirmation
      const [vendorCentre, operatorCentre] = await Promise.all([
        getHawkerCentreById(vendorHawkerCentreId),
        getHawkerCentreById(operatorHawkerCentreId),
      ]);

      const confirmed = await showAddressMismatchConfirm(
        vendorCentre || { name: "Your location" },
        operatorCentre || { name: "Operator's location" },
      );

      if (!confirmed) {
        closeLinkPanel();
        return;
      }

      // Vendor confirmed — update their location to match operator's
      await updateDoc(doc(db, "vendors", user.uid), {
        hawkerCentreId: operatorHawkerCentreId,
        storeLocation: operatorCentre?.name || "",
      });

      const vData = vendorDoc.data();
      if (vData.stallId) {
        await updateDoc(doc(db, "foodStalls", vData.stallId), {
          hawkerCentreId: operatorHawkerCentreId,
        });
      }
    }

    // Code is valid (address matches or vendor confirmed update) - update it with vendor info
    await updateDoc(doc(db, "onboardingCodes", fullCode), {
      status: "linked",
      vendorId: user.uid,
      linkedAt: serverTimestamp(),
    });

    // Show waiting state inside the panel (vendor waits for operator approval)
    showLinkConfirmation(fullCode);
  } catch (error) {
    console.error("Error linking code:", error);
    setStatus("An error occurred. Please try again.", "error");
    activeLinkButton.disabled = false;
  }
}

/**
 * Show waiting state inside the panel after vendor links a code.
 * Listens for operator to approve or reject.
 */
function showLinkConfirmation(codeId) {
  const fields = [
    "Store Name",
    "Unit Number",
    "Cuisines Served",
    "Operating Hours",
    "Cover Photo",
    "Hygiene Certificate",
    "Halal Certification",
    "UEN",
    "Contact Person",
    "Contact Number",
  ];

  const body = document.getElementById("linkBody");
  if (body) {
    body.innerHTML = `
      <div class="linkConfirmation">
        <div class="linkConfirmIcon linkConfirmIconWaiting">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <span class="linkConfirmTitle">Waiting for operator</span>
        <p class="linkConfirmSubtext">
          Your operator is reviewing your store details. Discuss the following with your operator:
        </p>
        <div class="linkConfirmFields">
          ${fields.map((f) => `<div class="linkConfirmField"><span class="linkConfirmFieldIcon"></span><span class="linkConfirmFieldLabel">${f}</span></div>`).join("")}
        </div>
      </div>
    `;
  }

  const footer = document.getElementById("linkFooter");
  if (footer) {
    footer.innerHTML = "";
  }

  // Update panel title
  const title = document.querySelector(".linkTitle");
  if (title) title.textContent = "Onboarding";

  // Listen for operator approval or rejection
  listenForApproval(codeId);
}

/**
 * Listen for the operator to approve or reject the onboarding code.
 */
function listenForApproval(codeId) {
  if (approvalUnsubscribe) {
    approvalUnsubscribe();
    approvalUnsubscribe = null;
  }

  approvalUnsubscribe = onSnapshot(
    doc(db, "onboardingCodes", codeId),
    async (snapshot) => {
      if (!snapshot.exists()) {
        // Code doc was deleted (operator rejected)
        showRejectedState();
        return;
      }
      const data = snapshot.data();
      if (data.status === "approved") {
        if (approvalUnsubscribe) {
          approvalUnsubscribe();
          approvalUnsubscribe = null;
        }

        // Vendor writes their own doc with linkage fields from the approved code
        const user = auth.currentUser;
        if (user && (data.hawkerCentreId || data.stallId)) {
          try {
            const updates = {
              tenancyLinkedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            if (data.hawkerCentreId)
              updates.hawkerCentreId = data.hawkerCentreId;
            if (data.stallId) updates.stallId = data.stallId;

            // Fetch hawker centre name for storeLocation
            if (data.hawkerCentreId) {
              try {
                const centreSnap = await getDoc(
                  doc(db, "hawkerCentres", data.hawkerCentreId),
                );
                if (centreSnap.exists()) {
                  updates.storeLocation = centreSnap.data().name || "";
                }
              } catch (_) {}
            }

            await updateDoc(doc(db, "vendors", user.uid), updates);
          } catch (err) {
            console.warn("Could not self-update vendor doc on approval:", err);
          }
        }

        showApprovedState();
      } else if (data.status === "rejected") {
        if (approvalUnsubscribe) {
          approvalUnsubscribe();
          approvalUnsubscribe = null;
        }
        showRejectedState();
      }
    },
  );
}

/**
 * Show approved state after operator approves.
 */
function showApprovedState() {
  const body = document.getElementById("linkBody");
  if (body) {
    body.innerHTML = `
      <div class="linkConfirmation">
        <div class="linkConfirmIcon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <span class="linkConfirmTitle">Onboarding approved</span>
        <p class="linkConfirmSubtext">
          Your operator has approved your store. Welcome aboard!
        </p>
      </div>
    `;
  }

  const footer = document.getElementById("linkFooter");
  if (footer) {
    footer.innerHTML = `
      <button class="linkButton" id="linkDoneBtn">Done</button>
    `;
    document.getElementById("linkDoneBtn").addEventListener("click", () => {
      closeLinkPanel();
    });
  }
}

/**
 * Show rejected state after operator rejects.
 */
function showRejectedState() {
  if (approvalUnsubscribe) {
    approvalUnsubscribe();
    approvalUnsubscribe = null;
  }

  const body = document.getElementById("linkBody");
  if (body) {
    body.innerHTML = `
      <div class="linkConfirmation">
        <div class="linkConfirmIcon linkConfirmIconRejected">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <span class="linkConfirmTitle">Onboarding rejected</span>
        <p class="linkConfirmSubtext">
          Your operator has not approved this request. Please contact your operator for more information.
        </p>
      </div>
    `;
  }

  const footer = document.getElementById("linkFooter");
  if (footer) {
    footer.innerHTML = `
      <button class="linkButton" id="linkDoneBtn">Close</button>
    `;
    document.getElementById("linkDoneBtn").addEventListener("click", () => {
      closeLinkPanel();
    });
  }
}

/**
 * Handle disconnect button click
 */
async function handleDisconnect() {
  if (!disconnectButton) return;

  const confirmed = await showConfirm(
    "Disconnect from operator?",
    "You will need a new onboarding code to reconnect.",
    { confirmLabel: "Disconnect", destructive: true },
  );
  if (!confirmed) return;

  disconnectButton.disabled = true;
  disconnectButton.textContent = "Disconnecting...";

  try {
    const user = auth.currentUser;
    if (!user) {
      showToast("You must be logged in.", "error");
      disconnectButton.disabled = false;
      disconnectButton.textContent = "Disconnect";
      return;
    }

    // 1. Remove operator-related fields from the food stall (keep ownerId, hawkerCentreId — stall location stays)
    // Capture operatorId before deleting so we can notify them
    let operatorId = null;
    const stallsQuery = query(
      collection(db, "foodStalls"),
      where("ownerId", "==", user.uid),
    );
    const stallsSnapshot = await getDocs(stallsQuery);
    for (const stallDoc of stallsSnapshot.docs) {
      if (!operatorId) operatorId = stallDoc.data().operatorId || null;
      await updateDoc(doc(db, "foodStalls", stallDoc.id), {
        operatorId: deleteField(),
        operatorName: deleteField(),
        unitNumber: deleteField(),
      });
    }

    // 2. Reset any onboarding codes linked to this vendor
    const codesQuery = query(
      collection(db, "onboardingCodes"),
      where("vendorId", "==", user.uid),
    );
    const codesSnapshot = await getDocs(codesQuery);
    for (const codeDoc of codesSnapshot.docs) {
      await deleteDoc(doc(db, "onboardingCodes", codeDoc.id));
    }

    // 3. Remove tenancy fields from vendor doc (keep stallId, hawkerCentreId, storeLocation — those are the stall's location)
    // Capture centre name before clearing for notification
    let centreName = "";
    try {
      const vendorSnap = await getDoc(doc(db, "vendors", user.uid));
      if (vendorSnap.exists()) {
        centreName = vendorSnap.data().storeLocation || "";
      }
    } catch (_) {}

    await updateDoc(doc(db, "vendors", user.uid), {
      tenancyLinkedAt: deleteField(),
    });

    // Notify vendor of unlink (non-blocking)
    try {
      const fns = getFunctions(app, "asia-southeast1");
      const notifyTenancy = httpsCallable(fns, "notifyVendorTenancy");
      notifyTenancy({
        vendorId: user.uid,
        action: "unlinked",
        centreName,
        operatorId,
      });
    } catch (notifErr) {
      console.warn("Tenancy notification failed:", notifErr);
    }

    // Show the empty state again
    showEmptyState();
    if (codeInput) codeInput.value = "";
    setStatus("", "");
    disconnectButton.disabled = false;
    disconnectButton.textContent = "Disconnect";
  } catch (error) {
    console.error("Error disconnecting:", error);
    showToast(
      "An error occurred while disconnecting. Please try again.",
      "error",
    );
    disconnectButton.disabled = false;
    disconnectButton.textContent = "Disconnect";
  }
}

/**
 * Set the status message
 */
function setStatus(message, type) {
  const statusEl = document.getElementById("tenancyStatus");
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = "tenancyStatus";

  if (type) {
    statusEl.classList.add(type);
  }
}
