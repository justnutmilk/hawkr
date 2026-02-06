// ============================================
// IMPORTS
// ============================================

import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";
import { initMobileMenu } from "../../assets/js/mobileMenu.js";
import { initLiquidGlassToggle } from "../../assets/js/liquidGlassToggle.js";
import { auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getCustomerOrders } from "../../firebase/services/orders.js";
import {
  submitFeedback,
  hasFeedbackForOrder,
  getCustomer,
} from "../../firebase/services/customers.js";

// ============================================
// CONSUMER FEEDBACK FLOW
// ============================================

// Steps: 1 = Select Order, 2 = Rate Experience, 3 = Review & Submit, 4 = Success
let currentStep = 1;
let selectedOrder = null;
let currentUser = null;
let recentOrders = [];
let isLoading = false;

let feedbackData = {
  rating: 0,
  tags: [],
  text: "",
  confirmed: false,
  contactMe: false,
};

// Quick tags available
const quickTags = [
  "Fast service",
  "Friendly",
  "Good value",
  "Accurate order",
  "Long wait",
  "Food quality",
  "Portion size",
  "Cleanliness",
  "Packaging",
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(date) {
  const options = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  return date.toLocaleDateString("en-SG", options);
}

function formatPrice(amount) {
  return `$${amount.toFixed(2)}`;
}

function getOrdersWithinDays(orders, days) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  return orders.filter((order) => {
    const orderDate = order.date || order.createdAt;
    return orderDate >= cutoffDate;
  });
}

// ============================================
// ICON COMPONENTS
// ============================================

function getStarIcon(filled = false) {
  const fillColor = filled ? "#E9E932" : "#E0E0E0";
  const strokeColor = filled ? "#E9E932" : "#E0E0E0";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.36151 0.578125L8.14858 4.19852L12.1449 4.78265L9.2532 7.59916L9.93564 11.5781L6.36151 9.69852L2.78738 11.5781L3.46982 7.59916L0.578125 4.78265L4.57444 4.19852L6.36151 0.578125Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.15668" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function getInfoIcon() {
  return `<img src="../../assets/icons/information.svg" alt="Info" class="infoIcon">`;
}

function getWarningIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#856404">
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
  </svg>`;
}

function getCheckIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2E7D32">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
  </svg>`;
}

// ============================================
// STEP 1: SELECT ORDER
// ============================================

function renderProgressBar() {
  // Calculate progress percentage (3 steps total)
  const progressPercent = ((currentStep - 1) / 2) * 100;

  const labels = ["Select Order", "Rate Experience", "Review & Submit"];

  const labelsHTML = labels
    .map((label, index) => {
      const stepNum = index + 1;
      let className = "progressBarLabel";
      if (stepNum < currentStep) className += " completed";
      else if (stepNum === currentStep) className += " active";
      return `<span class="${className}">${label}</span>`;
    })
    .join("");

  return `
    <div class="progressBarWrapper">
      <div class="progressBar">
        <div class="progressBarFill" style="width: ${progressPercent}%"></div>
      </div>
      <div class="progressBarLabels">
        ${labelsHTML}
      </div>
    </div>
  `;
}

function renderOrderCard(order) {
  const items = order.items || [];
  const itemNames = items.map((item) => item.name);
  const itemsSummary =
    itemNames.length > 2
      ? `${itemNames.slice(0, 2).join(", ")} +${itemNames.length - 2} more`
      : itemNames.join(", ") || "No items";

  const isSelected = selectedOrder && selectedOrder.id === order.id;
  const hasFeedback = order.hasFeedback;

  return `
    <div class="orderCard ${isSelected ? "selected" : ""} ${hasFeedback ? "has-feedback" : ""}" data-order-id="${order.id}">
      <div class="orderCardLeft">
        <span class="orderStallName">${order.stallName || "Unknown Stall"}</span>
        <div class="orderMeta">
          <span class="orderDate">${formatDate(order.date)}</span>
          <span class="orderItems">${itemsSummary}</span>
        </div>
        ${hasFeedback ? '<span class="feedbackBadge">Feedback submitted</span>' : ""}
      </div>
      <div class="orderCardRight">
        <span class="orderTotal">${formatPrice(order.total || 0)}</span>
        <a href="consumerTransactionDetail.html?id=${encodeURIComponent(order.id)}" class="viewReceiptLink" onclick="event.stopPropagation(); sessionStorage.setItem('transactionDetailReferrer', 'consumerFeedback.html');">View receipt</a>
      </div>
    </div>
  `;
}

