/**
 * Hawkr - Firebase Services Index
 * Central export point for all Firebase services
 *
 * Usage:
 * import { auth, feedback, orders, foodStalls, hawkerCentres, customers } from './firebase/services/index.js';
 */

// Re-export all services as namespaced modules
export * as auth from "./auth.js";
export * as feedback from "./feedback.js";
export * as orders from "./orders.js";
export * as foodStalls from "./foodStalls.js";
export * as hawkerCentres from "./hawkerCentres.js";
export * as customers from "./customers.js";
export * as disruptor from "./disruptor.js";

// Also export the Firebase instances for direct access if needed
export { db, auth as firebaseAuth } from "../config.js";
