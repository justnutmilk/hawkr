import { db, auth } from "../../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const mockStore = {
  name: "Chinese Foods Private Limited",
  tags: ["Chinese", "Halal", "Halal"],
};

const tagIcons = {
  Halal: "../../assets/icons/halal.png",
  Kosher: "../../assets/icons/kosher.svg",
};

const mockHygieneHistory = {
  current: {
    grade: "A",
    updated: "15 Jan 2025",
  },
  archived: [
    { grade: "B", updated: "10 Jun 2023", activeTill: "14 Jan 2025" },
    { grade: "A", updated: "2 Mar 2022", activeTill: "9 Jun 2023" },
    { grade: "C", updated: "18 Sep 2021", activeTill: "1 Mar 2022" },
    { grade: "B", updated: "5 Jan 2020", activeTill: "17 Sep 2021" },
  ],
};

let currentTab = "current";

function renderTag(tag) {
  const icon = tagIcons[tag];
  if (icon) {
    return `<span class="storeTag ${tag.toLowerCase()}"><img class="storeTagIcon" src="${icon}" alt="${tag}" /> ${tag}</span>`;
  }
  return `<span class="storeTag">${tag}</span>`;
}

function renderCurrentGrade() {
  const data = mockHygieneHistory.current;
  if (!data) {
    return `<div class="hygieneEmpty">No hygiene grade on record.</div>`;
  }
  return `
    <div class="hygieneCurrentCard">
      <span class="hygieneGradeLetter">${data.grade}</span>
      <span class="hygieneGradeUpdated">Last updated ${data.updated}</span>
    </div>
  `;
}

function renderArchivedGrades() {
  const items = mockHygieneHistory.archived;
  if (items.length === 0) {
    return `<div class="hygieneEmpty">No archived grades.</div>`;
  }
  return `
    <div class="hygieneArchiveList">
      ${items
        .map(
          (item) => `
        <div class="hygieneArchiveCard">
          <span class="hygieneArchiveGrade">${item.grade}</span>
          <div class="hygieneArchiveInfo">
            <span class="hygieneArchiveDate">Updated ${item.updated}</span>
            <span class="hygieneArchiveActive">Active till ${item.activeTill}</span>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderContent() {
  const container = document.getElementById("hygieneContent");
  container.innerHTML =
    currentTab === "current" ? renderCurrentGrade() : renderArchivedGrades();
}

function renderPage() {
  const store = mockStore;
  const tags = store.tags.map(renderTag).join("");

  document.getElementById("pageContent").innerHTML = `
    <div class="storeHeader">
      <div class="storeHeaderTop">
        <div class="storeHeaderInfo">
          <span class="storePerusing">Now Perusing</span>
          <span class="storeName">${store.name}</span>
        </div>
        <div class="storeTags">${tags}</div>
      </div>
    </div>

    <div class="hygieneSection">
      <div class="hygieneHeader">
        <span class="hygieneTitle">Hygiene Grade</span>
        <div class="segmentedControl hygieneSegmented">
          <label class="segmentedButton">
            <input type="radio" name="hygieneTab" value="current" ${currentTab === "current" ? "checked" : ""} />
            Current
          </label>
          <label class="segmentedButton">
            <input type="radio" name="hygieneTab" value="archived" ${currentTab === "archived" ? "checked" : ""} />
            Archived
          </label>
        </div>
      </div>
      <div class="hygieneMicrocopy">Hygiene grades are verified and can only be updated by the authorities.</div>
      <div id="hygieneContent"></div>
    </div>
  `;

  renderContent();

  document.querySelectorAll('input[name="hygieneTab"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      currentTab = e.target.value;
      renderContent();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Firebase Auth — check onboarding before initialising page
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Check onboarding status
      const operatorDoc = await getDoc(doc(db, "operators", user.uid));
      if (!operatorDoc.exists() || !operatorDoc.data().onboardingComplete) {
        window.location.href = "../Auth/onboarding-operator.html";
        return;
      }

      renderPage();
    } else {
      window.location.href = "../Auth/login.html";
      return;
    }
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
  });
});
