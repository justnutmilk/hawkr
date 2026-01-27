// ============================================
// MOCK DATA (Simulating Backend Database)
// ============================================

const mockData = {
  // Carousel/Ads Data
  carouselSlides: [
    {
      id: 1,
      image: "../../mock-data/Consumer Dashboard/ads/Ad-1.png",
      alt: "Hawkr Promo 1",
    },
    {
      id: 2,
      image: "../../mock-data/Consumer Dashboard/ads/Ad-2.png",
      alt: "Hawkr Promo 2",
    },
    {
      id: 3,
      image: "../../mock-data/Consumer Dashboard/ads/Ad-3.png",
      alt: "Hawkr Promo 3",
    },
    {
      id: 4,
      image: "../../mock-data/Consumer Dashboard/ads/Ad-4.png",
      alt: "Hawkr Promo 4",
    },
    {
      id: 5,
      image: "../../mock-data/Consumer Dashboard/ads/Ad-5.png",
      alt: "Hawkr Promo 5",
    },
  ],

  // Current Order Status (null if no active order)
  currentOrder: {
    orderNumber: "A-127",
    minsToCollection: 15,
  },

  // Quick Action Buttons
  quickActions: [
    {
      id: "order",
      label: "Order",
      icon: "../../assets/icons/order.svg",
      color: "#EAF5E9",
    },
    {
      id: "favourites",
      label: "Favourites",
      icon: "../../assets/icons/heart.svg",
      color: "#FFEBEB",
    },
    {
      id: "nearby",
      label: "Nearby",
      icon: "../../assets/icons/location.svg",
      color: "#F2F2FF",
    },
    {
      id: "vouchers",
      label: "Vouchers",
      icon: "../../assets/icons/vouchers.svg",
      color: "#FAFAC1",
    },
    {
      id: "history",
      label: "History",
      icon: "../../assets/icons/history.svg",
      color: "#F6EEF9",
    },
    {
      id: "feedback",
      label: "Feedback",
      icon: "../../assets/icons/feedback.svg",
      color: "#F2F5FC",
    },
    {
      id: "games",
      label: "Games",
      icon: "../../assets/icons/games.svg",
      color: "#EAF5E9",
    },
  ],

  // Cultural Heritage Hawkers (Featured)
  featuredHawkers: [
    {
      id: 1,
      name: "Maxwell Food Centre",
      address: "1 Kadayanallur St",
      postalCode: "Singapore 069184",
      rating: 4.5,
      hours: "Mon-Sun: 08:00 - 02:00",
      image:
        "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
    },
    {
      id: 2,
      name: "Thambigai Market",
      address: "67 Natyvek Rd",
      postalCode: "Singapore 067420",
      rating: 4.5,
      hours: "Mon-Sun: 08:00 - 02:00",
      image:
        "../../mock-data/Consumer Dashboard/hawker-center/Thambigai Market.png",
    },
    {
      id: 3,
      name: "Saravanan Hawker",
      address: "null",
      postalCode: "null",
      rating: 8,
      hours: "null",
      image:
        "../../mock-data/Consumer Dashboard/hawker-center/Saravanan Hawker.png",
    },
    {
      id: 4,
      name: "Saravanan Hawker",
      address: "null",
      postalCode: "null",
      rating: "null",
      hours: "null",
      image:
        "../../mock-data/Consumer Dashboard/hawker-center/Saravanan Hawker.png",
    },
  ],

  // Nearby Hawkers
  nearbyHawkers: [
    {
      id: 5,
      name: "Thambigai Market",
      address: "67 Natyvek Rd",
      postalCode: "Singapore 067420",
      rating: 4.5,
      hours: "Mon-Sun: 08:00 - 02:00",
      image:
        "../../mock-data/Consumer Dashboard/hawker-center/Thambigai Market.png",
    },
    {
      id: 6,
      name: "Maxwell Food Centre",
      address: "1 Kadayanallur St",
      postalCode: "Singapore 069184",
      rating: 4.5,
      hours: "Mon-Sun: 08:00 - 02:00",
      image:
        "../../mock-data/Consumer Dashboard/hawker-center/Maxwell Food Centre.png",
    },
  ],

  // User Vouchers
  userVouchers: [],

  // Available Games
  games: [
    { id: 1, name: "Game 1", icon: "gamepad" },
    { id: 2, name: "Game 2", icon: "gamepad" },
    { id: 3, name: "Game 3", icon: "gamepad" },
  ],
};

