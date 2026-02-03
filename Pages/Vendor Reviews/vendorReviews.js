const mockReviews = [
  {
    title: "Chinese Sala nubbad",
    text: "It was very yummy, the chinese salad was so good. The dressing was perfect and the vegetables were fresh. I would definitely come back for more.",
    rating: 4,
    author: "Jane Doe",
    daysAgo: 2,
    status: "new",
  },
  {
    title: "Rude Staff!",
    text: "The staff was very rude and unhelpful. I asked for extra sauce and they refused. The food was okay but the service ruined the experience.",
    rating: 1,
    author: "Jane's Foe",
    daysAgo: 5,
    status: "new",
  },
  {
    title: "Inconsistent service",
    text: "Sometimes the food is great, sometimes it's not. The last time I visited, my order took 30 minutes and the portions were smaller than usual.",
    rating: 3,
    author: "Jane Loe",
    daysAgo: 7,
    status: "new",
  },
  {
    title: "Great food, will return!",
    text: "Absolutely loved the nasi lemak. The sambal was spicy and flavourful. Highly recommend this stall to anyone looking for authentic hawker food.",
    rating: 5,
    author: "Ahmad Rizal",
    daysAgo: 10,
    status: "resolved",
  },
  {
    title: "Cold food served",
    text: "My chicken rice was served cold. Very disappointing for the price. I expected better quality from a stall with such good reviews.",
    rating: 2,
    author: "Sarah Chen",
    daysAgo: 12,
    status: "resolved",
  },
];

function renderStars(rating) {
  const filled = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#913b9f"><path d="M8 1.23l2.12 4.3 4.74.69-3.43 3.34.81 4.72L8 11.77l-4.24 2.51.81-4.72L1.14 6.22l4.74-.69L8 1.23z"/></svg>`;
  const empty = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#d0cad6"><path d="M8 1.23l2.12 4.3 4.74.69-3.43 3.34.81 4.72L8 11.77l-4.24 2.51.81-4.72L1.14 6.22l4.74-.69L8 1.23z"/></svg>`;
  let html = "";
  for (let i = 0; i < 5; i++) {
    html += i < rating ? filled : empty;
  }
  return html;
}

function renderReviewCard(review, index) {
  const resolveButton =
    review.status === "new"
      ? `<button class="reviewResolveButton" data-index="${index}" title="Resolve review">
        <img src="../../assets/icons/resolveReview.svg" alt="Resolve" />
      </button>`
      : "";

  return `
    <div class="reviewCard">
      ${resolveButton}
      <span class="reviewTitle">${review.title}</span>
      <span class="reviewText">${review.text}</span>
      <div class="reviewMeta">
        <div class="reviewStars">${renderStars(review.rating)}</div>
        <span class="reviewInfo">${review.daysAgo} days ago &bull; By ${review.author}</span>
      </div>
    </div>
  `;
}

function renderReviews(tab) {
  const container = document.getElementById("reviewsContent");
  const filtered = mockReviews.filter((review) => review.status === tab);

  if (filtered.length === 0) {
    container.innerHTML = `<span style="color: #595959; font-family: 'Geist Mono', monospace; font-size: 16px;">No ${tab} reviews.</span>`;
    return;
  }

  container.innerHTML = filtered
    .map((review) => renderReviewCard(review, mockReviews.indexOf(review)))
    .join("");

  container
    .querySelectorAll(".reviewResolveButton[data-index]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const index = parseInt(button.dataset.index, 10);
        mockReviews[index].status = "resolved";
        renderReviews(currentTab);
      });
    });
}

let currentTab = "new";

document.addEventListener("DOMContentLoaded", () => {
  renderReviews("new");

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

  document.querySelectorAll('input[name="reviewTab"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      currentTab = radio.value;
      renderReviews(currentTab);
    });
  });
});
