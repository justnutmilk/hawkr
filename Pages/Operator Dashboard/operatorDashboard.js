const mockStalls = [
  {
    name: "Chinese Foods Private Limited",
    image: "../../images/squirrelCard.svg",
    todayRevenue: 5000.67,
    monthlyRevenue: 50000.76,
    tags: ["Chinese", "Halal"],
  },
  {
    name: "Lalithambigai Saravanan KevyTan Cavan Xie Yu Xiang",
    image: "../../images/squirrelCard.svg",
    todayRevenue: 5000.67,
    monthlyRevenue: 43021.93,
    tags: ["Chinese"],
  },
  {
    name: "Lalithambigai Saravanan KevyTan Cavan Xie Yu Xiang",
    image: "../../images/squirrelCard.svg",
    todayRevenue: 5000.67,
    monthlyRevenue: 41067.12,
    tags: ["Chinese"],
  },
  {
    name: "Sushi Supreme Co., Ltd.",
    image: "../../images/squirrelCard.svg",
    todayRevenue: 3800.0,
    monthlyRevenue: 38500.0,
    tags: ["Japanese"],
  },
  {
    name: "Curry House Inc.",
    image: "../../images/squirrelCard.svg",
    todayRevenue: 3200.5,
    monthlyRevenue: 35200.5,
    tags: ["Indian"],
  },
];

const moreInfoIcon = `<svg class="quickStatsIcon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M5.19444 8.75H5.20333M8.75 8.75H8.75889M12.3056 8.75H12.3144M16.75 8.75C16.75 13.1683 13.1683 16.75 8.75 16.75C4.33172 16.75 0.75 13.1683 0.75 8.75C0.75 4.33172 4.33172 0.75 8.75 0.75C13.1683 0.75 16.75 4.33172 16.75 8.75Z" stroke="#341539" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

function formatCurrency(value) {
  return (
    "$" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function renderTopStoreCard(stall, revenueKey) {
  return `
        <button class="topStoreCard" onclick="window.location.href='#store-${encodeURIComponent(stall.name)}'">
            <img class="topStoreImage" src="${stall.image}" alt="${stall.name}" />
            <span class="topStoreName">${stall.name}</span>
            <span class="topStoreRevenue">${formatCurrency(stall[revenueKey])}</span>
        </button>
    `;
}

const tagIcons = {
  Halal: "../../assets/icons/halal.png",
  Kosher: "../../assets/icons/kosher.svg",
};

function renderTag(tag) {
  const icon = tagIcons[tag];
  if (icon) {
    return `<span class="stallTag ${tag.toLowerCase()}"><img class="stallTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="stallTag">${tag}</span>`;
}

function renderStallRow(stall) {
  const tags = stall.tags.map(renderTag).join("");
  return `
        <button class="stallRow" onclick="window.location.href='#store-${encodeURIComponent(stall.name)}'">
            <div class="stallRowInfo">
                <span class="stallRowName">${stall.name}</span>
                <div class="stallRowTags">${tags}</div>
            </div>
            <span class="stallRowGraphPlaceholder">Imagine a 4 data point line graph here</span>
        </button>
    `;
}

function renderCentreContent() {
  return `
        <div class="quickStatsSection">
            <div class="quickStatsHeader">
                <span class="sectionLabel">Quick Stats</span>
                ${moreInfoIcon}
            </div>
            <div class="quickStatsBlocks">
                <div class="statBlock">
                    <span class="statBlockLabel">Today</span>
                    <span class="statBlockValue">S$10,034.92</span>
                    <span class="statBlockPlaceholder">Imagine A Bar Graph Here</span>
                </div>
                <div class="statBlock">
                    <span class="statBlockLabel">Monthly</span>
                    <span class="statBlockValue">S$250,904.26</span>
                    <span class="statBlockPlaceholder">Imagine Another Certain Graph Here</span>
                </div>
                <div class="statBlock">
                    <span class="statBlockLabel">Customer Satisfaction</span>
                    <span class="statBlockValue">6.7/10</span>
                    <span class="statBlockPlaceholder">Imagine A Donut Graph Here</span>
                </div>
            </div>
        </div>
    `;
}

const loadingIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none">
  <path d="M7.1825 0.682617V3.28262M7.1825 11.0826V13.6826M2.58699 2.58712L4.4265 4.42662M9.93849 9.93862L11.778 11.7781M0.682495 7.18262H3.2825M11.0825 7.18262H13.6825M2.58699 11.7781L4.4265 9.93862M9.93849 4.42662L11.778 2.58712" stroke="#595959" stroke-width="1.365" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const STALLS_PER_PAGE = 3;
const stallVisibleCounts = { today: STALLS_PER_PAGE, monthly: STALLS_PER_PAGE };

function renderStallList(period) {
  const visible = mockStalls.slice(0, stallVisibleCounts[period]);
  const hasMore = stallVisibleCounts[period] < mockStalls.length;
  const loadMoreButton = hasMore
    ? `<button class="loadMoreButton" data-period="${period}">${loadingIcon} Load next 10</button>`
    : "";
  return `
        <div class="stallListSection">
            ${visible.map(renderStallRow).join("")}
            ${loadMoreButton}
        </div>
    `;
}

function renderStallContent() {
  const topThree = mockStalls.slice(0, 3);
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
                        <span class="statBlockValue">S$10,034.92</span>
                        <span class="topStoresSubtitle">Top stores by revenue</span>
                        <div class="topStoresCards">
                            ${topThree.map((s) => renderTopStoreCard(s, "todayRevenue")).join("")}
                        </div>
                    </div>
                    ${renderStallList("today")}
                </div>
                <div class="statBlock">
                    <div class="statBlockTop">
                        <span class="statBlockLabel">Monthly</span>
                        <span class="statBlockValue">S$250,904.26</span>
                        <span class="topStoresSubtitle">Top stores by revenue</span>
                        <div class="topStoresCards">
                            ${topThree.map((s) => renderTopStoreCard(s, "monthlyRevenue")).join("")}
                        </div>
                    </div>
                    ${renderStallList("monthly")}
                </div>
                <div class="statBlock">
                    <span class="statBlockLabel">Customer Satisfaction</span>
                    <span class="statBlockValue">6.7/10</span>
                    <span class="statBlockPlaceholder">Imagine A Donut Graph Here</span>
                </div>
            </div>
        </div>
    `;
}

function bindLoadMoreButtons() {
  document.querySelectorAll(".loadMoreButton").forEach((button) => {
    button.addEventListener("click", () => {
      const period = button.dataset.period;
      stallVisibleCounts[period] += 10;
      renderDashboard("stall");
    });
  });
}

function renderDashboard(tab) {
  const container = document.getElementById("dashboardContent");
  container.innerHTML =
    tab === "stall" ? renderStallContent() : renderCentreContent();
  if (tab === "stall") {
    bindLoadMoreButtons();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderDashboard("centre");

  document.querySelectorAll('input[name="dashboardTab"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      renderDashboard(radio.value);
    });
  });

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
});