// ============================================
// MOCK API FUNCTIONS (Simulating Backend Calls)
// ============================================

const api = {
  async fetchCarouselSlides() {
    await this.simulateNetworkDelay();
    return mockData.carouselSlides;
  },

  async fetchCurrentOrder() {
    await this.simulateNetworkDelay();
    return mockData.currentOrder;
  },

  async fetchQuickActions() {
    await this.simulateNetworkDelay();
    return mockData.quickActions;
  },

  async fetchFeaturedHawkers() {
    await this.simulateNetworkDelay();
    return mockData.featuredHawkers;
  },

  async fetchNearbyHawkers() {
    await this.simulateNetworkDelay();
    return mockData.nearbyHawkers;
  },

  async fetchUserVouchers() {
    await this.simulateNetworkDelay();
    return mockData.userVouchers;
  },

  async fetchGames() {
    await this.simulateNetworkDelay();
    return mockData.games;
  },

  // Simulate network delay (200-500ms)
  simulateNetworkDelay() {
    const delay = Math.random() * 300 + 200;
    return new Promise((resolve) => setTimeout(resolve, delay));
  },
};

// ============================================
// ICON SVG TEMPLATES
// ============================================

const icons = {
  // Order icon - Fork and spoon (green)
  order: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M9.33333 2.66667V14.6667H12V29.3333H14.6667V2.66667H12V10.6667H9.33333V2.66667H6.66667V10.6667H4V2.66667H1.33333V14.6667C1.33333 16.1333 2.53333 17.3333 4 17.3333H6.66667V29.3333H9.33333V17.3333H12C13.4667 17.3333 14.6667 16.1333 14.6667 14.6667V2.66667H9.33333ZM22.6667 8V18.6667H18.6667V29.3333H21.3333V21.3333H26.6667C28.1333 21.3333 29.3333 20.1333 29.3333 18.6667V8C29.3333 5.05333 26.9467 2.66667 24 2.66667C21.0533 2.66667 18.6667 5.05333 18.6667 8H21.3333C21.3333 6.53333 22.5333 5.33333 24 5.33333C25.4667 5.33333 26.6667 6.53333 26.6667 8V18.6667H22.6667V8Z" fill="#77B573"/>
  </svg>`,

  // Favourites icon - Heart (red/coral)
  favourites: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M16 28.4533L14.12 26.7467C7.2 20.48 2.66667 16.3733 2.66667 11.3333C2.66667 7.22667 5.89333 4 10 4C12.32 4 14.5467 5.08 16 6.78667C17.4533 5.08 19.68 4 22 4C26.1067 4 29.3333 7.22667 29.3333 11.3333C29.3333 16.3733 24.8 20.48 17.88 26.76L16 28.4533Z" fill="#E57373"/>
  </svg>`,

  // Nearby icon - Location pin (purple)
  nearby: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M16 2.66667C10.48 2.66667 6 7.14667 6 12.6667C6 20 16 29.3333 16 29.3333C16 29.3333 26 20 26 12.6667C26 7.14667 21.52 2.66667 16 2.66667ZM16 16C14.16 16 12.6667 14.5067 12.6667 12.6667C12.6667 10.8267 14.16 9.33333 16 9.33333C17.84 9.33333 19.3333 10.8267 19.3333 12.6667C19.3333 14.5067 17.84 16 16 16Z" fill="#9C27B0"/>
  </svg>`,

  // Vouchers icon - Ticket/coupon (yellow/gold)
  vouchers: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M26.6667 6.66667H5.33333C3.86667 6.66667 2.68 7.86667 2.68 9.33333L2.66667 22.6667C2.66667 24.1333 3.86667 25.3333 5.33333 25.3333H26.6667C28.1333 25.3333 29.3333 24.1333 29.3333 22.6667V9.33333C29.3333 7.86667 28.1333 6.66667 26.6667 6.66667ZM26.6667 22.6667H5.33333V17.3333H8V14.6667H5.33333V9.33333H26.6667V14.6667H24V17.3333H26.6667V22.6667ZM14.6667 14.6667H17.3333V17.3333H14.6667V14.6667ZM10.6667 14.6667H13.3333V17.3333H10.6667V14.6667ZM18.6667 14.6667H21.3333V17.3333H18.6667V14.6667Z" fill="#D4A017"/>
  </svg>`,

  // History icon - Clock with arrow (purple)
  history: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M17.3333 2.66667C10.7067 2.66667 5.33333 8.04 5.33333 14.6667H1.33333L6.44 19.7733L6.53333 19.96L11.8267 14.6667H7.82667C7.82667 9.42667 12.0933 5.16 17.3333 5.16C22.5733 5.16 26.84 9.42667 26.84 14.6667C26.84 19.9067 22.5733 24.1733 17.3333 24.1733C14.72 24.1733 12.3467 23.1067 10.6267 21.3733L8.86667 23.1333C11.04 25.3067 14.0267 26.6667 17.3333 26.6667C23.96 26.6667 29.3333 21.2933 29.3333 14.6667C29.3333 8.04 23.96 2.66667 17.3333 2.66667ZM16 8V16L22.4933 19.8667L23.6 17.9867L18 14.6667V8H16Z" fill="#7E57C2"/>
  </svg>`,

  // Feedback icon - Chat bubble (teal/blue)
  feedback: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M28 2.66667H4C2.53333 2.66667 1.34667 3.86667 1.34667 5.33333L1.33333 29.3333L6.66667 24H28C29.4667 24 30.6667 22.8 30.6667 21.3333V5.33333C30.6667 3.86667 29.4667 2.66667 28 2.66667ZM9.33333 12H22.6667V14.6667H9.33333V12ZM18.6667 18.6667H9.33333V16H18.6667V18.6667ZM22.6667 10.6667H9.33333V8H22.6667V10.6667Z" fill="#5C9EAD"/>
  </svg>`,

  // Games icon - Game controller (green)
  games: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M22.6667 10.6667H20V8H17.3333V10.6667H14.6667V8H12V10.6667H9.33333C7.86667 10.6667 6.66667 11.8667 6.66667 13.3333V24C6.66667 25.4667 7.86667 26.6667 9.33333 26.6667H22.6667C24.1333 26.6667 25.3333 25.4667 25.3333 24V13.3333C25.3333 11.8667 24.1333 10.6667 22.6667 10.6667ZM14.6667 22.6667H12V20H9.33333V17.3333H12V14.6667H14.6667V17.3333H17.3333V14.6667H14.6667V22.6667ZM20 21.3333C19.2667 21.3333 18.6667 20.7333 18.6667 20C18.6667 19.2667 19.2667 18.6667 20 18.6667C20.7333 18.6667 21.3333 19.2667 21.3333 20C21.3333 20.7333 20.7333 21.3333 20 21.3333ZM22.6667 17.3333C21.9333 17.3333 21.3333 16.7333 21.3333 16C21.3333 15.2667 21.9333 14.6667 22.6667 14.6667C23.4 14.6667 24 15.2667 24 16C24 16.7333 23.4 17.3333 22.6667 17.3333Z" fill="#4CAF50"/>
  </svg>`,

  star: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M6 0L7.34708 4.1459H11.7063L8.17963 6.7082L9.52671 10.8541L6 8.2918L2.47329 10.8541L3.82037 6.7082L0.293661 4.1459H4.65292L6 0Z" fill="#FFC107"/>
  </svg>`,

  clock: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M6 0C2.7 0 0 2.7 0 6C0 9.3 2.7 12 6 12C9.3 12 12 9.3 12 6C12 2.7 9.3 0 6 0ZM6 10.8C3.36 10.8 1.2 8.64 1.2 6C1.2 3.36 3.36 1.2 6 1.2C8.64 1.2 10.8 3.36 10.8 6C10.8 8.64 8.64 10.8 6 10.8ZM6.3 3H5.4V6.6L8.55 8.49L9 7.74L6.3 6.15V3Z" fill="#666"/>
  </svg>`,

  gamepad: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 32 32" fill="none">
    <path d="M9.33333 18.6667H12V16H14.6667V13.3333H12V10.6667H9.33333V13.3333H6.66667V16H9.33333V18.6667ZM20 16.6667C20.5556 16.6667 21.0278 16.4722 21.4167 16.0833C21.8056 15.6944 22 15.2222 22 14.6667C22 14.1111 21.8056 13.6389 21.4167 13.25C21.0278 12.8611 20.5556 12.6667 20 12.6667C19.4444 12.6667 18.9722 12.8611 18.5833 13.25C18.1944 13.6389 18 14.1111 18 14.6667C18 15.2222 18.1944 15.6944 18.5833 16.0833C18.9722 16.4722 19.4444 16.6667 20 16.6667ZM24 12.6667C24.5556 12.6667 25.0278 12.4722 25.4167 12.0833C25.8056 11.6944 26 11.2222 26 10.6667C26 10.1111 25.8056 9.63889 25.4167 9.25C25.0278 8.86111 24.5556 8.66667 24 8.66667C23.4444 8.66667 22.9722 8.86111 22.5833 9.25C22.1944 9.63889 22 10.1111 22 10.6667C22 11.2222 22.1944 11.6944 22.5833 12.0833C22.9722 12.4722 23.4444 12.6667 24 12.6667ZM6.66667 25.3333C5.2 25.3333 3.94444 24.8222 2.9 23.8C1.85556 22.7778 1.33333 21.5333 1.33333 20.0667V9.33333C1.33333 7.86667 1.85556 6.62222 2.9 5.6C3.94444 4.57778 5.2 4.06667 6.66667 4.06667H25.3333C26.8 4.06667 28.0556 4.57778 29.1 5.6C30.1444 6.62222 30.6667 7.86667 30.6667 9.33333V20.0667C30.6667 21.5333 30.1444 22.7778 29.1 23.8C28.0556 24.8222 26.8 25.3333 25.3333 25.3333H6.66667Z" fill="#4CAF50"/>
  </svg>`,
};

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderCarousel(slides) {
  const carouselContainer = document.getElementById("carouselSlides");
  const dotsContainer = document.getElementById("carouselDots");

  if (!carouselContainer || !dotsContainer) return;

  // Render slides with images
  carouselContainer.innerHTML = slides
    .map(
      (slide, index) => `
    <div class="carouselSlide ${index === 0 ? "active" : ""}" data-slide-id="${slide.id}">
      <img src="${slide.image}" alt="${slide.alt}" class="carouselImage">
    </div>
  `,
    )
    .join("");

  // Render dots
  dotsContainer.innerHTML = slides
    .map(
      (_, index) => `
    <span class="dot ${index === 0 ? "active" : ""}" data-index="${index}"></span>
  `,
    )
    .join("");

  // Add click handlers to dots
  dotsContainer.querySelectorAll(".dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = parseInt(dot.dataset.index);
      goToSlide(index);
    });
  });

  // Start auto-rotation
  startCarouselAutoRotation();
}

