/**
 * Mobile Menu Module
 * Reusable mobile menu component for consumer pages.
 * Call injectMobileMenu() to generate and inject the menu HTML, then wire up event listeners.
 */

// Mobile menu state
let isMobileMenuOpen = false;

/**
 * Generate mobile menu HTML
 * @param {Object} options
 * @param {string|null} options.activePage - 'notifications' | 'cart' | 'settings' | null
 * @returns {string} HTML string for overlay + menu panel
 */
function generateMobileMenuHTML(options = {}) {
  const { activePage = null } = options;

  const notificationsActive =
    activePage === "notifications" ? " mobileMenuItemActive" : "";
  const cartActive = activePage === "cart" ? " mobileMenuItemActive" : "";
  const settingsActive =
    activePage === "settings" ? " mobileMenuItemActive" : "";

  return `
    <div class="mobileMenuOverlay" id="mobileMenuOverlay"></div>
    <div class="mobileMenuPanel" id="mobileMenuPanel">
      <div class="mobileMenuHeader">
        <div class="mobileMenuUserInfo">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 34 34" fill="none">
            <path d="M6.545 25.67C7.99 24.565 9.605 23.6937 11.39 23.0562C13.175 22.4187 15.045 22.1 17 22.1C18.955 22.1 20.825 22.4187 22.61 23.0562C24.395 23.6937 26.01 24.565 27.455 25.67C28.4467 24.5083 29.2187 23.1908 29.7712 21.7175C30.3237 20.2442 30.6 18.6717 30.6 17C30.6 13.2317 29.2754 10.0229 26.6263 7.37375C23.9771 4.72458 20.7683 3.4 17 3.4C13.2317 3.4 10.0229 4.72458 7.37375 7.37375C4.72458 10.0229 3.4 13.2317 3.4 17C3.4 18.6717 3.67625 20.2442 4.22875 21.7175C4.78125 23.1908 5.55333 24.5083 6.545 25.67ZM17 18.7C15.3283 18.7 13.9188 18.1263 12.7713 16.9788C11.6238 15.8313 11.05 14.4217 11.05 12.75C11.05 11.0783 11.6238 9.66875 12.7713 8.52125C13.9188 7.37375 15.3283 6.8 17 6.8C18.6717 6.8 20.0813 7.37375 21.2288 8.52125C22.3763 9.66875 22.95 11.0783 22.95 12.75C22.95 14.4217 22.3763 15.8313 21.2288 16.9788C20.0813 18.1263 18.6717 18.7 17 18.7ZM17 34C14.6483 34 12.4383 33.5538 10.37 32.6613C8.30167 31.7688 6.5025 30.5575 4.9725 29.0275C3.4425 27.4975 2.23125 25.6983 1.33875 23.63C0.44625 21.5617 0 19.3517 0 17C0 14.6483 0.44625 12.4383 1.33875 10.37C2.23125 8.30167 3.4425 6.5025 4.9725 4.9725C6.5025 3.4425 8.30167 2.23125 10.37 1.33875C12.4383 0.44625 14.6483 0 17 0C19.3517 0 21.5617 0.44625 23.63 1.33875C25.6983 2.23125 27.4975 3.4425 29.0275 4.9725C30.5575 6.5025 31.7688 8.30167 32.6613 10.37C33.5538 12.4383 34 14.6483 34 17C34 19.3517 33.5538 21.5617 32.6613 23.63C31.7688 25.6983 30.5575 27.4975 29.0275 29.0275C27.4975 30.5575 25.6983 31.7688 23.63 32.6613C21.5617 33.5538 19.3517 34 17 34Z" fill="#913b9f"/>
          </svg>
          <div class="mobileMenuUserDetails">
            <span class="mobileMenuUserName" id="mobileMenuUserName"></span>
            <span class="mobileMenuUserEmail" id="mobileMenuUserEmail"></span>
          </div>
        </div>
        <button class="mobileMenuClose" id="mobileMenuClose" aria-label="Close menu">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <nav class="mobileMenuNav">
        <a href="../../Pages/Consumer Settings/consumerNotifications.html" class="mobileMenuItem${notificationsActive}">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 27 34" fill="none">
            <path d="M15.0527 31.9336C15.01 31.9837 14.9648 32.0338 14.916 32.083C14.5225 32.4794 14.0771 32.667 13.5 32.667C12.931 32.667 12.4667 32.4836 12.043 32.083C11.997 32.0337 11.9534 31.9842 11.9131 31.9336H15.0527ZM13.5 1.33301C13.8369 1.33301 14.0745 1.43757 14.2988 1.67676L14.3252 1.70508L14.3525 1.73145C14.5901 1.95749 14.6982 2.2011 14.6982 2.5498V4.7793L15.7061 5.0332C17.6639 5.52639 19.2331 6.56053 20.4561 8.16211L20.4619 8.16992C21.6819 9.74314 22.2919 11.5361 22.292 13.5996V26.833H25.667V27.5664H1.33301V26.833H4.70801V13.5996C4.70808 11.5361 5.3181 9.74313 6.53809 8.16992L6.54395 8.16211C7.76687 6.56053 9.33609 5.52639 11.2939 5.0332L12.3018 4.7793V2.5498C12.3018 2.17642 12.4135 1.92406 12.6318 1.7041C12.8939 1.44005 13.1609 1.33301 13.5 1.33301ZM13.5 5.4668C11.2841 5.4668 9.35528 6.27762 7.78613 7.8584C6.21758 9.43872 5.41709 11.3767 5.41699 13.5996V26.833H21.583V13.5996C21.5829 11.3767 20.7824 9.43872 19.2139 7.8584C17.6447 6.27762 15.7159 5.4668 13.5 5.4668Z" stroke="#341539" stroke-width="2"/>
          </svg>
          Notifications
        </a>
        <a href="../../Pages/Consumer Order/consumerCart.html" class="mobileMenuItem${cartActive}">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 35" fill="none">
            <path d="M1.33301 7.73301L6.2219 1.33301H25.7775L30.6663 7.73301M1.33301 7.73301V30.133C1.33301 30.9817 1.67639 31.7956 2.28762 32.3958C2.89885 32.9959 3.72786 33.333 4.59227 33.333H27.4071C28.2715 33.333 29.1005 32.9959 29.7117 32.3958C30.323 31.7956 30.6663 30.9817 30.6663 30.133V7.73301M1.33301 7.73301H30.6663M22.5182 14.133C22.5182 15.8304 21.8314 17.4583 20.609 18.6585C19.3865 19.8587 17.7285 20.533 15.9997 20.533C14.2709 20.533 12.6128 19.8587 11.3904 18.6585C10.1679 17.4583 9.48116 15.8304 9.48116 14.133" stroke="#341539" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Cart
          <span class="mobileMenuBadge" id="mobileMenuCartBadge" style="display:none">0</span>
        </a>
        <a href="../../Pages/Consumer Settings/consumerSettings.html" class="mobileMenuItem${settingsActive}">
          <img src="../../assets/icons/settings.svg" alt="" />
          Settings
        </a>
      </nav>
      <div class="mobileMenuFooter">
        <button class="mobileMenuLogout" id="mobileMenuLogout">
          <img src="../../assets/icons/logout.svg" alt="" />
          Logout
        </button>
      </div>
    </div>
  `;
}

