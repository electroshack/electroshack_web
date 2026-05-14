import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, ChevronLeft, ChevronRight, Package, Camera } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api";

const statusColors = {
  "in-stock": "bg-green-100 text-green-700",
  sold: "bg-gray-100 text-gray-600",
  reserved: "bg-accent-100 text-accent-700",
  returned: "bg-red-100 text-red-700",
};

const conditionLabels = {
  new: "New",
  refurbished: "Refurbished",
  used: "Used",
  "for-parts": "For Parts",
};

const categoryLabels = {
  "cell-phone": "Cell Phone",
  laptop: "Laptop",
  pc: "PC",
  tablet: "Tablet",
  smartwatch: "Smartwatch",
  accessory: "Accessory",
  part: "Part",
  other: "Other",
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (status) params.status = status;
      if (category) params.category = category;
      const { data } = await API.get("/inventory", { params });
      setItems(data.items);
      setTotalPages(data.totalPages);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [page, status, category, search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchItems();
  };

  return (
    <AdminLayout title="Inventory">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              placeholder="Search item #, IMEI, serial, barcode, name, buyer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-l-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button type="submit" className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-200 rounded-r-lg text-gray-500 hover:bg-gray-200 transition-colors">
              <Search size={16} />
            </button>
          </form>

          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Statuses</option>
            <option value="in-stock">In Stock</option>
            <option value="sold">Sold</option>
            <option value="reserved">Reserved</option>
            <option value="returned">Returned</option>
          </select>

          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Categories</option>
            <option value="cell-phone">Cell Phone</option>
            <option value="laptop">Laptop</option>
            <option value="pc">PC</option>
            <option value="tablet">Tablet</option>
            <option value="smartwatch">Smartwatch</option>
            <option value="accessory">Accessory</option>
            <option value="part">Part</option>
            <option value="other">Other</option>
          </select>

          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("es-open-barcode-scan"))}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-dark-900 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              title="Scan barcode with camera"
            >
              <Camera size={16} />
              Scan
            </button>
            <Link to="/admin/inventory/new" className="flex items-center gap-2 px-4 py-2 bg-accent-400 text-dark-900 text-sm font-medium rounded-lg hover:bg-accent-300 transition-colors">
              <Plus size={16} />
              Add Item
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Package size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">No inventory items found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Item #</th>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Condition</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Cost</th>
                    <th className="px-4 py-3 text-left font-medium">Sell Price</th>
                    <th className="px-4 py-3 text-left font-medium">Qty</th>
                    <th className="px-4 py-3 text-left font-medium">Bought From</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/admin/inventory/${item._id}`} className="font-medium text-primary-500 hover:underline">
                          #{item.itemNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-dark-900 font-medium">
                        <span className="block">{item.name}</span>
                        {(item.imei || item.serialNumber) ? (
                          <span className="block font-mono text-[11px] text-gray-400 mt-0.5 truncate max-w-[240px]" title={[item.imei, item.serialNumber].filter(Boolean).join(" · ")}>
                            {[item.imei && `IMEI ${item.imei}`, item.serialNumber && `S/N ${item.serialNumber}`].filter(Boolean).join(" · ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{categoryLabels[item.category] || item.category}</td>
                      <td className="px-4 py-3 text-gray-500">{conditionLabels[item.condition] || item.condition}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.status] || "bg-gray-100"}`}>
                          {item.status?.replace(/-/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">${item.costPrice?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-500">${item.sellingPrice?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-500">{item.quantity}</td>
                      <td className="px-4 py-3 text-gray-500">{item.boughtFrom || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors">
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors">
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
