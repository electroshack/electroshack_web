import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Save,
  ArrowLeft,
  Trash2,
  Eye,
  EyeOff,
  Smartphone,
  Laptop,
  Tablet,
  Hash,
  ChevronDown,
  Watch,
  Undo2,
} from "lucide-react";
import toast from "react-hot-toast";
import AdminLayout from "../../components/AdminLayout";
import InventoryImageUploader from "../../components/InventoryImageUploader";
import QuickAddCommonItems from "../../components/QuickAddCommonItems";
import NameTypeahead from "../../components/NameTypeahead";
import ScanBarcodeIcon from "../../components/ScanBarcodeIcon";
import API from "../../api";

const categories = [
  { value: "cell-phone", label: "Cell Phone" },
  { value: "laptop", label: "Laptop" },
  { value: "pc", label: "PC" },
  { value: "tablet", label: "Tablet" },
  { value: "smartwatch", label: "Smartwatch" },
  { value: "accessory", label: "Accessory" },
  { value: "part", label: "Part" },
  { value: "other", label: "Other" },
];

const conditions = [
  { value: "new", label: "New" },
  { value: "refurbished", label: "Refurbished" },
  { value: "used", label: "Used" },
  { value: "for-parts", label: "For Parts" },
];

const statuses = [
  { value: "in-stock", label: "In stock" },
  { value: "out-of-stock", label: "Out of stock" },
];

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

// ### ID field labels per category (IMEI vs serial).
function identifierConfig(category) {
  switch (category) {
    case "cell-phone":
      return {
        showImei: true,
        serialLabel: "Serial number",
        serialHelp: "Engraved / Settings — pair with IMEI for this unit.",
        imeiLabel: "IMEI (primary)",
        imeiHelp: "Settings → General → About, or dial *#06#. Usually 15 digits.",
        retailHelp: "UPC/EAN on the box.",
        icon: Smartphone,
        headline: "Phone identifiers",
      };
    case "tablet":
      return {
        showImei: true,
        serialLabel: "Serial number",
        serialHelp: "Back of device or Settings — use with IMEI on cellular models.",
        imeiLabel: "IMEI (cellular)",
        imeiHelp: "Cellular iPad: same as phone. Wi‑only: leave blank.",
        retailHelp: "Box UPC if you scan retail barcodes.",
        icon: Tablet,
        headline: "Tablet identifiers",
      };
    case "smartwatch":
      return {
        showImei: true,
        serialLabel: "Serial number",
        serialHelp: "Engraved on case; pair with cellular IMEI when present.",
        imeiLabel: "IMEI (cellular watch)",
        imeiHelp: "Apple Watch cellular / Galaxy Watch LTE: IMEI1 in Settings or on box sticker.",
        retailHelp: "Box UPC.",
        icon: Watch,
        headline: "Watch identifiers",
      };
    case "laptop":
    case "pc":
      return {
        showImei: false,
        serialLabel: category === "laptop" ? "Serial number (primary)" : "Serial / service tag",
        serialHelp:
          category === "laptop"
            ? "Sticker on chassis — this is usually the only ID you record."
            : "Service tag, chassis sticker, or part reference.",
        imeiLabel: "",
        imeiHelp: "",
        retailHelp: "Retail SKU/barcode when applicable.",
        icon: Laptop,
        headline: category === "laptop" ? "Laptop identifiers" : "System identifiers",
      };
    default:
      return {
        showImei: false,
        serialLabel: "Serial / part number",
        serialHelp: "Optional — use for warranty or Apple Watch, accessories with S/N.",
        imeiLabel: "IMEI",
        imeiHelp: "Only if this unit has one (e.g. cellular watch).",
        retailHelp: "Barcode or SKU on packaging.",
        icon: Hash,
        headline: "Product identifiers",
      };
  }
}

const emptyForm = {
  itemNumber: "",
  barcode: "",
  imei: "",
  serialNumber: "",
  name: "",
  description: "",
  category: "cell-phone",
  condition: "used",
  costPrice: "",
  sellingPrice: "",
  boughtFrom: "",
  boughtFromPhone: "",
  dateBought: "",
  purchaseNotes: "",
  soldTo: "",
  soldToPhone: "",
  dateSold: "",
  saleNotes: "",
  saleReceiptNumber: "",
  quantity: 1,
  status: "in-stock",
  showOnStorefront: true,
  showOnStorefrontWhenEmpty: false,
  notes: "",
  images: [],
};

