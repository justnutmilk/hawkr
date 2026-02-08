(function () {
    var hamburger = document.querySelector(".sidebarHamburger");
    var overlay = document.querySelector(".sidebarOverlay");
    var sidebar = document.querySelector(".sidebar");
    if (!hamburger || !overlay || !sidebar) return;

    function open() {
        document.body.classList.add("sidebarOpen");
    }

    function close() {
        document.body.classList.remove("sidebarOpen");
    }

    hamburger.addEventListener("click", function () {
        if (document.body.classList.contains("sidebarOpen")) {
            close();
        } else {
            open();
        }
    });

    overlay.addEventListener("click", close);

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && document.body.classList.contains("sidebarOpen")) {
            close();
        }
    });

    // Close sidebar when a nav link is clicked (mobile)
    sidebar.querySelectorAll(".navItem").forEach(function (link) {
        link.addEventListener("click", function () {
            if (window.innerWidth <= 768) {
                close();
            }
        });
    });

    // Close if resized back to desktop
    window.addEventListener("resize", function () {
        if (window.innerWidth > 768) {
            close();
        }
    });
})();
