import { db, auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { app } from "../../firebase/config.js";
import { disruptor } from "../../firebase/services/disruptor.js";
import { showConfirm } from "../../assets/js/toast.js";
import { getStallById } from "../../firebase/services/foodStalls.js";
import { resolveFeedbackWithResponse } from "../../firebase/services/feedback.js";
import { initNotificationBadge } from "../../assets/js/notificationBadge.js";
import {
  initToastContainer,
  subscribeToNewNotifications,
} from "../../assets/js/toastNotifications.js";

// ============================================
// STATE
// ============================================

let currentStallId = null;
let currentStallData = null;
let realReviews = [];
let selectedReviewId = null;
let selectedReviewData = null;
let completedOrders = [];
let chartData = null;
let topItemsBySales = [];
let topItemsByLikes = [];
let completedOrdersUnsubscribe = null;
let menuLikesUnsubscribe = null;
let reviewsUnsubscribe = null;
let isReviewAnimating = false;
let pendingReviewSnapshot = null;

const tagIcons = {
  Halal: "../../assets/icons/halal.png",
  Kosher: "../../assets/icons/kosher.svg",
};

function renderTag(tag) {
  const icon = tagIcons[tag];
  if (icon) {
    return `<span class="storeTag ${tag.toLowerCase()}"><img class="storeTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="storeTag">${tag}</span>`;
}

// ============================================
// DATA FETCHING & AGGREGATION
// ============================================

function aggregateChartData(orders) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const todayStart = new Date(currentYear, now.getMonth(), now.getDate());
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
  const dayRevenue = new Array(24).fill(0);
  const dayQty = new Array(24).fill(0);

  const monthLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthRevenue = new Array(12).fill(0);
  const monthQty = new Array(12).fill(0);

  const yearMap = {};

  orders.forEach((order) => {
    const d = order.createdAt;
    const itemQty = order.items.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0,
    );

    if (d >= todayStart) {
      const hour = d.getHours();
      dayRevenue[hour] += order.total;
      dayQty[hour] += itemQty;
    }

    if (d.getFullYear() === currentYear) {
      const month = d.getMonth();
      monthRevenue[month] += order.total;
      monthQty[month] += itemQty;
    }

    const year = d.getFullYear();
    if (!yearMap[year]) yearMap[year] = { revenue: 0, qty: 0 };
    yearMap[year].revenue += order.total;
    yearMap[year].qty += itemQty;
  });

  const dayRevenueChart = hourLabels.map((_, i) =>
    i > currentHour ? null : Math.round(dayRevenue[i] * 100) / 100,
  );
  const dayQtyChart = hourLabels.map((_, i) =>
    i > currentHour ? null : dayQty[i],
  );

  const monthRevenueChart = monthLabels.map((_, i) =>
    i > currentMonth ? null : Math.round(monthRevenue[i] * 100) / 100,
  );
  const monthQtyChart = monthLabels.map((_, i) =>
    i > currentMonth ? null : monthQty[i],
  );

  const sortedYears = Object.keys(yearMap).sort();
  const yearLabels =
    sortedYears.length > 0 ? sortedYears : [String(currentYear)];
  const yearRevenueChart = yearLabels.map(
    (y) => Math.round((yearMap[y]?.revenue || 0) * 100) / 100,
  );
  const yearQtyChart = yearLabels.map((y) => yearMap[y]?.qty || 0);

  return {
    day: { labels: hourLabels, revenue: dayRevenueChart, qty: dayQtyChart },
    month: {
      labels: monthLabels,
      revenue: monthRevenueChart,
      qty: monthQtyChart,
    },
    year: { labels: yearLabels, revenue: yearRevenueChart, qty: yearQtyChart },
  };
}

function buildTopItemsBySales(orders) {
  const itemMap = {};
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const key = item.menuItemId || item.name;
      if (!itemMap[key]) {
        itemMap[key] = {
          name: item.name || "Unknown Item",
          imageUrl: item.imageUrl || "",
          unitPrice: item.unitPrice || 0,
          count: 0,
          revenue: 0,
        };
      }
      itemMap[key].count += item.quantity || 0;
      itemMap[key].revenue += item.totalPrice || 0;
    });
  });

  return Object.values(itemMap).sort((a, b) => b.count - a.count);
}

function subscribeToCompletedOrders(stallId) {
  if (completedOrdersUnsubscribe) {
    completedOrdersUnsubscribe();
    completedOrdersUnsubscribe = null;
  }

  const q = query(collection(db, "orders"), where("stallId", "==", stallId));

  completedOrdersUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
      completedOrders = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            total: data.total || 0,
            status: data.status || "",
            items: data.items || [],
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          };
        })
        .filter((o) => o.status === "ready" || o.status === "completed");

      chartData = aggregateChartData(completedOrders);
      topItemsBySales = buildTopItemsBySales(completedOrders);
      disruptor.emit("operator:detail:invalidated");
    },
    (error) => {
      console.error("Error in completed orders listener:", error);
      completedOrders = [];
      chartData = aggregateChartData([]);
      topItemsBySales = [];
    },
  );
}

function subscribeToMenuItemLikes(stallId) {
  if (menuLikesUnsubscribe) {
    menuLikesUnsubscribe();
    menuLikesUnsubscribe = null;
  }

  const menuRef = collection(db, "foodStalls", stallId, "menuItems");

  menuLikesUnsubscribe = onSnapshot(
    menuRef,
    (snapshot) => {
      topItemsByLikes = snapshot.docs
        .map((d) => ({
          id: d.id,
          name: d.data().name || "Unknown Item",
          imageUrl: d.data().imageUrl || "",
          unitPrice: d.data().price || 0,
          likesCount: d.data().likesCount || 0,
        }))
        .filter((item) => item.likesCount > 0)
        .sort((a, b) => b.likesCount - a.likesCount);
      disruptor.emit("operator:detail:invalidated");
    },
    (error) => {
      console.error("Error in menu item likes listener:", error);
      topItemsByLikes = [];
    },
  );
}

