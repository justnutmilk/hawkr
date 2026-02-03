document.addEventListener("DOMContentLoaded", () => {
  // Search key modifier
  const isMac =
    navigator.platform.toUpperCase().indexOf("MAC") >= 0 ||
    navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
  document.getElementById("searchKeyMod").textContent = isMac
    ? "\u2318"
    : "CTRL";

  // Ctrl/Cmd+K focus search
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      document.getElementById("searchInput").focus();
    }
  });

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

      return `
            <div class="orderItem">
                <div class="orderItemImage"></div>
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

  // Build related orders HTML
  let relatedHtml = "";
  if (relatedOrders.length > 0) {
    const rows = relatedOrders
      .map((relatedOrder, i) => {
        const relatedOrderLogos = relatedOrder.logos
          .map((l) => `<img src="${pmBase}${l}" alt="">`)
          .join("");
        return `
                <div class="relatedRow" data-related-index="${i}" style="cursor:pointer;">
                    <div class="transactionCell transactionCellAmount">
                        <span class="paymentAmount">S$${relatedOrder.amount.toFixed(2)}</span>
                        <span class="transactionBadge successful"><img src="${iconsBase}successful.svg" alt="">Successful</span>
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

  container.innerHTML = `
        <!-- Header -->
        <div class="detailHeader">
            <div class="detailHeaderLeft">
                <span class="nowPerusing">Now Perusing</span>
                <span class="transactionIdDisplay">${transaction.txnId}</span>
            </div>
            <button class="initiateRefund">
                Initiate Refund
                <kbd class="buttonKeyboard">r</kbd>
            </button>
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

  // Related row click — navigate to that transaction's detail
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

  // Keyboard shortcut: r for refund
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "r") {
      e.preventDefault();
      // Placeholder
    }
  });
});
