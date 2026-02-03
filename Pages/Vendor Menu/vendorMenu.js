const mockMenuItems = [
  {
    id: "001",
    name: "Pad Thai with Shrimp",
    category: "Noodles",
    price: 23.9,
    description:
      "Classic pad thai stir-fried with tiger prawns, bean sprouts, crushed peanuts, and lime.",
    available: true,
    tags: ["Thai", "Halal"],
    allergens: ["Seafood", "Nuts"],
  },
  {
    id: "002",
    name: "Pad Thai with Shrimp, Extra Peanuts, and Lime",
    category: "Noodles",
    price: 15.5,
    description:
      "Pad thai with extra crushed peanuts and a generous squeeze of lime.",
    available: true,
    tags: ["Thai"],
    allergens: ["Seafood", "Nuts"],
  },
  {
    id: "003",
    name: "Nasi Lemak",
    category: "Rice",
    price: 7.0,
    description:
      "Fragrant coconut rice with sambal, fried anchovies, peanuts, cucumber, and egg.",
    available: true,
    tags: ["Malay", "Halal"],
    allergens: ["Nuts", "Dairy"],
  },
  {
    id: "004",
    name: "Chicken Rice",
    category: "Rice",
    price: 5.5,
    description:
      "Hainanese-style poached chicken served with fragrant rice and chilli sauce.",
    available: true,
    tags: ["Chinese", "Halal"],
    allergens: [],
  },
  {
    id: "005",
    name: "Sushi Platter",
    category: "Rice",
    price: 28.0,
    description:
      "Assorted nigiri and maki rolls with fresh salmon, tuna, and tamago.",
    available: false,
    tags: ["Japanese"],
    allergens: ["Seafood", "Dairy"],
  },
  {
    id: "006",
    name: "Roti Prata",
    category: "Sides",
    price: 1.5,
    description: "Crispy pan-fried flatbread served with curry dipping sauce.",
    available: true,
    tags: ["Indian", "Halal"],
    allergens: ["Dairy"],
  },
  {
    id: "007",
    name: "Fish Head Curry",
    category: "Sides",
    price: 18.0,
    description:
      "Red snapper head simmered in a rich and spicy curry with okra and eggplant.",
    available: true,
    tags: ["Indian"],
    allergens: ["Seafood"],
  },
  {
    id: "008",
    name: "Coca-Cola",
    category: "Drinks",
    price: 1.5,
    description: "Ice-cold 330ml can.",
    available: true,
    tags: [],
    allergens: [],
  },
  {
    id: "009",
    name: "Teh Tarik",
    category: "Drinks",
    price: 2.5,
    description: "Pulled milk tea, sweet and frothy.",
    available: true,
    tags: ["Malay", "Halal"],
    allergens: ["Dairy"],
  },
  {
    id: "010",
    name: "Green Tea",
    category: "Drinks",
    price: 2.0,
    description: "Hot Japanese green tea.",
    available: false,
    tags: ["Japanese"],
    allergens: [],
  },
];

const allergenIcons = {
  seafood: "../../assets/icons/seafood.svg",
  nuts: "../../assets/icons/nuts.svg",
  dairy: "../../assets/icons/dairy.svg",
};

function renderMenuItem(item) {
  return `
    <div class="menuItem">
      <div class="menuItemImage">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      </div>
      <div class="menuItemName">${item.name}</div>
      <div class="menuItemCategory">${item.category}</div>
      <div class="menuItemPrice">$${item.price.toFixed(2)}</div>
      <div class="menuItemDescription">${item.description}</div>
      ${
        item.tags.length > 0
          ? `
      <div class="menuItemTags">
        ${item.tags
          .map((tag) => {
            const tagLower = tag.toLowerCase();
            const modifier =
              tagLower === "halal"
                ? " halal"
                : tagLower === "kosher"
                  ? " kosher"
                  : "";
            let iconHTML = "";
            if (tagLower === "halal")
              iconHTML = `<img src="../../assets/icons/halal.png" alt="Halal">`;
            if (tagLower === "kosher")
              iconHTML = `<img src="../../assets/icons/kosher.svg" alt="Kosher">`;
            return `<span class="menuTag${modifier}">${iconHTML}${tag}</span>`;
          })
          .join("")}
      </div>`
          : ""
      }
      ${
        item.allergens.length > 0
          ? `
      <div class="menuItemAllergens">
        <span class="allergensLabel">Allergens</span>
        <div class="allergenTags">
          ${item.allergens
            .map((allergen) => {
              const iconPath = allergenIcons[allergen.toLowerCase()];
              const iconHTML = iconPath
                ? `<img src="${iconPath}" alt="${allergen}">`
                : "";
              return `<span class="allergenTag">${iconHTML}${allergen}</span>`;
            })
            .join("")}
        </div>
      </div>`
          : ""
      }
      <div class="menuItemFooter">
        <div class="menuItemAvailability ${item.available ? "available" : "unavailable"}">
          <span class="availabilityDot"></span>
          ${item.available ? "Available" : "Unavailable"}
        </div>
        <button class="menuItemEdit" data-id="${item.id}">Edit</button>
      </div>
    </div>
  `;
}

