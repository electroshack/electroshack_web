import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, ChevronLeft, ChevronRight, Eye, EyeOff, Undo2, X } from "lucide-react";
import toast from "react-hot-toast";
import AdminLayout from "../../components/AdminLayout";
import { useCheckoutBasket } from "../../context/CheckoutBasketContext";
import ScanBarcodeIcon from "../../components/ScanBarcodeIcon";
import API from "../../api";

const statusColors = {
  "in-stock": "bg-green-100 text-green-700",
  "out-of-stock": "bg-amber-100 text-amber-800",
};

function displayStock(item) {
  if (item.status === "in-stock" || item.status === "reserved") return Number(item.quantity) > 0 ? "in-stock" : "out-of-stock";
  return "out-of-stock";
}

const TABS = [
  { value: "in-stock", label: "In stock" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "", label: "All" },
];

export default function Inventory() {
  const navigate = useNavigate();
  const { lines, removeLine, clear, consume, saleOnly, subtotal, count } = useCheckoutBasket();
  const [items, setItems] = useState([]);
  const [recentOut, setRecentOut] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("in-stock");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [undoing, setUndoing] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 40, sortBy: "itemNumber", sortOrder: "asc" };
      if (search) params.search = search;
      if (status) params.status = status;
      const { data } = await API.get("/inventory", { params });
      setItems(data.items);
      setTotalPages(data.totalPages);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [page, status, search]);

  const fetchRecentOut = useCallback(async () => {
    try {
      const { data } = await API.get("/inventory/recently-out-of-stock", { params: { limit: 20 } });
      setRecentOut(data.items || []);
    } catch {
      setRecentOut([]);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchRecentOut(); }, [fetchRecentOut]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchItems();
  };

  const undoEvent = async (eventId) => {
    setUndoing(eventId);
    try {
      await API.post(`/inventory/undo-stock-event/${eventId}`);
      toast.success("Stock restored.");
      await Promise.all([fetchItems(), fetchRecentOut()]);
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not undo.");
    }
    setUndoing("");
  };

  const toggleStorefront = async (e, item) => {
    e.stopPropagation();
    try {
      await API.put(`/inventory/${item._id}`, { showOnStorefront: !item.showOnStorefront });
      fetchItems();
    } catch {
      toast.error("Could not update storefront flag.");
    }
  };

  return (
    <AdminLayout title="Inventory">
      <div className="space-y-3">
        {recentOut.length > 0 ? (
          <div className="border border-gray-200 bg-white rounded-sm px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Recently out of stock</p>
              <span className="text-[10px] text-gray-400">{recentOut.length}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recentOut.map((row) => (
                <div key={row.eventId} className="shrink-0 flex items-center gap-2 border border-gray-200 bg-white px-2 py-1.5 min-w-[220px] rounded-sm">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/inventory/${row.item._id}`)}
                    className="text-left min-w-0 flex-1"
                  >
                    <p className="text-xs font-semibold text-dark-900 truncate">{row.item.name}</p>
                    <p className="text-[10px] text-gray-500">#{row.item.itemNumber} · qty {row.oldQuantity} → {row.newQuantity}</p>
                  </button>
                  <button
                    type="button"
                    disabled={undoing === row.eventId}
                    onClick={() => undoEvent(row.eventId)}
                    className="inline-flex items-center gap-1 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-sm bg-gray-100 text-dark-900 hover:bg-gray-200 disabled:opacity-50"
                  >
                    <Undo2 size={11} /> Undo
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-gray-200 bg-white p-0.5 rounded-sm">
            {TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => { setStatus(tab.value); setPage(1); }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-sm ${
                  status === tab.value ? "bg-dark-900 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearch} className="flex flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              placeholder="Search #, name, IMEI, barcode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 h-8 px-2 bg-white border border-gray-200 rounded-l-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button type="submit" className="h-8 px-2.5 bg-gray-100 border border-l-0 border-gray-200 rounded-r-sm text-gray-500 hover:bg-gray-200">
              <Search size={14} />
            </button>
          </form>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("es-open-barcode-scan"))}
              className="flex items-center gap-1.5 h-8 px-2.5 bg-white border border-gray-200 text-dark-900 text-sm font-medium rounded-sm hover:bg-gray-50"
            >
              <ScanBarcodeIcon size={20} />
              Scan
            </button>
            <Link to="/admin/inventory/new" className="flex items-center gap-1.5 h-8 px-2.5 bg-accent-400 text-dark-900 text-sm font-medium rounded-sm hover:bg-accent-300">
              <Plus size={14} />
              Add Item
            </Link>
          </div>
        </div>

        {lines.length > 0 ? (
          <div className="border border-gray-200 bg-white rounded-sm px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary-700">Checkout basket</p>
              <span className="text-[10px] text-gray-500">{count} item{count === 1 ? "" : "s"}</span>
              <span className="ml-auto text-sm font-semibold tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            <ul className="divide-y divide-gray-50 mb-2">
              {lines.map((line) => (
                <li key={line.inventoryItemId} className="flex items-center gap-2 py-1 text-sm">
                  <span className="font-mono text-[11px] text-gray-400">#{line.itemNumber}</span>
                  <span className="min-w-0 flex-1 truncate">{line.description}</span>
                  <span className="text-[11px] text-gray-500">×{line.stockQty}</span>
                  <span className="tabular-nums text-xs">${(Number(line.price) * Number(line.stockQty)).toFixed(2)}</span>
                  <button type="button" onClick={() => removeLine(line.inventoryItemId)} className="text-gray-400 hover:text-red-500 p-0.5" title="Remove">
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!saleOnly) {
                    toast.error("Receipts are sale-only. Use New Quote for repairs.");
                    return;
                  }
                  const snapshot = consume();
                  navigate("/admin/receipts/sale/new", { state: { basketLines: snapshot } });
                }}
                className="px-2.5 py-1 bg-primary-500 text-white text-xs font-medium rounded-sm hover:bg-primary-600"
              >
                Make receipt
              </button>
              <button
                type="button"
                onClick={() => {
                  const snapshot = consume();
                  navigate("/admin/receipts/new", { state: { basketLines: snapshot } });
                }}
                className="px-2.5 py-1 bg-white border border-gray-200 text-dark-900 text-xs font-medium rounded-sm hover:bg-gray-50"
              >
                Add to quote
              </button>
              <button type="button" onClick={clear} className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-600">
                Clear
              </button>
            </div>
          </div>
        ) : null}

        <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-500" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-gray-400 text-xs">None</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">#</th>
                    <th className="px-3 py-1.5 text-left font-medium">Name</th>
                    <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                    <th className="px-3 py-1.5 text-right font-medium">Sell</th>
                    <th className="px-3 py-1.5 text-center font-medium">Shop</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <tr
                      key={item._id}
                      onClick={() => navigate(`/admin/inventory/${item._id}`)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-500">#{item.itemNumber}</td>
                      <td className="px-3 py-1.5 text-dark-900 font-medium">
                        <span className="block leading-tight">{item.name}</span>
                        {(item.imei || item.serialNumber) ? (
                          <span className="block font-mono text-[10px] text-gray-400 truncate max-w-[280px]">
                            {[item.imei && `IMEI ${item.imei}`, item.serialNumber && `S/N ${item.serialNumber}`].filter(Boolean).join(" · ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold tabular-nums">{item.quantity}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold ${statusColors[displayStock(item)]}`}>
                          {displayStock(item).replace(/-/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-700">${Number(item.sellingPrice || 0).toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          title={item.showOnStorefront ? "On storefront" : "Hidden from storefront"}
                          onClick={(e) => toggleStorefront(e, item)}
                          className={`inline-flex p-1 ${item.showOnStorefront ? "text-green-600" : "text-gray-300"}`}
                        >
                          {item.showOnStorefront ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 text-xs text-gray-500">
            <span>{total} item{total === 1 ? "" : "s"}</span>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded-sm disabled:opacity-50">
                  <ChevronLeft size={12} /> Prev
                </button>
                <span>Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded-sm disabled:opacity-50">
                  Next <ChevronRight size={12} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