function renderSelectOrder() {
  const eligibleOrders = getOrdersWithinDays(recentOrders, 14);
  // Filter out orders that already have feedback
  const ordersWithoutFeedback = eligibleOrders.filter((o) => !o.hasFeedback);

  if (!currentUser) {
    return `
      <div class="nowGivingSection">
        <span class="nowGivingLabel">Now Giving:</span>
        <span class="nowGivingTitle">Feedback</span>
      </div>
      ${renderProgressBar()}
      <div class="emptyState">
        <h2 class="emptyStateTitle">Please log in</h2>
        <p class="emptyStateText">You need to be logged in to leave feedback on your orders.</p>
        <a href="../Auth/login.html" class="primaryButton">Log In</a>
      </div>
    `;
  }

  if (isLoading) {
    return `
      <div class="nowGivingSection">
        <span class="nowGivingLabel">Now Giving:</span>
        <span class="nowGivingTitle">Feedback</span>
      </div>
      ${renderProgressBar()}
      <div class="loadingSpinner"></div>
    `;
  }

  if (eligibleOrders.length === 0) {
    return `
      <div class="nowGivingSection">
        <span class="nowGivingLabel">Now Giving:</span>
        <span class="nowGivingTitle">Feedback</span>
      </div>
      ${renderProgressBar()}
      <div class="pageHeader">
        <h1 class="pageTitle">Select your experience</h1>
        <p class="pageHelper">Choose an order from the last 14 days.</p>
      </div>
      <div class="emptyState">
        <h2 class="emptyStateTitle">No recent orders</h2>
        <p class="emptyStateText">You can leave feedback for orders made in the last 14 days. Make an order to leave feedback!</p>
        <a href="../Consumer Order/consumerOrder.html" class="primaryButton">Order Food</a>
      </div>
    `;
  }

  // Show all eligible orders but allow selection only for those without feedback
  const orderCardsHTML = eligibleOrders
    .map((order) => renderOrderCard(order))
    .join("");

  return `
    <div class="nowGivingSection">
      <span class="nowGivingLabel">Now Giving:</span>
      <span class="nowGivingTitle">Feedback</span>
    </div>
    ${renderProgressBar()}
    <div class="pageHeader">
      <h1 class="pageTitle">Select your experience</h1>
      <p class="pageHelper">Choose an order from the last 14 days.</p>
    </div>
    <div class="orderList">
      ${orderCardsHTML}
    </div>

    <div class="safetyNotice">
      ${getWarningIcon()}
      <span>Do not report food safety violations here. Approach the relevant authorities instead.</span>
    </div>

    <div class="buttonGroup">
      <button class="primaryButton" id="continueToRating" ${!selectedOrder ? "disabled" : ""}>Continue</button>
    </div>
  `;
}

// ============================================
// STEP 2: RATE EXPERIENCE
// ============================================

function renderStarRating() {
  let starsHTML = "";
  for (let i = 1; i <= 5; i++) {
    const filled = i <= feedbackData.rating;
    starsHTML += `
      <button class="starButton ${filled ? "filled" : "empty"}" data-rating="${i}">
        ${getStarIcon(filled)}
      </button>
    `;
  }
  return `<div class="starRating">${starsHTML}</div>`;
}

function renderQuickTags() {
  const tagsHTML = quickTags
    .map((tag) => {
      const isSelected = feedbackData.tags.includes(tag);
      return `<button class="quickTag ${isSelected ? "selected" : ""}" data-tag="${tag}">${tag}</button>`;
    })
    .join("");

  return `<div class="quickTags">${tagsHTML}</div>`;
}

