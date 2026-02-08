document.addEventListener("DOMContentLoaded", function (event) {
  var dataText = [
    "makes ordering faster,\nclearer, and queue-light",
    "connects customers,\nstalls, and ops",
    "runs stalls, centres, and\ninspections end to end.",
  ];

  function typeWriter(text, i, fnCallback) {
    if (i < text.length) {
      document.querySelector("h1").innerHTML =
        text.substring(0, i + 1) + '<span aria-hidden="true"></span>';
      setTimeout(function () {
        typeWriter(text, i + 1, fnCallback);
      }, 50);
    } else if (typeof fnCallback == "function") {
      setTimeout(fnCallback, 6000);
    }
  }

  function StartTextAnimation(i) {
    if (typeof dataText[i] == "undefined") {
      setTimeout(function () {
        StartTextAnimation(0);
      }, 500);
    }
    if (i < dataText[i].length) {
      typeWriter(dataText[i], 0, function () {
        StartTextAnimation(i + 1);
      });
    }
  }

  StartTextAnimation(0);

  // ============================================
  // PRODUCT SUITE — MODULE TAB SWITCHER
  // ============================================
  document.querySelectorAll(".moduleTab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var module = tab.dataset.module;

      document.querySelectorAll(".moduleTab").forEach(function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");

      document.querySelectorAll(".moduleAnimation").forEach(function (anim) {
        anim.classList.remove("active");
      });
      var target = document.querySelector(
        '.moduleAnimation[data-module="' + module + '"]',
      );
      if (target) {
        var clone = target.cloneNode(true);
        clone.classList.add("active");
        target.parentNode.replaceChild(clone, target);
        // Re-init Snap drag & drop after clone replaces DOM
        if (module === "dietary") {
          initDietarySnap();
        }
      }
    });
  });

  // ============================================
  // SOLUTIONS — SEGMENTED CONTROL SWITCHER
  // ============================================
  var segBtns = document.querySelectorAll(".solutionsSegBtn");
  segBtns.forEach(function (label, index) {
    var radio = label.querySelector('input[type="radio"]');
    if (!radio) return;
    radio.addEventListener("change", function () {
      var role = label.dataset.role;
      // Update fallback --active-index for Safari
      var seg = label.closest(".solutionsSegmented");
      if (seg) seg.style.setProperty("--active-index", index);
      // Toggle panels
      document.querySelectorAll(".solutionPanel").forEach(function (p) {
        p.classList.remove("active");
      });
      var panel = document.querySelector(
        '.solutionPanel[data-role="' + role + '"]',
      );
      if (panel) panel.classList.add("active");
    });
  });

  // ============================================
  // DESKTOP INTERACTIVE PRODUCT SUITE
  // ============================================
  if (window.innerWidth >= 1024) {
    initInteractiveProductSuite();
  }

  // ============================================
  // ONBOARDING AUTO-POPULATE DEMO
  // ============================================
  initOnboardingDemo();
});

// ============================================
// Shared data pools (survive tab-switch re-inits)
// ============================================
var _orderPool = [
  {
    num: "#0044",
    name: "Rachel K.",
    time: "12:38 PM",
    type: "Dine-in",
    items: "2 items",
    total: "$9.00",
  },
  {
    num: "#0045",
    name: "David C.",
    time: "12:40 PM",
    type: "Takeaway",
    items: "1 item",
    total: "$5.50",
  },
  {
    num: "#0046",
    name: "Mei Ling",
    time: "12:42 PM",
    type: "Dine-in",
    items: "4 items",
    total: "$22.00",
  },
  {
    num: "#0047",
    name: "Ahmad B.",
    time: "12:44 PM",
    type: "Takeaway",
    items: "2 items",
    total: "$11.30",
  },
  {
    num: "#0048",
    name: "Priya S.",
    time: "12:46 PM",
    type: "Dine-in",
    items: "3 items",
    total: "$16.50",
  },
  {
    num: "#0049",
    name: "Tommy L.",
    time: "12:48 PM",
    type: "Takeaway",
    items: "1 item",
    total: "$4.00",
  },
  {
    num: "#0050",
    name: "Susan W.",
    time: "12:50 PM",
    type: "Dine-in",
    items: "2 items",
    total: "$8.80",
  },
  {
    num: "#0051",
    name: "Ken T.",
    time: "12:52 PM",
    type: "Takeaway",
    items: "3 items",
    total: "$14.20",
  },
];
var _orderPoolIdx = 0;

