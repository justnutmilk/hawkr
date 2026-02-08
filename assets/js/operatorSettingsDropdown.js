// ============================================
// Operator Settings Dropdown — Liquid Glass
// Hover on settings icon shows dropdown with
// Settings link + Logout button.
// ============================================

import { auth } from "../../firebase/config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

function initSettingsDropdown() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        window.location.href = "../../index.html";
      } catch (error) {
        console.error("Logout error:", error);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", initSettingsDropdown);