function renderFeedbackHeader() {
  if (!selectedOrder) return "";
  const venueName =
    selectedOrder.collectionDetails?.venueName || selectedOrder.venueName || "";
  return `
    <div class="nowGivingSection">
      <span class="nowGivingLabel">Now Giving Feedback For:</span>
      <span class="nowGivingTitle">${selectedOrder.stallName}</span>
      <span class="nowGivingMeta">${venueName} &bull; ${formatDate(selectedOrder.date)}</span>
    </div>
  `;
}

function getTextareaPlaceholder() {
  if (feedbackData.rating <= 2) {
    return "That doesn't sound great... Tell us what happened, and we'll make sure to look into it.";
  } else if (feedbackData.rating >= 4) {
    return "Awesome! Tell us what you enjoyed so we can help improve everyone's experience.";
  }
  return "What went well? What could be better? Please keep it factual and respectful.";
}

// Track previous placeholder text for animation
let previousPlaceholder = "";
let typingAnimationId = null;

function animateTextareaPlaceholder(textarea, text, callback) {
  // Clear any existing animation
  if (typingAnimationId) {
    clearTimeout(typingAnimationId);
    typingAnimationId = null;
  }

  // Only animate if user hasn't typed anything
  if (textarea.value.trim() !== "") {
    textarea.placeholder = text;
    if (callback) callback();
    return;
  }

  let index = 0;
  textarea.placeholder = "";

  function typeNextChar() {
    if (index < text.length) {
      textarea.placeholder = text.substring(0, index + 1);
      index++;
      typingAnimationId = setTimeout(typeNextChar, 15); // 15ms per character
    } else {
      typingAnimationId = null;
      if (callback) callback();
    }
  }

  typeNextChar();
}

function renderRateExperience() {
  return `
    ${renderFeedbackHeader()}
    ${renderProgressBar()}
    <div class="pageHeader">
      <h1 class="pageTitle">How was your experience?</h1>
      <p class="pageHelper">Your feedback helps others make informed choices.</p>
    </div>

    <div class="ratingSection">
      ${renderStarRating()}
    </div>

    <div class="ratingSection">
      <h2 class="sectionHeader">Quick tags</h2>
      ${renderQuickTags()}
    </div>

    <div class="feedbackTextareaSection">
      <h2 class="sectionHeader">Tell us what happened</h2>
      <textarea
        class="feedbackTextarea"
        id="feedbackText"
        placeholder="${getTextareaPlaceholder()}"
        maxlength="1000"
      >${feedbackData.text}</textarea>
      <div class="textareaFooter">
        <span class="charCount"><span id="charCount">${feedbackData.text.length}</span>/1000</span>
        <span class="aiAnalysisNotice">
          <img src="../../assets/icons/hawkrAi.svg" alt="HawkrAI" class="aiNoticeIcon" />
          HawkrAI
          <span class="aiAnalysisTooltip">
            <img src="../../images/hawkrAILogo.svg" alt="HawkrAI" class="aiTooltipLogo" />
            <span class="aiTooltipText">Your feedback will be analyzed by AI to determine sentiment. AI may not always be accurate.</span>
            <span class="aiTooltipLinks">
              <a href="../HawkrAI/hawkrAI.html">Learn more</a>
              <span class="aiTooltipDivider">•</span>
              <a href="../Privacy/privacy.html">Privacy Policy</a>
            </span>
          </span>
        </span>
      </div>
    </div>

    <div class="inlineNotice">
      <span class="informationIcon">
        ${getInfoIcon()}
      </span>
      <span class="inlineNoticeText">
        Be fair and factual. We remove reviews that include personal attacks, hate, or unverified accusations.
        <a href="#" class="learnMoreLink">Learn more</a>
      </span>
    </div>

    <div class="safetyNotice">
      ${getWarningIcon()}
      <span>Do not report food safety violations here. Approach the relevant authorities instead.</span>
    </div>

    <div class="buttonGroup">
      <button class="secondaryButton" id="backToOrders">Back</button>
      <button class="primaryButton" id="continueToReview" ${feedbackData.rating === 0 ? "disabled" : ""}>Continue</button>
    </div>
  `;
}

// ============================================
// STEP 3: REVIEW & SUBMIT
// ============================================

