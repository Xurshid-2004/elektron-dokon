(function () {
    function openAdminLogin() {
        var modal = document.getElementById("loginModal");
        var input = document.getElementById("adminPassword");
        var error = document.getElementById("loginError");

        if (!modal) {
            console.error("Login modal topilmadi");
            return;
        }

        if (error) error.textContent = "";
        if (input) input.value = "";

        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");

        setTimeout(function () {
            if (input) input.focus();
        }, 120);
    }

    function wire() {
        var loginBtn = document.getElementById("adminLoginBtn");
        var heroBtn = document.getElementById("heroAdminBtn");

        if (loginBtn) {
            loginBtn.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                openAdminLogin();
            });
        }

        if (heroBtn) {
            heroBtn.addEventListener("click", function (event) {
                event.preventDefault();
                openAdminLogin();
            });
        }
    }

    window.openAdminLogin = openAdminLogin;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", wire);
    } else {
        wire();
    }
})();
