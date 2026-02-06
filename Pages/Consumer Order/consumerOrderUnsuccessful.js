// ============================================
// IMPORTS
// ============================================

import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";
import { injectMobileMenu } from "../../assets/js/mobileMenu.js";

// ============================================
// PAGE INITIALIZATION
// ============================================

function getErrorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    error: params.get("error") || "Payment could not be processed",
    paymentMethod: params.get("method") || null,
  };
}

function renderUnsuccessfulPage() {
  const container = document.getElementById("unsuccessfulContent");
  if (!container) return;

  const { error, paymentMethod } = getErrorFromUrl();

  // Format error message for display
  let displayError = error;
  if (error.includes("card_declined")) {
    displayError =
      "Your card was declined. Please try a different payment method.";
  } else if (error.includes("insufficient_funds")) {
    displayError = "Insufficient funds. Please try a different card.";
  } else if (error.includes("expired_card")) {
    displayError = "Your card has expired. Please use a different card.";
  } else if (error.includes("processing_error")) {
    displayError =
      "There was an error processing your payment. Please try again.";
  }

  container.innerHTML = `
    <img
      src="../../images/squirrelOrderUnsuccessful.svg"
      alt="Payment failed"
      class="unsuccessfulImage"
    />

    <div class="unsuccessfulTextGroup">
      <h1 class="unsuccessfulTitle">Payment Unsuccessful</h1>
      <p class="unsuccessfulDescription">
        We couldn't complete your payment. Don't worry, your cart items are still saved.
        Please try again or use a different payment method.
      </p>
    </div>

    <div class="errorMessage">
      <svg class="errorIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>${displayError}</span>
    </div>

    <div class="unsuccessfulActions">
      <a href="consumerCart.html" class="tryAgainButton">
        <svg class="tryAgainIcon" xmlns="http://www.w3.org/2000/svg" width="225" height="225" viewBox="0 0 225 225" fill="none">
          <path d="M14.6367 165.643C14.6367 160.72 18.6266 156.73 23.5488 156.729H70.8506C75.7728 156.73 79.7627 160.72 79.7627 165.643C79.7626 170.565 75.7727 174.555 70.8506 174.555H44.9131C61.9893 193.069 86.1757 204.031 112.239 204.031C160.874 204.031 200.961 166.018 203.693 117.688C203.971 112.774 208.181 109.016 213.095 109.294C218.009 109.572 221.768 113.781 221.49 118.695C218.225 176.453 170.338 221.856 112.239 221.856C81.4387 221.856 52.8173 209.024 32.4619 187.337V212.943C32.4619 217.866 28.4712 221.856 23.5488 221.856C18.6266 221.856 14.6367 217.866 14.6367 212.943L14.6367 165.643ZM3.0166 105.666C6.52907 48.125 54.3246 3 112.239 3C143.038 3.00005 171.66 15.8309 192.017 37.5205V11.9131C192.017 6.99091 196.007 3.00024 200.929 3C205.851 3 209.842 6.99075 209.842 11.9131V59.2139C209.842 64.1362 205.851 68.127 200.929 68.127H153.628C148.706 68.127 144.715 64.1362 144.715 59.2139C144.715 54.2917 148.706 50.3018 153.628 50.3018H179.563C162.486 31.7867 138.301 20.8252 112.239 20.8252C63.759 20.8252 23.7477 58.605 20.8086 106.752C20.5087 111.665 16.2832 115.405 11.3701 115.105C6.45693 114.806 2.71669 110.579 3.0166 105.666Z" fill="currentColor" stroke="currentColor" stroke-width="6"/>
        </svg>
        Try Again
      </a>
      <a href="../Consumer Dashboard/consumerDashboard.html" class="backToHomeButton">
        Back to Home
      </a>
    </div>
  `;
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar
  initConsumerNavbar();
  injectMobileMenu();

  // Render the page
  renderUnsuccessfulPage();

  // Back button handler
  const backButton = document.getElementById("backButton");
  if (backButton) {
    backButton.addEventListener("click", function () {
      window.location.href = "consumerCart.html";
    });
  }
});