function renderReviewSummary() {
  const starsHTML = Array(5)
    .fill(0)
    .map((_, i) => getStarIcon(i < feedbackData.rating))
    .join("");

  const tagsHTML =
    feedbackData.tags.length > 0
      ? feedbackData.tags
          .map((tag) => `<span class="reviewTag">${tag}</span>`)
          .join("")
      : '<span style="color: #808080;">None selected</span>';

  const textValue =
    feedbackData.text.trim() ||
    '<span style="color: #808080;">No additional comments</span>';

  const contactRow =
    feedbackData.rating <= 3 && feedbackData.contactMe
      ? `
      <div class="reviewSummaryRow">
        <span class="reviewSummaryLabel">Contact</span>
        <span class="reviewSummaryValue">Yes, contact me regarding my submission</span>
      </div>
      `
      : "";

  const venueName =
    selectedOrder?.collectionDetails?.venueName ||
    selectedOrder?.venueName ||
    "";

  return `
    <div class="reviewSummary">
      <div class="reviewSummaryRow">
        <span class="reviewSummaryLabel">Order</span>
        <span class="reviewSummaryValue">${selectedOrder.stallName}<br><span style="color: #595959; font-size: 14px;">${formatDate(selectedOrder.date)}</span></span>
      </div>
      <div class="reviewSummaryRow">
        <span class="reviewSummaryLabel">Rating</span>
        <div class="reviewStars">${starsHTML}</div>
      </div>
      <div class="reviewSummaryRow">
        <span class="reviewSummaryLabel">Tags</span>
        <div class="reviewTags">${tagsHTML}</div>
      </div>
      <div class="reviewSummaryRow">
        <span class="reviewSummaryLabel">Comments</span>
        <span class="reviewSummaryValue">${textValue}</span>
      </div>
      ${contactRow}
    </div>
  `;
}

function renderReviewSubmit() {
  return `
    ${renderFeedbackHeader()}
    ${renderProgressBar()}
    <div class="pageHeader">
      <h1 class="pageTitle">Review your feedback</h1>
    </div>

    ${renderReviewSummary()}

    <div class="contactToggleSection${feedbackData.rating > 3 || feedbackData.text.trim() === "" ? " disabled" : ""}">
      <label class="liquidGlassToggle">
        <input type="checkbox" id="contactMeToggle" ${feedbackData.contactMe ? "checked" : ""}${feedbackData.rating > 3 || feedbackData.text.trim() === "" ? " disabled" : ""}>
        <span class="toggleTrack">
          <span class="toggleThumb"></span>
        </span>
      </label>
      <span class="contactToggleLabel">Contact me regarding my submission</span>
      ${
        feedbackData.rating > 3 || feedbackData.text.trim() === ""
          ? `
      <span class="informationIcon">
        <img src="../../assets/icons/information.svg" alt="Info" />
        <span class="informationTooltip">To enable this option, please provide a rating of 3 stars or below and write feedback describing your experience.</span>
      </span>
      `
          : ""
      }
    </div>

    <label class="checkboxWrapper">
      <input type="checkbox" class="checkboxInput" id="confirmCheckbox" ${feedbackData.confirmed ? "checked" : ""}>
      <span class="checkboxLabel">I confirm this is my genuine experience and my review is accurate to the best of my knowledge.</span>
    </label>

    <div class="safetyNotice">
      ${getWarningIcon()}
      <span>Do not report food safety violations here. Approach the relevant authorities instead.</span>
    </div>

    <div class="buttonGroup">
      <button class="secondaryButton" id="editFeedback">Edit</button>
      <button class="primaryButton" id="submitFeedback" ${!feedbackData.confirmed ? "disabled" : ""}>Submit feedback</button>
    </div>
  `;
}

// ============================================
// STEP 4: SUCCESS
// ============================================

function renderSuccess() {
  return `
    <div class="successState">
      <div class="successIcon">
        ${getCheckIcon()}
      </div>
      <h1 class="successTitle">Thank you for your feedback!</h1>
      <p class="successText">Your review helps other customers make informed choices and helps stall owners improve their service.</p>
      <div class="buttonGroup">
        <button class="primaryButton" id="backToHome">Back to Home</button>
      </div>
    </div>
  `;
}

// ============================================
// MAIN RENDER FUNCTION
// ============================================

