/**
 * Stripe Payment Service
 * Frontend integration with Stripe and Firebase Cloud Functions
 */

import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import app from "../config.js";

// Initialize Firebase Functions (Singapore region)
const functions = getFunctions(app, "asia-southeast1");

// Stripe publishable key (safe to expose in frontend)
const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51SuXLQE77w60iB5Z8YF9uxn4TSzcF8DTTsdQi5sSHHv50omsctehqAureVJOSi7x6JHmfO0MjBrO81Vv7En4NgRH0082zhUPEf";

// Stripe instance (loaded dynamically)
let stripeInstance = null;

/**
 * Load Stripe.js dynamically
 * @returns {Promise<object>} Stripe instance
 */
export async function loadStripe() {
  if (stripeInstance) {
    return stripeInstance;
  }

  // Load Stripe.js if not already loaded
  if (!window.Stripe) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  stripeInstance = window.Stripe(STRIPE_PUBLISHABLE_KEY);
  return stripeInstance;
}

/**
 * Create a SetupIntent for saving a new card
 * @returns {Promise<object>} { clientSecret, customerId }
 */
export async function createSetupIntent() {
  const createSetupIntentFn = httpsCallable(functions, "createSetupIntent");
  const result = await createSetupIntentFn();
  return result.data;
}

/**
 * Get saved payment methods for current user
 * @returns {Promise<array>} List of payment methods
 */
export async function getPaymentMethods() {
  const getPaymentMethodsFn = httpsCallable(functions, "getPaymentMethods");
  const result = await getPaymentMethodsFn();
  return result.data.paymentMethods;
}

/**
 * Delete a saved payment method
 * @param {string} paymentMethodId
 * @returns {Promise<object>}
 */
export async function deletePaymentMethod(paymentMethodId) {
  const deletePaymentMethodFn = httpsCallable(functions, "deletePaymentMethod");
  const result = await deletePaymentMethodFn({ paymentMethodId });
  return result.data;
}

/**
 * Set a payment method as default
 * @param {string} paymentMethodId
 * @returns {Promise<object>}
 */
export async function setDefaultPaymentMethod(paymentMethodId) {
  const setDefaultFn = httpsCallable(functions, "setDefaultPaymentMethod");
  const result = await setDefaultFn({ paymentMethodId });
  return result.data;
}

/**
 * Create a PaymentIntent for processing an order
 * @param {number} amount - Amount in dollars (e.g., 23.90)
 * @param {string} paymentMethodId - Optional payment method to charge
 * @param {string} orderId - Optional order ID for metadata
 * @returns {Promise<object>} { clientSecret, paymentIntentId, status }
 */
export async function createPaymentIntent(
  amount,
  paymentMethodId = null,
  orderId = null,
) {
  const createPaymentIntentFn = httpsCallable(functions, "createPaymentIntent");
  const result = await createPaymentIntentFn({
    amount,
    paymentMethodId,
    orderId,
  });
  return result.data;
}

/**
 * Confirm a payment with a specific payment method
 * @param {string} paymentIntentId
 * @param {string} paymentMethodId
 * @returns {Promise<object>}
 */
export async function confirmPayment(paymentIntentId, paymentMethodId) {
  const confirmPaymentFn = httpsCallable(functions, "confirmPayment");
  const result = await confirmPaymentFn({ paymentIntentId, paymentMethodId });
  return result.data;
}

/**
 * Get payment status
 * @param {string} paymentIntentId
 * @returns {Promise<object>}
 */
export async function getPaymentStatus(paymentIntentId) {
  const getStatusFn = httpsCallable(functions, "getPaymentStatus");
  const result = await getStatusFn({ paymentIntentId });
  return result.data;
}

/**
 * Get card brand icon path
 * @param {string} brand - Card brand (visa, mastercard, amex, etc.)
 * @returns {string} Icon path
 */
export function getCardIcon(brand) {
  const brandIcons = {
    visa: "../../Payment Methods/visaCard.svg",
    mastercard: "../../Payment Methods/masterCardCard.svg",
    amex: "../../Payment Methods/americanExpressCard.svg",
    unionpay: "../../Payment Methods/unionPayCard.svg",
    discover: "../../Payment Methods/visaCard.svg", // fallback
    diners: "../../Payment Methods/visaCard.svg", // fallback
    jcb: "../../Payment Methods/visaCard.svg", // fallback
  };

  return (
    brandIcons[brand.toLowerCase()] || "../../Payment Methods/visaCard.svg"
  );
}

/**
 * Create Stripe Elements card input
 * @param {object} stripe - Stripe instance
 * @param {string} elementId - DOM element ID to mount card input
 * @returns {object} Stripe card element
 */
