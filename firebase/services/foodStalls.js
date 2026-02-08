/**
 * Hawkr - Food Stalls Service
 * Handles all food stall and menu item Firestore operations
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
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// FOOD STALL OPERATIONS
// ============================================

/**
 * Get stall by ID
 * @param {string} stallId - Stall document ID
 * @returns {Object|null} - Stall data or null
 */
export async function getStallById(stallId) {
  const stallDoc = await getDoc(doc(db, "foodStalls", stallId));

  if (!stallDoc.exists()) return null;

  return {
    id: stallDoc.id,
    ...stallDoc.data(),
  };
}

/**
 * Get stall with full menu
 * @param {string} stallId - Stall document ID
 * @returns {Object|null} - Stall data with menu items
 */
export async function getStallWithMenu(stallId) {
  const stall = await getStallById(stallId);
  if (!stall) return null;

  const menuItems = await getMenuItems(stallId);

  return {
    ...stall,
    menuItems,
  };
}

/**
 * Get stalls by hawker centre
 * @param {string} hawkerCentreId - Hawker centre ID
 * @returns {Array} - Array of stalls
 */
export async function getStallsByHawkerCentre(hawkerCentreId) {
  const q = query(
    collection(db, "foodStalls"),
    where("hawkerCentreId", "==", hawkerCentreId),
    where("isActive", "==", true),
    orderBy("name"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Get stalls by cuisine type
 * @param {string} cuisineId - Cuisine ID
 * @returns {Array} - Array of stalls
 */
export async function getStallsByCuisine(cuisineId) {
  const q = query(
    collection(db, "foodStalls"),
    where("cuisineIds", "array-contains", cuisineId),
    where("isActive", "==", true),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Search stalls by name
 * @param {string} searchTerm - Search term
 * @param {number} limitCount - Max results
 * @returns {Array} - Array of matching stalls
 */
export async function searchStalls(searchTerm, limitCount = 20) {
  // Note: Firestore doesn't support full-text search natively
  // This is a simple prefix search. For production, use Algolia or similar
  const searchLower = searchTerm.toLowerCase();

  const q = query(
    collection(db, "foodStalls"),
    where("isActive", "==", true),
    where("nameLower", ">=", searchLower),
    where("nameLower", "<=", searchLower + "\uf8ff"),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Get stalls owned by the current user
 * @returns {Array} - Array of stalls
 */
export async function getMyStalls() {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in");

  const q = query(
    collection(db, "foodStalls"),
    where("ownerId", "==", user.uid),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Create a new stall (for stall owners)
 * @param {Object} stallData - Stall details
 * @returns {string} - Created stall ID
 */
export async function createStall(stallData) {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in");

  const stallRef = await addDoc(collection(db, "foodStalls"), {
    ownerId: user.uid,
    hawkerCentreId: stallData.hawkerCentreId,
    name: stallData.name,
    nameLower: stallData.name.toLowerCase(), // For search
    description: stallData.description || "",
    cuisineIds: stallData.cuisineIds || [],
    cuisineNames: stallData.cuisineNames || [], // Denormalized for display
    isHalal: stallData.isHalal || false,
    unitNumber: stallData.unitNumber || "",
    imageUrl: stallData.imageUrl || "",
    coverImageUrl: stallData.coverImageUrl || "",
    rating: 0,
    reviewCount: 0,
    operatingHours: stallData.operatingHours || {
      monday: { isClosed: false, slots: [{ from: "08:00", to: "21:00" }] },
      tuesday: { isClosed: false, slots: [{ from: "08:00", to: "21:00" }] },
      wednesday: { isClosed: false, slots: [{ from: "08:00", to: "21:00" }] },
      thursday: { isClosed: false, slots: [{ from: "08:00", to: "21:00" }] },
      friday: { isClosed: false, slots: [{ from: "08:00", to: "21:00" }] },
      saturday: { isClosed: false, slots: [{ from: "08:00", to: "21:00" }] },
      sunday: { isClosed: true, slots: [] },
    },
    isActive: true,
    isOpen: true, // Real-time status
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return stallRef.id;
}

/**
 * Update stall details
 * @param {string} stallId - Stall document ID
 * @param {Object} updates - Fields to update
 */
export async function updateStall(stallId, updates) {
  // If name is being updated, also update nameLower
  if (updates.name) {
    updates.nameLower = updates.name.toLowerCase();
  }

  await updateDoc(doc(db, "foodStalls", stallId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Toggle stall open/closed status
 * @param {string} stallId - Stall document ID
 * @param {boolean} isOpen - New open status
 */
export async function setStallOpenStatus(stallId, isOpen) {
  await updateDoc(doc(db, "foodStalls", stallId), {
    isOpen: isOpen,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deactivate a stall (soft delete)
 * @param {string} stallId - Stall document ID
 */
export async function deactivateStall(stallId) {
  await updateDoc(doc(db, "foodStalls", stallId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// MENU ITEM OPERATIONS
// ============================================

/**
 * Get all menu items for a stall
 * @param {string} stallId - Stall document ID
 * @returns {Array} - Array of menu items
 */
export async function getMenuItems(stallId) {
  const q = query(
    collection(db, "foodStalls", stallId, "menuItems"),
    where("isAvailable", "==", true),
    orderBy("category"),
    orderBy("name"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Get all menu items grouped by category
 * @param {string} stallId - Stall document ID
 * @returns {Object} - Menu items grouped by category
 */
export async function getMenuItemsByCategory(stallId) {
  const items = await getMenuItems(stallId);

  const grouped = {};
  items.forEach((item) => {
    const category = item.category || "Uncategorized";
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  });

  return grouped;
}

/**
 * Get a single menu item
 * @param {string} stallId - Stall document ID
 * @param {string} menuItemId - Menu item document ID
 * @returns {Object|null} - Menu item data or null
 */
export async function getMenuItem(stallId, menuItemId) {
  const itemDoc = await getDoc(
    doc(db, "foodStalls", stallId, "menuItems", menuItemId),
  );

  if (!itemDoc.exists()) return null;

  return {
    id: itemDoc.id,
    ...itemDoc.data(),
  };
}

/**
 * Add a menu item to a stall
 * @param {string} stallId - Stall document ID
 * @param {Object} itemData - Menu item details
 * @returns {string} - Created menu item ID
 */
export async function addMenuItem(stallId, itemData) {
  const itemRef = await addDoc(
    collection(db, "foodStalls", stallId, "menuItems"),
    {
      name: itemData.name,
      nameLower: itemData.name.toLowerCase(),
      description: itemData.description || "",
      price: itemData.price,
      category: itemData.category || "Main",
      imageUrl: itemData.imageUrl || "",
      isAvailable: true,
      isPopular: itemData.isPopular || false,
      preparationTime: itemData.preparationTime || 10, // minutes
      customizations: itemData.customizations || [],
      // Example customizations:
      // [
      //   { name: "Spice Level", options: ["Mild", "Medium", "Hot"], priceAdjustments: [0, 0, 0] },
      //   { name: "Add-ons", options: ["Egg", "Extra Meat"], priceAdjustments: [1, 2] }
      // ]
      allergens: itemData.allergens || [],
      isVegetarian: itemData.isVegetarian || false,
      isVegan: itemData.isVegan || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  );

  return itemRef.id;
}

/**
 * Update a menu item
 * @param {string} stallId - Stall document ID
 * @param {string} menuItemId - Menu item document ID
 * @param {Object} updates - Fields to update
 */
export async function updateMenuItem(stallId, menuItemId, updates) {
  if (updates.name) {
    updates.nameLower = updates.name.toLowerCase();
  }

  await updateDoc(doc(db, "foodStalls", stallId, "menuItems", menuItemId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Toggle menu item availability
 * @param {string} stallId - Stall document ID
 * @param {string} menuItemId - Menu item document ID
 * @param {boolean} isAvailable - New availability status
 */
export async function setMenuItemAvailability(
  stallId,
  menuItemId,
  isAvailable,
) {
  await updateDoc(doc(db, "foodStalls", stallId, "menuItems", menuItemId), {
    isAvailable: isAvailable,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a menu item
 * @param {string} stallId - Stall document ID
 * @param {string} menuItemId - Menu item document ID
 */
export async function deleteMenuItem(stallId, menuItemId) {
  await deleteDoc(doc(db, "foodStalls", stallId, "menuItems", menuItemId));
}

// ============================================
// CUISINE OPERATIONS
// ============================================

/**
 * Get all cuisines
 * @returns {Array} - Array of cuisines
 */
export async function getAllCuisines() {
  const q = query(collection(db, "cuisines"), orderBy("name"));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Get cuisine by ID
 * @param {string} cuisineId - Cuisine document ID
 * @returns {Object|null} - Cuisine data or null
 */
export async function getCuisineById(cuisineId) {
  const cuisineDoc = await getDoc(doc(db, "cuisines", cuisineId));

  if (!cuisineDoc.exists()) return null;

  return {
    id: cuisineDoc.id,
    ...cuisineDoc.data(),
  };
}

// ============================================
// FEATURED & POPULAR QUERIES
// ============================================

/**
 * Get featured stalls
 * @param {number} limitCount - Max number of stalls
 * @returns {Array} - Array of featured stalls
 */
export async function getFeaturedStalls(limitCount = 10) {
  const q = query(
    collection(db, "foodStalls"),
    where("isActive", "==", true),
    where("isFeatured", "==", true),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Get top-rated stalls
 * @param {number} limitCount - Max number of stalls
 * @returns {Array} - Array of top-rated stalls
 */
export async function getTopRatedStalls(limitCount = 10) {
  const q = query(
    collection(db, "foodStalls"),
    where("isActive", "==", true),
    where("reviewCount", ">=", 10), // Minimum reviews
    orderBy("reviewCount"),
    orderBy("rating", "desc"),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Get popular menu items across all stalls
 * @param {number} limitCount - Max number of items
 * @returns {Array} - Array of popular items with stall info
 */
export async function getPopularMenuItems(limitCount = 20) {
  // Note: This requires a collection group query on menuItems
  // Make sure to create the required composite index in Firestore
  const { collectionGroup } =
    await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

  const q = query(
    collectionGroup(db, "menuItems"),
    where("isAvailable", "==", true),
    where("isPopular", "==", true),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    stallId: doc.ref.parent.parent.id,
    ...doc.data(),
  }));
}
