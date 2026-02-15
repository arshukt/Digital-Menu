import fs from "fs";
import path from "path";
import { createCanvas } from "canvas";

// Paths
const menuPath = "./menu.json";
const imagesDir = "./images";

// Read menu.json
const menu = JSON.parse(fs.readFileSync(menuPath, "utf-8"));

// Create images folder if not exists
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
  console.log("📁 images folder created");
}

// Utility: Darken hex color
function darkenColor(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);

  const R = (num >> 16) - amt;
  const G = ((num >> 8) & 0x00ff) - amt;
  const B = (num & 0x0000ff) - amt;

  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 0 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

// Generate images
menu.categories.forEach((category) => {
  category.items.forEach((item) => {
    const fileName =
      item.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") + ".jpg";

    const imagePath = path.join(imagesDir, fileName);

    const canvas = createCanvas(400, 300);
    const ctx = canvas.getContext("2d");

    const themeColor = menu.restaurant.themeColor || "#b11226";
    const darkerColor = darkenColor(themeColor, 25);

    // Dynamic gradient
    const gradient = ctx.createLinearGradient(0, 0, 400, 300);
    gradient.addColorStop(0, themeColor);
    gradient.addColorStop(1, darkerColor);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 300);

    // Text styling
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "bold 26px Arial";
    ctx.fillText(item.name, 200, 140, 340);

    ctx.font = "14px Arial";
    ctx.globalAlpha = 0.85;
    ctx.fillText("Fresh & Delicious", 200, 185);
    ctx.globalAlpha = 1;

    // Save image
    fs.writeFileSync(imagePath, canvas.toBuffer("image/jpeg"));

    item.image = `images/${fileName}`;

    console.log(`🖼️ generated: ${fileName}`);
  });
});

// Save updated menu.json
fs.writeFileSync(menuPath, JSON.stringify(menu, null, 2));
console.log("✅ Images generated with dynamic theme color");