export default function InventoryForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? searchParams.get("barcode") ?? "";
  const imeiFromUrl = searchParams.get("imei") ?? "";
  const serialFromUrl = searchParams.get("serial") ?? "";
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [previewItemNumber, setPreviewItemNumber] = useState("");
  const barcodeRef = useRef(null);
  const formRef = useRef(form);
  formRef.current = form;
  const [stockLog, setStockLog] = useState([]);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    if (isEdit) return;
    API.get("/inventory/preview-next-number")
      .then(({ data }) => setPreviewItemNumber(data.itemNumber ? String(data.itemNumber) : ""))
      .catch(() => {});
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) return;
    if (imeiFromUrl || serialFromUrl) {
      setForm((f) => ({
        ...f,
        imei: f.imei || imeiFromUrl,
        serialNumber: f.serialNumber || serialFromUrl,
      }));
    }
  }, [isEdit, imeiFromUrl, serialFromUrl]);

  // # Scan landing: fill barcode/IMEI. Shop lookup only — no cloud catalog.
  useEffect(() => {
    if (isEdit) return;
    const code = String(codeFromUrl || "").trim();
    if (!code) return;
    let cancelled = false;
    (async () => {
      const ds = digitsOnly(code);
      const isImeiScan = ds.length === 15;
      setForm((f) => ({
        ...f,
        ...(isImeiScan ? { imei: f.imei || ds } : { barcode: f.barcode || code.trim() }),
      }));
      try {
        const { data } = await API.get(`/inventory/by-barcode/${encodeURIComponent(code)}`);
        if (cancelled) return;
        navigate(`/admin/inventory/${data._id}`, { replace: true });
        toast.success("Opening existing item");
      } catch (e) {
        if (e.response?.status !== 404) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, codeFromUrl, navigate]);

  useEffect(() => {
    if (isEdit) {
      API.get(`/inventory/${id}`)
        .then(({ data }) => {
          setForm({
            ...emptyForm,
            ...data,
            barcode: data.barcode || "",
            imei: data.imei || "",
            serialNumber: data.serialNumber || "",
            costPrice: data.costPrice || "",
            sellingPrice: data.sellingPrice || "",
            images: Array.isArray(data.images) ? data.images : [],
            showOnStorefrontWhenEmpty: Boolean(data.showOnStorefrontWhenEmpty),
            dateBought: data.dateBought ? data.dateBought.split("T")[0] : "",
            dateSold: data.dateSold ? data.dateSold.split("T")[0] : "",
            status: data.status === "in-stock" || data.status === "reserved" ? "in-stock" : "out-of-stock",
          });
          setStockLog(Array.isArray(data.stockEvents) ? [...data.stockEvents].reverse() : []);
        })
        .catch(() => toast.error("Item not found."))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleImagesChange = (next) => {
    setForm((prev) => ({ ...prev, images: Array.isArray(next) ? next : [] }));
  };

  /** Pre-fill from a "common item" preset without clobbering user input */
  const applyPreset = (preset) => {
    setForm((prev) => ({
      ...prev,
      name: prev.name?.trim() ? prev.name : preset.name,
      description: prev.description?.trim() ? prev.description : preset.description,
      category: preset.category || prev.category,
      condition: preset.condition || prev.condition,
      sellingPrice:
        prev.sellingPrice != null && String(prev.sellingPrice).trim() !== ""
          ? prev.sellingPrice
          : preset.sellingPrice
            ? String(preset.sellingPrice)
            : prev.sellingPrice,
      quantity: prev.quantity || preset.quantity || 1,
      status: prev.status || "in-stock",
      showOnStorefront: prev.showOnStorefront,
    }));
    toast.success(preset.label);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        costPrice: parseFloat(form.costPrice) || 0,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        quantity: parseInt(form.quantity) || 1,
        dateBought: form.dateBought || undefined,
        dateSold: form.dateSold || undefined,
      };
      if (!isEdit) {
        delete payload.itemNumber;
      }
      if (isEdit) {
        const { data } = await API.put(`/inventory/${id}`, payload);
        setStockLog(Array.isArray(data.stockEvents) ? [...data.stockEvents].reverse() : []);
        toast.success("Item updated!");
      } else {
        await API.post("/inventory", payload);
        toast.success("Item added!");
        navigate("/admin/inventory");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save.");
    }
    setSaving(false);
  };

  const lookupBarcode = async (codeOverride) => {
    const c = String(codeOverride != null && codeOverride !== "" ? codeOverride : formRef.current.barcode ?? "").trim();
    if (!c) return;
    const ds = digitsOnly(c);
    if (ds.length === 15) {
      setForm((f) => ({ ...f, imei: f.imei || ds }));
    }
    try {
      const { data } = await API.get(`/inventory/by-barcode/${encodeURIComponent(c)}`);
      navigate(`/admin/inventory/${data._id}`);
      toast.success("Opened existing item");
    } catch (err) {
      if (err.response?.status === 404) {
        toast.success("New barcode — enter name and category manually.");
      } else {
        toast.error("Barcode lookup failed.");
      }
    }
  };

  const handleUndoStock = async () => {
    if (!id) return;
    setUndoing(true);
    try {
      const { data } = await API.post(`/inventory/${id}/undo-stock`);
      const next = data.item || {};
      setForm((f) => ({
        ...f,
        quantity: next.quantity ?? f.quantity,
        status: next.status || f.status,
        showOnStorefront: next.showOnStorefront ?? f.showOnStorefront,
      }));
      setStockLog(Array.isArray(next.stockEvents) ? [...next.stockEvents].reverse() : stockLog);
      toast.success("Previous stock snapshot restored.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Nothing to undo.");
    }
    setUndoing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    try {
      await API.delete(`/inventory/${id}`);
      toast.success("Item deleted.");
      navigate("/admin/inventory");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const inputCls = "w-full h-8 px-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500";
  const labelCls = "block text-xs font-medium text-gray-600 mb-0.5";
  const monoInputCls = `${inputCls} font-mono text-[13px] tracking-wide`;
  const idCfg = identifierConfig(form.category);

  return (
    <AdminLayout title={isEdit ? `Item #${form.itemNumber}` : "New item"}>
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : (
        <div className="w-full min-w-0 max-w-5xl space-y-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate("/admin/inventory")} className="text-gray-400 hover:text-gray-600 p-1">
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-base font-semibold text-dark-900">{isEdit ? "Edit item" : "Add item"}</h2>
            <span className="ml-auto font-mono text-xs text-gray-500">#{isEdit ? form.itemNumber : previewItemNumber || "—"}</span>
            {isEdit ? (
              <button type="button" onClick={handleDelete} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600">
                <Trash2 size={13} /> Delete
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-2">
            {!isEdit && <QuickAddCommonItems onPick={applyPreset} disabled={saving} />}

            <div className="rounded-sm border border-gray-200 bg-white p-2.5 space-y-2">
              <div className="flex flex-wrap gap-1">
                {categories.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                    className={`px-2 py-0.5 rounded-sm text-xs font-medium border ${
                      form.category === c.value
                        ? "bg-primary-500 text-white border-primary-500"
                        : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 items-start">
              <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-6 gap-2">
                <div className="md:col-span-6">
                  <label className={labelCls}>Name *</label>
                  <input name="name" value={form.name} onChange={handleChange} required className={inputCls} autoComplete="off" />
                  {!isEdit ? (
                    <NameTypeahead
                      query={form.name}
                      barcode={form.barcode}
                      imei={form.imei}
                      serial={form.serialNumber}
                      onPick={(it) => {
                        setForm((f) => ({
                          ...f,
                          name: it.name || f.name,
                          category: it.category || f.category,
                          sellingPrice:
                            f.sellingPrice != null && String(f.sellingPrice).trim() !== ""
                              ? f.sellingPrice
                              : it.sellingPrice != null
                                ? String(it.sellingPrice)
                                : f.sellingPrice,
                        }));
                      }}
                    />
                  ) : null}
                </div>
                <div>
                  <label className={labelCls}>Condition</label>
                  <select name="condition" value={form.condition} onChange={handleChange} className={inputCls}>
                    {conditions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className={inputCls}>
                    {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Qty</label>
                  <input name="quantity" value={form.quantity} onChange={handleChange} type="number" min="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Cost ($)</label>
                  <input name="costPrice" value={form.costPrice} onChange={handleChange} type="number" step="0.01" min="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Sell ($)</label>
                  <input name="sellingPrice" value={form.sellingPrice} onChange={handleChange} type="number" step="0.01" min="0" className={inputCls} />
                </div>
                <div className="md:col-span-6 flex flex-wrap gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                    <input name="showOnStorefront" type="checkbox" checked={form.showOnStorefront} onChange={handleChange} className="w-3.5 h-3.5 text-primary-500 rounded" />
                    {form.showOnStorefront ? <Eye size={12} /> : <EyeOff size={12} />}
                    Storefront
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                    <input name="showOnStorefrontWhenEmpty" type="checkbox" checked={form.showOnStorefrontWhenEmpty} onChange={handleChange} className="w-3.5 h-3.5 text-primary-500 rounded" />
                    Show if out of stock
                  </label>
                </div>
                <div className="md:col-span-3">
                  <label className={labelCls}>Barcode</label>
                  <div className="flex gap-1">
                    <input
                      ref={barcodeRef}
                      name="barcode"
                      value={form.barcode}
                      onChange={handleChange}
                      className={`${monoInputCls} text-xs`}
                      placeholder="UPC / EAN"
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          lookupBarcode(e.currentTarget.value);
                        }
                      }}
                    />
                    <button type="button" title="Scan" className="h-8 w-8 inline-flex items-center justify-center border border-gray-200 rounded-sm text-gray-500 hover:text-primary-600" onClick={() => window.dispatchEvent(new Event("es-open-barcode-scan"))}>
                      <ScanBarcodeIcon size={20} />
                    </button>
                  </div>
                </div>
                {idCfg.showImei ? (
                  <div className="md:col-span-3">
                    <label className={labelCls}>{idCfg.imeiLabel}</label>
                    <input name="imei" value={form.imei} onChange={handleChange} className={`${monoInputCls} text-xs`} placeholder="IMEI" autoComplete="off" />
                  </div>
                ) : null}
                <div className={idCfg.showImei ? "md:col-span-3" : "md:col-span-3"}>
                  <label className={labelCls}>{idCfg.serialLabel}</label>
                  <input name="serialNumber" value={form.serialNumber} onChange={handleChange} className={`${monoInputCls} text-xs`} placeholder="Serial" autoComplete="off" />
                </div>
                <div className="md:col-span-6">
                  <label className={labelCls}>Description</label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={2} className={inputCls} />
                </div>
              </div>
              <InventoryImageUploader value={form.images || []} onChange={handleImagesChange} max={1} />
              </div>
            </div>

            <details className="group rounded-sm border border-gray-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-dark-900">
                Purchase (supplier)
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-open:rotate-180" />
              </summary>
              <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2 border-t border-gray-50 pt-2">
                <div><label className={labelCls}>Bought from</label><input name="boughtFrom" value={form.boughtFrom} onChange={handleChange} className={inputCls} /></div>
                <div><label className={labelCls}>Phone</label><input name="boughtFromPhone" value={form.boughtFromPhone} onChange={handleChange} className={inputCls} /></div>
                <div><label className={labelCls}>Date bought</label><input name="dateBought" value={form.dateBought} onChange={handleChange} type="date" className={inputCls} /></div>
                <div className="md:col-span-2"><label className={labelCls}>Purchase notes</label><textarea name="purchaseNotes" value={form.purchaseNotes} onChange={handleChange} rows={2} className={inputCls} /></div>
              </div>
            </details>

            <details className="group rounded-sm border border-gray-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-dark-900">
                Sale (customer)
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-open:rotate-180" />
              </summary>
              <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2 border-t border-gray-50 pt-2">
                <div><label className={labelCls}>Sold to</label><input name="soldTo" value={form.soldTo} onChange={handleChange} className={inputCls} /></div>
                <div><label className={labelCls}>Phone</label><input name="soldToPhone" value={form.soldToPhone} onChange={handleChange} className={inputCls} /></div>
                <div><label className={labelCls}>Date sold</label><input name="dateSold" value={form.dateSold} onChange={handleChange} type="date" className={inputCls} /></div>
                <div><label className={labelCls}>Sale receipt #</label><input name="saleReceiptNumber" value={form.saleReceiptNumber} onChange={handleChange} className={inputCls} /></div>
                <div className="md:col-span-2"><label className={labelCls}>Sale notes</label><textarea name="saleNotes" value={form.saleNotes} onChange={handleChange} rows={2} className={inputCls} /></div>
              </div>
            </details>

            <details className="group rounded-sm border border-gray-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-dark-900">
                Internal notes
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-open:rotate-180" />
              </summary>
              <div className="px-3 pb-3">
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className={inputCls} />
              </div>
            </details>

            {isEdit && stockLog.length > 0 ? (
              <div className="rounded-sm border border-gray-200 bg-white p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold text-dark-900">Stock log</h3>
                  <button type="button" disabled={undoing} onClick={handleUndoStock} className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 disabled:opacity-50">
                    <Undo2 size={12} /> Undo last
                  </button>
                </div>
                <ul className="space-y-0.5 max-h-32 overflow-y-auto text-[11px] text-gray-600">
                  {stockLog.slice(0, 20).map((ev, i) => (
                    <li key={ev.eventId || i} className="flex justify-between gap-2 border-b border-gray-50 py-0.5">
                      <span>{ev.reason} · qty {ev.oldQuantity} → {ev.newQuantity}</span>
                      <span className="text-gray-400 shrink-0">{ev.actor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 h-8 px-3 bg-primary-500 text-white font-medium text-sm rounded-sm hover:bg-primary-600 disabled:opacity-50">
              <Save size={14} />
              {saving ? "Saving..." : isEdit ? "Save" : "Add to inventory"}
            </button>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
