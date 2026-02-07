// ============================================
// IMPORTS
// ============================================

import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";
import { initLiquidGlassToggle } from "../../assets/js/liquidGlassToggle.js";
import { injectMobileMenu } from "../../assets/js/mobileMenu.js";
import { auth, db, app } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  loadStripe,
  createSetupIntent,
  createCardElement,
  saveCard,
  getPaymentMethods,
  deletePaymentMethod,
} from "../../firebase/services/stripe.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const functions = getFunctions(app, "asia-southeast1");

// ============================================
// USER DATA
// ============================================

// Current user ID (set on auth)
let currentUserId = null;

// Stripe state
let stripeInstance = null;
let cardElement = null;
let setupIntentClientSecret = null;

// User data object (populated from Firebase and Stripe)
let userData = {
  name: "",
  password: "••••••••••",
  email: "",
  phoneNumber: "",
  telegramLinked: false,
  browserNotifications: true,
  paymentMethods: [], // Populated from Stripe
};

// ============================================
// ICON PATHS
// ============================================

const icons = {
  add: "../../assets/icons/add.svg",
  edit: "../../assets/icons/edit.svg",
  singapore: "../../assets/icons/singapore.svg",
  information: "../../assets/icons/information.svg",
};

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderPersonalDetails(user) {
  return `
    <div class="settingsSection">
      <div class="sectionHeader">
        <span class="sectionTitle">Personal Details</span>
        <div class="sectionActions">
          <button class="actionButton editButton" id="editPersonalDetails">
            <img src="${icons.edit}" alt="Edit" />
            Edit
          </button>
        </div>
      </div>
      <div class="detailRows">
        <div class="detailRow">
          <span class="detailLabel">Name</span>
          <span class="detailValue">${user.name}</span>
        </div>
        <div class="detailRow">
          <span class="detailLabel">Password</span>
          <span class="detailValuePassword">${user.password}</span>
        </div>
        <div class="detailRow">
          <span class="detailLabel">Email</span>
          <span class="detailValue">${user.email}</span>
        </div>
        <div class="detailRow">
          <div class="detailLabelGroup">
            <span class="detailLabel">Phone Number</span>
            <span class="optionalBadge">Optional</span>
          </div>
          ${
            user.phoneNumber
              ? `<span class="detailValuePhone">
                <img src="${icons.singapore}" alt="SG" />
                ${user.phoneNumber}
              </span>`
              : `<span class="detailValueNotProvided">Not provided</span>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderNotificationsSection(user) {
  let telegramHTML;

  if (user.telegramLinked) {
    // Telegram is connected - show connected status and unlink option
    const handle = user.telegramUsername
      ? `@${user.telegramUsername}`
      : "Linked";
    telegramHTML = `
      <div class="notificationMethodRight telegramConnected">
        <div class="telegramConnectedInfo">
          <span class="telegramConnectedLabel">Connected Telegram Account</span>
          <div class="telegramConnectedAccount">
            <span class="telegramHandle">${handle}</span>
            <button class="telegramDisconnectButton" id="telegramUnlink">Disconnect</button>
          </div>
        </div>
      </div>
    `;
  } else {
    // Not connected - show Telegram Login Widget
    telegramHTML = `
      <div class="notificationMethodRight">
        <span class="telegramStatus">Telegram isn't connected</span>
        <div id="telegramLoginWidget"></div>
      </div>
    `;
  }

  return `
    <div class="settingsSection">
      <span class="sectionTitle">Notifications</span>
      <span class="notificationsDescription">Hawkr believes clear, transparent communication makes everything nicer. Choose how you'd like updates.</span>
      <div class="notificationMethods">
        <div class="notificationMethod" id="telegramNotificationMethod">
          <div class="notificationMethodLeft">
            <span class="notificationMethodTitle">Telegram</span>
            <span class="notificationMethodDescription">${user.telegramLinked ? "You can now receive updates from us, even when Hawkr's web app is closed." : "Get instant order updates on Telegram. We'll notify you when your order is confirmed, ready, and complete."}</span>
          </div>
          ${telegramHTML}
        </div>
        <div class="notificationMethod">
          <div class="notificationMethodLeft">
            <span class="notificationMethodTitle">Browser</span>
            <span class="notificationMethodDescription">Shows pop-ups for order updates only while you're on this page.</span>
          </div>
          <label class="liquidGlassToggle" id="browserToggleLabel">
            <input type="checkbox" id="browserToggle" ${user.browserNotifications ? "checked" : ""} />
            <span class="toggleTrack">
              <span class="toggleThumb ${user.browserNotifications ? "glass" : ""}"></span>
            </span>
          </label>
        </div>
      </div>
    </div>
  `;
}

function renderPaymentCard(card, editMode = false) {
  const maskedNumber = card.lastFour
    ? `&bull;&bull;&bull;&bull;  &bull;&bull;&bull;&bull;  &bull;&bull;&bull;&bull;  ${card.lastFour}`
    : `&bull;&bull;&bull;&bull;  &bull;&bull;&bull;&bull;  &bull;&bull;&bull;&bull;  &bull;&bull;&bull;&bull;`;

  const removeButton = editMode
    ? `<button class="removeCardButton" data-card-id="${card.id || ""}" data-card-type="${card.type}" data-card-last-four="${card.lastFour}">Remove Card</button>`
    : "";

  return `
    <div class="cardOutside ${card.cardClass}">
      <img src="../../images/squirrelCard.svg" alt="" class="cardSquirrel" />
      ${removeButton}
      <img src="${card.logo}" alt="${card.type}" class="cardLogo" />
      <div class="cardInside">
        <p class="cardNumber">${maskedNumber}</p>
        <p class="cardExpiry">Exp ${card.expiry}</p>
      </div>
    </div>
  `;
}

let paymentEditMode = false;

function renderPaymentSection(user) {
  const hasPaymentMethods =
    user.paymentMethods && user.paymentMethods.length > 0;

  // Always render remove buttons, CSS will handle visibility via editMode class
  const cardsHTML = hasPaymentMethods
    ? user.paymentMethods.map((card) => renderPaymentCard(card, true)).join("")
    : `<div class="emptyState">
        <img src="../../images/noCards.svg" alt="No payment methods" class="emptyStateImage" />
        <span class="emptyStateTitle">No payment methods</span>
        <span class="emptyStateDescription">Add a card to make checkout faster and easier.</span>
        <button class="addCardCtaBtn" id="emptyAddCard"><img src="../../assets/icons/add.svg" alt="" /> Add new card</button>
        <span class="stripeBadge">Powered by <svg class="stripeLogo" width="33" height="14" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M60 12.8C60 8.55 57.95 5.18 54.12 5.18C50.27 5.18 47.88 8.55 47.88 12.77C47.88 17.72 50.63 20.33 54.57 20.33C56.5 20.33 57.96 19.87 59.08 19.22V16.04C57.96 16.62 56.67 16.97 55.05 16.97C53.45 16.97 52.04 16.42 51.87 14.51H59.97C59.97 14.29 60 13.33 60 12.8ZM51.82 11.75C51.82 9.93 52.88 9.15 54.1 9.15C55.29 9.15 56.29 9.93 56.29 11.75H51.82ZM41.41 5.18C39.79 5.18 38.76 5.93 38.19 6.45L37.98 5.43H34.5V24.53L38.36 23.71L38.37 19.26C38.96 19.69 39.82 20.33 41.39 20.33C44.58 20.33 47.48 17.89 47.48 12.63C47.46 7.79 44.52 5.18 41.41 5.18ZM40.55 16.83C39.49 16.83 38.87 16.46 38.37 15.99L38.36 9.85C38.9 9.33 39.54 8.98 40.55 8.98C42.16 8.98 43.3 10.74 43.3 12.89C43.3 15.1 42.18 16.83 40.55 16.83ZM29.04 4.18L32.92 3.35V0.12L29.04 0.94V4.18ZM29.04 5.45H32.92V20.05H29.04V5.45ZM24.93 6.59L24.67 5.45H21.27V20.05H25.12V10.01C26.06 8.82 27.61 9.05 28.09 9.22V5.45C27.59 5.26 25.87 4.93 24.93 6.59ZM17.09 1.72L13.32 2.52L13.3 16.22C13.3 18.54 15.07 20.34 17.38 20.34C18.64 20.34 19.56 20.11 20.07 19.83V16.62C19.58 16.83 17.07 17.55 17.07 15.23V9.17H20.07V5.45H17.07L17.09 1.72ZM5.61 9.88C5.61 9.3 6.09 9.08 6.88 9.08C8.05 9.08 9.52 9.42 10.69 10.04V6.2C9.42 5.7 8.17 5.5 6.88 5.5C3.5 5.5 1.28 7.22 1.28 10.1C1.28 14.62 7.52 13.93 7.52 15.86C7.52 16.55 6.92 16.77 6.08 16.77C4.8 16.77 3.18 16.26 1.88 15.56V19.45C3.32 20.06 4.78 20.33 6.08 20.33C9.55 20.33 11.91 18.66 11.91 15.74C11.89 10.86 5.61 11.7 5.61 9.88Z" fill="currentColor"/></svg></span>
      </div>`;

  const editButton = hasPaymentMethods
    ? paymentEditMode
      ? `<button class="actionButton saveButton" id="editPayment">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.5 7L5 10.5L11.5 2.5" stroke="#341539" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Save changes
        </button>`
      : `<button class="actionButton editButton" id="editPayment">
          <img src="${icons.edit}" alt="Edit" />
          Edit
        </button>`
    : "";

  const addCardButton = paymentEditMode
    ? ""
    : `<button class="actionButton addCard" id="addCard">
        <img src="${icons.add}" alt="Add" />
        Add new card
      </button>`;

  const containerClass = paymentEditMode
    ? "paymentCardsContainer editMode"
    : "paymentCardsContainer";

  const descriptionText = paymentEditMode
    ? "Saved payment methods, PCI DSS compliant. We use Stripe for secure payment processing."
    : "Secure payment methods, PCI DSS compliant. We use Stripe for secure payment processing.";

  return `
    <div class="settingsSection" id="paymentSection">
      <div class="sectionHeader">
        <span class="sectionTitle">Payment</span>
        <div class="sectionActions">
          ${addCardButton}
          ${editButton}
        </div>
      </div>
      <span class="paymentDescription">${descriptionText} <a href="404.html" class="paymentDescriptionLink">Learn more ></a></span>
      <div class="${containerClass}" id="paymentCardsContainer">
        ${cardsHTML}
      </div>
    </div>
  `;
}

function renderDangerZone() {
  return `
    <div class="dangerSection">
      <span class="dangerTitle">Danger Zone</span>
      <span class="dangerDescription">This place is dangerous. Buttons here trigger permanent actions that can’t be undone. Only proceed if you’re sure what you’re doing.</span>
      <div class="dangerItem">
        <div class="dangerItemLeft">
          <div class="dangerItemTitleGroup">
            <span class="dangerItemTitle">Delete Account</span>
            <span class="informationIcon">
              <img src="${icons.information}" alt="Info" />
              <span class="informationTooltip">We'll permanently delete your Hawkr profile and remove personal data linked to your account after the required retention periods end. Some records may be retained for security, fraud prevention, or legal compliance.</span>
            </span>
          </div>
          <span class="dangerItemDescription">We’ll wipe your Hawkr profile, and (almost) everything we know about you. <a href="404.html">View Privacy Policy ></a></span>
        </div>
        <button class="deleteButton" id="deleteAccount">Delete Account</button>
      </div>
    </div>
  `;
}

function renderSettingsPage(user) {
  const container = document.getElementById("settingsPageContent");
  if (!container) return;

  container.innerHTML = `
    <span class="pageTitle">Settings</span>
    <div class="sectionsContainer">
      ${renderPersonalDetails(user)}
      ${renderNotificationsSection(user)}
      ${renderPaymentSection(user)}
      ${renderDangerZone()}
    </div>
  `;

  attachEventListeners();
}

// ============================================
// EDIT PERSONAL DETAILS POPUP
// ============================================

function renderEditDetailsPopup(user) {
  return `
    <div class="editPopupHeader">
      <h2 class="editPopupTitle">Edit Personal Details</h2>
      <button class="editPopupClose" id="editDetailsClose" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="#341539" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <div class="editPopupContent">
      <div class="editFormGroup">
        <span class="editFormLabel">Name</span>
        <input type="text" class="editFormInput" id="editName" value="${user.name}" />
      </div>
      <div class="editFormGroup">
        <span class="editFormLabel">Password</span>
        <input type="password" class="editFormInput" id="editPassword" placeholder="Enter new password" />
      </div>
      <div class="editFormGroup">
        <span class="editFormLabel">Email</span>
        <input type="email" class="editFormInput" id="editEmail" value="${user.email}" />
      </div>
      <div class="editFormGroup">
        <div class="editFormLabelRow">
          <span class="editFormLabel">Phone Number</span>
          <span class="optionalBadge">Optional</span>
        </div>
        <div class="editFormPhoneRow">
          <img src="${icons.singapore}" alt="SG" />
          <span class="editFormPhonePrefix">+65</span>
          <input type="tel" class="editFormInput" id="editPhone" value="${user.phoneNumber.replace("+65 ", "").replace("+65", "")}" maxlength="9" placeholder="8XXX XXXX" />
        </div>
      </div>
    </div>
    <div class="editPopupFooter">
      <button class="editPopupSaveBtn" id="editDetailsSave">Save changes</button>
    </div>
  `;
}

function openEditDetails() {
  const popup = document.getElementById("editDetailsPopup");
  const overlay = document.getElementById("editDetailsOverlay");
  if (!popup || !overlay) return;

  popup.innerHTML = renderEditDetailsPopup(userData);
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";

  // Close button
  document
    .getElementById("editDetailsClose")
    .addEventListener("click", closeEditDetails);

  // Save button
  document
    .getElementById("editDetailsSave")
    .addEventListener("click", saveEditDetails);

  // Close on overlay click
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      closeEditDetails();
    }
  });
}

