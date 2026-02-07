// ============================================
// Operator Dashboard — Firebase-powered
// ============================================

import { db, auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getHawkerCentresByOperator,
  getHawkerCentreById,
  findOrCreateHawkerCentre,
  getHawkerCentreStats,
} from "../../firebase/services/hawkerCentres.js";
import { getStallsByHawkerCentre } from "../../firebase/services/foodStalls.js";

// ============================================
// STATE
// ============================================

/** @type {{ id: string, [key: string]: any } | null} */
let currentCentre = null;

/** @type {Array<{ id: string, name: string, imageUrl: string, cuisineNames: string[], rating: number, todayRevenue: number, monthlyRevenue: number, tags: string[] }>} */
let stallData = [];

/** Unsubscribe handle for the real-time orders listener */
let ordersUnsubscribe = null;

/** Revenue / satisfaction figures kept up-to-date via onSnapshot */
let todayRevenue = 0;
let monthlyRevenue = 0;
let customerSatisfaction = 0;

/** Per-stall revenue maps, keyed by stallId */
let todayRevenueByStall = {};
let monthlyRevenueByStall = {};

const STALLS_PER_PAGE = 3;
const stallVisibleCounts = { today: STALLS_PER_PAGE, monthly: STALLS_PER_PAGE };

/** Which tab is currently active */
let activeTab = "centre";

// ============================================
// ICONS (inline SVG kept from original)
// ============================================

