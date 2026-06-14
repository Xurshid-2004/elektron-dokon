const APP = window.APP_CONFIG || {};
const firebaseConfig = APP.firebase || {
    apiKey: "AIzaSyAWMPGeFwGhMj4veAGxd3NCiMzqLge-p7k",
    authDomain: "sardorapp-6fdf3.firebaseapp.com",
    projectId: "sardorapp-6fdf3",
    storageBucket: "sardorapp-6fdf3.firebasestorage.app",
    messagingSenderId: "261540820256",
    appId: "1:261540820256:web:4397a07ad9a5801c14d345"
};

const IS_PROD = APP.env === "production";
const DEFAULT_ADMIN_PASSWORD = APP.defaultAdminPassword || "2014";
const ADMIN_SESSION_KEY = "sifatli_admin_session";
const ADMIN_PWD_KEY = "sifatli_admin_pwd";
const SESSION_HOURS = APP.adminSessionHours || 8;

let adminPassword = localStorage.getItem(ADMIN_PWD_KEY) || DEFAULT_ADMIN_PASSWORD;

let fb = null;
let db = null;
let firebaseApp = null;
let firebaseReady = false;
let pendingProductImageFile = null;
let pendingEditImageFile = null;
let pendingProductImageDataUrl = null;
let pendingEditImageDataUrl = null;
const MAX_IMAGE_BYTES = 680 * 1024;
const MAX_IMAGE_DATA_URL_CHARS = 890000;
let products = [];
let orders = [];
let selectedProductId = null;
let editingProductId = null;
let deleteTarget = null;
let productSearch = "";
let categoryFilter = "all";
let elements = {};

const SECTION_TITLES = {
    stats: { title: "Statistika", desc: "Do'kon ko'rsatkichlari va umumiy holat" },
    products: { title: "Mahsulotlar", desc: "Mahsulotlarni qo'shing, tahrirlang va boshqaring" },
    orders: { title: "Zakazlar", desc: "Kelgan zakazlarni kuzating va boshqaring" }
};

function bootAdminTriggers() {
    // admin-login.js asosiy handler — bu yerda qayta bog'lamaymiz
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}

function boot() {
    try {
        cacheElements();
    } catch (error) {
        console.error("cacheElements xatosi:", error);
    }

    try {
        bindEvents();
    } catch (error) {
        console.error("bindEvents xatosi:", error);
    }

    bootAdminTriggers();
    showProductsLoading();

    try {
        initFirebase();
    } catch (error) {
        console.error("initFirebase xatosi:", error);
        showProductsError("Ma'lumotlar yuklanmadi. Internetni tekshiring.");
    }

    if (hasAdminSession()) {
        log("Admin sessiya faol");
    }

    window.addEventListener("admin:loggedin", onAdminLoggedIn);
    window.addEventListener("admin:opened", onAdminLoggedIn);
    window.addEventListener("admin:password-changed", (event) => {
        adminPassword = event.detail?.password || refreshAdminPassword();
    });

    log("Sifatli kiyimlar — sayt tayyor");
    publishAppApi();
}

function publishAppApi() {
    window.addProduct = addProduct;
    window.updateProduct = updateProduct;
    window.showToast = showToast;
    window.getFirebaseStatus = function () {
        return {
            ready: firebaseReady,
            productCount: products.length,
            projectId: firebaseConfig.projectId
        };
    };
    window.dispatchEvent(new CustomEvent("app:ready"));
}

function onAdminLoggedIn() {
    if (typeof window.switchAdminSection === "function") {
        window.switchAdminSection("products");
    }
    renderStats();
    renderAdminProducts();
}

function log(...args) {
    if (!IS_PROD) console.log(...args);
}

function setAdminSession() {
    const until = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ until }));
}

function hasAdminSession() {
    try {
        const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
        if (!raw) return false;
        const session = JSON.parse(raw);
        if (!session?.until || Date.now() > session.until) {
            sessionStorage.removeItem(ADMIN_SESSION_KEY);
            return false;
        }
        return true;
    } catch {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        return false;
    }
}

function clearAdminSession() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function showProductsLoading() {
    if (!elements.productsGrid) return;
    elements.productsGrid.innerHTML = `
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
    `;
}

function showProductsError(message) {
    if (!elements.productsGrid) return;
    elements.productsGrid.innerHTML = `
        <div class="empty-state error-state">
            ${escapeHtml(message)}
            <button class="btn sm" type="button" id="retryFirebaseBtn" style="margin-top:14px;">Qayta urinish</button>
        </div>
    `;
    document.getElementById("retryFirebaseBtn")?.addEventListener("click", initFirebase);
}

