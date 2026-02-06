// ============================================
// CONSUMER NAVBAR COMPONENT
// Shared navbar component for all consumer pages
// ============================================

import { auth, db } from "../../firebase/config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// NAVBAR CONFIGURATION
// ============================================

/**
 * Get the base path for navigation based on current page location
 */
function getBasePath() {
  const path = window.location.pathname;

  // Determine how many levels deep we are from the root
  if (path.includes("/Pages/Consumer Dashboard/")) {
    return "../";
  } else if (path.includes("/Pages/Consumer Order/")) {
    return "../";
  } else if (path.includes("/Pages/Consumer Settings/")) {
    return "../";
  } else if (path.includes("/Pages/Consumer Favourites/")) {
    return "../";
  }
  return "../";
}

/**
 * Get asset path based on current page location
 */
function getAssetPath() {
  return "../../";
}

// ============================================
// CART BADGE FUNCTIONS
// ============================================

// Store the unsubscribe function for cart listener
let cartUnsubscribe = null;

/**
 * Get cart item count from Firebase or localStorage
 */
async function getCartItemCount(userId) {
  if (userId) {
    try {
      const cartRef = collection(db, "customers", userId, "cart");
      const cartSnapshot = await getDocs(cartRef);
      let totalItems = 0;
      cartSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        totalItems += data.quantity || 1;
      });
      return totalItems;
    } catch (error) {
      console.error("Error fetching cart count:", error);
      return 0;
    }
  } else {
    // Fallback to localStorage for guests
    const cart = JSON.parse(localStorage.getItem("hawkrCart") || "[]");
    return cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }
}

/**
 * Inject cart badge styles if not already present
 */