function closeEditDetails() {
  const overlay = document.getElementById("editDetailsOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }
}

async function saveEditDetails() {
  const name = document.getElementById("editName").value.trim();
  const password = document.getElementById("editPassword").value;
  const email = document.getElementById("editEmail").value.trim();
  const phoneRaw = document.getElementById("editPhone").value.trim();
  const phoneDigits = phoneRaw.replace(/\D/g, "");

  // Validate phone: must be 8 digits if provided
  if (phoneRaw && phoneDigits.length !== 8) {
    const phoneInput = document.getElementById("editPhone");
    phoneInput.style.borderColor = "#eb001b";
    phoneInput.focus();
    return;
  }

  const saveBtn = document.getElementById("editDetailsSave");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    // Build update object for Firebase
    const updates = {};
    if (name) updates.displayName = name; // Use 'displayName' to match Firebase schema
    if (phoneRaw) {
      updates.phone = `+65 ${phoneDigits.slice(0, 4)} ${phoneDigits.slice(4)}`;
    } else {
      updates.phone = "";
    }

    // Save to Firebase if authenticated
    if (currentUserId) {
      await updateDoc(doc(db, "customers", currentUserId), updates);
      console.log("Saved user details to Firebase:", updates);
    }

    // Update local state
    if (name) userData.name = name;
    if (password) userData.password = "••••••••••";
    if (email) userData.email = email;
    userData.phoneNumber = phoneRaw
      ? `+65 ${phoneDigits.slice(0, 4)} ${phoneDigits.slice(4)}`
      : "";

    closeEditDetails();
    renderSettingsPage(userData);
  } catch (error) {
    console.error("Error saving details:", error);
    alert("Failed to save changes. Please try again.");

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save changes";
    }
  }
}