function cacheElements() {
    elements = {
        productsGrid: document.getElementById("productsGrid"),
        adminProductsTable: document.getElementById("adminProductsTable"),
        ordersTable: document.getElementById("ordersTable"),
        loginModal: document.getElementById("loginModal"),
        orderModal: document.getElementById("orderModal"),
        productDetailModal: document.getElementById("productDetailModal"),
        detailImage: document.getElementById("detailImage"),
        detailName: document.getElementById("detailName"),
        detailCategory: document.getElementById("detailCategory"),
        detailPrice: document.getElementById("detailPrice"),
        detailStatus: document.getElementById("detailStatus"),
        detailDescription: document.getElementById("detailDescription"),
        detailOrderBtn: document.getElementById("detailOrderBtn"),
        deleteModal: document.getElementById("deleteModal"),
        editModal: document.getElementById("editModal"),
        adminDashboard: document.getElementById("adminDashboard"),
        adminSidebar: document.getElementById("adminSidebar"),
        adminSidebarOverlay: document.getElementById("adminSidebarOverlay"),
        loginForm: document.getElementById("loginForm"),
        productForm: document.getElementById("productForm"),
        editForm: document.getElementById("editForm"),
        orderForm: document.getElementById("orderForm"),
        adminPassword: document.getElementById("adminPassword"),
        loginError: document.getElementById("loginError"),
        orderError: document.getElementById("orderError"),
        productFormError: document.getElementById("productFormError"),
        editFormError: document.getElementById("editFormError"),
        customerPhone: document.getElementById("customerPhone"),
        selectedProductText: document.getElementById("selectedProductText"),
        toastContainer: document.getElementById("toastContainer"),
        productName: document.getElementById("productName"),
        productPrice: document.getElementById("productPrice"),
        productCategory: document.getElementById("productCategory"),
        productStatus: document.getElementById("productStatus"),
        productImage: document.getElementById("productImage"),
        productImageFile: document.getElementById("productImageFile"),
        productImagePickBtn: document.getElementById("productImagePickBtn"),
        productImagePreview: document.getElementById("productImagePreview"),
        editImageFile: document.getElementById("editImageFile"),
        editImagePickBtn: document.getElementById("editImagePickBtn"),
        editImagePreview: document.getElementById("editImagePreview"),
        productDescription: document.getElementById("productDescription"),
        editName: document.getElementById("editName"),
        editPrice: document.getElementById("editPrice"),
        editCategory: document.getElementById("editCategory"),
        editStatus: document.getElementById("editStatus"),
        editImage: document.getElementById("editImage"),
        editDescription: document.getElementById("editDescription"),
        editTitle: document.getElementById("editTitle"),
        passwordModal: document.getElementById("passwordModal"),
        passwordForm: document.getElementById("passwordForm"),
        currentPassword: document.getElementById("currentPassword"),
        newPassword: document.getElementById("newPassword"),
        confirmPassword: document.getElementById("confirmPassword"),
        passwordFormError: document.getElementById("passwordFormError"),
        productSearch: document.getElementById("productSearch"),
        categoryFilter: document.getElementById("categoryFilter"),
        confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
        deleteMessage: document.getElementById("deleteMessage"),
        heroProductCount: document.getElementById("heroProductCount"),
        statTotalProducts: document.getElementById("statTotalProducts"),
        statAvailableProducts: document.getElementById("statAvailableProducts"),
        statSoldOutProducts: document.getElementById("statSoldOutProducts"),
        statTotalOrders: document.getElementById("statTotalOrders"),
        adminPageTitle: document.getElementById("adminPageTitle"),
        adminPageDesc: document.getElementById("adminPageDesc")
    };
}

async function initFirebase() {
    updateFirebaseStatus("loading");

    if (location.protocol === "file:") {
        console.warn("file:// orqali ochilgan — Firebase uchun npm run dev ishlatish tavsiya etiladi");
    }

    try {
        const appModule = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
        const fsModule = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

        fb = fsModule;
        const existingApps = appModule.getApps();
        firebaseApp = existingApps.length ? existingApps[0] : appModule.initializeApp(firebaseConfig);
        db = fsModule.getFirestore(firebaseApp);
        firebaseReady = true;

        updateFirebaseStatus("connected");
        listenProducts();
        listenOrders();
        window.dispatchEvent(new CustomEvent("firebase:ready"));
        log("Firebase ulandi:", firebaseConfig.projectId);
    } catch (error) {
        firebaseReady = false;
        console.error("Firebase init xatosi:", error);
        updateFirebaseStatus("error", error?.message || "Ulanish xatosi");
        showProductsError("Ma'lumotlar yuklanmadi. Internetni tekshiring yoki npm run dev bilan oching.");
        showToast("Firebase ulanmadi — internetni tekshiring", "error");
    }
}

function updateFirebaseStatus(state, detail = "") {
    const badge = document.getElementById("firebaseStatusBadge");
    if (!badge) return;

    const states = {
        loading: { text: "Firebase ulanmoqda...", className: "badge warning" },
        connected: { text: "Firebase ulangan", className: "badge available" },
        error: { text: "Firebase xato", className: "badge sold-out" },
        offline: { text: "Firebase ulanmagan", className: "badge sold-out" }
    };

    const meta = states[state] || states.offline;
    badge.textContent = meta.text;
    badge.className = meta.className;
    badge.title = detail || meta.text;
}

function bindById(id, event, handler) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, handler);
    } else {
        console.warn(`Element #${id} topilmadi`);
    }
}

function bindEl(el, event, handler, name = "?") {
    if (el) {
        el.addEventListener(event, handler);
    } else {
        console.warn(`Element ${name} topilmadi`);
    }
}

function bindEvents() {
    bindById("logoutAdminBtn", "click", () => {
        if (typeof window.closeAdminDashboard === "function") {
            window.closeAdminDashboard();
        }
        cancelEditProduct();
    });
    bindById("sidebarToggleBtn", "click", () => toggleSidebar());
    bindById("sidebarCloseBtn", "click", () => closeAdminSidebar());
    elements.adminSidebarOverlay?.addEventListener("click", closeAdminSidebar);

    window.addEventListener("resize", () => {
        if (window.innerWidth > 860) {
            closeAdminSidebar();
        }
    });
    bindById("cancelEditBtn", "click", cancelEditProduct);

    bindEl(elements.orderForm, "submit", submitOrder, "orderForm");
    bindEl(elements.confirmDeleteBtn, "click", confirmDelete, "confirmDeleteBtn");

    bindEl(elements.productSearch, "input", (event) => {
        productSearch = event.target.value.trim().toLowerCase();
        renderAdminProducts();
    }, "productSearch");

    bindEl(elements.categoryFilter, "change", (event) => {
        categoryFilter = event.target.value;
        renderAdminProducts();
    }, "categoryFilter");

    bindImageUploadControls("product");
    bindImageUploadControls("edit");

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
        button.addEventListener("click", () => {
            const overlay = button.closest(".modal-overlay");
            if (overlay && overlay.id === "editModal") {
                cancelEditProduct();
            } else {
                closeModal(overlay);
            }
        });
    });

    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
                if (overlay.id === "editModal") {
                    cancelEditProduct();
                } else {
                    closeModal(overlay);
                }
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            if (elements.adminSidebar?.classList.contains("open")) {
                closeAdminSidebar();
                return;
            }
            if (elements.editModal?.classList.contains("show")) {
                cancelEditProduct();
            } else {
                closeAllModals();
                elements.adminSidebar.classList.remove("open");
                syncAdminSidebarState(false);
            }
        }
    });

    document.addEventListener("click", (event) => {
        const detailButton = event.target.closest("[data-detail-id]");
        if (detailButton) {
            openProductDetailModal(detailButton.dataset.detailId);
            return;
        }

        const orderButton = event.target.closest("[data-order-id]");
        if (orderButton && !orderButton.disabled) {
            if (elements.productDetailModal?.classList.contains("show")) {
                closeModal(elements.productDetailModal);
            }
            openOrderModal(orderButton.dataset.orderId);
            return;
        }

        const editButton = event.target.closest("[data-edit-id]");
        if (editButton && !editButton.dataset.boundEdit) {
            startEditProduct(editButton.dataset.editId);
            return;
        }

        const deleteProductButton = event.target.closest("[data-delete-product]");
        if (deleteProductButton && !deleteProductButton.dataset.boundDelete) {
            requestDelete("product", deleteProductButton.dataset.deleteProduct);
            return;
        }

        const deleteOrderButton = event.target.closest("[data-delete-order]");
        if (deleteOrderButton && !deleteOrderButton.dataset.boundDelete) {
            requestDelete("order", deleteOrderButton.dataset.deleteOrder);
        }
    });
}

