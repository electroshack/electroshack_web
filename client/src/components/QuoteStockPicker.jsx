import React, { useEffect, useState } from "react";
import API from "../api";

const CATEGORY_MAP = {
  "cell-phone": "cell-phone-purchase",
  laptop: "laptop-purchase",
  pc: "pc-purchase",
  accessory: "cell-phone-accessory",
  tablet: "other",
  smartwatch: "other",
  part: "other",
  other: "other",
};

export default function QuoteStockPicker({ onPick }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 1) {
      setHits([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await API.get("/inventory/name-suggestions", { params: { q: term, limit: 8 } });
        setHits((data.items || []).filter((it) => it.inventoryItemId));
        setOpen(true);
      } catch {
        setHits([]);
      }
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative mt-0.5">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        placeholder="Link stock… (optional)"
        className="w-full px-1 py-0.5 text-[10px] bg-transparent border-b border-amber-800/15 text-amber-900/70 focus:outline-none focus:border-amber-800/40"
      />
      {open && hits.length > 0 ? (
        <ul className="absolute z-20 left-0 right-0 mt-0.5 bg-white border border-amber-200 rounded shadow-md max-h-40 overflow-y-auto">
          {hits.map((it) => (
            <li key={it.inventoryItemId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick?.({
                    inventoryItemId: it.inventoryItemId,
                    description: it.name,
                    price: it.sellingPrice,
                    category: CATEGORY_MAP[it.category] || "other",
                    itemNumber: it.itemNumber,
                    quantity: it.quantity,
                    status: it.status,
                  });
                  setQ("");
                  setHits([]);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1 text-[11px] hover:bg-amber-50"
              >
                <span className="font-medium">#{it.itemNumber} {it.name}</span>
                <span className="text-gray-400 ml-1">qty {it.quantity} · ${Number(it.sellingPrice || 0).toFixed(2)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