function injectCartBadgeStyles() {
  if (document.getElementById("cartBadgeStyles")) return;

  const style = document.createElement("style");
  style.id = "cartBadgeStyles";
  style.textContent = `
    .cartLinkWrapper,
    .cartIconWrapper {
      position: relative;
      display: inline-flex;
    }
    .cartBadge,
    .navCartBadge {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 50%;
      background: #913b9f;
      color: #fff;
      font-family: Aptos, system-ui, sans-serif;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      border: 2px solid #fff;
      box-sizing: content-box;
    }
    /* When count is single digit, keep it perfectly circular */
    .cartBadge:not(.multi-digit),
    .navCartBadge:not(.multi-digit) {
      width: 18px;
      padding: 0;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Update cart badge display on all cart links
 */
function updateCartBadge(count) {
  // Inject styles
  injectCartBadgeStyles();

  // Find all cart links (desktop and mobile)
  const cartLinks = document.querySelectorAll('a[href*="consumerCart.html"]');

  cartLinks.forEach((cartLink) => {
    // Add wrapper class and set position relative
    if (
      !cartLink.classList.contains("cartLinkWrapper") &&
      !cartLink.classList.contains("cartIconWrapper")
    ) {
      cartLink.classList.add("cartLinkWrapper");
    }

    // Remove existing badge if any (check for both class names)
    const existingBadge = cartLink.querySelector(".cartBadge, .navCartBadge");
    if (existingBadge) {
      existingBadge.remove();
    }

    // Add badge if count > 0
    if (count > 0) {
      const badge = document.createElement("span");
      badge.className = "navCartBadge";
      const displayCount = count > 99 ? "99+" : count;
      badge.textContent = displayCount;
      // Add multi-digit class if needed for proper sizing
      if (count >= 10) {
        badge.classList.add("multi-digit");
      }
      cartLink.appendChild(badge);
    }
  });

  // Also update any existing cartBadge element by ID (for pages that have it in HTML)
  const cartBadgeById = document.getElementById("cartBadge");
  if (cartBadgeById) {
    if (count > 0) {
      cartBadgeById.textContent = count > 99 ? "99+" : count;
      cartBadgeById.style.display = "flex";
    } else {
      cartBadgeById.style.display = "none";
    }
  }
}

/**
 * Initialize cart badge with real-time listener for Firebase updates
 */
async function initCartBadge(userId) {
  // Clean up previous listener if exists
  if (cartUnsubscribe) {
    cartUnsubscribe();
    cartUnsubscribe = null;
  }

  if (userId) {
    // Set up real-time listener for cart changes
    const cartRef = collection(db, "customers", userId, "cart");

    cartUnsubscribe = onSnapshot(
      cartRef,
      (snapshot) => {
        let totalItems = 0;
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          totalItems += data.quantity || 1;
        });
        updateCartBadge(totalItems);
      },
      (error) => {
        console.error("Error listening to cart changes:", error);
      },
    );
  } else {
    // For guests, just get the count once (no real-time for localStorage)
    const count = await getCartItemCount(null);
    updateCartBadge(count);
  }
}

// ============================================
// USER DISPLAY FUNCTIONS
// ============================================

/**
 * Determine user type by checking which collection they exist in
 * @returns {Promise<{type: string, data: object}|null>}
 */
async function getUserType(uid) {
  // Check customers collection first
  try {
    const customerDoc = await getDoc(doc(db, "customers", uid));
    if (customerDoc.exists()) {
      return { type: "customer", data: customerDoc.data() };
    }
  } catch (error) {
    console.log("Not a customer");
  }

  // Check vendors collection
  try {
    const vendorDoc = await getDoc(doc(db, "vendors", uid));
    if (vendorDoc.exists()) {
      return { type: "vendor", data: vendorDoc.data() };
    }
  } catch (error) {
    console.log("Not a vendor");
  }

  // Check operators collection
  try {
    const operatorDoc = await getDoc(doc(db, "operators", uid));
    if (operatorDoc.exists()) {
      return { type: "operator", data: operatorDoc.data() };
    }
  } catch (error) {
    console.log("Not an operator");
  }

  return null;
}

/**
 * Update the profile dropdown with user info
 */
async function updateUserDisplay(user) {
  const profileNameElement = document.querySelector(".profileDropdownName");

  if (profileNameElement) {
    let displayName = user.displayName;

    try {
      const userDoc = await getDoc(doc(db, "customers", user.uid));
      if (userDoc.exists() && userDoc.data().displayName) {
        displayName = userDoc.data().displayName;
      }
    } catch (error) {
      console.log("Could not fetch user profile from Firestore");
    }

    const nameToShow = displayName || user.email.split("@")[0];

    profileNameElement.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 34 34" fill="none">
        <path d="M6.545 25.67C7.99 24.565 9.605 23.6937 11.39 23.0562C13.175 22.4187 15.045 22.1 17 22.1C18.955 22.1 20.825 22.4187 22.61 23.0562C24.395 23.6937 26.01 24.565 27.455 25.67C28.4467 24.5083 29.2187 23.1908 29.7712 21.7175C30.3237 20.2442 30.6 18.6717 30.6 17C30.6 13.2317 29.2754 10.0229 26.6263 7.37375C23.9771 4.72458 20.7683 3.4 17 3.4C13.2317 3.4 10.0229 4.72458 7.37375 7.37375C4.72458 10.0229 3.4 13.2317 3.4 17C3.4 18.6717 3.67625 20.2442 4.22875 21.7175C4.78125 23.1908 5.55333 24.5083 6.545 25.67ZM17 18.7C15.3283 18.7 13.9188 18.1263 12.7713 16.9788C11.6238 15.8313 11.05 14.4217 11.05 12.75C11.05 11.0783 11.6238 9.66875 12.7713 8.52125C13.9188 7.37375 15.3283 6.8 17 6.8C18.6717 6.8 20.0813 7.37375 21.2288 8.52125C22.3763 9.66875 22.95 11.0783 22.95 12.75C22.95 14.4217 22.3763 15.8313 21.2288 16.9788C20.0813 18.1263 18.6717 18.7 17 18.7ZM17 34C14.6483 34 12.4383 33.5538 10.37 32.6613C8.30167 31.7688 6.5025 30.5575 4.9725 29.0275C3.4425 27.4975 2.23125 25.6983 1.33875 23.63C0.44625 21.5617 0 19.3517 0 17C0 14.6483 0.44625 12.4383 1.33875 10.37C2.23125 8.30167 3.4425 6.5025 4.9725 4.9725C6.5025 3.4425 8.30167 2.23125 10.37 1.33875C12.4383 0.44625 14.6483 0 17 0C19.3517 0 21.5617 0.44625 23.63 1.33875C25.6983 2.23125 27.4975 3.4425 29.0275 4.9725C30.5575 6.5025 31.7688 8.30167 32.6613 10.37C33.5538 12.4383 34 14.6483 34 17C34 19.3517 33.5538 21.5617 32.6613 23.63C31.7688 25.6983 30.5575 27.4975 29.0275 29.0275C27.4975 30.5575 25.6983 31.7688 23.63 32.6613C21.5617 33.5538 19.3517 34 17 34Z" fill="#913b9f"/>
      </svg>
      ${nameToShow}
    `;

    // Update mobile menu user info
    const mobileNameEl = document.getElementById("mobileMenuUserName");
    if (mobileNameEl) mobileNameEl.textContent = nameToShow;

    const mobileEmailEl = document.getElementById("mobileMenuUserEmail");
    if (mobileEmailEl) mobileEmailEl.textContent = user.email;
  }
}

