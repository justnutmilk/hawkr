import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";
import { initLiquidGlassToggle } from "../../assets/js/liquidGlassToggle.js";
import { auth, db } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  resolveFeedbackWithResponse,
  getOrderForFeedback,
} from "../../firebase/services/feedback.js";

// State
let reviews = [];
let currentStallId = null;
let isLoading = true;

// Modal state
let selectedReviewId = null;
let selectedReviewData = null;
let orderData = null;

function renderStars(rating) {
  const filled = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#913b9f"><path d="M8 1.23l2.12 4.3 4.74.69-3.43 3.34.81 4.72L8 11.77l-4.24 2.51.81-4.72L1.14 6.22l4.74-.69L8 1.23z"/></svg>`;
  const empty = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#d0cad6"><path d="M8 1.23l2.12 4.3 4.74.69-3.43 3.34.81 4.72L8 11.77l-4.24 2.51.81-4.72L1.14 6.22l4.74-.69L8 1.23z"/></svg>`;
  let html = "";
  for (let i = 0; i < 5; i++) {
    html += i < rating ? filled : empty;
  }
  return html;
}

function getSentimentTag(sentiment) {
  const sentimentConfig = {
    positive: { label: "Positive", className: "sentimentPositive" },
    negative: { label: "Negative", className: "sentimentNegative" },
    neutral: { label: "Neutral", className: "sentimentNeutral" },
  };
  const config = sentimentConfig[sentiment] || sentimentConfig.neutral;
  return `<span class="sentimentTag ${config.className}">
    <img src="../../assets/icons/hawkrAi.svg" alt="HawkrAI" class="sentimentAiIcon" />
    ${config.label}
    <span class="sentimentTooltip">
      <img src="../../images/hawkrAILogo.svg" alt="HawkrAI" class="sentimentTooltipLogo" />
      AI may not always be accurate. Use with discretion.
    </span>
  </span>`;
}

function formatTimeAgo(date) {
  if (!date) return "";
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 60) return "1 month ago";
  return `${Math.floor(diffDays / 30)} months ago`;
}

function renderReviewCard(review, index) {
  const resolveButton =
    review.status === "new"
      ? `<button class="reviewResolveButton" data-index="${index}" data-id="${review.id}" title="Resolve review">
        <img src="../../assets/icons/resolveReview.svg" alt="Resolve" />
      </button>`
      : "";

  const sentimentTag = review.sentiment
    ? getSentimentTag(review.sentiment)
    : "";

  const title =
    review.title ||
    (review.tags && review.tags.length > 0 ? review.tags[0] : "Review");
  const timeAgo = formatTimeAgo(review.createdAt);

  return `
    <div class="reviewCard">
      ${resolveButton}
      <div class="reviewHeader">
        <span class="reviewTitle">${title}</span>
        ${sentimentTag}
      </div>
      <span class="reviewText">${review.text || "No comment provided."}</span>
      <div class="reviewMeta">
        <div class="reviewStars">${renderStars(review.rating)}</div>
        <span class="reviewInfo">${timeAgo} &bull; By ${review.customerName || "Anonymous"}</span>
      </div>
    </div>
  `;
}

function renderReviews(tab) {
  const container = document.getElementById("reviewsContent");

  if (isLoading) {
    container.innerHTML = `<div class="loadingState">Loading reviews...</div>`;
    return;
  }

  const filtered = reviews.filter((review) => review.status === tab);

  if (filtered.length === 0) {
    container.innerHTML = `<span style="color: #595959; font-family: 'Geist Mono', monospace; font-size: 16px;">No ${tab} reviews.</span>`;
    return;
  }

  container.innerHTML = filtered
    .map((review, index) => renderReviewCard(review, index))
    .join("");

  container
    .querySelectorAll(".reviewResolveButton[data-id]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const reviewId = button.dataset.id;
        openResolveModal(reviewId);
      });
    });
}

// ============================================
// RESOLVE MODAL FUNCTIONS
// ============================================

