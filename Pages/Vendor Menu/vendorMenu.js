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
import { initMiniLiquidGlassToggle } from "../../assets/js/liquidGlassToggle.js";
import Snap from "../../drag and drop/snap.esm.js";

// ============================================
// STATE
// ============================================

let menuItems = [];
let currentStallId = null;
let currentUser = null;
let editingItemId = null;
let selectedImageFile = null;
let addVariants = []; // Variants for add form
let editVariants = []; // Variants for edit form
let addAllergens = []; // Allergens for add form
let editAllergens = []; // Allergens for edit form
let isLoading = true; // Track loading state

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
      customizations: doc.data().customizations || [],
    }));

    isLoading = false;
    renderMenu();
    bindEditButtons();
  } catch (error) {
    console.error("Error loading menu items:", error);
    // Show empty state
    menuItems = [];
    isLoading = false;
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
  peanuts: "../../assets/icons/nuts.svg",
  dairy: "../../assets/icons/dairy.svg",
  eggs: "../../assets/icons/egg.svg",
  soy: "../../assets/icons/soy.svg",
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
      isLoading
        ? `
    <div class="menuCategoryPillsSkeleton">
      <div class="skeletonPill"></div>
      <div class="skeletonPill"></div>
      <div class="skeletonPill"></div>
    </div>
    <div class="menuSectionSkeleton">
      <div class="skeletonSectionTitle"></div>
      <div class="menuSkeletonGrid">
        ${Array(3).fill('<div class="menuItemSkeleton"><div class="skeletonImage"></div><div class="skeletonText skeletonTitle"></div><div class="skeletonText skeletonCategory"></div><div class="skeletonText skeletonPrice"></div><div class="skeletonAllergens"><div class="skeletonText skeletonAllergenLabel"></div><div class="skeletonAllergenTags"><div class="skeletonText skeletonAllergenTag"></div><div class="skeletonText skeletonAllergenTag"></div><div class="skeletonText skeletonAllergenTag"></div></div></div><div class="skeletonFooter"><div class="skeletonText skeletonAvailability"></div><div class="skeletonText skeletonButton"></div></div></div>').join("")}
      </div>
    </div>
    `
        : categories.length > 0
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
  document.getElementById("editAvailable").checked = item.available;

  // Load existing variants/customizations
  editVariants = (item.customizations || []).map((c) => ({
    name: c.name || "",
    options: [...(c.options || [])],
    priceAdjustments: [
      ...(c.priceAdjustments || c.options?.map(() => 0) || []),
    ],
    required: c.required !== false, // Default to true
    multiSelect: c.multiSelect || false,
  }));
  renderAllVariants("editVariantsBuilder", editVariants);

  // Load existing allergens
  editAllergens = [...(item.allergens || [])];
  renderAllergenTags("editAllergenContainer", editAllergens);
  updateAllergenSuggestionStates("editAllergenSuggestions", editAllergens);
  initAllergenInput("edit");

  document.getElementById("editPanelOverlay").classList.add("active");
  document.getElementById("editPanel").classList.add("active");
  document.body.style.overflow = "hidden";

  // Initialize availability toggle
  const editAvailableToggle = document.getElementById("editAvailableToggle");
  if (editAvailableToggle) {
    editAvailableToggle.dataset.init = "";
    initMiniLiquidGlassToggle(editAvailableToggle);
  }
}

function closeEditPopup() {
  editingItemId = null;
  document.getElementById("editPanelOverlay").classList.remove("active");
  document.getElementById("editPanel").classList.remove("active");
  document.body.style.overflow = "";
}

// ============================================
// DELETE FUNCTIONALITY
// ============================================

function openDeleteModal() {
  document.getElementById("deleteModalOverlay").classList.add("active");
}

function closeDeleteModal() {
  document.getElementById("deleteModalOverlay").classList.remove("active");
}