// Detect macOS vs Windows/Linux to show correct modifier key (⌘ or CTRL).
// Defined at top level so it's available in renderMenu() and event listeners,
// avoiding the issue of re-rendered elements losing their text content.
const isMac = window.navigator.userAgentData
  ? window.navigator.userAgentData.platform === "macOS"
  : /Mac/i.test(window.navigator.userAgent);

// Display text for keyboard shortcut modifier: "⌘" on Mac, "CTRL" on Windows
const modKey = isMac ? "\u2318" : "CTRL";

function renderMenu() {
  const container = document.getElementById("menuContent");

  container.innerHTML = `
    <div class="menuHeader">
      <span class="sectionLabel">Menu</span>
      <div class="menuHeaderActions">
        <a class="newOrderButton" href="../Vendor Order/vendorCreateOrder.html">
          New order
          <kbd>n</kbd>
        </a>
        <button class="addItemButton" id="addItemButton">
          Add item
          <kbd>${modKey}</kbd>
          <kbd>A</kbd>
        </button>
      </div>
    </div>
    <div class="menuCategoryPills" id="menuCategoryPills">
      ${Object.keys(
        mockMenuItems.reduce((groups, item) => {
          if (!groups[item.category]) groups[item.category] = [];
          groups[item.category].push(item);
          return groups;
        }, {}),
      )
        .map(
          (category, i) =>
            `<button class="menuCategoryPill${i === 0 ? " active" : ""}" data-category="${category}" type="button">${category}</button>`,
        )
        .join("")}
    </div>
    <div class="menuSections">
      ${Object.entries(
        mockMenuItems.reduce((groups, item) => {
          if (!groups[item.category]) groups[item.category] = [];
          groups[item.category].push(item);
          return groups;
        }, {}),
      )
        .map(
          ([category, items]) => `
        <div class="menuSection" id="section-${category.replace(/\s+/g, "-")}">
          <h3 class="menuSectionTitle">${category}</h3>
          <div class="menuCards">
            ${items.map(renderMenuItem).join("")}
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

let editingItemId = null;

function openEditPopup(itemId) {
  const item = mockMenuItems.find((i) => i.id === itemId);
  if (!item) return;

  editingItemId = itemId;
  document.getElementById("editName").value = item.name;
  setCategoryValue("editCategory", "editCustomCategory", item.category);
  document.getElementById("editPrice").value = item.price;
  document.getElementById("editDescription").value = item.description;
  document.getElementById("editTags").value = item.tags.join(", ");
  document.getElementById("editAllergens").value = item.allergens.join(", ");
  document.getElementById("editAvailable").checked = item.available;

  document.getElementById("editOverlay").classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeEditPopup() {
  editingItemId = null;
  document.getElementById("editOverlay").classList.remove("active");
  document.body.style.overflow = "";
}

function saveMenuItem() {
  const item = mockMenuItems.find((i) => i.id === editingItemId);
  if (!item) return;

  item.name = document.getElementById("editName").value.trim();
  item.category = getCategoryValue("editCategory", "editCustomCategory");
  item.price = parseFloat(document.getElementById("editPrice").value) || 0;
  item.description = document.getElementById("editDescription").value.trim();
  item.tags = document
    .getElementById("editTags")
    .value.split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  item.allergens = document
    .getElementById("editAllergens")
    .value.split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  item.available = document.getElementById("editAvailable").checked;

  closeEditPopup();
  renderMenu();
  bindEditButtons();
}

function toggleCustomCategory(selectId, inputId) {
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  input.style.display = select.value === "__other" ? "block" : "none";
  if (select.value !== "__other") input.value = "";
}

function getCategoryValue(selectId, inputId) {
  const select = document.getElementById(selectId);
  if (select.value === "__other") {
    return document.getElementById(inputId).value.trim() || "Uncategorized";
  }
  return select.value;
}

function setCategoryValue(selectId, inputId, category) {
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  const options = Array.from(select.options).map((o) => o.value);
  if (options.includes(category)) {
    select.value = category;
    input.style.display = "none";
    input.value = "";
  } else {
    select.value = "__other";
    input.style.display = "block";
    input.value = category;
  }
}

function openAddPanel() {
  document.getElementById("addPanelForm").reset();
  document.getElementById("addName").classList.remove("error");
  document.getElementById("addCustomCategory").style.display = "none";
  document.getElementById("addPanelOverlay").classList.add("active");
  document.getElementById("addPanel").classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeAddPanel() {
  document.getElementById("addPanelOverlay").classList.remove("active");
  document.getElementById("addPanel").classList.remove("active");
  document.body.style.overflow = "";
}

function addMenuItem() {
  const nameInput = document.getElementById("addName");
  const name = nameInput.value.trim();

  if (!name) {
    nameInput.classList.add("error");
    return;
  }
  nameInput.classList.remove("error");

  const newItem = {
    id: String(Date.now()),
    name,
    category: getCategoryValue("addCategory", "addCustomCategory"),
    price: parseFloat(document.getElementById("addPrice").value) || 0,
    description: document.getElementById("addDescription").value.trim(),
    available: true,
    tags: document
      .getElementById("addTags")
      .value.split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    allergens: Array.from(
      document.querySelectorAll(".addFormAllergenCheck:checked"),
    ).map((cb) => cb.value),
  };

  mockMenuItems.push(newItem);
  closeAddPanel();
  renderMenu();
  bindEditButtons();
}

// Re-binds event listeners on elements created by renderMenu()
function bindEditButtons() {
  document.querySelectorAll(".menuItemEdit").forEach((btn) => {
    btn.addEventListener("click", () => openEditPopup(btn.dataset.id));
  });
  document
    .getElementById("addItemButton")
    .addEventListener("click", openAddPanel);

  // Category pill click → scroll to section
  document.querySelectorAll(".menuCategoryPill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const category = pill.dataset.category;
      const section = document.getElementById(
        `section-${category.replace(/\s+/g, "-")}`,
      );
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      document
        .querySelectorAll(".menuCategoryPill")
        .forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
    });
  });
}

