import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Save, ArrowLeft, Trash2, Plus, Send, X, Settings, Mail } from "lucide-react";
import toast from "react-hot-toast";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api";

const categories = [
  { value: "repair", label: "Repair" },
  { value: "cell-phone-accessory", label: "Cell Phone Accessory" },
  { value: "cell-phone-purchase", label: "Cell Phone Purchase" },
  { value: "laptop-repair", label: "Laptop Repair" },
  { value: "laptop-purchase", label: "Laptop Purchase" },
  { value: "pc-repair", label: "PC Repair" },
  { value: "pc-purchase", label: "PC Purchase" },
  { value: "other", label: "Other" },
];

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

const emptyItem = { description: "", category: "repair", price: "", status: "received", notes: "" };

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const emptyForm = {
  receiptNumber: "",
  receiptKind: "standard",
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
  const [form, setForm] = useState(emptyForm);
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

  useEffect(() => {
    if (isEdit) {
      API.get(`/receipts/${id}`)
        .then(({ data }) => {
          setReceipt(data);
          const itemsMapped = data.items?.length
            ? data.items.map((it) => ({
                ...it,
                price: it.price || "",
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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleItemChange = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === "price") {
      const sub = items.reduce((sum, it) => sum + (parseFloat(it.price) || 0), 0);
      setForm({ ...form, items, priceEstimate: roundMoney(sub) });
      return;
    }
    setForm({ ...form, items });
  };

  const addItem = () => {
    const items = [...form.items, { ...emptyItem }];
    const sub = items.reduce((sum, it) => sum + (parseFloat(it.price) || 0), 0);
    setForm({ ...form, items, priceEstimate: roundMoney(sub) });
  };

  const removeItem = (idx) => {
    if (form.items.length <= 1) return;
    const items = form.items.filter((_, i) => i !== idx);
    const sub = items.reduce((sum, it) => sum + (parseFloat(it.price) || 0), 0);
    setForm({ ...form, items, priceEstimate: roundMoney(sub) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const sub = form.items.reduce((sum, it) => sum + (parseFloat(it.price) || 0), 0);
      const payload = {
        ...form,
        date: form.date ? new Date(form.date) : new Date(),
        items: form.items.map((it) => ({ ...it, price: parseFloat(it.price) || 0 })),
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
        toast.success(saveNotify ? "Quote updated and customer notified!" : "Quote updated!");
      } else {
        const { data } = await API.post("/receipts", payload);
        toast.success(`Quote ${data.receiptNumber} created!`);
        navigate("/admin/receipts");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    try {
      await API.delete(`/receipts/${id}`);
      toast.success("Receipt deleted.");
      navigate("/admin/receipts");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const handleAddUpdate = async (e) => {
    e.preventDefault();
    if (!updateMsg.trim()) return;
    const customerHasEmail = Boolean(receipt?.customerEmail && String(receipt.customerEmail).trim());
    try {
      const payload = { message: updateMsg };
      if (updateStatus) payload.status = updateStatus;
      if (updateNotify && customerHasEmail) payload.notifyCustomer = true;
      const { data } = await API.post(`/receipts/${id}/update`, payload);
      setReceipt(data);
      setForm((f) => ({ ...f, status: data.status }));
      setUpdateMsg("");
      setUpdateStatus("");
      toast.success(updateNotify && customerHasEmail ? "Update posted and emailed to customer!" : "Update posted!");
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
        items: data.items.map((it) => ({ ...it, price: it.price || "" })),
        status: data.status,
      }));
      setItemLineUpdateDraft((d) => ({ ...d, [idx]: "" }));
      toast.success("Line update posted!");
    } catch {
      toast.error("Failed to post line update.");
    }
    setItemLineSaving(null);
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

  const fieldCls = "w-full px-1.5 py-1 bg-transparent border-b border-amber-800/25 text-[13px] leading-tight focus:outline-none focus:border-amber-800/55 placeholder-amber-800/35";
  const labelCls = "block text-[9px] font-bold uppercase tracking-wider text-amber-800/55 mb-0";
  const receiptFont = { fontFamily: '"IBM Plex Mono", ui-monospace, Consolas, monospace' };

  const itemsTotal = form.items.reduce((sum, it) => sum + (parseFloat(it.price) || 0), 0);

  return (
    <AdminLayout
      title={
        isEdit ? (
          <>
            <span className="text-dark-900">Quote </span>
            <span className="text-red-600 font-bold">{form.receiptNumber}</span>
          </>
        ) : isLegacyNew ? (
          "Log historical quote"
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
        <div className="max-w-5xl space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => navigate("/admin/receipts")} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-dark-900">
              {isEdit ? "Edit quote" : isLegacyNew ? "Paper / old quote" : "New quote"}
            </h2>
            {isEdit && (
              <button onClick={handleDelete} className="ml-auto flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition-colors">
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>

          {/* Receipt Book Layout */}
          <form onSubmit={handleSubmit}>
            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg shadow-lg overflow-hidden" style={receiptFont}>
              {/* Invoice header: number, date, status */}
              <div className="bg-amber-200/60 px-3 py-3 border-b-2 border-amber-300/50">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                  <span className="text-amber-900 font-bold text-xs tracking-[0.2em] uppercase shrink-0">Quote</span>

                  {isLegacyNew ? (
                    <>
                      <div className="min-w-[11rem]">
                        <label className={labelCls}>Old quote #</label>
                        <input
                          name="receiptNumber"
                          value={form.receiptNumber}
                          onChange={handleChange}
                          className={`${fieldCls} text-sm font-bold text-red-600 font-mono tabular-nums`}
                          placeholder="Optional — auto if empty"
                        />
                      </div>
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
                    </>
                  ) : (
                    <>
                      <div>
                        <label className={labelCls}>Quote #</label>
                        <div className="font-mono text-sm font-bold text-red-600 tabular-nums">{form.receiptNumber || "—"}</div>
                      </div>
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
                    </>
                  )}
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="md:col-span-2 space-y-2">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-amber-800/65 border-b border-amber-800/20 pb-0.5 mb-1">Sold To / Customer</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <div>
                        <label className={labelCls}>Name <Req /></label>
                        <input name="customerName" value={form.customerName} onChange={handleChange} required className={fieldCls} placeholder="Customer name" />
                      </div>
                      <div>
                        <label className={labelCls}>Phone <Req /></label>
                        <input name="customerPhone" value={form.customerPhone} onChange={handleChange} required className={fieldCls} placeholder="Phone number" />
                      </div>
                      <div>
                        <label className={labelCls}>Address</label>
                        <input name="customerAddress" value={form.customerAddress} onChange={handleChange} className={fieldCls} placeholder="Address" />
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <input name="customerEmail" value={form.customerEmail} onChange={handleChange} type="email" className={fieldCls} placeholder="Email" />
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
                  <div className="md:col-span-2">
                    <label className={labelCls}>Salesperson</label>
                    <input name="salesperson" value={form.salesperson} onChange={handleChange} className={fieldCls} placeholder="Salesperson" />
                  </div>
                </div>

                {/* Items Table */}
                <div className="border-t-2 border-amber-800/20 pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-amber-800/65">Items</div>
                    <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 bg-white/50 px-2 py-1 rounded">
                      <Plus size={12} /> Add Item
                    </button>
                  </div>

                  {/* Header row */}
                  <div className="grid grid-cols-12 gap-1 text-[8px] font-bold uppercase tracking-wider text-amber-800/55 border-b border-amber-800/20 pb-0.5 mb-0.5 px-0.5">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Description <span className="text-red-600">*</span></div>
                    <div className="col-span-2">Category</div>
                    <div className="col-span-1">Price</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-1">Notes</div>
                    <div className="col-span-1"></div>
                  </div>

                  {form.items.map((item, idx) => (
                    <div key={receipt?.items?.[idx]?._id || `new-${idx}`} className="border-b border-amber-800/10 py-1">
                      <div className="grid grid-cols-12 gap-1 items-center px-0.5 hover:bg-amber-100/30 transition-colors group">
                        <div className="col-span-1 text-xs font-bold text-amber-800/40">{idx + 1}</div>
                        <div className="col-span-4">
                          <input
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                            required
                            className={fieldCls}
                            placeholder="Item description"
                          />
                        </div>
                        <div className="col-span-2">
                          <select
                            value={item.category}
                            onChange={(e) => handleItemChange(idx, "category", e.target.value)}
                            className={`${fieldCls} bg-transparent text-xs`}
                          >
                            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                        <div className="col-span-1">
                          <input
                            value={item.price}
                            onChange={(e) => handleItemChange(idx, "price", e.target.value)}
                            type="number"
                            step="0.01"
                            min="0"
                            className={`${fieldCls} text-right`}
                            placeholder="$"
                          />
                        </div>
                        <div className="col-span-2">
                          <select
                            value={item.status}
                            onChange={(e) => handleItemChange(idx, "status", e.target.value)}
                            className={`${fieldCls} bg-transparent text-[10px] font-semibold`}
                          >
                            {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                        <div className="col-span-1">
                          <input
                            value={item.notes || ""}
                            onChange={(e) => handleItemChange(idx, "notes", e.target.value)}
                            className={`${fieldCls} text-xs`}
                            placeholder="..."
                          />
                        </div>
                        <div className="col-span-1 flex gap-0.5 justify-end">
                          {form.items.length > 1 && (
                            <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-0.5" title="Remove line">
                              <X size={12} />
                            </button>
                          )}
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
                            className="flex-1 min-w-[12rem] px-2 py-1 text-[11px] border border-amber-300/40 rounded bg-white/80 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                          <button
                            type="button"
                            disabled={itemLineSaving === idx}
                            onClick={() => postItemLineUpdate(idx)}
                            className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50"
                          >
                            {itemLineSaving === idx ? "…" : "Post line update"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Totals */}
                  <div className="grid grid-cols-12 gap-2 mt-4 pt-3 border-t-2 border-amber-800/20">
                    <div className="col-span-7" />
                    <div className="col-span-5 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-800/60 font-bold uppercase">Items total</span>
                        <span className="font-bold">${itemsTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm items-center gap-2 pt-2 border-t-2 border-amber-800/30">
                        <span className="text-amber-900 font-extrabold uppercase">Quote total</span>
                        <input
                          name="priceEstimate"
                          value={form.priceEstimate}
                          onChange={handleChange}
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-28 text-right px-2 py-1 bg-white border-2 border-amber-800/30 rounded text-base focus:outline-none focus:border-amber-800/60 font-extrabold font-mono"
                          placeholder="$"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-2 pt-2 border-t border-amber-800/10">
                  <label className={labelCls}>Internal Notes (staff only)</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className={`${fieldCls} resize-y`} placeholder="Internal notes..." />
                </div>
              </div>

              {/* Save bar */}
              <div className="bg-amber-200/40 px-4 py-2 border-t-2 border-amber-300/50 flex flex-wrap items-center gap-3">
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-primary-500 text-white font-medium text-sm rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50">
                  <Save size={16} />
                  {saving ? "Saving..." : isEdit ? "Update quote" : "Create quote"}
                </button>
                {isEdit && form.customerEmail ? (
                  <label className="flex items-center gap-2 text-xs text-amber-900/80 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={saveNotify}
                      onChange={(e) => setSaveNotify(e.target.checked)}
                      className="w-4 h-4 text-primary-500 rounded border-amber-800/40 focus:ring-primary-500"
                    />
                    <Mail size={13} className="text-amber-800/70" />
                    Email {form.customerEmail} a quote update on save
                  </label>
                ) : isEdit ? (
                  <span className="text-[11px] text-amber-800/60 italic">Add a customer email above to enable email updates.</span>
                ) : null}
              </div>
            </div>
          </form>

          {/* Updates & Messages (edit mode) */}
          {isEdit && receipt && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Receipt-level Updates */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="font-semibold text-dark-900 mb-4">General Updates (visible to customer)</h3>
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
                  <p className="text-sm text-gray-400 mb-4">No general updates yet.</p>
                )}
                <form onSubmit={handleAddUpdate} className="space-y-2">
                  <input type="text" placeholder="Add a general update..." value={updateMsg} onChange={(e) => setUpdateMsg(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <div className="flex gap-2">
                    <select value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value)} className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="">Don't change status</option>
                      {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <button type="submit" className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors">
                      <Plus size={16} />
                    </button>
                  </div>
                  {receipt?.customerEmail ? (
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={updateNotify}
                        onChange={(e) => setUpdateNotify(e.target.checked)}
                        className="w-4 h-4 text-primary-500 rounded border-gray-300 focus:ring-primary-500"
                      />
                      <Mail size={13} className="text-primary-500" />
                      Email this update to <span className="font-mono">{receipt.customerEmail}</span>
                    </label>
                  ) : (
                    <p className="text-[11px] text-gray-400 italic">Add a customer email on this quote to enable customer email notifications.</p>
                  )}
                </form>
              </div>

              {/* Messages */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="font-semibold text-dark-900 mb-4">Messages</h3>
                {receipt.messages?.length > 0 ? (
                  <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {receipt.messages.map((m, i) => (
                      <div key={i} className={`flex ${m.sender === "customer" ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${m.sender === "customer" ? "bg-gray-100 text-dark-900" : "bg-primary-500 text-white"}`}>
                          <p>{m.message}</p>
                          <p className={`text-[10px] mt-1 ${m.sender === "customer" ? "text-gray-400" : "text-primary-200"}`}>
                            {m.sender} &mdash; {new Date(m.date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 mb-4">No messages yet.</p>
                )}
                <form onSubmit={handleStaffMessage} className="flex gap-2">
                  <input type="text" placeholder="Send a message to customer..." value={staffMsg} onChange={(e) => setStaffMsg(e.target.value)} className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