async function deleteMenuItem() {
  if (!editingItemId || !currentStallId) return;

  const confirmBtn = document.getElementById("deleteModalConfirmBtn");
  const originalText = confirmBtn.textContent;
  confirmBtn.textContent = "Deleting...";
  confirmBtn.disabled = true;

  try {
    await firebaseDeleteMenuItem(currentStallId, editingItemId);

    // Reload menu items
    await loadMenuItems();
    closeDeleteModal();
    closeEditPopup();
  } catch (error) {
    console.error("Error deleting menu item:", error);
    alert("Failed to delete item. Please try again.");
  } finally {
    confirmBtn.textContent = originalText;
    confirmBtn.disabled = false;
  }
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
      allergens: [...editAllergens],
      isAvailable: document.getElementById("editAvailable").checked,
      customizations: getCleanVariants(editVariants),
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

  // Reset variants
  addVariants = [];
  renderAllVariants("addVariantsBuilder", addVariants);

  // Reset allergens
  addAllergens = [];
  renderAllergenTags("addAllergenContainer", addAllergens);
  updateAllergenSuggestionStates("addAllergenSuggestions", addAllergens);
  initAllergenInput("add");

  // Initialize availability toggle
  const addAvailableToggle = document.getElementById("addAvailableToggle");
  if (addAvailableToggle) {
    addAvailableToggle.dataset.init = "";
    initMiniLiquidGlassToggle(addAvailableToggle);
  }
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
      allergens: [...addAllergens],
      customizations: getCleanVariants(addVariants),
      isAvailable: document.getElementById("addAvailable").checked,
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

// ============================================
// VARIANTS BUILDER
// ============================================

function renderVariantGroup(variant, index, containerId) {
  const isAdd = containerId === "addVariantsBuilder";
  const prefix = isAdd ? "add" : "edit";
  const isRequired = variant.required !== false; // Default to true
  const isMultiSelect = variant.multiSelect || false;

  return `
    <div class="variantGroup" data-index="${index}">
      <div class="variantGroupHeader">
        <input
          type="text"
          class="variantGroupName"
          placeholder="Variant name (e.g., Size, Spice Level)"
          value="${variant.name || ""}"
          data-index="${index}"
          data-prefix="${prefix}"
        />
        <button type="button" class="variantGroupRemove" data-index="${index}" data-prefix="${prefix}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="variantTogglesRow">
        <div class="variantToggleItem">
          <label class="liquidGlassToggle mini variantRequiredToggle" data-index="${index}" data-prefix="${prefix}">
            <input
              type="checkbox"
              class="variantRequiredCheck"
              ${isRequired ? "checked" : ""}
              data-index="${index}"
              data-prefix="${prefix}"
            />
            <span class="toggleTrack">
              <span class="toggleThumb"></span>
            </span>
          </label>
          <span class="variantToggleLabel">Required</span>
        </div>
        <div class="variantToggleItem">
          <label class="liquidGlassToggle mini variantMultiSelectToggle" data-index="${index}" data-prefix="${prefix}">
            <input
              type="checkbox"
              class="variantMultiSelectCheck"
              ${isMultiSelect ? "checked" : ""}
              data-index="${index}"
              data-prefix="${prefix}"
            />
            <span class="toggleTrack">
              <span class="toggleThumb"></span>
            </span>
          </label>
          <span class="variantToggleLabel">Allow multiple selections</span>
        </div>
      </div>
      <div class="variantOptions" data-index="${index}">
        ${variant.options.map((opt, optIndex) => renderVariantOption(opt, variant.priceAdjustments?.[optIndex] || 0, index, optIndex, prefix)).join("")}
      </div>
      <button type="button" class="addVariantOptionBtn" data-index="${index}" data-prefix="${prefix}">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 3.33334V12.6667M3.33333 8H12.6667" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Add option
      </button>
    </div>
  `;
}

function renderVariantOption(
  optionName,
  priceAdjustment,
  groupIndex,
  optIndex,
  prefix,
) {
  return `
    <div class="variantOption" data-group="${groupIndex}" data-opt="${optIndex}">
      <input
        type="text"
        class="variantOptionName"
        placeholder="Option (e.g., Small, Medium)"
        value="${optionName || ""}"
        data-group="${groupIndex}"
        data-opt="${optIndex}"
        data-prefix="${prefix}"
      />
      <div class="variantPriceWrapper">
        <span class="variantPricePrefix">+S$</span>
        <input
          type="number"
          class="variantPriceInput"
          placeholder="0.00"
          step="0.01"
          min="0"
          value="${priceAdjustment || ""}"
          data-group="${groupIndex}"
          data-opt="${optIndex}"
          data-prefix="${prefix}"
        />
      </div>
      <button type="button" class="variantOptionRemove" data-group="${groupIndex}" data-opt="${optIndex}" data-prefix="${prefix}">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  `;
}

function renderAllVariants(containerId, variants) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = variants
    .map((v, i) => renderVariantGroup(v, i, containerId))
    .join("");
  bindVariantEvents(containerId);
}

