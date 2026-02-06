import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";
import { auth, db } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// State
let menuItems = [];
let currentStallId = null;
let currentUser = null;

const orderQuantities = {};
const orderNotes = {};

// ============================================
// AUTHENTICATION & DATA LOADING
// ============================================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../Auth/login.html";
    return;
  }
  currentUser = user;
  await loadVendorData();
});

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
    const menuRef = collection(db, "foodStalls", currentStallId, "menuItems");
    const q = query(menuRef, orderBy("category"), orderBy("name"));
    const snapshot = await getDocs(q);

    menuItems = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      name: docSnap.data().name || "",
      category: docSnap.data().category || "Uncategorized",
      price: docSnap.data().price || 0,
      description: docSnap.data().description || "",
      available: docSnap.data().isAvailable !== false,
      allergens: docSnap.data().allergens || [],
      imageUrl: docSnap.data().imageUrl || "",
      customizations: docSnap.data().customizations || [],
    }));

    // Initialize quantities for all items
    menuItems.forEach((item) => (orderQuantities[item.id] = 0));

    renderMenuItems();
    renderReceipt();
  } catch (error) {
    console.error("Error loading menu items:", error);
    menuItems = [];
    renderMenuItems();
    renderReceipt();
  }
}
let orderNumber = "#" + String(Math.floor(Math.random() * 9000) + 1000);
let orderType = "Dine-In";
let currentEditItemId = null;

// Variant popup state
let currentVariantItem = null;
let variantSelectedOptions = {};
let editingLineId = null; // Track if we're editing an existing variant item

// Order items with variants (keyed by unique order line ID)
const orderItems = {};
let orderLineIdCounter = 0;

