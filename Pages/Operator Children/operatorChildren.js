const allDaysOpen = [
  { day: "Mon", active: true, slots: [{ from: "08:00", to: "02:00" }] },
  { day: "Tue", active: true, slots: [{ from: "08:00", to: "02:00" }] },
  { day: "Wed", active: true, slots: [{ from: "08:00", to: "02:00" }] },
  { day: "Thu", active: true, slots: [{ from: "08:00", to: "02:00" }] },
  { day: "Fri", active: true, slots: [{ from: "08:00", to: "02:00" }] },
  { day: "Sat", active: true, slots: [{ from: "08:00", to: "02:00" }] },
  { day: "Sun", active: true, slots: [{ from: "08:00", to: "02:00" }] },
];

const alternateDaysSchedule = [
  { day: "Mon", active: true, slots: [{ from: "06:00", to: "14:00" }] },
  { day: "Tue", active: false, slots: [] },
  {
    day: "Wed",
    active: true,
    slots: [
      { from: "10:00", to: "13:00" },
      { from: "15:00", to: "20:00" },
    ],
  },
  { day: "Thu", active: false, slots: [] },
  {
    day: "Fri",
    active: true,
    slots: [
      { from: "06:00", to: "14:00" },
      { from: "14:30", to: "21:59" },
      { from: "00:00", to: "04:30" },
    ],
  },
  { day: "Sat", active: false, slots: [] },
  { day: "Sun", active: false, slots: [] },
];

const fridayOnlySchedule = [
  { day: "Mon", active: false, slots: [] },
  { day: "Tue", active: false, slots: [] },
  { day: "Wed", active: false, slots: [] },
  { day: "Thu", active: false, slots: [] },
  {
    day: "Fri",
    active: true,
    slots: [
      { from: "06:00", to: "14:00" },
      { from: "14:30", to: "21:59" },
      { from: "00:00", to: "04:30" },
    ],
  },
  { day: "Sat", active: false, slots: [] },
  { day: "Sun", active: false, slots: [] },
];

