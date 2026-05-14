import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Receipt, Package, MessageSquare, DollarSign, Clock, Plus, AlertTriangle, Database } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api";

function fmtBytes(n) {
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MiB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}

export default function Dashboard() {
  const [receiptStats, setReceiptStats] = useState(null);
  const [inventoryStats, setInventoryStats] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [recentReceipts, setRecentReceipts] = useState([]);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      API.get("/receipts/stats").then((r) => setReceiptStats(r.data)).catch(() => {}),
      API.get("/inventory/stats").then((r) => setInventoryStats(r.data)).catch(() => {}),
      API.get("/contact-forms").then((r) => setUnreadMessages(r.data.filter((f) => !f.read).length)).catch(() => {}),
      API.get("/receipts?limit=5").then((r) => setRecentReceipts(r.data.receipts || [])).catch(() => {}),
      API.get("/admin/storage-stats").then((r) => setStorage(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const statCards = [
    {
      label: "Total Quotes",
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
      label: "Completed quote total",
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

          {/* Database storage (free-tier capacity warning) */}
          {storage && (() => {
            const pct = Math.max(0, Math.min(100, storage.usedPct || 0));
            const tone =
              storage.level === "critical"
                ? { ring: "border-red-200", bg: "bg-red-50", bar: "bg-red-500", text: "text-red-700", icon: "text-red-500" }
                : storage.level === "warning"
                  ? { ring: "border-amber-200", bg: "bg-amber-50", bar: "bg-amber-500", text: "text-amber-800", icon: "text-amber-500" }
                  : { ring: "border-emerald-200", bg: "bg-emerald-50", bar: "bg-emerald-500", text: "text-emerald-700", icon: "text-emerald-500" };
            const Icon = storage.level === "ok" ? Database : AlertTriangle;
            return (
              <div className={`rounded-xl border ${tone.ring} ${tone.bg} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white ${tone.icon}`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${tone.text} uppercase tracking-wider`}>
                        {storage.level === "critical"
                          ? "Database almost full"
                          : storage.level === "warning"
                            ? "Database getting full"
                            : "Database storage healthy"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{storage.capLabel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-extrabold ${tone.text} font-mono tabular-nums`}>{pct.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">{fmtBytes(storage.totalBytes)} of {fmtBytes(storage.cap)}</p>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-white overflow-hidden">
                  <div className={`h-full ${tone.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-[11px] text-gray-600">
                  <div><span className="text-gray-400 uppercase tracking-wider block text-[9px] font-bold mb-0.5">Documents</span>{Number(storage.objects || 0).toLocaleString()}</div>
                  <div><span className="text-gray-400 uppercase tracking-wider block text-[9px] font-bold mb-0.5">Collections</span>{storage.collections}</div>
                  <div><span className="text-gray-400 uppercase tracking-wider block text-[9px] font-bold mb-0.5">Indexes</span>{fmtBytes(storage.indexSize)}</div>
                  <div><span className="text-gray-400 uppercase tracking-wider block text-[9px] font-bold mb-0.5">Avg doc</span>{fmtBytes(storage.avgObjSize)}</div>
                </div>
                {storage.level !== "ok" && (
                  <p className="text-[11px] text-gray-600 mt-3 leading-snug">
                    {storage.level === "critical"
                      ? "Atlas's free M0 cluster is almost out of space — new writes will start failing soon. Upgrade the cluster on MongoDB Atlas, or purge old quotes / inventory photos."
                      : "You're past the comfort zone for the free M0 cluster. Plan an upgrade (M2 starts at $9/mo) or trim large records before you hit the cap."}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/receipts/new" className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors">
              <Plus size={16} />
              New Quote
            </Link>
            <Link to="/admin/receipts/legacy/new" className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-950 text-sm font-medium rounded-lg hover:bg-amber-200 transition-colors border border-amber-200/80">
              <Plus size={16} />
              Log historical quote
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
              <h2 className="font-semibold text-dark-900">Recent Quotes</h2>
              <Link to="/admin/receipts" className="text-sm text-primary-500 hover:underline">View all</Link>
            </div>
            {recentReceipts.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No quotes yet. Create your first quote to get started.</div>
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