// ============================================
// ADD CARD (STRIPE ELEMENTS)
// ============================================

async function handleAddCard() {
  if (!currentUserId) {
    alert("Please log in to add a payment method");
    return;
  }

  try {
    // Load Stripe if not already loaded
    if (!stripeInstance) {
      stripeInstance = await loadStripe();
    }

    // Create SetupIntent for saving card
    const { clientSecret } = await createSetupIntent();
    setupIntentClientSecret = clientSecret;

    // Open the modal
    openCardModal();

    // Create and mount card element
    if (cardElement) {
      cardElement.destroy();
    }
    cardElement = createCardElement(stripeInstance, "cardElement");

    // Listen for card element changes
    cardElement.on("change", (event) => {
      const errorElement = document.getElementById("cardError");
      if (event.error) {
        errorElement.textContent = event.error.message;
      } else {
        errorElement.textContent = "";
      }
    });
  } catch (error) {
    console.error("Error setting up card input:", error);
    alert("Failed to set up card input. Please try again.");
  }
}

function openCardModal() {
  const overlay = document.getElementById("cardModalOverlay");
  if (overlay) {
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeCardModal() {
  const overlay = document.getElementById("cardModalOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  // Clear error
  const errorElement = document.getElementById("cardError");
  if (errorElement) {
    errorElement.textContent = "";
  }
}

async function handleSaveCard() {
  const saveBtn = document.getElementById("cardModalSaveBtn");
  const errorElement = document.getElementById("cardError");

  if (!stripeInstance || !cardElement || !setupIntentClientSecret) {
    errorElement.textContent = "Card setup not ready. Please try again.";
    return;
  }

  try {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    const result = await saveCard(
      stripeInstance,
      cardElement,
      setupIntentClientSecret,
    );

    if (!result.success) {
      errorElement.textContent = result.error;
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Card";
      return;
    }

    // Card saved successfully - reload payment methods from Stripe
    const stripePaymentMethods = await getPaymentMethods();
    userData.paymentMethods = stripePaymentMethods.map((pm) => {
      const brand = pm.brand || "unknown";
      const brandConfig = getBrandConfig(brand);
      return {
        id: pm.id,
        type: brandConfig.displayName,
        lastFour: pm.lastFour || "",
        expiry:
          pm.expMonth && pm.expYear
            ? `${String(pm.expMonth).padStart(2, "0")}/${String(pm.expYear).slice(-2)}`
            : "",
        logo: brandConfig.logo,
        cardClass: brandConfig.cardClass,
      };
    });

    closeCardModal();

    // Re-render payment section
    const paymentSection = document.getElementById("paymentSection");
    if (paymentSection) {
      paymentSection.outerHTML = renderPaymentSection(userData);
      attachPaymentListeners();
    }

    // Notify card added
    try {
      const newCard =
        userData.paymentMethods[userData.paymentMethods.length - 1];
      const notifyCard = httpsCallable(functions, "notifyCardEvent");
      await notifyCard({
        eventType: "card_added",
        cardBrand: newCard ? newCard.type : "Card",
        cardLast4: newCard ? newCard.lastFour : "",
      });
    } catch (notifErr) {
      console.error("Card added notification failed:", notifErr);
    }

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Card";
  } catch (error) {
    console.error("Error saving card:", error);
    errorElement.textContent = "Failed to save card. Please try again.";
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Card";
  }
}

// ============================================
// REMOVE CARD CONFIRMATION POPUP
// ============================================

let pendingRemoveCard = null;

function renderRemoveCardPopup(cardType, cardLastFour) {
  const cardLabel = cardLastFour ? `${cardType} ${cardLastFour}` : cardType;
  return `
    <div class="editPopupHeader">
      <h2 class="editPopupTitle">Remove Card</h2>
      <button class="editPopupClose" id="removeCardClose" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="#341539" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <div class="editPopupContent">
      <span class="confirmationText">Are you sure you want to remove ${cardLabel}?</span>
    </div>
    <div class="editPopupFooter confirmationFooter">
      <button class="confirmationCancelBtn" id="removeCardCancel">Cancel</button>
      <button class="confirmationRemoveBtn" id="removeCardConfirm">Remove</button>
    </div>
  `;
}

function openRemoveCardConfirmation(cardId, cardType, cardLastFour) {
  pendingRemoveCard = { cardId, cardType, cardLastFour };

  const popup = document.getElementById("removeCardPopup");
  const overlay = document.getElementById("removeCardOverlay");
  if (!popup || !overlay) return;

  popup.innerHTML = renderRemoveCardPopup(cardType, cardLastFour);
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";

  document
    .getElementById("removeCardClose")
    .addEventListener("click", closeRemoveCard);
  document
    .getElementById("removeCardCancel")
    .addEventListener("click", closeRemoveCard);
  document
    .getElementById("removeCardConfirm")
    .addEventListener("click", confirmRemoveCard);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      closeRemoveCard();
    }
  });
}

