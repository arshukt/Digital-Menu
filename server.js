const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const XLSX = require("xlsx");
const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const ADMIN_KEY = "250235";

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use("/uploads", express.static("uploads"));

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
const dbPath = path.join(__dirname, "menu.db");
const db = new sqlite3.Database(dbPath);

/* ================= DATABASE ================= */

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      slug TEXT UNIQUE,
      whatsapp_number TEXT,
      theme_color TEXT,
      currency TEXT,
      logo TEXT
    )
  `);

  db.all("PRAGMA table_info(restaurants)", [], (err, cols) => {
    if (err || !cols || !cols.some(c => c.name === "tables_enabled")) {
      db.run("ALTER TABLE restaurants ADD COLUMN tables_enabled INTEGER DEFAULT 0");
    }
  });

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

  db.run(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      restaurant_id INTEGER,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    )
  `);
});

/* ================= SECURITY ================= */

function checkAdmin(req, res, next) {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).send("Unauthorized");
  }

  next();
}

/* ================= RESTAURANTS ================= */

app.post("/api/restaurants", checkAdmin, (req, res) => {
  const { name, slug, whatsapp_number, theme_color, currency } = req.body;

  db.run(
    `INSERT INTO restaurants
    (name, slug, whatsapp_number, theme_color, currency)
    VALUES (?,?,?,?,?)`,
    [name, slug, whatsapp_number, theme_color || "#000", currency || "QAR"],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ success: true });
    },
  );
});

app.get("/api/restaurants", checkAdmin, (req, res) => {
  db.all(`SELECT * FROM restaurants`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json(rows);
  });
});

app.get("/api/restaurant/:slug", (req, res) => {
  db.get(
    `SELECT * FROM restaurants WHERE slug=?`,
    [req.params.slug],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Database error" });

      if (!row) return res.status(404).json({ error: "Restaurant not found" });

      res.json(row);
    },
  );
});

/* ===== UPDATE WHATSAPP NUMBER ===== */

app.put("/api/restaurant-whatsapp/:slug", checkAdmin, (req, res) => {
  const { whatsapp_number } = req.body;

  if (!whatsapp_number)
    return res.status(400).json({ error: "Number required" });

  db.run(
    `UPDATE restaurants SET whatsapp_number=? WHERE slug=?`,
    [whatsapp_number, req.params.slug],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ success: true });
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
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json(rows);
    },
  );
});

app.post("/api/categories/:slug", checkAdmin, (req, res) => {
  db.get(
    `SELECT id FROM restaurants WHERE slug=?`,
    [req.params.slug],
    (err, r) => {
      if (!r) return res.status(404).json({ error: "Restaurant not found" });

      db.run(
        `INSERT INTO categories (name, restaurant_id)
         VALUES (?,?)`,
        [req.body.name.trim(), r.id],
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
    [name.trim(), req.params.id],
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
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json(rows);
    },
  );
});

app.post(
  "/api/products/:slug",
  checkAdmin,
  upload.single("image"),
  (req, res) => {
    const { name_en, name_ar, price, category_id } = req.body;

    db.get(
      `SELECT * FROM restaurants WHERE slug=?`,
      [req.params.slug],
      (err, r) => {
        if (!r) return res.status(404).json({ error: "Restaurant not found" });

        const imagePath = req.file
          ? `uploads/${req.file.filename}`
          : generateImage(name_en, r.theme_color);

        db.run(
          `INSERT INTO products
           (name_en,name_ar,price,category_id,restaurant_id,image)
           VALUES (?,?,?,?,?,?)`,
          [name_en, name_ar, price, category_id, r.id, imagePath],
          () => res.json({ success: true }),
        );
      },
    );
  },
);

app.put("/api/products/:id", checkAdmin, upload.single("image"), (req, res) => {
  const { name_en, name_ar, price, category_id } = req.body;

  if (!name_en || !price || !category_id)
    return res.status(400).json({ error: "Missing fields" });

  let imagePath = req.file ? `uploads/${req.file.filename}` : null;

  const query = imagePath
    ? `UPDATE products SET name_en=?, name_ar=?, price=?, category_id=?, image=? WHERE id=?`
    : `UPDATE products SET name_en=?, name_ar=?, price=?, category_id=? WHERE id=?`;

  const params = imagePath
    ? [name_en, name_ar, price, category_id, imagePath, req.params.id]
    : [name_en, name_ar, price, category_id, req.params.id];

  db.run(query, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });

    res.json({ success: true });
  });
});

