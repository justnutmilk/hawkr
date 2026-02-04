/**
 * Hawkr - Orders Service
 * Handles all order-related Firestore operations
 */

import { db, auth } from '../config.js';
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
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// ORDER OPERATIONS
// ============================================

/**
 * Create a new order
 * @param {Object} orderData - Order details
 * @returns {string} - Created order ID
 */
export async function createOrder(orderData) {
    const user = auth.currentUser;
    if (!user) throw new Error("User must be logged in to create an order");

    const orderRef = await addDoc(collection(db, "orders"), {
        customerId: user.uid,
        stallId: orderData.stallId,
        stallName: orderData.stallName,
        hawkerCentreId: orderData.hawkerCentreId,
        status: "pending", // pending, confirmed, preparing, ready, completed, cancelled
        items: orderData.items.map(item => ({
            menuItemId: item.menuItemId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            notes: item.notes || "",
            customizations: item.customizations || []
        })),
        subtotal: orderData.subtotal,
        serviceFee: orderData.serviceFee || 0,
        total: orderData.total,
        paymentMethod: orderData.paymentMethod, // "cash", "card", "paynow"
        paymentStatus: "pending", // pending, paid, refunded
        specialInstructions: orderData.specialInstructions || "",
        estimatedReadyTime: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return orderRef.id;
}

/**
 * Get order by ID
 * @param {string} orderId - Order document ID
 * @returns {Object|null} - Order data or null
 */
export async function getOrderById(orderId) {
    const orderDoc = await getDoc(doc(db, "orders", orderId));

    if (!orderDoc.exists()) return null;

    return {
        id: orderDoc.id,
        ...orderDoc.data()
    };
}

/**
 * Get orders for the current customer
 * @param {number} limitCount - Max number of orders to fetch
 * @returns {Array} - Array of orders
 */
export async function getCustomerOrders(limitCount = 20) {
    const user = auth.currentUser;
    if (!user) throw new Error("User must be logged in");

    const q = query(
        collection(db, "orders"),
        where("customerId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

/**
 * Get orders for a stall (for stall owners)
 * @param {string} stallId - Stall ID
 * @param {string} status - Filter by status (optional)
 * @param {number} limitCount - Max number of orders
 * @returns {Array} - Array of orders
 */
export async function getStallOrders(stallId, status = null, limitCount = 50) {
    let q;

    if (status) {
        q = query(
            collection(db, "orders"),
            where("stallId", "==", stallId),
            where("status", "==", status),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );
    } else {
        q = query(
            collection(db, "orders"),
            where("stallId", "==", stallId),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

/**
 * Get active orders for a stall (pending, confirmed, preparing, ready)
 * @param {string} stallId - Stall ID
 * @returns {Array} - Array of active orders
 */
export async function getActiveStallOrders(stallId) {
    const activeStatuses = ["pending", "confirmed", "preparing", "ready"];

    const q = query(
        collection(db, "orders"),
        where("stallId", "==", stallId),
        where("status", "in", activeStatuses),
        orderBy("createdAt", "asc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

/**
 * Update order status
 * @param {string} orderId - Order document ID
 * @param {string} newStatus - New status
 * @param {number} estimatedMinutes - Estimated ready time in minutes (optional)
 */
export async function updateOrderStatus(orderId, newStatus, estimatedMinutes = null) {
    const updates = {
        status: newStatus,
        updatedAt: serverTimestamp()
    };

    if (estimatedMinutes !== null) {
        const readyTime = new Date();
        readyTime.setMinutes(readyTime.getMinutes() + estimatedMinutes);
        updates.estimatedReadyTime = readyTime;
    }

    if (newStatus === "completed") {
        updates.completedAt = serverTimestamp();
    }

    await updateDoc(doc(db, "orders", orderId), updates);
}

/**
 * Update payment status
 * @param {string} orderId - Order document ID
 * @param {string} paymentStatus - New payment status
 */
export async function updatePaymentStatus(orderId, paymentStatus) {
    await updateDoc(doc(db, "orders", orderId), {
        paymentStatus: paymentStatus,
        updatedAt: serverTimestamp(),
        ...(paymentStatus === "paid" ? { paidAt: serverTimestamp() } : {})
    });
}

/**
 * Cancel an order
 * @param {string} orderId - Order document ID
 * @param {string} reason - Cancellation reason
 */
export async function cancelOrder(orderId, reason = "") {
    await updateDoc(doc(db, "orders", orderId), {
        status: "cancelled",
        cancellationReason: reason,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
}

/**
 * Listen to order updates in real-time
 * @param {string} orderId - Order document ID
 * @param {Function} callback - Callback function receiving order data
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToOrder(orderId, callback) {
    return onSnapshot(doc(db, "orders", orderId), (doc) => {
        if (doc.exists()) {
            callback({
                id: doc.id,
                ...doc.data()
            });
        } else {
            callback(null);
        }
    });
}

/**
 * Listen to stall orders in real-time (for stall owners)
 * @param {string} stallId - Stall ID
 * @param {Function} callback - Callback function receiving orders array
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToStallOrders(stallId, callback) {
    const activeStatuses = ["pending", "confirmed", "preparing", "ready"];

    const q = query(
        collection(db, "orders"),
        where("stallId", "==", stallId),
        where("status", "in", activeStatuses),
        orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(orders);
    });
}

// ============================================
// CART OPERATIONS
// ============================================

/**
 * Get or create cart for current user
 * @returns {Object} - Cart data
 */
export async function getCart() {
    const user = auth.currentUser;
    if (!user) throw new Error("User must be logged in");

    const cartDoc = await getDoc(doc(db, "carts", user.uid));

    if (!cartDoc.exists()) {
        // Create empty cart
        await updateDoc(doc(db, "carts", user.uid), {
            items: [],
            updatedAt: serverTimestamp()
        }).catch(async () => {
            // If update fails (doc doesn't exist), use set
            const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            await setDoc(doc(db, "carts", user.uid), {
                items: [],
                updatedAt: serverTimestamp()
            });
        });

        return { id: user.uid, items: [] };
    }

    return {
        id: cartDoc.id,
        ...cartDoc.data()
    };
}

/**
 * Add item to cart
 * @param {Object} item - Item to add
 */
export async function addToCart(item) {
    const user = auth.currentUser;
    if (!user) throw new Error("User must be logged in");

    const cart = await getCart();

    // Check if item already exists (same menuItemId and customizations)
    const existingIndex = cart.items.findIndex(
        i => i.menuItemId === item.menuItemId &&
             JSON.stringify(i.customizations) === JSON.stringify(item.customizations || [])
    );

    let updatedItems;
    if (existingIndex >= 0) {
        // Update quantity
        updatedItems = [...cart.items];
        updatedItems[existingIndex].quantity += item.quantity;
    } else {
        // Add new item
        updatedItems = [...cart.items, {
            menuItemId: item.menuItemId,
            stallId: item.stallId,
            stallName: item.stallName,
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            customizations: item.customizations || [],
            notes: item.notes || "",
            addedAt: new Date().toISOString()
        }];
    }

    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    await setDoc(doc(db, "carts", user.uid), {
        items: updatedItems,
        updatedAt: serverTimestamp()
    });
}

/**
 * Update cart item quantity
 * @param {number} itemIndex - Index of item in cart
 * @param {number} quantity - New quantity
 */
export async function updateCartItemQuantity(itemIndex, quantity) {
    const user = auth.currentUser;
    if (!user) throw new Error("User must be logged in");

    const cart = await getCart();

    if (itemIndex < 0 || itemIndex >= cart.items.length) {
        throw new Error("Invalid item index");
    }

    let updatedItems;
    if (quantity <= 0) {
        // Remove item
        updatedItems = cart.items.filter((_, i) => i !== itemIndex);
    } else {
        // Update quantity
        updatedItems = [...cart.items];
        updatedItems[itemIndex].quantity = quantity;
    }

    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    await setDoc(doc(db, "carts", user.uid), {
        items: updatedItems,
        updatedAt: serverTimestamp()
    });
}

/**
 * Remove item from cart
 * @param {number} itemIndex - Index of item to remove
 */
export async function removeFromCart(itemIndex) {
    await updateCartItemQuantity(itemIndex, 0);
}

/**
 * Clear the entire cart
 */
export async function clearCart() {
    const user = auth.currentUser;
    if (!user) throw new Error("User must be logged in");

    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    await setDoc(doc(db, "carts", user.uid), {
        items: [],
        updatedAt: serverTimestamp()
    });
}

/**
 * Calculate cart totals
 * @returns {Object} - Cart with calculated totals
 */
export async function getCartWithTotals() {
    const cart = await getCart();

    const subtotal = cart.items.reduce((sum, item) => {
        return sum + (item.unitPrice * item.quantity);
    }, 0);

    const serviceFee = subtotal * 0.05; // 5% service fee example
    const total = subtotal + serviceFee;

    return {
        ...cart,
        subtotal: Math.round(subtotal * 100) / 100,
        serviceFee: Math.round(serviceFee * 100) / 100,
        total: Math.round(total * 100) / 100,
        itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
    };
}

// ============================================
// ORDER HISTORY & STATS
// ============================================

/**
 * Get order statistics for a stall
 * @param {string} stallId - Stall ID
 * @param {Date} startDate - Start date for stats
 * @param {Date} endDate - End date for stats
 * @returns {Object} - Order statistics
 */
export async function getStallOrderStats(stallId, startDate = null, endDate = null) {
    let q = query(
        collection(db, "orders"),
        where("stallId", "==", stallId),
        where("status", "==", "completed")
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // Filter by date if provided
    let filteredOrders = orders;
    if (startDate || endDate) {
        filteredOrders = orders.filter(order => {
            const orderDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
            if (startDate && orderDate < startDate) return false;
            if (endDate && orderDate > endDate) return false;
            return true;
        });
    }

    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = filteredOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Count items sold
    const itemsSold = {};
    filteredOrders.forEach(order => {
        order.items.forEach(item => {
            if (!itemsSold[item.menuItemId]) {
                itemsSold[item.menuItemId] = {
                    name: item.name,
                    quantity: 0,
                    revenue: 0
                };
            }
            itemsSold[item.menuItemId].quantity += item.quantity;
            itemsSold[item.menuItemId].revenue += item.totalPrice;
        });
    });

    return {
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        itemsSold: Object.entries(itemsSold)
            .map(([id, data]) => ({ menuItemId: id, ...data }))
            .sort((a, b) => b.quantity - a.quantity)
    };
}
