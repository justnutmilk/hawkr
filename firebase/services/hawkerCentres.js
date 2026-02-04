/**
 * Hawkr - Hawker Centres Service
 * Handles all hawker centre Firestore operations
 */

import { db } from "../config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  GeoPoint,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// HAWKER CENTRE OPERATIONS
// ============================================

/**
 * Get hawker centre by ID
 * @param {string} centreId - Hawker centre document ID
 * @returns {Object|null} - Hawker centre data or null
 */
export async function getHawkerCentreById(centreId) {
  const centreDoc = await getDoc(doc(db, "hawkerCentres", centreId));

  if (!centreDoc.exists()) return null;

  return {
    id: centreDoc.id,
    ...centreDoc.data(),
  };
}

/**
 * Get hawker centre with all its stalls
 * @param {string} centreId - Hawker centre document ID
 * @returns {Object|null} - Hawker centre with stalls array
 */
export async function getHawkerCentreWithStalls(centreId) {
  const centre = await getHawkerCentreById(centreId);
  if (!centre) return null;

  // Import food stalls service
  const { getStallsByHawkerCentre } = await import("./foodStalls.js");
  const stalls = await getStallsByHawkerCentre(centreId);

  return {
    ...centre,
    stalls,
  };
}

/**
 * Get all hawker centres
 * @returns {Array} - Array of all hawker centres
 */
