// ============================================
// FIREBASE IMPORTS
// ============================================

import { auth, db, storage } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import {
  addMenuItem as firebaseAddMenuItem,
  updateMenuItem as firebaseUpdateMenuItem,
  deleteMenuItem as firebaseDeleteMenuItem,
} from "../../firebase/services/foodStalls.js";

// ============================================
// STATE
// ============================================

let menuItems = [];
let currentStallId = null;
let currentUser = null;
let editingItemId = null;
let selectedImageFile = null;

// Check authentication state
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../Auth/login.html";
    return;
  }
  currentUser = user;
  await loadVendorData();
});

// ============================================
// DATA LOADING
// ============================================

async function loadVendorData() {
  try {
    // Get vendor profile to find their stall ID
    const vendorDoc = await getDoc(doc(db, "vendors", currentUser.uid));
    if (!vendorDoc.exists()) {
      console.error("Vendor profile not found");
      return;
    }

    const vendorData = vendorDoc.data();
    currentStallId = vendorData.stallId;

    if (!currentStallId) {
      console.error("No stall associated with this vendor");
      return;
    }

    // Load menu items
    await loadMenuItems();
  } catch (error) {
    console.error("Error loading vendor data:", error);
  }
}

async function loadMenuItems() {
  if (!currentStallId) return;

  try {
    // Get all menu items (including unavailable ones for vendor view)
    const menuRef = collection(db, "foodStalls", currentStallId, "menuItems");
    const q = query(menuRef, orderBy("category"), orderBy("name"));
    const snapshot = await getDocs(q);

    menuItems = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || "",
      category: doc.data().category || "Uncategorized",
      price: doc.data().price || 0,
      description: doc.data().description || "",
      available: doc.data().isAvailable !== false,
      tags: doc.data().tags || [],
      allergens: doc.data().allergens || [],
      imageUrl: doc.data().imageUrl || "",
    }));

    renderMenu();
    bindEditButtons();
  } catch (error) {
    console.error("Error loading menu items:", error);
    // Show empty state
    menuItems = [];
    renderMenu();
    bindEditButtons();
  }
}

// ============================================
// RENDERING
// ============================================

const allergenIcons = {
  seafood: "../../assets/icons/seafood.svg",
  nuts: "../../assets/icons/nuts.svg",
  dairy: "../../assets/icons/dairy.svg",
};

