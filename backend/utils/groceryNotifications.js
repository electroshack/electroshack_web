const GroceryItem = require("../models/GroceryItem");
const { sendStockNotificationEmail, sendAdminGroceryNotification } = require("../lib/email");
const { sendGroceryInStockSms } = require("../lib/sms");

function becameInStock(inv, previous) {
  const nowOk = inv.status === "in-stock" && inv.quantity > 0;
  if (!nowOk) return false;
  if (!previous) return true;
  const wasOk = previous.status === "in-stock" && previous.quantity > 0;
  return !wasOk;
}

function contactMode(cr) {
  const n = cr?.notify;
  if (n === "none" || n === "email" || n === "text" || n === "both") return n;
  if (cr?.email?.trim() || cr?.phone?.trim()) return "both";
  return "none";
}

async function notifyGroceryListMatches(inventoryDoc, previousLean) {
  if (!becameInStock(inventoryDoc, previousLean)) return { notified: 0 };

  const bc = (inventoryDoc.barcode && String(inventoryDoc.barcode).trim()) || "";
  const sku = (inventoryDoc.itemNumber && String(inventoryDoc.itemNumber).trim()) || "";
  const or = [];
  if (bc) or.push({ matchBarcode: bc });
  if (sku) or.push({ matchItemNumber: sku });
  if (or.length === 0) return { notified: 0 };

  const items = await GroceryItem.find({
    status: "pending",
    $or: or,
  });

  let notified = 0;
  for (const g of items) {
    if (g.stockNotifiedAt) continue;
    const mode = contactMode(g.customerRequest);
    if (mode === "none") continue;
    const email = g.customerRequest?.email?.trim();
    const phone = g.customerRequest?.phone?.trim();
    const wantEmail = (mode === "email" || mode === "both") && Boolean(email);
    const wantText = (mode === "text" || mode === "both") && Boolean(phone);
    if (!wantEmail && !wantText) continue;

    let emailResult = { sent: false, reason: "skipped" };
    let smsResult = { sent: false, reason: "skipped" };
    if (wantEmail) {
      // eslint-disable-next-line no-await-in-loop
      emailResult = await sendStockNotificationEmail({
        to: email,
        customerName: g.customerRequest?.name,
        itemTitle: g.title,
        productName: inventoryDoc.name,
        barcode: bc || sku,
      });
    }
    if (wantText) {
      // eslint-disable-next-line no-await-in-loop
      smsResult = await sendGroceryInStockSms({
        to: phone,
        itemTitle: g.title,
        productName: inventoryDoc.name,
        relatedId: String(g._id),
      });
    }

    if (emailResult.sent || smsResult.sent) {
      g.stockNotifiedAt = new Date();
      g.linkedInventoryId = inventoryDoc._id;
      // eslint-disable-next-line no-await-in-loop
      await g.save();
      notified += 1;
      // eslint-disable-next-line no-await-in-loop
      await sendAdminGroceryNotification({
        action: "matched",
        item: g.toObject(),
        actor: "auto-match",
        matchedInventory: { name: inventoryDoc.name, itemNumber: inventoryDoc.itemNumber },
      })
        .then((r) => {
          if (!r?.sent) console.warn("[grocery] admin match notify skipped:", r?.reason || r);
        })
        .catch((e) => console.error("[grocery] admin match notify failed:", e?.message || e));
    }
  }

  return { notified };
}

module.exports = {
  notifyGroceryListMatches,
  becameInStock,
};