function renderFeedbackPage() {
  const container = document.getElementById("feedbackContent");
  if (!container) return;

  let content = "";

  switch (currentStep) {
    case 1:
      content = renderSelectOrder();
      break;
    case 2:
      content = renderRateExperience();
      // Initialize previous placeholder so first render doesn't animate
      previousPlaceholder = getTextareaPlaceholder();
      break;
    case 3:
      content = renderReviewSubmit();
      break;
    case 4:
      content = renderSuccess();
      break;
  }

  container.innerHTML = content;
  attachEventListeners();
}

// ============================================
// EVENT LISTENERS
// ============================================

function attachEventListeners() {
  // Step 1: Order selection
  const orderCards = document.querySelectorAll(".orderCard:not(.has-feedback)");
  orderCards.forEach((card) => {
    card.addEventListener("click", () => {
      const orderId = card.dataset.orderId;
      selectedOrder = recentOrders.find((o) => o.id === orderId);
      renderFeedbackPage();
    });
  });

  const continueToRating = document.getElementById("continueToRating");
  if (continueToRating) {
    continueToRating.addEventListener("click", () => {
      if (selectedOrder) {
        currentStep = 2;
        renderFeedbackPage();
      }
    });
  }

  // Step 2: Rating
  const starButtons = document.querySelectorAll(".starButton");
  starButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const newRating = parseInt(btn.dataset.rating);
      const oldRating = feedbackData.rating;
      feedbackData.rating = newRating;

      // Update star visuals without full re-render
      starButtons.forEach((starBtn) => {
        const starRating = parseInt(starBtn.dataset.rating);
        const isFilled = starRating <= newRating;
        starBtn.classList.toggle("filled", isFilled);
        starBtn.classList.toggle("empty", !isFilled);
        starBtn.innerHTML = getStarIcon(isFilled);
      });

      // Update continue button state
      const continueBtn = document.getElementById("continueToReview");
      if (continueBtn) {
        continueBtn.disabled = newRating === 0;
      }

      // Check if placeholder text changed and animate if so
      const newPlaceholder = getTextareaPlaceholder();
      if (newPlaceholder !== previousPlaceholder) {
        const textarea = document.getElementById("feedbackText");
        if (textarea) {
          animateTextareaPlaceholder(textarea, newPlaceholder);
        }
        previousPlaceholder = newPlaceholder;
      }
    });
  });

  const tagButtons = document.querySelectorAll(".quickTag");
  tagButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      if (feedbackData.tags.includes(tag)) {
        feedbackData.tags = feedbackData.tags.filter((t) => t !== tag);
      } else {
        feedbackData.tags.push(tag);
      }
      renderFeedbackPage();
    });
  });

  const feedbackText = document.getElementById("feedbackText");
  if (feedbackText) {
    feedbackText.addEventListener("input", (e) => {
      feedbackData.text = e.target.value;
      const charCount = document.getElementById("charCount");
      if (charCount) {
        charCount.textContent = feedbackData.text.length;
      }
    });
  }

  const contactMeToggle = document.getElementById("contactMeToggle");
  if (contactMeToggle) {
    const toggleLabel = contactMeToggle.closest(".liquidGlassToggle");
    if (toggleLabel) {
      initLiquidGlassToggle(toggleLabel, (isChecked) => {
        feedbackData.contactMe = isChecked;
      });
    }
  }

  const backToOrders = document.getElementById("backToOrders");
  if (backToOrders) {
    backToOrders.addEventListener("click", () => {
      currentStep = 1;
      renderFeedbackPage();
    });
  }

  const continueToReview = document.getElementById("continueToReview");
  if (continueToReview) {
    continueToReview.addEventListener("click", () => {
      if (feedbackData.rating > 0) {
        currentStep = 3;
        renderFeedbackPage();
      }
    });
  }

  // Step 3: Review & Submit
  const confirmCheckbox = document.getElementById("confirmCheckbox");
  if (confirmCheckbox) {
    confirmCheckbox.addEventListener("change", (e) => {
      feedbackData.confirmed = e.target.checked;
      const submitBtn = document.getElementById("submitFeedback");
      if (submitBtn) {
        submitBtn.disabled = !feedbackData.confirmed;
      }
    });
  }

  const editFeedback = document.getElementById("editFeedback");
  if (editFeedback) {
    editFeedback.addEventListener("click", () => {
      currentStep = 2;
      renderFeedbackPage();
    });
  }

  const submitFeedbackBtn = document.getElementById("submitFeedback");
  if (submitFeedbackBtn) {
    submitFeedbackBtn.addEventListener("click", async () => {
      if (feedbackData.confirmed && currentUser && selectedOrder) {
        submitFeedbackBtn.disabled = true;
        submitFeedbackBtn.textContent = "Submitting...";

        try {
          // Get customer name for the feedback
          let customerName = "Anonymous";
          try {
            const customer = await getCustomer(currentUser.uid);
            if (customer && customer.name) {
              customerName = customer.name;
            }
          } catch (e) {
            console.warn("Could not fetch customer name:", e);
          }

          // Submit feedback to Firebase
          await submitFeedback(currentUser.uid, {
            orderId: selectedOrder.id,
            stallId: selectedOrder.stallId,
            stallName: selectedOrder.stallName,
            venueName:
              selectedOrder.collectionDetails?.venueName ||
              selectedOrder.venueName ||
              "",
            rating: feedbackData.rating,
            tags: feedbackData.tags,
            text: feedbackData.text,
            contactMe: feedbackData.contactMe,
            customerName: customerName,
          });

          // Move to success step
          currentStep = 4;
          renderFeedbackPage();
        } catch (error) {
          console.error("Error submitting feedback:", error);
          alert("Failed to submit feedback. Please try again.");
          submitFeedbackBtn.disabled = false;
          submitFeedbackBtn.textContent = "Submit feedback";
        }
      }
    });
  }

  // Step 4: Success
  const backToHome = document.getElementById("backToHome");
  if (backToHome) {
    backToHome.addEventListener("click", () => {
      window.location.href = "../Consumer Dashboard/consumerDashboard.html";
    });
  }
}