export function createCardElement(stripe, elementId) {
  const elements = stripe.elements({
    fonts: [
      {
        cssSrc:
          "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap",
      },
    ],
  });

  const cardElement = elements.create("card", {
    style: {
      base: {
        fontSize: "16px",
        fontFamily: "Aptos, Inter, system-ui, sans-serif",
        color: "#341539",
        "::placeholder": {
          color: "#808080",
        },
      },
      invalid: {
        color: "#eb001b",
        iconColor: "#eb001b",
      },
    },
    hidePostalCode: true,
  });

  cardElement.mount(`#${elementId}`);

  return cardElement;
}

/**
 * Save a new card using SetupIntent
 * @param {object} stripe - Stripe instance
 * @param {object} cardElement - Stripe card element
 * @param {string} clientSecret - SetupIntent client secret
 * @returns {Promise<object>} Result with paymentMethod or error
 */
export async function saveCard(stripe, cardElement, clientSecret) {
  const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
    payment_method: {
      card: cardElement,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    paymentMethodId: setupIntent.payment_method,
  };
}

/**
 * Process payment using saved card
 * @param {object} stripe - Stripe instance
 * @param {string} clientSecret - PaymentIntent client secret
 * @param {string} paymentMethodId - Saved payment method ID
 * @returns {Promise<object>} Result with paymentIntent or error
 */
export async function processPayment(stripe, clientSecret, paymentMethodId) {
  try {
    console.log("processPayment called with:", {
      clientSecret: clientSecret?.substring(0, 20) + "...",
      paymentMethodId,
    });

    const { paymentIntent, error } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: paymentMethodId,
      },
    );

    console.log("confirmCardPayment result:", {
      paymentIntent: paymentIntent
        ? { id: paymentIntent.id, status: paymentIntent.status }
        : null,
      error: error
        ? { type: error.type, code: error.code, message: error.message }
        : null,
    });

    if (error) {
      console.log("Payment error detected:", error.message);
      return { success: false, error: error.message };
    }

    // Check if payment was cancelled or failed
    if (paymentIntent.status === "canceled") {
      return { success: false, error: "Payment was cancelled" };
    }

    if (paymentIntent.status === "requires_payment_method") {
      return {
        success: false,
        error: "Payment authentication failed. Please try again.",
      };
    }

    if (paymentIntent.status === "requires_action") {
      return {
        success: false,
        error: "Payment authentication was not completed",
      };
    }

    // Only consider succeeded as successful
    if (paymentIntent.status !== "succeeded") {
      return {
        success: false,
        error: `Payment failed with status: ${paymentIntent.status}`,
      };
    }

    return {
      success: true,
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
    };
  } catch (err) {
    console.error("Payment processing error:", err);
    return { success: false, error: err.message || "Payment failed" };
  }
}

/**
 * Process payment with new card (card element)
 * @param {object} stripe - Stripe instance
 * @param {string} clientSecret - PaymentIntent client secret
 * @param {object} cardElement - Stripe card element
 * @returns {Promise<object>} Result with paymentIntent or error
 */
export async function processPaymentWithNewCard(
  stripe,
  clientSecret,
  cardElement,
) {
  try {
    const { paymentIntent, error } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardElement,
        },
      },
    );

    if (error) {
      return { success: false, error: error.message };
    }

    // Check if payment was cancelled or failed
    if (paymentIntent.status === "canceled") {
      return { success: false, error: "Payment was cancelled" };
    }

    if (paymentIntent.status === "requires_payment_method") {
      return {
        success: false,
        error: "Payment authentication failed. Please try again.",
      };
    }

    if (paymentIntent.status === "requires_action") {
      return {
        success: false,
        error: "Payment authentication was not completed",
      };
    }

    // Only consider succeeded as successful
    if (paymentIntent.status !== "succeeded") {
      return {
        success: false,
        error: `Payment failed with status: ${paymentIntent.status}`,
      };
    }

    return {
      success: true,
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
    };
  } catch (err) {
    console.error("Payment processing error:", err);
    return { success: false, error: err.message || "Payment failed" };
  }
}

/**
 * Create a Payment Request (Apple Pay / Google Pay)
 * @param {object} stripe - Stripe instance
 * @param {number} amount - Amount in dollars
 * @param {string} currency - Currency code
 * @param {string} label - Display label for the payment
 * @returns {Promise<object>} Payment request object and availability
 */