function getSortTime(item) {
    const ts = item?.createdAt || item?.updatedAt;
    if (ts?.toMillis) return ts.toMillis();
    if (ts?.seconds) return ts.seconds * 1000;
    return 0;
}

function listenProducts() {
    if (!db || !fb) return;

    fb.onSnapshot(
        fb.collection(db, "products"),
        (snapshot) => {
            products = snapshot.docs
                .map((item) => ({
                    id: item.id,
                    ...item.data()
                }))
                .sort((a, b) => getSortTime(b) - getSortTime(a));
            log("Firestore mahsulotlar:", products.length);
            updateFirebaseStatus("connected", `${products.length} ta mahsulot`);
            renderProducts();
            renderAdminProducts();
            renderStats();
        },
        (error) => {
            console.error("Mahsulotlarni o'qishda xatolik:", error);
            updateFirebaseStatus("error", error?.message || "O'qish xatosi");
            showProductsError("Mahsulotlarni yuklashda xatolik. Internetni tekshiring.");
            showToast("Mahsulotlarni yuklashda xatolik", "error");
        }
    );
}

function listenOrders() {
    if (!db || !fb) return;

    fb.onSnapshot(
        fb.collection(db, "orders"),
        (snapshot) => {
            orders = snapshot.docs
                .map((item) => ({
                    id: item.id,
                    ...item.data()
                }))
                .sort((a, b) => getSortTime(b) - getSortTime(a));
            renderOrders();
            renderStats();
        },
        (error) => {
            console.error("Zakazlarni o'qishda xatolik:", error);
            showToast("Zakazlarni yuklashda xatolik", "error");
        }
    );
}

function renderProducts() {
    if (!elements.productsGrid) return;

    elements.productsGrid.innerHTML = "";

    if (products.length === 0) {
        elements.productsGrid.innerHTML = '<div class="empty-state">Hozircha mahsulot yo\'q</div>';
        return;
    }

    products.forEach((product, index) => {
        const isAvailable = product.status === "mavjud";
        const card = document.createElement("article");
        card.className = `product-card is-visible${isAvailable ? "" : " sold-out"}`;
        card.style.transitionDelay = `${Math.min(index * 70, 420)}ms`;
        card.style.animationDelay = `${(index % 3) * 0.8}s`;

        const media = product.imageUrl
            ? buildProductImageHtml(product.imageUrl, product.name)
            : `<div class="product-placeholder">Sifatli kiyimlar</div>`;

        card.innerHTML = `
            <div class="product-media">
                ${media}
                <span class="status-pill ${isAvailable ? "available" : "sold-out"}">${isAvailable ? "Mavjud" : "Tugagan"}</span>
                <span class="price-pill">${escapeHtml(formatPrice(product.price))}</span>
            </div>
            <div class="product-body">
                <span class="product-category">${escapeHtml(product.category || "Umumiy")}</span>
                <h3>${escapeHtml(product.name)}</h3>
                <p>${escapeHtml(product.description || "")}</p>
                <div class="product-actions">
                    <button class="btn outline" type="button" data-detail-id="${escapeHtml(product.id)}">Batafsil</button>
                    <button class="btn" type="button" data-order-id="${escapeHtml(product.id)}" ${isAvailable ? "" : "disabled"}>
                        ${isAvailable ? "Zakaz qilish" : "Tugagan"}
                    </button>
                </div>
            </div>
        `;

        attachCardMotion(card);
        elements.productsGrid.appendChild(card);
    });

    observeCards();
}

let cardObserver = null;

function observeCards() {
    if (!("IntersectionObserver" in window)) {
        document.querySelectorAll(".product-card").forEach((c) => c.classList.add("is-visible"));
        return;
    }

    if (!cardObserver) {
        cardObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        cardObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
        );
    }

    document.querySelectorAll(".product-card:not(.is-visible)").forEach((card) => {
        cardObserver.observe(card);
    });
}

