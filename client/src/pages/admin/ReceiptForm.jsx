import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Save, ArrowLeft, Trash2, Plus, Send, X, Settings, MessageSquare, Link2, Search, Eye } from "lucide-react";
import toast from "react-hot-toast";
import AdminLayout from "../../components/AdminLayout";
import PosChargePanel from "../../components/PosChargePanel";
import QuoteStockPicker, { quoteCategoryFromStock } from "../../components/QuoteStockPicker";
import { useCheckoutBasket } from "../../context/CheckoutBasketContext";
import API from "../../api";

const categories = [
  { value: "repair", label: "Cell Phone Repair" },
  { value: "laptop-repair", label: "Laptop Repair" },
  { value: "pc-repair", label: "PC Repair" },
  { value: "cell-phone-purchase", label: "Cell Phone Sale" },
  { value: "laptop-purchase", label: "Laptop Sale" },
  { value: "pc-purchase", label: "PC Sale" },
  { value: "cell-phone-accessory", label: "Cell Phone Accessory" },
  { value: "other", label: "Other" },
];

const PURCHASE_CATEGORIES = new Set([
  "cell-phone-purchase",
  "laptop-purchase",
  "pc-purchase",
  "cell-phone-accessory",
]);

function showsItemStatus(category) {
  return !PURCHASE_CATEGORIES.has(category);
}

