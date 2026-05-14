import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Receipt, Package, MessageSquare, DollarSign, Clock, Plus } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api";

export default function Dashboard() {
  const [receiptStats, setReceiptStats] = useState(null);
  const [inventoryStats, setInventoryStats] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [recentReceipts, setRecentReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      API.get("/receipts/stats").then((r) => setReceiptStats(r.data)).catch(() => {}),
      API.get("/inventory/stats").then((r) => setInventoryStats(r.data)).catch(() => {}),
      API.get("/contact-forms").then((r) => setUnreadMessages(r.data.filter((f) => !f.read).length)).catch(() => {}),
      API.get("/receipts?limit=5").then((r) => setRecentReceipts(r.data.receipts || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const statCards = [
    {
      label: "Total Receipts",
      value: receiptStats?.totalReceipts || 0,
      icon: Receipt,
      color: "bg-primary-50 text-primary-500",
      link: "/admin/receipts",
    },
    {
      label: "Active Repairs",
      value: (receiptStats?.statusCounts?.["in-progress"] || 0) + (receiptStats?.statusCounts?.diagnosing || 0) + (receiptStats?.statusCounts?.["waiting-for-parts"] || 0),
      icon: Clock,
      color: "bg-accent-50 text-accent-600",
      link: "/admin/receipts",
    },
    {
      label: "Inventory Items",
      value: inventoryStats?.totalItems || 0,
      icon: Package,
      color: "bg-green-50 text-green-600",
      link: "/admin/inventory",
    },
    {
      label: "Revenue",
      value: `$${(receiptStats?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "bg-purple-50 text-purple-600",
    },
  ];

  const statusColors = {
    received: "bg-gray-100 text-gray-600",
    diagnosing: "bg-primary-100 text-primary-700",
    "waiting-for-parts": "bg-accent-100 text-accent-700",
    "in-progress": "bg-blue-100 text-blue-700",
    "ready-for-pickup": "bg-green-100 text-green-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <AdminLayout title="Dashboard">
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${s.color}`}>
                    <s.icon size={20} />
                  </div>
                  {s.link && (
                    <Link to={s.link} className="text-xs text-gray-400 hover:text-primary-500 transition-colors">View &rarr;</Link>
                  )}
                </div>
                <p className="text-2xl font-bold text-dark-900">{s.value}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/receipts/new" className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors">
              <Plus size={16} />
              New Receipt
            </Link>
            <Link to="/admin/receipts/legacy/new" className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-950 text-sm font-medium rounded-lg hover:bg-amber-200 transition-colors border border-amber-200/80">
              <Plus size={16} />
              Log historical receipt
            </Link>
            <Link to="/admin/inventory/new" className="flex items-center gap-2 px-4 py-2 bg-accent-400 text-dark-900 text-sm font-medium rounded-lg hover:bg-accent-300 transition-colors">
              <Plus size={16} />
              Add Inventory
            </Link>
            <Link to="/admin/grocery-list" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Grocery list
            </Link>
            <Link to="/admin/metrics" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Metrics
            </Link>
            {unreadMessages > 0 && (
              <Link to="/admin/messages" className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors">
                <MessageSquare size={16} />
                {unreadMessages} Unread Message{unreadMessages > 1 ? "s" : ""}
              </Link>
            )}
          </div>

          {/* Recent Receipts */}
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-dark-900">Recent Receipts</h2>
              <Link to="/admin/receipts" className="text-sm text-primary-500 hover:underline">View all</Link>
            </div>
            {recentReceipts.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No receipts yet. Create your first receipt to get started.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentReceipts.map((r) => (
                  <Link
                    key={r._id}
                    to={`/admin/receipts/${r._id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-500 font-bold text-sm flex-shrink-0">
                        #{r.receiptNumber?.slice(-3)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark-900 truncate">{r.customerName}</p>
                        <p className="text-xs text-gray-500">{new Date(r.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[r.status] || "bg-gray-100 text-gray-600"}`}>
                      {r.status?.replace(/-/g, " ")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
