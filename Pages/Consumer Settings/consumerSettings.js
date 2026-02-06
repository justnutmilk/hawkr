// ============================================
// IMPORTS
// ============================================

import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";
import { initLiquidGlassToggle } from "../../assets/js/liquidGlassToggle.js";
import { initMobileMenu } from "../../assets/js/mobileMenu.js";
import { auth, db } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getPaymentMethods,
  deletePaymentMethod,
} from "../../firebase/services/stripe.js";

// ============================================
// USER DATA
// ============================================

// Current user ID (set on auth)
let currentUserId = null;

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
    telegramHTML = `
      <div class="notificationMethodRight telegramConnected">
        <span class="telegramStatus connected">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.5 4.5L6.5 11.5L3 8" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Telegram connected
        </span>
        <button class="telegramUnlinkButton" id="telegramUnlink">Unlink</button>
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
            <span class="notificationMethodDescription">Get instant order updates on Telegram. We'll notify you when your order is confirmed, ready, and complete.</span>
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
        Add Card
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
// ADD CARD POPUP
// ============================================

const cardTypeConfig = {
  Visa: { logo: "../../Payment Methods/visaCard.svg", cardClass: "visa" },
  MasterCard: {
    logo: "../../Payment Methods/masterCardCard.svg",
    cardClass: "mastercard",
  },
  "American Express": {
    logo: "../../Payment Methods/americanExpressCard.svg",
    cardClass: "amex",
  },
  UnionPay: {
    logo: "../../Payment Methods/unionPayCard.svg",
    cardClass: "unionpay",
  },
  "Apple Pay": {
    logo: "../../Payment Methods/applePayCard.svg",
    cardClass: "applepay",
  },
  "Google Pay": {
    logo: "../../Payment Methods/googlePayCard.svg",
    cardClass: "googlepay",
  },
};

const cardTypesWithNumber = [
  "Visa",
  "MasterCard",
  "American Express",
  "UnionPay",
];

function renderAddCardPopup() {
  const typeOptions = Object.keys(cardTypeConfig)
    .map((type) => `<option value="${type}">${type}</option>`)
    .join("");

  return `
    <div class="editPopupHeader">
      <h2 class="editPopupTitle">Add Card</h2>
      <button class="editPopupClose" id="addCardClose" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="#341539" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <div class="editPopupContent">
      <div class="editFormGroup">
        <span class="editFormLabel">Card Type</span>
        <select class="editFormSelect" id="addCardType">
          <option value="" disabled selected>Select a card type</option>
          ${typeOptions}
        </select>
      </div>
      <div class="editFormGroup" id="addCardNumberGroup">
        <span class="editFormLabel">Card Number</span>
        <input type="text" class="editFormInput" id="addCardNumber" maxlength="19" placeholder="XXXX XXXX XXXX XXXX" />
      </div>
      <div class="editFormGroup">
        <span class="editFormLabel">Expiry Date</span>
        <input type="text" class="editFormInput" id="addCardExpiry" maxlength="5" placeholder="MM/YY" />
      </div>
    </div>
    <div class="editPopupFooter">
      <button class="editPopupSaveBtn" id="addCardSave">Add Card</button>
    </div>
  `;
}

function openAddCard() {
  const popup = document.getElementById("addCardPopup");
  const overlay = document.getElementById("addCardOverlay");
  if (!popup || !overlay) return;

  popup.innerHTML = renderAddCardPopup();
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";

  // Close button
  document
    .getElementById("addCardClose")
    .addEventListener("click", closeAddCard);

  // Save button
  document.getElementById("addCardSave").addEventListener("click", saveAddCard);

  // Close on overlay click
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      closeAddCard();
    }
  });

  // Toggle card number field visibility based on type
  const typeSelect = document.getElementById("addCardType");
  typeSelect.addEventListener("change", function () {
    const numberGroup = document.getElementById("addCardNumberGroup");
    if (cardTypesWithNumber.includes(this.value)) {
      numberGroup.style.display = "flex";
    } else {
      numberGroup.style.display = "none";
    }
  });

  // Auto-format card number with spaces
  const cardNumberInput = document.getElementById("addCardNumber");
  cardNumberInput.addEventListener("input", function () {
    let value = this.value.replace(/\D/g, "");
    value = value.replace(/(.{4})/g, "$1 ").trim();
    this.value = value;
  });

  // Auto-format expiry with slash
  const expiryInput = document.getElementById("addCardExpiry");
  expiryInput.addEventListener("input", function () {
    let value = this.value.replace(/\D/g, "");
    if (value.length >= 2) {
      value = value.slice(0, 2) + "/" + value.slice(2);
    }
    this.value = value;
  });
}

function closeAddCard() {
  const overlay = document.getElementById("addCardOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }
}

function saveAddCard() {
  const type = document.getElementById("addCardType").value;
  const expiry = document.getElementById("addCardExpiry").value.trim();
  const numberInput = document.getElementById("addCardNumber");
  const cardNumber = numberInput ? numberInput.value.trim() : "";

  // Validate type
  if (!type) {
    document.getElementById("addCardType").style.borderColor = "#eb001b";
    return;
  }

  // Validate card number for card types that need it
  if (cardTypesWithNumber.includes(type)) {
    const digits = cardNumber.replace(/\D/g, "");
    if (digits.length < 4) {
      numberInput.style.borderColor = "#eb001b";
      numberInput.focus();
      return;
    }
  }

  // Validate expiry
  const expiryMatch = expiry.match(/^(0[1-9]|1[0-2])\/\d{2}$/);
  if (!expiryMatch) {
    document.getElementById("addCardExpiry").style.borderColor = "#eb001b";
    document.getElementById("addCardExpiry").focus();
    return;
  }

  // Build card object
  const config = cardTypeConfig[type];
  const digits = cardNumber.replace(/\D/g, "");
  const lastFour = cardTypesWithNumber.includes(type) ? digits.slice(-4) : "";

  const newCard = {
    type: type,
    lastFour: lastFour,
    expiry: expiry,
    logo: config.logo,
    cardClass: config.cardClass,
  };

  userData.paymentMethods.push(newCard);

  closeAddCard();

  // Re-render payment section
  const paymentSection = document.getElementById("paymentSection");
  if (paymentSection) {
    paymentSection.outerHTML = renderPaymentSection(userData);
    attachPaymentListeners();
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
                Add Card
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
      openAddCard();
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

        // Browser notifications - check both root level and preferences object
        if (customerData.browserNotifications !== undefined) {
          userData.browserNotifications = customerData.browserNotifications;
        } else if (
          customerData.preferences?.browserNotifications !== undefined
        ) {
          userData.browserNotifications =
            customerData.preferences.browserNotifications;
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
  initMobileMenu();

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
      const addCardOverlay = document.getElementById("addCardOverlay");
      if (addCardOverlay && addCardOverlay.classList.contains("active")) {
        closeAddCard();
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
