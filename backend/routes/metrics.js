const express = require("express");
const ExcelJS = require("exceljs");
const Receipt = require("../models/Receipt");
const Inventory = require("../models/Inventory");
const { auth } = require("../middleware/auth");
const router = express.Router();

function parseRange(query) {
  let from = query.from ? new Date(query.from) : null;
  let to = query.to ? new Date(query.to) : null;
  if (!from || Number.isNaN(from.getTime())) {
    const d = new Date();
    from = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  } else {
    from.setHours(0, 0, 0, 0);
  }
  if (!to || Number.isNaN(to.getTime())) {
    to = new Date();
  }
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

async function buildSummary(range) {
  const { from, to } = range;

  const receiptMatch = { date: { $gte: from, $lte: to } };
  const receiptAgg = await Receipt.aggregate([
    { $match: receiptMatch },
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        completedRevenue: [
          { $match: { status: "completed" } },
          { $group: { _id: null, total: { $sum: "$finalPrice" } } },
        ],
        allFinalSum: [{ $group: { _id: null, total: { $sum: "$finalPrice" } } }],
        count: [{ $count: "n" }],
      },
    },
  ]);

  const facet = receiptAgg[0] || {};
  const statusRows = facet.byStatus || [];
  const receiptStatusCounts = statusRows.reduce((a, r) => ({ ...a, [r._id]: r.count }), {});

  const purchases = await Inventory.aggregate([
    {
      $match: {
        dateBought: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: null,
        moneyOut: { $sum: { $multiply: ["$costPrice", "$quantity"] } },
        purchaseLines: { $sum: 1 },
      },
    },
  ]);

  const sales = await Inventory.aggregate([
    {
      $match: {
        status: "sold",
        dateSold: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: null,
        moneyIn: { $sum: { $multiply: ["$sellingPrice", "$quantity"] } },
        saleLines: { $sum: 1 },
      },
    },
  ]);

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    receipts: {
      totalInRange: facet.count?.[0]?.n || 0,
      statusCounts: receiptStatusCounts,
      completedRevenue: facet.completedRevenue?.[0]?.total || 0,
      sumFinalPriceAllStatuses: facet.allFinalSum?.[0]?.total || 0,
    },
    inventory: {
      moneyOutPurchases: purchases[0]?.moneyOut || 0,
      purchaseLineCount: purchases[0]?.purchaseLines || 0,
      moneyInSold: sales[0]?.moneyIn || 0,
      saleLineCount: sales[0]?.saleLines || 0,
    },
  };
}

router.get("/", auth, async (req, res) => {
  try {
    const summary = await buildSummary(parseRange(req.query));
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/export.xlsx", auth, async (req, res) => {
  try {
    const range = parseRange(req.query);
    const { from, to } = range;

    const summary = await buildSummary(range);

    const receipts = await Receipt.find({
      date: { $gte: from, $lte: to },
    })
      .sort({ date: -1 })
      .lean();

    const soldItems = await Inventory.find({
      status: "sold",
      dateSold: { $gte: from, $lte: to },
    })
      .sort({ dateSold: -1 })
      .lean();

    const boughtItems = await Inventory.find({
      dateBought: { $gte: from, $lte: to },
    })
      .sort({ dateBought: -1 })
      .lean();

    const wb = new ExcelJS.Workbook();
    wb.creator = "Electroshack Admin";

    const ws0 = wb.addWorksheet("Summary");
    ws0.columns = [
      { header: "Metric", key: "k", width: 28 },
      { header: "Value", key: "v", width: 22 },
    ];
    ws0.addRow({ k: "From", v: from.toISOString() });
    ws0.addRow({ k: "To", v: to.toISOString() });
    ws0.addRow({ k: "Receipts in range", v: summary.receipts.totalInRange });
    ws0.addRow({ k: "Completed revenue (finalPrice)", v: summary.receipts.completedRevenue });
    ws0.addRow({ k: "Money in — inventory sold (selling × qty)", v: summary.inventory.moneyInSold });
    ws0.addRow({ k: "Money out — purchases (cost × qty)", v: summary.inventory.moneyOutPurchases });

    const ws1 = wb.addWorksheet("Receipts");
    ws1.columns = [
      { header: "Receipt #", key: "receiptNumber", width: 18 },
      { header: "Kind", key: "receiptKind", width: 10 },
      { header: "Date", key: "date", width: 12 },
      { header: "Customer", key: "customerName", width: 22 },
      { header: "Status", key: "status", width: 16 },
      { header: "Final", key: "finalPrice", width: 10 },
    ];
    receipts.forEach((r) => {
      ws1.addRow({
        receiptNumber: r.receiptNumber,
        receiptKind: r.receiptKind || "standard",
        date: r.date ? new Date(r.date).toISOString().slice(0, 10) : "",
        customerName: r.customerName,
        status: r.status,
        finalPrice: r.finalPrice,
      });
    });

    const ws2 = wb.addWorksheet("Inventory sold");
    ws2.columns = [
      { header: "Item #", key: "itemNumber", width: 14 },
      { header: "Barcode", key: "barcode", width: 16 },
      { header: "Name", key: "name", width: 28 },
      { header: "Category", key: "category", width: 12 },
      { header: "Qty", key: "quantity", width: 6 },
      { header: "Sell price", key: "sellingPrice", width: 10 },
      { header: "Date sold", key: "dateSold", width: 12 },
    ];
    soldItems.forEach((r) => {
      ws2.addRow({
        itemNumber: r.itemNumber,
        barcode: r.barcode || "",
        name: r.name,
        category: r.category,
        quantity: r.quantity,
        sellingPrice: r.sellingPrice,
        dateSold: r.dateSold ? new Date(r.dateSold).toISOString().slice(0, 10) : "",
      });
    });

    const ws3 = wb.addWorksheet("Purchases");
    ws3.columns = [
      { header: "Item #", key: "itemNumber", width: 14 },
      { header: "Barcode", key: "barcode", width: 16 },
      { header: "Name", key: "name", width: 28 },
      { header: "Qty", key: "quantity", width: 6 },
      { header: "Cost", key: "costPrice", width: 10 },
      { header: "Date bought", key: "dateBought", width: 12 },
    ];
    boughtItems.forEach((r) => {
      ws3.addRow({
        itemNumber: r.itemNumber,
        barcode: r.barcode || "",
        name: r.name,
        quantity: r.quantity,
        costPrice: r.costPrice,
        dateBought: r.dateBought ? new Date(r.dateBought).toISOString().slice(0, 10) : "",
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="electroshack-metrics.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
