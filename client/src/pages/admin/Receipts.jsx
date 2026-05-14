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
    <AdminLayout title="Receipts / Invoices">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              placeholder="Search by name, phone, or receipt #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-l-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button type="submit" className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-200 rounded-r-lg text-gray-500 hover:bg-gray-200 transition-colors">
              <Search size={16} />
            </button>
          </form>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Statuses</option>
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
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors ml-auto"
          >
            <Plus size={16} />
            New Receipt
          </Link>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">No receipts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Receipt #</th>
                    <th className="px-4 py-3 text-left font-medium">Customer</th>
                    <th className="px-4 py-3 text-left font-medium">Phone</th>
                    <th className="px-4 py-3 text-left font-medium">Items</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Estimate</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {receipts.map((r) => (
                    <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/admin/receipts/${r._id}`} className="font-medium text-primary-500 hover:underline">
                          #{r.receiptNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-dark-900 font-medium">{r.customerName}</td>
                      <td className="px-4 py-3 text-gray-500">{r.customerPhone}</td>
                      <td className="px-4 py-3 text-gray-500">{r.items?.length || 0} item{(r.items?.length || 0) !== 1 ? "s" : ""}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[r.status] || "bg-gray-100"}`}>
                          {r.status?.replace(/-/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">${r.priceEstimate?.toFixed(2) || "0.00"}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(r.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}

          {search.trim() !== "" && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/80 flex items-center justify-center gap-2 text-sm text-gray-600">
              <FileText size={16} className="text-gray-400 shrink-0" aria-hidden />
              <Link to="/admin/receipts/legacy/new" className="font-medium text-primary-600 hover:text-primary-700 hover:underline">
                Add paper / old receipt
              </Link>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
