import { initVendorNavbar } from "../../assets/js/vendorNavbar.js";
import { initiateRefund } from "../../firebase/services/stripe.js";

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

  const total = transaction.items.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );

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

  const ordersHtml =
    relatedOrders.length > 0
      ? relatedHtml
      : '<span class="noRelated">No related orders</span>';

  const instancesHtml = transaction.review
    ? reviewHtml
    : '<span class="noRelated">No related instances</span>';

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
        </div>

        <!-- Related Orders/Instances -->
        <div class="relatedOrdersInstances">
            <h2 class="sectionTitle dark">Related Orders/Instances</h2>
            ${ordersHtml}
            ${instancesHtml}
        </div>
    `;

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