function getRent() {
  if (currentStallData && currentStallData.rent) {
    return currentStallData.rent[currentTimeframe] || 0;
  }
  return 0;
}

// ============================================
// CHARTS
// ============================================

// Tracks the currently selected timeframe for charts (day, month, year)
let currentTimeframe = "month";

// Shared chart styling options used by all 3 charts
function getChartOptions(color) {
  return {
    curveType: "function",
    // Hide legend since each chart has its own label
    legend: { position: "none" },
    // Chart area sizing — leave room for axis labels
    chartArea: {
      left: 60,
      top: 20,
      right: 20,
      bottom: 40,
      width: "100%",
      height: "100%",
    },
    // X-axis: grey text, no vertical gridlines
    hAxis: {
      textStyle: { fontName: "Aptos", fontSize: 12, color: "#808080" },
      gridlines: { color: "transparent" },
    },
    // Y-axis: grey text, light horizontal gridlines
    vAxis: {
      textStyle: { fontName: "Aptos", fontSize: 12, color: "#808080" },
      gridlines: { color: "#e0e0e0" },
      minorGridlines: { count: 0 },
    },
    // Single line color passed in per chart
    colors: [color],
    lineWidth: 2,
    pointSize: 5,
    backgroundColor: "transparent",
    fontName: "Aptos",
    tooltip: { textStyle: { fontName: "Aptos", fontSize: 13 } },
  };
}

// Draws a single Google LineChart into a given container element
// labels: x-axis labels array, values: y-axis data array, color: line color, elementId: DOM id
function drawSingleChart(labels, values, color, elementId) {
  // Build data table: first column is label (string), second is the value
  const header = ["Label", "Value"];
  const rows = labels.map((label, index) => [label, values[index]]);
  const data = google.visualization.arrayToDataTable([header, ...rows]);

  const el = document.getElementById(elementId);
  if (!el) return; // Safety check if element doesn't exist yet

  const chart = new google.visualization.LineChart(el);
  chart.draw(data, getChartOptions(color));
}

// Draws a single Google ColumnChart (bar graph) into a given container element
function drawBarChart(labels, values, color, elementId) {
  const header = ["Label", "Value"];
  const rows = labels.map((label, index) => [label, values[index]]);
  const data = google.visualization.arrayToDataTable([header, ...rows]);

  const el = document.getElementById(elementId);
  if (!el) return;

  const options = getChartOptions(color);
  options.bar = { groupWidth: "60%" };

  const chart = new google.visualization.ColumnChart(el);
  chart.draw(data, options);
}

// Draws all 3 charts using the currently selected timeframe's data
function drawAllCharts() {
  if (!chartData) return;

  const tf = chartData[currentTimeframe];
  const rent = getRent();

  // Chart 1: Sales by Value ($) — purple line
  drawSingleChart(tf.labels, tf.revenue, "#913b9f", "chartSalesByValue");

  // Chart 2: Sales by Product Qty — dark red bar chart
  drawBarChart(tf.labels, tf.qty, "#6b1d1d", "chartSalesByQty");

  // Chart 3: Profit after Rent — cumulative revenue minus rent
  const profitData = [];
  let cumulativeSales = 0;
  for (let i = 0; i < tf.revenue.length; i++) {
    if (tf.revenue[i] === null) {
      profitData.push(null);
    } else {
      cumulativeSales += tf.revenue[i];
      profitData.push(Math.round((cumulativeSales - rent) * 100) / 100);
    }
  }
  drawSingleChart(tf.labels, profitData, "#e67e22", "chartProfitAfterRent");
}

// Updates the chart total labels to reflect the current timeframe's data
function updateChartTotals() {
  if (!chartData) return;

  const tf = chartData[currentTimeframe];
  const rent = getRent();
  const totalRevenue = tf.revenue.reduce((sum, v) => sum + (v || 0), 0);
  const totalQty = tf.qty.reduce((sum, v) => sum + (v || 0), 0);

  const totals = document.querySelectorAll(".chartTotal");
  if (totals.length >= 3) {
    totals[0].textContent = `$${totalRevenue.toLocaleString()}`;
    totals[1].textContent = `${totalQty.toLocaleString()} items`;
    totals[2].textContent = `$${(totalRevenue - rent).toLocaleString()}`;
  }
}

// Binds the Day/Month/Year segmented control radio buttons to redraw charts on change
function bindTimeframeTabs() {
  document.querySelectorAll('input[name="timeframeTab"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      // Update the current timeframe to the selected value
      currentTimeframe = e.target.value;
      // Recompute and update the chart totals displayed above each chart
      updateChartTotals();
      // Redraw all charts with the new timeframe data
      drawAllCharts();
    });
  });
}

const loadingIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none">
  <path d="M7.1825 0.682617V3.28262M7.1825 11.0826V13.6826M2.58699 2.58712L4.4265 4.42662M9.93849 9.93862L11.778 11.7781M0.682495 7.18262H3.2825M11.0825 7.18262H13.6825M2.58699 11.7781L4.4265 9.93862M9.93849 4.42662L11.778 2.58712" stroke="#595959" stroke-width="1.365" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const ITEMS_INITIAL = 1;
const ITEMS_PER_LOAD = 3;
const visibleCounts = { sales: ITEMS_INITIAL, likes: ITEMS_INITIAL };

function renderSalesItemCard(item) {
  const imgSrc = item.imageUrl || "";
  const imgHTML = imgSrc
    ? `<img class="topItemImage" src="${imgSrc}" alt="${item.name}" onerror="this.style.display='none'" />`
    : `<div class="topItemImage"></div>`;
  return `
    <div class="topItemCard">
      ${imgHTML}
      <span class="topItemName">${item.name}</span>
      <span class="topItemPrice">$${item.unitPrice.toFixed(2)}</span>
      <span class="topItemStat">${item.count} sold</span>
    </div>
  `;
}

