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
import { disruptor } from "../../firebase/services/disruptor.js";
import { initNotificationBadge } from "../../assets/js/notificationBadge.js";
import {
  initToastContainer,
  subscribeToNewNotifications,
} from "../../assets/js/toastNotifications.js";

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

/** Centre-level chart data (today hourly + monthly daily), updated by snapshot */
let centreChartData = null;

/** Whether Google Charts corechart package has finished loading */
let chartsReady = false;

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
 * Aggregate completed orders into chart-ready time-series arrays.
 * Returns { today: { labels, values }, monthly: { labels, values } }
 */
function aggregateCentreChartData(orders) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDate();
  const startOfToday = getStartOfToday();
  const startOfMonth = getStartOfMonth();

  // Today: 24 hourly slots
  const hourLabels = [
    "12am",
    "1am",
    "2am",
    "3am",
    "4am",
    "5am",
    "6am",
    "7am",
    "8am",
    "9am",
    "10am",
    "11am",
    "12pm",
    "1pm",
    "2pm",
    "3pm",
    "4pm",
    "5pm",
    "6pm",
    "7pm",
    "8pm",
    "9pm",
    "10pm",
    "11pm",
  ];
  const hourRevenue = new Array(24).fill(0);

  // Monthly: days 1..lastDay
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayLabels = Array.from({ length: lastDay }, (_, i) => String(i + 1));
  const dayRevenue = new Array(lastDay).fill(0);

  for (const order of orders) {
    if (order.status !== "completed") continue;
    const d = toDate(order.createdAt);
    if (!d) continue;
    const total = typeof order.total === "number" ? order.total : 0;

    if (d >= startOfToday) {
      hourRevenue[d.getHours()] += total;
    }
    if (d >= startOfMonth) {
      dayRevenue[d.getDate() - 1] += total;
    }
  }

  // Null-out future slots so the line stops at the current point
  const todayValues = hourLabels.map((_, i) =>
    i > currentHour ? null : Math.round(hourRevenue[i] * 100) / 100,
  );
  const monthlyValues = dayLabels.map((_, i) =>
    i + 1 > currentDay ? null : Math.round(dayRevenue[i] * 100) / 100,
  );

  return {
    today: { labels: hourLabels, values: todayValues },
    monthly: { labels: dayLabels, values: monthlyValues },
  };
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

    // Compute chart time-series data
    centreChartData = aggregateCentreChartData(allOrders);

    // Re-enrich stall data with updated revenue
    stallData = enrichStalls(rawStallCache);

    // Re-render whichever tab is showing
    renderDashboard(activeTab);

    // Notify disruptor so future chart subscribers auto-update
    disruptor.emit("operator:charts:invalidated");
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
// CHARTS (Google Charts — same pattern as operatorChildrenDetail.js)
// ============================================

function getChartOptions(color) {
  return {
    curveType: "function",
    legend: { position: "none" },
    chartArea: {
      left: 60,
      top: 20,
      right: 20,
      bottom: 40,
      width: "100%",
      height: "100%",
    },
    hAxis: {
      textStyle: { fontName: "Aptos", fontSize: 12, color: "#808080" },
      gridlines: { color: "transparent" },
    },
    vAxis: {
      textStyle: { fontName: "Aptos", fontSize: 12, color: "#808080" },
      gridlines: { color: "#e0e0e0" },
      minorGridlines: { count: 0 },
    },
    colors: [color],
    lineWidth: 2,
    pointSize: 5,
    backgroundColor: "transparent",
    fontName: "Aptos",
    tooltip: { textStyle: { fontName: "Aptos", fontSize: 13 } },
  };
}

function drawSingleChart(labels, values, color, elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const header = ["Label", "Value"];
  const rows = labels.map((label, i) => [label, values[i]]);
  const data = google.visualization.arrayToDataTable([header, ...rows]);

  const chart = new google.visualization.LineChart(el);
  chart.draw(data, getChartOptions(color));
}

function drawCentreCharts() {
  if (!centreChartData) return;
  drawSingleChart(
    centreChartData.today.labels,
    centreChartData.today.values,
    "#913b9f",
    "chartTodayRevenue",
  );
  drawSingleChart(
    centreChartData.monthly.labels,
    centreChartData.monthly.values,
    "#913b9f",
    "chartMonthlyRevenue",
  );
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

function renderStarRating(rating) {
  if (rating <= 0) return "";
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      // Full star
      stars.push(
        `<svg class="starIcon" width="24" height="24" viewBox="0 0 24 24" fill="#913b9f" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>`,
      );
    } else if (rating >= i - 0.5) {
      // Half star — left half filled, right half empty
      stars.push(`<svg class="starIcon" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <defs><clipPath id="halfStar${i}"><rect x="0" y="0" width="12" height="24"/></clipPath></defs>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" fill="#e0e0e0"/>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" fill="#913b9f" clip-path="url(#halfStar${i})"/>
      </svg>`);
    } else {
      // Empty star
      stars.push(
        `<svg class="starIcon" width="24" height="24" viewBox="0 0 24 24" fill="#e0e0e0" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>`,
      );
    }
  }
  return `<div class="starRating">${stars.join("")}</div>`;
}

function renderCentreContent() {
  const satisfactionDisplay =
    customerSatisfaction > 0 ? `${customerSatisfaction}/5` : "N/A";

  const starRating = renderStarRating(customerSatisfaction);

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
                    <div class="chartContainer" id="chartTodayRevenue"></div>
                </div>
                <div class="statBlock">
                    <span class="statBlockLabel">Monthly</span>
                    <span class="statBlockValue">S${formatCurrency(monthlyRevenue)}</span>
                    <div class="chartContainer" id="chartMonthlyRevenue"></div>
                </div>
                <div class="statBlock">
                    <span class="statBlockLabel">Customer Satisfaction</span>
                    <span class="statBlockValue">${satisfactionDisplay}</span>
                    ${starRating}
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
    customerSatisfaction > 0 ? `${customerSatisfaction}/5` : "N/A";

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

  if (tab === "centre" && centreChartData && chartsReady) {
    requestAnimationFrame(drawCentreCharts);
  }
}

// ============================================
// BOOTSTRAP
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  // Load Google Charts — draw pending charts once the package is ready
  google.charts.load("current", { packages: ["corechart"] });
  google.charts.setOnLoadCallback(() => {
    chartsReady = true;
    if (activeTab === "centre" && centreChartData) {
      drawCentreCharts();
    }
  });

  // Tab switching via segmented control
  document.querySelectorAll('input[name="dashboardTab"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      renderDashboard(radio.value);
    });
  });

  // Auth gate — wait for Firebase auth to resolve, then load data
  onAuthStateChanged(auth, (user) => {
    if (user) {
      initNotificationBadge(`operators/${user.uid}/notifications`);
      initToastContainer();
      subscribeToNewNotifications(`operators/${user.uid}/notifications`);
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

// Cleanup subscriptions and disruptor on page unload
window.addEventListener("beforeunload", () => {
  if (ordersUnsubscribe) ordersUnsubscribe();
  disruptor.destroy();
});