let carouselInterval = null;
let currentSlideIndex = 0;

function goToSlide(index) {
  const slides = document.querySelectorAll(".carouselSlide");
  const dots = document.querySelectorAll(".dot");

  if (slides.length === 0) return;

  // Remove active class from all
  slides.forEach((slide) => slide.classList.remove("active"));
  dots.forEach((dot) => dot.classList.remove("active"));

  // Add active class to current
  currentSlideIndex = index;
  slides[index].classList.add("active");
  dots[index].classList.add("active");
}

function startCarouselAutoRotation() {
  if (carouselInterval) clearInterval(carouselInterval);

  carouselInterval = setInterval(() => {
    const slides = document.querySelectorAll(".carouselSlide");
    if (slides.length === 0) return;

    const nextIndex = (currentSlideIndex + 1) % slides.length;
    goToSlide(nextIndex);
  }, 4000);
}

function renderOrderStatus(order, carouselSlides) {
  const orderStatusContainer = document.querySelector(".orderStatusContainer");
  if (!orderStatusContainer) return;

  if (order) {
    // Show order status cards
    orderStatusContainer.innerHTML = `
      <div class="orderStatusCard">
        <p class="orderStatusLabel">Order no.</p>
        <p class="orderStatusValue" id="orderNumber">${order.orderNumber}</p>
      </div>
      <div class="orderStatusCard">
        <p class="orderStatusLabel">Mins to collection</p>
        <p class="orderStatusValue" id="minsToCollection">${order.minsToCollection}</p>
      </div>
    `;
  } else {
    // Show ads when no active order
    const ads = carouselSlides || [];
    const shuffled = [...ads].sort(() => Math.random() - 0.5);
    const ad1 = shuffled[0];
    const ad2 = shuffled[1] || shuffled[0];

    orderStatusContainer.innerHTML = `
      <div class="orderStatusCard ad-card">
        ${ad1 ? `<img src="${ad1.image}" alt="${ad1.alt}" class="adImage">` : ""}
      </div>
      <div class="orderStatusCard ad-card">
        ${ad2 ? `<img src="${ad2.image}" alt="${ad2.alt}" class="adImage">` : ""}
      </div>
    `;
  }
}