// ============================================
// LOGOUT FUNCTION
// ============================================

/**
 * Handle user logout
 */
async function handleLogout() {
  try {
    await signOut(auth);
    window.location.href = "../../index.html";
  } catch (error) {
    console.error("Logout error:", error);
    alert("Failed to logout. Please try again.");
  }
}

// ============================================
// PROFILE DROPDOWN TOGGLE
// ============================================

/**
 * Initialize profile dropdown toggle behavior
 */
function initProfileDropdown() {
  const profileButton = document.getElementById("profileButton");
  const profileDropdown = document.getElementById("profileDropdown");

  if (profileButton && profileDropdown) {
    profileButton.addEventListener("click", (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle("active");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (
        !profileDropdown.contains(e.target) &&
        !profileButton.contains(e.target)
      ) {
        profileDropdown.classList.remove("active");
      }
    });
  }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the navbar - call this from each consumer page
 */
export function initConsumerNavbar() {
  // Setup logout button handler
  const logoutButton = document.querySelector(".profileDropdownLogout");
  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }

  // Initialize profile dropdown
  initProfileDropdown();

  // Listen for auth state changes and update UI
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Check user type and redirect if on wrong dashboard
      const userTypeInfo = await getUserType(user.uid);

      if (userTypeInfo) {
        const currentPath = window.location.pathname;

        // If user is a vendor but on consumer pages, redirect to vendor dashboard
        if (
          userTypeInfo.type === "vendor" &&
          currentPath.includes("/Consumer")
        ) {
          window.location.href =
            "../../Pages/Vendor Dashboard/vendorDashboard.html";
          return;
        }

        // If user is an operator but on consumer/vendor pages, redirect to operator dashboard
        if (
          userTypeInfo.type === "operator" &&
          (currentPath.includes("/Consumer") || currentPath.includes("/Vendor"))
        ) {
          window.location.href =
            "../../Pages/Operator Dashboard/operatorDashboard.html";
          return;
        }

        // If user is a customer but on vendor/operator pages, redirect to consumer dashboard
        if (
          userTypeInfo.type === "customer" &&
          (currentPath.includes("/Vendor") || currentPath.includes("/Operator"))
        ) {
          window.location.href =
            "../../Pages/Consumer Dashboard/consumerDashboard.html";
          return;
        }
      }

      await updateUserDisplay(user);
      await initCartBadge(user.uid);
    } else {
      // Still show cart badge for guests (from localStorage)
      await initCartBadge(null);
      // Redirect to login if not authenticated
      window.location.href = "../../Pages/Auth/login.html";
    }
  });
}

// Export for use in other modules
export {
  handleLogout,
  updateUserDisplay,
  updateCartBadge,
  getCartItemCount,
  initCartBadge,
};