var _reviewPool = [
  {
    name: "Rachel K.",
    stars: 5,
    text: "Amazing laksa! Will definitely come back.",
    sentiment: "Positive",
  },
  {
    name: "David C.",
    stars: 3,
    text: "Food was okay but service was slow.",
    sentiment: "Neutral",
  },
  {
    name: "Mei Ling",
    stars: 5,
    text: "Best nasi lemak I've ever had!",
    sentiment: "Positive",
  },
  {
    name: "Ahmad B.",
    stars: 2,
    text: "Carrot cake was too oily today.",
    sentiment: "Negative",
  },
  {
    name: "Priya S.",
    stars: 4,
    text: "Love the curry puff, crispy and flavourful.",
    sentiment: "Positive",
  },
  {
    name: "Tommy L.",
    stars: 3,
    text: "Decent portion size, nothing special.",
    sentiment: "Neutral",
  },
  {
    name: "Susan W.",
    stars: 5,
    text: "The chilli crab is worth every cent!",
    sentiment: "Positive",
  },
  {
    name: "Ken T.",
    stars: 1,
    text: "Found a hair in my food. Very disappointed.",
    sentiment: "Negative",
  },
];
var _reviewPoolIdx = 0;

var _allergenData = {
  Halal: "assets/icons/halal.png",
  Soy: "assets/icons/soy.svg",
  Egg: "assets/icons/egg.svg",
  Seafood: "assets/icons/seafood.svg",
  Nuts: "assets/icons/nuts.svg",
  Dairy: "assets/icons/dairy.svg",
  Kosher: "assets/icons/kosher.svg",
};

var _activeAegisBadge = null;

