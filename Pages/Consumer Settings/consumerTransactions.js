// ============================================
// IMPORTS
// ============================================

import { initConsumerNavbar } from "../../assets/js/consumerNavbar.js";
import { injectMobileMenu } from "../../assets/js/mobileMenu.js";
import { auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getCustomerOrders,
  getOrderById,
} from "../../firebase/services/orders.js";

// ============================================
// PAGE DETECTION
// ============================================

const isDetailPage = window.location.pathname.includes(
  "consumerTransactionDetail",
);

// Auth state
let currentUser = null;

// ============================================
// MOCK TRANSACTION DATA
// ============================================

const mockTransactions = [
  // Jan 11, 2025
  {
    id: "c2b-j29Sksix93Q-FOOD",
    name: "Chinese Foods Private Limited",
    venue: "Maxwell Food Centre",
    amount: 23.9,
    type: "debit",
    date: new Date(2025, 0, 11),
  },
  {
    id: "c2b-j29jsS9L3sQ-FOOD",
    name: "Chinese Good Foods Cuisines",
    venue: "Maxwell Food Centre",
    amount: 67.0,
    type: "debit",
    date: new Date(2025, 0, 11),
  },
  {
    id: "b2c-j29Vb4HDj8Q-REFUND",
    name: "You",
    venue: "Maxwell Food Centre",
    amount: 6.7,
    type: "credit",
    date: new Date(2025, 0, 11),
  },
  {
    id: "b2c-j29Vb4HDj9Q-REFUND",
    name: "You",
    venue: "Maxwell Food Centre",
    amount: 0.67,
    type: "credit",
    date: new Date(2025, 0, 11),
  },
  // Jan 10, 2025
  {
    id: "c2b-k48Lmn7pQ2R-FOOD",
    name: "Hainanese Delights",
    venue: "Chinatown Complex",
    amount: 15.5,
    type: "debit",
    date: new Date(2025, 0, 10),
  },
  {
    id: "c2b-m92Xyz3aB5C-FOOD",
    name: "Laksa King",
    venue: "Old Airport Road",
    amount: 8.0,
    type: "debit",
    date: new Date(2025, 0, 10),
  },
  // Jan 9, 2025
  {
    id: "c2b-n83Abc4dE6F-FOOD",
    name: "Ah Heng Curry Chicken",
    venue: "Hong Lim Market",
    amount: 12.5,
    type: "debit",
    date: new Date(2025, 0, 9),
  },
  {
    id: "c2b-p74Ghi5jK7L-FOOD",
    name: "Tian Tian Hainanese",
    venue: "Maxwell Food Centre",
    amount: 18.0,
    type: "debit",
    date: new Date(2025, 0, 9),
  },
  // Jan 8, 2025
  {
    id: "c2b-q65Mno6pQ8R-FOOD",
    name: "Hill Street Tai Hwa",
    venue: "Crawford Lane",
    amount: 28.0,
    type: "debit",
    date: new Date(2025, 0, 8),
  },
  {
    id: "c2b-r56Stu7vW9X-FOOD",
    name: "Liao Fan Hawker Chan",
    venue: "Chinatown Complex",
    amount: 15.0,
    type: "debit",
    date: new Date(2025, 0, 8),
  },
  {
    id: "b2c-s47Yza8bC0D-REFUND",
    name: "You",
    venue: "Chinatown Complex",
    amount: 3.0,
    type: "credit",
    date: new Date(2025, 0, 8),
  },
  // Jan 7, 2025
  {
    id: "c2b-t38Efg9hI1J-FOOD",
    name: "Outram Park Fried Kway Teow",
    venue: "Hong Lim Market",
    amount: 10.0,
    type: "debit",
    date: new Date(2025, 0, 7),
  },
  {
    id: "c2b-u29Klm0nO2P-FOOD",
    name: "Zhen Zhen Porridge",
    venue: "Maxwell Food Centre",
    amount: 8.5,
    type: "debit",
    date: new Date(2025, 0, 7),
  },
  // Jan 6, 2025
  {
    id: "c2b-v10Qrs1tU3V-FOOD",
    name: "Seng Kee Bak Chor Mee",
    venue: "Serangoon Garden",
    amount: 22.0,
    type: "debit",
    date: new Date(2025, 0, 6),
  },
  {
    id: "c2b-w01Wxy2zA4B-FOOD",
    name: "Song Fa Bak Kut Teh",
    venue: "New Bridge Road",
    amount: 35.0,
    type: "debit",
    date: new Date(2025, 0, 6),
  },
];

// ============================================
// ICON COMPONENTS
// ============================================