function renderMenuItem(item) {
  return `
    <div class="menuItem">
      <div class="menuItemImage">
        ${
          item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.name}" onerror="this.parentElement.innerHTML='<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'24\\' height=\\'24\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#808080\\' stroke-width=\\'1.5\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\' ry=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><polyline points=\\'21 15 16 10 5 21\\'/></svg>'">`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
        }
      </div>
      <div class="menuItemName">${item.name}</div>
      <div class="menuItemCategory">${item.category}</div>
      <div class="menuItemPrice">$${item.price.toFixed(2)}</div>
      <div class="menuItemDescription">${item.description}</div>
      ${
        item.tags && item.tags.length > 0
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
        item.allergens && item.allergens.length > 0
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

// Detect macOS vs Windows/Linux
const isMac = window.navigator.userAgentData
  ? window.navigator.userAgentData.platform === "macOS"
  : /Mac/i.test(window.navigator.userAgent);

const modKey = isMac ? "\u2318" : "CTRL";

function renderMenu() {
  const container = document.getElementById("menuContent");

  // Group items by category
  const groupedItems = menuItems.reduce((groups, item) => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
    return groups;
  }, {});

  const categories = Object.keys(groupedItems);

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
    ${
      categories.length > 0
        ? `
    <div class="menuCategoryPills" id="menuCategoryPills">
      ${categories
        .map(
          (category, i) =>
            `<button class="menuCategoryPill${i === 0 ? " active" : ""}" data-category="${category}" type="button">${category}</button>`,
        )
        .join("")}
    </div>
    <div class="menuSections">
      ${Object.entries(groupedItems)
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
    `
        : `
    <div class="emptyMenuState">
      <p>No menu items yet. Click "Add item" to create your first product.</p>
    </div>
    `
    }
  `;
}

// ============================================
// EDIT POPUP
// ============================================

function openEditPopup(itemId) {
  const item = menuItems.find((i) => i.id === itemId);
  if (!item) return;

  editingItemId = itemId;
  document.getElementById("editName").value = item.name;
  setCategoryValue("editCategory", "editCustomCategory", item.category);
  document.getElementById("editPrice").value = item.price;
  document.getElementById("editDescription").value = item.description;
  document.getElementById("editTags").value = (item.tags || []).join(", ");
  document.getElementById("editAllergens").value = (item.allergens || []).join(
    ", ",
  );
  document.getElementById("editAvailable").checked = item.available;

  document.getElementById("editOverlay").classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeEditPopup() {
  editingItemId = null;
  document.getElementById("editOverlay").classList.remove("active");
  document.body.style.overflow = "";
}

async function saveMenuItem() {
  if (!editingItemId || !currentStallId) return;

  const saveBtn = document.getElementById("editSaveBtn");
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "Saving...";
  saveBtn.disabled = true;

  try {
    const updates = {
      name: document.getElementById("editName").value.trim(),
      category: getCategoryValue("editCategory", "editCustomCategory"),
      price: parseFloat(document.getElementById("editPrice").value) || 0,
      description: document.getElementById("editDescription").value.trim(),
      tags: document
        .getElementById("editTags")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      allergens: document
        .getElementById("editAllergens")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      isAvailable: document.getElementById("editAvailable").checked,
    };

    await firebaseUpdateMenuItem(currentStallId, editingItemId, updates);

    // Reload menu items
    await loadMenuItems();
    closeEditPopup();
  } catch (error) {
    console.error("Error saving menu item:", error);
    alert("Failed to save changes. Please try again.");
  } finally {
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

// ============================================
// ADD PANEL
// ============================================

function openAddPanel() {
  document.getElementById("addPanelForm").reset();
  document.getElementById("addName").classList.remove("error");
  document.getElementById("addCustomCategory").style.display = "none";
  document.getElementById("addPanelOverlay").classList.add("active");
  document.getElementById("addPanel").classList.add("active");
  document.body.style.overflow = "hidden";

  // Reset image state
  selectedImageFile = null;
  document.getElementById("addImageInput").value = "";
  document.getElementById("addImagePreview").style.display = "none";
  document.getElementById("addImageBtnText").textContent = "Upload";
}

function closeAddPanel() {
  document.getElementById("addPanelOverlay").classList.remove("active");
  document.getElementById("addPanel").classList.remove("active");
  document.body.style.overflow = "";

  // Reset image state
  selectedImageFile = null;
  document.getElementById("addImageInput").value = "";
  document.getElementById("addImagePreview").style.display = "none";
  document.getElementById("addImageBtnText").textContent = "Upload";
}

async function uploadImage(file, stallId, itemId) {
  if (!file) return null;

  const fileExtension = file.name.split(".").pop();
  const fileName = `${itemId}.${fileExtension}`;
  const storageRef = ref(storage, `stalls/${stallId}/menu/${fileName}`);

  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}

async function addMenuItem() {
  if (!currentStallId) {
    alert("No stall found. Please complete your vendor profile first.");
    return;
  }

  const nameInput = document.getElementById("addName");
  const name = nameInput.value.trim();

  if (!name) {
    nameInput.classList.add("error");
    return;
  }
  nameInput.classList.remove("error");

  const saveBtn = document.getElementById("addPanelSaveBtn");
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "Adding...";
  saveBtn.disabled = true;

  try {
    const newItem = {
      name,
      category: getCategoryValue("addCategory", "addCustomCategory"),
      price: parseFloat(document.getElementById("addPrice").value) || 0,
      description: document.getElementById("addDescription").value.trim(),
      tags: document
        .getElementById("addTags")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      allergens: Array.from(
        document.querySelectorAll(".addFormAllergenCheck:checked"),
      ).map((cb) => cb.value),
    };

    // Add item to get the ID first
    const itemId = await firebaseAddMenuItem(currentStallId, newItem);

    // Upload image if selected
    if (selectedImageFile) {
      saveBtn.textContent = "Uploading image...";
      const imageUrl = await uploadImage(
        selectedImageFile,
        currentStallId,
        itemId,
      );
      if (imageUrl) {
        await firebaseUpdateMenuItem(currentStallId, itemId, { imageUrl });
      }
    }

    // Reset image state
    selectedImageFile = null;

    // Reload menu items
    await loadMenuItems();
    closeAddPanel();
  } catch (error) {
    console.error("Error adding menu item:", error);
    alert("Failed to add item. Please try again.");
  } finally {
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

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

// Re-binds event listeners on elements created by renderMenu()
function bindEditButtons() {
  document.querySelectorAll(".menuItemEdit").forEach((btn) => {
    btn.addEventListener("click", () => openEditPopup(btn.dataset.id));
  });

  const addItemButton = document.getElementById("addItemButton");
  if (addItemButton) {
    addItemButton.addEventListener("click", openAddPanel);
  }

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

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  // Initialize vendor navbar (handles auth, vendor name, logout, keyboard shortcuts)
  initVendorNavbar();

  // Initial render with empty state (will be updated when auth loads)
  renderMenu();
  bindEditButtons();
  initScrollSpy();

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

  // Image upload handlers
  const addImageBtn = document.getElementById("addImageBtn");
  const addImageInput = document.getElementById("addImageInput");
  const addImagePreview = document.getElementById("addImagePreview");
  const addImagePreviewImg = document.getElementById("addImagePreviewImg");
  const addImageRemoveBtn = document.getElementById("addImageRemoveBtn");
  const addImageBtnText = document.getElementById("addImageBtnText");

  addImageBtn.addEventListener("click", () => {
    addImageInput.click();
  });

  addImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be under 10MB");
      addImageInput.value = "";
      return;
    }

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Please upload a JPEG, PNG, or WEBP image");
      addImageInput.value = "";
      return;
    }

    selectedImageFile = file;
    addImageBtnText.textContent =
      file.name.length > 15 ? file.name.substring(0, 15) + "..." : file.name;

    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
      addImagePreviewImg.src = event.target.result;
      addImagePreview.style.display = "block";
    };
    reader.readAsDataURL(file);
  });

  addImageRemoveBtn.addEventListener("click", () => {
    selectedImageFile = null;
    addImageInput.value = "";
    addImagePreview.style.display = "none";
    addImageBtnText.textContent = "Upload";
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
      const searchInput = document.getElementById("searchInput");
      if (searchInput) searchInput.focus();
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
