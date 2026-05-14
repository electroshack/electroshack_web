import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import {
  Save,
  ArrowLeft,
  Trash2,
  Eye,
  EyeOff,
  Camera,
  Smartphone,
  Laptop,
  Tablet,
  Hash,
  ChevronDown,
  Watch,
} from "lucide-react";
import toast from "react-hot-toast";
import AdminLayout from "../../components/AdminLayout";
import InventoryImageUploader from "../../components/InventoryImageUploader";
import QuickAddCommonItems from "../../components/QuickAddCommonItems";
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
  { value: "in-stock", label: "In Stock" },
  { value: "sold", label: "Sold" },
  { value: "reserved", label: "Reserved" },
  { value: "returned", label: "Returned" },
];

const VALID_CONDITIONS = new Set(["new", "refurbished", "used", "for-parts"]);

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function yearFromText(s) {
  const m = String(s || "").match(/\b(20\d{2})\b/);
  return m && Number(m[1]) >= 2000 && Number(m[1]) <= 2090 ? m[1] : "";
}

/** Build a rich one-line summary when catalog does not send a long description */
function catalogSummaryFromHint(hint) {
  const brand = (hint.brand || "").trim();
  const model = (hint.modelLabel || hint.model || "").trim();
  const retail = (hint.retailCategory || "").trim();
  const yr = yearFromText(`${hint.displayName || ""} ${hint.title || ""} ${model}`);
  const parts = [brand, model, yr ? `(${yr})` : "", retail].filter(Boolean);
  return parts.join(" · ");
}

function formUpdateFromHint(f, hint) {
  if (!hint?.found) return f;
  const displayName = (hint.displayName || hint.title || "").trim();
  const descFromCatalog = typeof hint.description === "string" ? hint.description.trim() : "";
  const catOk = categories.some((c) => c.value === hint.category);
  const condOk = hint.suggestedCondition && VALID_CONDITIONS.has(hint.suggestedCondition);
  const priceVal =
    hint.suggestedSellingPrice != null && !Number.isNaN(Number(hint.suggestedSellingPrice)) ? String(hint.suggestedSellingPrice) : "";
  const imgArr = Array.isArray(hint.images) ? hint.images.filter(Boolean) : [];
  const retBc = hint.retailBarcode ? String(hint.retailBarcode).trim() : "";
  const imeiN = hint.imeiNormalized ? String(hint.imeiNormalized).trim() : "";
  const summaryLine = catalogSummaryFromHint(hint);
  const fallbackDesc = descFromCatalog || (summaryLine ? summaryLine.slice(0, 4000) : "");

  /** Prefer catalog / API for IDs and title; overwrite description from catalog when empty */
  return {
    ...f,
    barcode: retBc || f.barcode || "",
    imei: imeiN || f.imei || "",
    name: displayName || f.name || "",
    category: catOk ? hint.category : f.category,
    condition: condOk ? hint.suggestedCondition : f.condition,
    description: f.description?.trim() ? f.description : fallbackDesc,
    sellingPrice: f.sellingPrice != null && String(f.sellingPrice).trim() !== "" ? f.sellingPrice : priceVal || f.sellingPrice || "",
    notes: f.notes?.trim() ? f.notes : typeof hint.notes === "string" ? hint.notes : "",
    images: imgArr.length ? imgArr : f.images?.length ? f.images : [],
  };
}

/** Prefer lookup order: 15-digit in any field as IMEI → retail barcode → IMEI field → serial */
function pickPrimaryLookupCode(formLike) {
  const b = String(formLike.barcode || "").trim();
  const bd = b.replace(/\D/g, "");
  const im = digitsOnly(formLike.imei || "");
  const sn = String(formLike.serialNumber || "").trim();
  if (bd.length === 15) return { kind: "imei", code: bd };
  if (bd.length >= 8) return { kind: "barcode", code: b };
  if (im.length >= 14) return { kind: "imei", code: im };
  if (sn.length >= 6) return { kind: "serial", code: sn };
  return null;
}