function renderQuickActions(actions) {
  const container = document.getElementById("quickActionsContainer");
  if (!container) return;

  container.innerHTML = actions
    .map(
      (action) => `
    <div class="quickActionItem" data-action="${action.id}">
      <div class="quickActionIcon" style="background: ${action.color}">
        <img src="${action.icon}" alt="${action.label}" class="quickActionIconImg">
      </div>
      <span class="quickActionLabel">${action.label}</span>
    </div>
  `,
    )
    .join("");

  // Add click handlers
  container.querySelectorAll(".quickActionItem").forEach((item) => {
    item.addEventListener("click", () => {
      const actionId = item.dataset.action;
      handleQuickAction(actionId);
    });
  });
}

function handleQuickAction(actionId) {
  console.log(`Quick action clicked: ${actionId}`);
  // TODO: Implement navigation/action handling
}

function renderHawkerCard(hawker) {
  const hasDetails = hawker.address && hawker.rating;

  return `
    <div class="hawkerCard" data-hawker-id="${hawker.id}">
      <div class="hawkerCardImage">
        <img src="${hawker.image}" alt="${hawker.name}" onerror="this.style.display='none'">
      </div>
      <div class="hawkerCardInfo">
        <h3 class="hawkerCardName">${hawker.name}</h3>
        ${
          hasDetails
            ? `
          <p class="hawkerCardAddress">${hawker.address}<br>${hawker.postalCode}</p>
          <div class="hawkerCardMeta">
            <span class="hawkerRating">
              ${icons.star}
              ${hawker.rating}
            </span>
            <span class="hawkerHours">
              ${icons.clock}
              ${hawker.hours}
            </span>
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;
}