function openResolveModal(reviewId) {
  selectedReviewId = reviewId;
  selectedReviewData = reviews.find((r) => r.id === reviewId);

  if (!selectedReviewData) return;

  // Populate review summary
  populateReviewSummary(selectedReviewData);

  // Load order data if available
  if (selectedReviewData.orderId) {
    loadOrderData(selectedReviewData.orderId);
  } else {
    document.getElementById("resolveRefundSection").hidden = true;
    document.getElementById("resolveOrderInfo").hidden = true;
  }

  // Show modal
  document.getElementById("resolveModal").hidden = false;
}

function populateReviewSummary(review) {
  const summaryContainer = document.getElementById("resolveReviewSummary");
  summaryContainer.innerHTML = `
    <span class="resolveCustomerName">${review.customerName || "Anonymous"}</span>
    <div class="resolveReviewStars">${renderStars(review.rating)}</div>
    <span class="resolveReviewText">${review.text || "No comment provided."}</span>
  `;
}

async function loadOrderData(orderId) {
  try {
    orderData = await getOrderForFeedback(orderId);

    if (orderData && orderData.paymentIntentId) {
      document.getElementById("resolveOrderInfo").hidden = false;
      document.getElementById("resolveRefundSection").hidden = false;
      document.getElementById("resolveOrderId").textContent =
        orderData.hawkrTransactionId || `#${orderId.slice(-6).toUpperCase()}`;
      document.getElementById("resolveOrderAmount").textContent =
        `$${orderData.total.toFixed(2)}`;
      document.getElementById("fullRefundAmount").textContent =
        `$${orderData.total.toFixed(2)}`;
    } else {
      document.getElementById("resolveOrderInfo").hidden = true;
      document.getElementById("resolveRefundSection").hidden = true;
    }
  } catch (error) {
    console.error("Error loading order data:", error);
    document.getElementById("resolveOrderInfo").hidden = true;
    document.getElementById("resolveRefundSection").hidden = true;
  }
}

function closeResolveModal() {
  document.getElementById("resolveModal").hidden = true;
  document.getElementById("resolveResponseText").value = "";
  document.getElementById("resolveCharCount").textContent = "0";

  // Reset refund options
  const includeRefundCheckbox = document.getElementById("includeRefund");
  if (includeRefundCheckbox) {
    includeRefundCheckbox.checked = false;
    document.getElementById("resolveRefundOptions").hidden = true;
  }

  const fullRefundRadio = document.querySelector(
    'input[name="refundType"][value="full"]',
  );
  if (fullRefundRadio) fullRefundRadio.checked = true;

  document.getElementById("resolvePartialAmount").hidden = true;
  const partialAmountInput = document.getElementById("partialRefundAmount");
  if (partialAmountInput) partialAmountInput.value = "";

  selectedReviewId = null;
  selectedReviewData = null;
  orderData = null;
}

async function handleResolveSubmit() {
  const response = document.getElementById("resolveResponseText").value.trim();

  if (!response) {
    alert("Please enter a response message");
    return;
  }

  const includeRefund =
    document.getElementById("includeRefund")?.checked || false;
  let refundType = "none";
  let refundAmount = 0;

  if (includeRefund && orderData) {
    refundType = document.querySelector(
      'input[name="refundType"]:checked',
    ).value;
    if (refundType === "partial") {
      refundAmount =
        parseFloat(document.getElementById("partialRefundAmount").value) || 0;
      if (refundAmount <= 0 || refundAmount > orderData.total) {
        alert("Please enter a valid refund amount");
        return;
      }
    }
  }

  const submitButton = document.getElementById("submitResolve");
  try {
    submitButton.disabled = true;
    submitButton.textContent = "Processing...";

    await resolveFeedbackWithResponse(
      selectedReviewId,
      response,
      refundType,
      refundAmount,
    );

    // Update local state
    const review = reviews.find((r) => r.id === selectedReviewId);
    if (review) {
      review.status = "resolved";
    }

    // Close modal and refresh
    closeResolveModal();
    renderReviews(currentTab);

    // Show success message
    showToast(
      "Feedback resolved successfully" +
        (refundType !== "none" ? `. Refund initiated.` : ""),
    );
  } catch (error) {
    console.error("Error resolving feedback:", error);
    alert("Failed to resolve feedback: " + (error.message || "Unknown error"));
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Resolve Feedback";
  }
}