function bindVariantEvents(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isAdd = containerId === "addVariantsBuilder";
  const variants = isAdd ? addVariants : editVariants;

  // Group name changes
  container.querySelectorAll(".variantGroupName").forEach((input) => {
    input.addEventListener("input", (e) => {
      const index = parseInt(e.target.dataset.index);
      variants[index].name = e.target.value;
    });
  });

  // Initialize mini liquid glass toggles for required
  container.querySelectorAll(".variantRequiredToggle").forEach((toggle) => {
    const index = parseInt(toggle.dataset.index);
    initMiniLiquidGlassToggle(toggle, (checked) => {
      variants[index].required = checked;
    });
  });

  // Initialize mini liquid glass toggles for multi-select
  container.querySelectorAll(".variantMultiSelectToggle").forEach((toggle) => {
    const index = parseInt(toggle.dataset.index);
    initMiniLiquidGlassToggle(toggle, (checked) => {
      variants[index].multiSelect = checked;
    });
  });

  // Option name changes
  container.querySelectorAll(".variantOptionName").forEach((input) => {
    input.addEventListener("input", (e) => {
      const groupIndex = parseInt(e.target.dataset.group);
      const optIndex = parseInt(e.target.dataset.opt);
      variants[groupIndex].options[optIndex] = e.target.value;
    });
  });

  // Price adjustment changes
  container.querySelectorAll(".variantPriceInput").forEach((input) => {
    input.addEventListener("input", (e) => {
      const groupIndex = parseInt(e.target.dataset.group);
      const optIndex = parseInt(e.target.dataset.opt);
      variants[groupIndex].priceAdjustments[optIndex] =
        parseFloat(e.target.value) || 0;
    });
  });

  // Remove variant group
  container.querySelectorAll(".variantGroupRemove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      variants.splice(index, 1);
      renderAllVariants(containerId, variants);
    });
  });

  // Add option to group
  container.querySelectorAll(".addVariantOptionBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      variants[index].options.push("");
      variants[index].priceAdjustments.push(0);
      renderAllVariants(containerId, variants);
    });
  });

  // Remove option from group
  container.querySelectorAll(".variantOptionRemove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const groupIndex = parseInt(e.currentTarget.dataset.group);
      const optIndex = parseInt(e.currentTarget.dataset.opt);
      variants[groupIndex].options.splice(optIndex, 1);
      variants[groupIndex].priceAdjustments.splice(optIndex, 1);
      // Remove the group if no options left
      if (variants[groupIndex].options.length === 0) {
        variants.splice(groupIndex, 1);
      }
      renderAllVariants(containerId, variants);
    });
  });
}

function addVariantGroup(isAdd) {
  const variants = isAdd ? addVariants : editVariants;
  const containerId = isAdd ? "addVariantsBuilder" : "editVariantsBuilder";

  variants.push({
    name: "",
    options: [""],
    priceAdjustments: [0],
    multiSelect: false,
  });

  renderAllVariants(containerId, variants);
}