app.delete("/api/categories/:id", checkAdmin, (req, res) => {
  const id = req.params.id;

  db.run("DELETE FROM products WHERE category_id=?", [id], () => {
    db.run("DELETE FROM categories WHERE id=?", [id], () => {
      res.json({ success: true });
    });
  });
});
/* ================= LOGO ================= */

app.post(
  "/api/upload-logo/:slug",
  checkAdmin,
  upload.single("logo"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    db.run(
      `UPDATE restaurants SET logo=? WHERE slug=?`,
      [`uploads/${req.file.filename}`, req.params.slug],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({ success: true });
      },
    );
  },
);

/* ================= IMPORT EXCEL ================= */

app.post(
  "/api/import-excel/:slug",
  checkAdmin,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      db.get(
        "SELECT * FROM restaurants WHERE slug=?",
        [req.params.slug],
        async (err, restaurant) => {
          if (!restaurant)
            return res.status(404).json({ error: "Restaurant not found" });

          // 👉 STEP 1: Create categories
          for (const row of rows) {
            if (!row.category) continue;

            const name = row.category.trim().toLowerCase();

            await new Promise((resolve) => {
              db.run(
                `INSERT OR IGNORE INTO categories (name, restaurant_id) VALUES (?, ?)`,
                [name, restaurant.id],
                resolve,
              );
            });
          }

          // 👉 STEP 2: Insert products
          for (const row of rows) {
            if (!row.category || !row.name_en || !row.price) continue;

            const categoryName = row.category.trim().toLowerCase();

            const cat = await new Promise((resolve) => {
              db.get(
                `SELECT id FROM categories WHERE name=? AND restaurant_id=?`,
                [categoryName, restaurant.id],
                (err, row) => resolve(row),
              );
            });

            if (!cat) continue;

            const imagePath = generateImage(
              row.name_en,
              restaurant.theme_color,
            );

            await new Promise((resolve) => {
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
                ],
                resolve,
              );
            });
          }

          res.json({ success: true });
        },
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },
);

/* ================= TABLES ================= */

app.get("/api/tables/:slug", checkAdmin, (req, res) => {
  db.all(
    `SELECT t.*
     FROM tables t
     JOIN restaurants r ON t.restaurant_id=r.id
     WHERE r.slug=?`,
    [req.params.slug],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    },
  );
});

app.post("/api/tables/:slug", checkAdmin, (req, res) => {
  const { name, restaurant_id } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ error: "Table name required" });

  db.run(
    `INSERT INTO tables (name, restaurant_id) VALUES (?,?)`,
    [name.trim(), restaurant_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    },
  );
});

app.put("/api/tables/:id", checkAdmin, (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ error: "Table name required" });

  db.run(
    "UPDATE tables SET name=? WHERE id=?",
    [name.trim(), req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    },
  );
});

app.delete("/api/tables/:id", checkAdmin, (req, res) => {
  db.run("DELETE FROM tables WHERE id=?", [req.params.id], () =>
    res.json({ success: true }),
  );
});

app.get("/api/tables-public/:slug", (req, res) => {
  db.all(
    `SELECT t.*, r.tables_enabled
     FROM tables t
     JOIN restaurants r ON t.restaurant_id=r.id
     WHERE r.slug=?`,
    [req.params.slug],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      if (rows.length === 0) {
        db.get(
          `SELECT tables_enabled FROM restaurants WHERE slug=?`,
          [req.params.slug],
          (err2, r) => {
            res.json({ tables: [], tables_enabled: r ? (r.tables_enabled || 0) : 0 });
          },
        );
        return;
      }

      res.json({
        tables: rows,
        tables_enabled: rows[0].tables_enabled || 0,
      });
    },
  );
});

/* ================= DELETE ================= */
app.delete("/api/products/:id", checkAdmin, (req, res) => {
  db.run("DELETE FROM products WHERE id=?", [req.params.id], () =>
    res.json({ success: true }),
  );
});

app.put("/api/restaurant-tables-settings/:slug", checkAdmin, (req, res) => {
  const { tables_enabled } = req.body;

  if (typeof tables_enabled !== "number" && typeof tables_enabled !== "boolean")
    return res.status(400).json({ error: "Invalid value" });

  const val = tables_enabled ? 1 : 0;

  db.run(
    `UPDATE restaurants SET tables_enabled=? WHERE slug=?`,
    [val, req.params.slug],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    },
  );
});

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

/* ================= ERROR ================= */

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
