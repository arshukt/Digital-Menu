// import fs from "fs";
import xlsx from "xlsx";

const workbook = xlsx.readFile("menu.xlsx");
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const rows = xlsx.utils.sheet_to_json(sheet);

const menu = {
  restaurant: {
    name: "Demo Restaurant",
    currency: "₹",
    themeColor: "#7f0f87",
  },
  categories: [],
};

const categoryMap = {};

rows.forEach((row) => {
  const categoryName = row.category.trim().toLowerCase();
  const productName = row[Object.keys(row)[1]];
  const price = row[Object.keys(row)[2]];

  if (!categoryMap[categoryName]) {
    categoryMap[categoryName] = {
      name: categoryName,
      items: [],
    };
  }

  categoryMap[categoryName].items.push({
    name: productName,
    price: price,
  });
});

menu.categories = Object.values(categoryMap);

fs.writeFileSync("menu.json", JSON.stringify(menu, null, 2));

console.log("✅ Excel imported and menu.json generated");