// ============================================
// Event delegation on .productSuitePreview
// — survives clone-and-replace from tab switch
// ============================================
function initInteractiveProductSuite() {
  var preview = document.querySelector(".productSuitePreview");
  if (!preview || preview._interactiveBound) return;
  preview._interactiveBound = true;

  preview.addEventListener("click", function (e) {
    // --- ORDERING: qty stepper ---
    var qtyBtn = e.target.closest(".animQtyBtn");
    if (qtyBtn) {
      var action = qtyBtn.dataset.action;
      var controls = qtyBtn.closest(".animQtyControls");
      var countEl = controls ? controls.querySelector(".animQtyCount") : null;
      if (!countEl) return;
      var qty = parseInt(countEl.textContent) || 1;
      if (action === "increase") qty++;
      else if (action === "decrease" && qty > 1) qty--;
      countEl.textContent = qty;
      updateCartTotal();
      return;
    }

    // --- ORDERING: place order easter egg → jump to payments tab ---
    if (e.target.closest(".animCheckoutBtn")) {
      var payTab = document.querySelector('.moduleTab[data-module="payments"]');
      if (payTab) payTab.click();
      return;
    }

    // --- LINE: mark ready ---
    var readyBtn = e.target.closest(".animLineReadyBtn");
    if (readyBtn) {
      var card = readyBtn.closest(".animLineCard");
      if (!card || card.dataset.animating) return;
      card.dataset.animating = "1";

      card.classList.add("swipe-up");
      card.addEventListener(
        "animationend",
        function onSwipe() {
          card.removeEventListener("animationend", onSwipe);
          card.classList.remove("swipe-up");
          card.classList.add("collapse-width");
          card.addEventListener(
            "animationend",
            function onCollapse() {
              card.removeEventListener("animationend", onCollapse);
              var cardsContainer = card.parentElement;
              card.remove();
              // Insert new card at the LEFT (first child), pushing others right
              var order = _orderPool[_orderPoolIdx % _orderPool.length];
              _orderPoolIdx++;
              var newCard = createLineCard(order);
              cardsContainer.insertBefore(newCard, cardsContainer.firstChild);
            },
            { once: true },
          );
        },
        { once: true },
      );
      return;
    }

    // --- AEGIS: click badge to highlight in modal ---
    var badge = e.target.closest(".animAegisBadge");
    if (badge && !badge.closest(".animAegisGradeModal")) {
      _activeAegisBadge = badge;
      var modal = preview.querySelector(".animAegisGradeModal");
      if (modal) {
        var currentGrade = badge.textContent.trim();
        modal.querySelectorAll(".animAegisGradeOption").forEach(function (opt) {
          opt.classList.remove("animAegisGradeSelected");
          if (opt.textContent.trim() === currentGrade)
            opt.classList.add("animAegisGradeSelected");
        });
        modal.style.opacity = "1";
        modal.style.transform = "scale(1)";
        modal.style.animation = "none";
      }
      return;
    }

    // --- AEGIS: click grade option to assign ---
    var gradeOpt = e.target.closest(".animAegisGradeOption");
    if (gradeOpt && _activeAegisBadge) {
      var grade = gradeOpt.textContent.trim();
      _activeAegisBadge.textContent = grade;
      _activeAegisBadge.className =
        "animAegisBadge animAegisBadge" + grade + " stamp";
      var modal = gradeOpt.closest(".animAegisGradeModal");
      modal.querySelectorAll(".animAegisGradeOption").forEach(function (o) {
        o.classList.remove("animAegisGradeSelected");
      });
      gradeOpt.classList.add("animAegisGradeSelected");
      _activeAegisBadge.addEventListener(
        "animationend",
        function () {
          _activeAegisBadge.classList.remove("stamp");
        },
        { once: true },
      );
      // Toast
      var aegis = preview.querySelector(".animAegis");
      var oldToast = aegis ? aegis.querySelector(".animAegisToast") : null;
      if (oldToast) oldToast.remove();
      var toast = document.createElement("div");
      toast.className = "animAegisToast";
      toast.textContent = "Grade updated to " + grade;
      if (aegis) aegis.appendChild(toast);
      setTimeout(function () {
        toast.remove();
      }, 1500);
      _activeAegisBadge = null;
      return;
    }

    // --- FEEDBACK: resolve review ---
    var resolveBtn = e.target.closest(".animResolveBtn");
    if (resolveBtn) {
      var reviewCard = resolveBtn.closest(".animReviewCard");
      if (!reviewCard || reviewCard.classList.contains("animReviewSwipeUp"))
        return;
      reviewCard.classList.add("animReviewSwipeUp");
      reviewCard.addEventListener(
        "animationend",
        function () {
          var review = _reviewPool[_reviewPoolIdx % _reviewPool.length];
          _reviewPoolIdx++;
          var newCard = createReviewCard(review);
          reviewCard.parentNode.replaceChild(newCard, reviewCard);
        },
        { once: true },
      );
      return;
    }

    // --- PAYMENTS: filter toggle ---
    var filterCard = e.target.closest(".animPaymentsFilter");
    if (filterCard) {
      var filterType = filterCard.dataset.filter;
      var paymentsDiv = filterCard.closest(".animPayments");
      paymentsDiv.querySelectorAll(".animPaymentsFilter").forEach(function (f) {
        f.classList.remove("animPaymentsFilterActive");
      });
      filterCard.classList.add("animPaymentsFilterActive");
      paymentsDiv
        .querySelectorAll(".animPaymentsRow:not(.animPaymentsRowHeader)")
        .forEach(function (row) {
          if (filterType === "all") {
            row.style.display = "";
          } else {
            row.style.display = row.dataset.status === filterType ? "" : "none";
          }
        });
      return;
    }

    // --- DIETARY: click suggestion to add ---
    var pill = e.target.closest(".animSuggestionPill");
    if (pill && !pill.classList.contains("added")) {
      var tag = pill.dataset.tag;
      var container = preview.querySelector(".animAllergenContainer");
      var input = preview.querySelector(".animAllergenInput");
      if (container && !container.querySelector('[data-tag="' + tag + '"]')) {
        addAllergenTag(container, input, tag);
        pill.classList.add("added");
      }
      return;
    }

    // --- DIETARY: remove tag ---
    var removeBtn = e.target.closest(".animTagRemove");
    if (removeBtn) {
      var tagEl = removeBtn.closest(".animAllergenTag");
      if (tagEl) removeAllergenTag(tagEl);
      return;
    }
  });

  // Edit button glow tracking
  preview.addEventListener("mousemove", function (e) {
    var btn = e.target.closest(".animEditBtn");
    if (!btn) return;
    var rect = btn.getBoundingClientRect();
    btn.style.setProperty("--mouse-x", e.clientX - rect.left + "px");
    btn.style.setProperty("--mouse-y", e.clientY - rect.top + "px");
  });

  // Dietary input keydown
  preview.addEventListener("keydown", function (e) {
    var input = e.target.closest(".animAllergenInput");
    if (!input) return;
    var container = input.closest(".animAllergenContainer");
    if (e.key === "Enter") {
      e.preventDefault();
      var val = input.value.trim();
      if (!val) return;
      val = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
      if (
        _allergenData[val] &&
        !container.querySelector('[data-tag="' + val + '"]')
      ) {
        addAllergenTag(container, input, val);
        var pill = preview.querySelector(
          '.animSuggestionPill[data-tag="' + val + '"]',
        );
        if (pill) pill.classList.add("added");
      }
      input.value = "";
    }
    if (e.key === "Backspace" && input.value === "") {
      var tags = container.querySelectorAll(".animAllergenTag");
      if (tags.length) removeAllergenTag(tags[tags.length - 1]);
    }
  });

  // Init Snap drag & drop
  initDietarySnap();
}

