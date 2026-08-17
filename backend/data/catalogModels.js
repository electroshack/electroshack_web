/**
 * Built-in shop catalog for "Did you mean?" ranking.
 * Newest-first within each family. Staff can ignore suggestions and keep typing.
 */
const CATALOG_MODELS = [
  { name: "iPhone 17 Pro Max", category: "cell-phone", family: "iphone" },
  { name: "iPhone 17 Pro", category: "cell-phone", family: "iphone" },
  { name: "iPhone 17", category: "cell-phone", family: "iphone" },
  { name: "iPhone 16 Pro Max", category: "cell-phone", family: "iphone" },
  { name: "iPhone 16 Pro", category: "cell-phone", family: "iphone" },
  { name: "iPhone 16 Plus", category: "cell-phone", family: "iphone" },
  { name: "iPhone 16", category: "cell-phone", family: "iphone" },
  { name: "iPhone 16e", category: "cell-phone", family: "iphone" },
  { name: "iPhone 15 Pro Max", category: "cell-phone", family: "iphone" },
  { name: "iPhone 15 Pro", category: "cell-phone", family: "iphone" },
  { name: "iPhone 15 Plus", category: "cell-phone", family: "iphone" },
  { name: "iPhone 15", category: "cell-phone", family: "iphone" },
  { name: "iPhone 14 Pro Max", category: "cell-phone", family: "iphone" },
  { name: "iPhone 14 Pro", category: "cell-phone", family: "iphone" },
  { name: "iPhone 14 Plus", category: "cell-phone", family: "iphone" },
  { name: "iPhone 14", category: "cell-phone", family: "iphone" },
  { name: "iPhone 13 Pro Max", category: "cell-phone", family: "iphone" },
  { name: "iPhone 13 Pro", category: "cell-phone", family: "iphone" },
  { name: "iPhone 13", category: "cell-phone", family: "iphone" },
  { name: "iPhone 13 mini", category: "cell-phone", family: "iphone" },
  { name: "iPhone SE (3rd generation)", category: "cell-phone", family: "iphone" },
  { name: "iPhone 12 Pro Max", category: "cell-phone", family: "iphone" },
  { name: "iPhone 12 Pro", category: "cell-phone", family: "iphone" },
  { name: "iPhone 12", category: "cell-phone", family: "iphone" },
  { name: "iPhone 11 Pro Max", category: "cell-phone", family: "iphone" },
  { name: "iPhone 11 Pro", category: "cell-phone", family: "iphone" },
  { name: "iPhone 11", category: "cell-phone", family: "iphone" },
  { name: "iPhone XR", category: "cell-phone", family: "iphone" },
  { name: "iPhone X", category: "cell-phone", family: "iphone" },
  { name: "iPhone 8 Plus", category: "cell-phone", family: "iphone" },
  { name: "iPhone 8", category: "cell-phone", family: "iphone" },

  { name: "Samsung Galaxy S25 Ultra", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy S25+", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy S25", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy S24 Ultra", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy S24+", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy S24", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy S23 Ultra", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy S23", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy S22 Ultra", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy S22", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy A55", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy A35", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy A15", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy Z Fold 6", category: "cell-phone", family: "samsung" },
  { name: "Samsung Galaxy Z Flip 6", category: "cell-phone", family: "samsung" },

  { name: "Google Pixel 9 Pro XL", category: "cell-phone", family: "pixel" },
  { name: "Google Pixel 9 Pro", category: "cell-phone", family: "pixel" },
  { name: "Google Pixel 9", category: "cell-phone", family: "pixel" },
  { name: "Google Pixel 8 Pro", category: "cell-phone", family: "pixel" },
  { name: "Google Pixel 8", category: "cell-phone", family: "pixel" },
  { name: "Google Pixel 8a", category: "cell-phone", family: "pixel" },
  { name: "Google Pixel 7 Pro", category: "cell-phone", family: "pixel" },
  { name: "Google Pixel 7", category: "cell-phone", family: "pixel" },
  { name: "Google Pixel 6a", category: "cell-phone", family: "pixel" },

  { name: "iPad Pro 13-inch (M4)", category: "tablet", family: "ipad" },
  { name: "iPad Pro 11-inch (M4)", category: "tablet", family: "ipad" },
  { name: "iPad Air 13-inch (M2)", category: "tablet", family: "ipad" },
  { name: "iPad Air 11-inch (M2)", category: "tablet", family: "ipad" },
  { name: "iPad (10th generation)", category: "tablet", family: "ipad" },
  { name: "iPad mini (A17 Pro)", category: "tablet", family: "ipad" },
  { name: "iPad", category: "tablet", family: "ipad" },

  { name: "MacBook Air 15-inch (M3)", category: "laptop", family: "mac" },
  { name: "MacBook Air 13-inch (M3)", category: "laptop", family: "mac" },
  { name: "MacBook Pro 16-inch (M4)", category: "laptop", family: "mac" },
  { name: "MacBook Pro 14-inch (M4)", category: "laptop", family: "mac" },
  { name: "MacBook Air", category: "laptop", family: "mac" },
  { name: "MacBook Pro", category: "laptop", family: "mac" },

  { name: "Apple Watch Series 10", category: "smartwatch", family: "watch" },
  { name: "Apple Watch Ultra 2", category: "smartwatch", family: "watch" },
  { name: "Apple Watch SE", category: "smartwatch", family: "watch" },
  { name: "Samsung Galaxy Watch 7", category: "smartwatch", family: "watch" },

  { name: "USB-C 65W fast charger", category: "accessory", family: "accessory" },
  { name: "USB-C to USB-C cable (1m)", category: "accessory", family: "accessory" },
  { name: "Lightning to USB-A cable (1m)", category: "accessory", family: "accessory" },
  { name: "Tempered glass screen protector", category: "accessory", family: "accessory" },
  { name: "Protective phone case", category: "accessory", family: "accessory" },
  { name: "Bluetooth wireless earbuds", category: "accessory", family: "accessory" },
  { name: "Power bank — 10,000 mAh", category: "accessory", family: "accessory" },
  { name: "Replacement screen", category: "part", family: "part" },
  { name: "Replacement battery", category: "part", family: "part" },
];

const FAMILY_ORDER = ["iphone", "samsung", "pixel", "ipad", "mac", "watch", "accessory", "part"];

function catalogModels() {
  return CATALOG_MODELS;
}

function familyRank(family) {
  const i = FAMILY_ORDER.indexOf(family);
  return i === -1 ? 99 : i;
}

module.exports = { CATALOG_MODELS, catalogModels, familyRank };
