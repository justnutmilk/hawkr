document.addEventListener("DOMContentLoaded", function (event) {
  var dataText = [
    "makes ordering faster,\nclearer, and queue-light",
    "connects customers,\nstalls, and ops",
    "runs stalls, centres, and\ninspections end to end.",
  ];

  // type one text in the typwriter
  // keeps calling itself until the text is finished
  function typeWriter(text, i, fnCallback) {
    // chekc if text isn't finished yet
    if (i < text.length) {
      // add next character to h1
      document.querySelector("h1").innerHTML =
        text.substring(0, i + 1) + '<span aria-hidden="true"></span>';

      // wait for a while and call this function again for next character
      setTimeout(function () {
        typeWriter(text, i + 1, fnCallback);
      }, 50);
    }
    // text finished, call callback if there is a callback function
    else if (typeof fnCallback == "function") {
      // call callback after timeout
      setTimeout(fnCallback, 6000);
    }
  }
  // start a typewriter animation for a text in the dataText array
  function StartTextAnimation(i) {
    if (typeof dataText[i] == "undefined") {
      setTimeout(function () {
        StartTextAnimation(0);
      }, 500);
    }
    // check if dataText[i] exists
    if (i < dataText[i].length) {
      // text exists! start typewriter animation
      typeWriter(dataText[i], 0, function () {
        // after callback (and whole text has been animated), start next text
        StartTextAnimation(i + 1);
      });
    }
  }
  // start the text animation
  StartTextAnimation(0);

  // ============================================
  // PRODUCT SUITE — MODULE TAB SWITCHER
  // ============================================
  document.querySelectorAll(".moduleTab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var module = tab.dataset.module;

      // Update active tab
      document.querySelectorAll(".moduleTab").forEach(function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");

      // Swap animation panel — clone and replace to restart CSS animations
      document.querySelectorAll(".moduleAnimation").forEach(function (anim) {
        anim.classList.remove("active");
      });
      var target = document.querySelector(
        '.moduleAnimation[data-module="' + module + '"]',
      );
      if (target) {
        var clone = target.cloneNode(true);
        clone.classList.add("active");
        target.parentNode.replaceChild(clone, target);
      }
    });
  });

  // ============================================
  // SOLUTIONS — ROLE TAB SWITCHER
  // ============================================
  document.querySelectorAll(".solutionTab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var role = tab.dataset.role;

      // Update active tab
      document.querySelectorAll(".solutionTab").forEach(function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");

      // Swap panel
      document.querySelectorAll(".solutionPanel").forEach(function (p) {
        p.classList.remove("active");
      });
      var panel = document.querySelector(
        '.solutionPanel[data-role="' + role + '"]',
      );
      if (panel) panel.classList.add("active");
    });
  });
});