function updateCartTotal() {
  var panel = document.querySelector(
    '.moduleAnimation[data-module="ordering"]',
  );
  if (!panel) return;
  var total = 0;
  panel.querySelectorAll(".animCartItem").forEach(function (item) {
    var price = parseFloat(item.dataset.price) || 0;
    var qty = parseInt(item.querySelector(".animQtyCount").textContent) || 1;
    var lineTotal = price * qty;
    item.querySelector(".animItemPrice").textContent =
      "$" + lineTotal.toFixed(2);
    total += lineTotal;
  });
  var totalEl = panel.querySelector(".animTotalValue");
  if (totalEl) totalEl.textContent = "$" + total.toFixed(2);
}

function createLineCard(order) {
  var card = document.createElement("div");
  card.className = "animLineCard slide-in";
  card.innerHTML =
    '<div class="animLineReadyBtn">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#2e7d32" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    "Mark ready" +
    "</div>" +
    '<div class="animLineOrderNum">' +
    order.num +
    "</div>" +
    '<div class="animLineCustomer">' +
    order.name +
    "</div>" +
    '<div class="animLineDateTime">' +
    order.time +
    "</div>" +
    '<div class="animLineType">' +
    order.type +
    "</div>" +
    '<div class="animLineItemCount">' +
    order.items +
    "</div>" +
    '<div class="animLineTotalRow"><span>Total</span><span class="animLineTotalVal">' +
    order.total +
    "</span></div>";
  return card;
}

function createReviewCard(review) {
  var starsHtml = "";
  for (var i = 0; i < 5; i++) {
    var fill = i < review.stars ? "#913b9f" : "#e0e0e0";
    starsHtml +=
      '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" fill="' +
      fill +
      '"/></svg>';
  }
  var sentimentClass =
    review.sentiment === "Positive"
      ? "animReviewPositive"
      : review.sentiment === "Negative"
        ? "animReviewNegative"
        : "animReviewNeutral";
  var card = document.createElement("div");
  card.className = "animReviewCard animReviewFadeIn";
  card.innerHTML =
    '<div class="animReviewHeader">' +
    '<span class="animReviewTitle">' +
    review.name +
    "</span>" +
    '<div class="animReviewStars">' +
    starsHtml +
    "</div>" +
    '<button class="animResolveBtn" style="display:flex"><img src="assets/icons/resolveReview.svg" alt="Resolve" /></button>' +
    "</div>" +
    '<p class="animReviewText">"' +
    review.text +
    '"</p>' +
    '<div class="animReviewSentimentWrap">' +
    '<div class="animReviewSentiment ' +
    sentimentClass +
    '"><img src="assets/icons/hawkrAi.svg" alt="AI" class="animHawkrAiIcon" />' +
    review.sentiment +
    "</div>" +
    "</div>";
  return card;
}