function getCleanVariants(variants) {
  // Filter out empty variant groups and options
  return variants
    .filter((v) => v.name.trim() && v.options.some((opt) => opt.trim()))
    .map((v) => ({
      name: v.name.trim(),
      options: v.options.filter((opt) => opt.trim()),
      priceAdjustments: v.priceAdjustments.filter((_, i) =>
        v.options[i]?.trim(),
      ),
      required: v.required !== false, // Default to true
      multiSelect: v.multiSelect || false,
    }));
}

// ============================================
// ALLERGEN INPUT
// ============================================

function getAllergenIcon(allergen) {
  const allergenLower = allergen.toLowerCase();
  const iconPath = allergenIcons[allergenLower];
  return iconPath || null;
}

function renderAllergenTags(containerId, allergens) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Remove existing tags (keep the input)
  container.querySelectorAll(".allergenTag").forEach((tag) => tag.remove());

  const input = container.querySelector(".allergenInput");

  allergens.forEach((allergen) => {
    const tag = document.createElement("span");
    tag.className = "allergenTag";
    tag.dataset.allergen = allergen;

    const iconPath = getAllergenIcon(allergen);
    const iconHTML = iconPath
      ? `<img src="${iconPath}" alt="${allergen}">`
      : "";

    tag.innerHTML = `
      <span class="allergenTagInner">${iconHTML}${allergen}</span>
      <button class="allergenTagRemove" type="button">&times;</button>
    `;

    tag.querySelector(".allergenTagRemove").addEventListener("click", () => {
      const isAdd = containerId === "addAllergenContainer";
      removeAllergenTag(allergen, isAdd);
    });

    container.insertBefore(tag, input);
  });
}

function updateAllergenSuggestionStates(suggestionsId, allergens) {
  const suggestionsContainer = document.getElementById(suggestionsId);
  if (!suggestionsContainer) return;

  const suggestions = suggestionsContainer.querySelectorAll(
    ".allergenSuggestion",
  );
  suggestions.forEach((suggestion) => {
    const allergen = suggestion.dataset.allergen;
    if (allergens.includes(allergen)) {
      suggestion.classList.add("added");
    } else {
      suggestion.classList.remove("added");
    }
  });
}

function addAllergenTag(allergen, isAdd) {
  const allergens = isAdd ? addAllergens : editAllergens;
  const containerId = isAdd ? "addAllergenContainer" : "editAllergenContainer";
  const suggestionsId = isAdd
    ? "addAllergenSuggestions"
    : "editAllergenSuggestions";

  // Capitalize first letter
  const capitalized =
    allergen.charAt(0).toUpperCase() + allergen.slice(1).toLowerCase();

  // Check if already exists
  if (allergens.includes(capitalized)) return;

  allergens.push(capitalized);
  renderAllergenTags(containerId, allergens);
  updateAllergenSuggestionStates(suggestionsId, allergens);
}

function removeAllergenTag(allergen, isAdd) {
  const allergens = isAdd ? addAllergens : editAllergens;
  const containerId = isAdd ? "addAllergenContainer" : "editAllergenContainer";
  const suggestionsId = isAdd
    ? "addAllergenSuggestions"
    : "editAllergenSuggestions";

  const index = allergens.indexOf(allergen);
  if (index > -1) {
    allergens.splice(index, 1);
  }

  renderAllergenTags(containerId, allergens);
  updateAllergenSuggestionStates(suggestionsId, allergens);
}