function closeRemoveCard() {
  const overlay = document.getElementById("removeCardOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }
  pendingRemoveCard = null;
}

async function confirmRemoveCard() {
  if (!pendingRemoveCard) return;

  const { cardId, cardType, cardLastFour } = pendingRemoveCard;

  // Show loading state on the remove button
  const confirmBtn = document.getElementById("removeCardConfirm");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Removing...";
  }

  try {
    // Delete from Stripe if we have a card ID
    if (cardId) {
      await deletePaymentMethod(cardId);
      console.log("Deleted payment method from Stripe:", cardId);
    }

    // Remove from local state
    userData.paymentMethods = userData.paymentMethods.filter(
      (card) => card.id !== cardId,
    );

    closeRemoveCard();

    const paymentSection = document.getElementById("paymentSection");
    if (paymentSection) {
      paymentSection.outerHTML = renderPaymentSection(userData);
      attachPaymentListeners();
    }

    // Notify card removed
    try {
      const notifyCard = httpsCallable(functions, "notifyCardEvent");
      await notifyCard({
        eventType: "card_removed",
        cardBrand: cardType,
        cardLast4: cardLastFour,
      });
    } catch (notifErr) {
      console.error("Card removed notification failed:", notifErr);
    }
  } catch (error) {
    console.error("Error removing card:", error);
    alert("Failed to remove card. Please try again.");

    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Remove";
    }
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

// ============================================
// TELEGRAM LOGIN WIDGET HANDLERS
// ============================================

/**
 * Initialize the Telegram Login Widget
 * This creates the official "Log in with Telegram" button
 */
function initTelegramLoginWidget() {
  const container = document.getElementById("telegramLoginWidget");
  if (!container) return;

  // Clear any existing content
  container.innerHTML = "";

  // Create the Telegram Login Widget script
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://telegram.org/js/telegram-widget.js?22";
  script.setAttribute("data-telegram-login", "hawkrOrgBot");
  script.setAttribute("data-size", "large");
  script.setAttribute("data-onauth", "onTelegramAuth(user)");
  script.setAttribute("data-request-access", "write");

  container.appendChild(script);
}

/**
 * Callback function when user authenticates with Telegram
 * This is called by the Telegram Login Widget
 */
window.onTelegramAuth = async function (user) {
  if (!currentUserId) {
    console.error("User not authenticated");
    alert("Please log in to link your Telegram account.");
    return;
  }

  try {
    // Save Telegram user data to Firestore
    await updateDoc(doc(db, "customers", currentUserId), {
      telegramChatId: user.id.toString(),
      telegramLinked: true,
      telegramUsername: user.username || null,
      telegramFirstName: user.first_name || null,
      telegramLastName: user.last_name || null,
      telegramPhotoUrl: user.photo_url || null,
      telegramAuthDate: user.auth_date,
    });

    // Update local state
    userData.telegramLinked = true;
    userData.telegramUsername = user.username || null;

    // Re-render the page to show connected status
    rerenderTelegramSection();

    console.log("Telegram linked successfully:", user.username || user.id);
  } catch (error) {
    console.error("Error linking Telegram:", error);
    alert("Failed to link Telegram account. Please try again.");
  }
};

/**
 * Handle "Unlink" button click
 */
async function handleTelegramUnlink() {
  if (!currentUserId) return;

  if (
    !confirm(
      "Are you sure you want to unlink your Telegram account? You will no longer receive order notifications on Telegram.",
    )
  ) {
    return;
  }

  try {
    await updateDoc(doc(db, "customers", currentUserId), {
      telegramChatId: null,
      telegramLinked: false,
      telegramUsername: null,
      telegramFirstName: null,
      telegramLastName: null,
      telegramPhotoUrl: null,
      telegramAuthDate: null,
    });

    userData.telegramLinked = false;
    userData.telegramUsername = null;

    rerenderTelegramSection();
  } catch (error) {
    console.error("Error unlinking Telegram:", error);
    alert("Failed to unlink Telegram. Please try again.");
  }
}

/**
 * Re-render just the Telegram notification method section
 */
function rerenderTelegramSection() {
  // Re-render the entire settings page to update Telegram section
  renderSettingsPage(userData);
}

// ============================================
// PAYMENT CARD MORPH ANIMATION (FLIP technique)
// ============================================

/**
 * Animate payment cards morphing between horizontal and vertical layouts
 * Smoothly animates position AND width expansion/contraction
 */
function animatePaymentCardsMorph(toEditMode) {
  const container = document.getElementById("paymentCardsContainer");
  if (!container) return;

  const cards = container.querySelectorAll(".cardOutside");
  if (cards.length === 0) return;

  // FIRST: Capture initial positions and widths
  const firstState = Array.from(cards).map((card) => {
    const rect = card.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width };
  });

  // Lock current widths before changing layout
  cards.forEach((card, index) => {
    card.style.width = `${firstState[index].width}px`;
  });

  // Apply the final state class
  if (toEditMode) {
    container.classList.add("editMode");
  } else {
    container.classList.remove("editMode");
  }

  // Force layout recalculation
  container.offsetHeight;

  // Get the target width for edit mode
  const targetWidth = container.getBoundingClientRect().width;

  // LAST: Get final positions
  const lastState = Array.from(cards).map((card, index) => {
    const rect = card.getBoundingClientRect();
    // In edit mode, cards should be full width; otherwise use natural width
    const finalWidth = toEditMode ? targetWidth : firstState[index].width;
    return { left: rect.left, top: rect.top, width: finalWidth };
  });

  // For collapsing (exiting edit mode), we need to recalculate positions
  // based on the original horizontal layout
  if (!toEditMode) {
    // Temporarily remove width locks to get natural positions
    cards.forEach((card) => {
      card.style.width = "";
    });
    container.offsetHeight;

    // Recapture the natural positions
    Array.from(cards).forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      lastState[index] = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
      };
    });

    // Re-lock to first state width for animation
    cards.forEach((card, index) => {
      card.style.width = `${firstState[index].width}px`;
    });
  }

  // INVERT & PLAY: Animate each card
  cards.forEach((card, index) => {
    const first = firstState[index];
    const last = lastState[index];

    // Calculate deltas
    const deltaX = first.left - last.left;
    const deltaY = first.top - last.top;

    // Set initial state without transition
    card.style.transition = "none";
    card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    card.style.width = `${first.width}px`;

    // Force reflow
    card.offsetHeight;

    // PLAY: Animate to final state
    card.style.transition =
      "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), width 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
    card.style.transform = "translate(0, 0)";
    card.style.width = `${last.width}px`;

    // Clean up inline styles after animation
    const cleanup = () => {
      card.style.transform = "";
      card.style.transition = "";
      card.style.width = "";
    };

    card.addEventListener("transitionend", cleanup, { once: true });

    // Fallback cleanup
    setTimeout(cleanup, 600);
  });
}