const moreInfoIcon = `<svg class="quickStatsIcon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M5.19444 8.75H5.20333M8.75 8.75H8.75889M12.3056 8.75H12.3144M16.75 8.75C16.75 13.1683 13.1683 16.75 8.75 16.75C4.33172 16.75 0.75 13.1683 0.75 8.75C0.75 4.33172 4.33172 0.75 8.75 0.75C13.1683 0.75 16.75 4.33172 16.75 8.75Z" stroke="#341539" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const loadingIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none">
  <path d="M7.1825 0.682617V3.28262M7.1825 11.0826V13.6826M2.58699 2.58712L4.4265 4.42662M9.93849 9.93862L11.778 11.7781M0.682495 7.18262H3.2825M11.0825 7.18262H13.6825M2.58699 11.7781L4.4265 9.93862M9.93849 4.42662L11.778 2.58712" stroke="#595959" stroke-width="1.365" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const tagIcons = {
  Halal: "../../assets/icons/halal.png",
  Kosher: "../../assets/icons/kosher.svg",
};

// ============================================
// HELPERS
// ============================================

function formatCurrency(value) {
  return (
    "$" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Return a JS Date set to midnight of today (local time) */
function getStartOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Return a JS Date set to midnight of the 1st of this month (local time) */
function getStartOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Convert a Firestore timestamp (or ISO string / Date) to a JS Date.
 * Returns null when the value cannot be converted.
 */
function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ============================================
// DATA LOADING
// ============================================

/**
 * Compute per-stall and aggregate revenue from an array of order docs.
 * Only orders with status "completed" are counted.
 */
function computeRevenue(orders) {
  const startOfToday = getStartOfToday();
  const startOfMonth = getStartOfMonth();

  const todayByStall = {};
  const monthByStall = {};
  let todayTotal = 0;
  let monthTotal = 0;

  for (const order of orders) {
    if (order.status !== "completed") continue;

    const orderDate = toDate(order.createdAt);
    if (!orderDate) continue;

    const total = typeof order.total === "number" ? order.total : 0;
    const stallId = order.stallId;

    if (orderDate >= startOfMonth) {
      monthTotal += total;
      monthByStall[stallId] = (monthByStall[stallId] || 0) + total;
    }

    if (orderDate >= startOfToday) {
      todayTotal += total;
      todayByStall[stallId] = (todayByStall[stallId] || 0) + total;
    }
  }

  return { todayTotal, monthTotal, todayByStall, monthByStall };
}

/**
 * Enrich the raw stall objects with revenue numbers and a normalised `tags`
 * array.  Returns a new array (does not mutate the input).
 */
function enrichStalls(rawStalls) {
  return rawStalls.map((stall) => ({
    id: stall.id,
    name: stall.name || "Unnamed Stall",
    image: stall.imageUrl || "../../images/squirrelCard.svg",
    tags:
      stall.cuisineNames && stall.cuisineNames.length > 0
        ? stall.cuisineNames
        : [],
    rating: stall.rating || 0,
    todayRevenue: todayRevenueByStall[stall.id] || 0,
    monthlyRevenue: monthlyRevenueByStall[stall.id] || 0,
  }));
}

/**
 * Set up a real-time listener on the orders collection for every stall
 * belonging to this centre.  Each time the snapshot changes we recompute
 * revenue and re-render the active tab.
 *
 * Firestore "in" queries accept at most 30 values, so we batch if needed.
 */
function subscribeToOrders(stallIds) {
  // Tear down any previous listener
  if (ordersUnsubscribe) {
    ordersUnsubscribe();
    ordersUnsubscribe = null;
  }

  if (!stallIds || stallIds.length === 0) return;

  // Firestore "in" filters accept max 30 values — batch if necessary.
  const BATCH_SIZE = 30;
  const batches = [];
  for (let i = 0; i < stallIds.length; i += BATCH_SIZE) {
    batches.push(stallIds.slice(i, i + BATCH_SIZE));
  }

  // We keep one unsubscribe per batch and aggregate results.
  const unsubscribes = [];
  const ordersByBatch = new Array(batches.length).fill(null).map(() => []);

  function aggregate() {
    const allOrders = ordersByBatch.flat();
    const result = computeRevenue(allOrders);
    todayRevenue = result.todayTotal;
    monthlyRevenue = result.monthTotal;
    todayRevenueByStall = result.todayByStall;
    monthlyRevenueByStall = result.monthByStall;

    // Re-enrich stall data with updated revenue
    stallData = enrichStalls(rawStallCache);

    // Re-render whichever tab is showing
    renderDashboard(activeTab);
  }

  batches.forEach((batch, idx) => {
    const q = query(collection(db, "orders"), where("stallId", "in", batch));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        ordersByBatch[idx] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        aggregate();
      },
      (error) => {
        console.error("Orders snapshot error:", error);
      },
    );
    unsubscribes.push(unsub);
  });

  ordersUnsubscribe = () => unsubscribes.forEach((u) => u());
}

/** Cache the raw stall objects so we can re-enrich without refetching */
let rawStallCache = [];

/**
 * Main initialisation — called once we know the authenticated user.
 */
async function initDashboard(user) {
  const container = document.getElementById("dashboardContent");

  // Check onboarding status
  const operatorDoc = await getDoc(doc(db, "operators", user.uid));
  if (!operatorDoc.exists() || !operatorDoc.data().onboardingComplete) {
    window.location.href = "../Auth/onboarding-operator.html";
    return;
  }

  // Show a loading state while we fetch
  container.innerHTML = `<div class="emptyState" style="padding:3rem;text-align:center;color:#595959;">Loading dashboard data&hellip;</div>`;

  try {
    // 1. Resolve the operator's hawker centre
    let centres = await getHawkerCentresByOperator(user.uid);

    // Fallback: if no hawker centre has operatorId set, look up via operator doc
    if (!centres || centres.length === 0) {
      const opData = operatorDoc.data();

      if (opData.hawkerCentreId) {
        const centre = await getHawkerCentreById(opData.hawkerCentreId);
        if (centre) {
          await updateDoc(doc(db, "hawkerCentres", centre.id), {
            operatorId: user.uid,
            updatedAt: serverTimestamp(),
          });
          centres = [centre];
        }
      }

      if ((!centres || centres.length === 0) && opData.managedLocation?.name) {
        const centre = await findOrCreateHawkerCentre(
          opData.managedLocation.name,
          {
            address: opData.managedLocation.address || "",
            postalCode: opData.managedLocation.postalCode || "",
            placeId: opData.managedLocation.placeId || "",
            location: opData.managedLocation.latitude
              ? {
                  latitude: opData.managedLocation.latitude,
                  longitude: opData.managedLocation.longitude,
                }
              : null,
          },
        );
        await updateDoc(doc(db, "hawkerCentres", centre.id), {
          operatorId: user.uid,
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "operators", user.uid), {
          hawkerCentreId: centre.id,
          updatedAt: serverTimestamp(),
        });
        centres = [centre];
      }
    }

    if (!centres || centres.length === 0) {
      container.innerHTML = `<div class="emptyState" style="padding:3rem;text-align:center;color:#595959;">
        <p>No hawker centre is linked to your account.</p>
        <p style="font-size:0.85rem;margin-top:0.5rem;">Contact support if you believe this is an error.</p>
      </div>`;
      return;
    }

    currentCentre = centres[0];

    // 2. Update sidebar centre name
    const nameEl = document.querySelector(".operatorName");
    if (nameEl) nameEl.textContent = currentCentre.name || "My Centre";

    // 3. Fetch stalls for this centre
    rawStallCache = await getStallsByHawkerCentre(currentCentre.id);

    // 4. Compute average customer satisfaction from stall ratings
    const ratedStalls = rawStallCache.filter(
      (s) => typeof s.rating === "number" && s.rating > 0,
    );
    customerSatisfaction =
      ratedStalls.length > 0
        ? ratedStalls.reduce((sum, s) => sum + s.rating, 0) / ratedStalls.length
        : 0;
    // Round to 1 decimal place
    customerSatisfaction = Math.round(customerSatisfaction * 10) / 10;

    // 5. Enrich stalls (initially with zero revenue — will be filled by snapshot)
    stallData = enrichStalls(rawStallCache);

    // 6. Subscribe to real-time order updates
    const stallIds = rawStallCache.map((s) => s.id);
    subscribeToOrders(stallIds);

    // 7. Render the default tab (centre) — the snapshot callback will
    //    re-render once real revenue numbers arrive, so the user sees
    //    data almost immediately.
    renderDashboard(activeTab);
  } catch (err) {
    console.error("Failed to initialise operator dashboard:", err);
    container.innerHTML = `<div class="emptyState" style="padding:3rem;text-align:center;color:#595959;">
      <p>Something went wrong loading the dashboard.</p>
      <p style="font-size:0.85rem;margin-top:0.5rem;">${err.message || ""}</p>
    </div>`;
  }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderTag(tag) {
  const icon = tagIcons[tag];
  if (icon) {
    return `<span class="stallTag ${tag.toLowerCase()}"><img class="stallTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="stallTag">${tag}</span>`;
}