function getLocationIcon() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="28" viewBox="0 0 52 61" fill="none">
      <path d="M26 1.79297C32.4461 1.79297 38.0834 3.89747 42.9863 8.13867C47.7763 12.2822 50.207 17.836 50.207 24.9961C50.207 29.565 48.2666 34.726 44.0859 40.5215C40.0929 46.0569 34.0844 52.1038 26 58.6611C17.9156 52.1038 11.9071 46.0569 7.91406 40.5215C3.73337 34.726 1.79303 29.565 1.79297 24.9961C1.79297 17.836 4.22366 12.2822 9.01367 8.13867C13.9166 3.89747 19.5539 1.79297 26 1.79297ZM26 4.30371C20.1035 4.30371 15.0382 6.22234 10.9199 10.085C6.76556 13.9815 4.70703 19.0033 4.70703 24.9961C4.7071 29.1178 6.52242 33.6041 9.81641 38.3955C13.1334 43.2204 18.1612 48.5038 24.8301 54.2461L26 55.2539L27.1699 54.2461C33.8388 48.5038 38.8666 43.2204 42.1836 38.3955C45.4776 33.6041 47.2929 29.1178 47.293 24.9961C47.293 19.0033 45.2344 13.9815 41.0801 10.085C36.9618 6.22234 31.8965 4.30371 26 4.30371ZM26 20.083C27.3441 20.083 28.4325 20.5148 29.3643 21.3887C30.2921 22.2591 30.7069 23.2274 30.707 24.3857C30.707 25.5443 30.2922 26.5133 29.3643 27.3838C28.4325 28.2577 27.3441 28.6895 26 28.6895C24.6559 28.6895 23.5675 28.2577 22.6357 27.3838C21.7078 26.5133 21.293 25.5443 21.293 24.3857C21.2931 23.2274 21.7079 22.2591 22.6357 21.3887C23.5675 20.5148 24.6559 20.083 26 20.083Z" fill="#FF5F00" stroke="#FF5F00" stroke-width="1.412"/>
    </svg>
  `;
}

function getClockIcon() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 23 23" fill="none">
      <path d="M11.2584 5.11744V11.2584L15.3524 13.3054M21.4934 11.2584C21.4934 16.9111 16.9111 21.4934 11.2584 21.4934C5.6058 21.4934 1.02344 16.9111 1.02344 11.2584C1.02344 5.6058 5.6058 1.02344 11.2584 1.02344C16.9111 1.02344 21.4934 5.6058 21.4934 11.2584Z" stroke="#7375CF" stroke-width="2.047" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

// Payment method to logo mapping
const paymentMethodLogos = {
  Amex: "../../Payment Methods/Amex.svg",
  "Apple Pay": "../../Payment Methods/Apple Pay.svg",
  Cash: "../../Payment Methods/Cash.png",
  "CDC Voucher": "../../Payment Methods/CDC Voucher.png",
  "Google Pay": "../../Payment Methods/Google Pay.svg",
  GrabPay: "../../Payment Methods/GrabPay.svg",
  MasterCard: "../../Payment Methods/masterCard.svg",
  NETS: "../../Payment Methods/NETS.svg",
  PayNow: "../../Payment Methods/PayNow.svg",
  UnionPay: "../../Payment Methods/UnionPay.svg",
  Visa: "../../Payment Methods/Visa.svg",
};

// Mock order items for transaction details
const mockTransactionDetails = {
  // GrabPay
  "c2b-j29Sksix93Q-FOOD": {
    items: [
      {
        name: "Char Kway Teow",
        store: "Chinese Foods Private Limited",
        price: 8.5,
        quantity: 2,
        specialRequest: "Extra chilli, no beansprouts",
        image: "../../images/placeholder-food.jpg",
      },
      {
        name: "Hokkien Mee",
        store: "Chinese Foods Private Limited",
        price: 6.9,
        quantity: 1,
        specialRequest: "",
        image: "../../images/placeholder-food.jpg",
      },
    ],
    collectionLocation: "Maxwell Food Centre",
    collectionAddress: "1 Kadayanallur St, Singapore 069184",
    collectionTime: "12:30 PM - 1:00 PM",
    paymentMethod: "GrabPay",
    paymentDetails: "",
    transactionId: "c2b-j29Sksix93Q-FOOD",
    referenceNo: "REF-2025011-001",
  },
  // PayNow
  "c2b-j29jsS9L3sQ-FOOD": {
    items: [
      {
        name: "Roast Duck Rice",
        store: "Chinese Good Foods Cuisines",
        price: 12.0,
        quantity: 3,
        specialRequest: "Extra gravy",
        image: "../../images/placeholder-food.jpg",
      },
      {
        name: "Wonton Noodles",
        store: "Chinese Good Foods Cuisines",
        price: 7.0,
        quantity: 2,
        specialRequest: "",
        image: "../../images/placeholder-food.jpg",
      },
      {
        name: "Iced Lemon Tea",
        store: "Chinese Good Foods Cuisines",
        price: 2.5,
        quantity: 4,
        specialRequest: "Less ice",
        image: "../../images/placeholder-food.jpg",
      },
    ],
    collectionLocation: "Maxwell Food Centre",
    collectionAddress: "1 Kadayanallur St, Singapore 069184",
    collectionTime: "1:00 PM - 1:30 PM",
    paymentMethod: "PayNow",
    paymentDetails: "",
    transactionId: "c2b-j29jsS9L3sQ-FOOD",
    referenceNo: "REF-2025011-002",
  },
  // Visa
  "c2b-k48Lmn7pQ2R-FOOD": {
    items: [
      {
        name: "Hainanese Chicken Rice",
        store: "Hainanese Delights",
        price: 5.5,
        quantity: 2,
        specialRequest: "Extra chilli sauce",
        image: "../../images/placeholder-food.jpg",
      },
      {
        name: "Iced Barley",
        store: "Hainanese Delights",
        price: 2.0,
        quantity: 2,
        specialRequest: "",
        image: "../../images/placeholder-food.jpg",
      },
    ],
    collectionLocation: "Chinatown Complex",
    collectionAddress: "335 Smith St, Singapore 050335",
    collectionTime: "11:00 AM - 11:30 AM",
    paymentMethod: "Visa",
    paymentDetails: "4521",
    transactionId: "c2b-k48Lmn7pQ2R-FOOD",
    referenceNo: "REF-2025010-001",
  },
  // MasterCard
  "c2b-m92Xyz3aB5C-FOOD": {
    items: [
      {
        name: "Laksa",
        store: "Laksa King",
        price: 8.0,
        quantity: 1,
        specialRequest: "Extra cockles",
        image: "../../images/placeholder-food.jpg",
      },
    ],
    collectionLocation: "Old Airport Road",
    collectionAddress: "51 Old Airport Rd, Singapore 390051",
    collectionTime: "12:00 PM - 12:30 PM",
    paymentMethod: "MasterCard",
    paymentDetails: "8732",
    transactionId: "c2b-m92Xyz3aB5C-FOOD",
    referenceNo: "REF-2025010-002",
  },
  // NETS
  "c2b-n83Abc4dE6F-FOOD": {
    items: [
      {
        name: "Curry Chicken Bee Hoon",
        store: "Ah Heng Curry Chicken",
        price: 6.0,
        quantity: 2,
        specialRequest: "More gravy",
        image: "../../images/placeholder-food.jpg",
      },
    ],
    collectionLocation: "Hong Lim Market",
    collectionAddress: "531A Upper Cross St, Singapore 051531",
    collectionTime: "1:00 PM - 1:30 PM",
    paymentMethod: "NETS",
    paymentDetails: "6543",
    transactionId: "c2b-n83Abc4dE6F-FOOD",
    referenceNo: "REF-2025009-001",
  },
  // Apple Pay with Visa
  "c2b-p74Ghi5jK7L-FOOD": {
    items: [
      {
        name: "Chicken Rice",
        store: "Tian Tian Hainanese",
        price: 6.0,
        quantity: 3,
        specialRequest: "Breast meat only",
        image: "../../images/placeholder-food.jpg",
      },
    ],
    collectionLocation: "Maxwell Food Centre",
    collectionAddress: "1 Kadayanallur St, Singapore 069184",
    collectionTime: "11:30 AM - 12:00 PM",
    paymentMethod: "Apple Pay",
    paymentProvider: "Visa",
    paymentDetails: "1234",
    transactionId: "c2b-p74Ghi5jK7L-FOOD",
    referenceNo: "REF-2025009-002",
  },
  // Amex
  "c2b-q65Mno6pQ8R-FOOD": {
    items: [
      {
        name: "Bak Chor Mee",
        store: "Hill Street Tai Hwa",
        price: 8.0,
        quantity: 2,
        specialRequest: "Extra vinegar",
        image: "../../images/placeholder-food.jpg",
      },
      {
        name: "Fishball Soup",
        store: "Hill Street Tai Hwa",
        price: 6.0,
        quantity: 2,
        specialRequest: "",
        image: "../../images/placeholder-food.jpg",
      },
    ],
    collectionLocation: "Crawford Lane",
    collectionAddress: "466 Crawford Ln, Singapore 190466",
    collectionTime: "12:30 PM - 1:00 PM",
    paymentMethod: "Amex",
    paymentDetails: "3001",
    transactionId: "c2b-q65Mno6pQ8R-FOOD",
    referenceNo: "REF-2025008-001",
  },
  // Google Pay with MasterCard
  "c2b-r56Stu7vW9X-FOOD": {
    items: [
      {
        name: "Soya Sauce Chicken",
        store: "Liao Fan Hawker Chan",
        price: 5.0,
        quantity: 3,
        specialRequest: "Extra soya sauce",
        image: "../../images/placeholder-food.jpg",
      },
    ],
    collectionLocation: "Chinatown Complex",
    collectionAddress: "335 Smith St, Singapore 050335",
    collectionTime: "11:00 AM - 11:30 AM",
    paymentMethod: "Google Pay",
    paymentProvider: "MasterCard",
    paymentDetails: "5678",
    transactionId: "c2b-r56Stu7vW9X-FOOD",
    referenceNo: "REF-2025008-002",
  },
  // Cash
  "c2b-t38Efg9hI1J-FOOD": {
    items: [
      {
        name: "Fried Kway Teow",
        store: "Outram Park Fried Kway Teow",
        price: 5.0,
        quantity: 2,
        specialRequest: "No chilli",
        image: "../../images/placeholder-food.jpg",
      },
    ],
    collectionLocation: "Hong Lim Market",
    collectionAddress: "531A Upper Cross St, Singapore 051531",
    collectionTime: "6:00 PM - 6:30 PM",
    paymentMethod: "Cash",
    paymentDetails: "",
    transactionId: "c2b-t38Efg9hI1J-FOOD",
    referenceNo: "REF-2025007-001",
  },
  // CDC Voucher
  "c2b-u29Klm0nO2P-FOOD": {
    items: [
      {
        name: "Fish Porridge",
        store: "Zhen Zhen Porridge",
        price: 4.5,
        quantity: 1,
        specialRequest: "Extra ginger",
        image: "../../images/placeholder-food.jpg",
      },
      {
        name: "Century Egg Porridge",
        store: "Zhen Zhen Porridge",
        price: 4.0,
        quantity: 1,
        specialRequest: "",
        image: "../../images/placeholder-food.jpg",
      },
    ],
    collectionLocation: "Maxwell Food Centre",
    collectionAddress: "1 Kadayanallur St, Singapore 069184",
    collectionTime: "8:00 AM - 8:30 AM",
    paymentMethod: "CDC Voucher",
    paymentDetails: "",
    transactionId: "c2b-u29Klm0nO2P-FOOD",
    referenceNo: "REF-2025007-002",
  },
  // UnionPay
  "c2b-v10Qrs1tU3V-FOOD": {
    items: [
      {
        name: "Bak Chor Mee Dry",
        store: "Seng Kee Bak Chor Mee",
        price: 5.5,
        quantity: 4,
        specialRequest: "Extra chilli",
        image: "../../images/placeholder-food.jpg",
      },
    ],
    collectionLocation: "Serangoon Garden",
    collectionAddress: "49A Serangoon Garden Way, Singapore 555945",
    collectionTime: "12:00 PM - 12:30 PM",
    paymentMethod: "UnionPay",
    paymentDetails: "9012",
    transactionId: "c2b-v10Qrs1tU3V-FOOD",
    referenceNo: "REF-2025006-001",
  },
  // Apple Pay with Amex
  "c2b-w01Wxy2zA4B-FOOD": {
    items: [
      {
        name: "Pork Ribs Soup",
        store: "Song Fa Bak Kut Teh",
        price: 9.0,
        quantity: 2,
        specialRequest: "Extra pepper",
        image: "../../images/placeholder-food.jpg",
      },
      {
        name: "Braised Peanuts",
        store: "Song Fa Bak Kut Teh",
        price: 4.0,
        quantity: 2,
        specialRequest: "",
        image: "../../images/placeholder-food.jpg",
      },
      {
        name: "You Tiao",
        store: "Song Fa Bak Kut Teh",
        price: 2.0,
        quantity: 4,
        specialRequest: "",
        image: "../../images/placeholder-food.jpg",
      },
    ],
    collectionLocation: "New Bridge Road",
    collectionAddress: "11 New Bridge Rd, Singapore 059383",
    collectionTime: "11:00 AM - 11:30 AM",
    paymentMethod: "Apple Pay",
    paymentProvider: "Amex",
    paymentDetails: "2468",
    transactionId: "c2b-w01Wxy2zA4B-FOOD",
    referenceNo: "REF-2025006-002",
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });

  if (isToday) {
    return `Today, ${day} ${month}`;
  } else if (isYesterday) {
    return `Yesterday, ${day} ${month}`;
  } else {
    return `${day} ${month}`;
  }
}

function formatPrice(amount, type) {
  const sign = type === "credit" ? "+ " : "- ";
  return `${sign}$${amount.toFixed(amount % 1 === 0 ? 1 : 2)}`;
}

function groupTransactionsByDate(transactions) {
  const groups = {};

  transactions.forEach((transaction) => {
    const dateKey = transaction.date.toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: transaction.date,
        transactions: [],
      };
    }
    groups[dateKey].transactions.push(transaction);
  });

  // Sort groups by date (newest first)
  return Object.values(groups).sort((a, b) => b.date - a.date);
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderTransactionCard(transaction) {
  const amountClass = transaction.type === "credit" ? "credit" : "debit";
  // Use orderId for navigation to detail page (Firebase document ID)
  const detailId = transaction.orderId || transaction.id;

  return `
        <div class="transactionCard ${transaction.type}">
            <div class="transactionCardLeft">
                <span class="transactionName">${transaction.name}</span>
                <span class="transactionId">Transaction ID: ${transaction.id}</span>
                <span class="transactionVenue">${transaction.venue}</span>
            </div>
            <div class="transactionCardRight">
                <span class="transactionAmount ${amountClass}">${formatPrice(transaction.amount, transaction.type)}</span>
                <a class="seeMoreLink" href="#" data-transaction-id="${detailId}">see more ></a>
            </div>
        </div>
    `;
}

function renderDateGroup(group) {
  const transactionsHTML = group.transactions
    .map((t) => renderTransactionCard(t))
    .join("");

  return `
        <div class="dateGroup">
            <span class="dateLabel">${formatDate(group.date)}</span>
            <div class="transactionsList">
                ${transactionsHTML}
            </div>
        </div>
    `;
}

function renderTransactionHistory(transactions) {
  const container = document.getElementById("settingsContent");
  if (!container) return;

  const groups = groupTransactionsByDate(transactions);
  const dateGroupsHTML = groups.map((group) => renderDateGroup(group)).join("");

  container.innerHTML = `
    <div class="nowPerusingSection">
      <span class="nowPerusingLabel">Now Perusing:</span>
      <span class="nowPerusingTitle">Transactions</span>
    </div>
    <div class="dateGroupsContainer">
      ${dateGroupsHTML}
    </div>
  `;

  // Attach event listeners for "see more" links
  attachSeeMoreListeners();
}

// ============================================
// TRANSACTION DETAIL RENDER FUNCTIONS
// ============================================

function renderOrderItem(item) {
  const specialRequestHTML = item.specialRequest
    ? `<span class="specialRequest">${item.specialRequest}</span>`
    : "";

  return `
    <div class="orderItem">
      <img src="${item.image}" alt="${item.name}" class="orderItemImage" />
      <div class="orderItemDetails">
        <div class="orderItemRow">
          <div class="orderItemNameGroup">
            <span class="itemName">${item.name}</span>
            <span class="storeName">${item.store}</span>
          </div>
          <span class="price">$${item.price.toFixed(2)}</span>
        </div>
        <div class="orderItemRow">
          ${specialRequestHTML}
          <span class="qtyCount">${item.quantity}</span>
        </div>
      </div>
    </div>
  `;
}

function renderTransactionDetail(transactionId) {
  const container = document.getElementById("confirmedContent");
  if (!container) return;

  // Find the transaction info
  const transaction = mockTransactions.find((t) => t.id === transactionId);
  const details = mockTransactionDetails[transactionId];

  if (!transaction || !details) {
    container.innerHTML = `<p>Transaction not found.</p>`;
    return;
  }

  // Calculate total
  const total = details.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  // Render order items
  const orderItemsHTML = details.items
    .map((item) => renderOrderItem(item))
    .join("");

  // Card providers (pure credit/debit cards)
  const cardProviders = ["Visa", "MasterCard", "Amex", "UnionPay"];
  const isCardProvider = cardProviders.includes(details.paymentMethod);
  const hasCardProvider =
    details.paymentProvider && cardProviders.includes(details.paymentProvider);

  // Get payment method logo(s)
  const paymentLogo = paymentMethodLogos[details.paymentMethod] || "";
  const providerLogo = details.paymentProvider
    ? paymentMethodLogos[details.paymentProvider] || ""
    : "";

  // Build payment display text
  let paymentDisplayText = details.paymentMethod;
  let paymentSubtext = details.paymentDetails;

  if (isCardProvider) {
    // Pure card - show "Credit/Debit Card" as title, provider + last 4 as details
    paymentDisplayText = "Credit/Debit Card";
    paymentSubtext = `${details.paymentMethod} ${details.paymentDetails}`;
  } else if (hasCardProvider) {
    // Apple Pay or Google Pay with card provider
    paymentDisplayText = details.paymentMethod;
    paymentSubtext = `${details.paymentProvider} ${details.paymentDetails}`;
  }
  // For PayNow, GrabPay, NETS, Cash, CDC Voucher - keep as is

  // Build payment logo HTML
  let paymentLogoHTML = "";
  if (paymentLogo && providerLogo) {
    // Apple Pay or Google Pay with provider - show both logos
    paymentLogoHTML = `
      <div class="paymentLogosGroup">
        <img src="${paymentLogo}" alt="${details.paymentMethod}" class="paymentMethodImage" />
        <img src="${providerLogo}" alt="${details.paymentProvider}" class="paymentMethodImage" />
      </div>
    `;
  } else if (paymentLogo) {
    paymentLogoHTML = `<img src="${paymentLogo}" alt="${details.paymentMethod}" class="paymentMethodImage" />`;
  }

  // No grey banner box - start directly with order items
  container.innerHTML = `
    <div class="orderItemsList">
      ${orderItemsHTML}
    </div>

    <div class="totalRow">
      <span class="totalLabel">Total</span>
      <span class="totalPrice">$${total.toFixed(2)}</span>
    </div>

    <div class="detailsRow">
      <div class="collectionDetailsSection">
        <span class="sectionLabel">Collection Details</span>
        <div class="collectionRow">
          <div class="collectionIcon location">
            ${getLocationIcon()}
          </div>
          <div class="collectionInfo">
            <span class="collectionTitle">${details.collectionLocation}</span>
            <span class="collectionSubtitle">${details.collectionAddress}</span>
          </div>
        </div>
        <div class="collectionRow">
          <div class="collectionIcon time">
            ${getClockIcon()}
          </div>
          <div class="collectionInfo">
            <span class="collectionTitle">${details.collectionTime}</span>
            <span class="collectionSubtitle">Collection Time</span>
          </div>
        </div>
      </div>

      <div class="transactionDetailsSection">
        <span class="sectionLabel">Transaction Details</span>
        <div class="paymentMethodCard">
          ${paymentLogoHTML}
          <div class="paymentInfo">
            <span class="paymentMethod">${paymentDisplayText}</span>
            ${paymentSubtext ? `<span class="paymentMethodDetails">${paymentSubtext}</span>` : ""}
          </div>
        </div>
        <div class="transactionIds">
          <span class="transactionId">Transaction ID: ${details.transactionId}</span>
          <span class="transactionId">Reference No: ${details.referenceNo}</span>
        </div>
      </div>
    </div>

    <div class="feedbackSection">
      <a href="consumerFeedback.html?order=${encodeURIComponent(transactionId)}" class="leaveFeedbackBtn">Leave feedback</a>
    </div>
  `;
}

/**
 * Render transaction detail from Firebase order data
 */
function renderTransactionDetailFromOrder(order, orderId) {
  const container = document.getElementById("confirmedContent");
  if (!container) return;

  // Get collection details
  const collectionDetails = order.collectionDetails || {};
  const collectionLocation =
    collectionDetails.venueName || order.stallName || "Unknown Location";
  const collectionAddress = collectionDetails.address || "";
  const pickupTime = collectionDetails.pickupTime || 10;

  // Get payment details
  const paymentDetails = order.paymentDetails || {};
  const paymentMethod = paymentDetails.type || order.paymentMethod || "Unknown";
  const paymentBrand = paymentDetails.brand || "";
  const paymentLastFour = paymentDetails.lastFour || "";

  // Calculate total
  const total =
    order.total ||
    order.items?.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    ) ||
    0;

  // Render order items
  const orderItemsHTML = (order.items || [])
    .map(
      (item) => `
    <div class="orderItem">
      <img src="${item.imageUrl || "../../images/placeholder-food.jpg"}" alt="${item.name}" class="orderItemImage" />
      <div class="orderItemDetails">
        <div class="orderItemRow">
          <div class="orderItemNameGroup">
            <span class="itemName">${item.name}</span>
            <span class="storeName">${order.stallName || "Unknown Stall"}</span>
          </div>
          <span class="price">$${(item.unitPrice || 0).toFixed(2)}</span>
        </div>
        <div class="orderItemRow">
          ${item.notes ? `<span class="specialRequest">${item.notes}</span>` : "<span></span>"}
          <span class="qtyCount">${item.quantity}</span>
        </div>
      </div>
    </div>
  `,
    )
    .join("");

  // Determine payment display
  let paymentDisplayText = "Credit/Debit Card";
  let paymentSubtext = "";
  let paymentLogoHTML = "";

  const cardBrands = ["visa", "mastercard", "amex", "unionpay"];
  const isCard =
    paymentMethod === "card" ||
    cardBrands.includes(paymentMethod.toLowerCase());

  if (paymentMethod === "paynow" || paymentMethod === "PayNow") {
    paymentDisplayText = "PayNow";
    paymentLogoHTML = `<img src="../../Payment Methods/PayNow.svg" alt="PayNow" class="paymentMethodImage" />`;
  } else if (paymentMethod === "grabpay" || paymentMethod === "GrabPay") {
    paymentDisplayText = "GrabPay";
    paymentLogoHTML = `<img src="../../Payment Methods/GrabPay.svg" alt="GrabPay" class="paymentMethodImage" />`;
  } else if (
    paymentMethod === "alipay" ||
    paymentMethod === "AliPay" ||
    paymentMethod === "Alipay"
  ) {
    paymentDisplayText = "Alipay";
    paymentSubtext = "支付宝";
    paymentLogoHTML = `<img src="../../Payment Methods/AliPay.svg" alt="Alipay" class="paymentMethodImage" />`;
  } else if (isCard) {
    paymentDisplayText = "Credit/Debit Card";
    if (paymentBrand && paymentLastFour) {
      paymentSubtext = `${capitalizeFirstLetter(paymentBrand)} ${paymentLastFour}`;
    }
    // Get card logo
    const brandLogos = {
      visa: "../../Payment Methods/Visa.svg",
      mastercard: "../../Payment Methods/masterCard.svg",
      amex: "../../Payment Methods/Amex.svg",
      unionpay: "../../Payment Methods/UnionPay.svg",
    };
    const logoPath =
      brandLogos[paymentBrand?.toLowerCase()] ||
      "../../Payment Methods/Visa.svg";
    paymentLogoHTML = `<img src="${logoPath}" alt="${paymentBrand}" class="paymentMethodImage" />`;
  }

  // Get transaction ID (use saved hawkrTransactionId or generate from orderId)
  const transactionId =
    order.hawkrTransactionId || `c2b-${orderId.substring(0, 10)}-FOOD`;

  container.innerHTML = `
    <div class="orderItemsList">
      ${orderItemsHTML}
    </div>

    <div class="totalRow">
      <span class="totalLabel">Total</span>
      <span class="totalPrice">$${total.toFixed(2)}</span>
    </div>

    <div class="detailsRow">
      <div class="collectionDetailsSection">
        <span class="sectionLabel">Collection Details</span>
        <div class="collectionRow">
          <div class="collectionIcon location">
            ${getLocationIcon()}
          </div>
          <div class="collectionInfo">
            <span class="collectionTitle">${collectionLocation}</span>
            <span class="collectionSubtitle">${collectionAddress}</span>
          </div>
        </div>
        <div class="collectionRow">
          <div class="collectionIcon time">
            ${getClockIcon()}
          </div>
          <div class="collectionInfo">
            <span class="collectionTitle">Pick up in ${pickupTime} minutes</span>
            <span class="collectionSubtitle">Collection Time</span>
          </div>
        </div>
      </div>

      <div class="transactionDetailsSection">
        <span class="sectionLabel">Transaction Details</span>
        <div class="paymentMethodCard">
          ${paymentLogoHTML}
          <div class="paymentInfo">
            <span class="paymentMethod">${paymentDisplayText}</span>
            ${paymentSubtext ? `<span class="paymentMethodDetails">${paymentSubtext}</span>` : ""}
          </div>
        </div>
        <div class="transactionIds">
          <span class="transactionId">Hawkr Transaction ID: ${transactionId}</span>
        </div>
      </div>
    </div>

    <div class="feedbackSection">
      <a href="consumerFeedback.html?order=${encodeURIComponent(orderId)}" class="leaveFeedbackBtn">Leave feedback</a>
    </div>
  `;
}

/**
 * Capitalize first letter of a string
 */
function capitalizeFirstLetter(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function initializeDetailPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("id");

  if (!orderId) {
    const container = document.getElementById("confirmedContent");
    if (container) {
      container.innerHTML = `<p>No transaction ID provided.</p>`;
    }
    return;
  }

  // Show loading
  const container = document.getElementById("confirmedContent");
  if (container) {
    container.innerHTML = `<div class="loadingSpinner"></div>`;
  }

  try {
    // Fetch order from Firebase
    const order = await getOrderById(orderId);

    if (!order) {
      if (container) {
        container.innerHTML = `<p>Transaction not found.</p>`;
      }
      return;
    }

    renderTransactionDetailFromOrder(order, orderId);
  } catch (error) {
    console.error("Error fetching transaction detail:", error);
    if (container) {
      container.innerHTML = `<p>Failed to load transaction details.</p>`;
    }
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

function attachSeeMoreListeners() {
  const seeMoreLinks = document.querySelectorAll(".seeMoreLink");
  seeMoreLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const transactionId = this.dataset.transactionId;
      // Save scroll position before navigating
      sessionStorage.setItem("transactionsScrollPosition", window.scrollY);
      // Save referrer page
      sessionStorage.setItem(
        "transactionDetailReferrer",
        "consumerTransactions.html",
      );
      // Navigate to transaction detail page
      window.location.href = `consumerTransactionDetail.html?id=${encodeURIComponent(transactionId)}`;
    });
  });
}

function handleBackClick() {
  if (isDetailPage) {
    // Go back to the page user came from
    const referrer = sessionStorage.getItem("transactionDetailReferrer");
    sessionStorage.removeItem("transactionDetailReferrer");

    if (referrer) {
      window.location.href = referrer;
    } else {
      window.location.href = "consumerTransactions.html";
    }
  } else if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "../Consumer Dashboard/consumerDashboard.html";
  }
}

// ============================================
// LOADING STATE
// ============================================

function showLoading() {
  const container = document.getElementById("settingsContent");
  if (container) {
    container.innerHTML = `<div class="loadingSpinner"></div>`;
  }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initializeSettingsPage() {
  showLoading();

  if (!currentUser) {
    const container = document.getElementById("settingsContent");
    if (container) {
      container.innerHTML = `
        <div class="emptyState">
          <p>Please log in to view your transactions.</p>
          <a href="../Auth/login.html" class="loginBtn">Log In</a>
        </div>
      `;
    }
    return;
  }

  try {
    // Fetch real orders from Firebase
    const orders = await getCustomerOrders(50);

    // Transform orders to transaction format
    const transactions = orders.map((order) => ({
      id: order.hawkrTransactionId || order.id,
      orderId: order.id, // Keep original order ID for detail page
      name: order.stallName || "Unknown Stall",
      venue: order.collectionDetails?.venueName || "Unknown Location",
      amount: order.total || 0,
      type: "debit",
      date: order.createdAt?.toDate
        ? order.createdAt.toDate()
        : new Date(order.createdAt),
      // Store additional data for detail page
      orderNumber: order.orderNumber,
      hawkrTransactionId: order.hawkrTransactionId,
    }));

    if (transactions.length === 0) {
      const container = document.getElementById("settingsContent");
      if (container) {
        container.innerHTML = `
          <div class="nowPerusingSection">
            <span class="nowPerusingLabel">Now Perusing:</span>
            <span class="nowPerusingTitle">Transactions</span>
          </div>
          <div class="emptyState">
            <p>No transactions yet. Start ordering to see your history!</p>
            <a href="../Consumer Order/consumerOrder.html" class="orderBtn">Order Food</a>
          </div>
        `;
      }
      return;
    }

    renderTransactionHistory(transactions);

    // Restore scroll position if coming back from detail page
    const savedScrollPosition = sessionStorage.getItem(
      "transactionsScrollPosition",
    );
    if (savedScrollPosition) {
      window.scrollTo(0, parseInt(savedScrollPosition, 10));
      sessionStorage.removeItem("transactionsScrollPosition");
    }
  } catch (error) {
    console.error("Error fetching transactions:", error);
    const container = document.getElementById("settingsContent");
    if (container) {
      container.innerHTML = `
        <div class="emptyState">
          <p>Failed to load transactions. Please try again.</p>
        </div>
      `;
    }
  }
}

async function initializePage() {
  if (isDetailPage) {
    await initializeDetailPage();
  } else {
    await initializeSettingsPage();
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  // Initialize navbar (auth, user display, logout)
  initConsumerNavbar();
  injectMobileMenu();

  // Listen for auth state and then initialize
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    await initializePage();
  });

  // Back button handler
  const backButton = document.getElementById("backButton");
  if (backButton) {
    backButton.addEventListener("click", handleBackClick);
  }

  // Search input focus shortcut
  const searchInput = document.getElementById("searchInput");

  document.addEventListener("keydown", function (e) {
    if (!searchInput) return;

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
