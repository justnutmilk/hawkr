/**
 * Hawkr - Feedback Submission Example
 *
 * This file demonstrates how to integrate Firebase feedback submission
 * with the existing consumerFeedback.js page.
 *
 * HOW TO USE THIS FILE:
 * 1. First, set up your Firebase project (see steps below)
 * 2. Copy relevant code sections into your consumerFeedback.js
 * 3. Replace mock data operations with Firebase calls
 */

// ============================================
// STEP 1: FIREBASE PROJECT SETUP
// ============================================
/**
 * 1. Go to https://console.firebase.google.com/
 * 2. Click "Create a project" (or "Add project")
 * 3. Enter project name: "hawkr" (or your preferred name)
 * 4. Disable Google Analytics (optional for now)
 * 5. Click "Create project"
 *
 * 6. Once created, click the web icon (</>) to add a web app
 * 7. Register app with nickname "hawkr-web"
 * 8. Copy the firebaseConfig object shown
 * 9. Paste it into firebase/config.js (replace the placeholder values)
 *
 * 10. In Firebase Console, go to "Build" > "Firestore Database"
 * 11. Click "Create database"
 * 12. Choose "Start in test mode" (for development)
 * 13. Select your region (asia-southeast1 for Singapore)
 * 14. Click "Enable"
 *
 * 15. Go to "Build" > "Authentication"
 * 16. Click "Get started"
 * 17. Enable "Email/Password" provider
 */

// ============================================
// STEP 2: IMPORT SERVICES IN YOUR PAGE
// ============================================

// Add this to the top of consumerFeedback.js:
/*
import { auth, feedback } from '../../firebase/services/index.js';

// Or import specific functions:
import { submitFeedback } from '../../firebase/services/feedback.js';
import { onAuthChange, getUserProfile } from '../../firebase/services/auth.js';
*/

// ============================================
// STEP 3: CHECK AUTH STATE ON PAGE LOAD
// ============================================

/**
 * Example: Checking if user is logged in before allowing feedback
 */
async function initFeedbackPage() {
    // Import auth service
    const { onAuthChange, getUserProfile } = await import('../../firebase/services/auth.js');

    // Listen for auth state changes
    onAuthChange(async (user) => {
        if (user) {
            // User is logged in
            console.log("User logged in:", user.uid);

            // Get user's profile to personalize the page
            const profile = await getUserProfile();
            if (profile) {
                console.log("Welcome back,", profile.displayName);
            }

            // Enable the feedback form
            enableFeedbackForm();
        } else {
            // User is not logged in
            console.log("User not logged in");

            // Redirect to login or show login prompt
            // window.location.href = '../Login/login.html';
            showLoginPrompt();
        }
    });
}

function enableFeedbackForm() {
    // Enable submit button, etc.
    const submitBtn = document.querySelector('.primaryButton');
    if (submitBtn) {
        submitBtn.disabled = false;
    }
}

function showLoginPrompt() {
    // Show a message asking user to log in
    alert("Please log in to submit feedback");
}

// ============================================
// STEP 4: SUBMIT FEEDBACK TO FIREBASE
// ============================================

/**
 * Example: Modified submitFeedback function for Firebase
 * Replace the existing submission logic in consumerFeedback.js with this
 */