const statuses = [
  { value: "received", label: "Received" },
  { value: "diagnosing", label: "Diagnosing" },
  { value: "waiting-for-parts", label: "Waiting for Parts" },
  { value: "in-progress", label: "In Progress" },
  { value: "ready-for-pickup", label: "Ready for Pickup" },
  { value: "customer-called", label: "Customer Called" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const emptyItem = { description: "", category: "repair", price: "", discount: "", status: "received", notes: "", inventoryItemId: "", stockQty: 1 };

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function lineNet(it) {
  const qty = Math.max(1, parseInt(it?.stockQty, 10) || 1);
  return Math.max(0, ((parseFloat(it?.price) || 0) - (parseFloat(it?.discount) || 0)) * qty);
}

function lineAmount(it) {
  return lineNet(it);
}

const SP_KEY = "es-salespeople";
const SP_LAST = "es-salesperson-last";
const DEFAULT_SP = ["Haris", "Khan"];

function loadSalespeople() {
  let extra = [];
  try {
    const raw = JSON.parse(localStorage.getItem(SP_KEY) || "[]");
    extra = Array.isArray(raw) ? raw.map((n) => String(n).trim()).filter(Boolean) : [];
  } catch {
    extra = [];
  }
  const names = [...DEFAULT_SP];
  extra.forEach((n) => {
    if (!names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
  });
  return names;
}

function rememberSalesperson(name) {
  const n = String(name || "").trim();
  if (!n) return;
  localStorage.setItem(SP_LAST, n);
  const names = loadSalespeople();
  if (!names.some((x) => x.toLowerCase() === n.toLowerCase())) {
    localStorage.setItem(SP_KEY, JSON.stringify([n, ...names.filter((x) => !DEFAULT_SP.includes(x))].slice(0, 8)));
  }
}

function itemsSubtotal(items) {
  return roundMoney((items || []).reduce((sum, it) => sum + lineAmount(it), 0));
}

const HST_RATE = 0.13;

function basketToItems(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  return lines.map((l) => ({
    description: l.description || "",
    category: l.category || "other",
    price: l.price || "",
    status: "received",
    notes: "",
    inventoryItemId: l.inventoryItemId || "",
    stockQty: l.stockQty || 1,
  }));
}

const emptyForm = {
  receiptNumber: "",
  receiptKind: "standard",
  documentType: "quote",
  legacyNote: "",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  customerAddress: "",
  date: new Date().toISOString().split("T")[0],
  salesperson: "",
  items: [{ ...emptyItem }],
  priceEstimate: "",
  status: "received",
  notes: "",
};

const Req = () => <span className="text-red-600 font-bold ml-0.5" aria-hidden>*</span>;

export default function ReceiptForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const isLegacyNew = !isEdit && location.pathname.includes("/legacy/");
  const isSaleNew = !isEdit && location.pathname.includes("/sale/");
  const { consume, count: basketCount } = useCheckoutBasket();
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    documentType: isSaleNew ? "receipt" : "quote",
  }));
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [updateMsg, setUpdateMsg] = useState("");
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateNotify, setUpdateNotify] = useState(true);
  const [saveNotify, setSaveNotify] = useState(false);
  const [staffMsg, setStaffMsg] = useState("");
  /** Per–line draft message for “Post line update” (customer-visible item notes). */
  const [itemLineUpdateDraft, setItemLineUpdateDraft] = useState({});
  const [itemLineSaving, setItemLineSaving] = useState(null);
  const [stockPickIdx, setStockPickIdx] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);
  const [salespeople, setSalespeople] = useState(loadSalespeople);

  useEffect(() => {
    if (isEdit) {
      API.get(`/receipts/${id}`)
        .then(({ data }) => {
          setReceipt(data);
          const itemsMapped = data.items?.length
            ? data.items.map((it) => ({
                ...it,
                price: it.price || "",
                inventoryItemId: it.inventoryItemId || "",
                stockQty: it.stockQty || 1,
              }))
            : [{ ...emptyItem }];
          const sub = itemsMapped.reduce((sum, it) => sum + (parseFloat(it.price) || 0), 0);
          setForm({
            receiptNumber: data.receiptNumber || "",
            receiptKind: data.receiptKind || "standard",
            legacyNote: data.legacyNote || "",
            customerName: data.customerName || "",
            customerPhone: data.customerPhone || "",
            customerEmail: data.customerEmail || "",
            customerAddress: data.customerAddress || "",
            date: data.date ? new Date(data.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
            salesperson: data.salesperson || "",
            items: itemsMapped,
            documentType: data.documentType || "quote",
            priceEstimate: data.priceEstimate ?? roundMoney(sub),
            status: data.status || "received",
            notes: data.notes || "",
          });
        })
        .catch(() => toast.error("Quote not found."))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  useEffect(() => {
    if (!isEdit || !id || !location.state?.openEmailPreview) return;
    API.get(`/receipts/${id}/preview-email`)
      .then(({ data }) => setEmailPreview(data.html || ""))
      .catch(() => {});
  }, [id, isEdit, location.state]);

  useEffect(() => {
    if (isEdit || isLegacyNew) return;
    API.get("/receipts/preview-new")
      .then(({ data }) => {
        setForm((f) => ({
          ...f,
          receiptNumber: data.receiptNumber,
          date: data.dateInputValue,
        }));
      })
      .catch(() => {});
  }, [isEdit, isLegacyNew]);

  useEffect(() => {
    if (isEdit) return;
    const last = localStorage.getItem(SP_LAST) || "";
    if (last) setForm((f) => ({ ...f, salesperson: f.salesperson || last }));
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) return;
    const fromState = basketToItems(location.state?.basketLines);
    if (!fromState) return;
    const sub = itemsSubtotal(fromState);
    setForm((f) => ({
      ...f,
      documentType: isSaleNew ? "receipt" : f.documentType || "quote",
      items: fromState,
      priceEstimate: isSaleNew ? roundMoney(sub * (1 + HST_RATE)) : sub,
    }));
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: {} });
  }, [isEdit, isSaleNew, location.pathname, location.search, location.state, navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleItemChange = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === "category" && showsItemStatus(value)) {
      items[idx].inventoryItemId = "";
    }
    if (field === "price" || field === "stockQty" || field === "discount") {
      const sub = itemsSubtotal(items);
      setForm({ ...form, items, priceEstimate: roundMoney(sub) });
      return;
    }
    setForm({ ...form, items });
  };

  const pickStock = (stock) => {
    const idx = stockPickIdx;
    setStockPickIdx(null);
    if (idx == null || !stock) return;
    const items = [...form.items];
    items[idx] = {
      ...items[idx],
      description: stock.name || items[idx].description,
      price: stock.sellingPrice ?? items[idx].price,
      category: quoteCategoryFromStock(stock.category),
      inventoryItemId: stock._id,
      status: "received",
      stockQty: 1,
    };
    const sub = itemsSubtotal(items);
    setForm({ ...form, items, priceEstimate: roundMoney(sub) });
  };

  const customerCanNotify = Boolean(
    (form.customerPhone && String(form.customerPhone).trim()) ||
    (form.customerEmail && String(form.customerEmail).trim())
  );

  const receiptCanNotify = Boolean(
    (receipt?.customerPhone && String(receipt.customerPhone).trim()) ||
    (receipt?.customerEmail && String(receipt.customerEmail).trim())
  );

  function showNotificationResult(data, fallbackMessage) {
    const sent = [];
    const failed = [];
    if (data?.smsNotify?.sent) sent.push("text");
    else if (data?.smsNotify && !["no-phone", "receipt-sms-on-payment", "not-attempted", "invalid-phone"].includes(data.smsNotify.reason)) {
      toast.error("Message failed to send due to SIM issue");
    }
    if (data?.emailNotify?.sent) sent.push("email");
    else if (data?.emailNotify && !["no-email"].includes(data.emailNotify.reason)) {
      const why = data.emailNotify.reason === "smtp-not-configured"
        ? "email: SMTP not configured"
        : `email: ${data.emailNotify.reason}`;
      failed.push(why);
    }

    if (sent.length > 0) toast.success(`${fallbackMessage} Customer notified by ${sent.join(" and ")}.`);
    else toast.success(fallbackMessage);
    failed.forEach((msg) => toast.error(`Notification failed (${msg})`));
  }

  const addItem = () => {
    const items = [...form.items, { ...emptyItem }];
    const sub = itemsSubtotal(items);
    setForm({ ...form, items, priceEstimate: roundMoney(sub) });
  };

  const removeItem = (idx) => {
    if (form.items.length <= 1) return;
    const items = form.items.filter((_, i) => i !== idx);
    const sub = itemsSubtotal(items);
    setForm({ ...form, items, priceEstimate: roundMoney(sub) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const sub = itemsSubtotal(form.items);
      rememberSalesperson(form.salesperson);
      setSalespeople(loadSalespeople());
      const payload = {
        ...form,
        documentType: isSaleNew || form.documentType === "receipt" ? "receipt" : "quote",
        date: form.date ? new Date(form.date) : new Date(),
        items: form.items.map((it) => ({
          ...it,
          price: parseFloat(it.price) || 0,
          discount: parseFloat(it.discount) || 0,
          inventoryItemId: it.inventoryItemId || null,
          stockQty: parseInt(it.stockQty, 10) || 1,
        })),
        priceEstimate: roundMoney(sub),
      };
      if (!isEdit) {
        if (isLegacyNew) {
          payload.receiptKind = "legacy";
          if (!payload.receiptNumber || !String(payload.receiptNumber).trim()) {
            delete payload.receiptNumber;
          } else {
            payload.receiptNumber = String(payload.receiptNumber).trim();
          }
        } else {
          payload.receiptKind = "standard";
          delete payload.receiptNumber;
        }
      }
      if (isEdit) {
        if (saveNotify) payload.notifyCustomer = true;
        const { data } = await API.put(`/receipts/${id}`, payload);
        setReceipt(data);
        showNotificationResult(data, saveNotify ? "Saved." : "Saved.");
      } else {
        const { data } = await API.post("/receipts", payload);
        const noun = payload.documentType === "receipt" ? "Receipt" : "Quote";
        showNotificationResult(data, `${noun} ${data.receiptNumber} created!`);
        navigate("/admin/receipts");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Move this quote to deleted receipts? It can be restored by an admin.")) return;
    try {
      await API.delete(`/receipts/${id}`);
      toast.success("Quote moved to deleted receipts.");
      navigate("/admin/receipts");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const handleAddUpdate = async (e) => {
    e.preventDefault();
    if (!updateMsg.trim()) return;
    try {
      const payload = { message: updateMsg };
      if (updateStatus) payload.status = updateStatus;
      if (updateNotify && receiptCanNotify) payload.notifyCustomer = true;
      const { data } = await API.post(`/receipts/${id}/update`, payload);
      setReceipt(data);
      setForm((f) => ({ ...f, status: data.status }));
      setUpdateMsg("");
      setUpdateStatus("");
      showNotificationResult(data, updateNotify && receiptCanNotify ? "Update posted." : "Update posted!");
    } catch {
      toast.error("Failed to add update.");
    }
  };

  const postItemLineUpdate = async (idx) => {
    const item = receipt?.items?.[idx];
    if (!item?._id) return;
    const msg = (itemLineUpdateDraft[idx] || "").trim();
    if (!msg) {
      toast.error("Enter a short customer-visible note to post.");
      return;
    }
    setItemLineSaving(idx);
    try {
      const payload = {
        message: msg,
        status: form.items[idx]?.status,
      };
      const { data } = await API.post(`/receipts/${id}/items/${item._id}/update`, payload);
      setReceipt(data);
      setForm((f) => ({
        ...f,
        items: data.items.map((it) => ({
          ...it,
          price: it.price || "",
          discount: it.discount || "",
          inventoryItemId: it.inventoryItemId || "",
        })),
        status: data.status,
      }));
      setItemLineUpdateDraft((d) => ({ ...d, [idx]: "" }));
      toast.success("Line update posted!");
    } catch {
      toast.error("Failed to post line update.");
    }
    setItemLineSaving(null);
  };

  const openEmailPreview = async () => {
    try {
      const payload = {
        customerName: form.customerName,
        receiptNumber: form.receiptNumber,
        items: form.items.map((it) => ({
          description: it.description,
          price: parseFloat(it.price) || 0,
          discount: parseFloat(it.discount) || 0,
        })),
      };
      const { data } = isEdit
        ? await API.get(`/receipts/${id}/preview-email`)
        : await API.post("/receipts/preview-email", payload);
      setEmailPreview(data.html || "");
      if (data.configured === false) toast.error("SMTP is not configured — preview only.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not build email preview.");
    }
  };

  const handleStaffMessage = async (e) => {
    e.preventDefault();
    if (!staffMsg.trim()) return;
    try {
      const { data } = await API.post(`/receipts/${id}/message`, { message: staffMsg });
      setReceipt(data);
      setStaffMsg("");
      toast.success("Message sent!");
    } catch {
      toast.error("Failed to send message.");
    }
  };

  const fieldCls = "w-full h-7 px-1.5 py-0.5 bg-transparent border-b border-amber-800/25 text-xs leading-tight focus:outline-none focus:border-amber-800/55 placeholder-amber-800/35";
  const labelCls = "block text-[9px] font-bold uppercase tracking-wider text-amber-800/55 mb-0";
  const itemCols = { gridTemplateColumns: "1.2rem minmax(0,1fr) 9rem 4.25rem 1.1rem" };
  const receiptFont = { fontFamily: '"IBM Plex Mono", ui-monospace, Consolas, monospace' };

  const itemsTotal = itemsSubtotal(form.items);
  const isReceiptDoc = form.documentType === "receipt" || isSaleNew;
  const hstAmount = isReceiptDoc ? roundMoney(itemsTotal * HST_RATE) : 0;
  const grandTotal = roundMoney(itemsTotal + hstAmount);
  const docNoun = isReceiptDoc ? "Receipt" : "Quote";

  return (
    <AdminLayout
      title={
        isEdit ? (
          <>
            <span className="text-dark-900">{docNoun} </span>
            <span className="text-red-600 font-bold">{form.receiptNumber}</span>
          </>
        ) : isLegacyNew ? (
          "Log historical quote"
        ) : isSaleNew ? (
          "New receipt"
        ) : (
          "New quote"
        )
      }
    >
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
        </div>
      ) : (
        <div className="max-w-5xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate("/admin/receipts")} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={18} />
            </button>
            {!isEdit && basketCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const mapped = basketToItems(consume());
                  if (!mapped) return;
                  setForm((f) => ({
                    ...f,
                    items: mapped,
                    priceEstimate: itemsSubtotal(mapped),
                  }));
                  toast.success("Basket imported.");
                }}
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                Import basket ({basketCount})
              </button>
            ) : null}
            {isEdit && receipt?.publicAccessToken ? (
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/ticket/${receipt.publicAccessToken}`;
                  navigator.clipboard.writeText(url).then(
                    () => toast.success("Customer ticket link copied."),
                    () => toast.error(url)
                  );
                }}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
              >
                <Link2 size={13} /> Copy ticket link
              </button>
            ) : null}
            {isEdit && (
              <button onClick={handleDelete} className="ml-auto flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition-colors">
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>

          {/* Receipt Book Layout */}
          <form onSubmit={handleSubmit}>
            <div className="bg-amber-50 border-2 border-amber-200 rounded-sm shadow-lg overflow-hidden" style={receiptFont}>
              {/* Invoice header: number, date, status */}
              <div className="bg-amber-200/60 px-3 py-1.5 border-b-2 border-amber-300/50">
                <div className="grid grid-cols-4 gap-x-3 items-end">
                  <div>
                    <label className={labelCls}>&nbsp;</label>
                    <div className="h-7 flex items-center text-xs font-semibold text-amber-900 uppercase tracking-wider">
                      {docNoun}
                    </div>
                  </div>
                  {isLegacyNew ? (
                    <div>
                      <label className={labelCls}>Old quote #</label>
                      <input
                        name="receiptNumber"
                        value={form.receiptNumber}
                        onChange={handleChange}
                        className={`${fieldCls} font-semibold text-red-600 font-mono tabular-nums`}
                        placeholder="Optional"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className={labelCls}>Quote #</label>
                      <div className="h-7 flex items-center font-mono text-xs font-semibold text-red-600 tabular-nums">
                        {form.receiptNumber || "—"}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Date</label>
                    <input
                      type="date"
                      name="date"
                      value={form.date || new Date().toISOString().split("T")[0]}
                      onChange={handleChange}
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select name="status" value={form.status} onChange={handleChange} className={`${fieldCls} bg-transparent`}>
                      {statuses.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <div className="md:col-span-2 space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-amber-800/65 border-b border-amber-800/20 pb-0.5 mb-0.5">Sold To / Customer</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1">
                      <div>
                        <label className={labelCls}>Name <Req /></label>
                        <input name="customerName" value={form.customerName} onChange={handleChange} required className={fieldCls} placeholder="Customer name" />
                      </div>
                      <div>
                        <label className={labelCls}>Phone <Req /></label>
                        <input name="customerPhone" value={form.customerPhone} onChange={handleChange} required className={fieldCls} placeholder="Phone number" />
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <input name="customerEmail" value={form.customerEmail} onChange={handleChange} type="email" className={fieldCls} placeholder="Email" />
                      </div>
                      <div>
                        <label className={labelCls}>Address</label>
                        <input name="customerAddress" value={form.customerAddress} onChange={handleChange} className={fieldCls} placeholder="Address" />
                      </div>
                      <div>
                        <label className={labelCls}>Salesperson</label>
                        <div className="flex flex-wrap gap-1 h-7 items-center">
                          {salespeople.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setForm({ ...form, salesperson: n })}
                              className={`h-6 px-2 text-xs rounded-sm border ${
                                form.salesperson === n
                                  ? "border-amber-800/50 bg-amber-100 text-amber-950"
                                  : "border-amber-800/20 text-amber-800/70 hover:bg-amber-100/60"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {(isLegacyNew || (isEdit && form.receiptKind === "legacy")) && (
                    <div className="md:col-span-2">
                      <label className={labelCls}>Reference note</label>
                      <input
                        name="legacyNote"
                        value={form.legacyNote}
                        onChange={handleChange}
                        className={fieldCls}
                        placeholder='e.g. "Written as #552 on carbon copy"'
                      />
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div className="border-t-2 border-amber-800/20 pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-amber-800/65">Items</div>
                    <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 bg-white/50 px-2 py-1 rounded-sm">
                      <Plus size={12} /> Add Item
                    </button>
                  </div>
                  <div
                    className="grid gap-x-0 text-[9px] font-bold uppercase tracking-wider text-amber-800/55 mb-0.5"
                    style={itemCols}
                  >
                    <div className="px-0.5">#</div>
                    <div className="px-1.5 text-left">Description <span className="text-red-600">*</span></div>
                    <div className="px-1.5 text-left border-l border-amber-800/20">Category</div>
                    <div className="px-1.5 text-left border-l border-amber-800/20">Price</div>
                    <div />
                  </div>

                  {form.items.map((item, idx) => (
                    <div key={receipt?.items?.[idx]?._id || `new-${idx}`} className="border-b border-amber-800/10 py-1">
                      <div
                        className="grid gap-x-0 gap-y-0.5 items-center hover:bg-amber-100/30 transition-colors group"
                        style={itemCols}
                      >
                        <div className="px-0.5 text-xs font-bold text-amber-800/40 row-span-2 self-start pt-1.5">{idx + 1}</div>
                        <div className="relative px-1.5">
                          <input
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                            required
                            className={`${fieldCls} pr-6`}
                            placeholder="Item description"
                          />
                          <button
                            type="button"
                            title="search stock"
                            onClick={() => setStockPickIdx(idx)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-amber-800/45 hover:text-amber-900"
                          >
                            <Search size={13} />
                          </button>
                        </div>
                        <div className="px-1.5 border-l border-amber-800/20">
                          <select
                            value={item.category}
                            onChange={(e) => handleItemChange(idx, "category", e.target.value)}
                            className={`${fieldCls} bg-transparent`}
                          >
                            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                        <div className="px-1.5 border-l border-amber-800/20">
                          <div className="relative">
                            <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs text-amber-800/40">$</span>
                            <input
                              value={item.price}
                              onChange={(e) => handleItemChange(idx, "price", e.target.value)}
                              type="number"
                              step="0.01"
                              min="0"
                              className={`${fieldCls} pl-3.5 text-left`}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="row-span-2 self-start pt-1 flex justify-end">
                          {form.items.length > 1 && (
                            <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-0.5" title="Remove line">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        <div className="px-1.5">
                          <input
                            value={item.notes || ""}
                            onChange={(e) => handleItemChange(idx, "notes", e.target.value)}
                            className={fieldCls}
                            placeholder="Notes"
                          />
                        </div>
                        <div className="px-1.5 border-l border-amber-800/20">
                          {showsItemStatus(item.category) ? (
                            <select
                              value={item.status}
                              onChange={(e) => handleItemChange(idx, "status", e.target.value)}
                              className={`${fieldCls} bg-transparent`}
                            >
                              {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          ) : item.inventoryItemId ? (
                            <select
                              disabled
                              value={item.status}
                              className={`${fieldCls} bg-amber-100/40 text-amber-800/35 cursor-not-allowed`}
                              aria-label="Status locked for stock sales"
                            >
                              {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          ) : (
                            <div />
                          )}
                        </div>
                        <div className="px-1.5 border-l border-amber-800/20">
                          <div className="relative" title="discount">
                            <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs font-semibold text-red-600">-$</span>
                            <input
                              value={item.discount}
                              onChange={(e) => handleItemChange(idx, "discount", e.target.value)}
                              type="number"
                              step="0.01"
                              min="0"
                              title="discount"
                              className={`${fieldCls} pl-5 text-left text-red-600 placeholder-red-400/50`}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                      {isEdit && receipt?.items?.[idx]?._id && (
                        <div className="mt-1.5 ml-1 flex flex-wrap items-center gap-1.5 pl-5 pr-1 pb-1">
                          <Settings size={12} className="text-amber-800/50 flex-shrink-0" aria-hidden />
                          <input
                            type="text"
                            placeholder="Customer-visible note for this line..."
                            value={itemLineUpdateDraft[idx] ?? ""}
                            onChange={(e) => setItemLineUpdateDraft((d) => ({ ...d, [idx]: e.target.value }))}
                            className="flex-1 min-w-[12rem] px-2 py-1 text-[11px] border border-amber-300/40 rounded-sm bg-white/80 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                          <button
                            type="button"
                            disabled={itemLineSaving === idx}
                            onClick={() => postItemLineUpdate(idx)}
                            className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-primary-500 text-white rounded-sm hover:bg-primary-600 disabled:opacity-50"
                          >
                            {itemLineSaving === idx ? "…" : "Post line update"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Totals */}
                  <div className="grid grid-cols-12 gap-2 mt-2 pt-2 border-t-2 border-amber-800/20">
                    <div className="col-span-7" />
                    <div className="col-span-5 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-800/60 font-bold uppercase">Subtotal</span>
                        <span className="font-bold">${itemsTotal.toFixed(2)}</span>
                      </div>
                      {isReceiptDoc ? (
                        <div className="flex justify-between text-xs">
                          <span className="text-amber-800/60 font-bold uppercase">HST 13%</span>
                          <span className="font-bold">${hstAmount.toFixed(2)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-xs items-center gap-2 pt-1.5 border-t-2 border-amber-800/30">
                        <span className="text-amber-900 font-bold uppercase">{isReceiptDoc ? "Total" : "Quote total"}</span>
                        <input
                          name="priceEstimate"
                          value={isReceiptDoc ? grandTotal.toFixed(2) : form.priceEstimate}
                          onChange={handleChange}
                          type="number"
                          step="0.01"
                          min="0"
                          readOnly={isReceiptDoc}
                          className="w-20 h-7 text-left px-1.5 bg-white border border-amber-800/30 rounded-sm text-xs focus:outline-none focus:border-amber-800/60 font-semibold font-mono"
                          placeholder="$"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-2 pt-2 border-t border-amber-800/10 space-y-2">
                  <div>
                    <label className={labelCls}>Staff only notes</label>
                    <textarea name="notes" value={form.notes} onChange={handleChange} rows={1} className={`${fieldCls} resize-y`} placeholder="type to edit ... not sent to customer" />
                  </div>
                  <PosChargePanel
                    receipt={receipt}
                    quoteTotal={grandTotal}
                    onPaid={(data) => setReceipt(data)}
                  />
                </div>
              </div>

              {/* Save bar */}
              <div className="bg-amber-200/40 px-4 py-2 border-t-2 border-amber-300/50 flex flex-wrap items-center gap-3">
                <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 h-8 px-3 bg-primary-500 text-white font-medium text-xs rounded-sm hover:bg-primary-600 transition-colors disabled:opacity-50">
                  <Save size={14} />
                  {saving ? "Saving..." : isEdit ? `Update ${docNoun.toLowerCase()}` : `Create ${docNoun.toLowerCase()}`}
                </button>
                <button type="button" onClick={openEmailPreview} className="inline-flex items-center gap-1.5 h-8 px-2 text-xs text-amber-900/80 hover:bg-amber-100 rounded-sm">
                  <Eye size={13} /> Preview email
                </button>
                {isEdit && customerCanNotify ? (
                  <label className="flex items-center gap-2 text-xs text-amber-900/80 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={saveNotify}
                      onChange={(e) => setSaveNotify(e.target.checked)}
                      className="w-4 h-4 text-primary-500 rounded border-amber-800/40 focus:ring-primary-500"
                    />
                    <MessageSquare size={13} className="text-amber-800/70" />
                    Text{form.customerEmail ? " / email" : ""} customer a quote update on save
                  </label>
                ) : null}
              </div>
            </div>
          </form>

          {/* Updates & Messages (edit mode) */}
          {isEdit && receipt && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Receipt-level Updates */}
              <div className="bg-white border border-gray-200 rounded-sm p-3">
                <h3 className="text-xs font-semibold text-dark-900 mb-2">Updates</h3>
                {receipt.updates?.length > 0 ? (
                  <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {receipt.updates.map((u, i) => (
                      <div key={i} className="text-sm border-l-2 border-primary-500 pl-3 py-1">
                        <p className="text-dark-900">{u.message}</p>
                        <p className="text-xs text-gray-400">{new Date(u.date).toLocaleString()} &mdash; {u.author}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-2">None</p>
                )}
                <form onSubmit={handleAddUpdate} className="space-y-2">
                  <input type="text" placeholder="Update" value={updateMsg} onChange={(e) => setUpdateMsg(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  <div className="flex gap-2">
                    <select value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value)} className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500">
                      <option value="">Status</option>
                      {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <button type="submit" className="px-2.5 py-1.5 bg-primary-500 text-white text-sm rounded-sm hover:bg-primary-600">
                      <Plus size={16} />
                    </button>
                  </div>
                  {receiptCanNotify ? (
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={updateNotify}
                        onChange={(e) => setUpdateNotify(e.target.checked)}
                        className="w-4 h-4 text-primary-500 rounded border-gray-300 focus:ring-primary-500"
                      />
                      <MessageSquare size={13} className="text-primary-500" />
                      Text{receipt.customerEmail ? " / email" : ""} this update to{" "}
                      <span className="font-mono">{receipt.customerPhone || receipt.customerEmail}</span>
                    </label>
                  ) : null}
                </form>
              </div>

              {/* Messages */}
              <div className="bg-white border border-gray-200 rounded-sm p-3">
                <h3 className="text-xs font-semibold text-dark-900 mb-2">Messages</h3>
                {receipt.messages?.length > 0 ? (
                  <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {receipt.messages.map((m, i) => (
                      <div key={i} className={`flex ${m.sender === "customer" ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-sm text-sm ${m.sender === "customer" ? "bg-gray-100 text-dark-900" : "bg-primary-500 text-white"}`}>
                          <p>{m.message}</p>
                          <p className={`text-[10px] mt-1 ${m.sender === "customer" ? "text-gray-400" : "text-primary-200"}`}>
                            {m.sender} &mdash; {new Date(m.date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-2">None</p>
                )}
                <form onSubmit={handleStaffMessage} className="flex gap-2">
                  <input type="text" placeholder="Message" value={staffMsg} onChange={(e) => setStaffMsg(e.target.value)} className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  <button type="submit" className="px-2.5 py-1.5 bg-primary-500 text-white rounded-sm hover:bg-primary-600">
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </div>
          )}
          <QuoteStockPicker
            open={stockPickIdx != null}
            onClose={() => setStockPickIdx(null)}
            onPick={pickStock}
          />
          {emailPreview != null ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3" onClick={() => setEmailPreview(null)}>
              <div className="w-full max-w-xl bg-white rounded-sm shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Quote email</span>
                  <button type="button" onClick={() => setEmailPreview(null)} className="p-1 text-gray-400 hover:text-gray-700">
                    <X size={14} />
                  </button>
                </div>
                <iframe title="Quote email preview" srcDoc={emailPreview} className="w-full h-[70vh] bg-[#eef2f7] border-0" />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </AdminLayout>
  );
}