function renderLikesItemCard(item) {
  const imgSrc = item.imageUrl || "";
  const imgHTML = imgSrc
    ? `<img class="topItemImage" src="${imgSrc}" alt="${item.name}" onerror="this.style.display='none'" />`
    : `<div class="topItemImage"></div>`;
  return `
    <div class="topItemCard">
      ${imgHTML}
      <span class="topItemName">${item.name}</span>
      <span class="topItemPrice">$${item.unitPrice.toFixed(2)}</span>
      <span class="topItemStat">${item.likesCount} like${item.likesCount !== 1 ? "s" : ""}</span>
    </div>
  `;
}

function renderTopItemSection(type, badge, title, items, cardRenderer) {
  if (items.length === 0) {
    return `
      <div class="topItemSection">
        <div class="topItemHeader">
          ${badge}
          <span class="topItemTitle">${title}</span>
        </div>
        <p class="topItemEmpty">No data yet</p>
      </div>
    `;
  }

  const visible = items.slice(0, visibleCounts[type]);
  const hasMore = visibleCounts[type] < items.length;
  const loadMoreButton = hasMore
    ? `<button class="loadMoreButton" data-type="${type}">${loadingIcon} Load next 3</button>`
    : "";
  return `
    <div class="topItemSection">
      <div class="topItemHeader">
        ${badge}
        <span class="topItemTitle">${title}</span>
      </div>
      ${visible.map(cardRenderer).join("")}
      ${loadMoreButton}
    </div>
  `;
}

function bindLoadMoreButtons() {
  document.querySelectorAll(".loadMoreButton").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.type;
      visibleCounts[type] += ITEMS_PER_LOAD;
      renderPage();
    });
  });
}

// Reviews icon
const reviewsIcon = `<svg class="reviewsHeaderIcon" xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52" fill="none">
  <path d="M12.1849 20.0754C10.7953 20.0754 9.66877 21.202 9.66877 22.5915C9.66877 23.9811 10.7953 25.1077 12.1849 25.1077V20.0754ZM31.5254 25.1077C32.9153 25.1077 34.0415 23.9811 34.0415 22.5915C34.0415 21.202 32.9153 20.0754 31.5254 20.0754V25.1077ZM14.5937 27.1474C13.2041 27.1474 12.0775 28.274 12.0775 29.6635C12.0775 31.0531 13.2041 32.1797 14.5937 32.1797V27.1474ZM29.1066 32.1797C30.4965 32.1797 31.6227 31.0531 31.6227 29.6635C31.6227 28.274 30.4965 27.1474 29.1066 27.1474V32.1797ZM10.5521 8.46185C9.18151 8.69105 8.25625 9.98793 8.48545 11.3585C8.71465 12.7291 10.0115 13.6544 11.3821 13.4252L10.5521 8.46185ZM12.6445 10.806L12.6393 13.3221H12.6445V10.806ZM31.096 10.806L31.1151 8.28984H31.096V10.806ZM41.2142 21.0751L38.6981 21.0567V21.0751H41.2142ZM38.5759 34.944C38.3331 36.3125 39.2456 37.6182 40.614 37.8611C41.9821 38.1036 43.2882 37.1911 43.5307 35.823L38.5759 34.944ZM11.4044 13.4213C12.7729 13.1798 13.6865 11.8747 13.4449 10.5062C13.2034 9.13771 11.8982 8.22416 10.5298 8.4657L11.4044 13.4213ZM2.51625 21.0718H5.03245L5.03235 21.0584L2.51625 21.0718ZM2.51625 49.4839H0.000120215C0.000120215 50.3773 0.473723 51.2036 1.2445 51.6548C2.01527 52.1064 2.96764 52.1155 3.74677 51.6787L2.51625 49.4839ZM12.6344 43.8109V41.2948C12.2035 41.2948 11.7798 41.4055 11.404 41.6162L12.6344 43.8109ZM31.0859 43.8109V46.327H31.1027L31.0859 43.8109ZM43.5119 35.826C43.7508 34.4573 42.8346 33.1539 41.4658 32.915C40.0967 32.6762 38.7933 33.592 38.5545 34.9612L43.5119 35.826ZM8.488 10.5134C8.25048 11.8826 9.16782 13.1851 10.537 13.4226C11.9062 13.6602 13.2087 12.7428 13.4462 11.3736L8.488 10.5134ZM20.9241 2.51616V0L20.9097 6.71879e-05L20.9241 2.51616ZM39.3757 2.51616L39.3972 3.3594e-05H39.3757V2.51616ZM49.4839 12.7853L46.9677 12.767V12.7853H49.4839ZM49.4839 25.2519H46.9677L46.9681 25.2687L49.4839 25.2519ZM40.5959 32.9157C39.2275 33.1573 38.3139 34.4623 38.5555 35.8311C38.797 37.1995 40.1021 38.113 41.4705 37.8715L40.5959 32.9157ZM12.1849 25.1077H31.5254V20.0754H12.1849V25.1077ZM14.5937 32.1797H29.1066V27.1474H14.5937V32.1797ZM11.3821 13.4252C11.7976 13.3557 12.2181 13.3212 12.6393 13.3221L12.6497 8.28984C11.9469 8.2884 11.2453 8.34594 10.5521 8.46185L11.3821 13.4252ZM12.6445 13.3221H31.096V8.28984H12.6445V13.3221ZM31.0772 13.322C35.3174 13.354 38.7289 16.8167 38.6981 21.0567L43.7303 21.0936C43.7813 14.0746 38.1338 8.34278 31.1151 8.28984L31.0772 13.322ZM38.6981 21.0751V33.5417H43.7303V21.0751H38.6981ZM38.6981 33.5417C38.6987 34.0107 38.6578 34.4821 38.5759 34.944L43.5307 35.823C43.6646 35.0689 43.7313 34.3076 43.7303 33.5417H38.6981ZM10.5298 8.4657C4.41412 9.54509 -0.0332603 14.8752 0.000187403 21.0852L5.03235 21.0584C5.01212 17.3001 7.7035 14.0746 11.4044 13.4213L10.5298 8.4657ZM0.000120215 21.0718V49.4839H5.03238L5.03245 21.0718H0.000120215ZM3.74677 51.6787L13.865 46.0056L11.404 41.6162L1.28576 47.2892L3.74677 51.6787ZM12.6344 46.327H31.0859V41.2948H12.6344V46.327ZM31.1027 46.327C37.2337 46.2868 42.4578 41.8661 43.5119 35.826L38.5545 34.9612C37.9187 38.6042 34.7675 41.2706 31.0695 41.2948L31.1027 46.327ZM13.4462 11.3736C14.0793 7.72475 17.2354 5.05353 20.9389 5.03226L20.9097 6.71879e-05C14.7701 0.0353266 9.53756 4.46395 8.488 10.5134L13.4462 11.3736ZM20.9241 5.03229H39.3757V3.3594e-05L20.9241 0V5.03229ZM39.3543 5.03219C43.5918 5.06836 46.9986 8.52978 46.9677 12.767L52 12.8036C52.051 5.78968 46.4112 0.0598504 39.3972 3.3594e-05L39.3543 5.03219ZM46.9677 12.7853V25.2519H52V12.7853H46.9677ZM46.9681 25.2687C46.9932 29.0308 44.3006 32.2619 40.5959 32.9157L41.4705 37.8715C47.5924 36.7909 52.0416 31.4513 52 25.2351L46.9681 25.2687Z" fill="#341539"/>
</svg>`;