function initAllergenInput(prefix) {
  const isAdd = prefix === "add";
  const containerId = isAdd ? "addAllergenContainer" : "editAllergenContainer";
  const inputId = isAdd ? "addAllergenInput" : "editAllergenInput";
  const suggestionsId = isAdd
    ? "addAllergenSuggestions"
    : "editAllergenSuggestions";
  const panelId = isAdd ? "addPanel" : "editPanel";

  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  const suggestionsContainer = document.getElementById(suggestionsId);
  const panel = document.getElementById(panelId);

  if (!container || !input) return;

  // Handle Enter key to add custom allergen
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = input.value.trim();
      if (val) {
        addAllergenTag(val, isAdd);
        input.value = "";
      }
    } else if (e.key === "Backspace" && !input.value) {
      // Remove last tag on backspace if input is empty
      const allergens = isAdd ? addAllergens : editAllergens;
      if (allergens.length) {
        const lastAllergen = allergens[allergens.length - 1];
        removeAllergenTag(lastAllergen, isAdd);
      }
    }
  });

  // Click on container focuses input
  container.addEventListener("click", (e) => {
    if (e.target === container) {
      input.focus();
    }
  });

  // Click on suggestion to add
  if (suggestionsContainer) {
    suggestionsContainer.addEventListener("click", (e) => {
      const suggestion = e.target.closest(".allergenSuggestion");
      if (suggestion && !suggestion.classList.contains("added")) {
        const allergen = suggestion.dataset.allergen;
        if (allergen) {
          addAllergenTag(allergen, isAdd);
        }
      }
    });
  }

  // Initialize drag and drop
  if (panel) {
    initAllergenDragDrop(panel, isAdd);
  }
}

function initAllergenDragDrop(panel, isAdd) {
  const allergens = isAdd ? addAllergens : editAllergens;
  const suggestionsId = isAdd
    ? "addAllergenSuggestions"
    : "editAllergenSuggestions";

  const snap = new Snap(panel, {
    draggableSelector: `#${suggestionsId} [data-draggable]:not(.added)`,
    dropZoneSelector: "[data-droppable]",
    distance: 3,
    onDropZoneEnter: ({ dropZone }) => {
      dropZone.classList.add("snap-drop-active");
    },
    onDropZoneLeave: ({ dropZone }) => {
      dropZone.classList.remove("snap-drop-active");
    },
    onDrop: ({ element, dropZone }) => {
      dropZone.classList.remove("snap-drop-active");
      const allergen = element.dataset.allergen;
      if (allergen && !allergens.includes(allergen)) {
        addAllergenTag(allergen, isAdd);
      }
    },
  });
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

  // Edit panel close handlers
  document
    .getElementById("editPanelClose")
    .addEventListener("click", closeEditPopup);
  document
    .getElementById("editCancelBtn")
    .addEventListener("click", closeEditPopup);
  document
    .getElementById("editSaveBtn")
    .addEventListener("click", saveMenuItem);
  document
    .getElementById("editPanelOverlay")
    .addEventListener("click", closeEditPopup);

  // Delete button and modal handlers
  document
    .getElementById("editDeleteBtn")
    .addEventListener("click", openDeleteModal);
  document
    .getElementById("deleteModalCancelBtn")
    .addEventListener("click", closeDeleteModal);
  document
    .getElementById("deleteModalConfirmBtn")
    .addEventListener("click", deleteMenuItem);
  document
    .getElementById("deleteModalOverlay")
    .addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeDeleteModal();
    });

  // Variant group buttons
  document
    .getElementById("addVariantGroupBtn")
    .addEventListener("click", () => addVariantGroup(true));
  document
    .getElementById("editVariantGroupBtn")
    .addEventListener("click", () => addVariantGroup(false));

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
    // Ctrl+Enter to save when add/edit panel is open
    if (modifier && e.key === "Enter") {
      const addPanelActive = document
        .getElementById("addPanel")
        ?.classList.contains("active");
      const editPanelActive = document
        .getElementById("editPanel")
        ?.classList.contains("active");
      if (addPanelActive) {
        e.preventDefault();
        addMenuItem();
      } else if (editPanelActive) {
        e.preventDefault();
        saveMenuItem();
      }
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
