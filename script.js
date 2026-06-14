const firebaseConfig = {
    apiKey: "AIzaSyAWMPGeFwGhMj4veAGxd3NCiMzqLge-p7k",
    authDomain: "sardorapp-6fdf3.firebaseapp.com",
    projectId: "sardorapp-6fdf3",
    storageBucket: "sardorapp-6fdf3.firebasestorage.app",
    messagingSenderId: "261540820256",
    appId: "1:261540820256:web:4397a07ad9a5801c14d345"
};

const DEFAULT_ADMIN_PASSWORD = "2014";
let adminPassword = DEFAULT_ADMIN_PASSWORD;

let fb = null;
let db = null;
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
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("#adminLoginBtn, #heroAdminBtn");
        if (trigger) {
            event.preventDefault();
            try {
                openAdminLogin();
            } catch (error) {
                console.error("Admin loginni ochishda xatolik:", error);
            }
        }
    });
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

    try {
        initFirebase();
    } catch (error) {
        console.error("initFirebase xatosi:", error);
    }

    console.log("Sifatli kiyimlar — sayt tayyor");
}

function cacheElements() {
    elements = {
        productsGrid: document.getElementById("productsGrid"),
        adminProductsTable: document.getElementById("adminProductsTable"),
        ordersTable: document.getElementById("ordersTable"),
        loginModal: document.getElementById("loginModal"),
        orderModal: document.getElementById("orderModal"),
        deleteModal: document.getElementById("deleteModal"),
        editModal: document.getElementById("editModal"),
        adminDashboard: document.getElementById("adminDashboard"),
        adminSidebar: document.getElementById("adminSidebar"),
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
    try {
        const appModule = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
        const fsModule = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

        fb = fsModule;
        const app = appModule.initializeApp(firebaseConfig);
        db = fsModule.getFirestore(app);

        listenProducts();
        listenOrders();
        listenAdminSettings();
    } catch (error) {
        console.error("Firebase init xatosi:", error);
        showToast("Firebase ulanishida xatolik. Internetni tekshiring.", "error");
    }
}

function listenAdminSettings() {
    if (!db || !fb) return;

    fb.onSnapshot(
        fb.doc(db, "settings", "admin"),
        (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data?.password) {
                    adminPassword = data.password;
                }
            }
        },
        (error) => {
            console.error("Admin sozlamalarini o'qishda xatolik:", error);
        }
    );
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
    bindById("adminLoginBtn", "click", openAdminLogin);
    bindById("heroAdminBtn", "click", openAdminLogin);
    bindById("logoutAdminBtn", "click", closeAdminDashboard);
    bindById("sidebarToggleBtn", "click", toggleSidebar);
    bindById("cancelEditBtn", "click", cancelEditProduct);
    bindById("changePasswordBtn", "click", openPasswordModal);

    bindEl(elements.loginForm, "submit", checkAdminPassword, "loginForm");
    bindEl(elements.productForm, "submit", addProduct, "productForm");
    bindEl(elements.editForm, "submit", updateProduct, "editForm");
    bindEl(elements.orderForm, "submit", submitOrder, "orderForm");
    bindEl(elements.passwordForm, "submit", changeAdminPassword, "passwordForm");
    bindEl(elements.confirmDeleteBtn, "click", confirmDelete, "confirmDeleteBtn");

    bindEl(elements.productSearch, "input", (event) => {
        productSearch = event.target.value.trim().toLowerCase();
        renderAdminProducts();
    }, "productSearch");

    bindEl(elements.categoryFilter, "change", (event) => {
        categoryFilter = event.target.value;
        renderAdminProducts();
    }, "categoryFilter");

    document.querySelectorAll("[data-admin-section]").forEach((button) => {
        button.addEventListener("click", () => switchAdminSection(button.dataset.adminSection));
    });

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
            if (elements.editModal?.classList.contains("show")) {
                cancelEditProduct();
            } else {
                closeAllModals();
                elements.adminSidebar.classList.remove("open");
            }
        }
    });

    document.addEventListener("click", (event) => {
        const orderButton = event.target.closest("[data-order-id]");
        if (orderButton && !orderButton.disabled) {
            openOrderModal(orderButton.dataset.orderId);
            return;
        }

        const editButton = event.target.closest("[data-edit-id]");
        if (editButton) {
            startEditProduct(editButton.dataset.editId);
            return;
        }

        const deleteProductButton = event.target.closest("[data-delete-product]");
        if (deleteProductButton) {
            requestDelete("product", deleteProductButton.dataset.deleteProduct);
            return;
        }

        const deleteOrderButton = event.target.closest("[data-delete-order]");
        if (deleteOrderButton) {
            requestDelete("order", deleteOrderButton.dataset.deleteOrder);
        }
    });
}