// Review resolve icon
const reviewAckIcon = `<img class="reviewAckIcon" src="../../assets/icons/resolveReview.svg" alt="Resolve" />`;

let currentReviewTab = "new";

function renderStars(count) {
  let html = "";
  for (let index = 0; index < 5; index++) {
    html +=
      index < count
        ? `<span class="reviewStar filled">\u2605</span>`
        : `<span class="reviewStar">\u2605</span>`;
  }
  return html;
}

function formatTimeAgo(date) {
  if (!date) return "";
  const now = new Date();
  const d =
    date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 60) return "1 month ago";
  return `${Math.floor(diffDays / 30)} months ago`;
}

function getSentimentTag(sentiment) {
  const config = {
    positive: { label: "Positive", className: "sentimentPositive" },
    negative: { label: "Negative", className: "sentimentNegative" },
    neutral: { label: "Neutral", className: "sentimentNeutral" },
  };
  const c = config[sentiment] || config.neutral;
  return `<span class="sentimentTag ${c.className}">
    <img src="../../assets/icons/hawkrAi.svg" alt="HawkrAI" class="sentimentAiIcon" />
    ${c.label}
  </span>`;
}

function renderReviewCard(review) {
  const body =
    review.text || review.comment || review.body || "No comment provided.";
  const bodyHtml = body
    .split("\n\n")
    .map((p) => `<p>${p}</p>`)
    .join("");
  const title =
    review.title ||
    (review.tags && review.tags.length > 0 ? review.tags[0] : "Review");
  const rating = review.rating || review.stars || 0;
  const author = review.customerName || review.author || "Anonymous";
  const timeAgo = formatTimeAgo(review.createdAt || review.date);
  const sentimentTag = review.sentiment
    ? getSentimentTag(review.sentiment)
    : "";
  const status = review.resolution ? "resolved" : "new";

  const resolveButton =
    status === "new"
      ? `<button class="reviewResolveBtn" data-review-id="${review.id}" title="Resolve review">${reviewAckIcon}</button>`
      : `<span class="reviewResolvedBadge">Resolved</span>`;

  return `
    <div class="reviewCard" data-review-id="${review.id}">
      <div class="reviewCardTop">
        <span class="reviewTitle">${title}</span>
        ${sentimentTag}
        ${resolveButton}
      </div>
      <div class="reviewBody">${bodyHtml}</div>
      <div class="reviewMeta">
        <span class="reviewStars">${renderStars(rating)}</span>
        <span class="reviewDate">${timeAgo}</span>
        <span class="reviewMetaDot">&bull;</span>
        <span class="reviewAuthor">By ${author}</span>
      </div>
    </div>
  `;
}

function renderReviewsSection(reviews) {
  const filtered = reviews.filter((review) => {
    const status = review.resolution ? "resolved" : "new";
    return status === currentReviewTab;
  });

  const emptyText =
    filtered.length === 0
      ? `<span class="reviewsEmpty">No ${currentReviewTab} reviews.</span>`
      : "";

  return `
    <div class="reviewsSection">
      <div class="reviewsHeader">
        <div class="reviewsHeaderLeft">
          ${reviewsIcon}
          <span class="reviewsTitle">Reviews</span>
        </div>
        <div class="segmentedControl reviewsSegmented">
          <label class="segmentedButton">
            <input type="radio" name="reviewTab" value="new" ${currentReviewTab === "new" ? "checked" : ""} />
            New
          </label>
          <label class="segmentedButton">
            <input type="radio" name="reviewTab" value="resolved" ${currentReviewTab === "resolved" ? "checked" : ""} />
            Resolved
          </label>
        </div>
      </div>
      <div class="reviewCards">
        ${emptyText}
        ${filtered.map(renderReviewCard).join("")}
      </div>
    </div>
  `;
}

function bindReviewTabs() {
  document.querySelectorAll('input[name="reviewTab"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      currentReviewTab = e.target.value;
      const container = document.querySelector(".reviewCards");
      const filtered = realReviews.filter((review) => {
        const status = review.resolution ? "resolved" : "new";
        return status === currentReviewTab;
      });
      const emptyText =
        filtered.length === 0
          ? `<span class="reviewsEmpty">No ${currentReviewTab} reviews.</span>`
          : "";
      container.innerHTML = emptyText + filtered.map(renderReviewCard).join("");
      bindResolveButtons();
    });
  });
}