// Converts 24h time string (e.g. "14:30") to 12h format (e.g. "2:30 PM")
function formatTime12h(time24) {
  if (!time24) return ""; // Return empty if no time provided
  const [h, m] = time24.split(":").map(Number); // Split "HH:MM" into hour and minute numbers
  const period = h >= 12 ? "PM" : "AM"; // Determine AM or PM
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; // Convert 0 → 12, 13-23 → 1-11, 1-12 stays
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`; // Format as "H:MM AM/PM"
}

// Formats an array of time slots into a comma-separated string (e.g. "6:00 AM-2:00 PM, 2:30 PM-9:59 PM")
function formatSlots(slots) {
  return slots
    .map((s) => `${formatTime12h(s.from)}-${formatTime12h(s.to)}`) // Format each slot as "from-to"
    .join(", "); // Join multiple slots with commas
}

// Ordered day abbreviations used as indices for range detection
const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Collapses an array of day names into ranges (e.g. ["Mon","Tue","Wed","Fri"] → "Mon-Wed, Fri")
function formatDayRange(days) {
  const indices = days.map((d) => dayNames.indexOf(d)); // Convert day names to numeric indices (0-6)
  const ranges = []; // Accumulator for formatted range strings
  let start = indices[0]; // Start index of the current consecutive run
  let prev = indices[0]; // Previous index in the current run
  for (let i = 1; i <= indices.length; i++) {
    // Iterate through indices (extra iteration to flush last range)
    if (i < indices.length && indices[i] === prev + 1) {
      prev = indices[i]; // Extend the current consecutive run
    } else {
      // Current run has ended — determine how to format it
      if (prev - start >= 2) {
        ranges.push(`${dayNames[start]}-${dayNames[prev]}`); // 3+ consecutive days → dash range (e.g. "Mon-Wed")
      } else if (prev - start === 1) {
        ranges.push(`${dayNames[start]}, ${dayNames[prev]}`); // 2 consecutive days → comma pair (e.g. "Sat, Sun")
      } else {
        ranges.push(dayNames[start]); // Single day (e.g. "Fri")
      }
      if (i < indices.length) {
        start = indices[i]; // Begin a new run from the current index
        prev = indices[i];
      }
    }
  }
  return ranges.join(", "); // Join all ranges with commas (e.g. "Mon-Thu, Sat, Sun")
}

// Groups days by their hours and formats into multi-line summary string
function formatOperatingHours(hours) {
  const groups = {}; // Map of hours-string → array of day names
  const dayOrder = []; // Tracks insertion order of unique hour patterns
  hours.forEach((d) => {
    const key = d.active ? formatSlots(d.slots) : "Closed"; // Use formatted slots as key, or "Closed" if inactive
    if (!groups[key]) {
      groups[key] = []; // Initialize group for this hour pattern
      dayOrder.push(key); // Record first-seen order
    }
    groups[key].push(d.day); // Add the day to its matching group
  });
  const sorted = dayOrder.filter((k) => k !== "Closed"); // All open-day patterns first
  const hasClosed = dayOrder.includes("Closed"); // Check if any days are closed
  if (hasClosed) sorted.push("Closed"); // Push "Closed" to the end
  return sorted
    .map((key) => {
      const days = groups[key]; // Get the days for this hour pattern
      return `${formatDayRange(days)}: ${key}`; // Format as "Mon-Fri: 6:00 AM-2:00 PM"
    })
    .join("\n"); // Join each group as a new line
}

const mockChildren = [
  {
    name: "Chinese Foods Private Limited",
    image: "../../images/squirrelCard.svg",
    tags: ["Chinese"],
    rating: 4.5,
    operatingHours: fridayOnlySchedule,
  },
  {
    name: "Lalithambigai Saravanan KevyTan Cavan Xie Yu Xiang",
    image: "../../images/squirrelCard.svg",
    tags: ["Halal", "Chinese", "Malay"],
    rating: 4.5,
    operatingHours: alternateDaysSchedule,
  },
  {
    name: "Lalithambigai Saravanan KevyTan Cavan Xie Yu Xiang",
    image: "../../images/squirrelCard.svg",
    tags: ["Halal", "Chinese", "Malay"],
    rating: 4.5,
    operatingHours: allDaysOpen,
  },
  {
    name: "Chinese Foods Private Limited",
    image: "../../images/squirrelCard.svg",
    tags: ["Chinese"],
    rating: 4.5,
    operatingHours: alternateDaysSchedule,
  },
  {
    name: "Lalithambigai Saravanan KevyTan Cavan Xie Yu Xiang",
    image: "../../images/squirrelCard.svg",
    tags: ["Halal", "Chinese", "Malay"],
    rating: 4.5,
    operatingHours: allDaysOpen,
  },
  {
    name: "Lalithambigai Saravanan KevyTan Cavan Xie Yu Xiang",
    image: "../../images/squirrelCard.svg",
    tags: ["Halal", "Chinese", "Malay"],
    rating: 4.5,
    operatingHours: alternateDaysSchedule,
  },
];

const tagIcons = {
  Halal: "../../assets/icons/halal.png",
  Kosher: "../../assets/icons/kosher.svg",
};

const starIcon = `<img class="childCardMetaIcon" src="../../assets/icons/star.svg" alt="Rating" />`;
const clockIcon = `<img class="childCardMetaIcon" src="../../assets/icons/clock.svg" alt="Hours" />`;

function renderTag(tag) {
  const icon = tagIcons[tag];
  if (icon) {
    return `<span class="childTag ${tag.toLowerCase()}"><img class="childTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="childTag">${tag}</span>`;
}

function renderHoursLines(hours) {
  return formatOperatingHours(hours)
    .split("\n")
    .map((line) => `<span class="childCardHoursLine">${line}</span>`)
    .join("");
}

function renderChildCard(child) {
  const tags = child.tags.map(renderTag).join("");
  return `
        <button class="childCard" onclick="window.location.href='../Operator Children Detail/operatorChildrenDetail.html?store=${encodeURIComponent(child.name)}'">
            <img class="childCardImage" src="${child.image}" alt="${child.name}" />
            <span class="childCardName">${child.name}</span>
            <div class="childCardTags">${tags}</div>
            <div class="childCardMeta">
                <span class="childCardMetaItem">${starIcon} ${child.rating}</span>
            </div>
            <div class="childCardHours">
                ${clockIcon}
                <div class="childCardHoursLines">${renderHoursLines(child.operatingHours)}</div>
            </div>
        </button>
    `;
}