function insightFromHint(hint) {
  if (!hint?.found) return null;
  const displayName = (hint.displayName || hint.title || "").trim();
  const imgArr = Array.isArray(hint.images) ? hint.images.filter(Boolean) : [];
  return {
    title: displayName,
    brand: hint.brand || "",
    model: hint.model || "",
    source: hint.source || "",
    tac: hint.tac || "",
    retailCategory: hint.retailCategory || "",
    priceCurrency: hint.priceCurrency || "",
    priceRangeHigh: hint.priceRangeHigh,
    suggestedSellingPrice: hint.suggestedSellingPrice,
    deviceFamily: hint.deviceFamily || "",
    modelLabel: hint.modelLabel || "",
    suggestedCondition: hint.suggestedCondition || "",
    imageCount: imgArr.length,
    luhnValid: hint.luhnValid,
    heroImage: hint.heroImage || (imgArr[0] && /^https?:\/\//i.test(imgArr[0]) ? imgArr[0] : null) || null,
  };
}

/** Labels + which ID fields match how the shop tracks devices */
function identifierConfig(category) {
  switch (category) {
    case "cell-phone":
      return {
        showImei: true,
        serialLabel: "Serial number",
        serialHelp: "Engraved / Settings — pair with IMEI for this unit.",
        imeiLabel: "IMEI (primary)",
        imeiHelp: "Settings → General → About, or dial *#06#. Usually 15 digits.",
        retailHelp: "UPC/EAN on the box — lookup & catalog match.",
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
        retailHelp: "Box UPC for catalog pricing when you have it.",
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
  notes: "",
  images: [],
};

export default function InventoryForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? searchParams.get("barcode") ?? "";
  const imeiFromUrl = searchParams.get("imei") ?? "";
  const serialFromUrl = searchParams.get("serial") ?? "";
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  /** Shown under breadcrumb when UPC catalog returned structured info */
  const [upcInsight, setUpcInsight] = useState(null);
  const [previewItemNumber, setPreviewItemNumber] = useState("");
  const barcodeRef = useRef(null);
  const formRef = useRef(form);
  formRef.current = form;
  const skipNextUrlCodeHint = useRef(false);
  const lastLiveHintKey = useRef("");
  const liveDebounce = useRef(null);
  const lastBatchMergeSig = useRef("");
  const [liveLookupReady, setLiveLookupReady] = useState(false);

  useEffect(() => {
    if (isEdit) return;
    API.get("/inventory/preview-next-number")
      .then(({ data }) => setPreviewItemNumber(data.itemNumber ? String(data.itemNumber) : ""))
      .catch(() => {});
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) return;
    const t = setTimeout(() => setLiveLookupReady(true), 900);
    return () => clearTimeout(t);
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

  /** Merge scan batch from AdminLayout (multiple codes + parse-sticker) */
  useEffect(() => {
    if (isEdit) return;
    const st = location.state || {};
    const hints = Array.isArray(st.inventoryHints) ? st.inventoryHints : [];
    const parsed = st.parsedSticker || null;
    if (!hints.length && !parsed?.imei && !parsed?.serial) return;
    const sig = `batch|${location.key}|${hints.length}|${parsed?.imei || ""}|${parsed?.serial || ""}|${hints.map((h) => h?.retailBarcode || h?.displayName || "").join(",")}`;
    if (sig === lastBatchMergeSig.current) return;
    lastBatchMergeSig.current = sig;
    skipNextUrlCodeHint.current = Boolean(hints.length);
    const primary = [...hints].reverse().find((h) => h?.found) || hints[0];
    setForm((f) => {
      let next = { ...f };
      if (parsed?.imei) next.imei = next.imei || String(parsed.imei).trim();
      if (parsed?.serial) next.serialNumber = next.serialNumber || String(parsed.serial).trim();
      for (const h of hints) {
        if (h?.found) next = formUpdateFromHint(next, h);
      }
      return next;
    });
    if (primary?.found) setUpcInsight(insightFromHint(primary));
    const lines = Array.isArray(st.scanLines) ? st.scanLines : [];
    const pref = lines.find((l) => digitsOnly(l).length !== 15) || lines[0];
    if (pref) {
      const d = digitsOnly(pref);
      lastLiveHintKey.current = d.length === 15 ? `imei:${d}` : `barcode:${String(pref).trim()}`;
    }
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: {} });
  }, [isEdit, location.hash, location.key, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (isEdit) return;
    const code = String(codeFromUrl || "").trim();
    if (!code) {
      setUpcInsight(null);
      return;
    }
    if (skipNextUrlCodeHint.current) {
      skipNextUrlCodeHint.current = false;
      const ds = digitsOnly(code);
      const isImeiScan = ds.length === 15;
      setForm((f) => ({
        ...f,
        ...(isImeiScan ? { imei: f.imei || ds } : { barcode: f.barcode || code.trim() }),
      }));
      return;
    }
    let cancelled = false;
    (async () => {
      const ds = digitsOnly(code);
      const isImeiScan = ds.length === 15;
      setForm((f) => ({
        ...f,
        ...(isImeiScan ? { imei: f.imei || ds } : { barcode: f.barcode || code.trim() }),
      }));
      setUpcInsight(null);
      try {
        const { data } = await API.get(`/inventory/by-barcode/${encodeURIComponent(code)}`);
        if (cancelled) return;
        navigate(`/admin/inventory/${data._id}`, { replace: true });
        toast.success("Opening existing item");
      } catch (e) {
        if (e.response?.status !== 404) return;
        try {
          const { data: hint } = await API.get(`/inventory/external-hint/${encodeURIComponent(code)}`);
          if (cancelled || !hint?.found) return;
          lastLiveHintKey.current = isImeiScan ? `imei:${ds}` : `barcode:${code.trim()}`;
          setForm((f) => formUpdateFromHint(f, hint));
          setUpcInsight(insightFromHint(hint));
          const displayName = (hint.displayName || hint.title || "").trim();
          const nice = hint.modelLabel
            ? `${hint.modelLabel}${hint.brand ? ` (${hint.brand})` : ""}`
            : displayName;
          const condOk = hint.suggestedCondition && VALID_CONDITIONS.has(hint.suggestedCondition);
          const condMsg = condOk ? ` · ${hint.suggestedCondition}` : "";
          const srcMsg = hint.source?.includes("imei") ? "Device ID" : "Catalog";
          toast.success(`${srcMsg}: ${nice}${condMsg} — review & save`);
        } catch {
          /* optional external DB */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, codeFromUrl, navigate]);

  /** Live catalog / device hint when barcode, IMEI, or serial changes (no extra button) */
  useEffect(() => {
    if (isEdit || !liveLookupReady) return;
    const picked = pickPrimaryLookupCode(formRef.current);
    if (!picked || picked.code.length < 8) return;
    const key = `${picked.kind}:${picked.code}`;
    clearTimeout(liveDebounce.current);
    liveDebounce.current = setTimeout(async () => {
      if (lastLiveHintKey.current === key) return;
      try {
        const { data: hint } = await API.get(`/inventory/external-hint/${encodeURIComponent(picked.code)}`);
        if (!hint?.found) return;
        lastLiveHintKey.current = key;
        setForm((f) => formUpdateFromHint(f, hint));
        setUpcInsight(insightFromHint(hint));
      } catch {
        /* ignore */
      }
    }, 480);
    return () => clearTimeout(liveDebounce.current);
  }, [form.barcode, form.imei, form.serialNumber, isEdit, liveLookupReady]);

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
            dateBought: data.dateBought ? data.dateBought.split("T")[0] : "",
            dateSold: data.dateSold ? data.dateSold.split("T")[0] : "",
          });
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
    toast.success(`Pre-filled "${preset.label}" — adjust price & photo, then save.`);
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
        await API.put(`/inventory/${id}`, payload);
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
        try {
          const { data: hint } = await API.get(`/inventory/external-hint/${encodeURIComponent(c)}`);
          if (hint?.found) {
            const dsk = digitsOnly(c);
            lastLiveHintKey.current = dsk.length === 15 ? `imei:${dsk}` : `barcode:${c.trim()}`;
            setForm((f) => formUpdateFromHint(f, hint));
            setUpcInsight(insightFromHint(hint));
            const displayName = (hint.displayName || hint.title || "").trim();
            const nice = hint.modelLabel
              ? `${hint.modelLabel}${hint.brand ? ` · ${hint.brand}` : ""}`
              : displayName;
            const condOk2 = hint.suggestedCondition && VALID_CONDITIONS.has(hint.suggestedCondition);
            const srcMsg = hint.source?.includes("imei") ? "Device ID" : "Catalog";
            toast.success(`${srcMsg}: ${nice}${condOk2 ? ` · ${hint.suggestedCondition}` : ""}`);
            return;
          }
        } catch {
          /* ignore */
        }
        toast.success("New barcode — enter name and category manually.");
      } else {
        toast.error("Barcode lookup failed.");
      }
    }
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

  const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
  const labelCls = "block text-sm font-medium text-gray-600 mb-1";
  const monoInputCls = `${inputCls} font-mono text-[13px] tracking-wide`;
  const idCfg = identifierConfig(form.category);
  const IdIcon = idCfg.icon;

  return (
    <AdminLayout title={isEdit ? `Item #${form.itemNumber}` : "New item"}>
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
        </div>
      ) : (
        <div className="w-full min-w-0 max-w-[1400px] space-y-5">
          {upcInsight && !isEdit && (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 sm:px-8 py-6 shadow-sm text-center">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-5 sm:gap-8">
                {(() => {
                  const heroSrc = upcInsight.heroImage || (Array.isArray(form.images) && form.images[0]);
                  return heroSrc && /^https?:\/\//i.test(String(heroSrc)) ? (
                  <div className="shrink-0 mx-auto sm:mx-0">
                    <img
                      src={String(heroSrc)}
                      alt=""
                      className="h-36 w-36 sm:h-40 sm:w-40 object-contain mx-auto"
                    />
                  </div>
                ) : null;
                })()}
                <div className="min-w-0 flex-1 text-left sm:text-center">
                  {upcInsight.brand ? (
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-600">{upcInsight.brand}</p>
                  ) : null}
                  <h3 className="text-lg sm:text-xl font-bold text-dark-900 leading-snug mt-0.5">
                    {form.name || upcInsight.modelLabel || upcInsight.title || "Matched product"}
                  </h3>
                  {upcInsight.modelLabel && upcInsight.modelLabel !== form.name ? (
                    <p className="text-sm text-gray-600 mt-1">{upcInsight.modelLabel}</p>
                  ) : null}
                  {upcInsight.tac ? (
                    <p className="text-xs font-mono text-gray-500 mt-2">
                      TAC {upcInsight.tac}
                      {upcInsight.luhnValid === false ? <span className="text-amber-600 ml-1">· check IMEI</span> : null}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-start gap-4">
            <button
              type="button"
              onClick={() => navigate("/admin/inventory")}
              className="mt-1 text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1 -m-1"
            >
              <ArrowLeft size={22} />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-dark-900 tracking-tight">{isEdit ? "Edit inventory item" : "Add inventory item"}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Use the camera (sidebar or next to barcode) to capture the label — the form fills from the scan. Adjust category and pricing as needed.
              </p>
            </div>
            {isEdit && (
              <button type="button" onClick={handleDelete} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isEdit && <QuickAddCommonItems onPick={applyPreset} disabled={saving} />}

            {/* Category (+ internal # on edit only) */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Category</p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                          form.category === c.value
                            ? "bg-primary-500 text-white border-primary-500 shadow-sm"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                {isEdit && form.itemNumber != null && String(form.itemNumber).trim() !== "" ? (
                  <div className="w-full sm:w-auto shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Internal item #</p>
                    <p className="font-mono text-sm font-semibold text-dark-900">{form.itemNumber}</p>
                    <p className="text-[11px] text-gray-500 mt-1">Shop use only — not editable here</p>
                  </div>
                ) : !isEdit ? (
                  <div className="w-full sm:w-auto shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Internal item #</p>
                    <p className="font-mono text-lg font-bold text-dark-900 tabular-nums">{previewItemNumber || "—"}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_288px] gap-6 items-start">
              <div className="min-w-0 space-y-5 order-2 lg:order-1">
            {/* Listing */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm">
              <h3 className="font-semibold text-dark-900 mb-4">Listing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelCls}>Name *</label>
                  <input name="name" value={form.name} onChange={handleChange} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Condition</label>
                  <select name="condition" value={form.condition} onChange={handleChange} className={inputCls}>
                    {conditions.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className={inputCls}>
                    {statuses.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Quantity</label>
                  <input name="quantity" value={form.quantity} onChange={handleChange} type="number" min="0" className={inputCls} />
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      name="showOnStorefront"
                      type="checkbox"
                      checked={form.showOnStorefront}
                      onChange={handleChange}
                      className="w-4 h-4 text-primary-500 rounded border-gray-300 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-600 flex items-center gap-1">
                      {form.showOnStorefront ? <Eye size={14} /> : <EyeOff size={14} />}
                      Show on storefront
                    </span>
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Description</label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={2} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Photos for storefront */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm">
              <InventoryImageUploader value={form.images || []} onChange={handleImagesChange} max={1} />
            </div>

            {/* Pricing row */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm">
              <h3 className="font-semibold text-dark-900 mb-4">Pricing</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                <div>
                  <label className={labelCls}>Cost ($)</label>
                  <input name="costPrice" value={form.costPrice} onChange={handleChange} type="number" step="0.01" min="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Selling price ($)</label>
                  <input name="sellingPrice" value={form.sellingPrice} onChange={handleChange} type="number" step="0.01" min="0" className={inputCls} />
                </div>
              </div>
            </div>

            <details className="group rounded-2xl border border-gray-100 bg-white shadow-sm open:ring-1 open:ring-gray-100">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 text-sm font-semibold text-dark-900 hover:bg-gray-50/80 rounded-2xl">
                <span>Purchase (supplier)</span>
                <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-5 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-50">
                <div className="md:col-span-2 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Bought from</label>
                      <input name="boughtFrom" value={form.boughtFrom} onChange={handleChange} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input name="boughtFromPhone" value={form.boughtFromPhone} onChange={handleChange} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Date bought</label>
                      <input name="dateBought" value={form.dateBought} onChange={handleChange} type="date" className={inputCls} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Purchase notes</label>
                      <textarea name="purchaseNotes" value={form.purchaseNotes} onChange={handleChange} rows={2} className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>
            </details>

            <details className="group rounded-2xl border border-gray-100 bg-white shadow-sm open:ring-1 open:ring-gray-100">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 text-sm font-semibold text-dark-900 hover:bg-gray-50/80 rounded-2xl">
                <span>Sale (customer)</span>
                <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-5 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-50">
                <div className="md:col-span-2 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Sold to</label>
                      <input name="soldTo" value={form.soldTo} onChange={handleChange} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input name="soldToPhone" value={form.soldToPhone} onChange={handleChange} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Date sold</label>
                      <input name="dateSold" value={form.dateSold} onChange={handleChange} type="date" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Sale receipt #</label>
                      <input name="saleReceiptNumber" value={form.saleReceiptNumber} onChange={handleChange} className={inputCls} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Sale notes</label>
                      <textarea name="saleNotes" value={form.saleNotes} onChange={handleChange} rows={2} className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>
            </details>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm">
              <h3 className="font-semibold text-dark-900 mb-2">Internal notes</h3>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className={inputCls} placeholder="Staff-only — warranty notes, quirks, etc." />
            </div>

              </div>

              <aside className="min-w-0 w-full lg:max-w-[300px] lg:w-auto order-1 lg:order-2 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-stretch gap-3">
                  <div className="flex-1 min-w-0 flex flex-col gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <IdIcon size={14} className="text-gray-500" aria-hidden />
                      Device IDs
                    </p>
                    <div>
                      <label className={labelCls}>Barcode</label>
                      <input
                        ref={barcodeRef}
                        name="barcode"
                        value={form.barcode}
                        onChange={handleChange}
                        className={`${monoInputCls} text-xs py-2`}
                        placeholder="UPC / EAN"
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            lookupBarcode(e.currentTarget.value);
                          }
                        }}
                      />
                    </div>
                    {idCfg.showImei ? (
                      <div>
                        <label className={labelCls}>{idCfg.imeiLabel}</label>
                        <input name="imei" value={form.imei} onChange={handleChange} className={`${monoInputCls} text-xs py-2`} placeholder="IMEI" autoComplete="off" />
                      </div>
                    ) : null}
                    <div>
                      <label className={labelCls}>{idCfg.serialLabel}</label>
                      <input
                        name="serialNumber"
                        value={form.serialNumber}
                        onChange={handleChange}
                        className={`${monoInputCls} text-xs py-2`}
                        placeholder="Serial"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="shrink-0 flex sm:flex-col justify-center sm:justify-start sm:pt-6 items-center">
                    <button
                      type="button"
                      title="Open camera scanner"
                      className="inline-flex items-center justify-center h-11 w-11 rounded-xl text-gray-600 border border-gray-200/80 bg-white hover:bg-gray-50 hover:text-primary-600 hover:border-primary-200/80 active:shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)] active:border-gray-300 transition-shadow"
                      onClick={() => window.dispatchEvent(new Event("es-open-barcode-scan"))}
                    >
                      <Camera size={22} strokeWidth={2} className="shrink-0" aria-hidden />
                    </button>
                  </div>
                </div>
              </aside>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white font-medium text-sm rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 shadow-sm"
              >
                <Save size={16} />
                {saving ? "Saving..." : isEdit ? "Save changes" : "Add to inventory"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