function addAllergenTag(container, input, name) {
  var icon = _allergenData[name] || "";
  var tagEl = document.createElement("span");
  var modifier =
    name.toLowerCase() === "halal"
      ? " halal"
      : name.toLowerCase() === "kosher"
        ? " kosher"
        : "";
  tagEl.className = "animAllergenTag" + modifier;
  tagEl.dataset.tag = name;
  tagEl.innerHTML =
    (icon ? '<img src="' + icon + '" alt="" class="animDietaryIcon" />' : "") +
    name +
    '<span class="animTagRemove">&times;</span>';
  container.insertBefore(tagEl, input);
}

function removeAllergenTag(tagEl) {
  var name = tagEl.dataset.tag;
  tagEl.remove();
  var pill = document.querySelector(
    '.animSuggestionPill[data-tag="' + name + '"]',
  );
  if (pill) pill.classList.remove("added");
}

function initDietarySnap() {
  var panel = document.getElementById("animDietaryPanel");
  if (!panel) return;
  if (typeof window.Snap === "undefined") {
    setTimeout(initDietarySnap, 100);
    return;
  }
  new window.Snap(panel, {
    draggableSelector: "#animSuggestions [data-draggable]:not(.added)",
    dropZoneSelector: "[data-droppable]",
    distance: 3,
    onDrop: function (info) {
      var el = info.element;
      var tag = el.dataset.tag;
      var container = panel.querySelector(".animAllergenContainer");
      var input = panel.querySelector(".animAllergenInput");
      if (
        tag &&
        container &&
        !container.querySelector('[data-tag="' + tag + '"]')
      ) {
        addAllergenTag(container, input, tag);
        el.classList.add("added");
      }
    },
  });
}

// ============================================
// ONBOARDING AUTO-POPULATE DEMO
// ============================================
var _onboardingStalls = [
  {
    name: "Tian Tian Hainanese Chicken Rice",
    centre: "Maxwell Food Centre",
    address: "1 Kadayanallur St, #01-10",
    cuisines: ["Hainanese", "Rice", "Chicken"],
    hours: [
      { day: "Mon", time: "10:00 AM \u2013 3:00 PM, 5:00 PM \u2013 8:00 PM" },
      { day: "Tue", time: "10:00 AM \u2013 3:00 PM, 5:00 PM \u2013 8:00 PM" },
      { day: "Wed", time: "10:00 AM \u2013 3:00 PM, 5:00 PM \u2013 8:00 PM" },
      { day: "Thu", time: "10:00 AM \u2013 3:00 PM, 5:00 PM \u2013 8:00 PM" },
      { day: "Fri", time: "10:00 AM \u2013 3:00 PM, 5:00 PM \u2013 8:00 PM" },
      { day: "Sat", time: "10:00 AM \u2013 8:00 PM" },
      { day: "Sun", time: "10:00 AM \u2013 8:00 PM" },
    ],
  },
  {
    name: "Ah Heng Curry Chicken Bee Hoon",
    centre: "Hong Lim Food Centre",
    address: "531A Upper Cross St, #02-47",
    cuisines: ["Curry", "Noodles", "Malay"],
    hours: [
      { day: "Mon", time: "7:00 AM \u2013 2:00 PM" },
      { day: "Tue", time: "7:00 AM \u2013 2:00 PM" },
      { day: "Wed", time: "7:00 AM \u2013 2:00 PM" },
      { day: "Thu", time: "7:00 AM \u2013 2:00 PM" },
      { day: "Fri", time: "7:00 AM \u2013 2:00 PM" },
      { day: "Sat", time: "7:00 AM \u2013 2:00 PM" },
      { day: "Sun", time: "Closed" },
    ],
  },
  {
    name: "Zhen Zhen Porridge",
    centre: "Tiong Bahru Market",
    address: "30 Seng Poh Rd, #02-06",
    cuisines: ["Porridge", "Cantonese", "Congee"],
    hours: [
      { day: "Mon", time: "Closed" },
      { day: "Tue", time: "5:30 AM \u2013 2:00 PM" },
      { day: "Wed", time: "5:30 AM \u2013 2:00 PM" },
      { day: "Thu", time: "5:30 AM \u2013 2:00 PM" },
      { day: "Fri", time: "5:30 AM \u2013 2:00 PM" },
      { day: "Sat", time: "5:30 AM \u2013 2:00 PM" },
      { day: "Sun", time: "5:30 AM \u2013 2:00 PM" },
    ],
  },
];
var _onboardingIdx = 0;
var _onboardingTimer = null;