// Scroll-spy: highlight active pill based on scroll position
function initScrollSpy() {
  const sections = document.querySelectorAll(".menuSection");
  const pills = document.querySelectorAll(".menuCategoryPill");
  if (!sections.length || !pills.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          pills.forEach((p) => {
            const cat = p.dataset.category.replace(/\s+/g, "-");
            p.classList.toggle("active", `section-${cat}` === id);
          });
        }
      });
    },
    { rootMargin: "-20% 0px -70% 0px" },
  );

  sections.forEach((section) => observer.observe(section));
}

document.addEventListener("DOMContentLoaded", () => {
  renderMenu();
  bindEditButtons();
  initScrollSpy();

  document.getElementById("searchKeyMod").textContent = modKey;

  // Category "Other" toggles
  document.getElementById("addCategory").addEventListener("change", () => {
    toggleCustomCategory("addCategory", "addCustomCategory");
  });
  document.getElementById("editCategory").addEventListener("change", () => {
    toggleCustomCategory("editCategory", "editCustomCategory");
  });

  // Add panel handlers
  document
    .getElementById("addPanelClose")
    .addEventListener("click", closeAddPanel);
  document
    .getElementById("addPanelCancelBtn")
    .addEventListener("click", closeAddPanel);
  document
    .getElementById("addPanelSaveBtn")
    .addEventListener("click", addMenuItem);
  document
    .getElementById("addPanelOverlay")
    .addEventListener("click", closeAddPanel);
  document.getElementById("addName").addEventListener("input", (e) => {
    e.target.classList.remove("error");
  });

  // Edit popup close handlers
  document
    .getElementById("editPopupClose")
    .addEventListener("click", closeEditPopup);
  document
    .getElementById("editCancelBtn")
    .addEventListener("click", closeEditPopup);
  document
    .getElementById("editSaveBtn")
    .addEventListener("click", saveMenuItem);
  document.getElementById("editOverlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeEditPopup();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeEditPopup();
      closeAddPanel();
    }

    const modifier = isMac ? e.metaKey : e.ctrlKey;
    if (modifier && e.key === "k") {
      e.preventDefault();
      document.getElementById("searchInput").focus();
    }
    if (modifier && e.key === "a") {
      e.preventDefault();
      openAddPanel();
    }
    // "n" key (no modifier) navigates to create order page
    if (
      e.key === "n" &&
      !modifier &&
      !e.altKey &&
      e.target.tagName !== "INPUT" &&
      e.target.tagName !== "TEXTAREA"
    ) {
      window.location.href = "../Vendor Order/vendorCreateOrder.html";
    }
  });
});
