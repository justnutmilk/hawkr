/**
 * Mobile Menu Module
 * Handles hamburger menu functionality for consumer pages
 */

// Mobile menu state
let isMobileMenuOpen = false;

/**
 * Initialize the mobile menu
 * Call this function after the DOM is loaded
 */
export function initMobileMenu() {
  const hamburgerButton = document.getElementById("hamburgerButton");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  // Support both mobileMenu and mobileMenuPanel IDs
  const mobileMenu =
    document.getElementById("mobileMenu") ||
    document.getElementById("mobileMenuPanel");
  const mobileMenuClose = document.getElementById("mobileMenuClose");

  if (!hamburgerButton || !mobileMenu) {
    return; // Mobile menu elements not found
  }

  // Open menu
  hamburgerButton.addEventListener("click", openMobileMenu);

  // Close menu via overlay
  if (mobileMenuOverlay) {
    mobileMenuOverlay.addEventListener("click", closeMobileMenu);
  }

  // Close menu via close button
  if (mobileMenuClose) {
    mobileMenuClose.addEventListener("click", closeMobileMenu);
  }

  // Close menu on escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isMobileMenuOpen) {
      closeMobileMenu();
    }
  });

  // Handle logout button in mobile menu (support both IDs)
  const mobileLogoutBtn =
    document.getElementById("mobileLogoutBtn") ||
    document.getElementById("mobileMenuLogout");
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener("click", handleMobileLogout);
  }
}

/**
 * Open the mobile menu
 */
export function openMobileMenu() {
  const hamburgerButton = document.getElementById("hamburgerButton");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  const mobileMenu =
    document.getElementById("mobileMenu") ||
    document.getElementById("mobileMenuPanel");

  if (hamburgerButton) hamburgerButton.classList.add("active");
  if (mobileMenuOverlay) mobileMenuOverlay.classList.add("active");
  if (mobileMenu) mobileMenu.classList.add("active");
  document.body.classList.add("mobileMenuOpen");

  isMobileMenuOpen = true;
}

/**
 * Close the mobile menu
 */
export function closeMobileMenu() {
  const hamburgerButton = document.getElementById("hamburgerButton");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  const mobileMenu =
    document.getElementById("mobileMenu") ||
    document.getElementById("mobileMenuPanel");

  if (hamburgerButton) hamburgerButton.classList.remove("active");
  if (mobileMenuOverlay) mobileMenuOverlay.classList.remove("active");
  if (mobileMenu) mobileMenu.classList.remove("active");
  document.body.classList.remove("mobileMenuOpen");

  isMobileMenuOpen = false;
}

/**
 * Handle logout from mobile menu
 */
async function handleMobileLogout() {
  try {
    // Import Firebase auth dynamically
    const { getAuth, signOut } =
      await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js");
    const auth = getAuth();
    await signOut(auth);
    window.location.href = "../../Pages/Auth/login.html";
  } catch (error) {
    console.error("Logout error:", error);
    // Fallback redirect
    window.location.href = "../../Pages/Auth/login.html";
  }
}

/**
 * Update cart badge count in mobile menu
 * @param {number} count - Number of items in cart
 */
export function updateMobileCartBadge(count) {
  const badge = document.getElementById("mobileCartBadge");
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : count;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }
}

/**
 * Update user info in mobile menu
 * @param {string} name - User's display name
 * @param {string} email - User's email
 */
export function updateMobileUserInfo(name, email) {
  const nameEl = document.getElementById("mobileUserName");
  const emailEl = document.getElementById("mobileUserEmail");

  if (nameEl && name) {
    nameEl.textContent = name;
  }
  if (emailEl && email) {
    emailEl.textContent = email;
  }
}

/**
 * Generate mobile menu HTML
 * @param {Object} options - Configuration options
 * @param {string} options.notificationsHref - Link to notifications page
 * @param {string} options.cartHref - Link to cart page
 * @param {string} options.settingsHref - Link to settings page
 * @param {string} options.userName - User's display name
 * @param {string} options.userEmail - User's email
 * @returns {string} HTML string for mobile menu
 */
export function generateMobileMenuHTML(options = {}) {
  const {
    notificationsHref = "../Consumer Settings/consumerNotifications.html",
    cartHref = "../Consumer Order/consumerCart.html",
    settingsHref = "../Consumer Settings/consumerSettings.html",
    userName = "User",
    userEmail = "",
  } = options;

  return `
        <!-- Hamburger Button -->
        <button class="hamburgerButton" id="hamburgerButton" aria-label="Open menu">
            <div class="hamburgerIcon">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </button>

        <!-- Mobile Menu Overlay -->
        <div class="mobileMenuOverlay" id="mobileMenuOverlay"></div>

        <!-- Mobile Menu Panel -->
        <div class="mobileMenu" id="mobileMenu">
            <div class="mobileMenuHeader">
                <span class="mobileMenuTitle">Menu</span>
                <button class="mobileMenuClose" id="mobileMenuClose" aria-label="Close menu">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div class="mobileMenuContent">
                <!-- User Section -->
                <div class="mobileMenuUser">
                    <div class="mobileMenuUserIcon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </div>
                    <div class="mobileMenuUserInfo">
                        <span class="mobileMenuUserName" id="mobileUserName">${userName}</span>
                        ${userEmail ? `<span class="mobileMenuUserEmail" id="mobileUserEmail">${userEmail}</span>` : ""}
                    </div>
                </div>

                <!-- Menu Items -->
                <a href="${notificationsHref}" class="mobileMenuItem">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    Notifications
                </a>

                <a href="${cartHref}" class="mobileMenuItem">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    Cart
                    <span class="mobileMenuItemBadge" id="mobileCartBadge" style="display: none;">0</span>
                </a>

                <div class="mobileMenuDivider"></div>

                <a href="${settingsHref}" class="mobileMenuItem">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    Settings
                </a>
            </div>

            <div class="mobileMenuFooter">
                <button class="mobileMenuLogout" id="mobileLogoutBtn">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Log out
                </button>
            </div>
        </div>
    `;
}