/**
 * Inject the mobile menu into the page and initialize event listeners.
 * @param {Object} options
 * @param {string|null} options.activePage - 'notifications' | 'cart' | 'settings' | null
 */
export function injectMobileMenu(options = {}) {
  const html = generateMobileMenuHTML(options);
  document.body.insertAdjacentHTML("beforeend", html);
  initMobileMenu();
}

/**
 * Initialize event listeners for the mobile menu.
 * Expects the menu HTML to already exist in the DOM.
 */
export function initMobileMenu() {
  const hamburgerButton = document.getElementById("hamburgerButton");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  const mobileMenu = document.getElementById("mobileMenuPanel");
  const mobileMenuClose = document.getElementById("mobileMenuClose");

  if (!hamburgerButton || !mobileMenu) {
    return;
  }

  hamburgerButton.addEventListener("click", openMobileMenu);

  if (mobileMenuOverlay) {
    mobileMenuOverlay.addEventListener("click", closeMobileMenu);
  }

  if (mobileMenuClose) {
    mobileMenuClose.addEventListener("click", closeMobileMenu);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isMobileMenuOpen) {
      closeMobileMenu();
    }
  });

  const mobileLogoutBtn = document.getElementById("mobileMenuLogout");
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener("click", handleMobileLogout);
  }
}

export function openMobileMenu() {
  const hamburgerButton = document.getElementById("hamburgerButton");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  const mobileMenu = document.getElementById("mobileMenuPanel");

  if (hamburgerButton) hamburgerButton.classList.add("active");
  if (mobileMenuOverlay) mobileMenuOverlay.classList.add("active");
  if (mobileMenu) mobileMenu.classList.add("active");
  document.body.classList.add("mobileMenuOpen");

  isMobileMenuOpen = true;
}

export function closeMobileMenu() {
  const hamburgerButton = document.getElementById("hamburgerButton");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  const mobileMenu = document.getElementById("mobileMenuPanel");

  if (hamburgerButton) hamburgerButton.classList.remove("active");
  if (mobileMenuOverlay) mobileMenuOverlay.classList.remove("active");
  if (mobileMenu) mobileMenu.classList.remove("active");
  document.body.classList.remove("mobileMenuOpen");

  isMobileMenuOpen = false;
}

async function handleMobileLogout() {
  try {
    const { getAuth, signOut } =
      await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js");
    const auth = getAuth();
    await signOut(auth);
    window.location.href = "../../Pages/Auth/login.html";
  } catch (error) {
    console.error("Logout error:", error);
    window.location.href = "../../Pages/Auth/login.html";
  }
}

export function updateMobileCartBadge(count) {
  const badge = document.getElementById("mobileMenuCartBadge");
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : count;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }
}

export function updateMobileUserInfo(name, email) {
  const nameEl = document.getElementById("mobileMenuUserName");
  const emailEl = document.getElementById("mobileMenuUserEmail");

  if (nameEl && name) nameEl.textContent = name;
  if (emailEl && email) emailEl.textContent = email;
}
