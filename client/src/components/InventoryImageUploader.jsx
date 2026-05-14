import React, { useCallback, useRef, useState } from "react";
import { Upload, X, Image as ImageIcon, Link as LinkIcon, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Standardize uploaded inventory photos so they look consistent on the storefront:
 *   - max 800x800 with aspect-fit
 *   - centered on a pure-white square (so portrait phones / landscape laptops align)
 *   - re-encoded as JPEG @ ~0.85 (small enough to store inline in MongoDB)
 */
const TARGET_SIZE = 800;
const JPEG_QUALITY = 0.85;
const MAX_BYTES_AFTER = 350 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Could not read file."));
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = src;
  });
}

async function standardizeToSquare(srcDataUrl) {
  const img = await loadImage(srcDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

  /* Aspect-fit (object-contain) the source onto a 800x800 white background */
  const scale = Math.min(TARGET_SIZE / img.width, TARGET_SIZE / img.height);
  const drawW = Math.round(img.width * scale);
  const drawH = Math.round(img.height * scale);
  const dx = Math.round((TARGET_SIZE - drawW) / 2);
  const dy = Math.round((TARGET_SIZE - drawH) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, drawW, drawH);

  let quality = JPEG_QUALITY;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > MAX_BYTES_AFTER * 1.36 && quality > 0.55) {
    quality -= 0.1;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  return out;
}

function isUrl(s) {
  return /^https?:\/\//i.test(String(s || "").trim());
}

export default function InventoryImageUploader({ value = [], onChange, max = 4 }) {
  const [busy, setBusy] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const inputRef = useRef(null);

  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).filter((f) => /^image\//i.test(f.type));
      if (!files.length) return;
      const remaining = Math.max(0, max - value.length);
      const slice = files.slice(0, remaining);
      if (slice.length === 0) {
        toast.error(`You can attach up to ${max} images.`);
        return;
      }
      setBusy(true);
      const ready = [];
      for (const f of slice) {
        try {
          const raw = await readAsDataUrl(f);
          const norm = await standardizeToSquare(raw);
          ready.push(norm);
        } catch (e) {
          console.error("[image] standardize failed:", e);
          toast.error(`Could not process ${f.name}.`);
        }
      }
      if (ready.length) {
        onChange([...value, ...ready]);
        toast.success(`Added ${ready.length} image${ready.length > 1 ? "s" : ""}`);
      }
      setBusy(false);
    },
    [max, onChange, value]
  );

  const handleAddUrl = useCallback(async () => {
    const u = urlInput.trim();
    if (!isUrl(u)) {
      toast.error("Paste a full https://... image URL.");
      return;
    }
    if (value.length >= max) {
      toast.error(`You can attach up to ${max} images.`);
      return;
    }
    setBusy(true);
    try {
      const norm = await standardizeToSquare(u);
      onChange([...value, norm]);
      setUrlInput("");
      toast.success("Added image from URL");
    } catch {
      /* if CORS blocks the canvas read, store the raw URL — storefront still renders it */
      onChange([...value, u]);
      setUrlInput("");
      toast.success("Added image (CORS-protected — original URL kept)");
    } finally {
      setBusy(false);
    }
  }, [max, onChange, urlInput, value]);

  const removeAt = (idx) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (busy) return;
    handleFiles(e.dataTransfer?.files);
  };

  const slots = Array.from({ length: max }, (_, i) => value[i] ?? null);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
          <ImageIcon size={14} className="text-primary-500" />
          Photos for storefront
        </p>
        <p className="text-[11px] text-gray-400">
          Up to {max} · auto-resized to {TARGET_SIZE}×{TARGET_SIZE} on a white background
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {slots.map((src, idx) =>
          src ? (
            <div key={idx} className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
              <img src={src} alt="" className="w-full h-full object-contain bg-white" />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove photo"
              >
                <X size={14} />
              </button>
              {idx === 0 && (
                <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wider bg-primary-500 text-white px-1.5 py-0.5 rounded">
                  Cover
                </span>
              )}
            </div>
          ) : (
            <button
              key={idx}
              type="button"
              onClick={() => inputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60 hover:border-primary-300 hover:bg-primary-50/40 transition-colors flex flex-col items-center justify-center text-gray-400 hover:text-primary-500"
            >
              {busy ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
              <span className="text-[10px] mt-1.5 font-medium uppercase tracking-wider">Add photo</span>
            </button>
          )
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-stretch gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || value.length >= max}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:text-primary-600 transition-colors disabled:opacity-50"
        >
          <Upload size={14} />
          Upload photo
        </button>
        <div className="flex-1 min-w-[220px] flex">
          <input
            type="text"
            placeholder="Or paste an https://… image URL"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddUrl();
              }
            }}
            className="flex-1 min-w-0 px-3 py-2 text-xs bg-white border border-gray-200 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            disabled={busy || !urlInput.trim() || value.length >= max}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-r-lg border border-l-0 border-gray-200 bg-gray-50 text-gray-600 hover:bg-primary-500 hover:text-white hover:border-primary-500 transition-colors disabled:opacity-50"
          >
            <LinkIcon size={12} />
            Add URL
          </button>
        </div>
      </div>
    </div>
  );
}