function listenProducts() {
    if (!db || !fb) return;

    const productsQuery = fb.query(fb.collection(db, "products"), fb.orderBy("createdAt", "desc"));

    fb.onSnapshot(
        productsQuery,
        (snapshot) => {
            products = snapshot.docs.map((item) => ({
                id: item.id,
                ...item.data()
            }));
            renderProducts();
            renderAdminProducts();
            renderStats();
        },
        (error) => {
            console.error("Mahsulotlarni o'qishda xatolik:", error);
            showToast("Mahsulotlarni yuklashda xatolik", "error");
        }
    );
}

function listenOrders() {
    if (!db || !fb) return;

    const ordersQuery = fb.query(fb.collection(db, "orders"), fb.orderBy("createdAt", "desc"));

    fb.onSnapshot(
        ordersQuery,
        (snapshot) => {
            orders = snapshot.docs.map((item) => ({
                id: item.id,
                ...item.data()
            }));
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
    elements.productsGrid.innerHTML = "";

    if (products.length === 0) {
        elements.productsGrid.innerHTML = '<div class="empty-state">Hozircha mahsulot yo\'q</div>';
        return;
    }

    products.forEach((product, index) => {
        const isAvailable = product.status === "mavjud";
        const card = document.createElement("article");
        card.className = `product-card${isAvailable ? "" : " sold-out"}`;
        card.style.transitionDelay = `${Math.min(index * 70, 420)}ms`;
        card.style.animationDelay = `${(index % 3) * 0.8}s`;

        const media = product.imageUrl
            ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.style.display='none'">`
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
                <button class="btn full" type="button" data-order-id="${escapeHtml(product.id)}" ${isAvailable ? "" : "disabled"}>
                    ${isAvailable ? "Zakaz qilish" : "Tugagan"}
                </button>
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
    const filtered = getFilteredProducts();
    elements.adminProductsTable.innerHTML = "";

    if (filtered.length === 0) {
        elements.adminProductsTable.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color: var(--muted); font-weight:700; padding: 28px;">
                    Mahsulot topilmadi
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach((product) => {
        const row = document.createElement("tr");
        const isAvailable = product.status === "mavjud";

        row.innerHTML = `
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
                    <button class="icon-btn edit" type="button" data-edit-id="${escapeHtml(product.id)}" aria-label="Tahrirlash" title="Tahrirlash">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M4 20h1.5L17 8.5 14.5 6 3 17.5V20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="icon-btn danger" type="button" data-delete-product="${escapeHtml(product.id)}" aria-label="O'chirish" title="O'chirish">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </td>
        `;

        elements.adminProductsTable.appendChild(row);
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
    });
}

function renderStats() {
    const totalProducts = products.length;
    const availableProducts = products.filter((p) => p.status === "mavjud").length;
    const soldOutProducts = products.filter((p) => p.status === "tugagan").length;
    const totalOrders = orders.length;

    elements.statTotalProducts.textContent = totalProducts;
    elements.statAvailableProducts.textContent = availableProducts;
    elements.statSoldOutProducts.textContent = soldOutProducts;
    elements.statTotalOrders.textContent = totalOrders;

    if (elements.heroProductCount) {
        elements.heroProductCount.textContent = `${totalProducts}`;
    }
}

async function addProduct(event) {
    event.preventDefault();

    if (!db) {
        showToast("Firebase ulanmagan", "error");
        return;
    }

    const data = readForm("add");
    if (!data) return;

    const submitBtn = elements.productForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
        await fb.addDoc(fb.collection(db, "products"), {
            name: data.name,
            price: data.price,
            category: data.category,
            imageUrl: data.imageUrl,
            description: data.description,
            status: data.status,
            createdAt: fb.serverTimestamp(),
            updatedAt: fb.serverTimestamp()
        });

        resetProductForm();
        showToast("Mahsulot qo'shildi", "success");
    } catch (error) {
        console.error("Mahsulot qo'shishda xatolik:", error);
        showToast("Mahsulot qo'shilmadi", "error");
    } finally {
        submitBtn.disabled = false;
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
    elements.editImage.value = product.imageUrl || "";
    elements.editDescription.value = product.description || "";
    elements.editFormError.textContent = "";
    elements.editTitle.textContent = `"${product.name}" ni tahrirlash`;

    openModal(elements.editModal);
    setTimeout(() => elements.editName.focus(), 120);
}

async function updateProduct(event) {
    event.preventDefault();

    if (!db || !editingProductId) {
        showToast("Tahrirlash bekor qilindi", "error");
        return;
    }

    const data = readForm("edit");
    if (!data) return;

    const submitBtn = elements.editForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
        await fb.updateDoc(fb.doc(db, "products", editingProductId), {
            name: data.name,
            price: data.price,
            category: data.category,
            imageUrl: data.imageUrl,
            description: data.description,
            status: data.status,
            updatedAt: fb.serverTimestamp()
        });

        editingProductId = null;
        closeModal(elements.editModal);
        showToast("Mahsulot yangilandi", "success");
    } catch (error) {
        console.error("Mahsulot yangilashda xatolik:", error);
        showToast("Mahsulot yangilanmadi", "error");
    } finally {
        submitBtn.disabled = false;
    }
}

function cancelEditProduct() {
    editingProductId = null;
    elements.editForm.reset();
    elements.editFormError.textContent = "";
    closeModal(elements.editModal);
}

function resetProductForm() {
    elements.productForm.reset();
    elements.productCategory.value = "Erkaklar";
    elements.productStatus.value = "mavjud";
    elements.productFormError.textContent = "";
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

    const name = nameEl.value.trim();
    const priceRaw = priceEl.value.trim();
    const category = catEl.value;
    const imageUrl = imageEl.value.trim();
    const description = descEl.value.trim();
    const status = statusEl.value;

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

    errorEl.textContent = "";
    return { name, price, category, imageUrl, description, status };
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
    if (!db || !deleteTarget) return;

    const { type, id } = deleteTarget;
    elements.confirmDeleteBtn.disabled = true;

    try {
        if (type === "product") {
            await fb.deleteDoc(fb.doc(db, "products", id));
            if (editingProductId === id) {
                cancelEditProduct();
            }
            showToast("Mahsulot o'chirildi", "info");
        } else {
            await fb.deleteDoc(fb.doc(db, "orders", id));
            showToast("Zakaz o'chirildi", "info");
        }

        closeModal(elements.deleteModal);
        deleteTarget = null;
    } catch (error) {
        console.error("O'chirishda xatolik:", error);
        showToast("O'chirish amalga oshmadi", "error");
    } finally {
        elements.confirmDeleteBtn.disabled = false;
    }
}

function openAdminLogin() {
    if (!elements.loginModal) {
        elements = elements || {};
        elements.loginModal = document.getElementById("loginModal");
        elements.adminPassword = document.getElementById("adminPassword");
        elements.loginError = document.getElementById("loginError");
    }

    if (!elements.loginModal) {
        console.error("Login modal topilmadi");
        return;
    }

    if (elements.loginError) elements.loginError.textContent = "";
    if (elements.adminPassword) elements.adminPassword.value = "";
    openModal(elements.loginModal);
    setTimeout(() => elements.adminPassword?.focus(), 120);
}

window.openAdminLogin = openAdminLogin;

function checkAdminPassword(event) {
    event.preventDefault();

    if (elements.adminPassword.value.trim() === adminPassword) {
        elements.loginError.textContent = "";
        closeModal(elements.loginModal);
        openAdminDashboard();
        return;
    }

    elements.loginError.textContent = "Parol noto'g'ri";
    showToast("Parol noto'g'ri", "error");
}

function openPasswordModal() {
    elements.passwordForm.reset();
    elements.passwordFormError.textContent = "";
    openModal(elements.passwordModal);
    setTimeout(() => elements.currentPassword.focus(), 120);
}

async function changeAdminPassword(event) {
    event.preventDefault();

    const current = elements.currentPassword.value.trim();
    const next = elements.newPassword.value.trim();
    const confirm = elements.confirmPassword.value.trim();

    if (!current || !next || !confirm) {
        elements.passwordFormError.textContent = "Barcha maydonlarni to'ldiring";
        showToast("Barcha maydonlarni to'ldiring", "error");
        return;
    }

    if (current !== adminPassword) {
        elements.passwordFormError.textContent = "Joriy parol noto'g'ri";
        showToast("Joriy parol noto'g'ri", "error");
        return;
    }

    if (next.length < 4) {
        elements.passwordFormError.textContent = "Yangi parol kamida 4 ta belgi bo'lishi kerak";
        showToast("Parol juda qisqa", "error");
        return;
    }

    if (next !== confirm) {
        elements.passwordFormError.textContent = "Yangi parollar mos kelmadi";
        showToast("Parollar mos kelmadi", "error");
        return;
    }

    if (next === current) {
        elements.passwordFormError.textContent = "Yangi parol joriydan farq qilishi kerak";
        showToast("Yangi parol bir xil", "error");
        return;
    }

    if (!db) {
        showToast("Firebase ulanmagan", "error");
        return;
    }

    const submitBtn = elements.passwordForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
        await fb.setDoc(fb.doc(db, "settings", "admin"), {
            password: next,
            updatedAt: fb.serverTimestamp()
        }, { merge: true });

        adminPassword = next;
        elements.passwordFormError.textContent = "";
        closeModal(elements.passwordModal);
        showToast("Parol muvaffaqiyatli yangilandi", "success");
    } catch (error) {
        console.error("Parolni o'zgartirishda xatolik:", error);
        elements.passwordFormError.textContent = "Parolni saqlashda xatolik";
        showToast("Parol yangilanmadi", "error");
    } finally {
        submitBtn.disabled = false;
    }
}

function openAdminDashboard() {
    elements.adminDashboard.classList.add("show");
    elements.adminDashboard.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    switchAdminSection("stats");
    renderStats();
}

function closeAdminDashboard() {
    elements.adminDashboard.classList.remove("show");
    elements.adminDashboard.setAttribute("aria-hidden", "true");
    elements.adminSidebar.classList.remove("open");
    document.body.classList.remove("modal-open");
    cancelEditProduct();
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
        elements.adminPageTitle.textContent = meta.title;
        elements.adminPageDesc.textContent = meta.desc;
    }

    elements.adminSidebar.classList.remove("open");
}

function toggleSidebar() {
    elements.adminSidebar.classList.toggle("open");
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

    if (!db) {
        showToast("Firebase ulanmagan", "error");
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
    const adminOpen = elements.adminDashboard.classList.contains("show");

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