function bindResolveButtons() {
  document.querySelectorAll(".reviewResolveBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const reviewId = btn.dataset.reviewId;
      openResolveModal(reviewId);
    });
  });
}

// ============================================
// LIVE REVIEWS SUBSCRIPTION
// ============================================

function subscribeToReviews(stallId) {
  if (reviewsUnsubscribe) {
    reviewsUnsubscribe();
    reviewsUnsubscribe = null;
  }

  const q = query(
    collection(db, "feedback"),
    where("stallId", "==", stallId),
    orderBy("createdAt", "desc"),
    limit(50),
  );

  // Track previous IDs — same pattern as vendor order line
  let previousNewIds = new Set();
  let previousAllIds = new Set();
  let isFirstSnapshot = true;

  reviewsUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const processSnapshot = () => {
        const newReviews = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const currentAllIds = new Set(newReviews.map((r) => r.id));
        const currentNewIds = new Set(
          newReviews.filter((r) => !r.resolution).map((r) => r.id),
        );

        // Detect arrivals and resolves (skip on first snapshot)
        const arrivedIds = isFirstSnapshot
          ? []
          : [...currentAllIds].filter((id) => !previousAllIds.has(id));
        const resolvedIds = isFirstSnapshot
          ? []
          : [...previousNewIds].filter(
              (id) => !currentNewIds.has(id) && currentAllIds.has(id),
            );

        // Update state
        realReviews = newReviews;

        const container = document.querySelector(".reviewCards");
        const onNewTab = currentReviewTab === "new";

        // --- RESOLVE: animate out BEFORE re-rendering (card must stay in DOM) ---
        if (resolvedIds.length > 0 && container && onNewTab) {
          isReviewAnimating = true;
          let totalCards = 0;
          let finishedCards = 0;

          resolvedIds.forEach((id) => {
            const card = container.querySelector(
              `.reviewCard[data-review-id="${id}"]`,
            );
            if (card) {
              totalCards++;
              card.style.setProperty("--card-height", card.offsetHeight + "px");
              card.classList.add("reviewCardSwipeOut");
              card.addEventListener(
                "animationend",
                () => {
                  card.classList.remove("reviewCardSwipeOut");
                  card.classList.add("reviewCardCollapse");
                  card.addEventListener(
                    "animationend",
                    () => {
                      finishedCards++;
                      if (finishedCards >= totalCards) {
                        isReviewAnimating = false;
                        refreshReviewCards();
                        if (pendingReviewSnapshot) {
                          const fn = pendingReviewSnapshot;
                          pendingReviewSnapshot = null;
                          fn();
                        }
                      }
                    },
                    { once: true },
                  );
                },
                { once: true },
              );
            }
          });

          if (totalCards === 0) {
            isReviewAnimating = false;
            refreshReviewCards();
          }
          setTimeout(() => {
            if (isReviewAnimating) {
              isReviewAnimating = false;
              refreshReviewCards();
              if (pendingReviewSnapshot) {
                const fn = pendingReviewSnapshot;
                pendingReviewSnapshot = null;
                fn();
              }
            }
          }, 1500);

          // --- ARRIVE: re-render first, then animate in ---
        } else if (arrivedIds.length > 0 && onNewTab) {
          const arrivedNew = arrivedIds.filter((id) => currentNewIds.has(id));
          refreshReviewCards();

          if (arrivedNew.length > 0 && container) {
            isReviewAnimating = true;
            let totalCards = 0;
            let finishedCards = 0;

            arrivedNew.forEach((id) => {
              const card = container.querySelector(
                `.reviewCard[data-review-id="${id}"]`,
              );
              if (card) {
                totalCards++;
                card.classList.add("reviewCardSlideIn");
                let animCount = 0;
                card.addEventListener("animationend", () => {
                  animCount++;
                  if (animCount >= 2) {
                    card.classList.remove("reviewCardSlideIn");
                    finishedCards++;
                    if (finishedCards >= totalCards) {
                      isReviewAnimating = false;
                      if (pendingReviewSnapshot) {
                        const fn = pendingReviewSnapshot;
                        pendingReviewSnapshot = null;
                        fn();
                      }
                    }
                  }
                });
              }
            });

            if (totalCards === 0) isReviewAnimating = false;
            setTimeout(() => {
              if (isReviewAnimating) {
                isReviewAnimating = false;
                if (pendingReviewSnapshot) {
                  const fn = pendingReviewSnapshot;
                  pendingReviewSnapshot = null;
                  fn();
                }
              }
            }, 1500);
          }

          // --- No animation needed ---
        } else {
          refreshReviewCards();
        }

        // Update tracked IDs at the end
        previousNewIds = currentNewIds;
        previousAllIds = currentAllIds;
        isFirstSnapshot = false;
      };

      // Queue if animating, otherwise process now
      if (isReviewAnimating) {
        pendingReviewSnapshot = processSnapshot;
      } else {
        processSnapshot();
      }
    },
    (error) => {
      console.error("Error in reviews listener:", error);
    },
  );
}

/**
 * Re-render just the review cards container without a full page render.
 */
function refreshReviewCards() {
  const container = document.querySelector(".reviewCards");
  if (!container) return;
  const filtered = realReviews.filter((review) => {
    const status = review.resolution ? "resolved" : "new";
    return status === currentReviewTab;
  });
  const emptyText =
    filtered.length === 0
      ? `<span class="reviewsEmpty">No ${currentReviewTab} reviews.</span>`
      : "";
  container.innerHTML = emptyText + filtered.map(renderReviewCard).join("");
  bindResolveButtons();
}

// ============================================
// RESOLVE MODAL
// ============================================

