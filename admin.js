/* ================= INIT VARIABLES ================= */

let editingCategoryId = null;
let editingProductId = null;
let allProducts = [];

function showToast(message) {
  const toast = document.createElement("div");
  toast.innerText = message;

  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "#333";
  toast.style.color = "#fff";
  toast.style.padding = "10px 16px";
  toast.style.borderRadius = "8px";
  toast.style.fontSize = "14px";
  toast.style.zIndex = "9999";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.3s ease";

  document.body.appendChild(toast);

  setTimeout(() => (toast.style.opacity = "1"), 10);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function getSlug() {
  const cleanedPath = window.location.pathname.replace(/^\/+/, "");
  const parts = cleanedPath.split("/");

  if (parts[0] === "admin") {
    return parts[1] || null;
  }

  return null;
}

function getKey() {
  return new URLSearchParams(window.location.search).get("key");
}

const SLUG = getSlug();
const ADMIN_KEY = getKey();

/* ================= SAFE START ================= */

document.addEventListener("DOMContentLoaded", () => {
  if (!SLUG || !ADMIN_KEY) {
    document.body.innerHTML = "<h2>Unauthorized</h2>";
    return;
  }

  setupEvents();
  loadCategories();
  loadProducts();
  loadRestaurant();

  // Admin Search
  const searchInput = document.getElementById("adminProductSearch");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      const query = this.value.trim().toLowerCase();

      if (!query) {
        renderProducts();
        return;
      }

      const filtered = allProducts.filter((p) =>
        p.name_en.toLowerCase().includes(query),
      );

      renderFilteredProducts(filtered);
    });
  }
});

/* ================= EVENT SETUP ================= */

function setupEvents() {
  document.getElementById("addCategoryBtn").onclick = addCategory;
  document.getElementById("saveProductBtn").onclick = saveProduct;
  document.getElementById("uploadLogoBtn").onclick = uploadLogo;
  document.getElementById("importBtn").onclick = importExcel;
  document.getElementById("saveWhatsappBtn").onclick = saveWhatsapp;
}

/* ================= CATEGORIES ================= */

async function loadCategories() {
  try {
    const res = await fetch(`/api/categories/${SLUG}?t=${Date.now()}`);
    if (!res.ok) throw new Error();

    const categories = await res.json();

    const list = document.getElementById("categoryList");
    const select = document.getElementById("productCategory");

    list.innerHTML = "";
    select.innerHTML = "";

    categories.forEach((cat) => {
      const div = document.createElement("div");
      div.className = "card";

      const left = document.createElement("strong");
      left.textContent = cat.name;

      const right = document.createElement("div");

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.onclick = () => editCategory(cat.id, cat.name);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "delete";
      deleteBtn.onclick = () => deleteCategory(cat.id);

      right.appendChild(editBtn);
      right.appendChild(deleteBtn);

      div.appendChild(left);
      div.appendChild(right);
      list.appendChild(div);

      const option = document.createElement("option");
      option.value = cat.id;
      option.textContent = cat.name;
      select.appendChild(option);
    });
  } catch {
    alert("Failed to load categories");
  }
}

