// const WHATSAPP_NUMBER = "97474798035";

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
let currentThemeColor = '#b11226'; // default fallback

document.addEventListener("DOMContentLoaded", init);

async function init() {
  if (!SLUG) {
    document.body.innerHTML = "<h2>Invalid restaurant</h2>";
    return;
  }

  showLoading(true);
  await loadRestaurant();
  await loadCategories();
  await loadProducts();
  showLoading(false);
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  const categories = document.getElementById('categories');
  const items = document.getElementById('items');

  if (show) {
    loading.style.display = 'block';
    categories.style.display = 'none';
    items.style.display = 'none';
  } else {
    loading.style.display = 'none';
    categories.style.display = 'flex';
    items.style.display = 'grid';
  }
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

  // Set theme color from restaurant settings
  let themeColor = restaurantData.theme_color || "#b11226";
  if (!themeColor.startsWith('#')) {
    themeColor = '#' + themeColor;
  }
  currentThemeColor = themeColor;
  document.documentElement.style.setProperty("--theme", themeColor);

  // Calculate darker variant for gradients
  const darkerColor = adjustColorBrightness(themeColor, -30);
  document.documentElement.style.setProperty("--theme-dark", darkerColor);

  // Create semi-transparent tint for backgrounds
  const rgb = hexToRgb(themeColor);
  if (rgb) {
  // Set theme color from restaurant settings
  let themeColor = restaurantData.theme_color || "#b11226";
  if (!themeColor.startsWith('#')) {
    themeColor = '#' + themeColor;
  }
  document.documentElement.style.setProperty("--theme", themeColor);

  // Calculate darker variant for gradients
  const darkerColor = adjustColorBrightness(themeColor, -30);
  document.documentElement.style.setProperty("--theme-dark", darkerColor);

  // Create semi-transparent tint variants for shadows/borders
  const rgb = hexToRgb(themeColor);
  if (rgb) {
    document.documentElement.style.setProperty("--theme-light", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
    document.documentElement.style.setProperty("--theme-alpha-08", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`);
    document.documentElement.style.setProperty("--theme-alpha-15", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
    document.documentElement.style.setProperty("--theme-alpha-20", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.20)`);
    document.documentElement.style.setProperty("--theme-alpha-30", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.30)`);
    document.documentElement.style.setProperty("--theme-alpha-35", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
  }
}
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function adjustColorBrightness(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
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

    const hasImage = p.image && p.image.trim() !== '';
    const wrapperClass = hasImage ? '' : ' has-placeholder';
    const imgHtml = hasImage ?
      `<img src="/${p.image}" alt="${p.name_en}" onerror="this.parentElement.classList.add('has-placeholder');">` :
      '';

    card.innerHTML = `
<div class="card-image-wrapper${wrapperClass}">
  <div class="image-placeholder">No Image</div>
  ${imgHtml}
</div>

<div class="item-info">
  <div class="item-name">${p.name_en}</div>

  ${p.name_ar ? `<div class="item-name-ar">${p.name_ar}</div>` : ""}

  <div class="item-price">QR ${p.price}</div>

   <div class="qty-wrapper">
     <button class="qty-btn qty-minus" onclick="decreaseQty(${p.id})">−</button>
     <span class="qty-value" id="qty-${p.id}">1</span>
     <button class="qty-btn qty-plus" onclick="increaseQty(${p.id})">+</button>
   </div>

   <button class="whatsapp-btn" onclick="sendWhatsAppOrder(${p.id}, \`${p.name_en}\`)">
     <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px;">
       <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
     </svg>
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

  const selectedCategory = categories.find(
    (cat) => Number(cat.id) === Number(currentCategory),
  );

  const categoryName = selectedCategory ? selectedCategory.name : "General";

  const message = `Hello, I want to order:

Category: ${categoryName}
Item: ${name}
Qty: ${quantity}

Thank you`;

  const number = restaurantData.whatsapp_number || "";
  if (!number) {
    alert("Restaurant WhatsApp not set");
    return;
  }

  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank");
}

/* ================= SEARCH ================= */
const search = document.getElementById("searchInput");
if (search) {
  search.addEventListener("input", (e) => {
    renderProducts(e.target.value);
  });

  // Dismiss keyboard on blur
  search.addEventListener('blur', () => {
    search.focus();
  });
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function adjustColorBrightness(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}