export async function createPaymentRequest(
  stripe,
  amount,
  currency = "sgd",
  label = "Hawkr Order",
) {
  const paymentRequest = stripe.paymentRequest({
    country: "SG",
    currency: currency.toLowerCase(),
    total: {
      label: label,
      amount: Math.round(amount * 100),
    },
    requestPayerName: true,
    requestPayerEmail: true,
  });

  const result = await paymentRequest.canMakePayment();

  return {
    paymentRequest,
    canMakePayment: result,
    applePay: result?.applePay || false,
    googlePay: result?.googlePay || false,
  };
}

/**
 * Mount Payment Request Button (Apple Pay / Google Pay)
 * @param {object} stripe - Stripe instance
 * @param {object} paymentRequest - Payment request object
 * @param {string} elementId - DOM element ID to mount button
 * @returns {object} Payment request button element
 */
export function mountPaymentRequestButton(stripe, paymentRequest, elementId) {
  const elements = stripe.elements();
  const prButton = elements.create("paymentRequestButton", {
    paymentRequest: paymentRequest,
    style: {
      paymentRequestButton: {
        type: "default",
        theme: "dark",
        height: "60px",
      },
    },
  });

  prButton.mount(`#${elementId}`);
  return prButton;
}

/**
 * Process GrabPay payment
 * @param {object} stripe - Stripe instance
 * @param {string} clientSecret - PaymentIntent client secret
 * @param {string} returnUrl - URL to redirect after payment
 * @returns {Promise<object>} Result with redirect or error
 */
export async function processGrabPayPayment(stripe, clientSecret, returnUrl) {
  try {
    const { error } = await stripe.confirmPayment({
      clientSecret,
      confirmParams: {
        payment_method_data: {
          type: "grabpay",
        },
        return_url: returnUrl,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // If no error, user will be redirected to GrabPay
    return { success: true, redirected: true };
  } catch (err) {
    console.error("GrabPay payment error:", err);
    return { success: false, error: err.message || "GrabPay payment failed" };
  }
}

/**
 * Process PayNow payment (generates QR code)
 * @param {object} stripe - Stripe instance
 * @param {string} clientSecret - PaymentIntent client secret
 * @returns {Promise<object>} Result with next action or error
 */
export async function processPayNowPayment(stripe, clientSecret) {
  try {
    // Store pending PayNow payment info in localStorage before confirming
    // This allows us to recover if Stripe redirects
    const paymentIntentId = clientSecret.split("_secret_")[0];
    localStorage.setItem("hawkrPendingPayNowIntent", paymentIntentId);

    // Use confirmPayment with paynow payment method type
    const { paymentIntent, error } = await stripe.confirmPayment({
      clientSecret,
      confirmParams: {
        payment_method_data: {
          type: "paynow",
        },
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // PayNow returns a QR code in next_action
    if (paymentIntent?.next_action?.paynow_display_qr_code) {
      return {
        success: true,
        qrCode: paymentIntent.next_action.paynow_display_qr_code,
        paymentIntentId: paymentIntent.id,
      };
    }

    // Check if already succeeded
    if (paymentIntent?.status === "succeeded") {
      return {
        success: true,
        status: paymentIntent.status,
        paymentIntentId: paymentIntent.id,
      };
    }

    return {
      success: true,
      status: paymentIntent?.status || "unknown",
      paymentIntentId: paymentIntent?.id,
    };
  } catch (err) {
    console.error("PayNow payment error:", err);
    return { success: false, error: err.message || "PayNow payment failed" };
  }
}

/**
 * Initiate a refund for an order
 * @param {string} orderId - Firestore order document ID
 * @param {string} refundType - "full" or "partial"
 * @param {number} refundAmount - Amount for partial refund (in dollars)
 * @param {string} reason - Optional refund reason
 * @returns {Promise<object>} { success, refundId, refundStatus, refundAmount, refundTransactionId }
 */
export async function initiateRefund(
  orderId,
  refundType = "full",
  refundAmount = 0,
  reason = "",
) {
  const initiateRefundFn = httpsCallable(functions, "initiateRefund");
  const result = await initiateRefundFn({
    orderId,
    refundType,
    refundAmount,
    reason,
  });
  return result.data;
}

/**
 * Process AliPay payment (redirect-based)
 */
export async function processAliPayPayment(stripe, clientSecret, returnUrl) {
  try {
    const { paymentIntent, error } = await stripe.confirmAlipayPayment(
      clientSecret,
      {
        return_url: returnUrl,
      },
    );

    if (error) {
      return { success: false, error: error.message };
    }

    // If we get here without redirect, payment might already be processing
    return {
      success: true,
      status: paymentIntent?.status || "processing",
      paymentIntentId: paymentIntent?.id,
    };
  } catch (err) {
    console.error("AliPay payment error:", err);
    return { success: false, error: err.message || "AliPay payment failed" };
  }
}