async function addCategory() {
  const nameInput = document.getElementById("newCategoryName");
  const name = nameInput.value.trim();
  if (!name) return alert("Category required");

  try {
    let res;

    if (editingCategoryId) {
      res = await fetch(
        `/api/categories/${editingCategoryId}?key=${ADMIN_KEY}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
    } else {
      res = await fetch(`/api/categories/${SLUG}?key=${ADMIN_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    }

    if (!res.ok) throw new Error();

    alert(editingCategoryId ? "Category updated" : "Category added");
    editingCategoryId = null;
    nameInput.value = "";
    await loadCategories();
    await loadProducts();
  } catch {
    alert("Operation failed");
  }
}

function editCategory(id, name) {
  editingCategoryId = id;
  document.getElementById("newCategoryName").value = name;
}

async function deleteCategory(id) {
  if (!confirm("Are you sure you want to delete this category?")) return;

  try {
    const res = await fetch(`/api/categories/${id}?key=${ADMIN_KEY}`, {
      method: "DELETE",
    });

    if (!res.ok) throw new Error();

    alert("Category deleted");
    await loadCategories();
  } catch {
    alert("Delete failed");
  }
  editingCategoryId = null;
}

/* ================= PRODUCTS ================= */

async function loadProducts() {
  try {
    const res = await fetch(`/api/products/${SLUG}?t=${Date.now()}`);
    if (!res.ok) throw new Error();

    allProducts = await res.json();
    renderProducts();
  } catch {
    alert("Failed to load products");
  }
}

function renderProducts() {
  renderFilteredProducts(allProducts);
}

function renderFilteredProducts(products) {
  const list = document.getElementById("productList");
  list.innerHTML = "";

  if (products.length === 0) {
    list.innerHTML = "<p>No products found</p>";
    return;
  }

  products.forEach((p) => {
    const div = document.createElement("div");
    div.className = "card";

    const left = document.createElement("strong");
    left.textContent = p.name_en;

    const right = document.createElement("div");

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = () =>
      editProduct(p.id, p.name_en, p.name_ar, p.price, p.category_id);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "delete";
    deleteBtn.onclick = () => deleteProduct(p.id);

    right.appendChild(editBtn);
    right.appendChild(deleteBtn);

    div.appendChild(left);
    div.appendChild(right);
    list.appendChild(div);
  });
}

async function saveProduct() {
  const btn = document.getElementById("saveProductBtn");
  btn.disabled = true;

  const name_en = document.getElementById("productName").value.trim();
  const name_ar = document.getElementById("productNameAr").value.trim();
  const price = document.getElementById("productPrice").value.trim();
  const category_id = document.getElementById("productCategory").value;
  const imageFile = document.getElementById("productImageFile").files[0];

  if (!name_en || !price || !category_id) {
    alert("Fill required fields");
    btn.disabled = false;
    return;
  }

  try {
    const formData = new FormData();
    formData.append("name_en", name_en);
    formData.append("name_ar", name_ar);
    formData.append("price", price);
    formData.append("category_id", category_id);

    if (imageFile) {
      formData.append("image", imageFile);
    }

    let url = editingProductId
      ? `/api/products/${editingProductId}?key=${ADMIN_KEY}`
      : `/api/products/${SLUG}?key=${ADMIN_KEY}`;

    let method = editingProductId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      body: formData,
    });

    if (!res.ok) throw new Error();

    alert(editingProductId ? "Product updated" : "Product added");

    editingProductId = null;
    await loadProducts();
    document.getElementById("productModal").style.display = "none";
  } catch (err) {
    alert("Save failed");
  }

  btn.disabled = false;
}

function editProduct(id, name_en, name_ar, price, category_id) {
  editingProductId = id;

  document.getElementById("productName").value = name_en;
  document.getElementById("productNameAr").value = name_ar || "";
  document.getElementById("productPrice").value = price;
  document.getElementById("productCategory").value = category_id;

  document.getElementById("productModal").style.display = "flex";
}

async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;

  try {
    const res = await fetch(`/api/products/${id}?key=${ADMIN_KEY}`, {
      method: "DELETE",
    });

    if (!res.ok) throw new Error();

    alert("Product deleted");
    await loadProducts();
  } catch {
    alert("Delete failed");
  }
}

/* ================= LOGO ================= */

async function uploadLogo() {
  const file = document.getElementById("logoFile").files[0];
  if (!file) return alert("Select logo");

  const formData = new FormData();
  formData.append("logo", file);

  try {
    const res = await fetch(`/api/upload-logo/${SLUG}?key=${ADMIN_KEY}`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error();

    alert("Logo uploaded successfully");
    location.reload();
  } catch {
    alert("Upload failed");
  }
}

async function saveWhatsapp() {
  const number = document.getElementById("restaurantWhatsapp").value.trim();

  if (!number) {
    alert("Enter WhatsApp number");
    return;
  }

  try {
    const res = await fetch(
      `/api/restaurant-whatsapp/${SLUG}?key=${ADMIN_KEY}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: number }),
      },
    );

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed");
      return;
    }

    alert("WhatsApp updated successfully");
  } catch {
    alert("Failed to update WhatsApp");
  }
}

/* ================= EXCEL ================= */

async function importExcel() {
  const file = document.getElementById("excelFile").files[0];
  if (!file) return alert("Select Excel file");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`/api/import-excel/${SLUG}?key=${ADMIN_KEY}`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error();

    alert("Excel imported successfully");

    await loadCategories();
    await loadProducts();
  } catch {
    alert("Import failed");
  }
}

async function loadRestaurant() {
  const res = await fetch(`/api/restaurant/${SLUG}`);
  const data = await res.json();

  if (data.logo) {
    document.getElementById("currentLogo").src =
      "/" + data.logo + "?t=" + Date.now();
  }

  if (data.whatsapp_number) {
    document.getElementById("restaurantWhatsapp").value = data.whatsapp_number;
  }
}
