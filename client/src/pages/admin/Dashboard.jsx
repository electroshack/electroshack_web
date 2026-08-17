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

const statusColors = {
  received: "bg-gray-100 text-gray-600",
  diagnosing: "bg-primary-100 text-primary-700",
  "waiting-for-parts": "bg-accent-100 text-accent-700",
  "in-progress": "bg-blue-100 text-blue-700",
  "ready-for-pickup": "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

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

  const stats = [
    { label: "Quotes", value: receiptStats?.totalReceipts || 0, icon: Receipt, to: "/admin/receipts" },
    {
      label: "Active",
      value:
        (receiptStats?.statusCounts?.["in-progress"] || 0) +
        (receiptStats?.statusCounts?.diagnosing || 0) +
        (receiptStats?.statusCounts?.["waiting-for-parts"] || 0),
      icon: Clock,
      to: "/admin/receipts",
    },
    { label: "Stock", value: inventoryStats?.totalItems || 0, icon: Package, to: "/admin/inventory" },
    { label: "Completed", value: `$${(receiptStats?.totalRevenue || 0).toLocaleString()}`, icon: DollarSign },
  ];

  const pct = Math.max(0, Math.min(100, storage?.usedPct || 0));

  return (
    <AdminLayout title="Dashboard">
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-500" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {stats.map((s) => {
              const body = (
                <div className="bg-white border border-gray-200 rounded-sm px-3 py-2 flex items-center gap-2">
                  <s.icon size={14} className="text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-dark-900 leading-tight">{s.value}</p>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">{s.label}</p>
                  </div>
                </div>
              );
              return s.to ? (
                <Link key={s.label} to={s.to}>
                  {body}
                </Link>
              ) : (
                <div key={s.label}>{body}</div>
              );
            })}
          </div>

          {storage ? (
            <div className="bg-white border border-gray-200 rounded-sm px-3 py-2 flex items-center gap-3">
              {storage.level === "ok" ? <Database size={14} className="text-gray-400" /> : <AlertTriangle size={14} className="text-red-500" />}
              <div className="flex-1 min-w-0">
                <div className="h-1.5 bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full ${storage.level === "critical" ? "bg-red-500" : storage.level === "warning" ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-mono text-gray-600 tabular-nums">{pct.toFixed(0)}%</span>
              <span className="text-[11px] text-gray-400">{fmtBytes(storage.totalBytes)}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            <Link to="/admin/receipts/new" className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-500 text-white text-xs font-medium rounded-sm hover:bg-primary-600">
              <Plus size={12} /> Quote
            </Link>
            <Link to="/admin/inventory/new" className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-400 text-dark-900 text-xs font-medium rounded-sm hover:bg-accent-300">
              <Plus size={12} /> Item
            </Link>
            <Link to="/admin/grocery-list" className="px-2.5 py-1 bg-white border border-gray-200 text-xs font-medium rounded-sm hover:bg-gray-50">
              Grocery
            </Link>
            <Link to="/admin/metrics" className="px-2.5 py-1 bg-white border border-gray-200 text-xs font-medium rounded-sm hover:bg-gray-50">
              Metrics
            </Link>
            {unreadMessages > 0 ? (
              <Link to="/admin/messages" className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-xs font-medium rounded-sm">
                <MessageSquare size={12} /> {unreadMessages}
              </Link>
            ) : null}
          </div>

          <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-dark-900">Recent</h2>
              <Link to="/admin/receipts" className="text-[11px] text-primary-500 hover:underline">All</Link>
            </div>
            {recentReceipts.length === 0 ? (
              <p className="px-3 py-6 text-center text-gray-400 text-xs">None</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {recentReceipts.map((r) => (
                    <tr key={r._id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5">
                        <Link to={`/admin/receipts/${r._id}`} className="font-medium text-primary-600 hover:underline">
                          #{r.receiptNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 text-dark-900">{r.customerName}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold ${statusColors[r.status] || "bg-gray-100 text-gray-600"}`}>
                          {r.status?.replace(/-/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-[11px] text-gray-400">{new Date(r.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