function attachCardMotion(card) {
    const maxTilt = 8;
    let raf = null;

    const onMove = (event) => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            const rect = card.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const rotateY = ((x - cx) / cx) * maxTilt;
            const rotateX = -((y - cy) / cy) * maxTilt;

            card.style.transform = `translateY(-10px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
            card.style.setProperty("--shine-x", `${x}px`);
            card.style.setProperty("--shine-y", `${y}px`);
        });
    };

    const onLeave = () => {
        if (raf) cancelAnimationFrame(raf);
        card.style.transform = "";
        card.style.removeProperty("--shine-x");
        card.style.removeProperty("--shine-y");
    };

    card.addEventListener("mousemove", onMove);
    card.addEventListener("mouseleave", onLeave);
}

function getFilteredProducts() {
    return products.filter((product) => {
        const name = (product.name || "").toLowerCase();
        const cat = (product.category || "").toLowerCase();
        const desc = (product.description || "").toLowerCase();

        const matchesSearch =
            !productSearch ||
            name.includes(productSearch) ||
            cat.includes(productSearch) ||
            desc.includes(productSearch);

        const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });
}

function renderAdminProducts() {
    if (!elements.adminProductsTable) return;

    const filtered = getFilteredProducts();
    elements.adminProductsTable.innerHTML = "";

    if (filtered.length === 0) {
        elements.adminProductsTable.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color: var(--muted); font-weight:700; padding: 28px;">
                    Mahsulot topilmadi
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach((product) => {
        const row = document.createElement("tr");
        const isAvailable = product.status === "mavjud";
        const shortId = (product.id || "").slice(0, 8);

        row.innerHTML = `
            <td><code style="font-size:12px; font-weight:800; color:var(--emerald);" title="${escapeHtml(product.id)}">${escapeHtml(shortId)}...</code></td>
            <td>
                <div class="table-product">
                    ${product.imageUrl
                        ? `<img class="table-thumb" src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" onerror="this.style.background='linear-gradient(135deg,#1b1a22,#126c5b)'; this.removeAttribute('src');">`
                        : `<div class="table-thumb"></div>`}
                    <div>
                        <strong>${escapeHtml(product.name)}</strong>
                        <span style="display:block; color:var(--muted); font-size:13px; font-weight:650;">${escapeHtml((product.description || "").slice(0, 60))}${(product.description || "").length > 60 ? "..." : ""}</span>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(formatPrice(product.price))}</td>
            <td>${escapeHtml(product.category || "-")}</td>
            <td><span class="badge ${isAvailable ? "available" : "sold-out"}">${isAvailable ? "Mavjud" : "Tugagan"}</span></td>
            <td>
                <div class="table-actions">
                    <button class="btn sm secondary table-action-btn" type="button" data-edit-id="${escapeHtml(product.id)}" aria-label="Tahrirlash" title="Tahrirlash">
                        Tahrir
                    </button>
                    <button class="btn sm danger table-action-btn" type="button" data-delete-product="${escapeHtml(product.id)}" aria-label="O'chirish" title="O'chirish">
                        O'chir
                    </button>
                </div>
            </td>
        `;

        elements.adminProductsTable.appendChild(row);

        const editBtn = row.querySelector("[data-edit-id]");
        const deleteBtn = row.querySelector("[data-delete-product]");

        if (editBtn) {
            editBtn.dataset.boundEdit = "1";
            editBtn.addEventListener("click", () => startEditProduct(product.id));
        }

        if (deleteBtn) {
            deleteBtn.dataset.boundDelete = "1";
            deleteBtn.addEventListener("click", () => requestDelete("product", product.id));
        }
    });
}

function renderOrders() {
    elements.ordersTable.innerHTML = "";

    if (orders.length === 0) {
        elements.ordersTable.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color: var(--muted); font-weight:700; padding: 28px;">
                    Hozircha zakazlar yo'q
                </td>
            </tr>
        `;
        return;
    }

    orders.forEach((order) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${escapeHtml(order.productName || "-")}</strong></td>
            <td>${escapeHtml(formatPrice(order.productPrice))}</td>
            <td><a href="tel:${escapeHtml(order.customerPhone || "")}" style="color:var(--emerald); font-weight:800;">${escapeHtml(order.customerPhone || "-")}</a></td>
            <td>${escapeHtml(formatDate(order.createdAt))}</td>
            <td>
                <button class="icon-btn danger" type="button" data-delete-order="${escapeHtml(order.id)}" aria-label="Zakazni o'chirish" title="O'chirish">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                </button>
            </td>
        `;
        elements.ordersTable.appendChild(row);

        const deleteBtn = row.querySelector("[data-delete-order]");
        if (deleteBtn) {
            deleteBtn.dataset.boundDelete = "1";
            deleteBtn.addEventListener("click", () => requestDelete("order", order.id));
        }
    });
}

function renderStats() {
    const totalProducts = products.length;
    const availableProducts = products.filter((p) => p.status === "mavjud").length;
    const soldOutProducts = products.filter((p) => p.status === "tugagan").length;
    const totalOrders = orders.length;

    if (elements.statTotalProducts) elements.statTotalProducts.textContent = totalProducts;
    if (elements.statAvailableProducts) elements.statAvailableProducts.textContent = availableProducts;
    if (elements.statSoldOutProducts) elements.statSoldOutProducts.textContent = soldOutProducts;
    if (elements.statTotalOrders) elements.statTotalOrders.textContent = totalOrders;

    if (elements.heroProductCount) {
        elements.heroProductCount.textContent = `${totalProducts}`;
    }
}

async function addProduct(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!firebaseReady || !db || !fb) {
        showToast("Firebase ulanmagan — sahifani yangilang yoki npm run dev bilan oching", "error");
        elements.productFormError.textContent = "Firebase ulanmagan. Internetni tekshiring.";
        return;
    }

    const data = readForm("add");
    if (!data) return;

    const submitBtn = elements.productForm?.querySelector("#addProductBtn, button[type='submit']");
    if (submitBtn) submitBtn.disabled = true;

    try {
        const imageUrl = await resolveImageForSave("add");
        const docRef = fb.doc(fb.collection(db, "products"));
        const autoId = docRef.id;

        await fb.setDoc(docRef, {
            id: autoId,
            name: data.name,
            price: data.price,
            category: data.category,
            imageUrl: imageUrl || "",
            description: data.description,
            status: data.status,
            createdAt: fb.serverTimestamp(),
            updatedAt: fb.serverTimestamp()
        });

        log("Mahsulot Firestore ga saqlandi, auto ID:", autoId);
        resetProductForm();
        switchAdminSection("products");
        showToast(`Mahsulot saqlandi (ID: ${autoId.slice(0, 8)}...)`, "success");
    } catch (error) {
        console.error("Mahsulot qo'shishda xatolik:", error);
        const code = error?.code || "";
        const hint = code === "permission-denied"
            ? "Firebase ruxsati yo'q. npm run deploy:rules"
            : (error?.message || "Ma'lumotlarni tekshiring va qayta urinib ko'ring");
        elements.productFormError.textContent = hint;
        showToast("Mahsulot qo'shilmadi", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function startEditProduct(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) {
        showToast("Mahsulot topilmadi", "error");
        return;
    }

    editingProductId = productId;
    elements.editName.value = product.name || "";
    elements.editPrice.value = String(product.price ?? "");
    elements.editCategory.value = product.category || "Erkaklar";
    elements.editStatus.value = product.status || "mavjud";
    elements.editDescription.value = product.description || "";
    elements.editFormError.textContent = "";
    elements.editTitle.textContent = `"${product.name}" ni tahrirlash`;
    pendingEditImageFile = null;
    pendingEditImageDataUrl = null;
    clearImageFieldMeta("edit");

    if (product.imageUrl) {
        if (isDataImageUrl(product.imageUrl)) {
            setPendingImageDataUrl("edit", product.imageUrl);
            markImageFieldBase64("edit");
            elements.editImage.value = "";
        } else {
            elements.editImage.value = product.imageUrl;
        }
        showImagePreview("edit", product.imageUrl);
    } else {
        clearImagePreview("edit");
    }

    openModal(elements.editModal);
    setTimeout(() => elements.editName.focus(), 120);
}

async function updateProduct(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!db || !fb || !editingProductId) {
        showToast("Tahrirlash bekor qilindi", "error");
        return;
    }

    const data = readForm("edit");
    if (!data) return;

    const submitBtn = elements.editForm?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const imageUrl = await resolveImageForSave("edit");
        await fb.updateDoc(fb.doc(db, "products", editingProductId), {
            name: data.name,
            price: data.price,
            category: data.category,
            imageUrl,
            description: data.description,
            status: data.status,
            updatedAt: fb.serverTimestamp()
        });

        editingProductId = null;
        pendingEditImageFile = null;
        pendingEditImageDataUrl = null;
        clearImagePreview("edit");
        closeModal(elements.editModal);
        showToast("Mahsulot yangilandi", "success");
    } catch (error) {
        console.error("Mahsulot yangilashda xatolik:", error);
        const hint = error?.code === "permission-denied"
            ? "Firebase ruxsati yo'q"
            : (error?.message || "Ma'lumotlarni tekshiring");
        elements.editFormError.textContent = hint;
        showToast("Mahsulot yangilanmadi", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function cancelEditProduct() {
    editingProductId = null;
    pendingEditImageFile = null;
    pendingEditImageDataUrl = null;
    clearImageFieldMeta("edit");
    elements.editForm.reset();
    elements.editFormError.textContent = "";
    clearImagePreview("edit");
    closeModal(elements.editModal);
}

window.cancelEditProduct = cancelEditProduct;

function resetProductForm() {
    elements.productForm.reset();
    elements.productCategory.value = "Erkaklar";
    elements.productStatus.value = "mavjud";
    elements.productFormError.textContent = "";
    pendingProductImageFile = null;
    pendingProductImageDataUrl = null;
    clearImageFieldMeta("product");
    clearImagePreview("product");
}

function normalizeImageSource(value) {
    return String(value || "").replace(/\s+/g, "").trim();
}

function isHttpImageUrl(value) {
    return /^https?:\/\//i.test(String(value || "").trim());
}

function normalizeHttpImageUrl(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    const compact = trimmed.replace(/\s+/g, "");
    if (/^https?:\/\//i.test(compact)) return compact;
    if (/^\/\//.test(compact)) return `https:${compact}`;
    return compact;
}

function buildProductImageHtml(imageUrl, name) {
    const isHttp = isHttpImageUrl(imageUrl);
    const referrer = isHttp ? ' referrerpolicy="no-referrer"' : '';
    const fallback = '<div class="product-placeholder" hidden>Rasm yuklanmadi</div>';
    return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async"${referrer} onerror="this.onerror=null;this.hidden=true;this.nextElementSibling?.removeAttribute('hidden')">${fallback}`;
}

