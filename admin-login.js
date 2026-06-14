(function () {
    const SESSION_KEY = "sifatli_admin_session";
    const PWD_KEY = "sifatli_admin_pwd";
    const DEFAULT_PWD = (window.APP_CONFIG && window.APP_CONFIG.defaultAdminPassword) || "2014";
    const SESSION_HOURS = (window.APP_CONFIG && window.APP_CONFIG.adminSessionHours) || 8;

    function getStoredPassword() {
        return localStorage.getItem(PWD_KEY) || DEFAULT_PWD;
    }

    function setSession() {
        const until = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ until: until }));
    }

    function hasSession() {
        try {
            var raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return false;
            var data = JSON.parse(raw);
            if (!data || !data.until || Date.now() > data.until) {
                sessionStorage.removeItem(SESSION_KEY);
                return false;
            }
            return true;
        } catch (e) {
            sessionStorage.removeItem(SESSION_KEY);
            return false;
        }
    }

    function clearSession() {
        sessionStorage.removeItem(SESSION_KEY);
    }

    function openModalById(id) {
        var modal = document.getElementById(id);
        if (!modal) return false;
        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
        return true;
    }

    function closeModalEl(modal) {
        if (!modal) return;
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        var anyModal = document.querySelector(".modal-overlay.show");
        var dash = document.getElementById("adminDashboard");
        var dashOpen = dash && dash.classList.contains("show");
        if (!anyModal && !dashOpen) {
            document.body.classList.remove("modal-open");
        }
    }

    var SECTION_TITLES = {
        stats: { title: "Statistika", desc: "Do'kon ko'rsatkichlari va umumiy holat" },
        products: { title: "Mahsulotlar", desc: "Mahsulotlarni qo'shing, tahrirlang va boshqaring" },
        orders: { title: "Zakazlar", desc: "Kelgan zakazlarni kuzating va boshqaring" }
    };

    function switchAdminSection(sectionName) {
        document.querySelectorAll(".admin-section").forEach(function (section) {
            section.classList.toggle("active", section.dataset.section === sectionName);
        });

        document.querySelectorAll(".sidebar-link").forEach(function (link) {
            link.classList.toggle("active", link.dataset.adminSection === sectionName);
        });

        var meta = SECTION_TITLES[sectionName];
        if (meta) {
            var titleEl = document.getElementById("adminPageTitle");
            var descEl = document.getElementById("adminPageDesc");
            if (titleEl) titleEl.textContent = meta.title;
            if (descEl) descEl.textContent = meta.desc;
        }

        var sidebar = document.getElementById("adminSidebar");
        if (sidebar) sidebar.classList.remove("open");
        if (typeof window.closeAdminSidebar === "function") {
            window.closeAdminSidebar();
        }
    }

    function showSimpleToast(message, type) {
        if (typeof window.showToast === "function") {
            window.showToast(message, type || "info");
            return;
        }

        var container = document.getElementById("toastContainer");
        if (!container) return;

        var toast = document.createElement("div");
        toast.className = "toast " + (type || "info");
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(function () {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(18px)";
            toast.style.transition = "opacity 180ms ease, transform 180ms ease";
        }, 2600);

        setTimeout(function () {
            toast.remove();
        }, 2850);
    }

    function openPasswordModal() {
        var form = document.getElementById("passwordForm");
        var error = document.getElementById("passwordFormError");

        if (form) form.reset();
        if (error) error.textContent = "";

        if (openModalById("passwordModal")) {
            setTimeout(function () {
                var input = document.getElementById("currentPassword");
                if (input) input.focus();
            }, 120);
        }
    }

    function changeAdminPassword(event) {
        event.preventDefault();

        var currentEl = document.getElementById("currentPassword");
        var nextEl = document.getElementById("newPassword");
        var confirmEl = document.getElementById("confirmPassword");
        var errorEl = document.getElementById("passwordFormError");

        var current = currentEl ? currentEl.value.trim() : "";
        var next = nextEl ? nextEl.value.trim() : "";
        var confirm = confirmEl ? confirmEl.value.trim() : "";
        var stored = getStoredPassword();

        if (!current || !next || !confirm) {
            if (errorEl) errorEl.textContent = "Barcha maydonlarni to'ldiring";
            showSimpleToast("Barcha maydonlarni to'ldiring", "error");
            return;
        }

        if (current !== stored && current !== DEFAULT_PWD) {
            if (errorEl) errorEl.textContent = "Joriy parol noto'g'ri";
            showSimpleToast("Joriy parol noto'g'ri", "error");
            return;
        }

        if (next.length < 4) {
            if (errorEl) errorEl.textContent = "Yangi parol kamida 4 ta belgi bo'lishi kerak";
            showSimpleToast("Parol juda qisqa", "error");
            return;
        }

        if (next !== confirm) {
            if (errorEl) errorEl.textContent = "Yangi parollar mos kelmadi";
            showSimpleToast("Parollar mos kelmadi", "error");
            return;
        }

        if (next === current) {
            if (errorEl) errorEl.textContent = "Yangi parol joriydan farq qilishi kerak";
            showSimpleToast("Yangi parol bir xil", "error");
            return;
        }

        localStorage.setItem(PWD_KEY, next);
        if (errorEl) errorEl.textContent = "";
        closeModalEl(document.getElementById("passwordModal"));
        showSimpleToast("Parol muvaffaqiyatli yangilandi", "success");
        window.dispatchEvent(new CustomEvent("admin:password-changed", { detail: { password: next } }));
    }

    function runWhenAppReady(run, apiName) {
        apiName = apiName || "addProduct";

        if (typeof window[apiName] === "function") {
            run();
            return;
        }

        var finished = false;

        function attempt() {
            if (finished) return;
            if (typeof window[apiName] === "function") {
                finished = true;
                run();
            }
        }

        window.addEventListener("app:ready", attempt, { once: true });

        var tries = 0;
        var timer = setInterval(function () {
            tries += 1;
            attempt();
            if (finished || tries >= 40) {
                clearInterval(timer);
                if (!finished) {
                    showSimpleToast("Sayt to'liq yuklanmadi. Terminalda: npm run dev", "error");
                }
            }
        }, 200);
    }

    function handleAddProductClick(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        runWhenAppReady(function () {
            window.addProduct(event);
        });

        return false;
    }

    function handleProductFormSubmit(event) {
        event.preventDefault();
        event.stopPropagation();

        runWhenAppReady(function () {
            window.addProduct(event);
        });

        return false;
    }

    function handleEditFormSubmit(event) {
        event.preventDefault();
        event.stopPropagation();

        runWhenAppReady(function () {
            window.updateProduct(event);
        }, "updateProduct");

        return false;
    }

    function openDashboard() {
        var dash = document.getElementById("adminDashboard");
        if (!dash) {
            console.error("Admin dashboard topilmadi");
            return false;
        }
        dash.classList.add("show");
        dash.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
        switchAdminSection("products");
        window.dispatchEvent(new CustomEvent("admin:opened"));
        return true;
    }

    function closeDashboard() {
        var dash = document.getElementById("adminDashboard");
        if (dash) {
            dash.classList.remove("show");
            dash.setAttribute("aria-hidden", "true");
        }
        if (typeof window.closeAdminSidebar === "function") {
            window.closeAdminSidebar();
        }
        clearSession();
        var anyModal = document.querySelector(".modal-overlay.show");
        if (!anyModal) {
            document.body.classList.remove("modal-open");
        }
    }

    function isPasswordValid(value) {
        var input = (value || "").trim();
        var stored = getStoredPassword();
        return input === stored || input === DEFAULT_PWD;
    }

    function openAdminLogin() {
        if (hasSession()) {
            openDashboard();
            return;
        }

        var error = document.getElementById("loginError");
        var input = document.getElementById("adminPassword");

        if (error) error.textContent = "";
        if (input) input.value = "";

        if (openModalById("loginModal")) {
            setTimeout(function () {
                if (input) input.focus();
            }, 100);
        }
    }

    function checkLogin(event) {
        event.preventDefault();

        var input = document.getElementById("adminPassword");
        var error = document.getElementById("loginError");
        var value = input ? input.value : "";

        if (!isPasswordValid(value)) {
            if (error) {
                error.textContent = "Parol noto'g'ri. Standart parol: " + DEFAULT_PWD;
            }
            return;
        }

        if (error) error.textContent = "";
        closeModalEl(document.getElementById("loginModal"));
        setSession();
        openDashboard();
        window.dispatchEvent(new CustomEvent("admin:loggedin"));
    }

    function wire() {
        var loginBtn = document.getElementById("adminLoginBtn");
        var heroBtn = document.getElementById("heroAdminBtn");
        var loginForm = document.getElementById("loginForm");
        var logoutBtn = document.getElementById("logoutAdminBtn");
        var changePwdBtn = document.getElementById("changePasswordBtn");
        var passwordForm = document.getElementById("passwordForm");
        var productForm = document.getElementById("productForm");
        var editForm = document.getElementById("editForm");

        if (productForm) {
            productForm.addEventListener("submit", handleProductFormSubmit);
        }

        var addProductBtn = document.getElementById("addProductBtn");
        if (addProductBtn) {
            addProductBtn.addEventListener("click", handleAddProductClick);
        }

        if (editForm) {
            editForm.addEventListener("submit", handleEditFormSubmit);
        }

        if (changePwdBtn) {
            changePwdBtn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                openPasswordModal();
            });
        }

        if (passwordForm) {
            passwordForm.addEventListener("submit", changeAdminPassword);
        }

        if (loginBtn) {
            loginBtn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                openAdminLogin();
            });
        }

        if (heroBtn) {
            heroBtn.addEventListener("click", function (e) {
                e.preventDefault();
                openAdminLogin();
            });
        }

        if (loginForm) {
            loginForm.addEventListener("submit", checkLogin);
        }

        if (logoutBtn) {
            logoutBtn.addEventListener("click", function () {
                closeDashboard();
                window.dispatchEvent(new CustomEvent("admin:closed"));
            });
        }

        document.querySelectorAll("[data-admin-section]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                switchAdminSection(btn.dataset.adminSection);
            });
        });

        document.querySelectorAll("[data-close-modal]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var overlay = btn.closest(".modal-overlay");
                if (!overlay) return;

                if (overlay.id === "loginModal") {
                    closeModalEl(overlay);
                    return;
                }

                if (overlay.id === "editModal" && typeof window.cancelEditProduct === "function") {
                    window.cancelEditProduct();
                    return;
                }

                closeModalEl(overlay);
            });
        });
    }

    window.openAdminLogin = openAdminLogin;
    window.openAdminDashboard = openDashboard;
    window.closeAdminDashboard = closeDashboard;
    window.switchAdminSection = switchAdminSection;
    window.openPasswordModal = openPasswordModal;
    window.changeAdminPassword = changeAdminPassword;
    window.isAdminPasswordValid = isPasswordValid;
    window.getAdminPassword = getStoredPassword;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", wire);
    } else {
        wire();
    }
})();
