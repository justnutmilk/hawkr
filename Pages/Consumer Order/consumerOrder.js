// ============================================
// MOCK DATA (Simulating Backend Database)
// ============================================

const mockData = {
    hawkerCenters: [
        {
            id: 1,
            name: "Maxwell Food Centre",
            stalls: [
                {
                    id: 1,
                    name: "Chinese Foods Private Limited",
                    image: "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
                    cuisines: ["Chinese"],
                    rating: 4.5,
                    hours: "Mon-Sun: 08:00 - 02:00",
                },
                {
                    id: 2,
                    name: "Lalithambigai Saravanan KevyTan Cavan Xie Yu...",
                    image: "../../mock-data/Consumer Dashboard/hawker-center/Thambigai Market.png",
                    cuisines: ["Halal", "Chinese", "Malay"],
                    rating: 4.5,
                    hours: "Mon-Sun: 08:00 - 02:00",
                },
                {
                    id: 3,
                    name: "Lalithambigai Saravanan KevyTan Cavan Xie Yu...",
                    image: "../../mock-data/Consumer Dashboard/hawker-center/Saravanan Hawker.png",
                    cuisines: ["Halal", "Chinese", "Malay"],
                    rating: 4.5,
                    hours: "Mon-Sun: 08:00 - 02:00",
                },
            ],
        },
        {
            id: 2,
            name: "Thambigai Market",
            stalls: [
                {
                    id: 4,
                    name: "Chinese Foods Private Limited",
                    image: "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
                    cuisines: ["Chinese"],
                    rating: 4.5,
                    hours: "Mon-Sun: 08:00 - 02:00",
                },
                {
                    id: 5,
                    name: "Lalithambigai Saravanan",
                    image: "../../mock-data/Consumer Dashboard/hawker-center/Thambigai Market.png",
                    cuisines: ["Halal", "Chinese", "Malay"],
                    rating: 4.5,
                    hours: "Mon-Sun: 08:00 - 02:00",
                },
                {
                    id: 6,
                    name: "Lalithambigai Saravanan",
                    image: "../../mock-data/Consumer Dashboard/hawker-center/Saravanan Hawker.png",
                    cuisines: ["Halal", "Chinese", "Malay"],
                    rating: 4.5,
                    hours: "Mon-Sun: 08:00 - 02:00",
                },
            ],
        },
    ],
};

// ============================================
// MOCK API FUNCTIONS (Simulating Backend Calls)
// ============================================

const api = {
    async fetchHawkerCenters() {
        await this.simulateNetworkDelay();
        return mockData.hawkerCenters;
    },

    simulateNetworkDelay() {
        const delay = Math.random() * 300 + 200;
        return new Promise((resolve) => setTimeout(resolve, delay));
    },
};

// ============================================
// ICON SVG TEMPLATES
// ============================================

const icons = {
    star: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 0L7.34708 4.1459H11.7063L8.17963 6.7082L9.52671 10.8541L6 8.2918L2.47329 10.8541L3.82037 6.7082L0.293661 4.1459H4.65292L6 0Z" fill="#FFC107"/>
    </svg>`,

    clock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 0C2.7 0 0 2.7 0 6C0 9.3 2.7 12 6 12C9.3 12 12 9.3 12 6C12 2.7 9.3 0 6 0ZM6 10.8C3.36 10.8 1.2 8.64 1.2 6C1.2 3.36 3.36 1.2 6 1.2C8.64 1.2 10.8 3.36 10.8 6C10.8 8.64 8.64 10.8 6 10.8ZM6.3 3H5.4V6.6L8.55 8.49L9 7.74L6.3 6.15V3Z" fill="#666"/>
    </svg>`,
};

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderStallCard(stall) {
    const cuisineTagsHTML = stall.cuisines
        .map((cuisine) => {
            if (cuisine.toLowerCase() === "halal") {
                return `<span class="cuisineTag halal">
                    <img src="../../assets/icons/halal.png" alt="Halal">
                    ${cuisine}
                </span>`;
            }
            return `<span class="cuisineTag">${cuisine}</span>`;
        })
        .join("");

    return `
        <div class="stallCard" data-stall-id="${stall.id}">
            <div class="stallCardImage">
                <img src="${stall.image}" alt="${stall.name}" onerror="this.style.display='none'">
            </div>
            <div class="stallCardInfo">
                <h3 class="stallName">${stall.name}</h3>
                <div class="cuisineTags">
                    ${cuisineTagsHTML}
                </div>
                <div class="stallMeta">
                    <span class="stallRating">
                        ${icons.star}
                        ${stall.rating}
                    </span>
                    <span class="stallHours">
                        ${icons.clock}
                        ${stall.hours}
                    </span>
                </div>
            </div>
        </div>
    `;
}

function renderHawkerCenterSection(hawkerCenter) {
    const stallCardsHTML = hawkerCenter.stalls
        .map((stall) => renderStallCard(stall))
        .join("");

    return `
        <section class="hawkerCenterSection" data-center-id="${hawkerCenter.id}">
            <div class="centreTitleParent">
                <h2 class="centerTitle">${hawkerCenter.name}</h2>
                <span class="seeAllButton">see all</span>
            </div>
            <div class="stallCardsGrid">
                ${stallCardsHTML}
            </div>
        </section>
    `;
}

function renderNowBrowsingHelper() {
    return `
        <div class="nowBrowsingHelper">
            <span class="nowBrowsingLabel">Now Browsing:</span>
            <span class="nowBrowsingValue">Hawker Centres</span>
        </div>
    `;
}

function renderOrderPage(hawkerCenters) {
    const container = document.getElementById("orderContent");
    if (!container) return;

    const nowBrowsingHTML = renderNowBrowsingHelper();
    const sectionsHTML = hawkerCenters
        .map((center) => renderHawkerCenterSection(center))
        .join("");

    container.innerHTML = nowBrowsingHTML + sectionsHTML;

    // Add click handlers to stall cards
    container.querySelectorAll(".stallCard").forEach((card) => {
        card.addEventListener("click", () => {
            const stallId = card.dataset.stallId;
            handleStallClick(stallId);
        });
    });
}

function handleStallClick(stallId) {
    // Navigate to stall detail page with stall ID
    window.location.href = `stallDetail.html?id=${stallId}`;
}

// ============================================
// LOADING STATE HELPERS
// ============================================

function showLoading() {
    const container = document.getElementById("orderContent");
    if (container) {
        container.innerHTML = `<div class="loadingSpinner"></div>`;
    }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initializeOrderPage() {
    try {
        showLoading();

        const hawkerCenters = await api.fetchHawkerCenters();
        renderOrderPage(hawkerCenters);
    } catch (error) {
        console.error("Failed to initialize order page:", error);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
    initializeOrderPage();

    // Search input focus shortcut
    const searchInput = document.getElementById("searchInput");

    document.addEventListener("keydown", function (e) {
        if (!searchInput) return;

        const targetTag = e.target.tagName.toLowerCase();
        const isEditable = e.target.isContentEditable === true;

        if (targetTag === "input" || targetTag === "textarea" || isEditable) {
            return;
        }

        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        }
    });
});