function renderCurrentContent() {
  return `
        <div class="pageHeader">
            <span class="pageTitle">My Children</span>
            <button class="onboardButton" id="onboardBtn">
                Onboard child
                <kbd id="onboardKeyMod"></kbd>
                <kbd>O</kbd>
            </button>
        </div>
        <div class="childrenGrid">
            ${mockChildren.map(renderChildCard).join("")}
        </div>
    `;
}

function renderArchivedContent() {
  return `
        <div class="pageHeader">
            <span class="pageTitle">My Children</span>
            <button class="onboardButton" id="onboardBtn">
                Onboard child
                <kbd id="onboardKeyMod"></kbd>
                <kbd>O</kbd>
            </button>
        </div>
        <div class="childrenGrid">
        </div>
    `;
}

// Onboard Panel
const loadingIcon = `<svg class="onboardWaitingIcon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none">
  <path d="M7.1825 0.682617V3.28262M7.1825 11.0826V13.6826M2.58699 2.58712L4.4265 4.42662M9.93849 9.93862L11.778 11.7781M0.682495 7.18262H3.2825M11.0825 7.18262H13.6825M2.58699 11.7781L4.4265 9.93862M9.93849 4.42662L11.778 2.58712" stroke="#808080" stroke-width="1.365" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const tickIcon = `<svg class="onboardFileBadgeIcon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">
  <path d="M20 6L9 17L4 12" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const uploadIcon = `<svg class="onboardUploadIcon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 650 650" fill="none">
  <path d="M343.45 8.13067C338.713 2.95067 332.02 0 325 0C317.98 0 311.287 2.95067 306.55 8.13067L173.216 153.964C163.899 164.154 164.607 179.967 174.797 189.284C184.988 198.601 200.801 197.893 210.117 187.703L300 89.3933V458.333C300 472.14 311.193 483.333 325 483.333C338.807 483.333 350 472.14 350 458.333V89.3933L439.883 187.703C449.2 197.893 465.013 198.601 475.203 189.284C485.393 179.967 486.1 164.154 476.783 153.964L343.45 8.13067Z" fill="#808080"/>
  <path d="M50 425C50 411.193 38.8074 400 25 400C11.193 400 1.74651e-05 411.193 1.74651e-05 425V426.83C-0.000649201 472.417 -0.00131822 509.16 3.88401 538.06C7.91801 568.063 16.5477 593.323 36.6117 613.387C56.6757 633.453 81.938 642.083 111.942 646.117C140.841 650 177.585 650 223.171 650H426.83C472.417 650 509.16 650 538.06 646.117C568.063 642.083 593.323 633.453 613.39 613.387C633.453 593.323 642.083 568.063 646.117 538.06C650 509.16 650 472.417 650 426.83V425C650 411.193 638.807 400 625 400C611.193 400 600 411.193 600 425C600 472.847 599.947 506.217 596.563 531.397C593.273 555.857 587.26 568.807 578.033 578.033C568.807 587.26 555.857 593.273 531.397 596.563C506.217 599.947 472.847 600 425 600H225C177.153 600 143.782 599.947 118.604 596.563C94.145 593.273 81.1923 587.26 71.967 578.033C62.7417 568.807 56.7267 555.857 53.4383 531.397C50.053 506.217 50 472.847 50 425Z" fill="#808080"/>
</svg>`;

const filePreviewUrls = {};

