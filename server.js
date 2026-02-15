const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const XLSX = require("xlsx");
const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const ADMIN_KEY = "250235"; // 🔐 change this

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use("/uploads", express.static("uploads"));

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const upload = multer({ dest: "uploads/" });
const dbPath = path.join(__dirname, "menu.db");
const db = new sqlite3.Database(dbPath);

/* ================= DATABASE ================= */
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      slug TEXT UNIQUE,
      theme_color TEXT,
      currency TEXT,
      logo TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      restaurant_id INTEGER
    )
  `);

  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_category_unique
    ON categories(name, restaurant_id)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT,
      name_ar TEXT,
      price TEXT,
      category_id INTEGER,
      restaurant_id INTEGER,
      image TEXT
    )
  `);
});

/* ================= SECURITY ================= */
function checkAdmin(req, res, next) {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Unauthorized");
  next();
}

/* ================= RESTAURANT ================= */
app.post("/api/restaurants", checkAdmin, (req, res) => {
  const { name, slug, theme_color, currency } = req.body;

  db.run(
    `INSERT INTO restaurants (name, slug, theme_color, currency)
     VALUES (?,?,?,?)`,
    [name, slug, theme_color || "#000", currency || "QAR"],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    },
  );
});

app.get("/api/restaurants", checkAdmin, (req, res) => {
  db.all(`SELECT * FROM restaurants`, [], (err, rows) => res.json(rows));
});

app.get("/api/restaurant/:slug", (req, res) => {
  db.get(
    `SELECT * FROM restaurants WHERE slug=?`,
    [req.params.slug],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      if (!row) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      res.json(row);
    },
  );
});

/* ================= CATEGORIES ================= */
app.get("/api/categories/:slug", (req, res) => {
  db.all(
    `SELECT c.*
     FROM categories c
     JOIN restaurants r ON c.restaurant_id=r.id
     WHERE r.slug=?`,
    [req.params.slug],
    (err, rows) => res.json(rows),
  );
});

app.post("/api/categories/:slug", checkAdmin, (req, res) => {
  db.get(
    `SELECT id FROM restaurants WHERE slug=?`,
    [req.params.slug],
    (err, r) => {
      db.run(
        `INSERT INTO categories (name, restaurant_id)
         VALUES (?,?)`,
        [req.body.name.toLowerCase(), r.id],
        () => res.json({ success: true }),
      );
    },
  );
});

app.put("/api/categories/:id", checkAdmin, (req, res) => {
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: "Name required" });

  db.run(
    "UPDATE categories SET name=? WHERE id=?",
    [name.toLowerCase(), req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ success: true });
    },
  );
});

/* ================= PRODUCTS ================= */
app.get("/api/products/:slug", (req, res) => {
  db.all(
    `SELECT p.*
     FROM products p
     JOIN restaurants r ON p.restaurant_id=r.id
     WHERE r.slug=?`,
    [req.params.slug],
    (err, rows) => res.json(rows),
  );
});

app.post("/api/products/:slug", checkAdmin, (req, res) => {
  const { name_en, name_ar, price, category_id } = req.body;

  db.get(
    `SELECT * FROM restaurants WHERE slug=?`,
    [req.params.slug],
    (err, r) => {
      const img = generateImage(name_en, r.theme_color);

      db.run(
        `INSERT INTO products
         (name_en,name_ar,price,category_id,restaurant_id,image)
         VALUES (?,?,?,?,?,?)`,
        [name_en, name_ar, price, category_id, r.id, img],
        () => res.json({ success: true }),
      );
    },
  );
});

app.put("/api/products/:id", checkAdmin, (req, res) => {
  const { name_en, name_ar, price, category_id } = req.body;

  if (!name_en || !price || !category_id)
    return res.status(400).json({ error: "Missing fields" });

  db.run(
    `UPDATE products
     SET name_en=?, name_ar=?, price=?, category_id=?
     WHERE id=?`,
    [name_en, name_ar, price, category_id, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ success: true });
    },
  );
});

/* ================= LOGO ================= */
app.post(
  "/api/upload-logo/:slug",
  checkAdmin,
  upload.single("logo"),
  (req, res) => {
    db.run(
      `UPDATE restaurants SET logo=? WHERE slug=?`,
      [`uploads/${req.file.filename}`, req.params.slug],
      () => res.json({ success: true }),
    );
  },
);

app.post(
  "/api/import-excel/:slug",
  checkAdmin,
  upload.single("file"),
  async (req, res) => {
    if (!req.file)
      return res.status(400).json({ error: "No file uploaded" });

    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      db.get(
        "SELECT * FROM restaurants WHERE slug=?",
        [req.params.slug],
        (err, restaurant) => {
          if (err) return res.status(500).json({ error: err.message });
          if (!restaurant)
            return res.status(404).json({ error: "Restaurant not found" });

          db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            const categoryIds = {};

            rows.forEach((row) => {
              if (!row.category || !row.name_en || !row.price) return;

              const categoryName = row.category.trim().toLowerCase();

              if (!categoryIds[categoryName]) {
                db.run(
                  `INSERT OR IGNORE INTO categories (name, restaurant_id)
                   VALUES (?, ?)`,
                  [categoryName, restaurant.id]
                );
              }
            });

            rows.forEach((row) => {
              if (!row.category || !row.name_en || !row.price) return;

              const categoryName = row.category.trim().toLowerCase();

              db.get(
                `SELECT id FROM categories
                 WHERE name=? AND restaurant_id=?`,
                [categoryName, restaurant.id],
                (err, cat) => {
                  if (!cat) return;

                  const imagePath = generateImage(
                    row.name_en,
                    restaurant.theme_color
                  );

                  db.run(
                    `INSERT INTO products
                     (name_en, name_ar, price, category_id, restaurant_id, image)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                      row.name_en,
                      row.name_ar || "",
                      row.price,
                      cat.id,
                      restaurant.id,
                      imagePath,
                    ]
                  );
                }
              );
            });

            db.run("COMMIT", (err) => {
              if (err)
                return res.status(500).json({ error: err.message });

              res.json({ success: true });
            });
          });
        }
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ================= ROUTES ================= */
app.get("/r/:slug", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html")),
);

app.get("/admin/:slug", checkAdmin, (req, res) =>
  res.sendFile(path.join(__dirname, "admin.html")),
);

app.get("/super-admin", checkAdmin, (req, res) =>
  res.sendFile(path.join(__dirname, "super-admin.html")),
);

/* ================= DELETE CATEGORY ================= */
app.delete("/api/categories/:id", checkAdmin, (req, res) => {
  db.run("DELETE FROM categories WHERE id=?", [req.params.id], () =>
    res.json({ success: true }),
  );
});

/* ================= DELETE PRODUCT ================= */
app.delete("/api/products/:id", checkAdmin, (req, res) => {
  db.run("DELETE FROM products WHERE id=?", [req.params.id], () =>
    res.json({ success: true }),
  );
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(3000, () => console.log("🚀 SaaS Menu running on port 3000"));

/* ================= IMAGE GENERATOR ================= */
function generateImage(name, color) {
  const canvas = createCanvas(600, 400);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 600, 400);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 300, 200);

  const file = `uploads/${Date.now()}.png`;
  fs.writeFileSync(file, canvas.toBuffer());
  return file;
}
