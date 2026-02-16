const WHATSAPP_NUMBER = "97474798035";

function getSlug() {
  const cleanedPath = window.location.pathname.replace(/^\/+/, "");
  const parts = cleanedPath.split("/");

  if (parts[0] === "r") {
    return parts[1] || null;
  }

  return null;
}

const SLUG = getSlug();

let products = [];
let categories = [];
let currentCategory = null;
let restaurantData = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  if (!SLUG) {
    document.body.innerHTML = "<h2>Invalid restaurant</h2>";
    return;
  }

  await loadRestaurant();
  await loadCategories();
  await loadProducts();
}

/* ================= RESTAURANT ================= */
async function loadRestaurant() {
  const res = await fetch(`/api/restaurant/${SLUG}?t=${Date.now()}`);
  restaurantData = await res.json();

  if (!restaurantData) {
    document.body.innerHTML = "<h2>Restaurant not found</h2>";
    return;
  }

  document.getElementById("restaurantName").innerText = restaurantData.name;

  if (restaurantData.logo) {
    document.getElementById("logo").src = "/" + restaurantData.logo;
  }

  document.documentElement.style.setProperty(
    "--theme",
    restaurantData.theme_color || "#000",
  );
}

/* ================= CATEGORIES ================= */
async function loadCategories() {
  // const res = await fetch(`/api/categories/${SLUG}`);
  const res = await fetch(`/api/categories/${SLUG}?t=${Date.now()}`);

  categories = await res.json();

  const bar = document.getElementById("categories");
  bar.innerHTML = "";

  categories.forEach((cat, index) => {
    const btn = document.createElement("button");
    btn.className = "category-btn";
    btn.textContent = cat.name;

    if (index === 0) {
      currentCategory = cat.id;
      btn.classList.add("active");
    }

    btn.onclick = () => {
      document
        .querySelectorAll(".category-btn")
        .forEach((b) => b.classList.remove("active"));

      btn.classList.add("active");
      currentCategory = cat.id;
      renderProducts();
    };

    bar.appendChild(btn);
  });
}

/* ================= PRODUCTS ================= */
async function loadProducts() {
  // const res = await fetch(`/api/products/${SLUG}`);
  const res = await fetch(`/api/products/${SLUG}?t=${Date.now()}`);
  products = await res.json();
  renderProducts();
}

function renderProducts(query = "") {
  const container = document.getElementById("items");
  container.innerHTML = "";

  let filtered;

  if (query) {
    // 🔥 SEARCH ENTIRE MENU
    filtered = products.filter((p) =>
      p.name_en.toLowerCase().includes(query.toLowerCase()),
    );

    // remove active category highlight while searching
    document
      .querySelectorAll(".category-btn")
      .forEach((b) => b.classList.remove("active"));
  } else {
    // 🔥 NORMAL CATEGORY FILTER
    filtered = products.filter(
      (p) => Number(p.category_id) === Number(currentCategory),
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = "<p>No items found</p>";
    return;
  }

  filtered.forEach((p) => {
    const card = document.createElement("div");
    card.className = "item-card";

    card.innerHTML = `
  <img 
    src="${p.image ? "/" + p.image : "/placeholder.png"}"
    alt="${p.name_en}"
  />

  <div class="item-info">
    <div class="item-name">${p.name_en}</div>

    ${p.name_ar ? `<div class="item-name-ar">${p.name_ar}</div>` : ""}

    <div class="qty-wrapper">
      <button class="qty-btn" onclick="decreaseQty(${p.id})">−</button>
      <span class="qty-value" id="qty-${p.id}">1</span>
      <button class="qty-btn" onclick="increaseQty(${p.id})">+</button>
    </div>

    <button class="whatsapp-btn"
      onclick="sendWhatsAppOrder(${p.id}, \`${p.name_en}\`)">
      Order Now
    </button>
  </div>
`;

    container.appendChild(card);
  });
}

function increaseQty(id) {
  const el = document.getElementById(`qty-${id}`);
  let value = parseInt(el.innerText);
  el.innerText = value + 1;
}

function decreaseQty(id) {
  const el = document.getElementById(`qty-${id}`);
  let value = parseInt(el.innerText);
  if (value > 1) {
    el.innerText = value - 1;
  }
}

/* ================= WHATSAPP ================= */

function sendWhatsAppOrder(id, name) {
  const qtyEl = document.getElementById(`qty-${id}`);
  const quantity = qtyEl ? qtyEl.innerText : 1;

  // Get selected category name
  const selectedCategory = categories.find(
    (cat) => Number(cat.id) === Number(currentCategory),
  );

  const categoryName = selectedCategory ? selectedCategory.name : "General";

  const message = `Hello, I want to order:

Category: ${categoryName}
Item: ${name}
Qty: ${quantity}

Thank you`;

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank");
}

/* ================= SEARCH ================= */
document.getElementById("searchInput").addEventListener("input", (e) => {
  renderProducts(e.target.value);
});