function renderCertField(certValue, fieldKey) {
  if (certValue) {
    const previewUrl = filePreviewUrls[fieldKey];
    return `<div class="onboardFilePreview">
      <div class="onboardFilePreviewBox">
        ${previewUrl ? `<iframe class="onboardPdfPreview" src="${previewUrl}"></iframe>` : `<div class="onboardPdfPlaceholder"><span class="onboardPdfPlaceholderText">PDF</span></div>`}
        <button class="onboardFileDelete" data-field="${fieldKey}"><img src="../../assets/icons/delete.svg" alt="Delete" class="onboardFileDeleteIcon" /></button>
      </div>
      <span class="onboardFileBadge">${tickIcon} ${certValue}</span>
    </div>`;
  }
  return `
    <span class="onboardFieldMicrocopy">PDF under 2MB.</span>
    <label class="onboardUploadBtn" data-field="${fieldKey}">
      ${uploadIcon}
      <span class="onboardUploadText">Upload</span>
      <input class="onboardUploadInput" type="file" accept=".pdf" data-field="${fieldKey}" />
    </label>
  `;
}

function renderPhotoField(photoValue) {
  if (photoValue) {
    const previewUrl = filePreviewUrls["coverPhoto"];
    return `<div class="onboardFilePreview">
      <div class="onboardFilePreviewBox">
        ${previewUrl ? `<img class="onboardImagePreview" src="${previewUrl}" alt="Cover photo" />` : `<div class="onboardPdfPlaceholder"><span class="onboardPdfPlaceholderText">IMG</span></div>`}
        <button class="onboardFileDelete" data-field="coverPhoto"><img src="../../assets/icons/delete.svg" alt="Delete" class="onboardFileDeleteIcon" /></button>
      </div>
      <span class="onboardFileBadge">${tickIcon} ${photoValue}</span>
    </div>`;
  }
  return `
    <span class="onboardFieldMicrocopy">JPEG, PNG, or WEBP under 2MB.</span>
    <label class="onboardUploadBtn" data-field="coverPhoto">
      <img src="../../assets/icons/uploadPhoto.svg" alt="Upload" class="onboardUploadIcon" />
      <span class="onboardUploadText">Upload</span>
      <input class="onboardUploadInput" type="file" accept="image/jpeg,image/png,image/webp" data-field="coverPhoto" />
    </label>
  `;
}

function refreshPhotoField() {
  const container = document.querySelector(
    '.onboardField[data-cert="coverPhoto"]',
  );
  if (!container) return;
  const label = container.querySelector(".onboardFieldLabel");
  container.innerHTML = "";
  container.appendChild(label);
  container.insertAdjacentHTML(
    "beforeend",
    renderPhotoField(mockVendorData.coverPhoto),
  );
  bindCertUploads();
}

function refreshCertField(fieldKey) {
  const container = document.querySelector(
    `.onboardField[data-cert="${fieldKey}"]`,
  );
  if (!container) return;
  const label = container.querySelector(".onboardFieldLabel");
  container.innerHTML = "";
  container.appendChild(label);
  container.insertAdjacentHTML(
    "beforeend",
    renderCertField(mockVendorData[fieldKey], fieldKey),
  );
  bindCertUploads();
}

function bindCertUploads() {
  document.querySelectorAll(".onboardUploadInput").forEach((input) => {
    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fieldKey = e.target.dataset.field;
      mockVendorData[fieldKey] = file.name;
      if (filePreviewUrls[fieldKey])
        URL.revokeObjectURL(filePreviewUrls[fieldKey]);
      filePreviewUrls[fieldKey] = URL.createObjectURL(file);
      if (fieldKey === "coverPhoto") {
        refreshPhotoField();
      } else {
        refreshCertField(fieldKey);
      }
    });
  });
  document.querySelectorAll(".onboardFileDelete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fieldKey = btn.dataset.field;
      mockVendorData[fieldKey] = null;
      if (filePreviewUrls[fieldKey]) {
        URL.revokeObjectURL(filePreviewUrls[fieldKey]);
        delete filePreviewUrls[fieldKey];
      }
      if (fieldKey === "coverPhoto") {
        refreshPhotoField();
      } else {
        refreshCertField(fieldKey);
      }
    });
  });
}