function initOnboardingDemo() {
  if (!document.getElementById("demoStallName")) return;
  runOnboardingCycle();
}

function runOnboardingCycle() {
  var stall = _onboardingStalls[_onboardingIdx % _onboardingStalls.length];
  _onboardingIdx++;

  resetDemoFields();

  // Step 1: typewrite stall name
  typewriteDemo(stall.name, function () {
    // Step 2: cascade fill
    _onboardingTimer = setTimeout(function () {
      fillDemoField("demoCentre", stall.centre);
    }, 400);
    setTimeout(function () {
      fillDemoField("demoAddress", stall.address);
    }, 700);
    setTimeout(function () {
      fillDemoCuisines("demoCuisines", stall.cuisines);
    }, 1000);
    setTimeout(function () {
      fillDemoHours("demoHours", stall.hours);
    }, 1300);

    // Step 3: success flash
    setTimeout(function () {
      var s = document.getElementById("demoSuccess");
      if (s) s.classList.add("visible");
    }, 1800);

    // Step 4: pause then loop
    setTimeout(function () {
      runOnboardingCycle();
    }, 5000);
  });
}

function resetDemoFields() {
  var typed = document.querySelector("#demoStallName .demoTypedText");
  if (typed) typed.textContent = "";

  var cursor = document.querySelector("#demoStallName .demoCursor");
  if (cursor) cursor.style.display = "";

  ["demoCentre", "demoAddress", "demoCuisines", "demoHours"].forEach(
    function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.classList.remove("filled");
        var val = el.querySelector(".demoValue");
        if (val) val.textContent = "";
        var tags = el.querySelector(".demoCuisineTags");
        if (tags) tags.innerHTML = "";
        var hoursTable = el.querySelector(".demoHoursTable");
        if (hoursTable) hoursTable.innerHTML = "";
        // Re-show skeletons
        var skels = el.querySelectorAll(
          ".demoSkeleton, .demoSkeletonTags, .demoSkeletonHours",
        );
        skels.forEach(function (sk) {
          sk.style.display = "";
        });
      }
    },
  );

  var s = document.getElementById("demoSuccess");
  if (s) s.classList.remove("visible");
}

function typewriteDemo(text, callback) {
  var typed = document.querySelector("#demoStallName .demoTypedText");
  if (!typed) return;
  var i = 0;
  function tick() {
    if (i < text.length) {
      typed.textContent = text.substring(0, i + 1);
      i++;
      setTimeout(tick, 40);
    } else {
      // Hide cursor after typing done
      var cursor = document.querySelector("#demoStallName .demoCursor");
      if (cursor) cursor.style.display = "none";
      if (typeof callback === "function") callback();
    }
  }
  tick();
}

function fillDemoField(id, value) {
  var el = document.getElementById(id);
  if (!el) return;
  var val = el.querySelector(".demoValue");
  if (val) val.textContent = value;
  el.classList.add("filled");
}

function fillDemoHours(id, hours) {
  var el = document.getElementById(id);
  if (!el) return;
  var table = el.querySelector(".demoHoursTable");
  if (!table) return;
  table.innerHTML = hours
    .map(function (h) {
      return (
        '<div class="demoHoursRow">' +
        '<span class="demoHoursDay">' +
        h.day +
        "</span>" +
        '<span class="demoHoursTime">' +
        h.time +
        "</span>" +
        "</div>"
      );
    })
    .join("");
  el.classList.add("filled");
}

function fillDemoCuisines(id, cuisines) {
  var el = document.getElementById(id);
  if (!el) return;
  var container = el.querySelector(".demoCuisineTags");
  if (!container) return;
  container.innerHTML = cuisines
    .map(function (c) {
      return '<span class="demoCuisineTag">' + c + "</span>";
    })
    .join("");
  el.classList.add("filled");
}
