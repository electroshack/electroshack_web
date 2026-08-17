import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api";

const statusColors = {
  received: "bg-gray-100 text-gray-600",
  diagnosing: "bg-primary-100 text-primary-700",
  "waiting-for-parts": "bg-accent-100 text-accent-700",
  "in-progress": "bg-blue-100 text-blue-700",
  "ready-for-pickup": "bg-green-100 text-green-700",
  "customer-called": "bg-emerald-100 text-emerald-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (status) params.status = status;
      const { data } = await API.get("/receipts", { params });
      setReceipts(data.receipts);
      setTotalPages(data.totalPages);
    } catch {
      setReceipts([]);
    }
    setLoading(false);
  }, [page, status, search]);

  useEffect(() => { fetchReceipts(); }, [fetchReceipts]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchReceipts();
  };

  return (
    <AdminLayout title="Quotes / Tickets">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              placeholder="Name, phone, or #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 h-8 px-2 bg-white border border-gray-200 rounded-l-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button type="submit" className="h-8 px-2.5 bg-gray-100 border border-l-0 border-gray-200 rounded-r-sm text-gray-500 hover:bg-gray-200">
              <Search size={14} />
            </button>
          </form>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-8 px-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All</option>
            <option value="received">Received</option>
            <option value="diagnosing">Diagnosing</option>
            <option value="waiting-for-parts">Waiting for Parts</option>
            <option value="in-progress">In Progress</option>
            <option value="ready-for-pickup">Ready for Pickup</option>
            <option value="customer-called">Customer Called</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <Link
            to="/admin/receipts/new"
            className="inline-flex items-center gap-1 h-8 px-2.5 bg-primary-500 text-white text-sm font-medium rounded-sm hover:bg-primary-600 ml-auto"
          >
            <Plus size={12} /> Quote
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-500" />
            </div>
          ) : receipts.length === 0 ? (
            <p className="px-3 py-6 text-center text-gray-400 text-xs">None</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">#</th>
                    <th className="px-3 py-1.5 text-left font-medium">Type</th>
                    <th className="px-3 py-1.5 text-left font-medium">Customer</th>
                    <th className="px-3 py-1.5 text-left font-medium">Phone</th>
                    <th className="px-3 py-1.5 text-left font-medium">Items</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                    <th className="px-3 py-1.5 text-left font-medium">Total</th>
                    <th className="px-3 py-1.5 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {receipts.map((r) => (
                    <tr key={r._id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5">
                        <Link to={`/admin/receipts/${r._id}`} className="font-medium text-primary-600 hover:underline">
                          #{r.receiptNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          {r.documentType === "receipt" ? "Receipt" : "Quote"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-dark-900">{r.customerName}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.customerPhone}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.items?.length || 0}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold ${statusColors[r.status] || "bg-gray-100 text-gray-600"}`}>
                          {r.status?.replace(/-/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">${Number(r.total ?? r.priceEstimate ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-[11px] text-gray-400">{new Date(r.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-100">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded-sm disabled:opacity-50"
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded-sm disabled:opacity-50"
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          )}

          {search.trim() !== "" && (
            <div className="px-3 py-1.5 border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-600">
              <FileText size={14} className="text-gray-400 shrink-0" aria-hidden />
              <Link to="/admin/receipts/legacy/new" className="font-medium text-primary-600 hover:underline">
                Add paper / old quote
              </Link>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