// ============================================
// PAYMENT LISTENERS
// ============================================

function attachPaymentListeners() {
  // Edit payment / Save changes toggle
  const editPayment = document.getElementById("editPayment");
  if (editPayment) {
    editPayment.addEventListener("click", function () {
      paymentEditMode = !paymentEditMode;

      // Animate the cards morphing with FLIP technique
      animatePaymentCardsMorph(paymentEditMode);

      // Update button and add card visibility
      const paymentSection = document.getElementById("paymentSection");
      if (paymentSection) {
        const sectionHeader = paymentSection.querySelector(".sectionHeader");
        const descriptionEl = paymentSection.querySelector(
          ".paymentDescription",
        );

        if (sectionHeader) {
          const addCardButton = paymentEditMode
            ? ""
            : `<button class="actionButton addCard" id="addCard">
                <img src="${icons.add}" alt="Add" />
                Add new card
              </button>`;

          const editButton = paymentEditMode
            ? `<button class="actionButton saveButton" id="editPayment">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.5 7L5 10.5L11.5 2.5" stroke="#341539" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Save changes
              </button>`
            : `<button class="actionButton editButton" id="editPayment">
                <img src="${icons.edit}" alt="Edit" />
                Edit
              </button>`;

          sectionHeader.querySelector(".sectionActions").innerHTML =
            `${addCardButton}${editButton}`;
        }

        if (descriptionEl) {
          descriptionEl.textContent = paymentEditMode
            ? "Saved payment methods, PCI DSS compliant. We use Stripe for secure payment processing."
            : "Secure payment methods, PCI DSS compliant. We use Stripe for secure payment processing.";
        }

        // Re-attach listeners after updating buttons
        attachPaymentListeners();
      }
    });
  }

  // Add card
  const addCard = document.getElementById("addCard");
  if (addCard) {
    addCard.addEventListener("click", function () {
      handleAddCard();
    });
  }

  // Add card from empty state
  const emptyAddCard = document.getElementById("emptyAddCard");
  if (emptyAddCard) {
    emptyAddCard.addEventListener("click", function () {
      handleAddCard();
    });
  }

  // Remove card buttons
  const removeButtons = document.querySelectorAll(".removeCardButton");
  removeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const cardId = this.dataset.cardId;
      const cardType = this.dataset.cardType;
      const cardLastFour = this.dataset.cardLastFour;
      openRemoveCardConfirmation(cardId, cardType, cardLastFour);
    });
  });
}