let currentOnboardCode = "";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const mockVendorData = {
  storeName: "Ah Huat Kopi & Toast",
  unitNumber: "#01-42",
  cuisines: ["Chinese", "Halal"],
  operatingHours: [
    { day: "Mon", active: true, slots: [{ from: "06:00", to: "14:00" }] },
    { day: "Tue", active: true, slots: [{ from: "06:00", to: "14:00" }] },
    {
      day: "Wed",
      active: true,
      slots: [
        { from: "10:00", to: "13:00" },
        { from: "15:00", to: "20:00" },
      ],
    },
    { day: "Thu", active: false, slots: [] },
    { day: "Fri", active: true, slots: [{ from: "06:00", to: "14:00" }] },
    { day: "Sat", active: true, slots: [{ from: "06:00", to: "14:00" }] },
    { day: "Sun", active: true, slots: [{ from: "06:00", to: "14:00" }] },
  ],
  coverPhoto: null,
  hygieneCert: "hygiene_cert_2025.pdf",
  halalCert: null,
  bizRegNo: "202401234K",
  contactPerson: "Tan Ah Huat",
  contactNumber: "+65 9123 4567",
};

let scheduleData = [];

function renderScheduleSlot(dayIdx, slotIdx, slot, showRemove) {
  return `
    <div class="onboardScheduleSlot">
      <input class="onboardScheduleTime" type="time" value="${slot.from}" data-day="${dayIdx}" data-slot="${slotIdx}" data-field="from" />
      <span class="onboardScheduleTo">to</span>
      <input class="onboardScheduleTime" type="time" value="${slot.to}" data-day="${dayIdx}" data-slot="${slotIdx}" data-field="to" />
      ${showRemove ? `<button class="onboardScheduleRemoveSlot" data-day="${dayIdx}" data-slot="${slotIdx}">&times;</button>` : ""}
    </div>
  `;
}

function renderScheduleRow(dayData, dayIdx) {
  const slotsHtml =
    dayData.active && dayData.slots.length
      ? dayData.slots
          .map((slot, si) => renderScheduleSlot(dayIdx, si, slot, si > 0))
          .join("")
      : `<span class="onboardScheduleClosed">Closed</span>`;

  return `
    <div class="onboardScheduleRow">
      <span class="onboardScheduleDay">${dayData.day}</span>
      <label class="onboardScheduleToggleLabel">
        <input class="onboardScheduleToggleInput" type="checkbox" ${dayData.active ? "checked" : ""} data-day="${dayIdx}" />
        <span class="onboardScheduleToggle"></span>
      </label>
      <div class="onboardScheduleSlots">
        ${slotsHtml}
      </div>
      ${dayData.active ? `<button class="onboardScheduleAddSlot" data-day="${dayIdx}">+ Add</button>` : ""}
    </div>
  `;
}

function renderSchedule() {
  return `
    <div class="onboardSchedule" id="onboardSchedule">
      ${scheduleData.map((d, i) => renderScheduleRow(d, i)).join("")}
    </div>
  `;
}

function bindSchedule() {
  const container = document.getElementById("onboardSchedule");
  if (!container) return;

  container.addEventListener("change", (e) => {
    if (e.target.classList.contains("onboardScheduleToggleInput")) {
      const dayIdx = parseInt(e.target.dataset.day);
      scheduleData[dayIdx].active = e.target.checked;
      if (e.target.checked && scheduleData[dayIdx].slots.length === 0) {
        scheduleData[dayIdx].slots.push({ from: "09:00", to: "17:00" });
      }
      refreshSchedule();
    }
    if (e.target.classList.contains("onboardScheduleTime")) {
      const { day, slot, field } = e.target.dataset;
      scheduleData[parseInt(day)].slots[parseInt(slot)][field] = e.target.value;
    }
  });

  container.addEventListener("click", (e) => {
    const addBtn = e.target.closest(".onboardScheduleAddSlot");
    if (addBtn) {
      const dayIdx = parseInt(addBtn.dataset.day);
      scheduleData[dayIdx].slots.push({ from: "", to: "" });
      refreshSchedule();
    }
    const removeBtn = e.target.closest(".onboardScheduleRemoveSlot");
    if (removeBtn) {
      const dayIdx = parseInt(removeBtn.dataset.day);
      const slotIdx = parseInt(removeBtn.dataset.slot);
      scheduleData[dayIdx].slots.splice(slotIdx, 1);
      refreshSchedule();
    }
  });
}

function refreshSchedule() {
  const container = document.getElementById("onboardSchedule");
  if (container) {
    container.innerHTML = scheduleData
      .map((d, i) => renderScheduleRow(d, i))
      .join("");
  }
}

