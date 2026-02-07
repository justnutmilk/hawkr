import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";
import { initiateRefund } from "../../firebase/services/stripe.js";
import { db } from "../../firebase/config.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize vendor navbar (handles auth, vendor name, logout, keyboard shortcuts)
  initVendorNavbar();

  const pmBase = "../../Payment Methods/";
  const iconsBase = "../../assets/icons/";

  // Load transaction and ordersByDate dictionary from sessionStorage
  const raw = sessionStorage.getItem("selectedTransaction");
  const ordersRaw = sessionStorage.getItem("ordersByDate");
  if (!raw || !ordersRaw) {
    window.location.href = "vendorPayments.html";
    return;
  }

  const transaction = JSON.parse(raw);
  const ordersByDate = JSON.parse(ordersRaw);
  if (!transaction.items || !transaction.date) {
    window.location.href = "vendorPayments.html";
    return;
  }

  // Derive related orders: other orders at the same datetime
  const relatedOrders = (ordersByDate[transaction.date] || []).filter(
    (order) => order.txnId !== transaction.txnId,
  );

  const container = document.getElementById("pageContent");

  const subtotal = transaction.items.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );

  // Voucher discount info from order data
  const orderData = transaction.orderData || {};
  const voucherCode = orderData.voucherCode || null;
  const voucherDiscount = orderData.voucherDiscount || 0;
  const total =
    voucherDiscount > 0 ? Math.max(0, subtotal - voucherDiscount) : subtotal;

  // Build order items HTML
  const itemsHtml = transaction.items
    .map((item) => {
      const tagsHtml = item.specialRequest
        ? `<div class="orderItemTags">
                    <span class="requestTag">Requests</span>
                    <span class="requestText">"${item.specialRequest}"</span>
               </div>`
        : "";

      const imageHtml = item.image
        ? `<img class="orderItemImage" src="${item.image}" alt="${item.name}">`
        : `<div class="orderItemImage"></div>`;

      return `
            <div class="orderItem">
                ${imageHtml}
                <div class="orderItemDetails">
                    <span class="orderItemName">${item.name}</span>
                    <span class="orderItemVendor">${item.vendor}</span>
                    ${tagsHtml}
                </div>
                <div class="orderItemRight">
                    <span class="orderItemPrice">$${item.price.toFixed(2)}</span>
                    <div class="orderItemQty">${item.qty}</div>
                </div>
            </div>
        `;
    })
    .join("");

  // Build payment logos HTML (large)
  const detailLogosHtml = transaction.logos
    .map((l) => `<img src="${pmBase}${l}" alt="">`)
    .join("");

  // Build payment sub line
  const subLine = transaction.paymentSub
    ? `<span class="transactionDetailsSub">${transaction.paymentSub}</span>`
    : "";

  // Determine transaction type label
  let typeLabel = "";
  if (transaction.txnId) {
    if (transaction.txnId.endsWith("-FOOD")) typeLabel = "Consumer Purchase";
    else if (transaction.txnId.endsWith("-REFUND")) typeLabel = "Refund";
    else if (transaction.txnId.endsWith("-RENT")) typeLabel = "Rent Payment";
  }

  // Check if already refunded
  const isRefunded = transaction.status === "Refunded";
  const isRefundType = transaction.txnId?.endsWith("-REFUND");
  const canRefund = !isRefunded && !isRefundType;

  // Build related orders HTML
  let relatedHtml = "";
  if (relatedOrders.length > 0) {
    const rows = relatedOrders
      .map((relatedOrder, i) => {
        const relatedOrderLogos = (relatedOrder.logos || [])
          .map((l) => `<img src="${pmBase}${l}" alt="">`)
          .join("");
        const badgeClass =
          relatedOrder.status === "Successful" ? "successful" : "refunded";
        const badgeIcon =
          relatedOrder.status === "Successful"
            ? `<img src="${iconsBase}successful.svg" alt="">`
            : `<img src="${iconsBase}refund.svg" alt="">`;
        return `
                <div class="relatedRow" data-related-index="${i}" style="cursor:pointer;">
                    <div class="transactionCell transactionCellAmount">
                        <span class="paymentAmount">S$${relatedOrder.amount.toFixed(2)}</span>
                        <span class="transactionBadge ${badgeClass}">${badgeIcon}${relatedOrder.status}</span>
                    </div>
                    <div class="transactionCell transactionCellMethod">
                        <div class="paymentMethodBox">
                            <div class="paymentLogos">${relatedOrderLogos}</div>
                            <span class="paymentMethodLabel">${relatedOrder.methodLabel}</span>
                        </div>
                    </div>
                    <div class="transactionCell transactionCellTransactionId">
                        <span class="transactionId">${relatedOrder.txnId}</span>
                    </div>
                    <div class="transactionCell transactionCellCustomer">
                        <span class="transactionCustomer">${relatedOrder.customer}</span>
                    </div>
                    <div class="transactionCell transactionCellDate">
                        <span class="transactionDateTime">${relatedOrder.date}</span>
                    </div>
                </div>
            `;
      })
      .join("");

    relatedHtml = `<div class="relatedTable">${rows}</div>`;
  }

  // Build review HTML
  let reviewHtml = "";
  if (transaction.review) {
    const stars = Array.from({ length: 5 }, (_, i) => {
      const filled = i < transaction.review.rating;
      return filled
        ? '<svg viewBox="0 0 16 16" fill="#913b9f" xmlns="http://www.w3.org/2000/svg"><path d="M8 0l2.47 4.94 5.53.81-4 3.87.94 5.5L8 12.42l-4.94 2.7.94-5.5-4-3.87 5.53-.81L8 0z"/></svg>'
        : '<svg viewBox="0 0 16 16" fill="#d0cad6" xmlns="http://www.w3.org/2000/svg"><path d="M8 0l2.47 4.94 5.53.81-4 3.87.94 5.5L8 12.42l-4.94 2.7.94-5.5-4-3.87 5.53-.81L8 0z"/></svg>';
    }).join("");

    reviewHtml = `
            <div class="reviewCard">
                <span class="reviewTitle">${transaction.review.title}</span>
                <span class="reviewText">${transaction.review.text}</span>
                <div class="reviewMeta">
                    <div class="reviewStars">${stars}</div>
                    <span class="reviewInfo">${transaction.review.daysAgo} days ago \u2022 By ${transaction.review.author}</span>
                </div>
            </div>
        `;
  }

  // Combine same-date related orders into initial HTML; async-loaded customer orders will append
  const initialRelatedHtml = relatedOrders.length > 0 ? relatedHtml : "";

  const relatedPlaceholder =
    '<span class="noRelated relatedPlaceholder">Loading...</span>';

  // Build refund button
  const refundBtnHtml = canRefund
    ? `<button class="initiateRefund" id="initiateRefundBtn">
                Initiate Refund
                <kbd class="buttonKeyboard">r</kbd>
            </button>`
    : isRefunded
      ? `<span class="refundedBadgeLarge">Refunded</span>`
      : "";

  container.innerHTML = `
        <!-- Header -->
        <div class="detailHeader">
            <div class="detailHeaderLeft">
                <span class="nowPerusing">Now Perusing${typeLabel ? ` \u2022 ${typeLabel}` : ""}</span>
                <span class="transactionIdDisplay">${transaction.txnId}</span>
            </div>
            ${refundBtnHtml}
        </div>

        <!-- Order Summary -->
        <div class="orderSummaryOutside">
            <div class="orderSummaryInside">
                <h2 class="sectionTitle">Order Summary</h2>
                ${itemsHtml}
            </div>
            ${
              voucherDiscount > 0
                ? `
            <div class="voucherRow">
                <div class="voucherRowLeft">
                    <span class="voucherRowLabel">Voucher</span>
                    <span class="voucherRowCode">${voucherCode}</span>
                </div>
                <span class="voucherRowDiscount">-$${voucherDiscount.toFixed(2)}</span>
            </div>
            `
                : ""
            }
            <div class="totalRow">
                <span class="totalLabel">Total</span>
                <span class="totalValue">$${total.toFixed(2)}</span>
            </div>
        </div>

        <!-- Transaction Details -->
        <div class="transactionDetailsSection">
            <h2 class="sectionTitle dark">Transaction Details</h2>
            <div class="transactionDetailsPayment">
                <div class="transactionDetailsLogos">${detailLogosHtml}</div>
                <div class="transactionDetailsMethod">
                    <span class="transactionDetailsBrand">${transaction.paymentBrand}</span>
                    ${subLine}
                </div>
            </div>
            <span class="transactionDetailsId">Hawkr Transaction ID: ${transaction.txnId}</span>
            ${transaction.refundTxnId ? `<span class="transactionDetailsId refundDetailsId">Refund ID: ${transaction.refundTxnId}</span>` : ""}
        </div>

        <!-- Related Instances/Orders -->
        <div class="relatedOrdersInstances">
            <h2 class="sectionTitle dark">Related Instances/Orders</h2>
            ${initialRelatedHtml}
            ${relatedPlaceholder}
        </div>
    `;

  // ============================================
  // LOAD CUSTOMER'S PAST ORDERS WITH THIS STALL
  // ============================================

  async function loadCustomerStallOrders() {
    const instancesContainer = container.querySelector(
      ".relatedOrdersInstances",
    );
    const placeholder = instancesContainer?.querySelector(
      ".relatedPlaceholder",
    );

    const orderData = transaction.orderData;
    if (!orderData) {
      console.warn("No orderData on transaction");
      if (placeholder)
        placeholder.textContent =
          relatedOrders.length > 0 ? "" : "No related instances";
      if (placeholder && relatedOrders.length > 0) placeholder.remove();
      return;
    }

    const customerId = orderData.customerId;
    const stallId = orderData.stallId;
    if (!customerId || !stallId) {
      console.warn("Missing customerId or stallId:", { customerId, stallId });
      if (placeholder)
        placeholder.textContent =
          relatedOrders.length > 0 ? "" : "No related instances";
      if (placeholder && relatedOrders.length > 0) placeholder.remove();
      return;
    }

    try {
      let snapshot;
      try {
        const ordersQuery = query(
          collection(db, "orders"),
          where("stallId", "==", stallId),
          where("customerId", "==", customerId),
          orderBy("createdAt", "desc"),
        );
        snapshot = await getDocs(ordersQuery);
      } catch (indexError) {
        console.warn("Index not ready, fetching without orderBy:", indexError);
        const fallbackQuery = query(
          collection(db, "orders"),
          where("stallId", "==", stallId),
          where("customerId", "==", customerId),
        );
        snapshot = await getDocs(fallbackQuery);
      }

      if (!instancesContainer) return;

      // Filter out the current order and any already-shown same-date orders
      const sameDateTxnIds = relatedOrders.map((o) => o.txnId);
      const otherOrders = snapshot.docs.filter((d) => {
        const data = d.data();
        const thisTxnId = data.hawkrTransactionId || "";
        return (
          d.id !== transaction.id &&
          d.id !== orderData.id &&
          !sameDateTxnIds.includes(thisTxnId)
        );
      });

      if (otherOrders.length === 0 && relatedOrders.length === 0) {
        if (placeholder) placeholder.textContent = "No related instances";
        return;
      }

      if (otherOrders.length === 0) {
        if (placeholder) placeholder.remove();
        return;
      }

      const brandLogos = {
        visa: "Visa.svg",
        mastercard: "MasterCard.svg",
        amex: "Amex.svg",
      };

      // Store order data for click navigation
      const asyncOrderData = otherOrders.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const rows = asyncOrderData
        .map((order, idx) => {
          const amount = order.total || 0;
          const status =
            order.paymentStatus === "refunded" || order.status === "cancelled"
              ? "Refunded"
              : "Successful";
          const badgeClass =
            status === "Successful" ? "successful" : "refunded";
          const badgeIcon =
            status === "Successful"
              ? `<img src="${iconsBase}successful.svg" alt="">`
              : `<img src="${iconsBase}refund.svg" alt="">`;
          const txnId = order.hawkrTransactionId || d.id.substring(0, 12);
          const customerName = order.customerName || "Customer";

          // Format date
          const createdAt = order.createdAt?.toDate?.() || new Date();
          const day = String(createdAt.getDate()).padStart(2, "0");
          const month = String(createdAt.getMonth() + 1).padStart(2, "0");
          const year = createdAt.getFullYear();
          let hours = createdAt.getHours();
          const minutes = String(createdAt.getMinutes()).padStart(2, "0");
          const ampm = hours >= 12 ? "pm" : "am";
          hours = hours % 12 || 12;
          const dateStr = `${day}-${month}-${year}, ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;

          // Payment method display
          const pm = order.paymentMethod || "cash";
          const details = order.paymentDetails || {};
          let logoHtml = "";
          let methodLabel = "";

          if (pm === "card") {
            const brand = (
              details.brand ||
              details.cardBrand ||
              "visa"
            ).toLowerCase();
            const last4 = details.lastFour || details.cardLast4 || "****";
            logoHtml = `<img src="${pmBase}${brandLogos[brand] || "Visa.svg"}" alt="">`;
            methodLabel = `\u2022\u2022\u2022\u2022 ${last4}`;
            if (details.wallet === "apple_pay") {
              logoHtml = `<img src="${pmBase}Apple Pay.svg" alt=""><img src="${pmBase}${brandLogos[brand] || "Visa.svg"}" alt="">`;
            } else if (details.wallet === "google_pay") {
              logoHtml = `<img src="${pmBase}Google Pay.svg" alt=""><img src="${pmBase}${brandLogos[brand] || "Visa.svg"}" alt="">`;
            }
          } else if (pm === "applePay" || pm === "apple_pay") {
            const brand = (details.brand || "visa").toLowerCase();
            const last4 = details.lastFour || "";
            logoHtml = `<img src="${pmBase}Apple Pay.svg" alt="">`;
            if (brand && brandLogos[brand]) {
              logoHtml += `<img src="${pmBase}${brandLogos[brand]}" alt="">`;
            }
            methodLabel = last4
              ? `\u2022\u2022\u2022\u2022 ${last4}`
              : "Apple Pay";
          } else if (pm === "googlePay" || pm === "google_pay") {
            const brand = (details.brand || "visa").toLowerCase();
            const last4 = details.lastFour || "";
            logoHtml = `<img src="${pmBase}Google Pay.svg" alt="">`;
            if (brand && brandLogos[brand]) {
              logoHtml += `<img src="${pmBase}${brandLogos[brand]}" alt="">`;
            }
            methodLabel = last4
              ? `\u2022\u2022\u2022\u2022 ${last4}`
              : "Google Pay";
          } else if (pm === "grabpay") {
            logoHtml = `<img src="${pmBase}GrabPay.svg" alt="">`;
            methodLabel = "GrabPay";
          } else if (pm === "paynow") {
            logoHtml = `<img src="${pmBase}PayNow.svg" alt="">`;
            methodLabel = "PayNow";
          } else if (pm === "alipay") {
            logoHtml = `<img src="${pmBase}Alipay.svg" alt="">`;
            methodLabel = "Alipay";
          } else {
            methodLabel = pm.charAt(0).toUpperCase() + pm.slice(1);
          }

          return `
            <div class="relatedRow" data-async-index="${idx}" style="cursor: pointer;">
              <div class="transactionCell transactionCellAmount">
                <span class="paymentAmount">S$${amount.toFixed(2)}</span>
                <span class="transactionBadge ${badgeClass}">${badgeIcon}${status}</span>
              </div>
              <div class="transactionCell transactionCellMethod">
                <div class="paymentMethodBox">
                  <div class="paymentLogos">${logoHtml}</div>
                  <span class="paymentMethodLabel">${methodLabel}</span>
                </div>
              </div>
              <div class="transactionCell transactionCellTransactionId">
                <span class="transactionId">${txnId}</span>
              </div>
              <div class="transactionCell transactionCellCustomer">
                <span class="transactionCustomer">${customerName}</span>
              </div>
              <div class="transactionCell transactionCellDate">
                <span class="transactionDateTime">${dateStr}</span>
              </div>
            </div>
          `;
        })
        .join("");

      if (placeholder) placeholder.remove();

      // Append to existing relatedTable or create new one
      const existingTable = instancesContainer.querySelector(".relatedTable");
      if (existingTable) {
        existingTable.insertAdjacentHTML("beforeend", rows);
      } else {
        instancesContainer.insertAdjacentHTML(
          "beforeend",
          `<div class="relatedTable">${rows}</div>`,
        );
      }

      // Add click handlers for async rows
      instancesContainer
        .querySelectorAll(".relatedRow[data-async-index]")
        .forEach((row) => {
          row.addEventListener("click", () => {
            const idx = parseInt(row.dataset.asyncIndex, 10);
            const order = asyncOrderData[idx];
            if (!order) return;

            // Build transaction object matching vendorPayments format
            const pm = order.paymentMethod || "cash";
            const det = order.paymentDetails || {};
            const brandLogosMap = {
              visa: "Visa.svg",
              mastercard: "MasterCard.svg",
              amex: "Amex.svg",
            };
            let logos = [];
            let methLabel = "";
            let payBrand = "";
            let paySub = "";
            const cap = (s) =>
              s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

            if (pm === "card") {
              const brand = (
                det.brand ||
                det.cardBrand ||
                "visa"
              ).toLowerCase();
              const last4 = det.lastFour || det.cardLast4 || "****";
              logos = [brandLogosMap[brand] || "Visa.svg"];
              methLabel = `\u2022\u2022\u2022\u2022 ${last4}`;
              payBrand = cap(brand);
              paySub = `${cap(brand)} ${last4}`;
              if (det.wallet === "apple_pay") {
                logos = ["Apple Pay.svg", brandLogosMap[brand] || "Visa.svg"];
                payBrand = "Apple Pay";
              } else if (det.wallet === "google_pay") {
                logos = ["Google Pay.svg", brandLogosMap[brand] || "Visa.svg"];
                payBrand = "Google Pay";
              }
            } else if (pm === "applePay" || pm === "apple_pay") {
              const brand = (det.brand || "visa").toLowerCase();
              const last4 = det.lastFour || "";
              logos = ["Apple Pay.svg"];
              if (brandLogosMap[brand]) logos.push(brandLogosMap[brand]);
              methLabel = last4
                ? `\u2022\u2022\u2022\u2022 ${last4}`
                : "Apple Pay";
              payBrand = "Apple Pay";
              paySub = last4 ? `${cap(brand)} ${last4}` : cap(brand);
            } else if (pm === "googlePay" || pm === "google_pay") {
              const brand = (det.brand || "visa").toLowerCase();
              const last4 = det.lastFour || "";
              logos = ["Google Pay.svg"];
              if (brandLogosMap[brand]) logos.push(brandLogosMap[brand]);
              methLabel = last4
                ? `\u2022\u2022\u2022\u2022 ${last4}`
                : "Google Pay";
              payBrand = "Google Pay";
              paySub = last4 ? `${cap(brand)} ${last4}` : cap(brand);
            } else if (pm === "grabpay") {
              logos = ["GrabPay.svg"];
              methLabel = "GrabPay";
              payBrand = "GrabPay";
            } else if (pm === "paynow") {
              logos = ["PayNow.svg"];
              methLabel = "PayNow";
              payBrand = "PayNow";
            } else if (pm === "alipay") {
              logos = ["Alipay.svg"];
              methLabel = "Alipay";
              payBrand = "Alipay";
            } else {
              methLabel = cap(pm);
              payBrand = cap(pm);
            }

            // Format date
            const ca =
              order.createdAt?.toDate?.() ||
              (order.createdAt?.seconds
                ? new Date(order.createdAt.seconds * 1000)
                : new Date());
            const dd = String(ca.getDate()).padStart(2, "0");
            const mm = String(ca.getMonth() + 1).padStart(2, "0");
            const yyyy = ca.getFullYear();
            let hh = ca.getHours();
            const mins = String(ca.getMinutes()).padStart(2, "0");
            const ap = hh >= 12 ? "pm" : "am";
            hh = hh % 12 || 12;
            const dateStr = `${dd}-${mm}-${yyyy}, ${String(hh).padStart(2, "0")}:${mins} ${ap}`;

            const status =
              order.paymentStatus === "refunded" || order.status === "cancelled"
                ? "Refunded"
                : "Successful";

            const txnObj = {
              id: order.id,
              amount: order.total || 0,
              status,
              logos,
              methodLabel: methLabel,
              paymentBrand: payBrand,
              paymentSub: paySub,
              txnId: order.hawkrTransactionId || order.id.substring(0, 12),
              refundTxnId: order.refundTransactionId || null,
              customer: order.customerName || "Customer",
              items: (order.items || []).map((item) => ({
                name: item.name,
                vendor: order.stallName || "",
                price: item.unitPrice || item.totalPrice / (item.quantity || 1),
                qty: item.quantity || 1,
                image: item.imageUrl || "",
                specialRequest: item.notes || "",
              })),
              review: null,
              date: dateStr,
              orderData: order,
            };

            sessionStorage.setItem(
              "selectedTransaction",
              JSON.stringify(txnObj),
            );
            window.location.reload();
          });
        });
    } catch (error) {
      console.error("Error loading customer orders:", error);
      if (placeholder) placeholder.textContent = "No related instances";
    }
  }

  // ============================================
  // LOAD CUSTOMER'S REVIEWS FOR THIS STALL
  // ============================================

  async function loadCustomerStallReviews() {
    const orderData = transaction.orderData;
    if (!orderData) return;

    const customerId = orderData.customerId;
    const stallId = orderData.stallId;
    if (!customerId || !stallId) return;

    try {
      let snapshot;
      try {
        const feedbackQuery = query(
          collection(db, "feedback"),
          where("stallId", "==", stallId),
          where("customerId", "==", customerId),
          orderBy("createdAt", "desc"),
        );
        snapshot = await getDocs(feedbackQuery);
      } catch (indexError) {
        const fallbackQuery = query(
          collection(db, "feedback"),
          where("stallId", "==", stallId),
          where("customerId", "==", customerId),
        );
        snapshot = await getDocs(fallbackQuery);
      }

      if (snapshot.empty) return;

      const instancesContainer = container.querySelector(
        ".relatedOrdersInstances",
      );
      if (!instancesContainer) return;

      const reviewCards = snapshot.docs
        .map((d) => {
          const fb = d.data();
          const rating = fb.rating || 0;
          const title = fb.title || "";
          const text = fb.text || fb.comment || "";
          const author = fb.customerName || "Customer";
          const createdAt = fb.createdAt?.toDate?.() || new Date();
          const daysAgo = Math.floor(
            (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
          );

          const stars = Array.from({ length: 5 }, (_, i) => {
            const filled = i < rating;
            return filled
              ? '<svg viewBox="0 0 16 16" fill="#913b9f" xmlns="http://www.w3.org/2000/svg"><path d="M8 0l2.47 4.94 5.53.81-4 3.87.94 5.5L8 12.42l-4.94 2.7.94-5.5-4-3.87 5.53-.81L8 0z"/></svg>'
              : '<svg viewBox="0 0 16 16" fill="#d0cad6" xmlns="http://www.w3.org/2000/svg"><path d="M8 0l2.47 4.94 5.53.81-4 3.87.94 5.5L8 12.42l-4.94 2.7.94-5.5-4-3.87 5.53-.81L8 0z"/></svg>';
          }).join("");

          return `
            <div class="relatedReviewCard">
                ${title ? `<span class="relatedReviewTitle">${title}</span>` : ""}
                ${text ? `<span class="relatedReviewText">${text}</span>` : ""}
                <div class="relatedReviewMeta">
                    <div class="relatedReviewStars">${stars}</div>
                    <span class="relatedReviewInfo">${daysAgo === 0 ? "Today" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`} \u2022 By ${author}</span>
                </div>
            </div>
          `;
        })
        .join("");

      // Insert reviews after the relatedTable (or after heading if no table)
      const existingTable = instancesContainer.querySelector(".relatedTable");
      if (existingTable) {
        existingTable.insertAdjacentHTML("afterend", reviewCards);
      } else {
        const heading = instancesContainer.querySelector(".sectionTitle");
        if (heading) {
          heading.insertAdjacentHTML("afterend", reviewCards);
        } else {
          instancesContainer.insertAdjacentHTML("beforeend", reviewCards);
        }
      }
    } catch (error) {
      console.error("Error loading customer reviews:", error);
    }
  }

  // Load customer's past orders and reviews asynchronously
  Promise.all([loadCustomerStallOrders(), loadCustomerStallReviews()]);

  // ============================================
  // REFUND MODAL LOGIC
  // ============================================

  const refundModal = document.getElementById("refundModal");
  const closeRefundModalBtn = document.getElementById("closeRefundModal");
  const cancelRefundBtn = document.getElementById("cancelRefund");
  const submitRefundBtn = document.getElementById("submitRefund");
  const refundReasonTextarea = document.getElementById("refundReasonText");
  const refundCharCount = document.getElementById("refundCharCount");

  function openRefundModal() {
    if (!canRefund) return;

    // Populate order summary in modal
    const summaryEl = document.getElementById("refundOrderSummary");
    summaryEl.innerHTML = `
      <div class="refundSummaryRow">
        <span class="refundSummaryLabel">Transaction</span>
        <span class="refundSummaryValue refundSummaryMono">${transaction.txnId}</span>
      </div>
      <div class="refundSummaryRow">
        <span class="refundSummaryLabel">Customer</span>
        <span class="refundSummaryValue">${transaction.customer}</span>
      </div>
      <div class="refundSummaryRow">
        <span class="refundSummaryLabel">Amount</span>
        <span class="refundSummaryValue refundSummaryBold">S$${total.toFixed(2)}</span>
      </div>
      <div class="refundSummaryRow">
        <span class="refundSummaryLabel">Payment</span>
        <span class="refundSummaryValue refundSummaryPayment">
          ${transaction.logos.map((l) => `<img src="${pmBase}${l}" alt="" class="refundSummaryLogo">`).join("")}
          ${transaction.paymentBrand}
        </span>
      </div>
    `;

    // Set full refund amount
    document.getElementById("fullRefundAmount").textContent =
      `S$${total.toFixed(2)}`;

    // Reset form
    document.querySelector('input[name="refundType"][value="full"]').checked =
      true;
    document.getElementById("refundPartialAmount").hidden = true;
    document.getElementById("partialRefundInput").value = "";
    refundReasonTextarea.value = "";
    refundCharCount.textContent = "0";
    submitRefundBtn.disabled = false;
    submitRefundBtn.textContent = "Process Refund";

    // Show modal
    refundModal.hidden = false;
  }

  function closeRefundModal() {
    refundModal.hidden = true;
  }

  async function handleRefundSubmit() {
    const refundType = document.querySelector(
      'input[name="refundType"]:checked',
    ).value;
    const reason = refundReasonTextarea.value.trim();

    let refundAmount = 0;
    if (refundType === "partial") {
      refundAmount =
        parseFloat(document.getElementById("partialRefundInput").value) || 0;
      if (refundAmount <= 0 || refundAmount > total) {
        alert(
          refundAmount <= 0
            ? "Please enter a valid refund amount"
            : "Refund amount cannot exceed order total",
        );
        return;
      }
    }

    // Get the order ID from the transaction data
    const orderId = transaction.id || transaction.orderData?.id;
    if (!orderId) {
      alert("Cannot process refund: order ID not found");
      return;
    }

    submitRefundBtn.disabled = true;
    submitRefundBtn.textContent = "Processing...";

    try {
      const result = await initiateRefund(
        orderId,
        refundType,
        refundType === "partial" ? refundAmount : 0,
        reason,
      );

      // Close modal
      closeRefundModal();

      // Update the page to show refunded state
      const refundBtn = document.getElementById("initiateRefundBtn");
      if (refundBtn) {
        refundBtn.outerHTML = `<span class="refundedBadgeLarge">Refunded</span>`;
      }

      // Update transaction status badge display
      transaction.status = "Refunded";

      // Show success toast
      showToast(
        `Refund of S$${result.refundAmount.toFixed(2)} processed successfully. Transaction: ${result.refundTransactionId}`,
      );
    } catch (error) {
      console.error("Error processing refund:", error);
      alert(
        "Failed to process refund: " +
          (error.message || error.details?.message || "Unknown error"),
      );
    } finally {
      submitRefundBtn.disabled = false;
      submitRefundBtn.textContent = "Process Refund";
    }
  }

  // Toast notification
  function showToast(message) {
    const existing = document.querySelector(".refundToast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "refundToast";
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  // Initiate refund button
  const initiateRefundBtn = document.getElementById("initiateRefundBtn");
  if (initiateRefundBtn) {
    initiateRefundBtn.addEventListener("click", openRefundModal);
  }

  // Close refund modal
  closeRefundModalBtn.addEventListener("click", closeRefundModal);
  cancelRefundBtn.addEventListener("click", closeRefundModal);

  // Click overlay to close
  refundModal.addEventListener("click", (e) => {
    if (e.target === refundModal) closeRefundModal();
  });

  // Submit refund
  submitRefundBtn.addEventListener("click", handleRefundSubmit);

  // Refund type radio buttons
  document.querySelectorAll('input[name="refundType"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      document.getElementById("refundPartialAmount").hidden =
        radio.value !== "partial";
    });
  });

  // Character count for reason
  refundReasonTextarea.addEventListener("input", () => {
    refundCharCount.textContent = refundReasonTextarea.value.length;
  });

  // Related row click - navigate to that transaction's detail
  container
    .querySelectorAll(".relatedRow[data-related-index]")
    .forEach((row) => {
      row.addEventListener("click", () => {
        const idx = parseInt(row.dataset.relatedIndex, 10);
        const relatedOrder = relatedOrders[idx];
        relatedOrder.date = transaction.date;
        sessionStorage.setItem(
          "selectedTransaction",
          JSON.stringify(relatedOrder),
        );
        window.location.reload();
      });
    });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    // r for refund
    if (e.key === "r" && canRefund) {
      e.preventDefault();
      openRefundModal();
    }
  });

  // Escape to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !refundModal.hidden) {
      closeRefundModal();
    }
  });

  // Auto-open refund modal if navigated from refund selection mode
  const autoOpenRefund = sessionStorage.getItem("autoOpenRefund");
  if (autoOpenRefund) {
    sessionStorage.removeItem("autoOpenRefund");
    if (canRefund) {
      openRefundModal();
    }
  }
});
