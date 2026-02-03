const tagIcons = {
  Halal: "../../assets/icons/halal.png",
  Kosher: "../../assets/icons/kosher.svg",
};

const mockStore = {
  name: "Chinese Foods Private Limited",
  uen: "202401234K",
  tags: ["Chinese", "Halal", "Halal"],
  rent: { day: 50, month: 1500, year: 18000 },
  charts: {
    // Day: full 24 hours, nulls for hours with no data yet
    day: {
      labels: [
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
      ],
      salesByValue: [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        120,
        185,
        310,
        480,
        620,
        540,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      salesByQty: [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        8,
        14,
        22,
        35,
        45,
        38,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
    },
    // Month: all 12 months, nulls for future months (currently Feb)
    month: {
      labels: [
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
      ],
      salesByValue: [
        8200,
        9100,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      salesByQty: [
        580,
        640,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
    },
    // Year: only years the shop has data for
    year: {
      labels: ["2025", "2026"],
      salesByValue: [386500, 17300],
      salesByQty: [27040, 1220],
    },
  },
  topBySales: [
    {
      name: "Mala Tang",
      image: "../../images/squirrelCard.svg",
      price: 23.9,
      count: 201,
    },
    {
      name: "Char Kway Teow",
      image: "../../images/squirrelCard.svg",
      price: 8.5,
      count: 187,
    },
    {
      name: "Laksa",
      image: "../../images/squirrelCard.svg",
      price: 7.9,
      count: 154,
    },
    {
      name: "Hainanese Chicken Rice",
      image: "../../images/squirrelCard.svg",
      price: 5.5,
      count: 143,
    },
    {
      name: "Roti Prata",
      image: "../../images/squirrelCard.svg",
      price: 3.5,
      count: 129,
    },
    {
      name: "Nasi Lemak",
      image: "../../images/squirrelCard.svg",
      price: 6.0,
      count: 118,
    },
    {
      name: "Bak Chor Mee",
      image: "../../images/squirrelCard.svg",
      price: 6.5,
      count: 102,
    },
  ],
  topByLikes: [
    {
      name: "Mala Tang",
      image: "../../images/squirrelCard.svg",
      price: 23.9,
      count: 67,
    },
    {
      name: "Char Kway Teow",
      image: "../../images/squirrelCard.svg",
      price: 8.5,
      count: 58,
    },
    {
      name: "Laksa",
      image: "../../images/squirrelCard.svg",
      price: 7.9,
      count: 45,
    },
    {
      name: "Hainanese Chicken Rice",
      image: "../../images/squirrelCard.svg",
      price: 5.5,
      count: 39,
    },
    {
      name: "Roti Prata",
      image: "../../images/squirrelCard.svg",
      price: 3.5,
      count: 31,
    },
    {
      name: "Nasi Lemak",
      image: "../../images/squirrelCard.svg",
      price: 6.0,
      count: 27,
    },
    {
      name: "Bak Chor Mee",
      image: "../../images/squirrelCard.svg",
      price: 6.5,
      count: 22,
    },
  ],
  documents: [
    {
      title: "Rental Agreement",
      icon: "agreement",
      current: {
        image: "../../images/squirrelCard.svg",
        filename: "rental_agreement_2026.pdf",
      },
      archived: [
        {
          filename: "rental_agreement_2025.pdf",
          uploaded: "1 Jan 2025",
          replaced: "1 Jan 2026",
          url: "../../images/squirrelCard.svg",
        },
        {
          filename: "rental_agreement_2024.pdf",
          uploaded: "1 Jan 2024",
          replaced: "1 Jan 2025",
          url: "../../images/squirrelCard.svg",
        },
      ],
    },
    {
      title: "Halal Cert",
      icon: "halal",
      current: null,
      archived: [],
    },
  ],
  hygieneGrade: {
    grade: "A",
    lastUpdated: "15 Jan 2025",
  },
  reviews: [
    {
      title: "Chinese Sala nubbad",
      body: "Ingredients used were fresh, and portion was great too! The real value for money.",
      stars: 3,
      date: "2 days ago",
      author: "Jane Doe",
      sentiment: "positive",
    },
    {
      title: "Rude Staff!",
      body: "Ah Poh screamed at me when it was my turn to order, rushing me to spit out a random menu item. The serving was small and gravy was overtly salty. Food is oily like my teenage child\u2019s nose pores. 10/10 DO NOT RECOMMEND.",
      stars: 1,
      date: "2 days ago",
      author: "Jane's Foe",
      sentiment: "negative",
    },
    {
      title: "Inconsistent service",
      body: "Most menu items are always not available and this vendor doesnt update the availability. So the food usually isnt ready when i get to the store! Always have to argue for a refund and pay again for another item. Such vendors make this marketplace an inconsistent and undesirable place to trade.\n\nThe Sala is good tho.",
      stars: 2,
      date: "2 days ago",
      author: "Jane Loe",
      sentiment: "negative",
    },
    {
      title: "Great food, great vibes",
      body: "Love the atmosphere and the food is always consistent. Will come back again!",
      stars: 5,
      date: "3 days ago",
      author: "John Tan",
      sentiment: "positive",
    },
    {
      title: "Decent but pricey",
      body: "Food quality is okay but a bit overpriced for hawker standards.",
      stars: 3,
      date: "4 days ago",
      author: "Mary Lee",
      sentiment: "negative",
    },
  ],
};

function renderTag(tag) {
  const icon = tagIcons[tag];
  if (icon) {
    return `<span class="storeTag ${tag.toLowerCase()}"><img class="storeTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="storeTag">${tag}</span>`;
}

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
  const store = mockStore;
  // Get the data for the current timeframe (day, month, or year)
  const timeframeData = store.charts[currentTimeframe];
  // Get rent for this timeframe to calculate profit
  const rent = store.rent[currentTimeframe];

  // Chart 1: Sales by Value ($) — purple line
  drawSingleChart(
    timeframeData.labels,
    timeframeData.salesByValue,
    "#913b9f",
    "chartSalesByValue",
  );

  // Chart 2: Sales by Product Qty — dark red bar chart
  drawBarChart(
    timeframeData.labels,
    timeframeData.salesByQty,
    "#6b1d1d",
    "chartSalesByQty",
  );

  // Chart 3: Profit after Rent — calculated as cumulative sales minus rent
  // Each point shows the running total of sales up to that period minus the rent
  // e.g. for "month" view: Week 1 profit = week1Sales - rent,
  //   Week 2 = (week1 + week2) sales - rent, etc.
  const profitData = [];
  let cumulativeSales = 0;
  for (let index = 0; index < timeframeData.salesByValue.length; index++) {
    if (timeframeData.salesByValue[index] === null) {
      // No data for this period yet
      profitData.push(null);
    } else {
      // Add this period's sales to the running total
      cumulativeSales += timeframeData.salesByValue[index];
      // Subtract the full timeframe rent to show profit
      profitData.push(cumulativeSales - rent);
    }
  }
  drawSingleChart(
    timeframeData.labels,
    profitData,
    "#e67e22",
    "chartProfitAfterRent",
  );
}

// Updates the chart total labels to reflect the current timeframe's data
function updateChartTotals() {
  const timeframeData = mockStore.charts[currentTimeframe];
  const rent = mockStore.rent[currentTimeframe];
  const totalSales = timeframeData.salesByValue.reduce(
    (sum, value) => sum + (value || 0),
    0,
  );
  const totalQty = timeframeData.salesByQty.reduce(
    (sum, value) => sum + (value || 0),
    0,
  );

  const totals = document.querySelectorAll(".chartTotal");
  if (totals.length >= 3) {
    totals[0].textContent = `$${totalSales.toLocaleString()}`;
    totals[1].textContent = `${totalQty.toLocaleString()} items`;
    totals[2].textContent = `$${(totalSales - rent).toLocaleString()}`;
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

function renderTopItemCard(item) {
  return `
    <div class="topItemCard">
      <img class="topItemImage" src="${item.image}" alt="${item.name}" />
      <span class="topItemName">${item.name}</span>
      <span class="topItemPrice">$${item.price.toFixed(1)}</span>
      <span class="topItemStat">${item.count} To Month</span>
    </div>
  `;
}

function renderTopItemSection(type, badge, title, items) {
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
      ${visible.map(renderTopItemCard).join("")}
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

let currentReviewTab = "negative";

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

function renderReviewCard(review) {
  const bodyHtml = review.body
    .split("\n\n")
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
  return `
    <div class="reviewCard">
      <div class="reviewCardTop">
        <span class="reviewTitle">${review.title}</span>
        ${reviewAckIcon}
      </div>
      <div class="reviewBody">${bodyHtml}</div>
      <div class="reviewMeta">
        <span class="reviewStars">${renderStars(review.stars)}</span>
        <span class="reviewDate">${review.date}</span>
        <span class="reviewMetaDot">&bull;</span>
        <span class="reviewAuthor">By ${review.author}</span>
      </div>
    </div>
  `;
}

function renderReviewsSection(reviews) {
  const filtered = reviews.filter(
    (review) => review.sentiment === currentReviewTab,
  );
  return `
    <div class="reviewsSection">
      <div class="reviewsHeader">
        <div class="reviewsHeaderLeft">
          ${reviewsIcon}
          <span class="reviewsTitle">Reviews</span>
        </div>
        <div class="segmentedControl reviewsSegmented">
          <label class="segmentedButton">
            <input type="radio" name="reviewTab" value="negative" ${currentReviewTab === "negative" ? "checked" : ""} />
            Negative
          </label>
          <label class="segmentedButton">
            <input type="radio" name="reviewTab" value="positive" ${currentReviewTab === "positive" ? "checked" : ""} />
            Positive
          </label>
        </div>
      </div>
      <div class="reviewCards">
        ${filtered.map(renderReviewCard).join("")}
      </div>
      <a class="reviewsSeeMore" href="operatorChildrenReviews.html">see more &gt;</a>
    </div>
  `;
}

function bindReviewTabs() {
  document.querySelectorAll('input[name="reviewTab"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      currentReviewTab = e.target.value;
      const container = document.querySelector(".reviewCards");
      const filtered = mockStore.reviews.filter(
        (review) => review.sentiment === currentReviewTab,
      );
      container.innerHTML = filtered.map(renderReviewCard).join("");
    });
  });
}

// Medal icon
function renderHygieneGrade(hygiene) {
  return `
    <div class="hygieneBlock">
      <span class="hygieneTitle">Hygiene Grade</span>
      <div class="hygieneGradeRow">
        <span class="hygieneGrade">${hygiene.grade}</span>
      </div>
      <div class="hygieneUpdatedRow">
        <span class="hygieneUpdated">Last updated ${hygiene.lastUpdated}</span>
      </div>
      <div class="hygieneHistoryRow">
        <a class="hygieneHistory" href="operatorChildrenHygiene.html">view history &gt;</a>
      </div>
    </div>
  `;
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
      container.innerHTML = renderDocContent(mockStore.documents[index], index);
    });
  });
}