function openResolveModal(reviewId) {
  selectedReviewId = reviewId;
  selectedReviewData = realReviews.find((r) => r.id === reviewId);
  if (!selectedReviewData) return;

  const summary = document.getElementById("resolveReviewSummary");
  summary.innerHTML = `
    <span class="resolveCustomerName">${selectedReviewData.customerName || "Anonymous"}</span>
    <div class="resolveReviewStars">${renderStars(selectedReviewData.rating || 0)}</div>
    <span class="resolveReviewText">${selectedReviewData.text || selectedReviewData.comment || "No comment provided."}</span>
  `;

  document.getElementById("resolveResponseText").value = "";
  document.getElementById("resolveCharCount").textContent = "0";
  document.getElementById("resolveModal").hidden = false;
}

function closeResolveModal() {
  document.getElementById("resolveModal").hidden = true;
  document.getElementById("resolveResponseText").value = "";
  document.getElementById("resolveCharCount").textContent = "0";
  selectedReviewId = null;
  selectedReviewData = null;
}

async function handleResolveSubmit() {
  const response = document.getElementById("resolveResponseText").value.trim();
  if (!response) {
    alert("Please enter a response message");
    return;
  }

  const submitBtn = document.getElementById("submitResolve");
  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Processing...";

    await resolveFeedbackWithResponse(selectedReviewId, response, "none", 0);

    closeResolveModal();

    // onSnapshot will detect the change and animate the card out automatically
    showToast("Feedback resolved successfully");
  } catch (error) {
    console.error("Error resolving feedback:", error);
    alert("Failed to resolve feedback: " + (error.message || "Unknown error"));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Resolve Feedback";
  }
}

function showToast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function bindResolveModal() {
  document
    .getElementById("closeResolveModal")
    .addEventListener("click", closeResolveModal);
  document
    .getElementById("cancelResolve")
    .addEventListener("click", closeResolveModal);
  document
    .getElementById("submitResolve")
    .addEventListener("click", handleResolveSubmit);

  document
    .getElementById("resolveResponseText")
    .addEventListener("input", (e) => {
      document.getElementById("resolveCharCount").textContent =
        e.target.value.length;
    });

  document.getElementById("resolveModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeResolveModal();
  });
}

// Medal icon
function renderHygieneGrade(hygiene) {
  if (!hygiene || !hygiene.grade) {
    return `
      <div class="hygieneBlock">
        <span class="hygieneTitle">Hygiene Grade</span>
        <div class="docEmpty">No hygiene grade assigned.</div>
      </div>
    `;
  }

  const lastUpdated = hygiene.lastUpdated
    ? typeof hygiene.lastUpdated === "string"
      ? hygiene.lastUpdated
      : hygiene.lastUpdated.toDate
        ? hygiene.lastUpdated.toDate().toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Singapore",
          })
        : ""
    : "";

  return `
    <div class="hygieneBlock">
      <span class="hygieneTitle">Hygiene Grade</span>
      <div class="hygieneGradeRow">
        <span class="hygieneGrade">${hygiene.grade}</span>
      </div>
      ${lastUpdated ? `<div class="hygieneUpdatedRow"><span class="hygieneUpdated">Last updated ${lastUpdated}</span></div>` : ""}
      <div class="hygieneHistoryRow">
        <a class="hygieneHistory" href="operatorChildrenHygiene.html?id=${currentStallId}">view history &gt;</a>
      </div>
    </div>
  `;
}

/**
 * Build documents array from real stall data.
 * Falls back to empty states when no documents exist.
 */
function getStallDocuments() {
  const docs = [];

  // Rental Agreement
  const rental = currentStallData?.rentalAgreement;
  docs.push({
    title: "Rental Agreement",
    icon: "agreement",
    current: rental?.currentUrl
      ? {
          image: rental.currentUrl,
          filename: rental.filename || "rental_agreement.pdf",
        }
      : null,
    archived: (rental?.archived || []).map((a) => ({
      filename: a.filename || "rental_agreement.pdf",
      uploaded: a.uploadedAt?.toDate
        ? a.uploadedAt.toDate().toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Singapore",
          })
        : a.uploaded || "",
      replaced: a.replacedAt?.toDate
        ? a.replacedAt.toDate().toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Singapore",
          })
        : a.replaced || "",
      url: a.url || "#",
    })),
  });

  // Halal Cert
  const halal = currentStallData?.halalCert;
  docs.push({
    title: "Halal Cert",
    icon: "halal",
    current: halal?.currentUrl
      ? {
          image: halal.currentUrl,
          filename: halal.filename || "halal_cert.pdf",
        }
      : null,
    archived: (halal?.archived || []).map((a) => ({
      filename: a.filename || "halal_cert.pdf",
      uploaded: a.uploadedAt?.toDate
        ? a.uploadedAt.toDate().toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Singapore",
          })
        : a.uploaded || "",
      replaced: a.replacedAt?.toDate
        ? a.replacedAt.toDate().toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Singapore",
          })
        : a.replaced || "",
      url: a.url || "#",
    })),
  });

  return docs;
}

// Document icon map
const docIcons = {
  agreement: `<img class="docIcon" src="../../assets/icons/agreement.svg" alt="Agreement" />`,
  halal: `<img class="docIcon" src="../../assets/icons/halal.png" alt="Halal" />`,
};

const downloadIcon = `<img class="docDownloadIcon" src="../../assets/icons/download.svg" alt="Download" />`;

// Tracks which tab is active per document index
const docTabs = {};