function renderOnboardTag(tag) {
  const icon = tagIcons[tag];
  if (icon) {
    return `<span class="childTag ${tag.toLowerCase()}"><img class="childTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="childTag">${tag}</span>`;
}

function renderCodeState() {
  document.getElementById("onboardBody").innerHTML = `
    <div class="onboardCodeSection">
      <span class="onboardCode"><span class="onboardCodePrefix">OBD-</span>${currentOnboardCode}</span>
      <span class="onboardCodeSubtitle">Share this code with the vendor. They can enter it in their Settings to begin onboarding.</span>
      <button class="onboardCopyBtn" id="copyCodeBtn">Copy code</button>
      <span class="onboardWaiting">${loadingIcon} Waiting for vendor...</span>
      <button class="onboardSimulateBtn" id="simulateBtn">Simulate vendor link</button>
    </div>
  `;
  document.getElementById("onboardFooter").innerHTML = `
    <button class="onboardCancelBtn" id="onboardCancelBtn">Cancel</button>
  `;
  document.getElementById("copyCodeBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(`OBD-${currentOnboardCode}`);
    document.getElementById("copyCodeBtn").textContent = "Copied!";
    setTimeout(() => {
      const btn = document.getElementById("copyCodeBtn");
      if (btn) btn.textContent = "Copy code";
    }, 2000);
  });
  document
    .getElementById("simulateBtn")
    .addEventListener("click", renderLinkedState);
  document
    .getElementById("onboardCancelBtn")
    .addEventListener("click", closeOnboardPanel);
}

function renderLinkedState() {
  const v = mockVendorData;
  scheduleData = JSON.parse(JSON.stringify(v.operatingHours));
  document.getElementById("onboardBody").innerHTML = `
    <div class="onboardFields">
      <div class="onboardField">
        <label class="onboardFieldLabel" for="onboardStoreName">Store Name</label>
        <span class="onboardFieldMicrocopy">Enter your ACRA-registered business name — we'll use this for verification and records.</span>
        <input class="onboardFieldInput" id="onboardStoreName" type="text" value="${v.storeName}" />
      </div>
      <div class="onboardField">
        <label class="onboardFieldLabel" for="onboardUnitNo">Unit Number</label>
        <input class="onboardFieldInput" id="onboardUnitNo" type="text" value="${v.unitNumber}" />
      </div>
      <div class="onboardField">
        <label class="onboardFieldLabel" for="onboardCuisineInput">Cuisines Served</label>
        <div class="onboardCuisineContainer" id="onboardCuisineContainer">
          ${v.cuisines.map((c) => `<span class="onboardCuisineTag ${c.toLowerCase()}" data-cuisine="${c}">${renderOnboardTag(c)}<button class="onboardCuisineRemove" data-cuisine="${c}">&times;</button></span>`).join("")}
          <input class="onboardCuisineInput" id="onboardCuisineInput" type="text" placeholder="Add cuisine..." />
        </div>
      </div>
      <div class="onboardField">
        <label class="onboardFieldLabel">Operating Hours</label>
        ${renderSchedule()}
      </div>
      <div class="onboardField" data-cert="coverPhoto">
        <label class="onboardFieldLabel">Cover Photo</label>
        ${renderPhotoField(v.coverPhoto)}
      </div>
      <div class="onboardField" data-cert="hygieneCert">
        <label class="onboardFieldLabel">Hygiene Certificate</label>
        ${renderCertField(v.hygieneCert, "hygieneCert")}
      </div>
      <div class="onboardField" data-cert="halalCert">
        <label class="onboardFieldLabel">Halal Certification</label>
        ${renderCertField(v.halalCert, "halalCert")}
      </div>
      <div class="onboardField">
        <label class="onboardFieldLabel" for="onboardBizReg">UEN</label>
        <input class="onboardFieldInput" id="onboardBizReg" type="text" value="${v.bizRegNo}" />
      </div>
      <div class="onboardField">
        <label class="onboardFieldLabel" for="onboardContact">Contact Person</label>
        <input class="onboardFieldInput" id="onboardContact" type="text" value="${v.contactPerson}" />
      </div>
      <div class="onboardField">
        <label class="onboardFieldLabel" for="onboardPhone">Contact Number</label>
        <input class="onboardFieldInput" id="onboardPhone" type="tel" value="${v.contactNumber}" />
      </div>
    </div>
  `;
  document.getElementById("onboardFooter").innerHTML = `
    <button class="onboardRejectBtn" id="onboardRejectBtn">Reject</button>
    <button class="onboardApproveBtn" id="onboardApproveBtn">Approve Onboarding</button>
  `;
  document
    .getElementById("onboardRejectBtn")
    .addEventListener("click", closeOnboardPanel);
  document
    .getElementById("onboardApproveBtn")
    .addEventListener("click", closeOnboardPanel);

  bindCuisineInput();
  bindSchedule();
  bindCertUploads();
}

