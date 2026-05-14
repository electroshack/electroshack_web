/**
 * Curated TAC prefixes (first 8 digits of IMEI) -> brand / model hints. Extend as devices appear in your shop.
 */

module.exports = [
  ["35332506", { brand: "Apple", modelHint: "iPhone (recent)", category: "cell-phone", deviceFamily: "iphone" }],
  ["35407010", { brand: "Apple", modelHint: "iPhone", category: "cell-phone", deviceFamily: "iphone" }],
  ["35942506", { brand: "Apple", modelHint: "iPad / iPhone", category: "tablet", deviceFamily: "ipad" }],
  ["86000303", { brand: "Apple", modelHint: "Apple Watch", category: "smartwatch", deviceFamily: "watch" }],
  ["35280109", { brand: "Samsung", modelHint: "Galaxy phone", category: "cell-phone", deviceFamily: "android" }],
  ["35824005", { brand: "Samsung", modelHint: "Galaxy Watch", category: "smartwatch", deviceFamily: "watch" }],
  ["35833906", { brand: "Samsung", modelHint: "Galaxy Tab", category: "tablet", deviceFamily: "android" }],
  ["35805901", { brand: "Google", modelHint: "Pixel phone", category: "cell-phone", deviceFamily: "android" }],
];
