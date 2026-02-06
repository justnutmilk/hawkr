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
import {
  createVoucher,
  getStallVouchers,
  updateVoucher,
  deleteVoucher as firebaseDeleteVoucher,
  toggleVoucher,
  checkVoucherCodeExists,
} from "../../firebase/services/vouchers.js";
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
let editSelectedImageFile = null;
let addVariants = []; // Variants for add form
let editVariants = []; // Variants for edit form
let addAllergens = []; // Allergens for add form
let editAllergens = []; // Allergens for edit form
let isLoading = true; // Track loading state
let vouchers = []; // Voucher list
let editingVoucherId = null; // Currently editing voucher
let currentView = "products"; // "products" or "vouchers"
let voucherCodeDuplicateFlag = false; // Tracks if current code is a duplicate
let voucherCodeCheckTimer = null; // Debounce timer for code check

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

  // Reset and show existing image if available
  editSelectedImageFile = null;
  const editImageInput = document.getElementById("editImageInput");
  if (editImageInput) editImageInput.value = "";
  const editImagePreview = document.getElementById("editImagePreview");
  const editImagePreviewImg = document.getElementById("editImagePreviewImg");
  const editImageUploadZone = document.getElementById("editImageUploadZone");
  if (item.imageUrl) {
    editImagePreviewImg.src = item.imageUrl;
    editImagePreview.style.display = "block";
    editImageUploadZone.style.display = "none";
  } else {
    editImagePreview.style.display = "none";
    editImageUploadZone.style.display = "";
  }

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

  // Reset edit image state
  editSelectedImageFile = null;
  const editImageInput = document.getElementById("editImageInput");
  if (editImageInput) editImageInput.value = "";
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

    // Upload new image if selected
    if (editSelectedImageFile) {
      saveBtn.textContent = "Uploading image...";
      const imageUrl = await uploadImage(
        editSelectedImageFile,
        currentStallId,
        editingItemId,
      );
      if (imageUrl) {
        updates.imageUrl = imageUrl;
      }
    }

    await firebaseUpdateMenuItem(currentStallId, editingItemId, updates);

    editSelectedImageFile = null;

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
  document.getElementById("addImageUploadZone").style.display = "";

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
  document.getElementById("addImageUploadZone").style.display = "";
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
// VOUCHER MANAGEMENT
// ============================================

function switchView(view) {
  currentView = view;
  const menuContent = document.getElementById("menuContent");
  const vouchersView = document.getElementById("vouchersView");
  const productsNav = document.querySelector(
    '.navSubItem[href="vendorMenu.html"]',
  );
  const vouchersNav = document.getElementById("vouchersNavItem");

  if (view === "vouchers") {
    menuContent.style.display = "none";
    vouchersView.style.display = "flex";
    productsNav?.classList.remove("active");
    vouchersNav?.classList.add("active");
    loadVouchers();
  } else {
    menuContent.style.display = "";
    vouchersView.style.display = "none";
    productsNav?.classList.add("active");
    vouchersNav?.classList.remove("active");
  }
}

async function loadVouchers() {
  if (!currentStallId) return;
  const list = document.getElementById("vouchersList");
  list.innerHTML =
    '<div class="loadingSpinner" style="margin:48px auto"></div>';

  try {
    vouchers = await getStallVouchers(currentStallId);
    renderVouchers();
  } catch (error) {
    console.error("Error loading vouchers:", error);
    list.innerHTML =
      '<p style="color:#808080;text-align:center;padding:48px 0">Failed to load vouchers.</p>';
  }
}

