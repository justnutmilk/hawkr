/**
 * Hawkr - Vouchers Service
 * Handles all voucher/promo code Firestore operations
 */

import { db, auth } from "../config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// VENDOR OPERATIONS (Create / Manage Vouchers)
// ============================================

/**
 * Create a new voucher for a stall
 * @param {string} stallId - The stall ID
 * @param {Object} voucherData - Voucher details
 * @returns {string} - Created voucher document ID
 */
export async function createVoucher(stallId, voucherData) {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in");

  const voucherRef = await addDoc(collection(db, "vouchers"), {
    stallId: stallId,
    vendorId: user.uid,
    code: voucherData.code.toUpperCase().trim(),
    type: voucherData.type, // "percentage" or "fixed"
    value: parseFloat(voucherData.value),
    minOrderAmount: parseFloat(voucherData.minOrderAmount) || 0,
    maxDiscount: parseFloat(voucherData.maxDiscount) || null,
    usageLimit: parseInt(voucherData.usageLimit) || null,
    usagePerUser: parseInt(voucherData.usagePerUser) || 1,
    usedCount: 0,
    isActive: true,
    expiryDate: voucherData.expiryDate || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return voucherRef.id;
}

/**
 * Get all vouchers for a stall
 * @param {string} stallId - The stall ID
 * @returns {Array} - Array of voucher objects
 */
export async function getStallVouchers(stallId) {
  const q = query(
    collection(db, "vouchers"),
    where("stallId", "==", stallId),
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Check if a voucher code already exists for a stall
 * @param {string} stallId - The stall ID
 * @param {string} code - The voucher code to check
 * @param {string|null} excludeVoucherId - Voucher ID to exclude (for edit mode)
 * @returns {boolean} - True if code already exists
 */
export async function checkVoucherCodeExists(
  stallId,
  code,
  excludeVoucherId = null,
) {
  const q = query(
    collection(db, "vouchers"),
    where("stallId", "==", stallId),
    where("code", "==", code.toUpperCase().trim()),
    limit(1),
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return false;

  // If editing, exclude the current voucher
  if (excludeVoucherId) {
    return snapshot.docs.some((doc) => doc.id !== excludeVoucherId);
  }

  return true;
}

/**
 * Update a voucher
 * @param {string} voucherId - Voucher document ID
 * @param {Object} updates - Fields to update
 */
export async function updateVoucher(voucherId, updates) {
  await updateDoc(doc(db, "vouchers", voucherId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a voucher
 * @param {string} voucherId - Voucher document ID
 */
export async function deleteVoucher(voucherId) {
  await deleteDoc(doc(db, "vouchers", voucherId));
}

/**
 * Toggle voucher active state
 * @param {string} voucherId - Voucher document ID
 * @param {boolean} isActive - New active state
 */
export async function toggleVoucher(voucherId, isActive) {
  await updateDoc(doc(db, "vouchers", voucherId), {
    isActive: isActive,
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// CONSUMER OPERATIONS (Validate / Apply Vouchers)
// ============================================

/**
 * Validate a voucher code for a given stall and order
 * @param {string} code - Voucher code entered by consumer
 * @param {string} stallId - The stall the order is for
 * @param {number} orderSubtotal - Current order subtotal
 * @returns {Object} - { valid, voucher, discount, error }
 */
export async function validateVoucher(code, stallId, orderSubtotal) {
  const user = auth.currentUser;
  if (!user) return { valid: false, error: "Please log in to apply a voucher" };

  // Find voucher by code and stall
  const q = query(
    collection(db, "vouchers"),
    where("code", "==", code.toUpperCase().trim()),
    where("stallId", "==", stallId),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { valid: false, error: "Invalid voucher code" };
  }

  const voucherDoc = snapshot.docs[0];
  const voucher = { id: voucherDoc.id, ...voucherDoc.data() };

  // Check if active
  if (!voucher.isActive) {
    return { valid: false, error: "This voucher is no longer active" };
  }

  // Check expiry
  if (voucher.expiryDate) {
    const expiry =
      voucher.expiryDate.toDate?.() || new Date(voucher.expiryDate);
    if (new Date() > expiry) {
      return { valid: false, error: "This voucher has expired" };
    }
  }

  // Check usage limit
  if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
    return { valid: false, error: "This voucher has reached its usage limit" };
  }

  // Check minimum order amount
  if (orderSubtotal < voucher.minOrderAmount) {
    return {
      valid: false,
      error: `Minimum order of $${voucher.minOrderAmount.toFixed(1)} required`,
    };
  }

  // Check per-user usage limit
  if (voucher.usagePerUser) {
    const usageQ = query(
      collection(db, "voucherUsage"),
      where("voucherId", "==", voucher.id),
      where("userId", "==", user.uid),
    );
    const usageSnapshot = await getDocs(usageQ);
    if (usageSnapshot.size >= voucher.usagePerUser) {
      return {
        valid: false,
        error: "You have already used this voucher",
      };
    }
  }

  // Calculate discount
  let discount = 0;
  if (voucher.type === "percentage") {
    discount = orderSubtotal * (voucher.value / 100);
    if (voucher.maxDiscount !== null && discount > voucher.maxDiscount) {
      discount = voucher.maxDiscount;
    }
  } else {
    // fixed
    discount = voucher.value;
  }

  // Don't exceed order total
  if (discount > orderSubtotal) {
    discount = orderSubtotal;
  }

  discount = Math.round(discount * 100) / 100;

  return {
    valid: true,
    voucher,
    discount,
  };
}

/**
 * Record voucher usage after order is placed
 * @param {string} voucherId - Voucher document ID
 * @param {string} orderId - The order that used this voucher
 * @param {number} discountAmount - Discount amount applied
 */
export async function recordVoucherUsage(voucherId, orderId, discountAmount) {
  const user = auth.currentUser;
  if (!user) return;

  // Record usage
  await addDoc(collection(db, "voucherUsage"), {
    voucherId,
    orderId,
    userId: user.uid,
    discountAmount,
    usedAt: serverTimestamp(),
  });

  // Increment voucher used count
  await updateDoc(doc(db, "vouchers", voucherId), {
    usedCount: increment(1),
    updatedAt: serverTimestamp(),
  });
}