export async function getAllHawkerCentres() {
  try {
    const q = query(
      collection(db, "hawkerCentres"),
      where("isActive", "==", true),
      orderBy("name"),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    // If compound query fails (no index), try simpler query
    console.warn("Compound query failed, trying simpler query:", error.message);
    const snapshot = await getDocs(collection(db, "hawkerCentres"));
    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((centre) => centre.isActive !== false)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }
}

/**
 * Get featured hawker centres
 * @param {number} limitCount - Max number of centres
 * @returns {Array} - Array of featured hawker centres
 */
export async function getFeaturedHawkerCentres(limitCount = 5) {
  try {
    const q = query(
      collection(db, "hawkerCentres"),
      where("isActive", "==", true),
      where("isFeatured", "==", true),
      limit(limitCount),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    // If compound query fails, try simpler approach
    console.warn("Featured query failed, trying simpler query:", error.message);
    const snapshot = await getDocs(collection(db, "hawkerCentres"));
    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(
        (centre) => centre.isActive !== false && centre.isFeatured === true,
      )
      .slice(0, limitCount);
  }
}

/**
 * Search hawker centres by name
 * @param {string} searchTerm - Search term
 * @param {number} limitCount - Max results
 * @returns {Array} - Array of matching hawker centres
 */
export async function searchHawkerCentres(searchTerm, limitCount = 20) {
  const searchLower = searchTerm.toLowerCase();

  const q = query(
    collection(db, "hawkerCentres"),
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
 * Get hawker centres by region
 * @param {string} region - Region name (e.g., "Central", "East", "West", "North", "North-East")
 * @returns {Array} - Array of hawker centres in the region
 */
export async function getHawkerCentresByRegion(region) {
  const q = query(
    collection(db, "hawkerCentres"),
    where("isActive", "==", true),
    where("region", "==", region),
    orderBy("name"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Get nearby hawker centres
 * Note: Firestore doesn't support native geospatial queries.
 * For production, use Geohash library or Firebase Extensions (Geofire)
 * This is a simplified version that filters client-side
 *
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @param {number} radiusKm - Search radius in kilometers
 * @returns {Array} - Array of nearby hawker centres sorted by distance
 */
export async function getNearbyHawkerCentres(
  latitude,
  longitude,
  radiusKm = 5,
) {
  // Get all active centres (in production, use geohashing for efficiency)
  const centres = await getAllHawkerCentres();

  // Calculate distance and filter
  const centresWithDistance = centres
    .map((centre) => {
      const distance = calculateDistance(
        latitude,
        longitude,
        centre.location?.latitude || 0,
        centre.location?.longitude || 0,
      );
      return { ...centre, distance };
    })
    .filter((centre) => centre.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);

  return centresWithDistance;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @returns {number} - Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Get hawker centres managed by an operator
 * @param {string} operatorId - Operator user ID
 * @returns {Array} - Array of hawker centres
 */
export async function getHawkerCentresByOperator(operatorId) {
  const q = query(
    collection(db, "hawkerCentres"),
    where("operatorId", "==", operatorId),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Get statistics for a hawker centre
 * @param {string} centreId - Hawker centre document ID
 * @returns {Object} - Centre statistics
 */
export async function getHawkerCentreStats(centreId) {
  const { getStallsByHawkerCentre } = await import("./foodStalls.js");
  const stalls = await getStallsByHawkerCentre(centreId);

  const totalStalls = stalls.length;
  const openStalls = stalls.filter((s) => s.isOpen).length;
  const avgRating =
    stalls.reduce((sum, s) => sum + (s.rating || 0), 0) / (totalStalls || 1);
  const totalReviews = stalls.reduce((sum, s) => sum + (s.reviewCount || 0), 0);

  // Get unique cuisines
  const cuisineSet = new Set();
  stalls.forEach((stall) => {
    (stall.cuisineNames || []).forEach((cuisine) => cuisineSet.add(cuisine));
  });

  return {
    totalStalls,
    openStalls,
    closedStalls: totalStalls - openStalls,
    averageRating: Math.round(avgRating * 10) / 10,
    totalReviews,
    cuisines: Array.from(cuisineSet),
  };
}

/**
 * Find hawker centre by exact name (case-insensitive)
 * @param {string} name - Hawker centre name to find
 * @returns {Object|null} - Hawker centre data or null if not found
 */
export async function getHawkerCentreByName(name) {
  const nameLower = name.toLowerCase().trim();

  const q = query(
    collection(db, "hawkerCentres"),
    where("nameLower", "==", nameLower),
    limit(1),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  return {
    id: docSnap.id,
    ...docSnap.data(),
  };
}

/**
 * Create a new hawker centre
 * @param {Object} centreData - Hawker centre details
 * @returns {string} - Created hawker centre ID
 */
export async function createHawkerCentre(centreData) {
  const centreRef = await addDoc(collection(db, "hawkerCentres"), {
    name: centreData.name,
    nameLower: centreData.name.toLowerCase().trim(),
    description: centreData.description || "",
    address: centreData.address || "",
    postalCode: centreData.postalCode || "",
    region: centreData.region || "",
    location: centreData.location || null,
    imageUrl: centreData.imageUrl || "",
    coverImageUrl: centreData.coverImageUrl || "",
    operatingHours: centreData.operatingHours || {
      monday: { open: "08:00", close: "22:00", isClosed: false },
      tuesday: { open: "08:00", close: "22:00", isClosed: false },
      wednesday: { open: "08:00", close: "22:00", isClosed: false },
      thursday: { open: "08:00", close: "22:00", isClosed: false },
      friday: { open: "08:00", close: "22:00", isClosed: false },
      saturday: { open: "08:00", close: "22:00", isClosed: false },
      sunday: { open: "08:00", close: "22:00", isClosed: false },
    },
    facilities: centreData.facilities || [],
    stallCount: 0,
    isActive: true,
    isFeatured: false,
    hygieneGrade: centreData.hygieneGrade || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return centreRef.id;
}

/**
 * Find or create a hawker centre by name
 * @param {string} name - Hawker centre name
 * @param {Object} additionalData - Additional data for creation if centre doesn't exist
 * @returns {Object} - { id, isNew, ...centreData }
 */
export async function findOrCreateHawkerCentre(name, additionalData = {}) {
  // First, try to find existing centre
  const existing = await getHawkerCentreByName(name);

  if (existing) {
    return { ...existing, isNew: false };
  }

  // Create new centre
  const newId = await createHawkerCentre({
    name: name.trim(),
    ...additionalData,
  });

  return {
    id: newId,
    name: name.trim(),
    isNew: true,
    ...additionalData,
  };
}

// ============================================
// HAWKER CENTRE DATA STRUCTURE REFERENCE
// ============================================
/**
 * Example hawker centre document structure:
 *
 * {
 *   name: "Maxwell Food Centre",
 *   nameLower: "maxwell food centre",  // For search
 *   description: "One of Singapore's most famous hawker centres...",
 *   address: "1 Kadayanallur St",
 *   postalCode: "069184",
 *   region: "Central",
 *   location: {                         // GeoPoint for mapping
 *     latitude: 1.2804,
 *     longitude: 103.8448
 *   },
 *   imageUrl: "https://...",
 *   coverImageUrl: "https://...",
 *   operatingHours: {
 *     monday: { open: "08:00", close: "22:00", isClosed: false },
 *     tuesday: { open: "08:00", close: "22:00", isClosed: false },
 *     // ... etc
 *   },
 *   facilities: ["Wheelchair Access", "Air Conditioning", "Parking"],
 *   operatorId: "operator123",          // Reference to operator
 *   stallCount: 100,                    // Denormalized count
 *   isActive: true,
 *   isFeatured: true,
 *   hygieneGrade: "A",
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp
 * }
 */