function attachEventListeners() {
  // Browser notifications toggle - use liquid glass toggle
  const browserToggleLabel = document.getElementById("browserToggleLabel");
  if (browserToggleLabel) {
    initLiquidGlassToggle(browserToggleLabel, (isChecked) => {
      userData.browserNotifications = isChecked;
      if (currentUserId) {
        updateDoc(doc(db, "customers", currentUserId), {
          browserNotifications: isChecked,
        }).catch((err) =>
          console.error("Error saving browser notification pref:", err),
        );
      }
    });
  }

  // Telegram unlink button
  const telegramUnlink = document.getElementById("telegramUnlink");
  if (telegramUnlink) {
    telegramUnlink.addEventListener("click", handleTelegramUnlink);
  }

  // Initialize Telegram Login Widget if not connected
  const telegramWidgetContainer = document.getElementById(
    "telegramLoginWidget",
  );
  if (telegramWidgetContainer && !userData.telegramLinked) {
    initTelegramLoginWidget();
  }

  // Edit personal details
  const editPersonalDetails = document.getElementById("editPersonalDetails");
  if (editPersonalDetails) {
    editPersonalDetails.addEventListener("click", function () {
      openEditDetails();
    });
  }

  // Payment listeners (edit, add card, remove)
  attachPaymentListeners();

  // Delete account
  const deleteAccount = document.getElementById("deleteAccount");
  if (deleteAccount) {
    deleteAccount.addEventListener("click", function () {
      console.log("Delete account clicked");
    });
  }
}

