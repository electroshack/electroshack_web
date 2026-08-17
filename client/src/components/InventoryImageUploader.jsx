import React, { useCallback, useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

// ### 800x800 white-square JPEG for Mongo inline photos.
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

  // - Aspect-fit onto an 800x800 white square.
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

export default function InventoryImageUploader({ value = [], onChange, max = 1 }) {
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
    <div className="w-24 shrink-0">
      <div className={`grid gap-1 mb-1 ${max === 1 ? "w-24" : "grid-cols-4 w-fit"}`}>
        {slots.map((src, idx) =>
          src ? (
            <div key={idx} className="group relative w-24 h-24 overflow-hidden border border-gray-200 bg-white rounded-sm">
              <img src={src} alt="" className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute top-0.5 right-0.5 inline-flex items-center justify-center w-5 h-5 bg-black/60 text-white opacity-0 group-hover:opacity-100"
                aria-label="Remove photo"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              key={idx}
              type="button"
              onClick={() => inputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="w-24 h-24 border border-dashed border-gray-300 bg-gray-50 hover:border-primary-400 flex items-center justify-center text-gray-400 rounded-sm"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
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

      <input
        type="text"
        placeholder="URL"
        value={urlInput}
        onChange={(e) => setUrlInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAddUrl();
          }
        }}
        className="w-24 px-1 py-0.5 text-[10px] bg-white border border-gray-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
    </div>
  );
}