async function handleFeedbackSubmission(feedbackData) {
    // Import feedback service
    const { submitFeedback } = await import('../../firebase/services/feedback.js');

    try {
        // Show loading state
        const submitBtn = document.querySelector('.primaryButton');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;

        // Prepare feedback data
        const firebaseFeedbackData = {
            stallId: feedbackData.stallId,        // The stall being reviewed
            orderId: feedbackData.orderId || null, // Optional: link to specific order
            rating: feedbackData.rating,           // 1-5 stars
            text: feedbackData.text,               // Written feedback
            quickTags: feedbackData.quickTags || [], // Selected quick tags
            contactMe: feedbackData.contactMe || false // Contact permission
        };

        // Submit to Firebase
        const feedbackId = await submitFeedback(firebaseFeedbackData);

        console.log("Feedback submitted successfully! ID:", feedbackId);

        // Show success message
        showSuccessMessage();

        // Redirect after delay
        setTimeout(() => {
            window.location.href = '../Consumer Dashboard/consumerDashboard.html';
        }, 2000);

    } catch (error) {
        console.error("Error submitting feedback:", error);

        // Show error message to user
        alert("Failed to submit feedback. Please try again.");

        // Re-enable button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function showSuccessMessage() {
    // Create and show success modal/message
    const modal = document.createElement('div');
    modal.className = 'successModal';
    modal.innerHTML = `
        <div class="successContent">
            <img src="../../assets/icons/check-circle.svg" alt="Success">
            <h2>Thank You!</h2>
            <p>Your feedback has been submitted successfully.</p>
        </div>
    `;
    document.body.appendChild(modal);
}

// ============================================
// STEP 5: INTEGRATION WITH EXISTING CODE
// ============================================

/**
 * Here's how to modify your existing consumerFeedback.js submit logic:
 *
 * Find the section where you handle the final "Submit" button click
 * and replace it with something like this:
 */

/*
// In your existing nextStep() or handleSubmit() function:

if (currentStep === 3) {
    // Collect all feedback data from your form
    const feedbackData = {
        stallId: getStallIdFromUrl(),  // Get from URL params
        orderId: getOrderIdIfExists(), // Optional
        rating: selectedRating,         // From step 1
        text: feedbackText,             // From step 2
        quickTags: selectedTags,        // From step 1
        contactMe: contactToggleState   // From step 3 toggle
    };

    // Submit to Firebase
    await handleFeedbackSubmission(feedbackData);
}
*/

// ============================================
// STEP 6: READING FEEDBACK (FOR STALL PAGES)
// ============================================

/**
 * Example: Loading and displaying feedback on a stall page
 */
async function loadStallFeedback(stallId) {
    const { getFeedbackByStall, getStallFeedbackStats } = await import('../../firebase/services/feedback.js');

    try {
        // Get feedback stats
        const stats = await getStallFeedbackStats(stallId);
        console.log("Stall stats:", stats);
        // { totalReviews: 150, averageRating: 4.2, ratingDistribution: {5: 80, 4: 40, ...} }

        // Display stats
        document.querySelector('.stallRating').textContent = stats.averageRating.toFixed(1);
        document.querySelector('.reviewCount').textContent = `(${stats.totalReviews} reviews)`;

        // Get individual reviews
        const feedback = await getFeedbackByStall(stallId, 10); // Get 10 most recent

        // Render reviews
        const reviewsContainer = document.querySelector('.reviewsList');
        reviewsContainer.innerHTML = feedback.map(review => `
            <div class="reviewCard">
                <div class="reviewHeader">
                    <span class="reviewerName">${review.customerName || 'Anonymous'}</span>
                    <span class="reviewDate">${formatDate(review.createdAt)}</span>
                </div>
                <div class="reviewRating">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</div>
                <p class="reviewText">${review.text}</p>
                ${review.stallResponse ? `
                    <div class="stallResponse">
                        <strong>Stall Response:</strong>
                        <p>${review.stallResponse}</p>
                    </div>
                ` : ''}
            </div>
        `).join('');

    } catch (error) {
        console.error("Error loading feedback:", error);
    }
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-SG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// ============================================
// STEP 7: STALL OWNER - RESPONDING TO FEEDBACK
// ============================================

/**
 * Example: Stall owner adding a response to feedback
 */
async function respondToFeedback(feedbackId, responseText) {
    const { addStallResponse } = await import('../../firebase/services/feedback.js');

    try {
        await addStallResponse(feedbackId, responseText);
        console.log("Response added successfully");

        // Refresh the feedback display
        loadFeedbackList();

    } catch (error) {
        console.error("Error adding response:", error);
        alert("Failed to add response. Please try again.");
    }
}

// ============================================
// COMMON PATTERNS & TIPS
// ============================================

/**
 * TIP 1: Error Handling
 * Always wrap Firebase calls in try-catch blocks
 */
async function safeFirebaseCall(operation) {
    try {
        return await operation();
    } catch (error) {
        // Log for debugging
        console.error("Firebase error:", error);

        // Show user-friendly message based on error code
        switch (error.code) {
            case 'permission-denied':
                alert("You don't have permission to perform this action.");
                break;
            case 'not-found':
                alert("The requested item was not found.");
                break;
            case 'unavailable':
                alert("Service temporarily unavailable. Please try again.");
                break;
            default:
                alert("An error occurred. Please try again.");
        }

        return null;
    }
}

/**
 * TIP 2: Loading States
 * Show loading indicators during Firebase operations
 */
function showLoading(element) {
    element.classList.add('loading');
    element.innerHTML = '<div class="spinner"></div>';
}

function hideLoading(element, content) {
    element.classList.remove('loading');
    element.innerHTML = content;
}

/**
 * TIP 3: Caching
 * Cache frequently accessed data to reduce reads
 */
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getCachedData(key, fetchFunction) {
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    const data = await fetchFunction();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
}

// Usage:
// const stall = await getCachedData(`stall-${stallId}`, () => getStallById(stallId));

/**
 * TIP 4: Real-time Updates
 * Use subscriptions for live data (like order status)
 */
/*
import { subscribeToOrder } from '../../firebase/services/orders.js';

// Subscribe to order updates
const unsubscribe = subscribeToOrder(orderId, (order) => {
    if (order) {
        updateOrderStatusUI(order.status);
    }
});

// Remember to unsubscribe when leaving the page
window.addEventListener('beforeunload', () => {
    unsubscribe();
});
*/

// ============================================
// READY TO USE!
// ============================================
/**
 * After completing the Firebase setup:
 *
 * 1. Update firebase/config.js with your project credentials
 * 2. Import the services in your page files
 * 3. Replace mock data calls with Firebase service calls
 * 4. Test with Firebase emulator or test mode database
 *
 * For questions or issues, check:
 * - Firebase docs: https://firebase.google.com/docs
 * - Firestore guide: docs/FIRESTORE_GUIDE.md
 */

export {
    initFeedbackPage,
    handleFeedbackSubmission,
    loadStallFeedback,
    respondToFeedback
};