// ============================================
// NAVIGATION HANDLERS
// ============================================

function handleBackClick() {
  if (currentStep > 1 && currentStep < 4) {
    currentStep--;
    renderFeedbackPage();
  } else if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "../Consumer Dashboard/consumerDashboard.html";
  }
}

// ============================================
// DATA FETCHING
// ============================================

async function fetchRecentOrders() {
  if (!currentUser) return [];

  try {
    isLoading = true;
    renderFeedbackPage();

    // Fetch orders from Firebase
    const orders = await getCustomerOrders(50);

    // Transform orders to include date and check for existing feedback
    const transformedOrders = await Promise.all(
      orders.map(async (order) => {
        const orderDate = order.createdAt?.toDate
          ? order.createdAt.toDate()
          : new Date(order.createdAt);

        // Check if feedback already exists
        const hasFeedback = await hasFeedbackForOrder(
          currentUser.uid,
          order.id,
        );

        return {
          ...order,
          date: orderDate,
          venueName: order.collectionDetails?.venueName || "",
          hasFeedback: hasFeedback,
        };
      }),
    );

    isLoading = false;
    return transformedOrders;
  } catch (error) {
    console.error("Error fetching orders:", error);
    isLoading = false;
    return [];
  }
}

// ============================================
// INITIALIZATION
// ============================================

async function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("order");

  if (orderId && recentOrders.length > 0) {
    // Pre-select the order if passed via URL
    selectedOrder = recentOrders.find((o) => o.id === orderId);
    if (selectedOrder && !selectedOrder.hasFeedback) {
      currentStep = 2; // Skip to rating step
    } else {
      selectedOrder = null; // Don't pre-select if already has feedback
    }
  }
}

async function initializePage() {
  if (!currentUser) {
    renderFeedbackPage();
    return;
  }

  recentOrders = await fetchRecentOrders();
  await checkUrlParams();
  renderFeedbackPage();
}

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();
  initMobileMenu();

  // Listen for auth state
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    await initializePage();
  });

  // Back button handler
  const backButton = document.getElementById("backButton");
  if (backButton) {
    backButton.addEventListener("click", handleBackClick);
  }

  // Search input focus shortcut
  const searchInput = document.getElementById("searchInput");

  document.addEventListener("keydown", function (e) {
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