const starBadge = `<img class="topItemIcon" src="../../assets/icons/medal.svg" alt="Medal" />`;

// Heart icon (red)
const heartBadge = `<svg class="topItemIcon" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 30C18 30 4 22 4 13C4 9 7 6 11 6C13.5 6 15.7 7.3 17 9.3C17.4 8.6 17.7 8.2 18 7.8C18.3 8.2 18.6 8.6 19 9.3C20.3 7.3 22.5 6 25 6C29 6 32 9 32 13C32 22 18 30 18 30Z" fill="#e53935"/>
</svg>`;

function renderPage() {
  const store = mockStore;
  const tags = store.tags.map(renderTag).join("");

  // Get current timeframe data for rendering totals in the chart headers
  const timeframeData = store.charts[currentTimeframe];
  const rent = store.rent[currentTimeframe];

  document.getElementById("pageContent").innerHTML = `
    <div class="storeHeader">
      <div class="storeHeaderTop">
        <div class="storeHeaderInfo">
          <span class="storePerusing">Now Perusing:</span>
          <span class="storeName">${store.name}</span>
          <span class="storeUen">UEN: ${store.uen}</span>
        </div>
        <div class="storeTags">${tags}</div>
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
          <span class="chartTotal">$${timeframeData.salesByValue.reduce((sum, value) => sum + (value || 0), 0).toLocaleString()}</span>
          <span class="chartLabel">Sales by Value</span>
        </div>
        <div class="chartContainer" id="chartSalesByValue"></div>
      </div>

      <!-- Chart 2: Sales by number of items sold -->
      <div class="chartBlock">
        <div class="chartBlockHeader">
          <span class="chartTotal">${timeframeData.salesByQty.reduce((sum, value) => sum + (value || 0), 0).toLocaleString()} items</span>
          <span class="chartLabel">Sales by Product Qty</span>
        </div>
        <div class="chartContainer" id="chartSalesByQty"></div>
      </div>

      <!-- Chart 3: Total sales minus rent for the timeframe -->
      <div class="chartBlock">
        <div class="chartBlockHeader">
          <span class="chartTotal">$${(timeframeData.salesByValue.reduce((sum, value) => sum + (value || 0), 0) - rent).toLocaleString()}</span>
          <div class="chartLabelGroup">
            <span class="chartLabel">Profit after Rent</span>
            <span class="chartMicrocopy">Not including vendor ingredients</span>
          </div>
        </div>
        <div class="chartContainer" id="chartProfitAfterRent"></div>
      </div>
    </div>

    ${renderTopItemSection("sales", starBadge, "Top Item by Sales", store.topBySales)}

    ${renderTopItemSection("likes", heartBadge, "Top Item by Likes", store.topByLikes)}

    ${renderReviewsSection(store.reviews)}

    ${renderDocumentsSection(store.documents)}

    ${renderHygieneGrade(store.hygieneGrade)}
  `;

  // Draw all 3 charts with the default timeframe
  drawAllCharts();
  // Bind the Day/Month/Year segmented control
  bindTimeframeTabs();
  bindLoadMoreButtons();
  bindReviewTabs();
  bindDocTabs();
}

document.addEventListener("DOMContentLoaded", () => {
  google.charts.load("current", { packages: ["corechart"] });
  google.charts.setOnLoadCallback(renderPage);

  const isMac = window.navigator.userAgentData
    ? window.navigator.userAgentData.platform === "macOS"
    : /Mac/i.test(window.navigator.userAgent);

  document.getElementById("searchKeyMod").textContent = isMac
    ? "\u2318"
    : "CTRL";

  document.addEventListener("keydown", (e) => {
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    if (modifier && e.key === "k") {
      e.preventDefault();
      document.getElementById("searchInput").focus();
    }
  });

  // Redraw all charts on window resize so they stay responsive
  window.addEventListener("resize", () => {
    const el = document.getElementById("chartSalesByValue");
    if (el) drawAllCharts();
  });
});
