import React, { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import API from "../api";

/** Inventory category → quote purchase category. */
export function quoteCategoryFromStock(invCategory) {
  if (invCategory === "laptop") return "laptop-purchase";
  if (invCategory === "pc") return "pc-purchase";
  if (invCategory === "accessory") return "cell-phone-accessory";
  if (invCategory === "cell-phone" || invCategory === "smartwatch" || invCategory === "tablet") {
    return "cell-phone-purchase";
  }
  return "other";
}

export default function QuoteStockPicker({ open, onClose, onPick }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setQ("");
    let cancelled = false;
    setLoading(true);
    API.get("/inventory", { params: { page: 1, limit: 30, status: "in-stock" } })
      .then(({ data }) => {
        if (!cancelled) setItems(data.items || []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const search = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    try {
      const { data } = await API.get("/inventory", {
        params: { page: 1, limit: 30, status: "in-stock", search: q.trim() },
      });
      setItems(data.items || []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/40 px-3" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white border border-gray-200 rounded-sm shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-100">
          <form onSubmit={search} className="flex flex-1 items-center gap-1">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, IMEI, serial, barcode…"
              className="flex-1 h-8 px-1 text-sm bg-transparent focus:outline-none"
            />
          </form>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700" title="Close">
            <X size={14} />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-xs text-gray-400">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">No in-stock items.</div>
          ) : (
            items.map((it) => (
              <button
                key={it._id}
                type="button"
                onClick={() => onPick(it)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 border-b border-gray-50 flex items-baseline gap-2"
              >
                <span className="flex-1 min-w-0 truncate font-medium text-dark-900">{it.name}</span>
                <span className="text-gray-400 shrink-0">{it.category}</span>
                <span className="tabular-nums shrink-0">${Number(it.sellingPrice || 0).toFixed(2)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