function renderVouchers() {
  const list = document.getElementById("vouchersList");

  if (vouchers.length === 0) {
    list.innerHTML = `
      <div class="vouchersEmpty">
        <p class="vouchersEmptyTitle">No vouchers yet</p>
        <p class="vouchersEmptyText">Create your first voucher to offer discounts to customers.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = vouchers
    .map((v) => {
      const isExpired =
        v.expiryDate &&
        new Date() > (v.expiryDate.toDate?.() || new Date(v.expiryDate));
      const usageFull = v.usageLimit !== null && v.usedCount >= v.usageLimit;
      let statusClass = "active";
      let statusText = "Active";
      if (!v.isActive) {
        statusClass = "inactive";
        statusText = "Paused";
      } else if (isExpired) {
        statusClass = "expired";
        statusText = "Expired";
      } else if (usageFull) {
        statusClass = "expired";
        statusText = "Limit reached";
      }

      const valueNum = parseFloat(v.value) || 0;
      const minOrderNum = parseFloat(v.minOrderAmount) || 0;
      const maxDiscountNum =
        v.maxDiscount != null ? parseFloat(v.maxDiscount) : null;

      const discountDisplay =
        v.type === "percentage"
          ? `${valueNum}% off`
          : `$${valueNum.toFixed(2)} off`;

      const expiryDisplay = v.expiryDate
        ? `Expires ${(v.expiryDate.toDate?.() || new Date(v.expiryDate)).toLocaleDateString()}`
        : "No expiry";

      const usageDisplay =
        v.usageLimit !== null
          ? `${v.usedCount || 0}/${v.usageLimit} used`
          : `${v.usedCount || 0} used`;

      return `
        <div class="voucherCard" data-voucher-id="${v.id}">
          <div class="voucherCardTop">
            <div class="voucherCardInfo">
              <span class="voucherCode">${v.code}</span>
              <span class="voucherDiscount">${discountDisplay}</span>
            </div>
            <span class="voucherStatus ${statusClass}">${statusText}</span>
          </div>
          <div class="voucherCardMeta">
            ${minOrderNum > 0 ? `<span>Min order: $${minOrderNum.toFixed(1)}</span>` : ""}
            ${maxDiscountNum !== null && !isNaN(maxDiscountNum) ? `<span>Max discount: $${maxDiscountNum.toFixed(2)}</span>` : ""}
            <span>${expiryDisplay}</span>
            <span>${usageDisplay}</span>
          </div>
          <div class="voucherCardActions">
            <button class="menuItemEdit voucherEditBtn" data-voucher-id="${v.id}">Edit</button>
            <label class="liquidGlassToggle voucherToggle" data-voucher-id="${v.id}">
              <input type="checkbox" ${v.isActive ? "checked" : ""} />
              <span class="toggleTrack">
                <span class="toggleThumb"></span>
              </span>
            </label>
          </div>
        </div>
      `;
    })
    .join("");

  // Bind edit buttons
  list.querySelectorAll(".voucherEditBtn").forEach((btn) => {
    btn.addEventListener("click", () =>
      openVoucherPanel(btn.dataset.voucherId),
    );
  });

  // Initialize liquid glass toggles with onChange callback for voucher cards
  list.querySelectorAll(".voucherToggle").forEach((toggleLabel) => {
    const voucherId = toggleLabel.dataset.voucherId;
    initMiniLiquidGlassToggle(toggleLabel, async (isChecked) => {
      try {
        await toggleVoucher(voucherId, isChecked);
        await loadVouchers();
      } catch (error) {
        console.error("Error toggling voucher:", error);
        // Revert visual state by re-rendering
        await loadVouchers();
      }
    });
  });
}

function openVoucherPanel(voucherId = null) {
  editingVoucherId = voucherId;
  const panel = document.getElementById("voucherPanel");
  const overlay = document.getElementById("voucherPanelOverlay");
  const title = document.getElementById("voucherPanelTitle");
  const saveBtn = document.getElementById("voucherSaveBtn");
  const deleteBtn = document.getElementById("voucherDeleteBtn");

  // Reset form
  document.getElementById("voucherCode").value = "";
  document.getElementById("voucherType").value = "percentage";
  document.getElementById("voucherValue").value = "";
  document.getElementById("voucherMaxDiscount").value = "";
  document.getElementById("voucherMinOrder").value = "";
  document.getElementById("voucherUsageLimit").value = "";
  document.getElementById("voucherPerUser").value = "1";
  document.getElementById("voucherExpiry").value = "";
  clearVoucherCodeError();
  updateVoucherTypeUI();

  if (voucherId) {
    // Edit mode
    const voucher = vouchers.find((v) => v.id === voucherId);
    if (!voucher) return;
    title.textContent = "Edit Voucher";
    saveBtn.textContent = "Save changes";
    deleteBtn.style.display = "";

    document.getElementById("voucherCode").value = voucher.code;
    document.getElementById("voucherType").value = voucher.type;
    document.getElementById("voucherValue").value = voucher.value;
    if (voucher.maxDiscount !== null)
      document.getElementById("voucherMaxDiscount").value = voucher.maxDiscount;
    if (voucher.minOrderAmount > 0)
      document.getElementById("voucherMinOrder").value = voucher.minOrderAmount;
    if (voucher.usageLimit !== null)
      document.getElementById("voucherUsageLimit").value = voucher.usageLimit;
    document.getElementById("voucherPerUser").value = voucher.usagePerUser || 1;
    if (voucher.expiryDate) {
      const d = voucher.expiryDate.toDate?.() || new Date(voucher.expiryDate);
      document.getElementById("voucherExpiry").value = d
        .toISOString()
        .split("T")[0];
    }
    updateVoucherTypeUI();
  } else {
    title.textContent = "Add Voucher";
    saveBtn.textContent = "Add Voucher";
    deleteBtn.style.display = "none";
  }

  panel.classList.add("active");
  overlay.classList.add("active");
}

function closeVoucherPanel() {
  document.getElementById("voucherPanel").classList.remove("active");
  document.getElementById("voucherPanelOverlay").classList.remove("active");
  editingVoucherId = null;
}

function updateVoucherTypeUI() {
  const type = document.getElementById("voucherType").value;
  const prefix = document.getElementById("voucherValuePrefix");
  const hint = document.getElementById("voucherValueHint");
  const maxGroup = document.getElementById("maxDiscountGroup");

  if (type === "percentage") {
    prefix.textContent = "%";
    hint.textContent = "Percentage off the order subtotal.";
    maxGroup.style.display = "";
  } else {
    prefix.textContent = "S$";
    hint.textContent = "Fixed dollar amount off the order.";
    maxGroup.style.display = "none";
  }
}

function showVoucherCodeError(message) {
  const errorEl = document.getElementById("voucherCodeError");
  const inputEl = document.getElementById("voucherCode");
  errorEl.textContent = message;
  errorEl.hidden = false;
  inputEl.classList.add("error");
  voucherCodeDuplicateFlag = true;
}

function clearVoucherCodeError() {
  const errorEl = document.getElementById("voucherCodeError");
  const inputEl = document.getElementById("voucherCode");
  errorEl.textContent = "";
  errorEl.hidden = true;
  inputEl.classList.remove("error");
  voucherCodeDuplicateFlag = false;
}

function handleVoucherCodeInput() {
  const code = document
    .getElementById("voucherCode")
    .value.trim()
    .toUpperCase();

  // Clear previous timer
  if (voucherCodeCheckTimer) clearTimeout(voucherCodeCheckTimer);

  // Clear error if empty
  if (!code) {
    clearVoucherCodeError();
    return;
  }

  // Debounce the Firebase check (400ms)
  voucherCodeCheckTimer = setTimeout(async () => {
    if (!currentStallId) return;
    try {
      const exists = await checkVoucherCodeExists(
        currentStallId,
        code,
        editingVoucherId,
      );
      // Re-check current value hasn't changed during async call
      const currentCode = document
        .getElementById("voucherCode")
        .value.trim()
        .toUpperCase();
      if (currentCode !== code) return;

      if (exists) {
        showVoucherCodeError("This voucher code already exists for your stall");
      } else {
        clearVoucherCodeError();
      }
    } catch (error) {
      console.error("Error checking voucher code:", error);
    }
  }, 400);
}

async function saveVoucher() {
  const code = document.getElementById("voucherCode").value.trim();
  const type = document.getElementById("voucherType").value;
  const value = document.getElementById("voucherValue").value;

  if (!code) {
    alert("Voucher code is required");
    return;
  }
  if (!value || parseFloat(value) <= 0) {
    alert("Please enter a valid discount value");
    return;
  }
  if (type === "percentage" && parseFloat(value) > 100) {
    alert("Percentage cannot exceed 100%");
    return;
  }

  // Block save if duplicate flag is set
  if (voucherCodeDuplicateFlag) {
    return;
  }

  // Final check before saving (in case debounce hasn't fired yet)
  if (currentStallId) {
    const exists = await checkVoucherCodeExists(
      currentStallId,
      code,
      editingVoucherId,
    );
    if (exists) {
      showVoucherCodeError("This voucher code already exists for your stall");
      return;
    }
  }

  const voucherData = {
    code,
    type,
    value,
    minOrderAmount: document.getElementById("voucherMinOrder").value || 0,
    maxDiscount:
      type === "percentage"
        ? document.getElementById("voucherMaxDiscount").value || null
        : null,
    usageLimit: document.getElementById("voucherUsageLimit").value || null,
    usagePerUser: document.getElementById("voucherPerUser").value || 1,
    expiryDate: document.getElementById("voucherExpiry").value
      ? new Date(document.getElementById("voucherExpiry").value + "T23:59:59")
      : null,
  };

  try {
    if (editingVoucherId) {
      await updateVoucher(editingVoucherId, voucherData);
    } else {
      await createVoucher(currentStallId, voucherData);
    }
    closeVoucherPanel();
    await loadVouchers();
  } catch (error) {
    console.error("Error saving voucher:", error);
    alert("Failed to save voucher. Please try again.");
  }
}

function openDeleteVoucherModal() {
  document.getElementById("deleteVoucherModalOverlay").classList.add("active");
}

function closeDeleteVoucherModal() {
  document
    .getElementById("deleteVoucherModalOverlay")
    .classList.remove("active");
}

async function confirmDeleteVoucher() {
  if (!editingVoucherId) return;
  try {
    await firebaseDeleteVoucher(editingVoucherId);
    closeDeleteVoucherModal();
    closeVoucherPanel();
    await loadVouchers();
  } catch (error) {
    console.error("Error deleting voucher:", error);
    alert("Failed to delete voucher.");
  }
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

  // Shared image validation
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
  ];
  const maxSize = 10 * 1024 * 1024;

  function validateImageFile(file) {
    if (file.size > maxSize) {
      alert("Image must be under 10MB");
      return false;
    }
    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a PNG, JPG, WEBP, or SVG image");
      return false;
    }
    return true;
  }

  function handleImageSelect(
    file,
    previewEl,
    previewImgEl,
    uploadZoneEl,
    setFileCallback,
  ) {
    if (!validateImageFile(file)) return;
    setFileCallback(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      previewImgEl.src = event.target.result;
      previewEl.style.display = "block";
      uploadZoneEl.style.display = "none";
    };
    reader.readAsDataURL(file);
  }

  function setupImageUploadZone(
    zoneId,
    inputId,
    previewId,
    previewImgId,
    removeBtnId,
    setFileCallback,
    clearFileCallback,
  ) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const previewImg = document.getElementById(previewImgId);
    const removeBtn = document.getElementById(removeBtnId);

    zone.addEventListener("click", () => input.click());

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file)
        handleImageSelect(file, preview, previewImg, zone, setFileCallback);
    });

    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file)
        handleImageSelect(file, preview, previewImg, zone, setFileCallback);
    });

    removeBtn.addEventListener("click", () => {
      clearFileCallback();
      input.value = "";
      preview.style.display = "none";
      zone.style.display = "";
    });
  }

  // Add panel image upload
  setupImageUploadZone(
    "addImageUploadZone",
    "addImageInput",
    "addImagePreview",
    "addImagePreviewImg",
    "addImageRemoveBtn",
    (file) => {
      selectedImageFile = file;
    },
    () => {
      selectedImageFile = null;
    },
  );

  // Edit panel image upload
  setupImageUploadZone(
    "editImageUploadZone",
    "editImageInput",
    "editImagePreview",
    "editImagePreviewImg",
    "editImageRemoveBtn",
    (file) => {
      editSelectedImageFile = file;
    },
    () => {
      editSelectedImageFile = null;
    },
  );

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

  // Sidebar dropdown toggle
  const menuDropdownToggle = document.getElementById("menuDropdownToggle");
  const menuSubItems = document.getElementById("menuSubItems");
  if (menuDropdownToggle) {
    menuDropdownToggle.addEventListener("click", (e) => {
      e.preventDefault();
      menuSubItems.classList.toggle("open");
      menuDropdownToggle.classList.toggle("expanded");
    });
    // Start expanded since we're on the menu page
    menuSubItems.classList.add("open");
  }

  // Vouchers nav item
  const vouchersNavItem = document.getElementById("vouchersNavItem");
  if (vouchersNavItem) {
    vouchersNavItem.addEventListener("click", (e) => {
      e.preventDefault();
      switchView("vouchers");
    });
  }
  // Products nav item
  const productsNavItem = document.querySelector(
    '.navSubItem[href="vendorMenu.html"]',
  );
  if (productsNavItem) {
    productsNavItem.addEventListener("click", (e) => {
      e.preventDefault();
      switchView("products");
    });
  }

  // Voucher panel handlers
  document
    .getElementById("addVoucherBtn")
    .addEventListener("click", () => openVoucherPanel());
  document
    .getElementById("voucherPanelClose")
    .addEventListener("click", closeVoucherPanel);
  document
    .getElementById("voucherCancelBtn")
    .addEventListener("click", closeVoucherPanel);
  document
    .getElementById("voucherSaveBtn")
    .addEventListener("click", saveVoucher);
  document
    .getElementById("voucherCode")
    .addEventListener("input", handleVoucherCodeInput);
  document
    .getElementById("voucherPanelOverlay")
    .addEventListener("click", closeVoucherPanel);
  document
    .getElementById("voucherDeleteBtn")
    .addEventListener("click", openDeleteVoucherModal);
  document
    .getElementById("deleteVoucherCancelBtn")
    .addEventListener("click", closeDeleteVoucherModal);
  document
    .getElementById("deleteVoucherConfirmBtn")
    .addEventListener("click", confirmDeleteVoucher);
  document
    .getElementById("deleteVoucherModalOverlay")
    .addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeDeleteVoucherModal();
    });
  document
    .getElementById("voucherType")
    .addEventListener("change", updateVoucherTypeUI);

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
      closeVoucherPanel();
      closeDeleteVoucherModal();
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
    // Ctrl+Enter to save when add/edit/voucher panel is open
    if (modifier && e.key === "Enter") {
      const addPanelActive = document
        .getElementById("addPanel")
        ?.classList.contains("active");
      const editPanelActive = document
        .getElementById("editPanel")
        ?.classList.contains("active");
      const voucherPanelActive = document
        .getElementById("voucherPanel")
        ?.classList.contains("active");
      if (addPanelActive) {
        e.preventDefault();
        addMenuItem();
      } else if (editPanelActive) {
        e.preventDefault();
        saveMenuItem();
      } else if (voucherPanelActive) {
        e.preventDefault();
        saveVoucher();
      }
    }
    // "n" key (no modifier) navigates to create order page
    if (
      !modifier &&
      !e.altKey &&
      e.target.tagName !== "INPUT" &&
      e.target.tagName !== "TEXTAREA"
    ) {
      if (e.key === "n") {
        window.location.href = "../Vendor Order/vendorCreateOrder.html";
      }
      // "v" key opens add voucher panel when in vouchers view
      if (e.key === "v" && currentView === "vouchers") {
        e.preventDefault();
        openVoucherPanel();
      }
    }
  });
});
