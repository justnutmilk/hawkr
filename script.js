document.addEventListener("DOMContentLoaded", function (event) {
  var dataText = [
    "makes ordering faster,\nclearer, and queue-light",
    "connects customers,\nstalls, and ops",
    "runs stalls, centres, and\ninspections end to end.",
  ];

  // type one text in the typwriter
  // keeps calling itself until the text is finished
  function typeWriter(text, i, fnCallback) {
    // chekc if text isn't finished yet
    if (i < text.length) {
      // add next character to h1
      document.querySelector("h1").innerHTML =
        text.substring(0, i + 1) + '<span aria-hidden="true"></span>';

      // wait for a while and call this function again for next character
      setTimeout(function () {
        typeWriter(text, i + 1, fnCallback);
      }, 50);
    }
    // text finished, call callback if there is a callback function
    else if (typeof fnCallback == "function") {
      // call callback after timeout
      setTimeout(fnCallback, 6000);
    }
  }
  // start a typewriter animation for a text in the dataText array
  function StartTextAnimation(i) {
    if (typeof dataText[i] == "undefined") {
      setTimeout(function () {
        StartTextAnimation(0);
      }, 500);
    }
    // check if dataText[i] exists
    if (i < dataText[i].length) {
      // text exists! start typewriter animation
      typeWriter(dataText[i], 0, function () {
        // after callback (and whole text has been animated), start next text
        StartTextAnimation(i + 1);
      });
    }
  }
  // start the text animation
  StartTextAnimation(0);

  // ============================================
  // PRODUCT SUITE — MODULE TAB SWITCHER
  // ============================================
  document.querySelectorAll(".moduleTab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var module = tab.dataset.module;

      // Update active tab
      document.querySelectorAll(".moduleTab").forEach(function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");

      // Swap animation panel — clone and replace to restart CSS animations
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

        // Re-initialize interactive handlers on desktop
        if (window.innerWidth >= 1024) {
          initInteractiveProductSuite();
        }
      }
    });
  });

  // ============================================
  // SOLUTIONS — ROLE TAB SWITCHER
  // ============================================
  document.querySelectorAll(".solutionTab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var role = tab.dataset.role;

      // Update active tab
      document.querySelectorAll(".solutionTab").forEach(function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");

      // Swap panel
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
  // Skip on mobile — keep CSS-only animations
  // ============================================
  if (window.innerWidth >= 1024) {
    initInteractiveProductSuite();
  }
});

