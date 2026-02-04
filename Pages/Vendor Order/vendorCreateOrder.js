import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";

const menuItems = [
  {
    id: "001",
    name: "Pad Thai with Shrimp",
    category: "Noodles",
    price: 23.9,
    available: true,
    image:
      "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=300&h=300&fit=crop",
  },
  {
    id: "002",
    name: "Pad Thai with Shrimp, Extra Peanuts, and Lime",
    category: "Noodles",
    price: 15.5,
    available: true,
    image:
      "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=300&h=300&fit=crop",
  },
  {
    id: "011",
    name: "Hokkien Mee",
    category: "Noodles",
    price: 6.0,
    available: true,
    image:
      "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=300&h=300&fit=crop",
  },
  {
    id: "003",
    name: "Nasi Lemak",
    category: "Rice",
    price: 7.0,
    available: true,
    image:
      "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=300&h=300&fit=crop",
  },
  {
    id: "004",
    name: "Chicken Rice",
    category: "Rice",
    price: 5.5,
    available: true,
    image:
      "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=300&h=300&fit=crop",
  },
  {
    id: "005",
    name: "Sushi Platter",
    category: "Rice",
    price: 28.0,
    available: false,
    image:
      "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&h=300&fit=crop",
  },
  {
    id: "012",
    name: "Nasi Goreng",
    category: "Rice",
    price: 6.5,
    available: true,
    image:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&h=300&fit=crop",
  },
  {
    id: "006",
    name: "Roti Prata",
    category: "Sides",
    price: 1.5,
    available: true,
    image:
      "https://images.unsplash.com/photo-1625398407796-82650a8c135f?w=300&h=300&fit=crop",
  },
  {
    id: "007",
    name: "Fish Head Curry",
    category: "Sides",
    price: 18.0,
    available: true,
    image:
      "https://images.unsplash.com/photo-1574484284002-952d92456975?w=300&h=300&fit=crop",
  },
  {
    id: "013",
    name: "Satay (6 pcs)",
    category: "Sides",
    price: 7.0,
    available: true,
    image:
      "https://images.unsplash.com/photo-1529563021893-cc83c992d75d?w=300&h=300&fit=crop",
  },
  {
    id: "008",
    name: "Coca-Cola",
    category: "Drinks",
    price: 1.5,
    available: true,
    image:
      "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=300&h=300&fit=crop",
  },
  {
    id: "009",
    name: "Teh Tarik",
    category: "Drinks",
    price: 2.5,
    available: true,
    image:
      "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=300&h=300&fit=crop",
  },
  {
    id: "010",
    name: "Green Tea",
    category: "Drinks",
    price: 2.0,
    available: false,
    image:
      "https://images.unsplash.com/photo-1556881286-fc6915169721?w=300&h=300&fit=crop",
  },
  {
    id: "014",
    name: "Milo Dinosaur",
    category: "Drinks",
    price: 3.5,
    available: true,
    image:
      "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300&h=300&fit=crop",
  },
];

const orderQuantities = {};
const orderNotes = {};
let orderNumber = "#" + String(Math.floor(Math.random() * 9000) + 1000);
let orderType = "Dine-In";
let currentEditItemId = null;

function renderMenuItems() {
  const container = document.getElementById("menuColumn");
  const available = menuItems.filter((item) => item.available);

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
              <img class="posMenuItemImage" src="${item.image}" alt="${item.name}" loading="lazy" />
              <div class="posMenuItemInfo">
                <span class="posMenuItemName">${item.name}</span>
                <span class="posMenuItemPrice">$${item.price.toFixed(2)}</span>
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
      if (btn.dataset.action === "inc") {
        orderQuantities[id] = (orderQuantities[id] || 0) + 1;
      } else {
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
  const selected = menuItems.filter(
    (item) => (orderQuantities[item.id] || 0) > 0,
  );
  const total = selected.reduce(
    (sum, item) => sum + (orderQuantities[item.id] || 0) * item.price,
    0,
  );

  const customerName =
    document.getElementById("receiptCustomerName")?.value || "";

  const itemsHTML =
    selected.length === 0
      ? `<p class="receiptEmpty">Add items from the menu</p>`
      : selected
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
    btn.addEventListener("click", () => openEditPopup(btn.dataset.id));
    btn.addEventListener("mousemove", handleEditBtnMouseMove);
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
      <img src="${item.image}" alt="${item.name}" class="editPopupItemImage" />
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

function placeOrder() {
  const hasItems = Object.values(orderQuantities).some((qty) => qty > 0);
  if (!hasItems) {
    showToast("Please add at least one item to the order.", true);
    return;
  }

  const customerName =
    document.getElementById("receiptCustomerName")?.value.trim() || "Walk-in";

  const items = [];
  menuItems.forEach((item) => {
    const qty = orderQuantities[item.id] || 0;
    if (qty > 0) {
      items.push({
        qty,
        name: item.name,
        price: item.price,
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

  menuItems.forEach((item) => (orderQuantities[item.id] = 0));
  renderMenuItems();
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
      const overlay = document.getElementById("editPopupOverlay");
      if (overlay && overlay.classList.contains("active")) {
        closeEditPopup();
      } else {
        history.back();
      }
    }
  });
});