// ============================================
// NAVIGATION HANDLERS
// ============================================

function handleBackClick() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "../Consumer Dashboard/consumerDashboard.html";
  }
}

// ============================================
// LOADING STATE
// ============================================

function showLoading() {
  const container = document.getElementById("settingsPageContent");
  if (container) {
    container.innerHTML = `<div class="loadingSpinner"></div>`;
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initializeSettingsPage() {
  showLoading();

  // Load customer data from Firebase if authenticated
  if (currentUserId) {
    try {
      const customerDoc = await getDoc(doc(db, "customers", currentUserId));
      if (customerDoc.exists()) {
        const customerData = customerDoc.data();
        console.log("Customer data from Firebase:", customerData);

        // Update user data with Firebase data
        // Field is 'displayName' in Firebase, not 'name'
        if (customerData.displayName) userData.name = customerData.displayName;
        if (customerData.phone) userData.phoneNumber = customerData.phone;

        // Telegram status
        userData.telegramLinked = customerData.telegramLinked || false;
        userData.telegramUsername = customerData.telegramUsername || null;

        // Browser notifications
        if (customerData.browserNotifications !== undefined) {
          userData.browserNotifications = customerData.browserNotifications;
        }
      }
    } catch (error) {
      console.error("Error loading customer data:", error);
    }

    // Load saved payment methods from Stripe
    try {
      const stripePaymentMethods = await getPaymentMethods();
      console.log("Raw Stripe payment methods:", stripePaymentMethods);
      userData.paymentMethods = stripePaymentMethods.map((pm) => {
        // Backend returns: { id, type, brand, lastFour, expMonth, expYear }
        const brand = pm.brand || "unknown";
        const brandConfig = getBrandConfig(brand);
        return {
          id: pm.id, // Stripe payment method ID (needed for deletion)
          type: brandConfig.displayName,
          lastFour: pm.lastFour || "",
          expiry:
            pm.expMonth && pm.expYear
              ? `${String(pm.expMonth).padStart(2, "0")}/${String(pm.expYear).slice(-2)}`
              : "",
          logo: brandConfig.logo,
          cardClass: brandConfig.cardClass,
        };
      });
      console.log("Mapped payment methods:", userData.paymentMethods);
    } catch (error) {
      console.error("Error loading payment methods:", error);
      userData.paymentMethods = [];
    }
  }

  renderSettingsPage(userData);
}

/**
 * Get brand configuration for display
 */
function getBrandConfig(brand) {
  const brandConfigs = {
    visa: {
      displayName: "Visa",
      logo: "../../Payment Methods/visaCard.svg",
      cardClass: "visa",
    },
    mastercard: {
      displayName: "MasterCard",
      logo: "../../Payment Methods/masterCardCard.svg",
      cardClass: "mastercard",
    },
    amex: {
      displayName: "American Express",
      logo: "../../Payment Methods/americanExpressCard.svg",
      cardClass: "amex",
    },
    unionpay: {
      displayName: "UnionPay",
      logo: "../../Payment Methods/unionPayCard.svg",
      cardClass: "unionpay",
    },
    discover: {
      displayName: "Discover",
      logo: "../../Payment Methods/visaCard.svg",
      cardClass: "visa",
    },
    diners: {
      displayName: "Diners Club",
      logo: "../../Payment Methods/visaCard.svg",
      cardClass: "visa",
    },
    jcb: {
      displayName: "JCB",
      logo: "../../Payment Methods/visaCard.svg",
      cardClass: "visa",
    },
  };

  const config = brandConfigs[brand.toLowerCase()];
  return (
    config || {
      displayName: brand.charAt(0).toUpperCase() + brand.slice(1),
      logo: "../../Payment Methods/visaCard.svg",
      cardClass: "visa",
    }
  );
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();
  injectMobileMenu({ activePage: "settings" });

  // Wait for auth state before initializing
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUserId = user.uid;
      userData.email = user.email || userData.email;
      userData.name = user.displayName || userData.name;
      initializeSettingsPage();
    } else {
      // Redirect to login if not authenticated
      window.location.href = "../Auth/login.html";
    }
  });

  // Back button handler
  const backButton = document.getElementById("backButton");
  if (backButton) {
    backButton.addEventListener("click", handleBackClick);
  }

  // Card modal event listeners
  const cardModalClose = document.getElementById("cardModalClose");
  const cardModalCancelBtn = document.getElementById("cardModalCancelBtn");
  const cardModalSaveBtn = document.getElementById("cardModalSaveBtn");
  const cardModalOverlayEl = document.getElementById("cardModalOverlay");

  if (cardModalClose) cardModalClose.addEventListener("click", closeCardModal);
  if (cardModalCancelBtn)
    cardModalCancelBtn.addEventListener("click", closeCardModal);
  if (cardModalSaveBtn)
    cardModalSaveBtn.addEventListener("click", handleSaveCard);
  if (cardModalOverlayEl) {
    cardModalOverlayEl.addEventListener("click", function (e) {
      if (e.target === cardModalOverlayEl) closeCardModal();
    });
  }

  // Search input focus shortcut
  const searchInput = document.getElementById("searchInput");

  document.addEventListener("keydown", function (e) {
    // Close popups on Escape
    if (e.key === "Escape") {
      const removeCardOverlay = document.getElementById("removeCardOverlay");
      if (removeCardOverlay && removeCardOverlay.classList.contains("active")) {
        closeRemoveCard();
        return;
      }
      const cardModalOverlay = document.getElementById("cardModalOverlay");
      if (cardModalOverlay && cardModalOverlay.classList.contains("active")) {
        closeCardModal();
        return;
      }
      const detailsOverlay = document.getElementById("editDetailsOverlay");
      if (detailsOverlay && detailsOverlay.classList.contains("active")) {
        closeEditDetails();
        return;
      }
    }

    if (!searchInput) return;

    const targetTag = e.target.tagName.toLowerCase();
    const isEditable = e.target.isContentEditable === true;

    if (targetTag === "input" || targetTag === "textarea" || isEditable) {
      return;
    }

    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
});