function renderTopStoreCard(stall, revenueKey) {
  return `
        <button class="topStoreCard" onclick="window.location.href='../Operator Children/operatorChildren.html?stall=${encodeURIComponent(stall.id)}'">
            <img class="topStoreImage" src="${stall.image}" alt="${stall.name}" />
            <span class="topStoreName">${stall.name}</span>
            <span class="topStoreRevenue">${formatCurrency(stall[revenueKey])}</span>
        </button>
    `;
}

function renderStallRow(stall) {
  const tags = stall.tags.map(renderTag).join("");
  return `
        <button class="stallRow" onclick="window.location.href='../Operator Children/operatorChildren.html?stall=${encodeURIComponent(stall.id)}'">
            <div class="stallRowInfo">
                <span class="stallRowName">${stall.name}</span>
                <div class="stallRowTags">${tags}</div>
            </div>
            <span class="stallRowGraphPlaceholder">Imagine a 4 data point line graph here</span>
        </button>
    `;
}

function renderCentreContent() {
  const satisfactionDisplay =
    customerSatisfaction > 0 ? `${customerSatisfaction}/10` : "N/A";

  return `
        <div class="quickStatsSection">
            <div class="quickStatsHeader">
                <span class="sectionLabel">Quick Stats</span>
                ${moreInfoIcon}
            </div>
            <div class="quickStatsBlocks">
                <div class="statBlock">
                    <span class="statBlockLabel">Today</span>
                    <span class="statBlockValue">S${formatCurrency(todayRevenue)}</span>
                    <span class="statBlockPlaceholder">Imagine A Bar Graph Here</span>
                </div>
                <div class="statBlock">
                    <span class="statBlockLabel">Monthly</span>
                    <span class="statBlockValue">S${formatCurrency(monthlyRevenue)}</span>
                    <span class="statBlockPlaceholder">Imagine Another Certain Graph Here</span>
                </div>
                <div class="statBlock">
                    <span class="statBlockLabel">Customer Satisfaction</span>
                    <span class="statBlockValue">${satisfactionDisplay}</span>
                    <span class="statBlockPlaceholder">Imagine A Donut Graph Here</span>
                </div>
            </div>
        </div>
    `;
}