function showToast(message) {
  // Simple toast notification
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #341539;
    color: #fff;
    padding: 12px 24px;
    border-radius: 8px;
    font-family: Aptos, sans-serif;
    font-size: 14px;
    z-index: 2000;
    animation: fadeIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function initModalEventListeners() {
  // Close modal handlers
  document
    .getElementById("closeResolveModal")
    .addEventListener("click", closeResolveModal);
  document
    .getElementById("cancelResolve")
    .addEventListener("click", closeResolveModal);

  // Close on overlay click
  document.getElementById("resolveModal").addEventListener("click", (e) => {
    if (e.target.id === "resolveModal") {
      closeResolveModal();
    }
  });

  // Submit handler
  document
    .getElementById("submitResolve")
    .addEventListener("click", handleResolveSubmit);

  // Character count for textarea
  const responseTextarea = document.getElementById("resolveResponseText");
  responseTextarea.addEventListener("input", () => {
    document.getElementById("resolveCharCount").textContent =
      responseTextarea.value.length;
  });

  // Refund toggle (liquid glass)
  const refundToggleLabel = document.querySelector(
    "#resolveRefundSection .liquidGlassToggle",
  );
  if (refundToggleLabel) {
    initLiquidGlassToggle(refundToggleLabel, (isChecked) => {
      document.getElementById("resolveRefundOptions").hidden = !isChecked;
    });
  }

  // Refund type radio buttons
  document.querySelectorAll('input[name="refundType"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      document.getElementById("resolvePartialAmount").hidden =
        radio.value !== "partial";
    });
  });

  // Escape key to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("resolveModal").hidden) {
      closeResolveModal();
    }
  });
}

async function loadVendorData(userId) {
  try {
    // Get vendor profile to find their stall ID
    const vendorDoc = await getDoc(doc(db, "vendors", userId));
    if (!vendorDoc.exists()) {
      console.error("Vendor profile not found");
      isLoading = false;
      renderReviews(currentTab);
      return;
    }

    const vendorData = vendorDoc.data();
    currentStallId = vendorData.stallId;

    if (!currentStallId) {
      console.error("No stall associated with this vendor");
      isLoading = false;
      renderReviews(currentTab);
      return;
    }

    // Load reviews for this stall
    await loadReviews(currentStallId);
  } catch (error) {
    console.error("Error loading vendor data:", error);
    isLoading = false;
    renderReviews(currentTab);
  }
}

async function loadReviews(stallId) {
  try {
    const feedbackQuery = query(
      collection(db, "feedback"),
      where("stallId", "==", stallId),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(feedbackQuery);

    reviews = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();

      return {
        id: doc.id,
        title: data.title || null,
        text: data.text || data.comment || "",
        rating: data.rating || 0,
        customerName: data.customerName || "Anonymous",
        createdAt: createdAt,
        status: data.stallResponse ? "resolved" : "new",
        sentiment: data.sentiment || null,
        tags: data.tags || [],
        contactMe: data.contactMe || false,
        orderId: data.orderId || null,
      };
    });

    isLoading = false;
    renderReviews(currentTab);
  } catch (error) {
    console.error("Error loading reviews:", error);
    isLoading = false;
    reviews = [];

    // Check if it's an index error
    if (error.message && error.message.includes("index")) {
      const container = document.getElementById("reviewsContent");
      container.innerHTML = `<div class="loadingState" style="flex-direction: column; gap: 8px;">
        <span style="font-weight: 600;">Index Required</span>
        <span>Please create the required Firebase index. Check the console for the link.</span>
      </div>`;
      return;
    }

    renderReviews(currentTab);
  }
}

let currentTab = "new";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize vendor navbar (handles auth, vendor name, logout, keyboard shortcuts)
  initVendorNavbar();

  // Initialize modal event listeners
  initModalEventListeners();

  // Check auth state and load reviews
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await loadVendorData(user.uid);
    } else {
      isLoading = false;
      renderReviews(currentTab);
    }
  });

  document.querySelectorAll('input[name="reviewTab"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      currentTab = radio.value;
      renderReviews(currentTab);
    });
  });
});