function bindCuisineInput() {
  const container = document.getElementById("onboardCuisineContainer");
  const input = document.getElementById("onboardCuisineInput");

  container.addEventListener("click", (e) => {
    const removeBtn = e.target.closest(".onboardCuisineRemove");
    if (removeBtn) {
      removeBtn.closest(".onboardCuisineTag").remove();
    } else {
      input.focus();
    }
  });

  input.addEventListener("keydown", (e) => {
    const val = input.value.trim();
    if (e.key === "Enter" && val) {
      e.preventDefault();
      addCuisineTag(val);
      input.value = "";
    }
    if (e.key === "Backspace" && !val) {
      const tags = container.querySelectorAll(".onboardCuisineTag");
      if (tags.length) tags[tags.length - 1].remove();
    }
  });
}

function addCuisineTag(cuisine) {
  const container = document.getElementById("onboardCuisineContainer");
  const input = document.getElementById("onboardCuisineInput");
  const capitalized =
    cuisine.charAt(0).toUpperCase() + cuisine.slice(1).toLowerCase();
  const tag = document.createElement("span");
  tag.className = `onboardCuisineTag ${capitalized.toLowerCase()}`;
  tag.dataset.cuisine = capitalized;
  tag.innerHTML = `${renderOnboardTag(capitalized)}<button class="onboardCuisineRemove" data-cuisine="${capitalized}">&times;</button>`;
  container.insertBefore(tag, input);
}

function openOnboardPanel() {
  currentOnboardCode = generateCode();
  renderCodeState();
  document.getElementById("onboardOverlay").classList.add("active");
  document.getElementById("onboardPanel").classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeOnboardPanel() {
  document.getElementById("onboardOverlay").classList.remove("active");
  document.getElementById("onboardPanel").classList.remove("active");
  document.body.style.overflow = "";
}

function renderPage(tab) {
  const container = document.getElementById("pageContent");
  container.innerHTML =
    tab === "archived" ? renderArchivedContent() : renderCurrentContent();

  const isMacLocal = window.navigator.userAgentData
    ? window.navigator.userAgentData.platform === "macOS"
    : /Mac/i.test(window.navigator.userAgent);
  const modKey = document.getElementById("onboardKeyMod");
  if (modKey) {
    modKey.textContent = isMacLocal ? "\u2318" : "CTRL";
  }
  const onboardBtn = document.getElementById("onboardBtn");
  if (onboardBtn) {
    onboardBtn.addEventListener("click", openOnboardPanel);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderPage("current");

  document.querySelectorAll('input[name="childrenTab"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      renderPage(radio.value);
    });
  });

  const isMac = window.navigator.userAgentData
    ? window.navigator.userAgentData.platform === "macOS"
    : /Mac/i.test(window.navigator.userAgent);

  document.getElementById("searchKeyMod").textContent = isMac
    ? "\u2318"
    : "CTRL";

  document.addEventListener("keydown", (e) => {
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    if (modifier && e.key === "k") {
      e.preventDefault();
      document.getElementById("searchInput").focus();
    }
    if (modifier && e.key === "o") {
      e.preventDefault();
      openOnboardPanel();
    }
  });

  document
    .getElementById("onboardOverlay")
    .addEventListener("click", closeOnboardPanel);
  document
    .getElementById("onboardClose")
    .addEventListener("click", closeOnboardPanel);
});