function renderStallList(period) {
  const revenueKey = period === "today" ? "todayRevenue" : "monthlyRevenue";

  // Sort stalls by the relevant revenue (descending)
  const sorted = [...stallData].sort((a, b) => b[revenueKey] - a[revenueKey]);
  const visible = sorted.slice(0, stallVisibleCounts[period]);
  const hasMore = stallVisibleCounts[period] < sorted.length;
  const loadMoreButton = hasMore
    ? `<button class="loadMoreButton" data-period="${period}">${loadingIcon} Load next 10</button>`
    : "";

  if (sorted.length === 0) {
    return `<div class="stallListSection"><p style="color:#595959;padding:1rem 0;font-size:0.9rem;">No stalls found for this centre.</p></div>`;
  }

  return `
        <div class="stallListSection">
            ${visible.map(renderStallRow).join("")}
            ${loadMoreButton}
        </div>
    `;
}

function renderStallContent() {
  const satisfactionDisplay =
    customerSatisfaction > 0 ? `${customerSatisfaction}/10` : "N/A";

  // Top 3 by today's revenue
  const topToday = [...stallData]
    .sort((a, b) => b.todayRevenue - a.todayRevenue)
    .slice(0, 3);

  // Top 3 by monthly revenue
  const topMonthly = [...stallData]
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)
    .slice(0, 3);

  return `
        <div class="quickStats">
            <div class="quickStatsHeader">
                <span class="sectionLabel">Quick Stats</span>
                ${moreInfoIcon}
            </div>
            <div class="quickStatsBlocks">
                <div class="statBlock">
                    <div class="statBlockTop">
                        <span class="statBlockLabel">Today</span>
                        <span class="statBlockValue">S${formatCurrency(todayRevenue)}</span>
                        <span class="topStoresSubtitle">Top stores by revenue</span>
                        <div class="topStoresCards">
                            ${topToday.map((s) => renderTopStoreCard(s, "todayRevenue")).join("")}
                        </div>
                    </div>
                    ${renderStallList("today")}
                </div>
                <div class="statBlock">
                    <div class="statBlockTop">
                        <span class="statBlockLabel">Monthly</span>
                        <span class="statBlockValue">S${formatCurrency(monthlyRevenue)}</span>
                        <span class="topStoresSubtitle">Top stores by revenue</span>
                        <div class="topStoresCards">
                            ${topMonthly.map((s) => renderTopStoreCard(s, "monthlyRevenue")).join("")}
                        </div>
                    </div>
                    ${renderStallList("monthly")}
                </div>
                <div class="statBlock">
                    <span class="statBlockLabel">Customer Satisfaction</span>
                    <span class="statBlockValue">${satisfactionDisplay}</span>
                    <span class="statBlockPlaceholder">Imagine A Donut Graph Here</span>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// LOAD MORE / PAGINATION
// ============================================

function bindLoadMoreButtons() {
  document.querySelectorAll(".loadMoreButton").forEach((button) => {
    button.addEventListener("click", () => {
      const period = button.dataset.period;
      stallVisibleCounts[period] += 10;
      renderDashboard("stall");
    });
  });
}

// ============================================
// MAIN RENDER
// ============================================

function renderDashboard(tab) {
  activeTab = tab;
  const container = document.getElementById("dashboardContent");
  if (!container) return;

  container.innerHTML =
    tab === "stall" ? renderStallContent() : renderCentreContent();

  if (tab === "stall") {
    bindLoadMoreButtons();
  }
}

// ============================================
// BOOTSTRAP
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  // Tab switching via segmented control
  document.querySelectorAll('input[name="dashboardTab"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      renderDashboard(radio.value);
    });
  });

  // Keyboard shortcut hint (Cmd/Ctrl + K)
  const isMac = window.navigator.userAgentData
    ? window.navigator.userAgentData.platform === "macOS"
    : /Mac/i.test(window.navigator.userAgent);

  const keyModEl = document.getElementById("searchKeyMod");
  if (keyModEl) keyModEl.textContent = isMac ? "\u2318" : "CTRL";

  document.addEventListener("keydown", (e) => {
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    if (modifier && e.key === "k") {
      e.preventDefault();
      const input = document.getElementById("searchInput");
      if (input) input.focus();
    }
  });

  // Auth gate — wait for Firebase auth to resolve, then load data
  onAuthStateChanged(auth, (user) => {
    if (user) {
      initDashboard(user);
    } else {
      // Not logged in — redirect to login (or show message)
      const container = document.getElementById("dashboardContent");
      if (container) {
        container.innerHTML = `<div class="emptyState" style="padding:3rem;text-align:center;color:#595959;">
          <p>You are not signed in.</p>
          <p style="font-size:0.85rem;margin-top:0.5rem;"><a href="../../Pages/Auth/login.html">Sign in</a> to view your dashboard.</p>
        </div>`;
      }
    }
  });
});