function initInteractiveProductSuite() {
  // ============================================
  // 1. ORDERING — QTY STEPPER + EDIT GLOW
  // ============================================
  var orderingPanel = document.querySelector(
    '.moduleAnimation[data-module="ordering"]',
  );
  if (orderingPanel) {
    // Qty stepper
    orderingPanel.addEventListener("click", function (e) {
      var btn = e.target.closest(".animQtyBtn");
      if (!btn) return;
      var action = btn.dataset.action;
      var countEl = btn.parentElement.querySelector(".animQtyCount");
      var qty = parseInt(countEl.textContent) || 1;

      if (action === "increase") {
        qty++;
      } else if (action === "decrease" && qty > 1) {
        qty--;
      }
      countEl.textContent = qty;
      updateCartTotal(orderingPanel);
    });

    // Edit button glow tracking
    orderingPanel.querySelectorAll(".animEditBtn").forEach(function (btn) {
      btn.addEventListener("mousemove", function (e) {
        var rect = btn.getBoundingClientRect();
        btn.style.setProperty("--mouse-x", e.clientX - rect.left + "px");
        btn.style.setProperty("--mouse-y", e.clientY - rect.top + "px");
      });
    });
  }

  function updateCartTotal(panel) {
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

  // ============================================
  // 2. LINE — MARK READY WITH FLYING ANIMATION
  // ============================================
  var linePanel = document.querySelector(
    '.moduleAnimation[data-module="line"]',
  );
  var orderPool = [
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
  var orderPoolIndex = 0;

  if (linePanel) {
    linePanel.addEventListener("click", function (e) {
      var readyBtn = e.target.closest(".animLineReadyBtn");
      if (!readyBtn) return;
      var card = readyBtn.closest(".animLineCard");
      if (
        !card ||
        card.classList.contains("swipe-up") ||
        card.classList.contains("collapse-width")
      )
        return;

      // Step 1: swipe up
      card.classList.add("swipe-up");
      card.addEventListener(
        "animationend",
        function onSwipe() {
          card.removeEventListener("animationend", onSwipe);
          // Step 2: collapse width
          card.classList.remove("swipe-up");
          card.classList.add("collapse-width");
          card.addEventListener(
            "animationend",
            function onCollapse() {
              card.removeEventListener("animationend", onCollapse);
              // Step 3: replace with new order
              var order = orderPool[orderPoolIndex % orderPool.length];
              orderPoolIndex++;
              var newCard = createLineCard(order);
              card.parentNode.replaceChild(newCard, card);
            },
            { once: true },
          );
        },
        { once: true },
      );
    });
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

  // ============================================
  // 4. AEGIS — GRADE PICKER
  // ============================================
  var aegisPanel = document.querySelector(
    '.moduleAnimation[data-module="aegis"]',
  );
  var activeAegisBadge = null;

  if (aegisPanel) {
    var gradeModal = aegisPanel.querySelector(".animAegisGradeModal");

    // Click badge to open modal
    aegisPanel.querySelectorAll(".animAegisBadge").forEach(function (badge) {
      badge.addEventListener("click", function () {
        activeAegisBadge = badge;
        // Highlight current grade
        var currentGrade = badge.textContent.trim();
        gradeModal
          .querySelectorAll(".animAegisGradeOption")
          .forEach(function (opt) {
            opt.classList.remove("animAegisGradeSelected");
            if (opt.textContent.trim() === currentGrade) {
              opt.classList.add("animAegisGradeSelected");
            }
          });
        gradeModal.style.opacity = "1";
        gradeModal.style.transform = "scale(1)";
        gradeModal.style.animation = "none";
      });
    });

    // Click grade option to assign
    gradeModal
      .querySelectorAll(".animAegisGradeOption")
      .forEach(function (opt) {
        opt.addEventListener("click", function () {
          if (!activeAegisBadge) return;
          var grade = opt.textContent.trim();

          // Update badge
          activeAegisBadge.textContent = grade;
          activeAegisBadge.className =
            "animAegisBadge animAegisBadge" + grade + " stamp";

          // Update selected state
          gradeModal
            .querySelectorAll(".animAegisGradeOption")
            .forEach(function (o) {
              o.classList.remove("animAegisGradeSelected");
            });
          opt.classList.add("animAegisGradeSelected");

          // Remove stamp class after animation
          activeAegisBadge.addEventListener(
            "animationend",
            function () {
              activeAegisBadge.classList.remove("stamp");
            },
            { once: true },
          );

          // Show toast
          var existing = aegisPanel.querySelector(".animAegisToast");
          if (existing) existing.remove();
          var toast = document.createElement("div");
          toast.className = "animAegisToast";
          toast.textContent = "Grade updated to " + grade;
          aegisPanel.querySelector(".animAegis").appendChild(toast);
          setTimeout(function () {
            toast.remove();
          }, 1500);

          activeAegisBadge = null;
        });
      });
  }

  // ============================================
  // 5. FEEDBACK — RESOLVE + REVIEW STREAM
  // ============================================
  var feedbackPanel = document.querySelector(
    '.moduleAnimation[data-module="feedback"]',
  );
  var reviewPool = [
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
  var reviewPoolIndex = 0;

  if (feedbackPanel) {
    feedbackPanel.addEventListener("click", function (e) {
      var resolveBtn = e.target.closest(".animResolveBtn");
      if (!resolveBtn) return;
      var card = resolveBtn.closest(".animReviewCard");
      if (!card || card.classList.contains("animReviewSwipeUp")) return;

      card.classList.add("animReviewSwipeUp");
      card.addEventListener(
        "animationend",
        function () {
          var review = reviewPool[reviewPoolIndex % reviewPool.length];
          reviewPoolIndex++;
          var newCard = createReviewCard(review);
          card.parentNode.replaceChild(newCard, card);
        },
        { once: true },
      );
    });
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
      '">' +
      review.sentiment +
      "</div>" +
      '<img src="assets/icons/hawkrAi.svg" alt="AI" class="animHawkrAiIcon" title="AI-analysed sentiment" />' +
      "</div>";
    return card;
  }

  // ============================================
  // 6. PAYMENTS — FILTER TOGGLE
  // ============================================
  var paymentsPanel = document.querySelector(
    '.moduleAnimation[data-module="payments"]',
  );
  if (paymentsPanel) {
    paymentsPanel
      .querySelectorAll(".animPaymentsFilter")
      .forEach(function (filter) {
        filter.addEventListener("click", function () {
          var filterType = filter.dataset.filter;

          // Toggle active
          paymentsPanel
            .querySelectorAll(".animPaymentsFilter")
            .forEach(function (f) {
              f.classList.remove("animPaymentsFilterActive");
            });
          filter.classList.add("animPaymentsFilterActive");

          // Show/hide rows
          paymentsPanel
            .querySelectorAll(".animPaymentsRow:not(.animPaymentsRowHeader)")
            .forEach(function (row) {
              if (filterType === "successful") {
                row.style.display =
                  row.dataset.status === "refunded" ? "none" : "";
              } else {
                row.style.display =
                  row.dataset.status === "successful" ? "none" : "";
              }
            });
        });
      });
  }

  // ============================================
  // 7. DIETARY — SNAP DRAG & DROP + TYPE TO ADD
  // ============================================
  var dietaryPanel = document.getElementById("animDietaryPanel");
  if (dietaryPanel) {
    var allergenData = {
      Halal: "assets/icons/halal.png",
      Soy: "assets/icons/soy.svg",
      Egg: "assets/icons/egg.svg",
      Seafood: "assets/icons/seafood.svg",
      Nuts: "assets/icons/nuts.svg",
      Dairy: "assets/icons/dairy.svg",
      Kosher: "assets/icons/kosher.svg",
      Gluten: "assets/icons/gluten.svg",
    };

    var container = dietaryPanel.querySelector(".animAllergenContainer");
    var input = dietaryPanel.querySelector(".animAllergenInput");
    var suggestionsWrap = document.getElementById("animSuggestions");

    // Initialize Snap drag & drop (if available)
    function initDietarySnap() {
      if (typeof window.Snap === "undefined") {
        // Retry — module script may not have loaded yet
        setTimeout(initDietarySnap, 100);
        return;
      }
      new window.Snap(dietaryPanel, {
        draggableSelector: "#animSuggestions [data-draggable]:not(.added)",
        dropZoneSelector: "[data-droppable]",
        distance: 3,
        onDrop: function (info) {
          var el = info.element;
          var tag = el.dataset.tag;
          if (tag && !container.querySelector('[data-tag="' + tag + '"]')) {
            addAllergenTag(tag);
            el.classList.add("added");
          }
        },
      });
    }
    initDietarySnap();

    // Click suggestion to add
    suggestionsWrap.addEventListener("click", function (e) {
      var pill = e.target.closest(".animSuggestionPill");
      if (!pill || pill.classList.contains("added")) return;
      var tag = pill.dataset.tag;
      addAllergenTag(tag);
      pill.classList.add("added");
    });

    // Type to add
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var val = input.value.trim();
        if (!val) return;
        // Capitalize first letter
        val = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
        // Check if it matches a known allergen
        if (
          allergenData[val] &&
          !container.querySelector('[data-tag="' + val + '"]')
        ) {
          addAllergenTag(val);
          // Mark suggestion as added
          var pill = suggestionsWrap.querySelector('[data-tag="' + val + '"]');
          if (pill) pill.classList.add("added");
        }
        input.value = "";
      }
      // Backspace on empty input removes last tag
      if (e.key === "Backspace" && input.value === "") {
        var tags = container.querySelectorAll(".animAllergenTag");
        if (tags.length) {
          var lastTag = tags[tags.length - 1];
          removeAllergenTag(lastTag);
        }
      }
    });

    // Remove tag on × click
    container.addEventListener("click", function (e) {
      var removeBtn = e.target.closest(".animTagRemove");
      if (!removeBtn) return;
      var tag = removeBtn.closest(".animAllergenTag");
      removeAllergenTag(tag);
    });

    function addAllergenTag(name) {
      var icon = allergenData[name] || "";
      var tagEl = document.createElement("span");
      tagEl.className = "animAllergenTag";
      tagEl.dataset.tag = name;
      tagEl.innerHTML =
        (icon
          ? '<img src="' + icon + '" alt="" class="animDietaryIcon" />'
          : "") +
        name +
        '<span class="animTagRemove">&times;</span>';
      container.insertBefore(tagEl, input);
    }

    function removeAllergenTag(tagEl) {
      var name = tagEl.dataset.tag;
      tagEl.remove();
      // Return to suggestions
      var pill = suggestionsWrap.querySelector('[data-tag="' + name + '"]');
      if (pill) pill.classList.remove("added");
    }
  }
}