function renderMenuItems() {
  const container = document.getElementById("menuColumn");
  const available = menuItems.filter((item) => item.available);

  // Show empty state if no menu items
  if (available.length === 0) {
    container.innerHTML = `
      <div class="emptyMenuState">
        <p>No menu items available. Add items in the Menu page first.</p>
      </div>
    `;
    return;
  }

  const groups = {};
  available.forEach((item) => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  });

  container.innerHTML = Object.entries(groups)
    .map(
      ([category, items]) => `
      <div class="menuCategorySection">
        <h3 class="menuCategoryTitle">${category}</h3>
        <div class="menuCategoryGrid">
          ${items
            .map(
              (item) => `
            <div class="posMenuItem${(orderQuantities[item.id] || 0) > 0 ? " active" : ""}" id="card-${item.id}">
              <img class="posMenuItemImage" src="${item.imageUrl || "https://via.placeholder.com/300x300?text=No+Image"}" alt="${item.name}" loading="lazy" />
              <div class="posMenuItemInfo">
                <span class="posMenuItemName">${item.name}</span>
                <span class="posMenuItemPrice">$${item.price.toFixed(2)}</span>
                ${item.customizations && item.customizations.length > 0 ? '<span class="posMenuItemHasVariants">Variants</span>' : ""}
              </div>
              <div class="posStepperRow">
                <div class="posStepper">
                  <button class="posStepperBtn" data-id="${item.id}" data-action="dec" type="button">−</button>
                  <span class="posStepperDivider"></span>
                  <button class="posStepperBtn" data-id="${item.id}" data-action="inc" type="button">+</button>
                </div>
                <span class="posStepperQty${(orderQuantities[item.id] || 0) > 0 ? " active" : ""}" id="qty-${item.id}">${orderQuantities[item.id] || 0}</span>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `,
    )
    .join("");

  // Stepper button listeners
  container.querySelectorAll(".posStepperBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const item = menuItems.find((m) => m.id === id);

      if (btn.dataset.action === "inc") {
        // Check if item has customizations - open popup if so
        if (item && item.customizations && item.customizations.length > 0) {
          openVariantPopup(item);
          return;
        }
        orderQuantities[id] = (orderQuantities[id] || 0) + 1;
      } else {
        // Check if item has variants - show error if so
        if (item && item.customizations && item.customizations.length > 0) {
          showToast(
            "This item has variants. Remove it from the receipt instead.",
            true,
          );
          return;
        }
        orderQuantities[id] = Math.max(0, (orderQuantities[id] || 0) - 1);
      }
      const qty = orderQuantities[id];
      const card = document.getElementById(`card-${id}`);
      card.classList.toggle("active", qty > 0);
      const qtyLabel = document.getElementById(`qty-${id}`);
      qtyLabel.textContent = qty;
      qtyLabel.classList.toggle("active", qty > 0);
      renderReceipt();
    });
  });
}

function renderReceipt() {
  const container = document.getElementById("receipt");

  // Get items with variants from orderItems
  const variantItemLines = Object.entries(orderItems);

  // Get simple items (no variants) that aren't already in orderItems
  const itemIdsWithVariants = new Set(
    variantItemLines.map(([, item]) => item.itemId),
  );
  const simpleItems = menuItems.filter(
    (item) =>
      (orderQuantities[item.id] || 0) > 0 &&
      (!item.customizations || item.customizations.length === 0) &&
      !itemIdsWithVariants.has(item.id),
  );

  // Calculate total
  let total = 0;
  variantItemLines.forEach(([, item]) => {
    total += item.totalPrice * item.quantity;
  });
  simpleItems.forEach((item) => {
    total += (orderQuantities[item.id] || 0) * item.price;
  });

  const customerName =
    document.getElementById("receiptCustomerName")?.value || "";

  const hasItems = variantItemLines.length > 0 || simpleItems.length > 0;

  let itemsHTML = "";
  if (!hasItems) {
    itemsHTML = `<p class="receiptEmpty">Add items from the menu</p>`;
  } else {
    // Render items with variants
    itemsHTML = variantItemLines
      .map(
        ([lineId, item]) => `
        <div class="receiptEntry receiptEntryWithVariants" data-line-id="${lineId}">
          <span class="receiptEntryQty">${item.quantity}</span>
          <div class="receiptEntryDetails">
            <span class="receiptEntryName">${item.name}</span>
            ${item.variants
              .map(
                (v) => `
              <div class="receiptEntryVariant">
                <span class="receiptEntryVariantName">${v.optionName}</span>
                ${v.price > 0 ? `<span class="receiptEntryVariantPrice">+$${v.price.toFixed(2)}</span>` : ""}
              </div>
            `,
              )
              .join("")}
            ${orderNotes[item.itemId] ? `<span class="receiptEntryNote">${orderNotes[item.itemId]}</span>` : ""}
            <button class="receiptEditBtn" data-id="${item.itemId}" data-line-id="${lineId}" type="button">
              <span class="receiptEditBtnText">Edit</span>
            </button>
            <div class="receiptEntryActions">
              <div class="receiptStepper">
                <button class="receiptStepperBtn" data-line-id="${lineId}" data-action="dec" type="button">−</button>
                <span class="receiptStepperQty">${item.quantity}</span>
                <button class="receiptStepperBtn" data-line-id="${lineId}" data-action="inc" type="button">+</button>
              </div>
              <button class="receiptDeleteBtn" data-line-id="${lineId}" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <span class="receiptEntryPrice">$${(item.totalPrice * item.quantity).toFixed(2)}</span>
        </div>
      `,
      )
      .join("");

    // Render simple items (no variants)
    itemsHTML += simpleItems
      .map(
        (item) => `
        <div class="receiptEntry">
          <span class="receiptEntryQty">${orderQuantities[item.id]}</span>
          <div class="receiptEntryDetails">
            <span class="receiptEntryName">${item.name}</span>
            ${orderNotes[item.id] ? `<span class="receiptEntryNote">${orderNotes[item.id]}</span>` : ""}
            <button class="receiptEditBtn" data-id="${item.id}" type="button">
              <span class="receiptEditBtnText">Edit</span>
            </button>
          </div>
          <span class="receiptEntryPrice">$${(orderQuantities[item.id] * item.price).toFixed(2)}</span>
        </div>
      `,
      )
      .join("");
  }

  container.innerHTML = `
    <div class="receiptOrderNumber">${orderNumber}</div>
    <div class="receiptSection">
      <input
        class="receiptCustomerInput"
        type="text"
        id="receiptCustomerName"
        placeholder="Customer Name"
        value="${customerName.replace(/"/g, "&quot;")}"
        autocomplete="off"
      />
    </div>
    <div class="segmentedControl receiptTypeToggle">
      <label class="segmentedButton">
        <input type="radio" name="orderType" value="Dine-In" ${orderType === "Dine-In" ? "checked" : ""} />
        Dine-In
      </label>
      <label class="segmentedButton">
        <input type="radio" name="orderType" value="Takeaway" ${orderType === "Takeaway" ? "checked" : ""} />
        Takeaway
      </label>
    </div>
    <div class="receiptItems">
      ${itemsHTML}
    </div>
    <div class="receiptFooter">
      <div class="receiptTotalRow">
        <span class="receiptTotalLabel">Total</span>
        <span class="receiptTotalValue">$${total.toFixed(2)}</span>
      </div>
    </div>
  `;

  // Re-bind order type toggle
  container.querySelectorAll('input[name="orderType"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      orderType = radio.value;
    });
  });

  // Edit button listeners
  container.querySelectorAll(".receiptEditBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.id;
      const lineId = btn.dataset.lineId;

      // If it's a variant item (has lineId), open variant popup for editing
      if (lineId && orderItems[lineId]) {
        openVariantPopupForEdit(lineId);
      } else {
        openEditPopup(itemId);
      }
    });
    btn.addEventListener("mousemove", handleEditBtnMouseMove);
  });

  // Receipt stepper listeners (for variant items)
  container.querySelectorAll(".receiptStepperBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lineId = btn.dataset.lineId;
      const action = btn.dataset.action;

      if (orderItems[lineId]) {
        if (action === "inc") {
          orderItems[lineId].quantity += 1;
        } else if (action === "dec") {
          orderItems[lineId].quantity -= 1;
          if (orderItems[lineId].quantity <= 0) {
            removeVariantItem(lineId);
            return;
          }
        }
        renderReceipt();
        updateMenuCardQuantities();
      }
    });
  });

  // Delete button listeners (for variant items)
  container.querySelectorAll(".receiptDeleteBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lineId = btn.dataset.lineId;
      removeVariantItem(lineId);
    });
  });
}

function removeVariantItem(lineId) {
  if (orderItems[lineId]) {
    const itemId = orderItems[lineId].itemId;
    delete orderItems[lineId];

    // Update the menu card quantity display
    updateMenuCardQuantities();
    renderReceipt();
  }
}

function updateMenuCardQuantities() {
  // Recalculate quantities for items with variants based on orderItems
  const variantQuantities = {};
  Object.values(orderItems).forEach((item) => {
    variantQuantities[item.itemId] =
      (variantQuantities[item.itemId] || 0) + item.quantity;
  });

  // Update menu cards for items with variants
  menuItems.forEach((item) => {
    if (item.customizations && item.customizations.length > 0) {
      const qty = variantQuantities[item.id] || 0;
      orderQuantities[item.id] = qty;

      const card = document.getElementById(`card-${item.id}`);
      if (card) card.classList.toggle("active", qty > 0);

      const qtyLabel = document.getElementById(`qty-${item.id}`);
      if (qtyLabel) {
        qtyLabel.textContent = qty;
        qtyLabel.classList.toggle("active", qty > 0);
      }
    }
  });
}

let toastTimeout = null;

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;
  toast.classList.toggle("error", isError);

  if (toastTimeout) clearTimeout(toastTimeout);

  toast.classList.add("show");
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function handleEditBtnMouseMove(e) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  btn.style.setProperty("--mouse-x", x + "px");
  btn.style.setProperty("--mouse-y", y + "px");
}

function openEditPopup(itemId) {
  const item = menuItems.find((i) => i.id === itemId);
  if (!item) return;

  currentEditItemId = itemId;

  const itemInfo = document.getElementById("editPopupItemInfo");
  if (itemInfo) {
    itemInfo.innerHTML = `
      <img src="${item.imageUrl || "https://via.placeholder.com/300x300?text=No+Image"}" alt="${item.name}" class="editPopupItemImage" />
      <div class="editPopupItemDetails">
        <span class="editPopupItemName">${item.name}</span>
        <span class="editPopupItemPrice">$${item.price.toFixed(2)}</span>
      </div>
    `;
  }

  const input = document.getElementById("specialRequestInput");
  if (input) input.value = orderNotes[itemId] || "";

  const overlay = document.getElementById("editPopupOverlay");
  if (overlay) {
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeEditPopup() {
  const overlay = document.getElementById("editPopupOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }
  currentEditItemId = null;
}

function saveEditPopup() {
  if (!currentEditItemId) return;

  const input = document.getElementById("specialRequestInput");
  const note = input ? input.value.trim() : "";

  if (note) {
    orderNotes[currentEditItemId] = `"${note}"`;
  } else {
    delete orderNotes[currentEditItemId];
  }

  closeEditPopup();
  renderReceipt();
}

// ============================================
// VARIANT POPUP FUNCTIONS
// ============================================

function openVariantPopup(item) {
  currentVariantItem = item;
  variantSelectedOptions = {};

  // Populate popup content
  const itemInfoContainer = document.getElementById("variantPopupItemInfo");
  const optionsContainer = document.getElementById(
    "variantPopupVariantsSection",
  );
  const priceDisplay = document.getElementById("variantPopupPrice");

  // Populate item info
  if (itemInfoContainer) {
    itemInfoContainer.innerHTML = `
      ${item.imageUrl ? `<img class="variantPopupItemImage" src="${item.imageUrl}" alt="${item.name}" />` : ""}
      <div class="variantPopupItemDetails">
        <span class="variantPopupItemName">${item.name}</span>
        <span class="variantPopupItemPrice">$${item.price.toFixed(2)}</span>
      </div>
    `;
  }

  // Render variant groups
  // Structure: { name: "Size", options: ["Small", "Medium", "Large"], priceAdjustments: [0, 1.5, 3], multiSelect: false }
  console.log("Item customizations:", item.customizations);

  if (
    optionsContainer &&
    item.customizations &&
    item.customizations.length > 0
  ) {
    optionsContainer.innerHTML = item.customizations
      .map((group, groupIndex) => {
        const isMultiple = group.multiSelect === true;
        const inputType = isMultiple ? "checkbox" : "radio";

        return `
          <div class="variantGroup" data-group-index="${groupIndex}">
            <div class="variantGroupHeader">
              <span class="variantGroupName">${group.name}</span>
              ${group.required !== false ? '<span class="variantGroupRequired">Required</span>' : ""}
              ${isMultiple ? `<span class="variantGroupMultiple"><svg class="multiSelectIcon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 700 400" fill="none"><path d="M37.5 237.5L162.5 362.5M337.5 162.5L462.5 37.5002M237.5 237.5L362.5 362.5L662.5 37.5002" stroke="currentColor" stroke-width="75" stroke-linecap="round" stroke-linejoin="round"/></svg>Select multiple</span>` : ""}
            </div>
            <div class="variantGroupOptions">
              ${group.options
                .map((optionName, optionIndex) => {
                  const price = group.priceAdjustments?.[optionIndex] || 0;
                  return `
                  <label class="variantOption">
                    <input
                      type="${inputType}"
                      name="variant-group-${groupIndex}"
                      value="${optionIndex}"
                      data-group-index="${groupIndex}"
                      data-option-index="${optionIndex}"
                      data-option-name="${optionName}"
                      data-price="${price}"
                    />
                    <span class="variantOptionCheckmark"></span>
                    <span class="variantOptionName">${optionName}</span>
                    ${price > 0 ? `<span class="variantOptionPrice">+$${price.toFixed(2)}</span>` : ""}
                  </label>
                `;
                })
                .join("")}
            </div>
          </div>
        `;
      })
      .join("");

    // Add click listeners to all variant option labels
    optionsContainer.querySelectorAll(".variantOption").forEach((label) => {
      label.addEventListener("click", (e) => {
        e.preventDefault();
        const input = label.querySelector("input");
        if (input) {
          handleVariantSelection({ target: input });
        }
      });
    });
  }

  // Update price display
  updateVariantPopupPrice();

  // Show popup
  const overlay = document.getElementById("variantPopupOverlay");
  if (overlay) {
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  // Auto focus special request field
  const specialRequestInput = document.getElementById(
    "variantSpecialRequestInput",
  );
  if (specialRequestInput) {
    setTimeout(() => specialRequestInput.focus(), 100);
  }
}

function closeVariantPopup() {
  const overlay = document.getElementById("variantPopupOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }
  currentVariantItem = null;
  variantSelectedOptions = {};
  editingLineId = null;

  // Clear special request input
  const specialRequestInput = document.getElementById(
    "variantSpecialRequestInput",
  );
  if (specialRequestInput) specialRequestInput.value = "";
}

function openVariantPopupForEdit(lineId) {
  const orderItem = orderItems[lineId];
  if (!orderItem) return;

  const item = menuItems.find((m) => m.id === orderItem.itemId);
  if (!item) return;

  editingLineId = lineId;
  currentVariantItem = item;
  variantSelectedOptions = {};

  // Pre-populate selected options based on orderItem.variants
  orderItem.variants.forEach((variant) => {
    // Find the group index and option index
    item.customizations.forEach((group, groupIndex) => {
      const optionIndex = group.options.findIndex(
        (opt) => opt === variant.optionName,
      );
      if (optionIndex !== -1) {
        if (!variantSelectedOptions[groupIndex]) {
          variantSelectedOptions[groupIndex] = [];
        }
        variantSelectedOptions[groupIndex].push(optionIndex);
      }
    });
  });

  // Populate popup content
  const itemInfoContainer = document.getElementById("variantPopupItemInfo");
  const optionsContainer = document.getElementById(
    "variantPopupVariantsSection",
  );
  const priceDisplay = document.getElementById("variantPopupPrice");
  const specialRequestInput = document.getElementById(
    "variantSpecialRequestInput",
  );
  const addBtn = document.getElementById("variantPopupAddBtn");

  // Populate item info
  if (itemInfoContainer) {
    itemInfoContainer.innerHTML = `
      ${item.imageUrl ? `<img class="variantPopupItemImage" src="${item.imageUrl}" alt="${item.name}" />` : ""}
      <div class="variantPopupItemDetails">
        <span class="variantPopupItemName">${item.name}</span>
        <span class="variantPopupItemPrice">$${item.price.toFixed(2)}</span>
      </div>
    `;
  }

  // Pre-fill special request
  if (specialRequestInput) {
    const note = orderNotes[orderItem.itemId] || "";
    specialRequestInput.value = note.replace(/^"|"$/g, ""); // Remove quotes if present
  }

  // Change button text for editing
  if (addBtn) {
    addBtn.innerHTML = `Save Changes - <span id="variantPopupPrice">$${orderItem.totalPrice.toFixed(2)}</span>`;
  }

  // Render variant groups with pre-selected options
  if (optionsContainer) {
    optionsContainer.innerHTML = item.customizations
      .map((group, groupIndex) => {
        const isMultiple = group.multiSelect === true;
        const inputType = isMultiple ? "checkbox" : "radio";
        const selectedInGroup = variantSelectedOptions[groupIndex] || [];

        return `
          <div class="variantGroup" data-group-index="${groupIndex}">
            <div class="variantGroupHeader">
              <span class="variantGroupName">${group.name}</span>
              ${isMultiple ? `<span class="variantGroupMultiple"><svg class="multiSelectIcon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 700 400" fill="none"><path d="M37.5 237.5L162.5 362.5M337.5 162.5L462.5 37.5002M237.5 237.5L362.5 362.5L662.5 37.5002" stroke="currentColor" stroke-width="75" stroke-linecap="round" stroke-linejoin="round"/></svg>Select multiple</span>` : '<span class="variantGroupRequired">Required</span>'}
            </div>
            <div class="variantGroupOptions">
              ${group.options
                .map((optionName, optionIndex) => {
                  const price = group.priceAdjustments?.[optionIndex] || 0;
                  const isSelected = selectedInGroup.includes(optionIndex);
                  return `
                  <label class="variantOption${isSelected ? " selected" : ""}">
                    <input
                      type="${inputType}"
                      name="variant-group-${groupIndex}"
                      value="${optionIndex}"
                      data-group-index="${groupIndex}"
                      data-option-index="${optionIndex}"
                      data-option-name="${optionName}"
                      data-price="${price}"
                      ${isSelected ? "checked" : ""}
                    />
                    <span class="variantOptionCheckmark"></span>
                    <span class="variantOptionName">${optionName}</span>
                    ${price > 0 ? `<span class="variantOptionPrice">+$${price.toFixed(2)}</span>` : ""}
                  </label>
                `;
                })
                .join("")}
            </div>
          </div>
        `;
      })
      .join("");

    // Add click listeners to all variant option labels
    optionsContainer.querySelectorAll(".variantOption").forEach((label) => {
      label.addEventListener("click", (e) => {
        e.preventDefault();
        const input = label.querySelector("input");
        if (input) {
          handleVariantSelection({ target: input });
        }
      });
    });
  }

  // Update price display
  updateVariantPopupPrice();

  // Show popup
  const overlay = document.getElementById("variantPopupOverlay");
  if (overlay) {
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  // Auto focus special request field
  if (specialRequestInput) {
    setTimeout(() => specialRequestInput.focus(), 100);
  }
}

function handleVariantSelection(e) {
  const input = e.target;
  const label = input.closest(".variantOption");
  const groupIndex = parseInt(input.dataset.groupIndex);
  const optionIndex = parseInt(input.dataset.optionIndex);
  const group = currentVariantItem.customizations[groupIndex];
  const isMultiple = group.multiSelect === true;
  const groupContainer = label.closest(".variantGroupOptions");

  if (isMultiple) {
    // Checkbox - toggle in array
    if (!variantSelectedOptions[groupIndex]) {
      variantSelectedOptions[groupIndex] = [];
    }

    const alreadySelected =
      variantSelectedOptions[groupIndex].includes(optionIndex);

    if (alreadySelected) {
      // Remove from selection
      variantSelectedOptions[groupIndex] = variantSelectedOptions[
        groupIndex
      ].filter((i) => i !== optionIndex);
      label.classList.remove("selected");
      input.checked = false;
    } else {
      // Add to selection
      variantSelectedOptions[groupIndex].push(optionIndex);
      label.classList.add("selected");
      input.checked = true;
    }
  } else {
    // Radio - single selection, remove selected from siblings first
    groupContainer.querySelectorAll(".variantOption").forEach((opt) => {
      opt.classList.remove("selected");
    });
    label.classList.add("selected");
    variantSelectedOptions[groupIndex] = [optionIndex];
  }

  updateVariantPopupPrice();
}

function updateVariantPopupPrice() {
  if (!currentVariantItem) return;

  let totalPrice = currentVariantItem.price;

  // Add prices from selected options using priceAdjustments array
  Object.entries(variantSelectedOptions).forEach(
    ([groupIndex, optionIndices]) => {
      const group = currentVariantItem.customizations[parseInt(groupIndex)];
      optionIndices.forEach((optionIndex) => {
        const priceAdjustment = group.priceAdjustments?.[optionIndex] || 0;
        totalPrice += priceAdjustment;
      });
    },
  );

  const priceDisplay = document.getElementById("variantPopupPrice");
  if (priceDisplay) {
    priceDisplay.textContent = `$${totalPrice.toFixed(2)}`;
  }
}

function validateVariantSelections() {
  if (!currentVariantItem) return false;

  for (let i = 0; i < currentVariantItem.customizations.length; i++) {
    const group = currentVariantItem.customizations[i];
    // Check the required field (defaults to true if not specified)
    const isRequired = group.required !== false;
    const hasSelection =
      variantSelectedOptions[i] && variantSelectedOptions[i].length > 0;

    if (isRequired && !hasSelection) {
      showToast(`Please select an option for "${group.name}"`, true);
      return false;
    }
  }
  return true;
}

function addVariantItemToOrder() {
  if (!currentVariantItem) return;

  // Validate required selections
  if (!validateVariantSelections()) return;

  // Build selected variants array for display
  // Structure: { name: "Size", options: ["Small", "Medium"], priceAdjustments: [0, 1.5] }
  const selectedVariants = [];
  Object.entries(variantSelectedOptions).forEach(
    ([groupIndex, optionIndices]) => {
      const group = currentVariantItem.customizations[parseInt(groupIndex)];
      optionIndices.forEach((optionIndex) => {
        const optionName = group.options[optionIndex];
        const price = group.priceAdjustments?.[optionIndex] || 0;
        if (optionName) {
          selectedVariants.push({
            groupName: group.name,
            optionName: optionName,
            price: price,
          });
        }
      });
    },
  );

  // Calculate total price for this item
  let itemPrice = currentVariantItem.price;
  selectedVariants.forEach((v) => (itemPrice += v.price));

  // Get special request
  const specialRequestInput = document.getElementById(
    "variantSpecialRequestInput",
  );
  const specialRequest = specialRequestInput?.value.trim() || "";

  // Check if we're editing an existing item
  if (editingLineId && orderItems[editingLineId]) {
    // Update existing order item
    orderItems[editingLineId].variants = selectedVariants;
    orderItems[editingLineId].totalPrice = itemPrice;

    // Update special request
    if (specialRequest) {
      orderNotes[currentVariantItem.id] = `"${specialRequest}"`;
    } else {
      delete orderNotes[currentVariantItem.id];
    }

    closeVariantPopup();
    renderReceipt();
    showToast(`Updated ${currentVariantItem.name}`);

    // Reset button text for next time
    const addBtn = document.getElementById("variantPopupAddBtn");
    if (addBtn) {
      addBtn.innerHTML = `Add to Order - <span id="variantPopupPrice">$0.00</span>`;
    }
    return;
  }

  // Create new order line
  const lineId = `line-${orderLineIdCounter++}`;
  orderItems[lineId] = {
    itemId: currentVariantItem.id,
    name: currentVariantItem.name,
    basePrice: currentVariantItem.price,
    totalPrice: itemPrice,
    variants: selectedVariants,
    quantity: 1,
  };

  // Save special request
  if (specialRequest) {
    orderNotes[currentVariantItem.id] = `"${specialRequest}"`;
  }

  // Also increment the simple quantity counter for card display
  orderQuantities[currentVariantItem.id] =
    (orderQuantities[currentVariantItem.id] || 0) + 1;

  // Update UI
  const qty = orderQuantities[currentVariantItem.id];
  const card = document.getElementById(`card-${currentVariantItem.id}`);
  if (card) card.classList.add("active");
  const qtyLabel = document.getElementById(`qty-${currentVariantItem.id}`);
  if (qtyLabel) {
    qtyLabel.textContent = qty;
    qtyLabel.classList.add("active");
  }

  closeVariantPopup();
  renderReceipt();
  showToast(`Added ${currentVariantItem.name} to order`);
}

function placeOrder() {
  const hasItems = Object.values(orderQuantities).some((qty) => qty > 0);
  if (!hasItems) {
    showToast("Please add at least one item to the order.", true);
    return;
  }

  const customerName =
    document.getElementById("receiptCustomerName")?.value.trim() || "Walk-in";

  const items = [];

  // Add items with variants from orderItems
  Object.values(orderItems).forEach((orderItem) => {
    items.push({
      qty: orderItem.quantity,
      name: orderItem.name,
      price: orderItem.totalPrice,
      basePrice: orderItem.basePrice,
      customizations: orderItem.variants.map((v) => ({
        name: v.optionName,
        price: v.price,
        groupName: v.groupName,
      })),
      note: orderNotes[orderItem.itemId] || null,
    });
  });

  // Add simple items (no variants)
  const itemIdsWithVariants = new Set(
    Object.values(orderItems).map((item) => item.itemId),
  );
  menuItems.forEach((item) => {
    const qty = orderQuantities[item.id] || 0;
    if (
      qty > 0 &&
      (!item.customizations || item.customizations.length === 0) &&
      !itemIdsWithVariants.has(item.id)
    ) {
      items.push({
        qty,
        name: item.name,
        price: item.price,
        customizations: [],
        note: orderNotes[item.id] || null,
      });
    }
  });

  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);

  const newOrder = {
    orderNumber: orderNumber.replace("#", ""),
    customerName,
    date: new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    type: orderType,
    status: "preparing",
    items,
    total,
    transactionId: `pos-${Date.now().toString(36)}-FOOD`,
  };

  sessionStorage.setItem("newOrder", JSON.stringify(newOrder));
  window.location.href = "vendorOrder.html";
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialize vendor navbar (handles auth, vendor name, logout, keyboard shortcuts)
  initVendorNavbar();

  // Initial empty receipt (menu items loaded via onAuthStateChanged)
  renderReceipt();

  document
    .getElementById("placeOrderBtn")
    .addEventListener("click", placeOrder);

  document.getElementById("cancelBtn").addEventListener("click", () => {
    history.back();
  });

  // Edit popup listeners
  document
    .getElementById("editPopupClose")
    .addEventListener("click", closeEditPopup);
  document
    .getElementById("editPopupSaveBtn")
    .addEventListener("click", saveEditPopup);
  document.getElementById("editPopupOverlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeEditPopup();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Check variant popup first
      const variantOverlay = document.getElementById("variantPopupOverlay");
      if (variantOverlay && variantOverlay.classList.contains("active")) {
        closeVariantPopup();
        return;
      }
      // Then check edit popup
      const overlay = document.getElementById("editPopupOverlay");
      if (overlay && overlay.classList.contains("active")) {
        closeEditPopup();
      } else {
        history.back();
      }
    }
  });

  // Variant popup listeners
  const variantPopupClose = document.getElementById("variantPopupClose");
  if (variantPopupClose) {
    variantPopupClose.addEventListener("click", closeVariantPopup);
  }

  const variantPopupAddBtn = document.getElementById("variantPopupAddBtn");
  if (variantPopupAddBtn) {
    variantPopupAddBtn.addEventListener("click", addVariantItemToOrder);
  }

  const variantPopupOverlay = document.getElementById("variantPopupOverlay");
  if (variantPopupOverlay) {
    variantPopupOverlay.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeVariantPopup();
    });
  }

  // Enter key to add variant item to order when popup is open
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Enter" &&
      variantPopupOverlay?.classList.contains("active")
    ) {
      // Don't trigger if typing in special request textarea
      if (e.target.tagName === "TEXTAREA") return;
      e.preventDefault();
      addVariantItemToOrder();
    }
  });
});
