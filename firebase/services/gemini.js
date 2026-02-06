/**
 * Gemini API Service
 * Handles sentiment analysis for reviews using Google's Gemini API
 */

// ============================================
// CONFIGURATION
// ============================================

const GEMINI_API_KEY = "AIzaSyCoYgdtFUCaZeNJMDbNWb4nGRmDuRK-MgU"; // <-- Paste your API key here
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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
  // If no text provided, infer from rating
  if (!reviewText || reviewText.trim() === "") {
    if (rating >= 4) return "positive";
    if (rating <= 2) return "negative";
    return "neutral";
  }

  try {
    const prompt = `Analyze the sentiment of this food stall review text. Focus ONLY on what the text says, ignore the star rating. Respond with ONLY one word: "positive", "negative", or "neutral".

Review text: "${reviewText}"

Response (one word only):`;

    console.log("Sending to Gemini:", prompt);

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 10,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "Gemini API error:",
        response.status,
        response.statusText,
        errorText,
      );
      return fallbackSentiment(rating);
    }

    const data = await response.json();
    console.log("Gemini response:", JSON.stringify(data));

    const result = data.candidates?.[0]?.content?.parts?.[0]?.text
      ?.toLowerCase()
      .trim();

    console.log("Parsed sentiment result:", result);

    // Validate response
    if (result?.includes("positive")) return "positive";
    if (result?.includes("negative")) return "negative";
    if (result?.includes("neutral")) return "neutral";

    console.warn("Could not parse sentiment, falling back to rating-based");
    // Fallback to rating-based sentiment
    return fallbackSentiment(rating);
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