function buildDetailImageHtml(imageUrl, name) {
    const isHttp = isHttpImageUrl(imageUrl);
    const referrer = isHttp ? ' referrerpolicy="no-referrer"' : '';
    return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" decoding="async"${referrer} onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'product-detail-placeholder\\'>Rasm yuklanmadi</div>'">`;
}

function isDataImageUrl(value) {
    return normalizeImageSource(value).startsWith("data:image/");
}

function isTruncatedDataUrlDisplay(value) {
    const text = String(value || "");
    return text.startsWith("data:image/") && text.includes("...");
}

function clearImageFieldMeta(mode) {
    const { input } = getImageFieldRefs(mode);
    if (!input) return;
    delete input.dataset.imageMode;
}

function markImageFieldBase64(mode) {
    const { input } = getImageFieldRefs(mode);
    if (!input) return;
    input.dataset.imageMode = "base64";
    input.value = "";
}

function getImageSourceFromField(mode) {
    const isEdit = mode === "edit";
    const pendingFile = isEdit ? pendingEditImageFile : pendingProductImageFile;
    const pendingDataUrl = getPendingImageDataUrl(mode);
    const { input } = getImageFieldRefs(mode);
    const raw = normalizeImageSource(input?.value || "");

    if (pendingFile) {
        return { kind: "file", file: pendingFile };
    }

    if (pendingDataUrl && isDataImageUrl(pendingDataUrl)) {
        return { kind: "data", url: pendingDataUrl };
    }

    if (isDataImageUrl(raw)) {
        setPendingImageDataUrl(mode, raw);
        markImageFieldBase64(mode);
        return { kind: "data", url: raw };
    }

    if (isTruncatedDataUrlDisplay(input?.value || "") && pendingDataUrl) {
        return { kind: "data", url: pendingDataUrl };
    }

    const httpUrl = normalizeHttpImageUrl(input?.value || "");
    if (isHttpImageUrl(httpUrl)) {
        return { kind: "http", url: httpUrl };
    }

    if (!input?.value?.trim() && input?.dataset.imageMode === "base64" && pendingDataUrl) {
        return { kind: "data", url: pendingDataUrl };
    }

    if (!input?.value?.trim() && !pendingDataUrl && !pendingFile) {
        return { kind: "empty" };
    }

    return { kind: "invalid" };
}

function setPendingImageDataUrl(mode, dataUrl) {
    const normalized = normalizeImageSource(dataUrl);
    if (mode === "edit") {
        pendingEditImageDataUrl = normalized;
        pendingEditImageFile = null;
    } else {
        pendingProductImageDataUrl = normalized;
        pendingProductImageFile = null;
    }
}

function getPendingImageDataUrl(mode) {
    return mode === "edit" ? pendingEditImageDataUrl : pendingProductImageDataUrl;
}

function clearPendingImageDataUrl(mode) {
    if (mode === "edit") {
        pendingEditImageDataUrl = null;
    } else {
        pendingProductImageDataUrl = null;
    }
}

function applyImageSourceToField(mode, source) {
    const { input } = getImageFieldRefs(mode);
    if (!input) return;

    if (isDataImageUrl(source)) {
        const normalized = normalizeImageSource(source);
        setPendingImageDataUrl(mode, normalized);
        markImageFieldBase64(mode);
        showImagePreview(mode, normalized);
        return;
    }

    clearPendingImageDataUrl(mode);
    clearImageFieldMeta(mode);
    input.value = source;
    if (source) {
        showImagePreview(mode, source);
    } else {
        clearImagePreview(mode);
    }
}

function getImageFieldRefs(mode) {
    const isEdit = mode === "edit";
    return {
        input: isEdit ? elements.editImage : elements.productImage,
        file: isEdit ? elements.editImageFile : elements.productImageFile,
        pickBtn: isEdit ? elements.editImagePickBtn : elements.productImagePickBtn,
        preview: isEdit ? elements.editImagePreview : elements.productImagePreview
    };
}

function clearImagePreview(mode) {
    const { preview } = getImageFieldRefs(mode);
    if (!preview) return;
    if (preview.dataset.objectUrl) {
        URL.revokeObjectURL(preview.dataset.objectUrl);
        delete preview.dataset.objectUrl;
    }
    preview.removeAttribute("src");
    preview.hidden = true;
}

function showImagePreview(mode, source) {
    const { preview } = getImageFieldRefs(mode);
    if (!preview) return;

    clearImagePreview(mode);

    let src = "";
    if (typeof source === "string") {
        src = source;
    } else if (source instanceof File || source instanceof Blob) {
        src = URL.createObjectURL(source);
        preview.dataset.objectUrl = src;
    }

    if (!src) return;
    preview.src = src;
    preview.hidden = false;
}

function bindImageUploadControls(mode) {
    const { input, file, pickBtn } = getImageFieldRefs(mode);
    if (!input) return;

    if (pickBtn && file) {
        pickBtn.addEventListener("click", () => file.click());
        file.addEventListener("change", () => {
            const selected = file.files?.[0];
            if (!selected) return;
            if (mode === "edit") {
                pendingEditImageFile = selected;
                pendingEditImageDataUrl = null;
            } else {
                pendingProductImageFile = selected;
                pendingProductImageDataUrl = null;
            }
            if (input) input.value = "";
            clearImageFieldMeta(mode);
            showImagePreview(mode, selected);
        });
    }

    input.addEventListener("paste", (event) => {
        const text = event.clipboardData?.getData("text/plain") || "";
        const normalizedText = normalizeImageSource(text);

        if (isDataImageUrl(normalizedText)) {
            event.preventDefault();
            applyImageSourceToField(mode, normalizedText);
            showToast("Rasm qo'shildi — base64 sifatida saqlanadi", "success");
            return;
        }

        const items = event.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (!item.type.startsWith("image/")) continue;
            event.preventDefault();
            const pastedFile = item.getAsFile();
            if (!pastedFile) continue;

            if (mode === "edit") {
                pendingEditImageFile = pastedFile;
                pendingEditImageDataUrl = null;
            } else {
                pendingProductImageFile = pastedFile;
                pendingProductImageDataUrl = null;
            }
            if (input) input.value = "";
            clearImageFieldMeta(mode);
            showImagePreview(mode, pastedFile);
            showToast("Rasm qo'shildi — base64 sifatida saqlanadi", "success");
            break;
        }
    });

    input.addEventListener("input", () => {
        const value = normalizeImageSource(input.value);
        const pending = getPendingImageDataUrl(mode);

        if (isDataImageUrl(value)) {
            setPendingImageDataUrl(mode, value);
            markImageFieldBase64(mode);
            showImagePreview(mode, value);
            if (mode === "edit") {
                pendingEditImageFile = null;
            } else {
                pendingProductImageFile = null;
            }
            return;
        }

        if (isTruncatedDataUrlDisplay(input.value) && pending) {
            showImagePreview(mode, pending);
            return;
        }

        if (input.dataset.imageMode === "base64" && pending) {
            showImagePreview(mode, pending);
            return;
        }

        clearPendingImageDataUrl(mode);
        clearImageFieldMeta(mode);

        const httpUrl = normalizeHttpImageUrl(input.value);
        if (isHttpImageUrl(httpUrl)) {
            showImagePreview(mode, httpUrl);
            return;
        }

        if (!input.value.trim()) {
            clearImagePreview(mode);
            if (mode === "edit") {
                pendingEditImageFile = null;
            } else {
                pendingProductImageFile = null;
            }
        }
    });
}

function parseDataUrlImage(dataUrl) {
    const normalized = normalizeImageSource(dataUrl);
    if (normalized.length > MAX_IMAGE_DATA_URL_CHARS) {
        throw new Error("Rasm juda katta. Kichikroq rasm tanlang yoki https:// URL ishlating");
    }

    const match = normalized.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
        throw new Error("Rasm URL noto'g'ri yoki to'liq emas. Google'dan qayta nusxalang");
    }

    const mime = match[1];
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: mime });
    if (blob.size > MAX_IMAGE_BYTES) {
        throw new Error("Rasm juda katta (max ~400KB). Kichikroq rasm tanlang");
    }

    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    return { blob, ext, mime, dataUrl: normalized };
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file?.type?.startsWith("image/")) {
            reject(new Error("Faqat rasm fayli qabul qilinadi"));
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            reject(new Error("Rasm juda katta (max ~400KB). Kichikroq rasm tanlang"));
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const dataUrl = normalizeImageSource(String(reader.result || ""));
                parseDataUrlImage(dataUrl);
                resolve(dataUrl);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error("Rasm o'qilmadi"));
        reader.readAsDataURL(file);
    });
}

async function resolveImageForSave(mode) {
    const source = getImageSourceFromField(mode);

    if (source.kind === "file") {
        const base64 = await fileToDataUrl(source.file);
        clearPendingImageDataUrl(mode);
        return base64;
    }

    if (source.kind === "data") {
        parseDataUrlImage(source.url);
        clearPendingImageDataUrl(mode);
        return source.url;
    }

    if (source.kind === "http") {
        if (source.url.length > 2000) {
            throw new Error("Rasm URL juda uzun");
        }
        return source.url;
    }

    if (source.kind === "empty") {
        return "";
    }

    throw new Error("Rasm noto'g'ri. Google'dan 'Rasm URL nusxasi' yoki https:// havola kiriting");
}

function readForm(mode) {
    const prefix = mode === "edit" ? "edit" : "product";
    const errorEl = mode === "edit" ? elements.editFormError : elements.productFormError;

    const nameEl = mode === "edit" ? elements.editName : elements.productName;
    const priceEl = mode === "edit" ? elements.editPrice : elements.productPrice;
    const catEl = mode === "edit" ? elements.editCategory : elements.productCategory;
    const statusEl = mode === "edit" ? elements.editStatus : elements.productStatus;
    const imageEl = mode === "edit" ? elements.editImage : elements.productImage;
    const descEl = mode === "edit" ? elements.editDescription : elements.productDescription;
    const imageSource = getImageSourceFromField(mode);

    const name = nameEl.value.trim();
    const priceRaw = priceEl.value.trim();
    const category = catEl.value;
    const description = descEl.value.trim();
    const status = statusEl.value;
    const hasImage = imageSource.kind !== "empty" && imageSource.kind !== "invalid";

    if (!name || !priceRaw || !category || !description) {
        errorEl.textContent = "Barcha majburiy maydonlarni to'ldiring";
        showToast("Bo'sh input bilan mahsulot saqlanmaydi", "error");
        return null;
    }

    const price = validatePrice(priceRaw);
    if (price === null) {
        errorEl.textContent = "Narx musbat raqam bo'lishi kerak";
        showToast("Narx noto'g'ri kiritildi", "error");
        return null;
    }

    if ((imageEl.value.trim() || imageEl.dataset.imageMode === "base64") && !hasImage) {
        errorEl.textContent = "Rasm noto'g'ri. Google'dan 'Rasm URL nusxasi', https:// yoki fayl tanlang";
        showToast("Rasm formati noto'g'ri", "error");
        return null;
    }

    errorEl.textContent = "";
    return {
        name,
        price,
        category,
        imageUrl: imageSource.kind === "data"
            ? imageSource.url
            : imageSource.kind === "http"
                ? imageSource.url
                : "",
        description,
        status
    };
}

function validatePrice(value) {
    const normalized = value.replace(/\s/g, "").replace(/,/g, "").replace(/so'm/gi, "");
    const number = Number(normalized);
    if (!Number.isFinite(number) || number <= 0) {
        return null;
    }
    return number;
}

function requestDelete(type, id) {
    const item = type === "product"
        ? products.find((p) => p.id === id)
        : orders.find((o) => o.id === id);

    if (!item) {
        showToast("Ma'lumot topilmadi", "error");
        return;
    }

    deleteTarget = { type, id };
    elements.deleteMessage.textContent = type === "product"
        ? `"${item.name}" mahsulotini o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`
        : `"${item.productName}" zakazini o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`;

    openModal(elements.deleteModal);
}

function deleteProduct(productId) {
    requestDelete("product", productId);
}

function deleteOrder(orderId) {
    requestDelete("order", orderId);
}

async function confirmDelete() {
    if (!db || !fb || !deleteTarget) return;

    const { type, id } = deleteTarget;
    elements.confirmDeleteBtn.disabled = true;

    try {
        if (type === "product") {
            await fb.deleteDoc(fb.doc(db, "products", id));
            if (editingProductId === id) {
                cancelEditProduct();
            }
            showToast("Mahsulot o'chirildi", "success");
        } else {
            await fb.deleteDoc(fb.doc(db, "orders", id));
            showToast("Zakaz o'chirildi", "success");
        }

        closeModal(elements.deleteModal);
        deleteTarget = null;
    } catch (error) {
        console.error("O'chirishda xatolik:", error);
        showToast(type === "product" ? "Mahsulot o'chirilmadi" : "Zakaz o'chirilmadi", "error");
    } finally {
        elements.confirmDeleteBtn.disabled = false;
    }
}

function openAdminLogin() {
    if (typeof window.openAdminLogin === "function") {
        window.openAdminLogin();
    }
}

function openAdminDashboard() {
    if (typeof window.openAdminDashboard === "function") {
        window.openAdminDashboard();
        onAdminLoggedIn();
    }
}

function closeAdminDashboard() {
    if (typeof window.closeAdminDashboard === "function") {
        window.closeAdminDashboard();
    }
    cancelEditProduct();
}

function refreshAdminPassword() {
    adminPassword = typeof window.getAdminPassword === "function"
        ? window.getAdminPassword()
        : (localStorage.getItem(ADMIN_PWD_KEY) || DEFAULT_ADMIN_PASSWORD);
}

function switchAdminSection(sectionName) {
    document.querySelectorAll(".admin-section").forEach((section) => {
        section.classList.toggle("active", section.dataset.section === sectionName);
    });

    document.querySelectorAll(".sidebar-link").forEach((link) => {
        link.classList.toggle("active", link.dataset.adminSection === sectionName);
    });

    const meta = SECTION_TITLES[sectionName];
    if (meta) {
        if (elements.adminPageTitle) elements.adminPageTitle.textContent = meta.title;
        if (elements.adminPageDesc) elements.adminPageDesc.textContent = meta.desc;
    }

    elements.adminSidebar?.classList.remove("open");
    syncAdminSidebarState(false);
}

window.switchAdminSection = switchAdminSection;

function syncAdminSidebarState(open) {
    elements.adminSidebarOverlay?.classList.toggle("show", open);
    elements.adminSidebarOverlay?.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("admin-sidebar-open", open);
}

function closeAdminSidebar() {
    elements.adminSidebar?.classList.remove("open");
    syncAdminSidebarState(false);
}

function toggleSidebar(forceOpen) {
    if (!elements.adminSidebar) return;
    const open = typeof forceOpen === "boolean"
        ? forceOpen
        : !elements.adminSidebar.classList.contains("open");
    elements.adminSidebar.classList.toggle("open", open);
    syncAdminSidebarState(open);
}

window.closeAdminSidebar = closeAdminSidebar;

function openProductDetailModal(productId) {
    const product = products.find((item) => item.id === productId);

    if (!product) {
        showToast("Mahsulot topilmadi", "error");
        return;
    }

    const isAvailable = product.status === "mavjud";

    if (elements.detailImage) {
        elements.detailImage.innerHTML = product.imageUrl
            ? buildDetailImageHtml(product.imageUrl, product.name)
            : '<div class="product-detail-placeholder">Rasm yo\'q</div>';
    }

    if (elements.detailName) elements.detailName.textContent = product.name || "Nomsiz";
    if (elements.detailCategory) elements.detailCategory.textContent = product.category || "Umumiy";
    if (elements.detailPrice) elements.detailPrice.textContent = formatPrice(product.price);
    if (elements.detailDescription) {
        elements.detailDescription.textContent = product.description || "Tavsif kiritilmagan.";
    }

    if (elements.detailStatus) {
        elements.detailStatus.textContent = isAvailable ? "Mavjud" : "Tugagan";
        elements.detailStatus.className = `status-pill ${isAvailable ? "available" : "sold-out"}`;
    }

    if (elements.detailOrderBtn) {
        elements.detailOrderBtn.dataset.orderId = product.id;
        elements.detailOrderBtn.disabled = !isAvailable;
        elements.detailOrderBtn.textContent = isAvailable ? "Zakaz qilish" : "Tugagan";
    }

    openModal(elements.productDetailModal);
}

function openOrderModal(productId) {
    const product = products.find((item) => item.id === productId);

    if (!product) {
        showToast("Mahsulot topilmadi", "error");
        return;
    }

    if (product.status !== "mavjud") {
        showToast("Bu mahsulot tugagan", "error");
        return;
    }

    selectedProductId = productId;
    elements.orderError.textContent = "";
    elements.customerPhone.value = "";
    elements.selectedProductText.textContent = `${product.name} (${formatPrice(product.price)}) uchun telefon raqamingizni yozing.`;
    openModal(elements.orderModal);
    setTimeout(() => elements.customerPhone.focus(), 120);
}

async function submitOrder(event) {
    event.preventDefault();

    const phone = elements.customerPhone.value.trim();
    const product = products.find((item) => item.id === selectedProductId);

    if (!phone) {
        elements.orderError.textContent = "Telefon raqam kiritilmasa zakaz qabul qilinmaydi";
        showToast("Telefon raqam kiritilmadi", "error");
        return;
    }

    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 7) {
        elements.orderError.textContent = "Telefon raqam to'liq emas";
        showToast("Telefon raqam noto'g'ri", "error");
        return;
    }

    if (!product) {
        elements.orderError.textContent = "Tanlangan mahsulot topilmadi";
        return;
    }

    if (product.status !== "mavjud") {
        elements.orderError.textContent = "Bu mahsulot hozir mavjud emas";
        return;
    }

    if (!db || !fb) {
        showToast("Server bilan bog'lanish yo'q", "error");
        return;
    }

    const submitBtn = elements.orderForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
        await fb.addDoc(fb.collection(db, "orders"), {
            productId: product.id,
            productName: product.name,
            productPrice: product.price,
            customerPhone: phone,
            createdAt: fb.serverTimestamp()
        });

        closeModal(elements.orderModal);
        selectedProductId = null;
        showToast("Zakaz qabul qilindi", "success");
    } catch (error) {
        console.error("Zakaz yuborishda xatolik:", error);
        showToast("Zakaz yuborilmadi", "error");
    } finally {
        submitBtn.disabled = false;
    }
}

function showToast(message, type = "info") {
    if (!elements.toastContainer) {
        elements.toastContainer = document.getElementById("toastContainer");
    }
    if (!elements.toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(18px)";
        toast.style.transition = "opacity 180ms ease, transform 180ms ease";
    }, 2600);

    setTimeout(() => toast.remove(), 2850);
}

function openModal(modal) {
    if (!modal) return;
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeModal(modal) {
    if (!modal) return;

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");

    const hasOpenModal = Array.from(document.querySelectorAll(".modal-overlay")).some((item) =>
        item.classList.contains("show")
    );
    const adminOpen = elements.adminDashboard?.classList.contains("show");

    if (!hasOpenModal && !adminOpen) {
        document.body.classList.remove("modal-open");
    }
}

function closeAllModals() {
    document.querySelectorAll(".modal-overlay").forEach(closeModal);
}

function formatPrice(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value ?? "-");
    return `${new Intl.NumberFormat("uz-UZ").format(number)} so'm`;
}

function formatDate(timestamp) {
    if (!timestamp) return "Vaqt aniqlanmadi";

    let date;
    if (timestamp?.toDate) {
        date = timestamp.toDate();
    } else {
        date = new Date(timestamp);
    }

    if (Number.isNaN(date.getTime())) return "Vaqt aniqlanmadi";

    return date.toLocaleString("uz-UZ", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
