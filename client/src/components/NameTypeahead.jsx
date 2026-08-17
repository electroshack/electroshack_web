import React, { useEffect, useRef, useState } from "react";
import API from "../api";

// # Name suggestions: prefix, then word-starts, then contains.
export default function NameTypeahead({
  query,
  barcode = "",
  imei = "",
  serial = "",
  onPick,
  enabled = true,
}) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const q = String(query || "").trim();
    if (q.length < 1 && !barcode && !imei && !serial) {
      setItems([]);
      setOpen(false);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await API.get("/inventory/name-suggestions", {
          params: { q, barcode, imei, serial, limit: 8 },
        });
        const next = data.items || [];
        setItems(next);
        setOpen(next.length > 0);
      } catch {
        setItems([]);
      }
    }, 140);
    return () => clearTimeout(t);
  }, [query, barcode, imei, serial, enabled]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!open || items.length === 0) return null;

  return (
    <div ref={wrapRef} className="relative">
      <div className="absolute z-20 mt-1 w-full rounded-sm border border-gray-200 bg-white shadow-md overflow-hidden">
        <ul>
          {items.map((it, i) => (
            <li key={`${it.source}-${it.name}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick?.(it);
                  setOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-primary-50 flex items-baseline justify-between gap-2"
              >
                <span className="text-sm text-dark-900">{it.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-gray-400 shrink-0">
                  {it.source === "inventory" && it.itemNumber ? `#${it.itemNumber}` : it.source}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
