/**
 * Gemini API Service
 * Handles sentiment analysis for reviews via Cloud Function.
 * The Gemini API key is kept server-side only.
 */

import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import app from "../config.js";

const functions = getFunctions(app, "asia-southeast1");

// ============================================
// SENTIMENT ANALYSIS
// ============================================

/**
 * Analyze the sentiment of a review text
 * @param {string} reviewText - The review text to analyze
 * @param {number} rating - The star rating (1-5) for additional context
 * @returns {Promise<"positive" | "negative" | "neutral">}
 */
export async function analyzeSentiment(reviewText, rating) {
  // If no text provided, infer from rating locally (no need to call server)
  if (!reviewText || reviewText.trim() === "") {
    if (rating >= 4) return "positive";
    if (rating <= 2) return "negative";
    return "neutral";
  }

  try {
    const analyze = httpsCallable(functions, "analyzeSentiment");
    const result = await analyze({ reviewText, rating });
    return result.data.sentiment || fallbackSentiment(rating);
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return fallbackSentiment(rating);
  }
}

/**
 * Fallback sentiment based on star rating
 * @param {number} rating
 * @returns {"positive" | "negative" | "neutral"}
 */
function fallbackSentiment(rating) {
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}
