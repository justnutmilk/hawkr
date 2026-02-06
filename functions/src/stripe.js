/**
 * Stripe Payment Helper
 * Handles Stripe API interactions for payments
 */

const Stripe = require("stripe");

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a Stripe customer
 * @param {string} email - Customer email
 * @param {string} name - Customer name
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} Stripe customer object
 */
async function createCustomer(email, name, metadata = {}) {
  return await stripe.customers.create({
    email,
    name,
    metadata,
  });
}

/**
 * Get or create a Stripe customer for a Firebase user
 * @param {object} admin - Firebase admin instance
 * @param {string} userId - Firebase user ID
 * @param {string} email - User email
 * @param {string} name - User name
 * @returns {Promise<string>} Stripe customer ID
 */
async function getOrCreateStripeCustomer(admin, userId, email, name) {
  const customerDoc = await admin
    .firestore()
    .collection("customers")
    .doc(userId)
    .get();

  const customerData = customerDoc.data();

  if (customerData?.stripeCustomerId) {
    return customerData.stripeCustomerId;
  }

  // Create new Stripe customer
  const stripeCustomer = await createCustomer(email, name, {
    firebaseUserId: userId,
  });

  // Save Stripe customer ID to Firestore
  await admin.firestore().collection("customers").doc(userId).update({
    stripeCustomerId: stripeCustomer.id,
  });

  return stripeCustomer.id;
}

/**
 * Create a SetupIntent for saving a payment method
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<object>} SetupIntent with client secret
 */
async function createSetupIntent(customerId) {
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
  });

  return {
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
  };
}

/**
 * Create a PaymentIntent for processing a payment
 * @param {number} amount - Amount in cents
 * @param {string} currency - Currency code (default: sgd)
 * @param {string} customerId - Stripe customer ID
 * @param {string} paymentMethodId - Payment method ID (optional)
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} PaymentIntent with client secret
 */
async function createPaymentIntent(
  amount,
  currency = "sgd",
  customerId,
  paymentMethodId = null,
  metadata = {},
) {
  const params = {
    amount: Math.round(amount), // Ensure integer
    currency,
    customer: customerId,
    metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  };

  if (paymentMethodId) {
    params.payment_method = paymentMethodId;
    params.confirm = true;
    params.return_url =
      metadata.returnUrl || "https://hawkr.app/order-complete";
  }

  const paymentIntent = await stripe.paymentIntents.create(params);

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
  };
}

/**
 * Get saved payment methods for a customer
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<array>} List of payment methods
 */
async function getPaymentMethods(customerId) {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });

  return paymentMethods.data.map((pm) => ({
    id: pm.id,
    type: "card",
    brand: pm.card.brand,
    lastFour: pm.card.last4,
    expMonth: pm.card.exp_month,
    expYear: pm.card.exp_year,
  }));
}

/**
 * Set a payment method as default for a customer
 * @param {string} customerId - Stripe customer ID
 * @param {string} paymentMethodId - Payment method ID
 */
async function setDefaultPaymentMethod(customerId, paymentMethodId) {
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

/**
 * Delete a payment method
 * @param {string} paymentMethodId - Payment method ID
 */
async function deletePaymentMethod(paymentMethodId) {
  await stripe.paymentMethods.detach(paymentMethodId);
}

/**
 * Confirm a PaymentIntent (for server-side confirmation)
 * @param {string} paymentIntentId - Payment intent ID
 * @param {string} paymentMethodId - Payment method ID
 * @returns {Promise<object>} Updated PaymentIntent
 */
async function confirmPaymentIntent(paymentIntentId, paymentMethodId) {
  const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethodId,
  });

  return {
    status: paymentIntent.status,
    paymentIntentId: paymentIntent.id,
  };
}

/**
 * Get PaymentIntent status
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<object>} PaymentIntent status info
 */
async function getPaymentIntentStatus(paymentIntentId) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  return {
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  };
}

/**
 * Create a refund for a payment intent
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @param {number} amount - Amount in cents (optional, full refund if not specified)
 * @param {string} reason - Refund reason: "duplicate", "fraudulent", or "requested_by_customer"
 * @returns {Promise<object>} Stripe refund object
 */
async function createRefund(
  paymentIntentId,
  amount = null,
  reason = "requested_by_customer",
) {
  const params = {
    payment_intent: paymentIntentId,
    reason: reason,
    metadata: {
      source: "hawkr_feedback_resolution",
    },
  };

  if (amount !== null) {
    params.amount = Math.round(amount); // Amount in cents
  }

  const refund = await stripe.refunds.create(params);

  return {
    id: refund.id,
    status: refund.status,
    amount: refund.amount,
    currency: refund.currency,
  };
}

/**
 * Get refund status
 * @param {string} refundId - Stripe refund ID
 * @returns {Promise<object>} Refund status info
 */
async function getRefundStatus(refundId) {
  const refund = await stripe.refunds.retrieve(refundId);

  return {
    id: refund.id,
    status: refund.status,
    amount: refund.amount,
    currency: refund.currency,
  };
}

module.exports = {
  stripe,
  createCustomer,
  getOrCreateStripeCustomer,
  createSetupIntent,
  createPaymentIntent,
  getPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
  confirmPaymentIntent,
  getPaymentIntentStatus,
  createRefund,
  getRefundStatus,
};