// Renders the content area for a single document based on its active tab
function renderDocContent(doc, index) {
  const tab = docTabs[index] || "current";

  if (tab === "current") {
    if (!doc.current) {
      return `<div class="docEmpty">No document provided.</div>`;
    }
    return `
      <div class="docCurrentContent">
        <div class="docPreview">
          <img class="docImage" src="${doc.current.image}" alt="${doc.title}" />
        </div>
        <a class="docDownloadBtn" href="${doc.current.image}" download="${doc.current.filename}">${downloadIcon} Download</a>
      </div>
    `;
  }

  // Archived tab
  if (doc.archived.length === 0) {
    return `<div class="docEmpty">No archived documents.</div>`;
  }
  return `
    <div class="docArchiveList">
      ${doc.archived
        .map(
          (file) => `
        <div class="docArchiveItem">
          <div class="docArchiveRow">
            <span class="docArchiveFilename">${file.filename}</span>
            <a class="docDownloadBtn" href="${file.url}" download="${file.filename}">
              ${downloadIcon} Download
            </a>
          </div>
          <span class="docArchiveMeta">Uploaded ${file.uploaded} · Replaced ${file.replaced}</span>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderDocumentsSection(documents) {
  return documents
    .map((doc, index) => {
      // Initialise tab state
      if (!(index in docTabs)) docTabs[index] = "current";
      const tab = docTabs[index];

      return `
    <div class="docBlock">
      <div class="docHeaderRow">
        <div class="docHeader">
          ${docIcons[doc.icon] || ""}
          <span class="docTitle">${doc.title}</span>
        </div>
        <div class="segmentedControl docSegmented">
          <label class="segmentedButton">
            <input type="radio" name="docTab-${index}" value="current" ${tab === "current" ? "checked" : ""} data-doc-index="${index}" />
            Current
          </label>
          <label class="segmentedButton">
            <input type="radio" name="docTab-${index}" value="archived" ${tab === "archived" ? "checked" : ""} data-doc-index="${index}" />
            Archived
          </label>
        </div>
      </div>
      <div class="docContent" data-doc-content="${index}">
        ${renderDocContent(doc, index)}
      </div>
    </div>
  `;
    })
    .join("");
}

// Binds Current/Archived tab switching per document block
function bindDocTabs() {
  document.querySelectorAll(".docSegmented input").forEach((input) => {
    input.addEventListener("change", (e) => {
      const index = parseInt(e.target.dataset.docIndex);
      docTabs[index] = e.target.value;
      const container = document.querySelector(`[data-doc-content="${index}"]`);
      container.innerHTML = renderDocContent(getStallDocuments()[index], index);
    });
  });
}

const starBadge = `<img class="topItemIcon" src="../../assets/icons/medal.svg" alt="Medal" />`;

// Heart icon (red)
const heartBadge = `<svg class="topItemIcon" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 30C18 30 4 22 4 13C4 9 7 6 11 6C13.5 6 15.7 7.3 17 9.3C17.4 8.6 17.7 8.2 18 7.8C18.3 8.2 18.6 8.6 19 9.3C20.3 7.3 22.5 6 25 6C29 6 32 9 32 13C32 22 18 30 18 30Z" fill="#e53935"/>
</svg>`;

function renderPage() {
  const displayName = currentStallData?.name || "Loading...";
  const displayUen = currentStallData?.bizRegNo || "";
  const displayTags = (currentStallData?.cuisineNames || [])
    .map(renderTag)
    .join("");

  // Get current timeframe data for rendering totals in the chart headers
  const tf = chartData ? chartData[currentTimeframe] : { revenue: [], qty: [] };
  const rent = getRent();
  const totalRevenue = tf.revenue.reduce((sum, v) => sum + (v || 0), 0);
  const totalQty = tf.qty.reduce((sum, v) => sum + (v || 0), 0);

  document.getElementById("pageContent").innerHTML = `
    <div class="storeHeader">
      <div class="storeHeaderTop">
        <div class="storeHeaderInfo">
          <span class="storePerusing">Now Perusing:</span>
          <span class="storeName">${displayName}</span>
          <span class="storeUen">UEN: ${displayUen}</span>
        </div>
        <div class="storeHeaderRight">
          <button class="unlinkChildBtn" id="unlinkChildBtn">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            Unlink child
            <span class="unlinkKeyboard">${navigator.platform.includes("Mac") ? "\u2318" : "CTRL"} <span class="unlinkKeySep"></span> ⌫</span>
          </button>
          <div class="storeTags">${displayTags}</div>
        </div>
      </div>
    </div>

    <!-- Store Information section with timeframe toggle and 3 charts -->
    <div class="section">
      <!-- Header row: title on left, Day/Month/Year toggle on right -->
      <div class="sectionHeader">
        <span class="sectionTitle">Store Information</span>
        <!-- Segmented control for switching chart timeframe -->
        <div class="segmentedControl chartSegmented">
          <label class="segmentedButton">
            <input type="radio" name="timeframeTab" value="day" ${currentTimeframe === "day" ? "checked" : ""} />
            Day
          </label>
          <label class="segmentedButton">
            <input type="radio" name="timeframeTab" value="month" ${currentTimeframe === "month" ? "checked" : ""} />
            Month
          </label>
          <label class="segmentedButton">
            <input type="radio" name="timeframeTab" value="year" ${currentTimeframe === "year" ? "checked" : ""} />
            Year
          </label>
        </div>
      </div>

      <!-- Chart 1: Sales by dollar value -->
      <div class="chartBlock">
        <div class="chartBlockHeader">
          <span class="chartTotal">$${totalRevenue.toLocaleString()}</span>
          <span class="chartLabel">Sales by Value</span>
        </div>
        <div class="chartContainer" id="chartSalesByValue"></div>
      </div>

      <!-- Chart 2: Sales by number of items sold -->
      <div class="chartBlock">
        <div class="chartBlockHeader">
          <span class="chartTotal">${totalQty.toLocaleString()} items</span>
          <span class="chartLabel">Sales by Product Qty</span>
        </div>
        <div class="chartContainer" id="chartSalesByQty"></div>
      </div>

      <!-- Chart 3: Total sales minus rent for the timeframe -->
      <div class="chartBlock">
        <div class="chartBlockHeader">
          <span class="chartTotal">$${(totalRevenue - rent).toLocaleString()}</span>
          <div class="chartLabelGroup">
            <span class="chartLabel">Profit after Rent</span>
            <span class="chartMicrocopy">Not including vendor ingredients</span>
          </div>
        </div>
        <div class="chartContainer" id="chartProfitAfterRent"></div>
      </div>
    </div>

    ${renderTopItemSection("sales", starBadge, "Top Item by Sales", topItemsBySales, renderSalesItemCard)}

    ${renderTopItemSection("likes", heartBadge, "Top Item by Likes", topItemsByLikes, renderLikesItemCard)}

    ${renderReviewsSection(realReviews)}

    ${renderDocumentsSection(getStallDocuments())}

    ${renderHygieneGrade(currentStallData?.hygieneGrade ? { grade: currentStallData.hygieneGrade, lastUpdated: currentStallData.hygieneUpdatedAt || currentStallData.lastInspectionDate || currentStallData.updatedAt || null } : null)}
  `;

  // Draw all 3 charts with the default timeframe
  drawAllCharts();
  // Bind the Day/Month/Year segmented control
  bindTimeframeTabs();
  bindLoadMoreButtons();
  bindReviewTabs();
  bindDocTabs();
  bindResolveButtons();

  // Bind unlink button
  const unlinkBtn = document.getElementById("unlinkChildBtn");
  if (unlinkBtn) {
    unlinkBtn.addEventListener("click", handleUnlinkChild);
  }
}

async function handleUnlinkChild() {
  if (!currentStallId || !currentStallData) return;

  const stallName = currentStallData.name || "this child";
  const confirmed = await showConfirm(
    `Unlink ${stallName}?`,
    "The stall will remain in your hawker centre but the vendor will be disconnected.",
    { confirmLabel: "Unlink", destructive: true },
  );
  if (!confirmed) return;

  try {
    const ownerId = currentStallData.ownerId;

    // 1. Remove operator-related fields from the food stall (keep ownerId, hawkerCentreId — stall location stays)
    await updateDoc(doc(db, "foodStalls", currentStallId), {
      operatorId: deleteField(),
      operatorName: deleteField(),
      unitNumber: deleteField(),
    });

    // 2. Clean up vendor doc (remove tenancy fields, keep stallId, hawkerCentreId, storeLocation)
    if (ownerId) {
      try {
        await updateDoc(doc(db, "vendors", ownerId), {
          tenancyLinkedAt: deleteField(),
        });
      } catch (err) {
        console.warn("Could not update vendor doc:", err);
      }

      // 3. Delete onboarding codes linked to this vendor
      const codesQuery = query(
        collection(db, "onboardingCodes"),
        where("vendorId", "==", ownerId),
      );
      const codesSnapshot = await getDocs(codesQuery);
      for (const codeDoc of codesSnapshot.docs) {
        await deleteDoc(doc(db, "onboardingCodes", codeDoc.id));
      }
    }

    // Notify vendor of unlink (non-blocking)
    if (ownerId) {
      try {
        const fns = getFunctions(app, "asia-southeast1");
        const notifyTenancy = httpsCallable(fns, "notifyVendorTenancy");
        notifyTenancy({
          vendorId: ownerId,
          action: "unlinked",
          centreName: currentStallData.operatorName || "",
          operatorId: auth.currentUser.uid,
          vendorName: currentStallData.name || "",
        });
      } catch (err) {
        console.warn("Tenancy notification failed:", err);
      }
    }

    // Navigate back to My Children
    window.location.href = "../Operator Children/operatorChildren.html";
  } catch (error) {
    console.error("Error unlinking child:", error);
  }
}

async function loadStallData() {
  const params = new URLSearchParams(window.location.search);
  currentStallId = params.get("id");

  if (currentStallId) {
    try {
      currentStallData = await getStallById(currentStallId);
    } catch (err) {
      console.warn("Could not fetch stall data:", err);
    }

    // Block access to unlinked stalls
    if (!currentStallData || !currentStallData.ownerId) {
      window.location.href = "../Operator Children/operatorChildren.html";
      return;
    }

    // Subscribe to live data for charts, top items, and reviews
    subscribeToCompletedOrders(currentStallId);
    subscribeToMenuItemLikes(currentStallId);
    subscribeToReviews(currentStallId);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Firebase Auth — check onboarding before initialising page
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      initNotificationBadge(`operators/${user.uid}/notifications`);
      initToastContainer();
      subscribeToNewNotifications(`operators/${user.uid}/notifications`);

      // Check onboarding status
      const operatorDoc = await getDoc(doc(db, "operators", user.uid));
      if (!operatorDoc.exists() || !operatorDoc.data().onboardingComplete) {
        window.location.href = "../Auth/onboarding-operator.html";
        return;
      }

      // Load real stall data and reviews before rendering
      await loadStallData();

      // Re-render charts live when order/likes data changes
      disruptor.on("operator:detail:invalidated", () => {
        if (!isReviewAnimating) renderPage();
      });

      // Re-render reviews when new feedback arrives or is resolved
      disruptor.on("operator:reviews:invalidated", () => {
        if (!isReviewAnimating) renderPage();
      });

      google.charts.load("current", { packages: ["corechart"] });
      google.charts.setOnLoadCallback(renderPage);

      // Bind resolve modal events
      bindResolveModal();
    } else {
      window.location.href = "../Auth/login.html";
      return;
    }
  });

  // Keyboard shortcut (Ctrl+Backspace to unlink)
  document.addEventListener("keydown", (e) => {
    const modifier = e.metaKey || e.ctrlKey;
    if (modifier && e.key === "Backspace") {
      e.preventDefault();
      handleUnlinkChild();
    }
  });

  // Redraw all charts on window resize so they stay responsive
  window.addEventListener("resize", () => {
    const el = document.getElementById("chartSalesByValue");
    if (el) drawAllCharts();
  });
});

// Cleanup live subscriptions and disruptor on page unload
window.addEventListener("beforeunload", () => {
  if (completedOrdersUnsubscribe) completedOrdersUnsubscribe();
  if (menuLikesUnsubscribe) menuLikesUnsubscribe();
  if (reviewsUnsubscribe) reviewsUnsubscribe();
  disruptor.destroy();
});