function renderFeaturedHawkers(hawkers) {
  const container = document.getElementById("featuredHawkersContainer");
  if (!container) return;

  container.innerHTML = hawkers
    .map((hawker) => renderHawkerCard(hawker))
    .join("");

  // Add click handlers
  container.querySelectorAll(".hawkerCard").forEach((card) => {
    card.addEventListener("click", () => {
      const hawkerId = card.dataset.hawkerId;
      handleHawkerClick(hawkerId);
    });
  });
}

function renderNearbyHawkers(hawkers) {
  const container = document.getElementById("nearbyHawkersContainer");
  if (!container) return;

  const hawkerCards = hawkers
    .map((hawker) => renderHawkerCard(hawker))
    .join("");
  const message =
    hawkers.length > 0 && hawkers.length < 3
      ? `<p class="nearbyMessage">That's it! Couldn't find any more in your vicinity...</p>`
      : "";

  container.innerHTML = hawkerCards + message;

  // Add click handlers
  container.querySelectorAll(".hawkerCard").forEach((card) => {
    card.addEventListener("click", () => {
      const hawkerId = card.dataset.hawkerId;
      handleHawkerClick(hawkerId);
    });
  });
}

function handleHawkerClick(hawkerId) {
  console.log(`Hawker clicked: ${hawkerId}`);
  // TODO: Navigate to hawker detail page
}

function renderVouchers(vouchers) {
  const container = document.getElementById("vouchersContainer");
  if (!container) return;

  if (vouchers.length === 0) {
    container.innerHTML = `<p class="vouchersEmptyMessage">More vouchers coming soon!</p>`;
  } else {
    container.innerHTML = vouchers
      .map(
        (voucher) => `
      <div class="voucherCard" data-voucher-id="${voucher.id}">
        <p class="voucherTitle">${voucher.title}</p>
        <p class="voucherExpiry">Expires: ${voucher.expiry}</p>
      </div>
    `,
      )
      .join("");
  }
}

function renderGames(games) {
  const container = document.getElementById("gamesContainer");
  if (!container) return;

  container.innerHTML = games
    .map(
      (game) => `
    <div class="gameItem" data-game-id="${game.id}">
      <div class="gameIcon">
        ${icons[game.icon] || icons.gamepad}
      </div>
      <span class="gameLabel">${game.name}</span>
    </div>
  `,
    )
    .join("");

  // Add click handlers
  container.querySelectorAll(".gameItem").forEach((item) => {
    item.addEventListener("click", () => {
      const gameId = item.dataset.gameId;
      handleGameClick(gameId);
    });
  });
}

function handleGameClick(gameId) {
  console.log(`Game clicked: ${gameId}`);
  // TODO: Navigate to game page
}

// ============================================
// LOADING STATE HELPERS
// ============================================

function showLoading(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `<div class="loadingSpinner"></div>`;
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initializeDashboard() {
  try {
    // Fetch all data in parallel
    const [
      carouselSlides,
      currentOrder,
      quickActions,
      featuredHawkers,
      nearbyHawkers,
      userVouchers,
      games,
    ] = await Promise.all([
      api.fetchCarouselSlides(),
      api.fetchCurrentOrder(),
      api.fetchQuickActions(),
      api.fetchFeaturedHawkers(),
      api.fetchNearbyHawkers(),
      api.fetchUserVouchers(),
      api.fetchGames(),
    ]);

    // Render all sections
    renderCarousel(carouselSlides);
    renderOrderStatus(currentOrder, carouselSlides);
    renderQuickActions(quickActions);
    renderFeaturedHawkers(featuredHawkers);
    renderNearbyHawkers(nearbyHawkers);
    renderVouchers(userVouchers);
    renderGames(games);
  } catch (error) {
    console.error("Failed to initialize dashboard:", error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize dashboard with dynamic content
  initializeDashboard();

  // Search input focus shortcut
  const searchInput = document.getElementById("searchInput");

  document.addEventListener("keydown", function (e) {
    if (!searchInput) return;

    // Check if user is already typing in an input field
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
